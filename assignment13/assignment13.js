// Archive Recovery
// Loads timelines.json and lets the player reconstruct a historical timeline.

const DATA_URL = "timelines.json";
const MAX_CARDS = 8;
const POINTS_PER_CORRECT_POSITION = 100;

const selectEl = document.getElementById("timeline-select");
const descriptionEl = document.getElementById("timeline-description");
const newGameBtn = document.getElementById("new-game-btn");
const gameSectionEl = document.getElementById("game-section");
const eventListEl = document.getElementById("event-list");
const timelineSlotsEl = document.getElementById("timeline-slots");
const checkTimelineBtn = document.getElementById("check-timeline-btn");
const statusEl = document.getElementById("status");
const matchedCountEl = document.getElementById("matched-count");
const totalCountEl = document.getElementById("total-count");
const scoreCountEl = document.getElementById("score-count");
const attemptCountEl = document.getElementById("attempt-count");
const mistakeCountEl = document.getElementById("mistake-count");
const resultsEl = document.getElementById("results");
const resultsSummaryEl = document.getElementById("results-summary");
const resultsTimelineEl = document.getElementById("results-timeline");

let timelines = [];
let game = null;

// ---------- Helpers ----------

function shuffle(array) {
    const copy = array.slice();

    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }

    return copy;
}

function setStatus(message) {
    statusEl.textContent = message;
}

function findEvent(eventId) {
    return game.events.find(function (event) {
        return String(event.id) === String(eventId);
    });
}

// ---------- Loading ----------

async function loadTimelines() {
    try {
        const response = await fetch(DATA_URL);

        if (!response.ok) {
            throw new Error("HTTP " + response.status);
        }

        const data = await response.json();

        if (!data || !Array.isArray(data.timelines) || data.timelines.length === 0) {
            throw new Error("The JSON file does not contain a valid timelines array.");
        }

        timelines = data.timelines;
        populateSelect();
    } catch (error) {
        console.error("Error loading timelines:", error);
        selectEl.innerHTML = "";
        selectEl.disabled = true;
        newGameBtn.disabled = true;
        descriptionEl.textContent = "The timeline data could not be loaded.";
        setStatus("Could not load timelines.json. Check the file location and make sure the page is running through a web server.");
    }
}

function populateSelect() {
    selectEl.innerHTML = "";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "-- Select a timeline --";
    selectEl.appendChild(placeholder);

    timelines.forEach(function (timeline) {
        const option = document.createElement("option");
        option.value = timeline.id;
        option.textContent = timeline.title;
        selectEl.appendChild(option);
    });

    selectEl.disabled = false;
    newGameBtn.disabled = true;
    setStatus("Choose a timeline, then select Start Game.");
}

// ---------- Game setup ----------

function startGame(timelineId) {
    const timeline = timelines.find(function (item) {
        return item.id === timelineId;
    });

    if (!timeline || !Array.isArray(timeline.events) || timeline.events.length === 0) {
        game = null;
        gameSectionEl.hidden = true;
        resultsEl.hidden = true;
        updateScoreboard();
        setStatus("Choose a valid timeline to begin.");
        return;
    }

    // Select a random subset, then filter the original array so its chronological
    // order is preserved. The JSON event order is the answer key for this game.
    const selectedIds = new Set(
        shuffle(timeline.events)
            .slice(0, Math.min(MAX_CARDS, timeline.events.length))
            .map(function (event) {
                return String(event.id);
            })
    );

    const chosenEvents = timeline.events.filter(function (event) {
        return selectedIds.has(String(event.id));
    });

    game = {
        timeline: timeline,
        events: chosenEvents,
        bankOrder: shuffle(chosenEvents),
        slots: Array(chosenEvents.length).fill(null),
        lockedSlots: new Set(),
        selectedEventId: null,
        score: 0,
        attempts: 0,
        mistakes: 0
    };

    descriptionEl.textContent = timeline.description;
    gameSectionEl.hidden = false;
    resultsEl.hidden = true;
    resultsTimelineEl.innerHTML = "";
    newGameBtn.textContent = "New Game";

    renderBoard();
    updateScoreboard();
    updateCheckButton();
    setStatus("Place the events from oldest to newest. You can drag cards or select a card and a slot.");
}

