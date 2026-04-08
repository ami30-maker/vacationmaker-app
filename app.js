// --- STATE MANAGEMENT ---
let appState = {
    dates: { start: "2026-05-04", end: "2026-05-20" },
    itinerary: {},
    budget: { 
        categories: ["Food", "Transport", "Lodging", "Activities", "Shopping", "Other"] 
    },
    packing: { 
        profiles: {}, 
        selectedProfile: null 
    },
    currentPage: 'itinerary',
    editMode: false,
    currentDateIndex: 0
};

// --- DATABASE (IndexedDB) ---
let db;
const request = indexedDB.open("TripPlannerDB", 1);
request.onupgradeneeded = (e) => {
    db = e.target.result;
    if (!db.objectStoreNames.contains("tripData")) db.createObjectStore("tripData", { keyPath: "id" });
};
request.onsuccess = (e) => { db = e.target.result; loadData(); };

function saveData() {
    const tx = db.transaction("tripData", "readwrite");
    tx.objectStore("tripData").put({ id: "mainState", state: appState });
}

function loadData() {
    const tx = db.transaction("tripData", "readonly");
    const req = tx.objectStore("tripData").get("mainState");
    req.onsuccess = () => {
        if (req.result) appState = req.result.state;
        renderCurrentPage();
        updateDateInputs();
    };
}

function updateDateInputs() {
    document.getElementById('trip-start').value = appState.dates.start;
    document.getElementById('trip-end').value = appState.dates.end;
}

function updateTripDates() {
    appState.dates.start = document.getElementById('trip-start').value;
    appState.dates.end = document.getElementById('trip-end').value;
    appState.currentDateIndex = 0; // reset to first day
    saveData();
    renderCurrentPage();
}

// --- NAVIGATION ---
function toggleMenu() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('overlay').classList.toggle('show');
}

function switchPage(page) {
    appState.currentPage = page;
    appState.editMode = false;
    toggleMenu();
    renderCurrentPage();
}

function navDate(dir) {
    const dates = getDatesInRange();
    appState.currentDateIndex = Math.max(0, Math.min(dates.length - 1, appState.currentDateIndex + dir));
    renderCurrentPage();
}

