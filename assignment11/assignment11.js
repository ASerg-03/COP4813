"use strict";

// ==========================================
// BSIT COURSE ADVISOR
// COP4813 - Assignment 11
// ==========================================

// Main application data
let advisorData = null;

// Tracks courses completed by the student
const completedCourses = new Set();

// Storage key
const STORAGE_KEY = "bsitAdvisorCompletedCourses";
const CREDIT_STORAGE_KEY = "bsitAdvisorExternalCredits";

// Convenient reference to HTML elements
const getElement = (id) => document.getElementById(id);

// Stores courses assigned to semesters
const plannedCourses = new Map();

// Local storage key for the semester plan
const PLAN_STORAGE_KEY = "bsitAdvisorPlannedCourses";

// Semester ordering
const SEMESTERS = ["Fall", "Spring", "Summer"];

// "Select one" requirements (from exclusiveChoiceGroups in courses.json)
let exclusiveGroups = [];

// Ordinary OR prerequisites that are explicitly NOT exclusive
// (from alternativePrerequisiteGroups in courses.json)
let alternativePrerequisiteGroups = [];

// Problems found while reading saved data. These are shown to the
// student instead of silently deleting anything.
const loadWarnings = [];
let planLoadMessage = "";


// ==========================================
// SMALL HELPERS
// ==========================================

// Accept either a string or an array of strings
function toList(value) {

    if (Array.isArray(value)) {

        return value.filter(item =>
            typeof item === "string" && item.trim() !== ""
        );

    }

    if (typeof value === "string" && value.trim() !== "") {
        return [value];
    }

    return [];

}


// Add a paragraph of plain text to a container
function appendLine(container, text, className) {

    const line = document.createElement("p");

    if (className) {
        line.className = className;
    }

    line.textContent = text;

    container.appendChild(line);

    return line;

}


// Basic notice styling without touching the stylesheet
function styleNotice(element, kind) {

    element.style.padding = "10px";
    element.style.margin = "10px 0";

    if (kind === "warning") {

        element.style.backgroundColor = "#f2e0e0";
        element.style.borderLeft = "4px solid #8d2929";

    } else {

        element.style.backgroundColor = "#c4cad3";
        element.style.borderLeft = "4px solid #526b8d";

    }

}


// Make a button look and behave disabled
function disableButton(button, reason) {

    button.disabled = true;
    button.title = reason;
    button.style.opacity = "0.5";
    button.style.cursor = "not-allowed";

}


// ==========================================
// LOAD JSON DATA
// ==========================================

async function loadCourseData() {

    try {

        const response = await fetch("courses.json");

        if (!response.ok) {
            throw new Error("Could not load courses.json");
        }

        advisorData = await response.json();

        prepareChoiceMetadata();

        loadExternalCredits();

        loadCompletedCourses();

        loadPlannedCourses();

        console.log("Course database loaded:", advisorData);

        // Initialize the advisor after loading the data
        initializeAdvisor();

    } catch (error) {

        console.error("Error loading course data:", error);

        getElement("systemStatus").textContent = "SYS: ERROR";

        getElement("programOverview").textContent =
            "Unable to load course information. Check courses.json and try again.";

    }

}


// ==========================================
// INITIALIZE THE ADVISOR
// ==========================================

function initializeAdvisor() {

    // Display program information
    renderProgramOverview();

    // Create the warning/message areas the advisor needs
    ensureDynamicElements();

    // Populate the completed course dropdown
    populateCourseSelector();

    // Connect buttons and input events
    setupEventListeners();

    // Generate the initial interface
    updateInterface();

    getElement("systemStatus").textContent = "SYS: ONLINE";

    // Tell the student if saved plan entries could not be restored
    if (planLoadMessage) {
        setPlannerMessage(planLoadMessage);
    }

}


// ==========================================
// COURSE LOOKUP
// ==========================================

function getCourse(code) {

    return advisorData.courses.find(course => course.code === code);

}


function getCourseName(code) {

    const course = getCourse(code);

    return course ? course.name : code;

}


// ==========================================
// EXCLUSIVE-CHOICE METADATA
// ==========================================

// Normalize the choice groups from courses.json.
// Each option is a list of course codes. A single code string is also
// accepted and treated as a one-course option.
function prepareChoiceMetadata() {

    const rawGroups = Array.isArray(advisorData.exclusiveChoiceGroups)
        ? advisorData.exclusiveChoiceGroups
        : [];

    exclusiveGroups = rawGroups
        .filter(group =>
            group &&
            group.exclusive !== false &&
            Array.isArray(group.options)
        )
        .map(group => {

            const options = group.options
                .map(toList)
                .filter(option => option.length > 0);

            return {
                id: group.id,
                label: group.label || group.id,
                requirementId: group.requirementId || null,
                note: group.note || "",
                options: options,
                codes: new Set(options.flat())
            };

        })
        .filter(group => group.options.length > 0);

    const rawAlternatives = Array.isArray(advisorData.alternativePrerequisiteGroups)
        ? advisorData.alternativePrerequisiteGroups
        : [];

    alternativePrerequisiteGroups = rawAlternatives.filter(group =>
        group &&
        typeof group.appliesTo === "string" &&
        Array.isArray(group.alternatives)
    );

    // Help catch typos in the JSON during development
    exclusiveGroups.forEach(group => {

        group.codes.forEach(code => {

            if (!getCourse(code)) {

                console.warn(
                    `Exclusive group "${group.id}" references unknown course ${code}`
                );

            }

        });

    });

}


// "EET3085 + EET1021C"
function formatOption(option) {

    return option.join(" + ");

}


// "EET3086 | EET3085 + EET1021C | EET1011C + EET1021C"
function describeGroupOptions(group) {

    return group.options.map(formatOption).join(" | ");

}


// Every course chosen from this group that is also in `selected`
function getChosenCourses(group, selected) {

    return [...selected].filter(code => group.codes.has(code));

}


