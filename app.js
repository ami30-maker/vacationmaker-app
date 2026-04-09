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
    tickets: {}, // date -> [{name, data}]
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
        
        // Add these two lines to populate the sidebar inputs!
        document.getElementById('trip-start').value = appState.dates.start;
        document.getElementById('trip-end').value = appState.dates.end;
        
        renderCurrentPage();
    };
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
function updateTripDates() {
    const startInput = document.getElementById('trip-start').value;
    const endInput = document.getElementById('trip-end').value;
    
    if (startInput && endInput) {
        if (new Date(startInput) > new Date(endInput)) {
            alert("Start date cannot be after the end date.");
            return;
        }
        appState.dates.start = startInput;
        appState.dates.end = endInput;
        
        // Reset to the first day of the new date range
        appState.currentDateIndex = 0; 
        
        saveData();
        renderCurrentPage();
    }
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
                time: cols[1] ? parseTime(cols[1].trim()) : '',
                ticket: cols[2] ? cols[2].trim() : '',
                location: cols[3] ? cols[3].trim() : '',
                notes: cols[4] ? cols[4].trim() : '',
                image: ''
            });
        }
    });
    document.getElementById('excel-paste').value = '';
    saveData();
    renderCurrentPage();
}

function formatTime12Hour(time) {
    if (!time) return 'Anytime';
    const [hour, min] = time.split(':').map(Number);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${min.toString().padStart(2, '0')} ${ampm}`;
}

function updateAct(index, field, value) {
    const activeDate = getDatesInRange()[appState.currentDateIndex];
    appState.itinerary[activeDate].activities[index][field] = value;
    saveData();
}

function moveAnytime(index, dir) {
    const activeDate = getDatesInRange()[appState.currentDateIndex];
    const acts = appState.itinerary[activeDate].activities;
    const newIdx = index + dir;
    if (newIdx >= 0 && newIdx < acts.length && !acts[index].time && !acts[newIdx].time) {
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
    if (appState.currentPage === 'full-itinerary') {
        title.innerText = "📋 Full Itinerary";
        renderFullItinerary(content);
    } else if (appState.currentPage === 'itinerary') {
        title.innerText = "🗺️ Itinerary";
        renderItinerary(content);
    } else if (appState.currentPage === 'budget') {
        title.innerText = "💰 Finances";
        renderBudget(content);
    } else {
        title.innerText = "🎒 Packing";
        renderPacking(content);
    }
}

function renderFullItinerary(content) {
    const dates = getDatesInRange();
    const hasItinerary = Object.keys(appState.itinerary).some(date => appState.itinerary[date] && ((appState.itinerary[date].activities && appState.itinerary[date].activities.length) || (appState.itinerary[date].header && appState.itinerary[date].header.length) || (appState.itinerary[date].lodging && (appState.itinerary[date].lodging.start.city || appState.itinerary[date].lodging.end.city))));
    let html = `<h2>Your Complete Travel Itinerary</h2>
        <div class="action-row">
            <button class="primary-btn" onclick="generateSampleItinerary()">🎯 Load Sample Itinerary</button>
            <button class="clear-btn" onclick="clearItinerary()">🗑️ Clear All Itinerary</button>
        </div>
        <div style="background:#f8f9fa; padding:20px; border-radius:15px; margin-bottom:20px;">
            <h3>Trip Overview</h3>
            <p><strong>Start Date:</strong> ${new Date(appState.dates.start + 'T12:00:00').toLocaleDateString()}</p>
            <p><strong>End Date:</strong> ${new Date(appState.dates.end + 'T12:00:00').toLocaleDateString()}</p>
            <p><strong>Duration:</strong> ${dates.length} days</p>
        </div>`;

    dates.forEach(date => {
        const dayData = appState.itinerary[date];
        if (!dayData) return;
        const dateObj = new Date(date);
        html += `<div style="background:white; padding:20px; border-radius:15px; margin-bottom:20px; border-left: 5px solid #007aff;">
            <div class="flex-row" style="justify-content:space-between; align-items:flex-start; margin-bottom:12px; gap:10px;">
                <div>
                    <h3 style="color:#007aff; margin-top:0;">${dateObj.toLocaleDateString('en-US', {weekday:'long', month:'short', day:'numeric'})}</h3>
                    <p style="margin:5px 0; color:#666; font-size:0.9rem;">Daily Schedule</p>
                    ${dayData.header ? `<h4 style="color:#34c759; margin:5px 0 0;">${dayData.header}</h4>` : ''}
                </div>
                <button class="small-btn" onclick="switchToDay('${date}')">Edit Day</button>
            </div>`;

        ['start', 'end'].forEach(type => {
            const l = dayData.lodging[type];
            if (l && (l.city || l.address)) {
                const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(l.address || l.city)}`;
                html += `<div style="background:#f0f0f0; padding:12px; border-radius:10px; margin-bottom:10px;">
                    <b>${type.toUpperCase()} Lodging:</b> ${l.city || ''} ${l.time ? `(${formatTime12Hour(l.time)})` : ''}<br>
                    ${l.address ? `📍 <a href="${mapUrl}" target="_blank" style="color:#007aff;">${l.address}</a>` : ''}
                </div>`;
            }
        });

        if (dayData.activities && dayData.activities.length > 0) {
            html += `<h4>Activities</h4>`;
            dayData.activities.forEach((act, idx) => {
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
                        <span class="time-text">${formatTime12Hour(act.time)}</span>
                    </div>
                    ${act.ticket ? `<div style="font-size:0.85rem; margin-top:4px;">🎫 <b>Ticket:</b> ${act.ticket}</div>` : ''}
                    ${act.location ? `<div style="font-size:0.85rem; margin-top:4px;">📍 ${act.location}</div>` : ''}
                    ${act.notes ? `<div style="font-size:0.85rem; margin-top:4px;">📝 ${act.notes}</div>` : ''}
                </div>`;
            });
        }

        const dailyTotal = (dayData.expenses || []).reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0);
        if (dailyTotal > 0) {
            html += `<div style="text-align:right; font-weight:700; margin-top:15px; color:#34c759; padding:10px; border-top:1px solid #eee;">Day Expenses: $${dailyTotal.toFixed(2)}</div>`;
        }
        html += `</div>`;
    });

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

function switchToDay(date) {
    const dates = getDatesInRange();
    appState.currentDateIndex = dates.indexOf(date);
    appState.currentPage = 'itinerary';
    appState.editMode = true;
    renderCurrentPage();
}

function clearItinerary() {
    if (!confirm('Clear all itinerary data? This cannot be undone.')) return;
    appState.itinerary = {};
    saveData();
    renderCurrentPage();
}

function generateSampleItinerary() {
    const dates = getDatesInRange();
    const sampleData = {
        "2026-05-04": {
            header: "Arrival in Paris",
            lodging: { start: { city: "Paris", time: "15:00", address: "Hotel Ritz Paris, 15 Place Vendôme" }, end: { city: "Paris", time: "11:00", address: "Hotel Ritz Paris, 15 Place Vendôme" } },
            activities: [
                { event: "Check into hotel", time: "15:00", ticket: "", location: "Hotel Ritz Paris", notes: "Rest after flight" },
                { event: "Evening walk along Seine", time: "18:00", ticket: "", location: "Seine River", notes: "Enjoy the city lights" }
            ],
            expenses: [ { amount: 50, category: "Transport", description: "Taxi from airport" }, { amount: 300, category: "Lodging", description: "Hotel night" } ]
        },
        "2026-05-05": {
            header: "Eiffel Tower Day",
            lodging: { start: { city: "Paris", time: "08:00", address: "Hotel Ritz Paris" }, end: { city: "Paris", time: "23:00", address: "Hotel Ritz Paris" } },
            activities: [
                { event: "Visit Eiffel Tower", time: "10:00", ticket: "Online ticket", location: "Champ de Mars", notes: "Climb to the top" },
                { event: "Lunch at nearby cafe", time: "13:00", ticket: "", location: "Café du Trocadéro", notes: "Try local pastries" },
                { event: "Seine River cruise", time: "16:00", ticket: "Bateaux Parisiens", location: "Port de la Bourdonnais", notes: "Sunset cruise" }
            ],
            expenses: [ { amount: 80, category: "Activities", description: "Eiffel Tower tickets" }, { amount: 40, category: "Food", description: "Lunch" }, { amount: 25, category: "Activities", description: "River cruise" } ]
        }
    };
    dates.forEach(date => {
        if (sampleData[date]) appState.itinerary[date] = sampleData[date];
    });
    saveData();
    renderCurrentPage();
}

function updateAct(index, field, value) {
    const activeDate = getDatesInRange()[appState.currentDateIndex];
    appState.itinerary[activeDate].activities[index][field] = value;
    saveData();
}

function addActivity() {
    const activeDate = getDatesInRange()[appState.currentDateIndex];
    appState.itinerary[activeDate].activities.push({ event: '', time: '', ticket: '', location: '', notes: '', image: '' });
    saveData();
    renderCurrentPage();
}

function removeAct(index) {
    const activeDate = getDatesInRange()[appState.currentDateIndex];
    appState.itinerary[activeDate].activities.splice(index, 1);
    saveData();
    renderCurrentPage();
}

function getDatesInRange() {
    let dates = [];
    let curr = new Date(appState.dates.start + 'T12:00:00');
    let end = new Date(appState.dates.end + 'T12:00:00');
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
                <h2 style="margin:0">${new Date(activeDate + 'T12:00:00').toLocaleDateString('en-US', {month:'short', day:'numeric'})}</h2>
                <small>${new Date(activeDate + 'T12:00:00').toLocaleDateString('en-US', {weekday:'long'})}</small>
            </div>
            <button class="icon-btn" onclick="navDate(1)">➡️</button>
        </div>
        <button class="small-btn" onclick="toggleEditMode()" style="background:${appState.editMode ? '#34c759' : '#007aff'}; margin-bottom:20px;">
            ${appState.editMode ? '💾 Save' : '✏️ Edit'}
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
                <div style="overflow-x:auto; margin-top:10px;">
                    <table>
                        <thead>
                            <tr>
                                <th>Event</th>
                                <th>Time</th>
                                <th>Ticket</th>
                                <th>Location</th>
                                <th>Notes</th>
                                <th>Image</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            ${dayData.activities.map((a, i) => `
                                <tr>
                                    <td><input class="table-input" type="text" value="${a.event}" onchange="updateAct(${i}, 'event', this.value)"></td>
                                    <td><input class="table-input" type="time" value="${a.time}" onchange="updateAct(${i}, 'time', this.value)"></td>
                                    <td><input class="table-input" type="text" value="${a.ticket}" onchange="updateAct(${i}, 'ticket', this.value)"></td>
                                    <td><input class="table-input" type="text" value="${a.location}" onchange="updateAct(${i}, 'location', this.value)"></td>
                                    <td><input class="table-input" type="text" value="${a.notes}" onchange="updateAct(${i}, 'notes', this.value)"></td>
                                    <td><input type="file" accept="image/*" onchange="uploadImage(${i}, this)"></td>
                                    <td><button class="icon-btn" onclick="removeAct(${i})">🗑️</button></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                <button class="primary-btn" style="background:#8e8e93; font-size:0.9rem;" onclick="addActivity()">+ Add Activity</button>

                <h3>🎫 Tickets</h3>
                <input type="file" multiple accept="image/*,application/pdf" onchange="uploadTickets(this)">
                ${appState.tickets[activeDate] ? appState.tickets[activeDate].map((t, idx) => `<div>${t.name} <button onclick="removeTicket(${idx})">Remove</button></div>`).join('') : ''}

                <h3>💰 Daily Expenses</h3>
                <div id="expense-edit-list">
                    ${(dayData.expenses || []).map((exp, i) => `
                        <div style="margin-bottom:10px; padding:10px; border:1px solid #ddd; border-radius:8px;">
                            <div class="flex-row" style="gap:5px; margin-bottom:5px;">
                                <input type="number" value="${exp.amount}" onchange="updateExpense(${i}, 'amount', this.value)" style="width:70px;" placeholder="Amount">
                                <select onchange="updateExpense(${i}, 'category', this.value)" style="flex-grow:1;">
                                    ${appState.budget.categories.map(c => `<option value="${c}" ${exp.category === c ? 'selected' : ''}>${c}</option>`).join('')}
                                </select>
                            </div>
                            <input type="text" value="${exp.location || ''}" onchange="updateExpense(${i}, 'location', this.value)" placeholder="Location (e.g., Restaurant name)">
                            <button class="icon-btn" onclick="removeExpense(${i})" style="float:right;">✕</button>
                        </div>
                    `).join('')}
                    <button class="primary-btn" style="background:#8e8e93; font-size:0.8rem;" onclick="addExpense()">+ Add Expense</button>
                </div>
            </div>`;
    } else {
        
        ['start', 'end'].forEach(type => {
            const l = dayData.lodging[type];
            if (l.city || l.address) {
                const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(l.address || l.city)}`;
                html += `<div style="background:white; padding:12px; border-radius:10px; margin-bottom:10px; border-left: 5px solid #007aff;">
                    <b>${type.toUpperCase()}:</b> ${l.city} (${formatTime12Hour(l.time)})<br>
                    📍 <a href="${mapUrl}" target="_blank" style="color:#007aff; font-size:0.85rem;">${l.address || 'View Map'}</a>
                </div>`;
            }
        });

        const sortedActivities = dayData.activities.map((act, idx) => ({act, idx})).sort((a, b) => {
            if (!a.act.time && !b.act.time) return 0;
            if (!a.act.time) return 1;
            if (!b.act.time) return -1;
            return a.act.time.localeCompare(b.act.time);
        }).map(({act, idx}) => ({act, originalIndex: idx}));

        sortedActivities.forEach(({act, originalIndex}) => {
            let timeClass = "time-none";
            if (act.time) {
                const hour = parseInt(act.time.split(':')[0]);
                if (hour < 12) timeClass = "time-morning";
                else if (hour < 17) timeClass = "time-afternoon";
                else timeClass = "time-evening";
            }
            const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(act.location || act.event)}`;
            html += `<div class="activity-card ${timeClass}">
                <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
                    <span class="event-title" style="font-weight:bold;">${act.event}</span>
                    <div style="display:flex; align-items:center; gap:5px;">
                        ${!act.time ? `<button class="icon-btn" onclick="moveAnytime(${originalIndex}, -1)" style="font-size:0.8rem;">⬆️</button><button class="icon-btn" onclick="moveAnytime(${originalIndex}, 1)" style="font-size:0.8rem;">⬇️</button>` : ''}
                        <span class="time-text">${formatTime12Hour(act.time)}</span>
                    </div>
                </div>
                ${act.image ? `<img src="${act.image}" style="width:50px; height:50px; margin:5px; border-radius:5px;">` : ''}
                ${act.ticket ? `<div style="font-size:0.85rem; margin-top:4px;">🎫 <b>Ticket:</b> ${act.ticket}</div>` : ''}
                ${act.notes ? `<div style="font-size:0.85rem; margin-top:4px;">📝 ${act.notes}</div>` : ''}
                <div style="margin-top:8px; text-align:right;"><a href="${mapUrl}" target="_blank" style="text-decoration:none; font-size:0.85rem;">📍 View Map</a></div>
            </div>`;
        });

        // Show tickets if it's today
        const today = new Date().toISOString().split('T')[0];
        if (activeDate === today && appState.tickets[activeDate]) {
            html += `<h4>🎫 Today's Tickets</h4>`;
            appState.tickets[activeDate].forEach(ticket => {
                html += `<div style="background:white; padding:10px; border-radius:8px; margin-bottom:10px;">
                    <a href="${ticket.data}" target="_blank">${ticket.name}</a>
                </div>`;
            });
        }

        const dailyTotal = (dayData.expenses || []).reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0);
        if (dailyTotal > 0) {
            html += `<div style="text-align:right; font-weight:700; margin-top:15px; color:#34c759; padding:10px; border-top:1px solid #eee;">Day Total: $${dailyTotal.toFixed(2)}</div>`;
        }
    }
    content.innerHTML = html;
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

    // Daily summary
    html += `<h3>Daily Summary</h3><div style="background:white; padding:15px; border-radius:12px; margin-bottom:20px;">`;
    dates.forEach(date => {
        const dayTotal = dailyTotals[date] || 0;
        if (dayTotal > 0) {
            const dateObj = new Date(date);
            html += `<div style="margin-bottom:10px;">
                <div class="flex-row" style="justify-content:space-between;">
                    <span>${dateObj.toLocaleDateString('en-US', {month:'short', day:'numeric'})}</span>
                    <span>$${dayTotal.toFixed(2)}</span>
                </div>
            </div>`;
        }
    });
    html += `</div>`;

    html += `<h3>Edit Budget Categories</h3>
        <div style="background:white; padding:15px; border-radius:12px; margin-bottom:20px;">
            ${appState.budget.categories.map((cat, index) => `
                <div class="flex-row" style="margin-bottom:10px;">
                    <input class="table-input" type="text" value="${cat}" onchange="updateCategory(${index}, this.value)">
                    <button class="icon-btn" onclick="removeCategory(${index})">✕</button>
                </div>
            `).join('')}
            <div class="action-row">
                <input class="table-input" type="text" id="new-category-name" placeholder="New category">
                <button class="primary-btn" style="width:auto; flex-shrink:0;" onclick="addCategory()">Add Category</button>
            </div>
        </div>`;
    content.innerHTML = html;
}