// --- ITINERARY LOGIC ---
function toggleEditMode() {
    if (appState.editMode) {
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

function parseExcelPaste(text) {
    const activeDate = getDatesInRange()[appState.currentDateIndex];
    if (!text.trim()) return;
    const rows = text.split('\n');
    rows.forEach(row => {
        const cols = row.split('\t');
        if (cols[0]) {
            appState.itinerary[activeDate].activities.push({
                event: cols[0].trim(),
                time: cols[1] ? cols[1].trim() : '',
                ticket: cols[2] ? cols[2].trim() : '',
                location: cols[3] ? cols[3].trim() : '',
                notes: cols[4] ? cols[4].trim() : ''
            });
        }
    });
    document.getElementById('excel-paste').value = '';
    saveData();
    renderCurrentPage();
}

function updateAct(index, field, value) {
    const activeDate = getDatesInRange()[appState.currentDateIndex];
    appState.itinerary[activeDate].activities[index][field] = value;
    saveData();
}

function moveAct(index, dir) {
    const activeDate = getDatesInRange()[appState.currentDateIndex];
    const acts = appState.itinerary[activeDate].activities;
    const newIdx = index + dir;
    if (newIdx >= 0 && newIdx < acts.length) {
        [acts[index], acts[newIdx]] = [acts[newIdx], acts[index]];
        saveData();
        renderCurrentPage();
    }
}

function removeAct(index) {
    const activeDate = getDatesInRange()[appState.currentDateIndex];
    appState.itinerary[activeDate].activities.splice(index, 1);
    saveData();
    renderCurrentPage();
}

// --- RENDERING ---
function renderCurrentPage() {
    const content = document.getElementById('app-content');
    const title = document.getElementById('page-title');
    if (appState.currentPage === 'itinerary') {
        title.innerText = "🗺️ Itinerary";
        renderItinerary(content);
    } else if (appState.currentPage === 'full-itinerary') {
        title.innerText = "📋 Full Itinerary";
        renderFullItinerary(content);
    } else if (appState.currentPage === 'budget') {
        title.innerText = "💰 Finances";
        renderBudget(content);
    } else {
        title.innerText = "🎒 Packing";
        renderPacking(content);
    }
}

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
    const activeDate = dates[appState.currentDateIndex];
    if (!appState.itinerary[activeDate]) {
        appState.itinerary[activeDate] = { header: "", lodging: { start: {}, end: {} }, activities: [], expenses: [] };
    }
    const dayData = appState.itinerary[activeDate];

    let html = `
        <div class="flex-row" style="justify-content: space-between; margin-bottom: 20px;">
            <button class="icon-btn" onclick="navDate(-1)">⬅️</button>
            <div style="text-align:center">
                <h2 style="margin:0">${new Date(activeDate).toLocaleDateString('en-US', {month:'short', day:'numeric'})}</h2>
                <small>${new Date(activeDate).toLocaleDateString('en-US', {weekday:'long'})}</small>
            </div>
            <button class="icon-btn" onclick="navDate(1)">➡️</button>
        </div>
        <button class="primary-btn" onclick="toggleEditMode()" style="background:${appState.editMode ? '#34c759' : '#007aff'}">
            ${appState.editMode ? '💾 Save Day' : '✏️ Edit Mode'}
        </button>
    `;

    if (appState.editMode) {
        html += `
            <div style="margin-top:20px">
                <label>Daily Highlight Header</label>
                <input type="text" id="day-header" value="${dayData.header}">
                <h3>🏨 Lodging</h3>
                <input type="text" id="l-start-city" placeholder="Start City" value="${dayData.lodging.start.city || ''}">
                <input type="text" id="l-start-time" placeholder="Check-in Time" value="${dayData.lodging.start.time || ''}">
                <input type="text" id="l-start-add" placeholder="Full Address" value="${dayData.lodging.start.address || ''}">
                <hr>
                <input type="text" id="l-end-city" placeholder="End City" value="${dayData.lodging.end.city || ''}">
                <input type="text" id="l-end-time" placeholder="Check-out Time" value="${dayData.lodging.end.time || ''}">
                <input type="text" id="l-end-add" placeholder="Full Address" value="${dayData.lodging.end.address || ''}">
                
                <h3>📋 Activities</h3>
                <textarea id="excel-paste" placeholder="Paste from Excel..." oninput="parseExcelPaste(this.value)"></textarea>
                <div id="edit-list">
                    ${dayData.activities.map((a, i) => `
                        <div class="activity-card" style="border-left: 4px solid #ccc; margin-top:10px; display:flex; justify-content:space-between; align-items:center;">
                            <div style="flex-grow:1">
                                <input type="text" value="${a.event}" onchange="updateAct(${i}, 'event', this.value)" style="font-weight:bold; margin-bottom:5px;">
                                <input type="time" value="${a.time}" onchange="updateAct(${i}, 'time', this.value)">
                            </div>
                            <div class="controls">
                                <button class="icon-btn" onclick="moveAct(${i}, -1)">▲</button>
                                <button class="icon-btn" onclick="moveAct(${i}, 1)">▼</button>
                                <button class="icon-btn" onclick="removeAct(${i})">🗑️</button>
                            </div>
                        </div>
                    `).join('')}
                </div>

                <h3>💰 Daily Expenses</h3>
                <div id="expense-edit-list">
                    ${(dayData.expenses || []).map((exp, i) => `
                        <div class="flex-row" style="margin-bottom:10px; gap:5px;">
                            <input type="number" value="${exp.amount}" onchange="updateExpense(${i}, 'amount', this.value)" style="width:70px;">
                            <select onchange="updateExpense(${i}, 'category', this.value)" style="flex-grow:1;">
                                ${appState.budget.categories.map(c => `<option value="${c}" ${exp.category === c ? 'selected' : ''}>${c}</option>`).join('')}
                            </select>
                            <button class="icon-btn" onclick="removeExpense(${i})">✕</button>
                        </div>
                    `).join('')}
                    <button class="primary-btn" style="background:#8e8e93; font-size:0.8rem;" onclick="addExpense()">+ Add Expense</button>
                </div>
            </div>`;
    } else {
        html += `<h2 style="color:#007aff; text-align:center; margin-top:5px;">${dayData.header || ''}</h2>`;
        
        ['start', 'end'].forEach(type => {
            const l = dayData.lodging[type];
            if (l.city || l.address) {
                const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(l.address || l.city)}`;
                html += `<div style="background:white; padding:12px; border-radius:10px; margin-bottom:10px; border-left: 5px solid #007aff;">
                    <b>${type.toUpperCase()}:</b> ${l.city} (${l.time})<br>
                    📍 <a href="${mapUrl}" target="_blank" style="color:#007aff; font-size:0.85rem;">${l.address || 'View Map'}</a>
                </div>`;
            }
        });

        dayData.activities.forEach(act => {
            let timeClass = "time-none";
            if (act.time) {
                const hour = parseInt(act.time.split(':')[0]);
                if (hour < 12) timeClass = "time-morning";
                else if (hour < 17) timeClass = "time-afternoon";
                else timeClass = "time-evening";
            }
            const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(act.location || act.event)}`;
            html += `<div class="activity-card ${timeClass}">
                <div class="card-header">
                    <span class="event-title">${act.event}</span>
                    <span class="time-text">${act.time || 'Anytime'}</span>
                </div>
                ${act.ticket ? `<div style="font-size:0.85rem; margin-top:4px;">🎫 <b>Ticket:</b> ${act.ticket}</div>` : ''}
                <div style="margin-top:8px;"><a href="${mapUrl}" target="_blank" style="text-decoration:none; font-size:0.85rem;">📍 View Map</a></div>
            </div>`;
        });

        const dailyTotal = (dayData.expenses || []).reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0);
        if (dailyTotal > 0) {
            html += `<div style="text-align:right; font-weight:700; margin-top:15px; color:#34c759; padding:10px; border-top:1px solid #eee;">Day Total: $${dailyTotal.toFixed(2)}</div>`;
        }
    }
    content.innerHTML = html;
}

