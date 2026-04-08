// --- DATA ENGINE (Replaces Python json.dump / load) ---
const STORAGE_KEY = 'italia_trip_data';

// Default data structure mirroring your Python dict
let appData = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {
    itinerary: {
        "2026-05-04": {
            subtitle: "Arrival in Rome",
            activities: [
                { time: "14:00", title: "Check into Hotel", notes: "Via Roma 123", location: "Rome" },
                { time: "16:30", title: "Colosseum Tour", notes: "Confirmation #8832", location: "Colosseum Rome" }
            ],
            budget: []
        }
    },
    packing: { users: {} }
};

function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
}

// --- HELPER: GOOGLE MAPS LINK ---
function createMapsLink(query) {
    if (!query) return "#";
    const searchUrl = encodeURIComponent(`${query} Italy`);
    return `https://www.google.com/maps/search/?api=1&query=${searchUrl}`;
}

// --- RENDERING VIEWS ---
const contentDiv = document.getElementById('app-content');
const titleDiv = document.getElementById('page-title');

function switchPage(page) {
    if (page === 'itinerary') renderItinerary();
    if (page === 'budget') renderBudget();
    if (page === 'packing') renderPacking();
}

function renderItinerary() {
    titleDiv.innerText = "🗺️ Daily Itinerary";
    let html = "";
    
    // Loop through dates (For V1, we just display all dates stacked, you can add next/prev later)
    for (const [date, data] of Object.entries(appData.itinerary)) {
        html += `<h2>${date}</h2>`;
        if (data.subtitle) html += `<p style="color:#e63946; font-style:italic;">${data.subtitle}</p>`;
        
        // Loop through activities
        data.activities.forEach(act => {
            const mapLink = createMapsLink(act.location);
            html += `
            <div class='activity-card'>
                <span class='time-text'>${act.time}</span>
                <span class='event-title'>${act.title}</span>
                <div class='notes-text'>${act.notes}</div>
                <a href="${mapLink}" target="_blank" class="map-btn">📍 View on Map</a>
            </div>
            `;
        });
    }
    
    contentDiv.innerHTML = html;
}

function renderBudget() {
    titleDiv.innerText = "💰 Budget";
    contentDiv.innerHTML = "<p>Budget tracking interface will go here.</p>";
}

function renderPacking() {
    titleDiv.innerText = "🎒 Packing List";
    contentDiv.innerHTML = "<p>Packing checklist will go here.</p>";
}

// Initialize app on first load
renderItinerary();