// Would adding `code` to the `selected` courses break an exclusive choice?
//
// A group is satisfied while everything chosen from it fits inside ONE
// option. This is what makes partially completed pathways work:
//   - EET1021C alone fits both EET3085 + EET1021C and EET1011C + EET1021C
//   - EET1021C + EET3085 fits only the first, so EET1011C and EET3086
//     become conflicts.
// Returns null when there is no conflict.
function findChoiceConflict(code, selected) {

    for (const group of exclusiveGroups) {

        if (!group.codes.has(code)) {
            continue;
        }

        const chosen = getChosenCourses(group, selected)
            .filter(chosenCode => chosenCode !== code);

        if (chosen.length === 0) {
            continue;
        }

        const together = new Set([...chosen, code]);

        const fitsOneOption = group.options.some(option =>
            [...together].every(courseCode => option.includes(courseCode))
        );

        if (fitsOneOption) {
            continue;
        }

        // Courses that cannot share any option with `code`
        const optionsWithCode = group.options.filter(option =>
            option.includes(code)
        );

        let conflicts = chosen.filter(chosenCode =>
            !optionsWithCode.some(option => option.includes(chosenCode))
        );

        // Existing choices may already clash with each other
        if (conflicts.length === 0) {
            conflicts = chosen;
        }

        return { group: group, conflicts: conflicts };

    }

    return null;

}


function getSelectedCourses() {

    return new Set([...completedCourses, ...plannedCourses.keys()]);

}


// Conflict against courses already marked completed
function getCompletionConflict(code) {

    return findChoiceConflict(code, completedCourses);

}


// Conflict against completed AND planned courses
function getPlanningConflict(code) {

    return findChoiceConflict(code, getSelectedCourses());

}


function describeChoiceConflict(code, conflict) {

    const chosen = conflict.conflicts
        .map(otherCode =>
            `${otherCode} (${completedCourses.has(otherCode) ? "completed" : "planned"})`
        )
        .join(", ");

    return `${code} is unavailable: only one option from ` +
        `"${conflict.group.label}" can be chosen, and you already chose ${chosen}. ` +
        `Allowed options: ${describeGroupOptions(conflict.group)}.`;

}


// Completed courses that already contradict each other
// (possible when older saved data is loaded)
function findExistingChoiceConflicts() {

    const found = [];

    exclusiveGroups.forEach(group => {

        const chosen = getChosenCourses(group, completedCourses);

        if (chosen.length < 2) {
            return;
        }

        const fitsOneOption = group.options.some(option =>
            chosen.every(code => option.includes(code))
        );

        if (!fitsOneOption) {
            found.push({ group: group, courses: chosen });
        }

    });

    return found;

}


// ==========================================
// LOCAL STORAGE SAVING
// ==========================================

function loadExternalCredits() {

    try {

        const saved = JSON.parse(
            localStorage.getItem(CREDIT_STORAGE_KEY) || "{}"
        );

        if (typeof saved !== "object" || saved === null) {
            return;
        }

        const requirements = advisorData.program.creditRequirements;

        getElement("generalEducationCredits").value =
            Math.max(0, Math.min(
                requirements.generalEducation,
                Number(saved.generalEducation) || 0
            ));

        getElement("lowerLevelCredits").value =
            Math.max(0, Math.min(
                requirements.lowerLevelTechnicalElectives,
                Number(saved.lowerLevel) || 0
            ));

    } catch (error) {

        console.error("Could not load external credits:", error);

    }

}


function saveExternalCredits() {

    try {

        const credits = {
            generalEducation: Number(
                getElement("generalEducationCredits").value
            ) || 0,

            lowerLevel: Number(
                getElement("lowerLevelCredits").value
            ) || 0
        };

        localStorage.setItem(
            CREDIT_STORAGE_KEY,
            JSON.stringify(credits)
        );

    } catch (error) {

        console.error("Could not save external credits:", error);

    }

}


function loadCompletedCourses() {

    try {

        const saved = JSON.parse(
            localStorage.getItem(STORAGE_KEY) || "[]"
        );

        if (Array.isArray(saved)) {

            const unknown = [];

            saved.forEach(code => {

                if (getCourse(code)) {

                    // Conflicting choices are kept and reported, never deleted
                    completedCourses.add(code);

                } else {

                    unknown.push(String(code));

                }

            });

            if (unknown.length > 0) {

                loadWarnings.push(
                    "Saved courses that are not in the current catalog were ignored: " +
                    unknown.join(", ") + "."
                );

            }

        }

    } catch (error) {

        console.error("Could not load saved courses:", error);

    }

}


function saveCompletedCourses() {

    try {

        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify([...completedCourses])
        );

    } catch (error) {

        console.error("Could not save completed courses:", error);

    }

}
// ==========================================
// PREREQUISITE EVALUATION
// ==========================================

function evaluateRule(rule, availableCourses = completedCourses) {

    // A string represents one required course
    if (typeof rule === "string") {
        return availableCourses.has(rule);
    }

    if (!rule || typeof rule !== "object") {
        return false;
    }

    const results = [];

    // ALL: Every condition must be satisfied
    if (Array.isArray(rule.all)) {

        results.push(
            rule.all.every(condition =>
                evaluateRule(condition, availableCourses)
            )
        );

    }

    // ANY: At least one condition must be satisfied
    // (ordinary OR - this never blocks other courses)
    if (Array.isArray(rule.any)) {

        results.push(
            rule.any.some(condition =>
                evaluateRule(condition, availableCourses)
            )
        );

    }

    // CHOOSE: Complete a specified number of alternatives
    if (
        Number.isInteger(rule.choose) &&
        Array.isArray(rule.from)
    ) {

        const completedChoices = rule.from.filter(
            code => availableCourses.has(code)
        ).length;

        results.push(completedChoices >= rule.choose);

    }

    return results.length > 0 && results.every(Boolean);

}
// ==========================================
// SEMESTER PLANNING LOGIC
// ==========================================

// Convert a year and semester into a chronological number
function getTermIndex(year, semester) {

    const semesterIndex = SEMESTERS.indexOf(semester);

    if (
        !Number.isInteger(Number(year)) ||
        Number(year) < 1 ||
        Number(year) > 2 ||
        semesterIndex === -1
    ) {
        return -1;
    }

    return (Number(year) - 1) * 3 + semesterIndex;

}


// Check whether a course is offered in a semester
function courseOfferedIn(course, semester) {

    // Missing offering information means availability is unknown
    if (!Array.isArray(course.offered)) {
        return true;
    }

    return course.offered.includes(semester);

}


// Get completed courses and courses planned BEFORE a given semester
function getCompletedBeforeTerm(year, semester) {

    const targetTerm = getTermIndex(year, semester);

    const availableCourses = new Set(completedCourses);

    plannedCourses.forEach((placement, code) => {

        const plannedTerm = getTermIndex(
            placement.year,
            placement.semester
        );

        if (plannedTerm < targetTerm) {
            availableCourses.add(code);
        }

    });

    return availableCourses;

}


