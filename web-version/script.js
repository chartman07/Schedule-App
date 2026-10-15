const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const COLORS = ["#3b6fe0", "#d6335a", "#1f9d77", "#e08a1e", "#8a4fd6", "#0e8aa6"];
const HR = 56;
const KEY = "class-schedule-v1";

let classes = [];
let editing = null;
let color = COLORS[0];
let weekOffset = 0;

const $ = (id) => document.getElementById(id);

try {
  classes = JSON.parse(localStorage.getItem(KEY) || "[]") || [];
} catch (e) {
  classes = [];
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(classes));
  } catch (e) {
    // Ignore storage failures.
  }
}

const mins = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

const fmt = (t) => {
  let [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return h + (m ? ":" + String(m).padStart(2, "0") : "") + " " + ap;
};

const hourLbl = (h) => (h % 12 || 12) + (h >= 12 && h < 24 ? " PM" : " AM");

// form
$("days").innerHTML = DAYS.map(
  (day, index) => `<label style="margin: 0"><input type="checkbox" value="${index}"><span>${day}</span></label>`
).join("");

$("sws").innerHTML = COLORS.map(
  (colorValue) => `<button type="button" class="sw" data-c="${colorValue}" style="background: ${colorValue}" aria-label="Color ${colorValue}"></button>`
).join("");

function paintSw() {
  document.querySelectorAll(".sw").forEach((button) => {
    button.setAttribute("aria-pressed", button.dataset.c === color);
  });
}

$("sws").onclick = (event) => {
  const button = event.target.closest(".sw");
  if (button) {
    color = button.dataset.c;
    paintSw();
  }
};

function reset() {
  editing = null;
  $("name").value = "";
  $("start").value = "09:00";
  $("end").value = "10:15";

  document.querySelectorAll("#days input").forEach((input) => {
    input.checked = false;
  });

  color = COLORS[classes.length % COLORS.length];
  paintSw();

  $("mode").textContent = "Add a class";
  $("save").textContent = "Add class";
  $("cancel").hidden = $("del").hidden = true;
  $("err").textContent = "";
}

function edit(id) {
  const classEntry = classes.find((item) => item.id === id);
  if (!classEntry) return;

  editing = id;
  $("name").value = classEntry.name;
  $("start").value = classEntry.start;
  $("end").value = classEntry.end;

  document.querySelectorAll("#days input").forEach((input) => {
    input.checked = classEntry.days.includes(Number(input.value));
  });

  color = classEntry.color;
  paintSw();

  $("mode").textContent = "Edit class";
  $("save").textContent = "Save changes";
  $("cancel").hidden = $("del").hidden = false;
  $("err").textContent = "";
  $("name").scrollIntoView({ block: "center", behavior: "smooth" });
}

$("save").onclick = () => {
  const name = $("name").value.trim();
  const days = [...document.querySelectorAll("#days input:checked")].map((input) => Number(input.value));
  const start = $("start").value;
  const end = $("end").value;

  if (!name) {
    $("err").textContent = "Enter a class name.";
    return;
  }

  if (!days.length) {
    $("err").textContent = "Pick at least one day.";
    return;
  }

  if (!start || !end || mins(end) <= mins(start)) {
    $("err").textContent = "End time must be after the start time.";
    return;
  }

  const obj = { id: editing || String(Date.now()), name, days, start, end, color };

  if (editing) {
    classes = classes.map((classEntry) => (classEntry.id === editing ? obj : classEntry));
  } else {
    classes.push(obj);
  }

  persist();
  reset();
  render();
};

$("cancel").onclick = reset;

$("del").onclick = () => {
  classes = classes.filter((classEntry) => classEntry.id !== editing);
  persist();
  reset();
  render();
};

$("prev").onclick = () => {
  weekOffset -= 1;
  render();
};

$("next").onclick = () => {
  weekOffset += 1;
  render();
};

$("now").onclick = () => {
  weekOffset = 0;
  render();
};

function render() {
  const now = new Date();
  const dow = (now.getDay() + 6) % 7;
  const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow + weekOffset * 7);
  const dates = DAYS.map((_, index) => new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + index));
  const sun = dates[6];
  const opt = { month: "short", day: "numeric" };

  $("range").textContent = mon.toLocaleDateString(undefined, opt) + " – " + sun.toLocaleDateString(undefined, opt);

  let lo = 8;
  let hi = 17;

  classes.forEach((classEntry) => {
    lo = Math.min(lo, Math.floor(mins(classEntry.start) / 60));
    hi = Math.max(hi, Math.ceil(mins(classEntry.end) / 60));
  });

  const gridHeight = (hi - lo) * HR;

  let header = `<div class="hd corner"></div>`;
  header += dates
    .map((date, index) => {
      const isToday = date.toDateString() === now.toDateString();
      return `<div class="hd${isToday ? " today" : ""}">${DAYS[index]}<small>${date.getDate()}</small></div>`;
    })
    .join("");

  let timeLabels = "";
  for (let tick = 0; tick <= hi - lo; tick += 1) {
    timeLabels += `<div style="top: ${tick * HR}px">${hourLbl(lo + tick)}</div>`;
  }

  header += `<div class="times" style="height: ${gridHeight}px">${timeLabels}</div>`;

  for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
    const isToday = dates[dayIndex].toDateString() === now.toDateString();
    let lines = "";

    for (let tick = 0; tick < hi - lo; tick += 1) {
      lines += `<div class="hl" style="top: ${tick * HR}px"></div>`;
    }

    const blocks = classes
      .filter((classEntry) => classEntry.days.includes(dayIndex))
      .map((classEntry) => {
        const top = ((mins(classEntry.start) - lo * 60) / 60) * HR;
        const height = Math.max(((mins(classEntry.end) - mins(classEntry.start)) / 60) * HR - 2, 22);

        return `<button class="blk" data-id="${classEntry.id}" style="top: ${top}px; height: ${height}px; background: ${classEntry.color}"><b>${esc(classEntry.name)}</b>${fmt(classEntry.start)} – ${fmt(classEntry.end)}</button>`;
      })
      .join("");

    header += `<div class="col${isToday ? " today" : ""}" style="height: ${gridHeight}px">${lines}${blocks}</div>`;
  }

  $("grid").innerHTML = header;
  $("empty").hidden = classes.length > 0;
}

const esc = (value) =>
  value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[character]));

$("grid").onclick = (event) => {
  const block = event.target.closest(".blk");
  if (block) {
    edit(block.dataset.id);
  }
};

reset();
render();
