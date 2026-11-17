// Assignment 12 - CMS Comparison
// Loads CMS information from cms-data.json and builds the comparison table.

const tableBody = document.getElementById("cmsTableBody");
const systemStatus = document.getElementById("systemStatus");

// Creates a table cell containing plain text.
function createTextCell(value) {
    const cell = document.createElement("td");
    cell.textContent = value || "Not provided";
    return cell;
}

// Creates a table cell containing a bulleted list.
function createListCell(items) {
    const cell = document.createElement("td");

    if (!Array.isArray(items) || items.length === 0) {
        cell.textContent = "Not provided";
        return cell;
    }

    const list = document.createElement("ul");

    items.forEach((item) => {
        const listItem = document.createElement("li");
        listItem.textContent = item;
        list.appendChild(listItem);
    });

    cell.appendChild(list);
    return cell;
}

// Creates a link that opens an external website in a new tab.
function createExternalLink(name, url) {
    const link = document.createElement("a");

    try {
        const parsedUrl = new URL(url);

        // Only allow regular web links from the JSON file.
        if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
            throw new Error("Unsupported link protocol");
        }

        link.href = parsedUrl.href;
        link.textContent = name || url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
    } catch (error) {
        // Display the name as text if the URL is missing or invalid.
        link.textContent = name || "Invalid link";
    }

    return link;
}

// Creates a cell containing the example CMS website.
function createExampleCell(example) {
    const cell = document.createElement("td");

    if (!example || !example.url) {
        cell.textContent = "Not provided";
        return cell;
    }

    cell.appendChild(createExternalLink(example.name, example.url));
    return cell;
}

// Creates a cell containing links to the CMS research sources.
function createSourcesCell(sources) {
    const cell = document.createElement("td");

    if (!Array.isArray(sources) || sources.length === 0) {
        cell.textContent = "No sources provided";
        return cell;
    }

    const list = document.createElement("ul");

    sources.forEach((source) => {
        const listItem = document.createElement("li");

        if (source && source.url) {
            listItem.appendChild(
                createExternalLink(source.name, source.url)
            );
        } else {
            listItem.textContent = source && source.name
                ? source.name
                : "Unnamed source";
        }

        list.appendChild(listItem);
    });

    cell.appendChild(list);
    return cell;
}

// Builds one table row for a CMS object from the JSON file.
function createCmsRow(cms) {
    const row = document.createElement("tr");

    row.appendChild(createTextCell(cms.system));
    row.appendChild(createTextCell(cms.support));
    row.appendChild(createTextCell(cms.technology));
    row.appendChild(createListCell(cms.capabilities));
    row.appendChild(createListCell(cms.limitations));
    row.appendChild(createExampleCell(cms.example));
    row.appendChild(createSourcesCell(cms.sources));

    return row;
}

// Loads the JSON file and displays its CMS entries in the table.
async function loadCmsData() {
    systemStatus.textContent = "SYS: LOADING";

    try {
        const response = await fetch("cms-data.json");

        // fetch() does not automatically reject for HTTP errors such as 404.
        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }

        const cmsList = await response.json();

        if (!Array.isArray(cmsList)) {
            throw new Error("The JSON file must contain an array of CMS entries.");
        }

        if (cmsList.length === 0) {
            throw new Error("The JSON file does not contain any CMS entries.");
        }

        // Remove the loading message before adding the generated rows.
        tableBody.replaceChildren();

        cmsList.forEach((cms) => {
            const row = createCmsRow(cms);
            tableBody.appendChild(row);
        });

        systemStatus.textContent = "SYS: ONLINE";

    } catch (error) {
        console.error("Unable to load CMS data:", error);

        // Display an error message in the table if loading fails.
        tableBody.replaceChildren();

        const errorRow = document.createElement("tr");
        const errorCell = document.createElement("td");

        errorCell.colSpan = 7;
        errorCell.textContent = `Unable to load CMS information. ${error.message}`;

        errorRow.appendChild(errorCell);
        tableBody.appendChild(errorRow);

        systemStatus.textContent = "SYS: ERROR";
    }
}

// Start loading the CMS information when the page is ready.
loadCmsData();