function addExpense() {
    const activeDate = getDatesInRange()[appState.currentDateIndex];
    if (!appState.itinerary[activeDate].expenses) appState.itinerary[activeDate].expenses = [];
    appState.itinerary[activeDate].expenses.push({ amount: 0, category: "Other", location: "", description: "" });
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

function updateCategory(index, value) {
    const oldName = appState.budget.categories[index];
    const newName = value.trim() || oldName;
    appState.budget.categories[index] = newName;
    Object.values(appState.itinerary).forEach(day => {
        if (day.expenses) {
            day.expenses.forEach(exp => {
                if (exp.category === oldName) exp.category = newName;
            });
        }
    });
    saveData();
    renderCurrentPage();
}

function removeCategory(index) {
    if (appState.budget.categories.length <= 1) return;
    const removed = appState.budget.categories.splice(index, 1)[0];
    const fallback = appState.budget.categories.includes('Other') ? 'Other' : (appState.budget.categories[0] || 'Other');
    Object.values(appState.itinerary).forEach(day => {
        if (day.expenses) {
            day.expenses.forEach(exp => {
                if (exp.category === removed) exp.category = fallback;
            });
        }
    });
    saveData();
    renderCurrentPage();
}

function addCategory() {
    const input = document.getElementById('new-category-name');
    if (!input) return;
    const category = input.value.trim();
    if (!category || appState.budget.categories.includes(category)) return;
    appState.budget.categories.push(category);
    input.value = '';
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
                ${packing.selectedProfile ? `<button class="clear-btn" onclick="deleteProfile()" style="margin:0; margin-left:10px;">Delete Profile</button>` : ''}
            </div>
        </div>`;

    if (packing.selectedProfile && packing.profiles[packing.selectedProfile]) {
        const items = packing.profiles[packing.selectedProfile].items || [];
        html += `<div style="background: white; padding: 15px; border-radius: 12px;">
            <h3>${packing.selectedProfile}'s List</h3>
            <textarea id="packing-paste" placeholder="Type items and press space to add..." oninput="handlePackingInput(this)" style="width:100%; height:60px;"></textarea>
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

function handlePackingInput(textarea) {
    const value = textarea.value;
    if (value.endsWith(' ')) {
        const item = value.trim();
        if (item) {
            addPackingItem(item);
            textarea.value = '';
        }
    } else {
        // For paste, handle multiple lines
        const lines = value.split('\n');
        if (lines.length > 1) {
            lines.forEach(line => {
                const item = line.trim();
                if (item) addPackingItem(item);
            });
            textarea.value = '';
        }
    }
}

function addPackingItem(name) {
    const profile = appState.packing.selectedProfile;
    if (profile) {
        appState.packing.profiles[profile].items.push({ name, packed: false });
        saveData();
        renderCurrentPage();
    }
}

function deleteProfile() {
    const profile = appState.packing.selectedProfile;
    if (profile && confirm(`Delete profile "${profile}"?`)) {
        delete appState.packing.profiles[profile];
        appState.packing.selectedProfile = null;
        saveData();
        renderCurrentPage();
    }
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

// --- TICKET AND IMAGE UPLOAD ---
function uploadImage(index, input) {
    const file = input.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = e => {
            const activeDate = getDatesInRange()[appState.currentDateIndex];
            appState.itinerary[activeDate].activities[index].image = e.target.result;
            saveData();
            renderCurrentPage();
        };
        reader.readAsDataURL(file);
    }
}

function uploadTickets(input) {
    const files = input.files;
    const activeDate = getDatesInRange()[appState.currentDateIndex];
    if (!appState.tickets[activeDate]) appState.tickets[activeDate] = [];
    Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = e => {
            appState.tickets[activeDate].push({ name: file.name, data: e.target.result });
            saveData();
            renderCurrentPage();
        };
        reader.readAsDataURL(file);
    });
    input.value = '';
}

function removeTicket(index) {
    const activeDate = getDatesInRange()[appState.currentDateIndex];
    appState.tickets[activeDate].splice(index, 1);
    saveData();
    renderCurrentPage();
}

// --- SYNC AND DATA MANAGEMENT ---
function syncApp() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
            registrations.forEach(registration => registration.unregister());
        }).then(() => {
            window.location.reload();
        });
    } else {
        window.location.reload();
    }
}

function exportData() {
    const dataStr = JSON.stringify(appState, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'trip-data.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function importData(input) {
    const file = input.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedState = JSON.parse(e.target.result);
                appState = importedState;
                saveData();
                renderCurrentPage();
                alert('Data imported successfully!');
            } catch (err) {
                alert('Error importing data: ' + err.message);
            }
        };
        reader.readAsText(file);
    }
    input.value = '';
}