// Check whether a course can be taken in a particular semester
function isCourseEligibleForTerm(course, year, semester) {

    if (!courseOfferedIn(course, semester)) {
        return false;
    }

    const availableCourses = getCompletedBeforeTerm(
        year,
        semester
    );

    return !course.prerequisites ||
        evaluateRule(course.prerequisites, availableCourses);

}


// Check whether a course can be scheduled in ANY displayed semester
function isCourseEligibleForAnySemester(course) {

    const zones = document.querySelectorAll(".semester-dropzone");

    return Array.from(zones).some(zone => {

        const year = Number(zone.dataset.year);
        const semester = zone.dataset.semester;

        return isCourseEligibleForTerm(course, year, semester);

    });

}


// Save the semester plan
function savePlannedCourses() {

    try {

        localStorage.setItem(
            PLAN_STORAGE_KEY,
            JSON.stringify([...plannedCourses.entries()])
        );

    } catch (error) {

        console.error("Could not save semester plan:", error);

    }

}


// Rebuild a plan from a list of { code, year, semester } entries.
// Entries are checked in chronological order against:
//   - offering terms
//   - prerequisites (completed courses + courses planned in EARLIER terms)
//   - exclusive choices (completed courses + every kept planned course)
// Returns the valid plan plus the entries that had to be left out.
function buildValidPlan(entries) {

    const sorted = entries
        .map(entry => ({ ...entry }))
        .sort((a, b) =>
            getTermIndex(a.year, a.semester) -
            getTermIndex(b.year, b.semester)
        );

    const valid = new Map();
    const dropped = [];

    // Courses that count as prerequisites for the term being checked
    const availableCourses = new Set(completedCourses);

    // Courses that count for exclusive-choice checks
    const selectedCourses = new Set(completedCourses);

    let currentTerm = -1;
    let coursesInCurrentTerm = [];

    sorted.forEach(entry => {

        const term = getTermIndex(entry.year, entry.semester);

        if (term === -1) {

            dropped.push({ code: entry.code, reason: "invalid semester" });

            return;

        }

        if (term !== currentTerm) {

            coursesInCurrentTerm.forEach(code =>
                availableCourses.add(code)
            );

            coursesInCurrentTerm = [];
            currentTerm = term;

        }

        const course = getCourse(entry.code);

        if (!course) {

            dropped.push({ code: entry.code, reason: "not in the catalog" });

            return;

        }

        if (valid.has(entry.code)) {
            return;
        }

        if (completedCourses.has(entry.code)) {

            dropped.push({ code: entry.code, reason: "already completed" });

            return;

        }

        if (!courseOfferedIn(course, entry.semester)) {

            dropped.push({
                code: entry.code,
                reason: `not offered in ${entry.semester}`
            });

            return;

        }

        const conflict = findChoiceConflict(entry.code, selectedCourses);

        if (conflict) {

            dropped.push({
                code: entry.code,
                reason: `conflicts with ${conflict.conflicts.join(", ")}`
            });

            return;

        }

        const prerequisitesMet =
            !course.prerequisites ||
            evaluateRule(course.prerequisites, availableCourses);

        if (!prerequisitesMet) {

            dropped.push({ code: entry.code, reason: "prerequisites not met" });

            return;

        }

        valid.set(entry.code, {
            year: Number(entry.year),
            semester: entry.semester
        });

        selectedCourses.add(entry.code);
        coursesInCurrentTerm.push(entry.code);

    });

    return { valid: valid, dropped: dropped };

}


// Load the saved semester plan
function loadPlannedCourses() {

    try {

        const saved = JSON.parse(
            localStorage.getItem(PLAN_STORAGE_KEY) || "[]"
        );

        if (!Array.isArray(saved)) {
            return;
        }

        const entries = saved
            .filter(entry => Array.isArray(entry) && entry.length === 2)
            .map(([code, placement]) => ({ code, ...placement }));

        const result = buildValidPlan(entries);

        result.valid.forEach((placement, code) => {
            plannedCourses.set(code, placement);
        });

        if (result.dropped.length > 0) {

            planLoadMessage =
                "Some saved plan entries could not be restored: " +
                result.dropped
                    .map(item => `${item.code} (${item.reason})`)
                    .join(", ") + ".";

        }

    } catch (error) {

        console.error("Could not load semester plan:", error);

    }

}


// Remove planned courses that are no longer valid
function validatePlannedCourses() {

    const entries = [...plannedCourses.entries()]
        .map(([code, placement]) => ({ code, ...placement }));

    const result = buildValidPlan(entries);

    plannedCourses.clear();

    result.valid.forEach((placement, code) => {
        plannedCourses.set(code, placement);
    });

}


// Display planner messages
function setPlannerMessage(message) {

    getElement("plannerMessage").textContent = message;

}


// Add a course to a semester
function placeCourseInSemester(code, year, semester) {

    const course = getCourse(code);

    if (!course) {
        return false;
    }

    if (completedCourses.has(code)) {
        setPlannerMessage(`${code} is already completed.`);
        return false;
    }

    if (plannedCourses.has(code)) {
        setPlannerMessage(`${code} is already in your plan.`);
        return false;
    }

    // Exclusive choices are enforced here, not only by disabled buttons
    const conflict = getPlanningConflict(code);

    if (conflict) {
        setPlannerMessage(describeChoiceConflict(code, conflict));
        return false;
    }

    if (!courseOfferedIn(course, semester)) {

        setPlannerMessage(
            `${code} is not listed as available in ${semester}.`
        );

        return false;
    }

    if (!isCourseEligibleForTerm(course, year, semester)) {

        setPlannerMessage(
            `Cannot schedule ${code}. Its prerequisites must be completed or planned in an earlier semester. ` +
            `Required: ${describeRule(course.prerequisites)}`
        );

        return false;
    }

    plannedCourses.set(code, {
        year: Number(year),
        semester: semester
    });

    savePlannedCourses();

    updateInterface();

    const availabilityNote = Array.isArray(course.offered)
        ? ""
        : " Offering availability has not been confirmed.";

    setPlannerMessage(
        `${code} added to Year ${year}, ${semester}.${availabilityNote}`
    );

    return true;

}