// ---------- Rendering ----------

function createEventCard(event, isLocked) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "event-card";
    card.dataset.id = String(event.id);
    card.draggable = !isLocked;
    card.disabled = isLocked;
    card.setAttribute("aria-pressed", String(game.selectedEventId === String(event.id)));

    const title = document.createElement("span");
    title.className = "event-card-title";
    title.textContent = event.title;
    card.appendChild(title);

    if (event.description) {
        const description = document.createElement("span");
        description.className = "event-card-description";
        description.textContent = event.description;
        card.appendChild(description);
    }

    card.addEventListener("click", function (clickEvent) {
        clickEvent.stopPropagation();
        handleCardSelection(event.id);
    });

    card.addEventListener("dragstart", function (dragEvent) {
        if (isLocked) {
            dragEvent.preventDefault();
            return;
        }

        game.selectedEventId = String(event.id);
        dragEvent.dataTransfer.setData("text/plain", String(event.id));
        dragEvent.dataTransfer.effectAllowed = "move";
        refreshSelectionUI();
    });

    return card;
}

function renderBoard() {
    eventListEl.innerHTML = "";
    timelineSlotsEl.innerHTML = "";

    const placedIds = new Set(
        game.slots
            .filter(Boolean)
            .map(function (event) {
                return String(event.id);
            })
    );

    // Only events that are not currently on the timeline appear in the archive.
    game.bankOrder.forEach(function (event) {
        if (!placedIds.has(String(event.id))) {
            const listItem = document.createElement("li");
            listItem.className = "event-bank-item";
            listItem.appendChild(createEventCard(event, false));
            eventListEl.appendChild(listItem);
        }
    });

    game.slots.forEach(function (event, index) {
        const slot = document.createElement("li");
        const isLocked = game.lockedSlots.has(index);
        slot.className = "timeline-slot" + (isLocked ? " locked" : "");
        slot.dataset.index = String(index);
        slot.tabIndex = 0;
        slot.setAttribute("aria-label", "Timeline position " + (index + 1) + (isLocked ? ", correctly placed" : ", drop target"));

        const number = document.createElement("span");
        number.className = "slot-number";
        number.textContent = String(index + 1);
        slot.appendChild(number);

        const content = document.createElement("div");
        content.className = "slot-content";

        if (event) {
            content.appendChild(createEventCard(event, isLocked));
        } else {
            const placeholder = document.createElement("span");
            placeholder.className = "slot-placeholder";
            placeholder.textContent = "Drop an event here";
            content.appendChild(placeholder);
        }

        slot.appendChild(content);

        slot.addEventListener("click", function (clickEvent) {
            if (clickEvent.target.closest(".event-card")) {
                return;
            }

            handleSlotClick(index);
        });

        slot.addEventListener("keydown", function (keyEvent) {
            if ((keyEvent.key === "Enter" || keyEvent.key === " ") && !keyEvent.target.closest(".event-card")) {
                keyEvent.preventDefault();
                handleSlotClick(index);
            }
        });

        slot.addEventListener("dragover", function (dragEvent) {
            if (!isLocked) {
                dragEvent.preventDefault();
                dragEvent.dataTransfer.dropEffect = "move";
                slot.classList.add("drag-over");
            }
        });

        slot.addEventListener("dragleave", function (dragEvent) {
            if (!slot.contains(dragEvent.relatedTarget)) {
                slot.classList.remove("drag-over");
            }
        });

        slot.addEventListener("drop", function (dropEvent) {
            dropEvent.preventDefault();
            slot.classList.remove("drag-over");

            const eventId = dropEvent.dataTransfer.getData("text/plain");
            if (eventId !== "") {
                placeEvent(eventId, index);
            }
        });

        timelineSlotsEl.appendChild(slot);
    });
}

