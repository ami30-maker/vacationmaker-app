// === STATE MANAGEMENT ===
let appState = {
    userId: null,
    currentTrip: null,
    trips: {},
    dates: { start: "2026-05-04", end: "2026-05-20" },
    itinerary: {},
    budget: { categories: ["Food", "Transport", "Lodging", "Activities", "Shopping", "Other"] },
    packing: { profiles: {}, selectedProfile: null },
    tickets: {},
    currentPage: 'itinerary',
    editMode: false,
    currentDateIndex: 0
};

let db;
let unsubscribe = null;
let currentUser = null;

// === INDEXEDDB INITIALIZATION ===
const dbRequest = indexedDB.open("VacationMakerDB", 1);
dbRequest.onupgradeneeded = (e) => {
    const database = e.target.result;
    if (!database.objectStoreNames.contains("trips")) database.createObjectStore("trips", { keyPath: "id" });
    if (!database.objectStoreNames.contains("user")) database.createObjectStore("user", { keyPath: "id" });
};
dbRequest.onsuccess = (e) => { db = e.target.result; };

// === AUTH FLOWS ===
window.onAuthStateChanged(window.auth, async (user) => {
    if (user) {
        currentUser = user;
        appState.userId = user.uid;
        showAppScreen();
        loadUserData();
        loadUserTrips();
        document.getElementById('user-email').textContent = user.email;
        if (user.photoURL) {
            document.getElementById('user-avatar').src = user.photoURL;
        }
    } else {
        showAuthScreen();
    }
});

function showAuthScreen() {
    document.getElementById('auth-screen').style.display = 'flex';
    document.getElementById('app-screen').style.display = 'none';
}

function showAppScreen() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app-screen').style.display = 'flex';
}

async function handleSignUp() {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    
    if (!email || !password) {
        showToast('Please enter email and password', 'error');
        return;
    }

    try {
        showLoadingSpinner(true);
        await window.createUserWithEmailAndPassword(window.auth, email, password);
        showToast('Account created successfully!', 'success');
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    } finally {
        showLoadingSpinner(false);
    }
}

async function handleSignIn() {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    
    if (!email || !password) {
        showToast('Please enter email and password', 'error');
        return;
    }

    try {
        showLoadingSpinner(true);
        await window.signInWithEmailAndPassword(window.auth, email, password);
        showToast('Signed in successfully!', 'success');
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    } finally {
        showLoadingSpinner(false);
    }
}

async function handleGoogleSignIn() {
    try {
        showLoadingSpinner(true);
        const provider = new window.GoogleAuthProvider();
        await window.signInWithPopup(window.auth, provider);
        showToast('Signed in with Google!', 'success');
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    } finally {
        showLoadingSpinner(false);
    }
}

async function handleLogout() {
    try {
        await window.signOut(window.auth);
        showToast('Signed out', 'success');
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }
}

function showLoadingSpinner(show) {
    document.getElementById('loading-spinner').style.display = show ? 'block' : 'none';
}

// === USER DATA MANAGEMENT ===
async function loadUserData() {
    const tx = db.transaction("user", "readonly");
    const req = tx.objectStore("user").get("profile");
    req.onsuccess = () => {
        if (req.result) {
            // User profile exists
        }
    };
}

async function saveUserData() {
    const tx = db.transaction("user", "readwrite");
    tx.objectStore("user").put({ id: "profile", data: currentUser });
}

// === TRIP MANAGEMENT ===
async function loadUserTrips() {
    if (!appState.userId || !window.db) return;

    try {
        const q = window.firestoreQuery(
            window.firestoreCollection(window.db, 'trips'),
            window.firestoreWhere('ownerId', '==', appState.userId)
        );
        const querySnapshot = await window.firestoreGetDocs(q);
        const trips = {};
        querySnapshot.forEach(doc => {
            trips[doc.id] = { id: doc.id, ...doc.data() };
        });
        appState.trips = trips;
        updateTripSelector();
    } catch (error) {
        console.error('Error loading trips:', error);
    }
}

function updateTripSelector() {
    const selector = document.getElementById('trip-selector');
    selector.innerHTML = '<option value="">No trip selected</option>';
    Object.values(appState.trips).forEach(trip => {
        const option = document.createElement('option');
        option.value = trip.id;
        option.textContent = trip.name || 'Untitled Trip';
        selector.appendChild(option);
    });
}

function switchTrip() {
    const tripId = document.getElementById('trip-selector').value;
    if (tripId) {
        appState.currentTrip = tripId;
        loadTripData(tripId);
        document.getElementById('trip-controls').style.display = 'block';
        showToast('Switched to trip', 'success');
    } else {
        appState.currentTrip = null;
        document.getElementById('trip-controls').style.display = 'none';
    }
}

