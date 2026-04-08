// --- STATE MANAGEMENT ---
let appState = {
    dates: { start: "2026-05-04", end: "2026-05-10" },
    itinerary: {},
    budget: [],
    packing: { profiles: {} },
    currentPage: 'itinerary',
    editMode: false,
    currentDateIndex: 0
};

// --- INDEXED DB (For large files and stable storage) ---
let db;
const request = indexedDB.open("TripPlannerDB", 1);
request.onupgradeneeded = function(e) {
    db = e.target.result;
    if (!db.objectStoreNames.contains("tripData")) {
        db.createObjectStore("tripData", { keyPath: "id" });
    }
    if (!db.objectStoreNames.contains("files")) {
        db.createObjectStore("files", { keyPath: "id" }); // For photos/pdfs
    }
};
request.onsuccess = function(e) {
    db = e.target.result;
    loadData();
};

function saveData() {
    const tx = db.transaction("tripData", "readwrite");
    tx.objectStore("tripData").put({ id: "mainState", state: appState });
}
function loadData() {
    const tx = db.transaction("tripData", "readonly");
    const req = tx.objectStore("tripData").get("mainState");
    req.onsuccess = function() {
        if (req.result) {
            appState = req.result.state;
            document.getElementById('trip-start').value = appState.dates.start;
            document.getElementById('trip-end').value = appState.dates.end;
        }
        renderCurrentPage();
    };
}

// --- UI NAVIGATION ---
function toggleMenu() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('overlay').classList.toggle('show');
}
function switchPage(page) {
    appState.currentPage = page;
    toggleMenu();
    renderCurrentPage();
}
function updateTripDates() {
    appState.dates.start = document.getElementById('trip-start').value;
    appState.dates.end = document.getElementById('trip-end').value;
    saveData();
    renderCurrentPage();
}

function renderCurrentPage() {
    const content = document.getElementById('app-content');
    if (appState.currentPage === 'itinerary') renderItinerary(content);
    if (appState.currentPage === 'budget') renderBudget(content);
    if (appState.currentPage === 'packing') renderPacking(content);
}

// --- DAILY ITINERARY ---
function getDatesInRange() {
    let dates = [];
    let curr = new Date(appState.dates.start);
    let end = new Date(appState.dates.end);
    while (curr <= end) {
        dates.push(curr.toISOString().split('T')[0]);
        curr.setDate(curr.getDate() + 1);
    }
    return dates;
}