// --- FULL ITINERARY RENDERING ---
function renderFullItinerary(content) {
    const dates = getDatesInRange();
    let html = `<h2>Your Complete Travel Itinerary</h2>
        <div style="margin-bottom:20px;">
            <button class="primary-btn" onclick="generateSampleItinerary()">🎯 Generate Sample Itinerary</button>
        </div>
        <div style="background:#f8f9fa; padding:20px; border-radius:15px; margin-bottom:20px;">
            <h3>Trip Overview</h3>
            <p><strong>Start Date:</strong> ${new Date(appState.dates.start).toLocaleDateString()}</p>
            <p><strong>End Date:</strong> ${new Date(appState.dates.end).toLocaleDateString()}</p>
            <p><strong>Duration:</strong> ${dates.length} days</p>
        </div>`;

    dates.forEach(date => {
        const dayData = appState.itinerary[date];
        if (!dayData) return; // skip empty days

        const dateObj = new Date(date);
        html += `<div style="background:white; padding:20px; border-radius:15px; margin-bottom:20px; border-left: 5px solid #007aff;">
            <h3 style="color:#007aff; margin-top:0;">${dateObj.toLocaleDateString('en-US', {weekday:'long', month:'short', day:'numeric'})}</h3>`;

        if (dayData.header) {
            html += `<h4 style="color:#34c759; margin-bottom:10px;">${dayData.header}</h4>`;
        }

        // Lodging
        ['start', 'end'].forEach(type => {
            const l = dayData.lodging[type];
            if (l.city || l.address) {
                const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(l.address || l.city)}`;
                html += `<div style="background:#f0f0f0; padding:10px; border-radius:8px; margin-bottom:10px;">
                    <b>${type.toUpperCase()} Lodging:</b> ${l.city} (${l.time})<br>
                    📍 <a href="${mapUrl}" target="_blank" style="color:#007aff;">${l.address || 'View Map'}</a>
                </div>`;
            }
        });

        // Activities
        if (dayData.activities && dayData.activities.length > 0) {
            html += `<h4>Activities:</h4>`;
            dayData.activities.forEach(act => {
                let timeClass = "time-none";
                if (act.time) {
                    const hour = parseInt(act.time.split(':')[0]);
                    if (hour < 12) timeClass = "time-morning";
                    else if (hour < 17) timeClass = "time-afternoon";
                    else timeClass = "time-evening";
                }
                const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(act.location || act.event)}`;
                html += `<div class="activity-card ${timeClass}" style="margin-bottom:10px;">
                    <div class="card-header">
                        <span class="event-title">${act.event}</span>
                        <span class="time-text">${act.time || 'Anytime'}</span>
                    </div>
                    ${act.ticket ? `<div style="font-size:0.85rem; margin-top:4px;">🎫 <b>Ticket:</b> ${act.ticket}</div>` : ''}
                    ${act.location ? `<div style="font-size:0.85rem; margin-top:4px;">📍 ${act.location}</div>` : ''}
                    ${act.notes ? `<div style="font-size:0.85rem; margin-top:4px;">📝 ${act.notes}</div>` : ''}
                </div>`;
            });
        }

        // Expenses
        const dailyTotal = (dayData.expenses || []).reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0);
        if (dailyTotal > 0) {
            html += `<div style="text-align:right; font-weight:700; margin-top:15px; color:#34c759; padding:10px; border-top:1px solid #eee;">Day Expenses: $${dailyTotal.toFixed(2)}</div>`;
        }

        html += `</div>`;
    });

    // Overall total
    let grandTotal = 0;
    dates.forEach(date => {
        const dayData = appState.itinerary[date];
        if (dayData && dayData.expenses) {
            dayData.expenses.forEach(exp => grandTotal += parseFloat(exp.amount || 0));
        }
    });
    if (grandTotal > 0) {
        html += `<div style="background:#34c759; color:white; padding:20px; border-radius:15px; text-align:center;">
            <h3>Total Trip Expenses: $${grandTotal.toFixed(2)}</h3>
        </div>`;
    }

    content.innerHTML = html;
}

