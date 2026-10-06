const eventContainer = document.getElementById("events");
const jsonDisplay = document.getElementById("jsonDisplay");

if (eventContainer) {

    function displayInfo(event, display) {

        let name = event.name;
        let year = event.year;
        let location = event.location;
        let description = event.description;

        display.innerHTML = `<h3>Event: ${name}</h3>\n<p>Description: ${description}<br>Year: ${year}<br>Location: ${location}</p>`;
    }

    fetch("history.json")
        .then(response => response.json())
        .then(data => {
            data.events.forEach(event => {
                const eventDisplay = document.createElement("div");
                displayInfo(event, eventDisplay);
                eventDisplay.classList.add("event");
                eventContainer.appendChild(eventDisplay);
            });
        });
}

if (jsonDisplay) {

    fetch("history.json")
        .then(response => response.text())
        .then(text => {

            jsonDisplay.innerText = text;
        });

}