async function loadTripData(tripId) {
    if (!window.db) return;
    
    if (unsubscribe) unsubscribe();

    const tripRef = window.firestoreDoc(window.db, 'trips', tripId);
    unsubscribe = window.firestoreOnSnapshot(tripRef, (docSnap) => {
        if (docSnap.exists()) {
            const tripData = docSnap.data();
            appState = { ...appState, ...tripData, currentTrip: tripId };
            
            if (document.getElementById('trip-start')) {
                document.getElementById('trip-start').value = appState.dates.start;
                document.getElementById('trip-end').value = appState.dates.end;
            }

            updateCollaboratorsList(tripData.collaborators || {});
            renderCurrentPage();
            updateSyncIndicator();
        }
    });
}

function updateCollaboratorsList(collaborators) {
    const list = document.getElementById('collaborators-list');
    if (!list) return;
    
    const collabList = Object.entries(collaborators || {});
    if (collabList.length === 0) {
        list.innerHTML = '<p style="font-size:0.9rem; color:var(--text-muted);">No collaborators yet</p>';
        return;
    }

    list.innerHTML = '<p style="font-size:0.9rem; font-weight:600; margin-bottom:8px;">Collaborators:</p>' +
        collabList.map(([email, perm]) => `<div style="font-size:0.85rem; padding:6px; background:#f0f0f0; border-radius:6px; margin-bottom:4px;">${email} (${perm})</div>`).join('');
}

async function shareTrip() {
    const email = document.getElementById('share-email').value;
    if (!email || !appState.currentTrip) {
        showToast('Enter email and select a trip', 'error');
        return;
    }

    try {
        const tripRef = window.firestoreDoc(window.db, 'trips', appState.currentTrip);
        const collaborators = (await window.firestoreGetDoc(tripRef)).data().collaborators || {};
        collaborators[email] = 'edit';

        await window.firestoreSetDoc(tripRef, { collaborators }, { merge: true });
        document.getElementById('share-email').value = '';
        showToast(`Shared with ${email}`, 'success');
    } catch (error) {
        showToast('Error sharing trip: ' + error.message, 'error');
    }
}

function showNewTripModal() {
    const modal = document.getElementById('modal');
    const modalBody = document.getElementById('modal-body');
    
    modalBody.innerHTML = `
        <h2>Create New Trip</h2>
        <input type="text" id="new-trip-name" placeholder="Trip name (e.g., Paris 2026)">
        <label>Start Date:</label>
        <input type="date" id="new-trip-start">
        <label>End Date:</label>
        <input type="date" id="new-trip-end">
        <button class="primary-btn" onclick="createNewTrip()">Create Trip</button>
    `;
    
    modal.classList.add('show');
}

async function createNewTrip() {
    const name = document.getElementById('new-trip-name').value;
    const start = document.getElementById('new-trip-start').value;
    const end = document.getElementById('new-trip-end').value;

    if (!name || !start || !end) {
        showToast('Please fill in all fields', 'error');
        return;
    }

    try {
        const tripId = window.db.ref ? window.db.ref().push().key : Math.random().toString(36).substr(2, 9);
        const newTrip = {
            id: tripId,
            name,
            ownerId: appState.userId,
            dates: { start, end },
            itinerary: {},
            budget: { categories: ["Food", "Transport", "Lodging", "Activities", "Shopping", "Other"] },
            packing: { profiles: {}, selectedProfile: null },
            tickets: {},
            collaborators: {}
        };

        const tripRef = window.firestoreDoc(window.db, 'trips', tripId);
        await window.firestoreSetDoc(tripRef, newTrip);
        
        appState.trips[tripId] = newTrip;
        updateTripSelector();
        closeModal();
        showToast('Trip created!', 'success');
    } catch (error) {
        showToast('Error creating trip: ' + error.message, 'error');
    }
}

// === TRIP DATA FUNCTIONS ===
async function updateTripDates() {
    if (!appState.currentTrip) return;
    
    const startInput = document.getElementById('trip-start').value;
    const endInput = document.getElementById('trip-end').value;

    if (startInput && endInput && new Date(startInput) <= new Date(endInput)) {
        appState.dates.start = startInput;
        appState.dates.end = endInput;
        await saveTripData();
        renderCurrentPage();
    } else {
        showToast('Invalid date range', 'error');
    }
}

