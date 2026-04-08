// TAB SWITCHING
function showTab(tab) {
  document.querySelectorAll(".tab").forEach(t => t.classList.add("hidden"));
  document.getElementById(tab).classList.remove("hidden");
}

// ------------------ PACKING ------------------
let packing = JSON.parse(localStorage.getItem("packing")) || [];

function renderPacking() {
  const list = document.getElementById("packingList");
  list.innerHTML = "";

  packing.forEach((item, index) => {
    const li = document.createElement("li");
    li.textContent = item;

    li.onclick = () => {
      packing.splice(index, 1);
      savePacking();
    };

    list.appendChild(li);
  });
}

function addPacking() {
  const input = document.getElementById("packingInput");
  if (!input.value) return;

  packing.push(input.value);
  input.value = "";
  savePacking();
}

function savePacking() {
  localStorage.setItem("packing", JSON.stringify(packing));
  renderPacking();
}

// ------------------ ITINERARY ------------------
let itinerary = JSON.parse(localStorage.getItem("itinerary")) || [];

function renderItinerary() {
  const list = document.getElementById("itineraryList");
  list.innerHTML = "";

  itinerary.forEach((item, index) => {
    const li = document.createElement("li");
    li.textContent = `${item.time} - ${item.event} (${item.location})`;

    li.onclick = () => {
      itinerary.splice(index, 1);
      saveItinerary();
    };

    list.appendChild(li);
  });
}

function addEvent() {
  const time = document.getElementById("time").value;
  const event = document.getElementById("event").value;
  const location = document.getElementById("location").value;

  if (!time || !event) return;

  itinerary.push({ time, event, location });

  document.getElementById("time").value = "";
  document.getElementById("event").value = "";
  document.getElementById("location").value = "";

  saveItinerary();
}

function saveItinerary() {
  localStorage.setItem("itinerary", JSON.stringify(itinerary));
  renderItinerary();
}

// ------------------ NOTES ------------------
const notesArea = document.getElementById("notesArea");

notesArea.value = localStorage.getItem("notes") || "";

notesArea.addEventListener("input", () => {
  localStorage.setItem("notes", notesArea.value);
});

// INIT
renderPacking();
renderItinerary();

// SERVICE WORKER
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js");
}