function refreshSelectionUI() {
    document.querySelectorAll(".event-card").forEach(function (card) {
        card.setAttribute(
            "aria-pressed",
            String(card.dataset.id === game.selectedEventId)
        );
    });
}

function updateScoreboard() {
    matchedCountEl.textContent = game ? game.lockedSlots.size : "0";
    totalCountEl.textContent = game ? game.events.length : "0";
    scoreCountEl.textContent = game ? game.score : "0";
    attemptCountEl.textContent = game ? game.attempts : "0";
    mistakeCountEl.textContent = game ? game.mistakes : "0";
}

function updateCheckButton() {
    checkTimelineBtn.disabled = !game || !game.slots.every(Boolean) ||
        game.lockedSlots.size === game.events.length;
}

// ---------- Card placement ----------

function handleCardSelection(eventId) {
    if (!game) {
        return;
    }

    const id = String(eventId);
    const sourceIndex = game.slots.findIndex(function (event) {
        return event && String(event.id) === id;
    });

    if (sourceIndex !== -1 && game.lockedSlots.has(sourceIndex)) {
        return;
    }

    // If another card is already selected, clicking an occupied slot's card
    // places the selected card there. This makes the click/tap controls useful
    // even when the destination slot is not empty.
    if (game.selectedEventId && game.selectedEventId !== id && sourceIndex !== -1) {
        placeEvent(game.selectedEventId, sourceIndex);
        return;
    }

    game.selectedEventId = game.selectedEventId === id ? null : id;
    refreshSelectionUI();

    if (game.selectedEventId) {
        setStatus("Selected: " + findEvent(id).title + ". Now select a timeline position.");
    } else {
        setStatus("Card selection cleared.");
    }
}

function handleSlotClick(index) {
    if (!game) {
        return;
    }

    if (game.lockedSlots.has(index)) {
        setStatus("That position is correct and locked.");
        return;
    }

    if (!game.selectedEventId) {
        setStatus("Select an event card first, then select a timeline position.");
        return;
    }

    placeEvent(game.selectedEventId, index);
}

function placeEvent(eventId, targetIndex) {
    if (!game || game.lockedSlots.has(targetIndex)) {
        setStatus("That timeline position is locked. Choose another position.");
        return;
    }

    const event = findEvent(eventId);
    if (!event) {
        return;
    }

    const sourceIndex = game.slots.findIndex(function (placedEvent) {
        return placedEvent && String(placedEvent.id) === String(eventId);
    });

    if (sourceIndex === targetIndex) {
        game.selectedEventId = null;
        renderBoard();
        updateCheckButton();
        setStatus("That event is already in this position.");
        return;
    }

    if (sourceIndex !== -1) {
        // Moving a card already on the timeline swaps it with the target card.
        const targetEvent = game.slots[targetIndex];
        game.slots[sourceIndex] = targetEvent;
        game.slots[targetIndex] = event;
    } else {
        // A card coming from the archive replaces the target; the old card
        // automatically returns to the archive when the board is rendered.
        game.slots[targetIndex] = event;
    }

    game.selectedEventId = null;
    renderBoard();
    updateCheckButton();
    setStatus("Event placed. Continue arranging the timeline.");
}

// The archive is also a drop target, allowing players to remove a card from a slot.
eventListEl.addEventListener("dragover", function (dragEvent) {
    if (game) {
        dragEvent.preventDefault();
        dragEvent.dataTransfer.dropEffect = "move";
        eventListEl.classList.add("drag-over");
    }
});

eventListEl.addEventListener("dragleave", function (dragEvent) {
    if (!eventListEl.contains(dragEvent.relatedTarget)) {
        eventListEl.classList.remove("drag-over");
    }
});