async function saveTripData() {
    if (!appState.currentTrip || !window.db) return;

    try {
        const tripRef = window.firestoreDoc(window.db, 'trips', appState.currentTrip);
        const dataToSave = {
            dates: appState.dates,
            itinerary: appState.itinerary,
            budget: appState.budget,
            packing: appState.packing,
            tickets: appState.tickets
        };
        await window.firestoreSetDoc(tripRef, dataToSave, { merge: true });
        updateSyncIndicator();
    } catch (error) {
        console.error('Error saving trip:', error);
        showToast('Sync error', 'error');
    }
}

// === RENDERING ===
function renderCurrentPage() {
    const content = document.getElementById('app-content');
    const title = document.getElementById('page-title');
    
    if (!appState.currentTrip) {
        content.innerHTML = '<div class="text-center" style="padding:40px;"><h2>📋 Select a trip to get started</h2><p style="color:var(--text-muted);">Create a new trip or select an existing one from the sidebar</p></div>';
        return;
    }

    if (appState.currentPage === 'full-itinerary') {
        title.textContent = "📋 Full Itinerary";
        renderFullItinerary(content);
    } else if (appState.currentPage === 'itinerary') {
        title.textContent = "🗺️ Itinerary";
        renderItinerary(content);
    } else if (appState.currentPage === 'budget') {
        title.textContent = "💰 Budget";
        renderBudget(content);
    } else {
        title.textContent = "🎒 Packing";
        renderPacking(content);
    }
}

function renderFullItinerary(content) {
    const dates = getDatesInRange();
    const hasItinerary = Object.keys(appState.itinerary).some(date => appState.itinerary[date]);

    let html = `<h2>Your Complete Travel Itinerary</h2>
        <div class="action-row">
            <button class="primary-btn" onclick="generateSampleItinerary()">🎯 Load Sample</button>
            <button class="clear-btn" onclick="clearItinerary()">🗑️ Clear</button>
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
            <div class="flex-row" style="justify-content:space-between; align-items:flex-start; gap:10px;">
                <div>
                    <h3 style="color:#007aff; margin-top:0;">${dateObj.toLocaleDateString('en-US', {weekday:'long', month:'short', day:'numeric'})}</h3>
                    <p style="margin:5px 0; color:#666; font-size:0.9rem;">Daily Schedule</p>
                    ${dayData.header ? `<h4 style="color:#34c759; margin:5px 0 0;">${dayData.header}</h4>` : ''}
                </div>
                <button class="small-btn" onclick="switchToDay('${date}')">Edit Day</button>
            </div>`;

        if (dayData.activities && dayData.activities.length > 0) {
            html += `<h4>Activities</h4>`;
            dayData.activities.forEach((act) => {
                html += `<div class="activity-card" style="margin-bottom:10px;">
                    <div class="card-header">
                        <span class="event-title">${act.event}</span>
                        <span class="time-text">${formatTime12Hour(act.time)}</span>
                    </div>
                </div>`;
            });
        }

        html += `</div>`;
    });

    content.innerHTML = html;
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
            <div style="text-align:center;flex:1;">
                <h2 style="margin:0">${new Date(activeDate + 'T12:00:00').toLocaleDateString('en-US', {month:'short', day:'numeric'})}</h2>
                <small>${new Date(activeDate + 'T12:00:00').toLocaleDateString('en-US', {weekday:'long'})}</small>
            </div>
            <button class="icon-btn" onclick="navDate(1)">➡️</button>
        </div>
        <button class="primary-btn" onclick="toggleEditMode()" style="background:${appState.editMode ? '#34c759' : '#007aff'};">
            ${appState.editMode ? '💾 Save' : '✏️ Edit'}
        </button>
    `;

    if (appState.editMode) {
        html += `<div style="margin-top:20px;"><label>Daily Highlight</label>
                <input type="text" id="day-header" value="${dayData.header}">
                <h3>📋 Activities</h3>
                <textarea id="excel-paste" placeholder="Paste from Excel..." style="height:80px;" oninput="parseExcelPaste(this.value)"></textarea>
                <div style="overflow-x:auto; margin-top:10px;">
                    <table>
                        <thead><tr><th>Event</th><th>Time</th><th>Ticket</th><th>Location</th><th>Notes</th><th></th></tr></thead>
                        <tbody>
                            ${dayData.activities.map((a, i) => `
                                <tr>
                                    <td><input class="table-input" type="text" value="${a.event}" onchange="updateAct(${i}, 'event', this.value)"></td>
                                    <td><input class="table-input" type="time" value="${a.time}" onchange="updateAct(${i}, 'time', this.value)"></td>
                                    <td><input class="table-input" type="text" value="${a.ticket}" onchange="updateAct(${i}, 'ticket', this.value)"></td>
                                    <td><input class="table-input" type="text" value="${a.location}" onchange="updateAct(${i}, 'location', this.value)"></td>
                                    <td><input class="table-input" type="text" value="${a.notes}" onchange="updateAct(${i}, 'notes', this.value)"></td>
                                    <td><button class="icon-btn" onclick="removeAct(${i})">🗑️</button></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                <button class="primary-btn" style="background:#8e8e93;" onclick="addActivity()">+ Add Activity</button></div>`;
    } else {
        const sortedActivities = [...dayData.activities].sort((a, b) => {
            if (!a.time && !b.time) return 0;
            if (!a.time) return 1;
            if (!b.time) return -1;
            return a.time.localeCompare(b.time);
        });

        sortedActivities.forEach((act, idx) => {
            html += `<div class="activity-card">
                <div class="card-header">
                    <span class="event-title">${act.event}</span>
                    <span class="time-text">${formatTime12Hour(act.time)}</span>
                </div>
            </div>`;
        });
    }

    content.innerHTML = html;
}