// Remove a course from the semester plan
function removePlannedCourse(code) {

    if (!plannedCourses.has(code)) {
        return;
    }

    plannedCourses.delete(code);

    const previousCodes = new Set(plannedCourses.keys());

    validatePlannedCourses();

    savePlannedCourses();

    const removedCourses = [...previousCodes].filter(
        courseCode => !plannedCourses.has(courseCode)
    );

    updateInterface();

    setPlannerMessage(
        `Removed ${code}.` +
        (removedCourses.length
            ? ` Also removed courses that no longer satisfy their prerequisites: ${removedCourses.join(", ")}.`
            : "")
    );

}


// Generate the semester planner dynamically
function renderSemesterPlan() {

    const zones = document.querySelectorAll(".semester-dropzone");

    let totalCredits = 0;

    zones.forEach(zone => {

        // Remove the old dynamically generated course cards
        zone.querySelectorAll(".planned-course").forEach(card =>
            card.remove()
        );

        const year = Number(zone.dataset.year);
        const semester = zone.dataset.semester;

        const semesterCourses = [...plannedCourses.entries()]
            .filter(([code, placement]) =>
                placement.year === year &&
                placement.semester === semester
            );

        let semesterCredits = 0;

        semesterCourses.forEach(([code]) => {

            const course = getCourse(code);

            semesterCredits += course.credits;
            totalCredits += course.credits;

            const card = document.createElement("div");

            card.className = "planned-course";

            const description = document.createElement("span");

            description.textContent =
                `${course.code} - ${course.name} (${course.credits} CH)`;

            const removeButton = document.createElement("button");

            removeButton.type = "button";
            removeButton.textContent = "Remove";

            removeButton.dataset.action = "remove-planned";
            removeButton.dataset.code = code;

            card.append(description, removeButton);

            zone.appendChild(card);

        });

        // Update the drop hint
        const hint = zone.querySelector(".drop-hint");

        if (hint) {
            hint.hidden = semesterCourses.length > 0;
        }

        // Display semester credit total
        let total = zone.querySelector(".semester-credit-total");

        if (!total) {

            total = document.createElement("p");

            total.className = "semester-credit-total";

            zone.appendChild(total);

        }

        total.textContent = `Semester credits: ${semesterCredits}`;

    });

    // Update overall planned credit summary
    const summary = getElement("semesterPlanSummary");

    summary.textContent =
        `${plannedCourses.size} courses planned | ${totalCredits} total credits`;

}

// ==========================================
// EXPLAIN PREREQUISITE REQUIREMENTS
// ==========================================

function describeRule(rule, nested = false) {

    if (typeof rule === "string") {

        return `${rule} - ${getCourseName(rule)}`;

    }

    if (!rule || typeof rule !== "object") {
        return "No prerequisite information available.";
    }

    if (Array.isArray(rule.all)) {

        const text = rule.all
            .map(item => describeRule(item, true))
            .join(" AND ");

        // Keep AND groups readable when they sit inside an OR
        return nested && rule.all.length > 1
            ? "(" + text + ")"
            : text;

    }

    if (Array.isArray(rule.any)) {

        return "(" + rule.any
            .map(item => describeRule(item, true))
            .join(" OR ") + ")";

    }

    if (
        Number.isInteger(rule.choose) &&
        Array.isArray(rule.from)
    ) {

        return `Choose ${rule.choose} from: ` +
            rule.from.join(", ");

    }

    return "Unknown prerequisite structure.";

}


// Every course code mentioned in a rule
function collectRuleCourses(rule, found = new Set()) {

    if (typeof rule === "string") {

        found.add(rule);

    } else if (rule && typeof rule === "object") {

        if (Array.isArray(rule.all)) {
            rule.all.forEach(item => collectRuleCourses(item, found));
        }

        if (Array.isArray(rule.any)) {
            rule.any.forEach(item => collectRuleCourses(item, found));
        }

        if (Array.isArray(rule.from)) {
            rule.from.forEach(item => collectRuleCourses(item, found));
        }

    }

    return found;

}


// ==========================================
// DISPLAY PROGRAM INFORMATION
// ==========================================

function renderProgramOverview() {

    const program = advisorData.program;

    const overview = getElement("programOverview");

    overview.textContent = "";

    const description = document.createElement("p");

    description.textContent =
        `${program.name} | ${program.school} | ` +
        `Catalog ${program.catalogYear} | ` +
        `Program Code: ${program.programCode}`;

    overview.appendChild(description);

    getElement("totalCredits").textContent =
        program.totalCredits;

}


// ==========================================
// DYNAMIC MESSAGE AREAS
// ==========================================

// These are created in JavaScript so the HTML does not need to change.
function ensureDynamicElements() {

    const completedList = getElement("completedCoursesList");

    if (completedList && !getElement("choiceWarnings")) {

        const warnings = document.createElement("div");

        warnings.id = "choiceWarnings";
        warnings.setAttribute("aria-live", "polite");
        warnings.hidden = true;

        completedList.parentNode.insertBefore(warnings, completedList);

    }

    const addButton = getElement("addCompletedCourseButton");

    if (addButton && !getElement("completedCourseMessage")) {

        const message = document.createElement("p");

        message.id = "completedCourseMessage";
        message.setAttribute("aria-live", "polite");
        message.hidden = true;

        // Place the message after the row that holds the button
        addButton.parentNode.insertAdjacentElement("afterend", message);

    }

}


function setCompletedMessage(text, kind = "info") {

    const message = getElement("completedCourseMessage");

    if (!message) {
        return;
    }

    message.textContent = text || "";
    message.hidden = !text;

    styleNotice(message, kind === "warning" ? "warning" : "info");

}


// ==========================================
// POPULATE COURSE SELECTOR
// ==========================================

function populateCourseSelector() {

    const selector = getElement("completedCourseSelect");

    const searchInput = getElement("completedCourseSearch");

    const searchTerm = searchInput
        ? searchInput.value.trim().toLowerCase()
        : "";

    const previousValue = selector.value;

    selector.textContent = "";

    const matches = advisorData.courses.filter(course =>
        searchTerm === "" ||
        course.code.toLowerCase().includes(searchTerm) ||
        course.name.toLowerCase().includes(searchTerm)
    );

    const placeholder = document.createElement("option");

    placeholder.value = "";
    placeholder.textContent = matches.length > 0
        ? "Select a course..."
        : "No matching courses";

    selector.appendChild(placeholder);

    matches.forEach(course => {

        const option = document.createElement("option");

        option.value = course.code;

        let label = `${course.code} - ${course.name}`;

        if (completedCourses.has(course.code)) {

            option.disabled = true;
            label += " (completed)";

        } else {

            const conflict = getCompletionConflict(course.code);

            if (conflict) {

                option.disabled = true;

                label += ` (unavailable: conflicts with ${conflict.conflicts.join(", ")})`;

                option.title = describeChoiceConflict(course.code, conflict);

            }

        }

        option.textContent = label;

        selector.appendChild(option);

    });

    // Keep the previous selection only if it can still be chosen
    const stillAvailable = [...selector.options].some(option =>
        option.value === previousValue && !option.disabled
    );

    selector.value = stillAvailable ? previousValue : "";

}