function generateSampleItinerary() {
    const dates = getDatesInRange();
    const sampleData = {
        "2026-05-04": {
            header: "Arrival in Paris",
            lodging: {
                start: { city: "Paris", time: "15:00", address: "Hotel Ritz Paris, 15 Place Vendôme" },
                end: { city: "Paris", time: "11:00", address: "Hotel Ritz Paris, 15 Place Vendôme" }
            },
            activities: [
                { event: "Check into hotel", time: "15:00", location: "Hotel Ritz Paris", notes: "Rest after flight" },
                { event: "Evening walk along Seine", time: "18:00", location: "Seine River", notes: "Enjoy the city lights" }
            ],
            expenses: [
                { amount: 50, category: "Transport", description: "Taxi from airport" },
                { amount: 300, category: "Lodging", description: "Hotel night" }
            ]
        },
        "2026-05-05": {
            header: "Eiffel Tower Day",
            lodging: {
                start: { city: "Paris", time: "08:00", address: "Hotel Ritz Paris" },
                end: { city: "Paris", time: "23:00", address: "Hotel Ritz Paris" }
            },
            activities: [
                { event: "Visit Eiffel Tower", time: "10:00", ticket: "Online ticket", location: "Champ de Mars", notes: "Climb to the top" },
                { event: "Lunch at nearby cafe", time: "13:00", location: "Café du Trocadéro" },
                { event: "Seine River cruise", time: "16:00", ticket: "Bateaux Parisiens", location: "Port de la Bourdonnais" }
            ],
            expenses: [
                { amount: 80, category: "Activities", description: "Eiffel Tower tickets" },
                { amount: 40, category: "Food", description: "Lunch" },
                { amount: 25, category: "Activities", description: "River cruise" }
            ]
        },
        "2026-05-06": {
            header: "Louvre Museum",
            lodging: {
                start: { city: "Paris", time: "09:00", address: "Hotel Ritz Paris" },
                end: { city: "Paris", time: "22:00", address: "Hotel Ritz Paris" }
            },
            activities: [
                { event: "Explore Louvre Museum", time: "10:00", ticket: "Museum pass", location: "Rue de Rivoli", notes: "See Mona Lisa and Venus de Milo" },
                { event: "Walk through Tuileries Garden", time: "15:00", location: "Jardin des Tuileries" },
                { event: "Dinner in Le Marais", time: "19:00", location: "Le Marais district" }
            ],
            expenses: [
                { amount: 60, category: "Activities", description: "Louvre tickets" },
                { amount: 50, category: "Food", description: "Dinner" }
            ]
        },
        "2026-05-07": {
            header: "Montmartre & Sacré-Cœur",
            lodging: {
                start: { city: "Paris", time: "09:00", address: "Hotel Ritz Paris" },
                end: { city: "Paris", time: "21:00", address: "Hotel Ritz Paris" }
            },
            activities: [
                { event: "Visit Sacré-Cœur Basilica", time: "11:00", location: "Montmartre", notes: "Beautiful views of Paris" },
                { event: "Explore Montmartre artists", time: "13:00", location: "Place du Tertre" },
                { event: "Moulin Rouge show", time: "20:00", ticket: "Evening show", location: "Boulevard de Clichy" }
            ],
            expenses: [
                { amount: 30, category: "Activities", description: "Basilica entry" },
                { amount: 100, category: "Activities", description: "Moulin Rouge tickets" }
            ]
        },
        "2026-05-08": {
            header: "Versailles Day Trip",
            lodging: {
                start: { city: "Paris", time: "08:00", address: "Hotel Ritz Paris" },
                end: { city: "Paris", time: "20:00", address: "Hotel Ritz Paris" }
            },
            activities: [
                { event: "Train to Versailles", time: "09:00", location: "Gare Montparnasse" },
                { event: "Tour Palace of Versailles", time: "10:30", ticket: "Palace ticket", location: "Place d'Armes, Versailles", notes: "Hall of Mirrors" },
                { event: "Gardens and fountains", time: "14:00", location: "Versailles Gardens" },
                { event: "Return to Paris", time: "17:00" }
            ],
            expenses: [
                { amount: 15, category: "Transport", description: "Train tickets" },
                { amount: 40, category: "Activities", description: "Palace entry" },
                { amount: 25, category: "Food", description: "Lunch in Versailles" }
            ]
        },
        "2026-05-09": {
            header: "Free Day in Paris",
            lodging: {
                start: { city: "Paris", time: "10:00", address: "Hotel Ritz Paris" },
                end: { city: "Paris", time: "18:00", address: "Hotel Ritz Paris" }
            },
            activities: [
                { event: "Shopping on Champs-Élysées", time: "11:00", location: "Champs-Élysées" },
                { event: "Arc de Triomphe", time: "14:00", location: "Place Charles de Gaulle" },
                { event: "Relax in park", time: "16:00", location: "Jardin du Luxembourg" }
            ],
            expenses: [
                { amount: 100, category: "Shopping", description: "Souvenirs" },
                { amount: 20, category: "Food", description: "Café snack" }
            ]
        },
        "2026-05-10": {
            header: "Seine River Cruise",
            lodging: {
                start: { city: "Paris", time: "09:00", address: "Hotel Ritz Paris" },
                end: { city: "Paris", time: "19:00", address: "Hotel Ritz Paris" }
            },
            activities: [
                { event: "Bateaux Mouches cruise", time: "12:00", ticket: "Lunch cruise", location: "Port de la Conférence", notes: "Cruise with lunch" },
                { event: "Visit Notre-Dame (exterior)", time: "16:00", location: "Île de la Cité" },
                { event: "Latin Quarter exploration", time: "17:00", location: "Quartier Latin" }
            ],
            expenses: [
                { amount: 80, category: "Activities", description: "Cruise with lunch" }
            ]
        },
        "2026-05-11": {
            header: "Art & Culture Day",
            lodging: {
                start: { city: "Paris", time: "09:00", address: "Hotel Ritz Paris" },
                end: { city: "Paris", time: "20:00", address: "Hotel Ritz Paris" }
            },
            activities: [
                { event: "Musée d'Orsay", time: "10:00", ticket: "Museum pass", location: "Rue de Lille", notes: "Impressionist art" },
                { event: "Café culture", time: "14:00", location: "Saint-Germain-des-Prés" },
                { event: "Evening at Moulin Rouge", time: "19:00", ticket: "Show tickets", location: "Pigalle" }
            ],
            expenses: [
                { amount: 50, category: "Activities", description: "Museum entry" },
                { amount: 90, category: "Activities", description: "Show tickets" }
            ]
        },
        "2026-05-12": {
            header: "Paris Markets",
            lodging: {
                start: { city: "Paris", time: "10:00", address: "Hotel Ritz Paris" },
                end: { city: "Paris", time: "18:00", address: "Hotel Ritz Paris" }
            },
            activities: [
                { event: "Visit flea market", time: "11:00", location: "Marché aux Puces de Clignancourt" },
                { event: "Food market shopping", time: "14:00", location: "Marché des Enfants Rouges" },
                { event: "Picnic in park", time: "16:00", location: "Parc des Buttes-Chaumont" }
            ],
            expenses: [
                { amount: 40, category: "Shopping", description: "Market purchases" },
                { amount: 30, category: "Food", description: "Market foods" }
            ]
        },
        "2026-05-13": {
            header: "Wine & Cheese Tour",
            lodging: {
                start: { city: "Paris", time: "09:00", address: "Hotel Ritz Paris" },
                end: { city: "Paris", time: "19:00", address: "Hotel Ritz Paris" }
            },
            activities: [
                { event: "Wine tasting tour", time: "11:00", ticket: "Guided tour", location: "Latin Quarter", notes: "French wines" },
                { event: "Cheese workshop", time: "14:00", location: "Fromagerie" },
                { event: "Seine promenade", time: "17:00", location: "Quai de Conti" }
            ],
            expenses: [
                { amount: 60, category: "Activities", description: "Wine tour" },
                { amount: 40, category: "Food", description: "Cheese and wine" }
            ]
        },
        "2026-05-14": {
            header: "Fashion & Shopping",
            lodging: {
                start: { city: "Paris", time: "10:00", address: "Hotel Ritz Paris" },
                end: { city: "Paris", time: "20:00", address: "Hotel Ritz Paris" }
            },
            activities: [
                { event: "Galeries Lafayette", time: "11:00", location: "Boulevard Haussmann" },
                { event: "Fashion show viewing", time: "14:00", location: "Palais de Tokyo" },
                { event: "Dinner at Michelin star", time: "19:00", location: "Le Meurice" }
            ],
            expenses: [
                { amount: 150, category: "Shopping", description: "Fashion purchases" },
                { amount: 200, category: "Food", description: "Fine dining" }
            ]
        },
        "2026-05-15": {
            header: "Day Trip to Giverny",
            lodging: {
                start: { city: "Paris", time: "07:00", address: "Hotel Ritz Paris" },
                end: { city: "Paris", time: "21:00", address: "Hotel Ritz Paris" }
            },
            activities: [
                { event: "Train to Giverny", time: "08:00", location: "Gare Saint-Lazare" },
                { event: "Visit Monet's Garden", time: "10:00", ticket: "Garden entry", location: "Giverny", notes: "Water lilies inspiration" },
                { event: "Lunch in village", time: "13:00", location: "Giverny village" },
                { event: "Return to Paris", time: "17:00" }
            ],
            expenses: [
                { amount: 25, category: "Transport", description: "Train tickets" },
                { amount: 20, category: "Activities", description: "Garden entry" },
                { amount: 35, category: "Food", description: "Lunch" }
            ]
        },
        "2026-05-16": {
            header: "Paris Highlights",
            lodging: {
                start: { city: "Paris", time: "09:00", address: "Hotel Ritz Paris" },
                end: { city: "Paris", time: "18:00", address: "Hotel Ritz Paris" }
            },
            activities: [
                { event: "Père Lachaise Cemetery", time: "10:00", location: "Boulevard de Ménilmontant", notes: "Famous graves" },
                { event: "Belleville neighborhood", time: "13:00", location: "Belleville" },
                { event: "Final Seine walk", time: "16:00", location: "Pont Neuf" }
            ],
            expenses: [
                { amount: 10, category: "Activities", description: "Cemetery entry" }
            ]
        },
        "2026-05-17": {
            header: "Last Day Shopping",
            lodging: {
                start: { city: "Paris", time: "10:00", address: "Hotel Ritz Paris" },
                end: { city: "Paris", time: "14:00", address: "Hotel Ritz Paris" }
            },
            activities: [
                { event: "Last minute shopping", time: "11:00", location: "Champs-Élysées" },
                { event: "Check out of hotel", time: "14:00" },
                { event: "Depart for airport", time: "16:00", location: "Charles de Gaulle Airport" }
            ],
            expenses: [
                { amount: 50, category: "Shopping", description: "Final souvenirs" },
                { amount: 60, category: "Transport", description: "Airport transfer" }
            ]
        }
    };

    dates.forEach(date => {
        if (sampleData[date]) {
            appState.itinerary[date] = sampleData[date];
        }
    });

    saveData();
    renderCurrentPage();
}