function renderBudget(content) {
    const dates = getDatesInRange();
    let categoryTotals = {};
    appState.budget.categories.forEach(cat => categoryTotals[cat] = 0);

    dates.forEach(date => {
        const dayData = appState.itinerary[date];
        if (dayData && dayData.expenses) {
            dayData.expenses.forEach(exp => {
                categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + parseFloat(exp.amount || 0);
            });
        }
    });

    let grandTotal = Object.values(categoryTotals).reduce((a, b) => a + b, 0);

    let html = `<h2>💰 Trip Budget</h2>
        <div style="background:#007aff; color:white; padding:20px; border-radius:15px; text-align:center; margin-bottom:20px;">
            <p style="margin:0; font-size:0.9rem;">TOTAL SPENT</p>
            <h1 style="margin:10px 0 0; font-size:2.5rem;">$${grandTotal.toFixed(2)}</h1>
        </div>`;

    for (const [cat, total] of Object.entries(categoryTotals)) {
        if (total > 0) {
            const percent = grandTotal > 0 ? (total / grandTotal * 100).toFixed(0) : 0;
            html += `<div style="margin-bottom:12px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                    <span><b>${cat}</b></span><span>$${total.toFixed(2)}</span>
                </div>
                <div style="background:#eee; height:8px; border-radius:4px;"><div style="background:#007aff; height:100%; width:${percent}%;"></div></div>
            </div>`;
        }
    }

    content.innerHTML = html;
}

function renderPacking(content) {
    const profiles = Object.keys(appState.packing.profiles || {});
    
    let html = `<h2>🎒 Packing List</h2>
        <div>
            <label><strong>Packing Profile</strong></label>
            <select onchange="switchProfile(this.value)" style="margin-bottom:10px;">
                <option value="">New profile...</option>
                ${profiles.map(p => `<option value="${p}" ${p === appState.packing.selectedProfile ? 'selected' : ''}>${p}</option>`).join('')}
            </select>
        </div>`;

    if (appState.packing.selectedProfile) {
        const items = appState.packing.profiles[appState.packing.selectedProfile]?.items || [];
        html += `<div style="margin-top:20px;">
            <textarea id="packing-paste" placeholder="Type item and press space, or paste multiple..." style="height:80px;"></textarea>
            ${items.map((item, idx) => `
                <div style="padding:10px; border-bottom:1px solid #eee; display:flex; align-items:center;">
                    <input type="checkbox" ${item.packed ? 'checked' : ''} onchange="togglePacked(${idx})" style="width:20px; margin-right:10px;">
                    <span style="flex:1; text-decoration:${item.packed ? 'line-through' : 'none'};">${item.name}</span>
                    <button onclick="removePackingItem(${idx})" class="icon-btn">✕</button>
                </div>
            `).join('')}
        </div>`;
    }

    content.innerHTML = html;
}

// === HELPERS ===
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