// ==========================================
// MARK COURSES AS COMPLETED
// ==========================================

function markCourseCompleted(code) {

    if (!getCourse(code)) {
        return false;
    }

    if (completedCourses.has(code)) {
        return false;
    }

    // Exclusive choices are enforced here, not only by disabled buttons
    const conflict = getCompletionConflict(code);

    if (conflict) {

        setCompletedMessage(describeChoiceConflict(code, conflict), "warning");

        return false;

    }

    const plannedBefore = new Set(plannedCourses.keys());

    completedCourses.add(code);

    // Remove it from the plan if it was already scheduled
    plannedCourses.delete(code);

    // Recheck the remaining planned courses
    validatePlannedCourses();

    saveCompletedCourses();
    savePlannedCourses();

    const removedFromPlan = [...plannedBefore].filter(plannedCode =>
        plannedCode !== code && !plannedCourses.has(plannedCode)
    );

    updateInterface();

    setCompletedMessage("");

    if (removedFromPlan.length > 0) {

        setPlannerMessage(
            `Marked ${code} as completed. Removed planned courses that no longer fit: ` +
            `${removedFromPlan.join(", ")}.`
        );

    }

    return true;

}


function removeCompletedCourse(code) {

    const plannedBefore = new Set(plannedCourses.keys());

    completedCourses.delete(code);

    // Some planned courses might depend on this course
    validatePlannedCourses();

    saveCompletedCourses();
    savePlannedCourses();

    const removedFromPlan = [...plannedBefore].filter(
        plannedCode => !plannedCourses.has(plannedCode)
    );

    updateInterface();

    setCompletedMessage("");

    if (removedFromPlan.length > 0) {

        setPlannerMessage(
            `Removed ${code} from completed courses. Also removed planned courses that no longer ` +
            `satisfy their prerequisites: ${removedFromPlan.join(", ")}.`
        );

    }

}


// ==========================================
// RENDER COMPLETED COURSES
// ==========================================

function renderChoiceWarnings() {

    const box = getElement("choiceWarnings");

    if (!box) {
        return;
    }

    box.textContent = "";

    const messages = [...loadWarnings];

    findExistingChoiceConflicts().forEach(conflict => {

        messages.push(
            `Your completed courses contain conflicting choices for ` +
            `"${conflict.group.label}": ${conflict.courses.join(", ")}. ` +
            `Only one option is allowed (${describeGroupOptions(conflict.group)}). ` +
            `Nothing was deleted - use the Remove buttons below to keep the ` +
            `course(s) that apply to you.`
        );

    });

    box.hidden = messages.length === 0;

    messages.forEach(message => {
        appendLine(box, `Warning: ${message}`);
    });

    styleNotice(box, "warning");

}


function renderCompletedCourses() {

    const container = getElement("completedCoursesList");

    container.textContent = "";

    if (completedCourses.size === 0) {

        const message = document.createElement("p");

        message.textContent = "No completed courses added yet.";

        container.appendChild(message);

        return;

    }

    // Courses involved in a conflict get flagged
    const conflictLabels = new Map();

    findExistingChoiceConflicts().forEach(conflict => {

        conflict.courses.forEach(code => {
            conflictLabels.set(code, conflict.group.label);
        });

    });

    completedCourses.forEach(code => {

        const course = getCourse(code);

        const card = document.createElement("div");

        card.className = "completed-course";

        const description = document.createElement("span");

        description.textContent =
            `${course.code} - ${course.name}`;

        const removeButton = document.createElement("button");

        removeButton.type = "button";
        removeButton.textContent = "Remove";

        // This button is dynamically created.
        // Its event will be handled through event delegation.
        removeButton.dataset.action = "remove-completed";
        removeButton.dataset.code = code;

        card.append(description);

        if (conflictLabels.has(code)) {

            const flag = document.createElement("span");

            flag.textContent =
                `Conflict in "${conflictLabels.get(code)}" - remove the option that does not apply.`;

            flag.style.color = "#8d2929";
            flag.style.flexBasis = "100%";

            card.appendChild(flag);

        }

        card.appendChild(removeButton);

        container.appendChild(card);

    });

}


// ==========================================
// CHECK COURSE ELIGIBILITY
// ==========================================

function isCourseEligible(course) {

    // A course that conflicts with a chosen alternative cannot be planned
    if (getPlanningConflict(course.code)) {
        return false;
    }

    return isCourseEligibleForAnySemester(course);

}


// Why can a course not be scheduled right now?
function describeIneligibility(course) {

    const known = getSelectedCourses();

    const prerequisitesPossible =
        !course.prerequisites ||
        evaluateRule(course.prerequisites, known);

    if (!prerequisitesPossible) {
        return "Missing prerequisites";
    }

    return "Cannot be scheduled in the two-year planner yet " +
        "(check the order of prerequisite courses and the terms it is offered)";

}


// Requirement groups (and their notes) that mention a course
function getRequirementsForCourse(code) {

    const found = [];

    advisorData.lowerDivisionRequirements.forEach(requirement => {

        if (collectRuleCourses(requirement.rule).has(code)) {

            found.push({
                label: requirement.label,
                note: requirement.note
            });

        }

    });

    const elective = advisorData.programElectiveRequirement;

    if (
        elective &&
        elective.rule &&
        Array.isArray(elective.rule.from) &&
        elective.rule.from.includes(code)
    ) {

        found.push({ label: elective.label, note: elective.note });

    }

    return found;

}


// First semester in the planner where a course can be placed
function findFirstEligibleTerm(course) {

    for (let year = 1; year <= 2; year++) {

        for (const semester of SEMESTERS) {

            if (isCourseEligibleForTerm(course, year, semester)) {
                return `${year}|${semester}`;
            }

        }

    }

    return null;

}


// ==========================================
// GENERATE COURSE CARDS
// ==========================================