eventListEl.addEventListener("drop", function (dropEvent) {
    dropEvent.preventDefault();
    eventListEl.classList.remove("drag-over");

    const eventId = dropEvent.dataTransfer.getData("text/plain");
    if (!game || eventId === "") {
        return;
    }

    const sourceIndex = game.slots.findIndex(function (event) {
        return event && String(event.id) === String(eventId);
    });

    if (sourceIndex !== -1 && !game.lockedSlots.has(sourceIndex)) {
        game.slots[sourceIndex] = null;
        game.selectedEventId = null;
        renderBoard();
        updateCheckButton();
        setStatus("Event returned to the archive.");
    }
});

// ---------- Checking and scoring ----------

function checkTimeline() {
    if (!game || !game.slots.every(Boolean)) {
        setStatus("Fill every timeline position before checking your answer.");
        return;
    }

    game.attempts++;

    let newlyCorrect = 0;
    let newlyIncorrect = 0;

    game.slots.forEach(function (placedEvent, index) {
        if (game.lockedSlots.has(index)) {
            return;
        }

        const expectedEvent = game.events[index];

        if (String(placedEvent.id) === String(expectedEvent.id)) {
            game.lockedSlots.add(index);
            game.score += POINTS_PER_CORRECT_POSITION;
            newlyCorrect++;
        } else {
            game.slots[index] = null;
            game.mistakes++;
            newlyIncorrect++;
        }
    });

    game.selectedEventId = null;
    renderBoard();
    updateScoreboard();
    updateCheckButton();

    if (game.lockedSlots.size === game.events.length) {
        finishGame();
        return;
    }

    setStatus(
        newlyCorrect + " correct position" + (newlyCorrect === 1 ? "" : "s") +
        " locked in. " + newlyIncorrect + " misplaced event" +
        (newlyIncorrect === 1 ? " was" : "s were") +
        " returned to the archive. Rearrange the remaining cards and check again."
    );
}

function finishGame() {
    const totalEvents = game.events.length;
    const accuracy = Math.round(
        (totalEvents / (totalEvents + game.mistakes)) * 100
    );

    resultsTimelineEl.innerHTML = "";

    game.events.forEach(function (event) {
        const item = document.createElement("li");
        const heading = document.createElement("strong");
        const description = document.createElement("p");

        heading.textContent = event.dateLabel + " | " + event.title;
        description.textContent = event.description || "";

        item.appendChild(heading);
        if (event.description) {
            item.appendChild(description);
        }

        resultsTimelineEl.appendChild(item);
    });

    resultsSummaryEl.textContent =
        "You reconstructed all " + totalEvents + " events and earned " +
        game.score + " points. Checks: " + game.attempts +
        ". Misplaced events: " + game.mistakes +
        ". Placement accuracy: " + accuracy + "%.";

    resultsEl.hidden = false;
    setStatus("Timeline complete! All events are in chronological order.");
}

// ---------- UI events ----------

selectEl.addEventListener("change", function () {
    const timeline = timelines.find(function (item) {
        return item.id === selectEl.value;
    });

    game = null;
    gameSectionEl.hidden = true;
    resultsEl.hidden = true;
    newGameBtn.disabled = !timeline;
    newGameBtn.textContent = "Start Game";
    descriptionEl.textContent = timeline
        ? timeline.description
        : "Choose a timeline to see its description.";

    updateScoreboard();
    updateCheckButton();

    if (timeline) {
        setStatus("Selected " + timeline.title + ". Select Start Game when ready.");
    } else {
        setStatus("Choose a timeline to begin.");
    }
});

newGameBtn.addEventListener("click", function () {
    if (selectEl.value) {
        startGame(selectEl.value);
    } else {
        setStatus("Choose a timeline first.");
    }
});

checkTimelineBtn.addEventListener("click", checkTimeline);

loadTimelines();