function renderItinerary(content) {
    const dates = getDatesInRange();
    if(dates.length === 0) return content.innerHTML = "<p>Please set trip dates in the menu.</p>";
    
    // Safety check date index
    if(appState.currentDateIndex >= dates.length) appState.currentDateIndex = 0;
    const activeDate = dates[appState.currentDateIndex];
    
    // Initialize empty day if needed
    if(!appState.itinerary[activeDate]) {
        appState.itinerary[activeDate] = { header: "", lodging: { start: {}, end: {} }, activities: [] };
    }
    const dayData = appState.itinerary[activeDate];

    // Top Navigation (Prev / Next Date)
    let html = `
        <div class="flex-row" style="justify-content: space-between; margin-bottom: 20px;">
            <button class="icon-btn" onclick="navDate(-1)">⬅️</button>
            <h2 style="margin:0;">${new Date(activeDate).toLocaleDateString('en-US', {weekday: 'short', month: 'short', day: 'numeric'})}</h2>
            <button class="icon-btn" onclick="navDate(1)">➡️</button>
        </div>
        <button class="primary-btn" onclick="toggleEditMode()" style="margin-bottom: 20px; background: ${appState.editMode ? '#34c759' : 'var(--accent)'}">
            ${appState.editMode ? '💾 Save Changes' : '✏️ Edit Day'}
        </button>
    `;

    if (appState.editMode) {
        // --- EDIT MODE ---
        html += `
            <label>Custom Header:</label>
            <input type="text" id="day-header" value="${dayData.header || ''}" placeholder="e.g., Land in Rome & Temple">
            
            <h3>🏨 Lodging</h3>
            <table>
                <tr><th>Type</th><th>City</th><th>In/Out</th><th>Address</th></tr>
                <tr>
                    <td>Start</td>
                    <td><input type="text" id="l-start-city" value="${dayData.lodging.start.city || ''}"></td>
                    <td><input type="text" id="l-start-time" value="${dayData.lodging.start.time || ''}"></td>
                    <td><input type="text" id="l-start-add" value="${dayData.lodging.start.address || ''}"></td>
                </tr>
                <tr>
                    <td>End</td>
                    <td><input type="text" id="l-end-city" value="${dayData.lodging.end.city || ''}"></td>
                    <td><input type="text" id="l-end-time" value="${dayData.lodging.end.time || ''}"></td>
                    <td><input type="text" id="l-end-add" value="${dayData.lodging.end.address || ''}"></td>
                </tr>
            </table>

            <h3>🏃 Activities (Paste from Excel)</h3>
            <p style="font-size:0.8rem; color:gray;">Paste data matching these columns: Event | Time | Ticket | Manual Location | Notes</p>
            <textarea id="excel-paste" rows="4" placeholder="Paste tab-separated data here..." oninput="parseExcelPaste(this.value, '${activeDate}')"></textarea>
            
            <div id="activity-edit-list"></div>
        `;
        content.innerHTML = html;
        renderActivityEditors(activeDate); // Renders the individual rows to edit
    } else {
        // --- READ MODE ---
        if(dayData.header) html += `<h3 style="color: var(--accent); margin-top:0;">${dayData.header}</h3>`;
        
        // Lodging Display
        ['start', 'end'].forEach(type => {
            let l = dayData.lodging[type];
            if(l.city || l.address) {
                let mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(l.address || l.city)}`;
                html += `
                    <div style="background: white; padding: 10px; border-radius: 8px; margin-bottom: 10px; font-size: 0.9rem;">
                        <b>${type.toUpperCase()}:</b> ${l.city} (${l.time}) <br>
                        📍 <a href="${mapUrl}" target="_blank">${l.address}</a>
                    </div>
                `;
            }
        });

        // Activity Display (Sorted & Color Coded)
        let sortedActs = [...dayData.activities].sort((a,b) => (a.time || "24:00").localeCompare(b.time || "24:00"));
        
        sortedActs.forEach(act => {
            let timeClass = "time-none";
            if(act.time) {
                let hour = parseInt(act.time.split(':')[0]);
                if(hour < 12) timeClass = "time-morning";
                else if (hour < 17) timeClass = "time-afternoon";
                else timeClass = "time-evening";
            }
            
            let mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(act.location || act.event)}`;

            html += `
                <div class="activity-card ${timeClass}">
                    <div class="card-header">
                        <span class="event-title">${act.event}</span>
                        <span class="time-text">${act.time || 'Anytime'}</span>
                    </div>
                    ${act.ticket ? `<div>🎫 <b>Ticket:</b> ${act.ticket}</div>` : ''}
                    ${act.notes ? `<div class="notes-text">${act.notes}</div>` : ''}
                    <div style="margin-top: 8px;">
                        <a href="${mapUrl}" target="_blank" style="text-decoration:none; font-size: 0.9rem;">📍 View Map</a>
                    </div>
                </div>
            `;
        });
        content.innerHTML = html;
    }
}

// --- LOGIC HANDLERS ---
function navDate(dir) {
    appState.currentDateIndex += dir;
    renderCurrentPage();
}

function toggleEditMode() {
    if (appState.editMode) {
        // Save logic from inputs before switching to read mode
        const activeDate = getDatesInRange()[appState.currentDateIndex];
        const dayData = appState.itinerary[activeDate];
        dayData.header = document.getElementById('day-header').value;
        
        dayData.lodging.start = {
            city: document.getElementById('l-start-city').value,
            time: document.getElementById('l-start-time').value,
            address: document.getElementById('l-start-add').value
        };
        dayData.lodging.end = {
            city: document.getElementById('l-end-city').value,
            time: document.getElementById('l-end-time').value,
            address: document.getElementById('l-end-add').value
        };
        saveData();
    }
    appState.editMode = !appState.editMode;
    renderCurrentPage();
}

function parseExcelPaste(text, date) {
    if(!text) return;
    const rows = text.split('\n');
    rows.forEach(row => {
        if(!row.trim()) return;
        const cols = row.split('\t'); // Excel uses tabs for columns
        appState.itinerary[date].activities.push({
            event: cols[0] || '',
            time: cols[1] || '',
            ticket: cols[2] || '',
            location: cols[3] || '',
            notes: cols[4] || ''
        });
    });
    saveData();
    renderCurrentPage(); // Refresh to show new rows
}

// (Stub functions for the rest of the file to keep it modular)
function renderActivityEditors(date) { /* UI to edit individual rows and up/down arrows */ }
function renderBudget(content) { content.innerHTML = "<h2>Finances</h2><p>Coming up next...</p>"; }
function renderPacking(content) { content.innerHTML = "<h2>Packing</h2><p>Coming up next...</p>"; }