function buildCourseCard(course) {

    const completed = completedCourses.has(course.code);
    const placement = plannedCourses.get(course.code);
    const planned = Boolean(placement);
    const eligible = isCourseEligible(course);

    const completionConflict = completed
        ? null
        : getCompletionConflict(course.code);

    const planningConflict = (completed || planned)
        ? null
        : getPlanningConflict(course.code);

    const card = document.createElement("article");

    card.className = "course-card";

    // Only eligible, uncompleted, unplanned courses can be dragged
    card.draggable = !completed && !planned && eligible;

    card.dataset.code = course.code;

    const title = document.createElement("h4");

    title.textContent = `${course.code} - ${course.name}`;

    card.appendChild(title);

    appendLine(card, `Credits: ${course.credits}`);

    appendLine(
        card,
        course.offered
            ? `Offered: ${course.offered.join(", ")}`
            : "Offering information unavailable."
    );

    // ----- Status -----

    let statusText;

    if (completed) {

        statusText = "Status: Completed";

    } else if (planned) {

        statusText =
            `Status: Planned for Year ${placement.year}, ${placement.semester}`;

    } else if (completionConflict || planningConflict) {

        statusText =
            "Status: Unavailable (conflicts with another option you chose)";

    } else if (eligible) {

        statusText = "Status: Eligible for planning";

    } else {

        statusText = `Status: ${describeIneligibility(course)}`;

    }

    appendLine(card, statusText);

    // ----- Exclusive-choice information -----

    exclusiveGroups
        .filter(group => group.codes.has(course.code))
        .forEach(group => {

            const multiCourse = group.options.some(option => option.length > 1);

            appendLine(
                card,
                `Exclusive choice - ${group.label}: choose only one option` +
                (multiCourse ? " (every course in a multi-course option is required)" : "") +
                `: ${describeGroupOptions(group)}.`
            );

        });

    const conflict = completionConflict || planningConflict;

    if (conflict) {

        let explanation = describeChoiceConflict(course.code, conflict);

        // Conflict with a planned course only: completion is still possible
        if (!completionConflict && planningConflict) {

            explanation +=
                " You can still mark this course completed if you already took it; " +
                "that will replace the conflicting planned course.";

        }

        appendLine(card, explanation, "course-conflict");

    }

    // ----- Prerequisites (always shown) -----

    if (!course.prerequisites) {

        appendLine(card, "No listed prerequisites.");

    } else {

        appendLine(
            card,
            `Prerequisites: ${describeRule(course.prerequisites)}`
        );

        const satisfiedNow = evaluateRule(course.prerequisites);

        const couldBeSatisfied = evaluateRule(
            course.prerequisites,
            getSelectedCourses()
        );

        if (satisfiedNow) {

            appendLine(card, "Prerequisite status: satisfied by your completed courses.");

        } else if (couldBeSatisfied) {

            appendLine(
                card,
                "Prerequisite status: can be satisfied by courses in your plan " +
                "if they are scheduled in an earlier semester."
            );

        } else {

            appendLine(card, "Prerequisite status: not yet satisfied.");

        }

    }

    const prerequisiteNotes = toList(course.prerequisiteNote);

    prerequisiteNotes.forEach(note => {
        appendLine(card, `Prerequisite note: ${note}`);
    });

    // Ordinary OR prerequisites (explicitly not exclusive)
    alternativePrerequisiteGroups
        .filter(group => group.appliesTo === course.code)
        .forEach(group => {

            appendLine(
                card,
                "Alternative prerequisites (either one works, both may be completed): " +
                group.alternatives.map(code => `${code} - ${getCourseName(code)}`).join(" OR ")
            );

            if (group.note && prerequisiteNotes.length === 0) {
                appendLine(card, `Prerequisite note: ${group.note}`);
            }

        });

    // ----- Course notes -----

    toList(course.notes).forEach(note => {
        appendLine(card, `Note: ${note}`);
    });

    // ----- Requirement notes -----

    getRequirementsForCourse(course.code).forEach(requirement => {

        if (requirement.note) {

            appendLine(
                card,
                `Requirement note (${requirement.label}): ${requirement.note}`
            );

        }

    });

    // ----- Planning controls -----

    if (card.draggable) {

        appendLine(
            card,
            "Drag this course into a semester, or use the menu below."
        );

        const picker = document.createElement("select");

        picker.className = "term-picker";
        picker.setAttribute("aria-label", `Choose a semester for ${course.code}`);

        [1, 2].forEach(year => {

            SEMESTERS.forEach(semester => {

                const option = document.createElement("option");

                option.value = `${year}|${semester}`;
                option.textContent = `Year ${year} - ${semester}`;

                picker.appendChild(option);

            });

        });

        const firstEligible = findFirstEligibleTerm(course);

        if (firstEligible) {
            picker.value = firstEligible;
        }

        const addButton = document.createElement("button");

        addButton.type = "button";
        addButton.textContent = "Add to Plan";

        addButton.dataset.action = "add-to-plan";
        addButton.dataset.code = course.code;

        card.append(picker, addButton);

    }

    // ----- Completion button -----

    if (!completed) {

        const button = document.createElement("button");

        button.type = "button";
        button.textContent = "Mark as Completed";

        button.dataset.action = "complete-course";
        button.dataset.code = course.code;

        if (completionConflict) {

            disableButton(
                button,
                describeChoiceConflict(course.code, completionConflict)
            );

        }

        card.appendChild(button);

    }

    return card;

}


function renderAvailableCourses() {

    const container = getElement("availableCourses");

    container.textContent = "";

    const searchTerm =
        getElement("courseSearch").value.toLowerCase();

    const filter = getElement("courseFilter").value;

    const eligibleCount = advisorData.courses.filter(course =>
        !completedCourses.has(course.code) &&
        !plannedCourses.has(course.code) &&
        isCourseEligible(course)
    ).length;

    getElement("eligibleCount").textContent = eligibleCount;

    const displayedCourses = advisorData.courses.filter(course => {

        const completed = completedCourses.has(course.code);
        const planned = plannedCourses.has(course.code);
        const eligible = isCourseEligible(course);

        const matchesSearch =
            course.code.toLowerCase().includes(searchTerm) ||
            course.name.toLowerCase().includes(searchTerm);

        if (!matchesSearch) {
            return false;
        }

        if (filter === "eligible") {
            return !completed && !planned && eligible;
        }

        if (filter === "completed") {
            return completed;
        }

        return true;

    });

    if (displayedCourses.length === 0) {

        const message = document.createElement("p");

        message.textContent = "No matching courses found.";

        container.appendChild(message);

        return;

    }

    displayedCourses.forEach(course => {
        container.appendChild(buildCourseCard(course));
    });

}