// --- FINANCE LOGIC ---
function renderBudget(content) {
    const dates = getDatesInRange();
    let categoryTotals = {};
    let dailyTotals = {};
    let grandTotal = 0;

    appState.budget.categories.forEach(cat => categoryTotals[cat] = 0);

    dates.forEach(date => {
        const dayData = appState.itinerary[date];
        if (dayData && dayData.expenses) {
            dayData.expenses.forEach(exp => {
                const amt = parseFloat(exp.amount || 0);
                categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + amt;
                dailyTotals[date] = (dailyTotals[date] || 0) + amt;
                grandTotal += amt;
            });
        }
    });

    let html = `<h2>💰 Trip Finances</h2>
        <div style="background:#007aff; color:white; padding:20px; border-radius:15px; text-align:center; margin-bottom:20px;">
            <small>TOTAL SPENT</small>
            <h1 style="font-size:2.5rem; margin:0;">$${grandTotal.toFixed(2)}</h1>
        </div>`;

    html += `<h3>Breakdown</h3><div style="background:white; padding:15px; border-radius:12px; margin-bottom:20px;">`;
    for (const [cat, total] of Object.entries(categoryTotals)) {
        if (total > 0) {
            const percent = grandTotal > 0 ? (total / grandTotal * 100).toFixed(0) : 0;
            html += `<div style="margin-bottom:12px;">
                <div class="flex-row" style="justify-content:space-between; margin-bottom:4px;">
                    <span><b>${cat}</b></span><span>$${total.toFixed(2)}</span>
                </div>
                <div style="background:#eee; height:8px; border-radius:4px;"><div style="background:#007aff; height:100%; width:${percent}%;"></div></div>
            </div>`;
        }
    }
    html += `</div>`;
    content.innerHTML = html;
}

