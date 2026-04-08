let items = JSON.parse(localStorage.getItem("items")) || [];

function render() {
  const list = document.getElementById("list");
  list.innerHTML = "";

  items.forEach((item, index) => {
    const li = document.createElement("li");
    li.textContent = item;

    li.onclick = () => {
      items.splice(index, 1);
      save();
    };

    list.appendChild(li);
  });
}

function addItem() {
  const input = document.getElementById("itemInput");
  if (input.value.trim() === "") return;

  items.push(input.value);
  input.value = "";
  save();
}

function save() {
  localStorage.setItem("items", JSON.stringify(items));
  render();
}

render();
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js");
}