function formatTime12Hour(time) {
    if (!time) return 'Anytime';
    const [hour, min] = time.split(':').map(Number);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${min.toString().padStart(2, '0')} ${ampm}`;
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

function toggleEditMode() {
    if (appState.editMode) {
        const activeDate = getDatesInRange()[appState.currentDateIndex];
        appState.itinerary[activeDate].header = document.getElementById('day-header').value;
        saveTripData();
    }
    appState.editMode = !appState.editMode;
    renderCurrentPage();
}

function updateAct(index, field, value) {
    const activeDate = getDatesInRange()[appState.currentDateIndex];
    appState.itinerary[activeDate].activities[index][field] = value;
    saveTripData();
}

function addActivity() {
    const activeDate = getDatesInRange()[appState.currentDateIndex];
    appState.itinerary[activeDate].activities.push({ event: '', time: '', ticket: '', location: '', notes: '' });
    saveTripData();
    renderCurrentPage();
}

function removeAct(index) {
    const activeDate = getDatesInRange()[appState.currentDateIndex];
    appState.itinerary[activeDate].activities.splice(index, 1);
    saveTripData();
    renderCurrentPage();
}

function switchToDay(date) {
    const dates = getDatesInRange();
    appState.currentDateIndex = dates.indexOf(date);
    appState.currentPage = 'itinerary';
    appState.editMode = true;
    renderCurrentPage();
}

function clearItinerary() {
    if (!confirm('Clear all itinerary data?')) return;
    appState.itinerary = {};
    saveTripData();
    renderCurrentPage();
}

function generateSampleItinerary() {
    const dates = getDatesInRange();
    const sampleData = {
        "2026-05-04": {
            header: "Arrival",
            lodging: { start: { city: "Paris", time: "15:00" }, end: { city: "Paris", time: "11:00" } },
            activities: [
                { event: "Check in", time: "15:00", ticket: "", location: "Hotel", notes: "" },
                { event: "Dinner", time: "19:00", ticket: "", location: "Restaurant", notes: "" }
            ],
            expenses: []
        }
    };
    dates.forEach(date => {
        if (sampleData[date]) appState.itinerary[date] = sampleData[date];
    });
    saveTripData();
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
                time: parseTime(cols[1] || ''),
                ticket: cols[2] || '',
                location: cols[3] || '',
                notes: cols[4] || ''
            });
        }
    });
    document.getElementById('excel-paste').value = '';
    saveTripData();
    renderCurrentPage();
}

function parseTime(str) {
    str = str.trim().toLowerCase();
    const match = str.match(/(\d+):?(\d+)?\s*(am|pm)?/);
    if (match) {
        let hour = parseInt(match[1]);
        const min = match[2] ? parseInt(match[2]) : 0;
        const ampm = match[3];
        if (ampm === 'pm' && hour < 12) hour += 12;
        if (ampm === 'am' && hour === 12) hour = 0;
        return `${hour.toString().padStart(2,'0')}:${min.toString().padStart(2,'0')}`;
    }
    return str;
}

function addPackingItem(name) {
    const profile = appState.packing.selectedProfile;
    if (profile) {
        appState.packing.profiles[profile].items.push({ name, packed: false });
        saveTripData();
        renderCurrentPage();
    }
}

function togglePacked(index) {
    const profile = appState.packing.selectedProfile;
    appState.packing.profiles[profile].items[index].packed = !appState.packing.profiles[profile].items[index].packed;
    saveTripData();
}

function removePackingItem(index) {
    const profile = appState.packing.selectedProfile;
    appState.packing.profiles[profile].items.splice(index, 1);
    saveTripData();
    renderCurrentPage();
}

function switchProfile(name) {
    appState.packing.selectedProfile = name;
    if (!appState.packing.profiles[name]) {
        appState.packing.profiles[name] = { items: [] };
    }
    saveTripData();
    renderCurrentPage();
}

// === UI UTILITIES ===
function toggleMenu() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('overlay').classList.toggle('show');
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function showSettings() {
    const modal = document.getElementById('modal');
    const modalBody = document.getElementById('modal-body');
    
    modalBody.innerHTML = `
        <h2>Settings</h2>
        <p><strong>Email:</strong> ${currentUser?.email}</p>
        <p><strong>User ID:</strong> ${appState.userId}</p>
        <hr>
        <button class="primary-btn" onclick="syncApp()">🔄 Force Sync</button>
        <button class="primary-btn" onclick="exportData()">📤 Export Data</button>
        <button class="clear-btn" onclick="handleLogout()">🚪 Logout</button>
    `;
    
    modal.classList.add('show');
}

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
    showToast('Syncing...', 'info');
}

function exportData() {
    const dataStr = JSON.stringify(appState, null, 2);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([dataStr], {type: 'application/json'}));
    link.download = `${appState.currentTrip || 'trips'}-backup.json`;
    link.click();
}

function updateSyncIndicator() {
    const indicator = document.getElementById('sync-indicator');
    if (indicator) {
        indicator.textContent = '✓';
        indicator.style.color = '#34c759';
        setTimeout(() => {
            indicator.textContent = '✓';
            indicator.style.color = 'var(--text-muted)';
        }, 2000);
    }
}

function closeModal(e) {
    if (e && e.target.id !== 'modal') return;
    document.getElementById('modal').classList.remove('show');
}

// Initialize
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        if (appState.currentTrip) loadTripData(appState.currentTrip);
    }
});
