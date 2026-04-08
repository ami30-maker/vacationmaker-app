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