// ==========================================
// PROGRAM CREDIT CALCULATIONS
// ==========================================

// Upper-level credits come from the REQUIRED core courses (counted from the
// courses actually completed) plus program electives. Electives are not
// exclusive, but only creditCap credits count toward the requirement.
// Planned courses are never counted.
function calculateProgramCredits() {

    const creditsFor = (code) => {

        const course = getCourse(code);

        return course ? Number(course.credits) || 0 : 0;

    };

    const coreCodes = new Set(
        toList(advisorData.programCoreRequirements.rule.all)
    );

    const elective = advisorData.programElectiveRequirement;

    const electiveCodes = new Set(
        elective && elective.rule ? toList(elective.rule.from) : []
    );

    const completedCore = [...coreCodes].filter(code =>
        completedCourses.has(code)
    );

    // A course is only counted once, even if it appears in both lists
    const completedElectives = [...electiveCodes].filter(code =>
        !coreCodes.has(code) && completedCourses.has(code)
    );

    const coreCredits = completedCore.reduce(
        (total, code) => total + creditsFor(code), 0
    );

    const electiveEarned = completedElectives.reduce(
        (total, code) => total + creditsFor(code), 0
    );

    const electiveCap = elective
        ? Number(elective.creditCap ?? elective.credits) || 0
        : 0;

    const electiveCounted = Math.min(electiveEarned, electiveCap);

    return {
        coreCredits: coreCredits,
        coreTarget: Number(advisorData.programCoreRequirements.credits) || 0,
        completedElectives: completedElectives,
        electiveEarned: electiveEarned,
        electiveCounted: electiveCounted,
        electiveCap: electiveCap,
        upper: coreCredits + electiveCounted
    };

}


// ==========================================
// DISPLAY PROGRAM REQUIREMENTS
// ==========================================

function getGroupForRequirement(requirement) {

    return exclusiveGroups.find(group =>
        group.requirementId === requirement.id
    );

}


// Lines that explain how a "select one" requirement works
function describeGroupRequirement(group) {

    const lines = [];

    const multiCourse = group.options.some(option => option.length > 1);

    lines.push(
        multiCourse
            ? "Select ONE pathway. A multi-course pathway needs every course listed in it: " +
              describeGroupOptions(group) + "."
            : "Select ONE option (the other alternatives are blocked once you choose): " +
              describeGroupOptions(group) + "."
    );

    // Show partially completed pathways
    group.options.forEach(option => {

        const done = option.filter(code => completedCourses.has(code));

        if (done.length === 0) {
            return;
        }

        if (done.length === option.length) {

            lines.push(`Completed: ${formatOption(option)}.`);

        } else {

            const missing = option.filter(code => !completedCourses.has(code));

            lines.push(
                `In progress: ${formatOption(option)} - still needs ${missing.join(", ")}.`
            );

        }

    });

    const conflict = findExistingChoiceConflicts().find(item =>
        item.group.id === group.id
    );

    if (conflict) {

        lines.push(
            `Conflicting choices selected (${conflict.courses.join(", ")}). ` +
            "Remove the option that does not apply."
        );

    }

    return lines;

}


function renderProgramRequirements() {

    const container = getElement("programRequirements");

    container.textContent = "";

    // Helper for creating section headings
    function addHeading(text) {

        const heading = document.createElement("h4");

        heading.textContent = text;

        container.appendChild(heading);

    }

    // Helper for individual requirement entries
    function addRequirement(label, rule, credits, note, extraLines = []) {

        const item = document.createElement("div");

        item.className = "requirement-item";

        const title = document.createElement("strong");

        title.textContent = label;

        const status = document.createElement("p");

        status.textContent = evaluateRule(rule)
            ? "Requirement satisfied"
            : "Requirement incomplete";

        const details = document.createElement("p");

        details.textContent =
            `${credits ?? "Variable"} credits | ${describeRule(rule)}`;

        item.append(title, status, details);

        extraLines.forEach(line => {
            appendLine(item, line);
        });

        if (note) {

            const noteElement = document.createElement("p");

            noteElement.textContent = note;

            item.appendChild(noteElement);

        }

        container.appendChild(item);

    }


    // LOWER-DIVISION REQUIREMENTS

    addHeading("Lower-Division Requirements");

    advisorData.lowerDivisionRequirements.forEach(requirement => {

        const group = getGroupForRequirement(requirement);

        addRequirement(
            requirement.label,
            requirement.rule,
            requirement.credits,
            requirement.note,
            group ? describeGroupRequirement(group) : []
        );

    });


    // REQUIRED PROGRAM COURSES

    addHeading("Required BSIT Program Courses");

    const coreCourses =
        advisorData.programCoreRequirements.rule.all;

    const coreList = document.createElement("ul");

    coreCourses.forEach(code => {

        const item = document.createElement("li");

        const completed = completedCourses.has(code);

        item.textContent =
            `${code} - ${getCourseName(code)}: ` +
            (completed ? "Completed" : "Incomplete");

        coreList.appendChild(item);

    });

    container.appendChild(coreList);


    // PROGRAM ELECTIVE

    addHeading("BSIT Program Elective");

    const elective = advisorData.programElectiveRequirement;

    const credits = calculateProgramCredits();

    addRequirement(
        elective.label,
        elective.rule,
        elective.credits,
        elective.note,
        [
            "Choose at least one elective. Electives are not mutually exclusive: " +
            "you may complete several, but only " + credits.electiveCap +
            " credits count toward this requirement.",
            `Completed electives: ${credits.completedElectives.length} | ` +
            `credits counted: ${credits.electiveCounted} of ${credits.electiveCap}.`
        ]
    );


    // OPTIONAL CERTIFICATE PATHWAYS

    addHeading("Optional Advanced Technical Certificates");

    advisorData.certificates.forEach(certificate => {

        const completedCount = certificate.courses.filter(
            code => completedCourses.has(code)
        ).length;

        const item = document.createElement("div");

        item.className = "requirement-item";

        const title = document.createElement("strong");

        title.textContent = certificate.name;

        const progress = document.createElement("p");

        progress.textContent =
            `${completedCount} of ${certificate.courses.length} courses completed`;

        item.append(title, progress);

        container.appendChild(item);

    });

}


// ==========================================
// UPDATE DEGREE PROGRESS
// ==========================================