function addExpense() {
    const activeDate = getDatesInRange()[appState.currentDateIndex];
    if (!appState.itinerary[activeDate].expenses) appState.itinerary[activeDate].expenses = [];
    appState.itinerary[activeDate].expenses.push({ amount: 0, category: "Other", description: "" });
    saveData();
    renderCurrentPage();
}

function updateExpense(index, field, value) {
    const activeDate = getDatesInRange()[appState.currentDateIndex];
    appState.itinerary[activeDate].expenses[index][field] = value;
    saveData();
}

function removeExpense(index) {
    const activeDate = getDatesInRange()[appState.currentDateIndex];
    appState.itinerary[activeDate].expenses.splice(index, 1);
    saveData();
    renderCurrentPage();
}

// --- PACKING LOGIC ---
function renderPacking(content) {
    const packing = appState.packing;
    const profileNames = Object.keys(packing.profiles);
    let html = `<h2>🎒 Packing Lists</h2>
        <div style="background: white; padding: 15px; border-radius: 12px; margin-bottom: 20px;">
            <select id="profile-select" onchange="switchProfile(this.value)" style="width:100%; padding:10px;">
                <option value="">-- Choose Traveler --</option>
                ${profileNames.map(name => `<option value="${name}" ${packing.selectedProfile === name ? 'selected' : ''}>${name}</option>`).join('')}
            </select>
            <div class="flex-row" style="margin-top:10px;">
                <input type="text" id="new-profile-name" placeholder="Name..." style="flex-grow:1;">
                <button class="primary-btn" onclick="addProfile()" style="margin:0; margin-left:10px;">Add</button>
            </div>
        </div>`;

    if (packing.selectedProfile && packing.profiles[packing.selectedProfile]) {
        const items = packing.profiles[packing.selectedProfile].items || [];
        html += `<div style="background: white; padding: 15px; border-radius: 12px;">
            <h3>${packing.selectedProfile}'s List</h3>
            <textarea id="packing-paste" placeholder="Paste items here..." oninput="parsePackingPaste(this.value)" style="width:100%; height:60px;"></textarea>
            <div style="margin-top:15px;">
                ${items.map((item, index) => `
                    <div class="flex-row" style="padding:10px 0; border-bottom:1px solid #eee; align-items:center;">
                        <input type="checkbox" ${item.packed ? 'checked' : ''} onchange="togglePacked(${index})" style="width:20px; height:20px; margin-right:10px;">
                        <span style="flex-grow:1; text-decoration:${item.packed ? 'line-through' : 'none'};">${item.name}</span>
                        <button onclick="removePackingItem(${index})" style="background:none; border:none; color:red;">✕</button>
                    </div>
                `).join('')}
            </div>
        </div>`;
    }
    content.innerHTML = html;
}

function addProfile() {
    const name = document.getElementById('new-profile-name').value.trim();
    if (name) {
        appState.packing.profiles[name] = { items: [] };
        appState.packing.selectedProfile = name;
        saveData();
        renderCurrentPage();
    }
}

function switchProfile(name) {
    appState.packing.selectedProfile = name;
    saveData();
    renderCurrentPage();
}

function parsePackingPaste(text) {
    const profile = appState.packing.selectedProfile;
    if (!text.trim() || !profile) return;
    text.split('\n').forEach(line => {
        if (line.trim()) appState.packing.profiles[profile].items.push({ name: line.trim(), packed: false });
    });
    document.getElementById('packing-paste').value = '';
    saveData();
    renderCurrentPage();
}

function togglePacked(index) {
    const profile = appState.packing.selectedProfile;
    appState.packing.profiles[profile].items[index].packed = !appState.packing.profiles[profile].items[index].packed;
    saveData();
    renderCurrentPage();
}

function removePackingItem(index) {
    const profile = appState.packing.selectedProfile;
    appState.packing.profiles[profile].items.splice(index, 1);
    saveData();
    renderCurrentPage();
}