function updateDegreeProgress() {

    const geInput = getElement("generalEducationCredits");

    const lowerInput = getElement("lowerLevelCredits");

    const geCredits = Math.max(
        0,
        Math.min(36, Number(geInput.value) || 0)
    );

    const lowerCredits = Math.max(
        0,
        Math.min(44, Number(lowerInput.value) || 0)
    );

    // Upper-level credits: completed core courses + capped program elective
    const programCredits = calculateProgramCredits();

    const upperCredits = programCredits.upper;

    const upperTarget =
        advisorData.program.creditRequirements.upperLevelProgramSpecific;

    const totalTarget = advisorData.program.totalCredits;

    const totalCompleted =
        geCredits + lowerCredits + upperCredits;

    const container = getElement("requirementProgress");

    container.textContent = "";

    function addProgress(label, value, maximum) {

        const wrapper = document.createElement("div");

        const text = document.createElement("p");

        text.textContent = `${label}: ${value} / ${maximum} credits`;

        const progress = document.createElement("progress");

        progress.max = maximum;
        progress.value = Math.min(value, maximum);

        wrapper.append(text, progress);

        container.appendChild(wrapper);

    }

    addProgress("General Education", geCredits, 36);

    addProgress("Lower-Level Technical Electives", lowerCredits, 44);

    const coreCredits = Math.min(
    programCredits.coreCredits,
    programCredits.coreTarget
    );

    addProgress(
        "Required Program Courses",
        coreCredits,
        programCredits.coreTarget
    );

    addProgress(
        "Program Elective",
        programCredits.electiveCounted,
        programCredits.electiveCap
    );

    addProgress(
        "Upper-Level Program Specific",
        upperCredits,
        upperTarget
    );

    addProgress(
        "Overall Degree Progress",
        totalCompleted,
        totalTarget
    );

    // Keep the inputs within their allowed credit ranges
    geInput.value = geCredits;

    lowerInput.value = lowerCredits;

}


// ==========================================
// UPDATE ALL INTERFACE ELEMENTS
// ==========================================

function updateInterface() {

    getElement("completedCount").textContent =
        completedCourses.size;

    getElement("plannedCount").textContent =
        plannedCourses.size;

    renderChoiceWarnings();

    populateCourseSelector();

    renderCompletedCourses();

    renderAvailableCourses();

    renderSemesterPlan();

    renderProgramRequirements();

    updateDegreeProgress();

}

// ==========================================
// 16. EVENT LISTENERS
// ==========================================

function setupEventListeners() {

    // Static button: add a completed course
    getElement("addCompletedCourseButton")
        .addEventListener("click", () => {

            const code =
                getElement("completedCourseSelect").value;

            if (!code) {
                return;
            }

            markCourseCompleted(code);

            getElement("completedCourseSelect").value = "";

        });


    // Search box for the completed-course dropdown
    const completedSearch = getElement("completedCourseSearch");

    if (completedSearch) {

        completedSearch.addEventListener("input", populateCourseSelector);

    }


    // Dynamic buttons in the course cards
    getElement("availableCourses")
        .addEventListener("click", event => {

            // Mark a course completed
            const completeButton = event.target.closest(
                "button[data-action='complete-course']"
            );

            if (completeButton) {

                markCourseCompleted(completeButton.dataset.code);

                return;

            }

            // Add a course to the plan from the card menu
            const addButton = event.target.closest(
                "button[data-action='add-to-plan']"
            );

            if (addButton) {

                const picker = addButton
                    .closest(".course-card")
                    .querySelector(".term-picker");

                const [year, semester] = picker.value.split("|");

                placeCourseInSemester(
                    addButton.dataset.code,
                    Number(year),
                    semester
                );

            }

        });


    // Dynamic buttons: remove a completed course
    getElement("completedCoursesList")
        .addEventListener("click", event => {

            const button = event.target.closest(
                "button[data-action='remove-completed']"
            );

            if (!button) {
                return;
            }

            removeCompletedCourse(button.dataset.code);

        });


    // Search courses
    getElement("courseSearch")
        .addEventListener("input", renderAvailableCourses);


    // Filter courses
    getElement("courseFilter")
        .addEventListener("change", renderAvailableCourses);


    // Update degree credit inputs
    // Update and save degree credit inputs
    getElement("generalEducationCredits")
        .addEventListener("input", () => {
            updateDegreeProgress();
            saveExternalCredits();
        });

    getElement("lowerLevelCredits")
        .addEventListener("input", () => {
            updateDegreeProgress();
            saveExternalCredits();
        });

    // ==========================================
    // DRAG AND DROP EVENTS
    // ==========================================

    const courseContainer = getElement("availableCourses");

    const planner = document.querySelector(".planner-grid");


    // When a course is picked up
    courseContainer.addEventListener("dragstart", event => {

        const card = event.target.closest(
            ".course-card[draggable='true']"
        );

        if (!card) {
            return;
        }

        event.dataTransfer.setData(
            "text/plain",
            card.dataset.code
        );

        event.dataTransfer.effectAllowed = "move";

    });


    // Highlight a semester while dragging over it
    planner.addEventListener("dragover", event => {

        const zone = event.target.closest(".semester-dropzone");

        if (!zone) {
            return;
        }

        event.preventDefault();

        zone.classList.add("drag-over");

    });


    // Remove highlighting when leaving a semester
    planner.addEventListener("dragleave", event => {

        const zone = event.target.closest(".semester-dropzone");

        if (zone) {
            zone.classList.remove("drag-over");
        }

    });


    // Handle dropping a course
    planner.addEventListener("drop", event => {

        const zone = event.target.closest(".semester-dropzone");

        if (!zone) {
            return;
        }

        event.preventDefault();

        zone.classList.remove("drag-over");

        const code = event.dataTransfer.getData("text/plain");

        const year = zone.dataset.year;

        const semester = zone.dataset.semester;

        placeCourseInSemester(code, year, semester);

    });


    // Remove dynamically generated planned courses
    planner.addEventListener("click", event => {

        const button = event.target.closest(
            "button[data-action='remove-planned']"
        );

        if (!button) {
            return;
        }

        removePlannedCourse(button.dataset.code);

    });


    // Clear the semester plan
    getElement("clearPlanButton").addEventListener("click", () => {

        plannedCourses.clear();

        savePlannedCourses();

        updateInterface();

        setPlannerMessage("Semester plan cleared.");

    });

}


// ==========================================
// START APPLICATION
// ==========================================

loadCourseData();