const KIT = `<style>
  :root { --ink: #121212; --paper: #fff8e7; --pop: #3dff9a; --pink: #ff4d8d; --sky: #7ec8ff; --sun: #ffd166; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; font-family: "Marker Felt", "Chalkboard SE", "Comic Sans MS", cursive; color: var(--ink); background: var(--paper) radial-gradient(#0000000f 1px, transparent 1px) 0 0 / 18px 18px; }
  .kit { max-width: 980px; margin: 0 auto; padding: 32px 20px 48px; }
  h1 { margin: 0 0 6px; font-size: clamp(30px, 6vw, 54px); letter-spacing: -.02em; transform: rotate(-1.2deg); }
  .sub { margin: 0 0 24px; opacity: .7; }
  .sketch { border: 3px solid var(--ink); border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px; box-shadow: 5px 6px 0 var(--ink); background: #fff; }
  .btn3d { font: inherit; font-size: 17px; padding: 10px 18px; cursor: pointer; border: 3px solid var(--ink); border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px; box-shadow: 4px 5px 0 var(--ink); background: var(--sun); transition: transform .08s, box-shadow .08s; }
  .btn3d:hover { transform: translate(-1px, -2px) rotate(-1deg); box-shadow: 6px 8px 0 var(--ink); }
  .btn3d:active, .btn3d.on { transform: translate(3px, 4px); box-shadow: 1px 1px 0 var(--ink); }
</style>`;

export const STARTERS = [
  {
    id: "gallery",
    name: "Image gallery",
    note: "Generated tiles, filters, lightbox, arrow keys",
    html: `${KIT}
<style>
  .filters { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 22px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 18px; }
  .tile { padding: 8px; cursor: zoom-in; transition: transform .15s; }
  .tile:nth-child(odd) { transform: rotate(-1.5deg); }
  .tile:nth-child(even) { transform: rotate(1.2deg); }
  .tile:hover { transform: rotate(0) scale(1.04); }
  .tile canvas { width: 100%; aspect-ratio: 1; display: block; border-radius: 6px; border: 2px solid var(--ink); }
  .tile p { margin: 6px 2px 0; font-size: 14px; }
  .box { position: fixed; inset: 0; display: none; place-items: center; background: #121212d9; }
  .box.open { display: grid; }
  .box figure { margin: 0; padding: 12px; max-width: min(560px, 90vw); }
  .box canvas { width: 100%; display: block; border: 2px solid var(--ink); border-radius: 8px; }
  .box figcaption { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-top: 10px; }
</style>
<main class="kit">
  <h1>Hand-drawn gallery</h1>
  <p class="sub">Every picture is drawn by JavaScript. Click one, then use the arrow keys.</p>
  <div class="filters" id="filters"></div>
  <section class="grid" id="grid"></section>
</main>
<div class="box" id="box">
  <figure class="sketch">
    <canvas id="big" width="560" height="560"></canvas>
    <figcaption>
      <button class="btn3d" id="prev">Prev</button>
      <b id="caption"></b>
      <button class="btn3d" id="next">Next</button>
    </figcaption>
  </figure>
</div>`,
    js: `const PHI = 1.618033988749895;
const KINDS = ["all", "sunset", "ocean", "forest", "candy"];
const PALETTES = {
  sunset: ["#ff4d8d", "#ffd166", "#ff8c42"],
  ocean: ["#7ec8ff", "#2a6fdb", "#3dff9a"],
  forest: ["#3dff9a", "#2d6a4f", "#ffd166"],
  candy: ["#ff4d8d", "#b98cff", "#7ec8ff"]
};
const items = Array.from({ length: 16 }, (_, i) => ({
  id: i,
  kind: KINDS[1 + (i % 4)],
  title: "Sketch no. " + (i + 1)
}));

function paint(canvas, item) {
  const ctx = canvas.getContext("2d");
  const size = canvas.width;
  const [a, b, c] = PALETTES[item.kind];
  const sky = ctx.createLinearGradient(0, 0, 0, size);
  sky.addColorStop(0, a);
  sky.addColorStop(1, b);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, size, size);
  for (let k = 0; k < 140; k++) {
    const angle = k * 137.507 * Math.PI / 180 + item.id;
    const radius = Math.sqrt(k) * size / 26;
    ctx.beginPath();
    ctx.arc(size / 2 + Math.cos(angle) * radius, size / 2 + Math.sin(angle) * radius, size / 90 + (k % 5), 0, Math.PI * 2);
    ctx.fillStyle = k % 3 ? c : "#ffffffaa";
    ctx.fill();
  }
  ctx.lineWidth = size / 60;
  ctx.strokeStyle = "#121212";
  ctx.beginPath();
  for (let x = 0; x <= size; x += size / 24) ctx.lineTo(x, size * 0.78 + Math.sin(x / size * PHI * 6 + item.id) * size * 0.04);
  ctx.stroke();
}

const grid = document.getElementById("grid");
const filters = document.getElementById("filters");
let shown = items;
let current = 0;

function render(kind) {
  shown = kind === "all" ? items : items.filter((item) => item.kind === kind);
  grid.innerHTML = "";
  shown.forEach((item, index) => {
    const tile = document.createElement("figure");
    tile.className = "tile sketch";
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 240;
    paint(canvas, item);
    const label = document.createElement("p");
    label.textContent = item.title + " · " + item.kind;
    tile.append(canvas, label);
    tile.onclick = () => open(index);
    grid.append(tile);
  });
  [...filters.children].forEach((button) => button.classList.toggle("on", button.dataset.kind === kind));
  console.log("Showing", shown.length, kind, "sketches");
}

KINDS.forEach((kind) => {
  const button = document.createElement("button");
  button.className = "btn3d";
  button.dataset.kind = kind;
  button.textContent = kind;
  button.onclick = () => render(kind);
  filters.append(button);
});

const box = document.getElementById("box");
function open(index) {
  current = (index + shown.length) % shown.length;
  paint(document.getElementById("big"), shown[current]);
  document.getElementById("caption").textContent = shown[current].title;
  box.classList.add("open");
}
document.getElementById("prev").onclick = (event) => { event.stopPropagation(); open(current - 1); };
document.getElementById("next").onclick = (event) => { event.stopPropagation(); open(current + 1); };
box.onclick = (event) => { if (event.target === box) box.classList.remove("open"); };
document.addEventListener("keydown", (event) => {
  if (!box.classList.contains("open")) return;
  if (event.key === "ArrowLeft") open(current - 1);
  if (event.key === "ArrowRight") open(current + 1);
  if (event.key === "Escape") box.classList.remove("open");
});

render("all");`
  },
  {
    id: "fonts",
    name: "Font specimen",
    note: "Type a line, size it, compare font stacks",
    html: `${KIT}
<style>
  .controls { display: grid; grid-template-columns: 1fr 180px; gap: 14px; padding: 14px; margin-bottom: 22px; }
  .controls input[type=text] { font: inherit; font-size: 18px; padding: 8px 10px; border: 2px solid var(--ink); border-radius: 8px; }
  .row { padding: 14px 16px; margin-bottom: 14px; }
  .row small { display: block; opacity: .6; font-family: ui-monospace, monospace; margin-bottom: 6px; }
  .row div { line-height: 1.15; overflow-wrap: anywhere; }
</style>
<main class="kit">
  <h1>Font specimen</h1>
  <p class="sub">Edit the line and every stack updates.</p>
  <section class="controls sketch">
    <input type="text" id="line" value="Sphinx of black quartz, judge my vow" />
    <label>Size <b id="sizeLabel">36</b>px<br /><input type="range" id="size" min="14" max="96" value="36" /></label>
  </section>
  <section id="rows"></section>
</main>`,
    js: `const STACKS = [
  ["Marker", "'Marker Felt', 'Chalkboard SE', 'Comic Sans MS', cursive"],
  ["Serif", "Georgia, 'Times New Roman', serif"],
  ["Sans", "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"],
  ["Mono", "'JetBrains Mono', ui-monospace, Menlo, monospace"],
  ["Rounded", "ui-rounded, 'SF Pro Rounded', 'Arial Rounded MT Bold', sans-serif"],
  ["Display", "Impact, 'Arial Black', sans-serif"]
];

const rows = document.getElementById("rows");
const line = document.getElementById("line");
const size = document.getElementById("size");

function draw() {
  document.getElementById("sizeLabel").textContent = size.value;
  rows.innerHTML = "";
  STACKS.forEach(([name, stack]) => {
    const row = document.createElement("article");
    row.className = "row sketch";
    const label = document.createElement("small");
    label.textContent = name + " — " + stack;
    const sample = document.createElement("div");
    sample.style.fontFamily = stack;
    sample.style.fontSize = size.value + "px";
    sample.textContent = line.value || "Type something";
    row.append(label, sample);
    rows.append(row);
  });
}

line.addEventListener("input", draw);
size.addEventListener("input", draw);
draw();
console.log("Loaded", STACKS.length, "font stacks");`
  },
  {
    id: "buttons",
    name: "Hand-drawn buttons",
    note: "The 3D CSS kit, with a click counter",
    html: `${KIT}
<style>
  .board { display: flex; flex-wrap: wrap; gap: 18px; padding: 24px; margin-bottom: 22px; }
  .btn3d.pink { background: var(--pink); color: #fff; }
  .btn3d.sky { background: var(--sky); }
  .btn3d.pop { background: var(--pop); }
  .btn3d.ghost { background: #fff; }
  .count { font-size: 64px; text-align: center; padding: 18px; }
  .pip { position: fixed; pointer-events: none; font-size: 22px; animation: rise .8s ease-out forwards; }
  @keyframes rise { to { transform: translateY(-70px) rotate(20deg); opacity: 0; } }
</style>
<main class="kit">
  <h1>3D CSS kit</h1>
  <p class="sub">Hover, press, and count.</p>
  <section class="board sketch" id="board">
    <button class="btn3d">Sunny</button>
    <button class="btn3d pink">Bubblegum</button>
    <button class="btn3d sky">Sky</button>
    <button class="btn3d pop">Mint</button>
    <button class="btn3d ghost">Paper</button>
  </section>
  <section class="count sketch"><span id="count">0</span> clicks</section>
</main>`,
    js: `let clicks = 0;
const marks = ["✦", "★", "✿", "♥", "✺"];

document.getElementById("board").addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  clicks += 1;
  document.getElementById("count").textContent = clicks;
  const pip = document.createElement("span");
  pip.className = "pip";
  pip.textContent = marks[clicks % marks.length];
  pip.style.left = event.clientX + "px";
  pip.style.top = event.clientY + "px";
  document.body.append(pip);
  setTimeout(() => pip.remove(), 800);
  console.log(button.textContent, "pressed —", clicks, "total");
});`
  },
  {
    id: "starfield",
    name: "Golden-angle canvas",
    note: "Animated φ spiral on a full-page canvas",
    html: `<style>
  html, body { margin: 0; height: 100%; background: #070807; overflow: hidden; }
  canvas { display: block; width: 100%; height: 100%; }
  .tag { position: fixed; left: 16px; bottom: 14px; color: #3dff9a; font: 12px ui-monospace, monospace; }
</style>
<canvas id="sky"></canvas>
<div class="tag">φ = 1.618033988749895 · 137.507°</div>`,
    js: `const canvas = document.getElementById("sky");
const ctx = canvas.getContext("2d");
const GOLDEN = 137.507 * Math.PI / 180;
let width = 0;
let height = 0;

function resize() {
  width = canvas.width = innerWidth * devicePixelRatio;
  height = canvas.height = innerHeight * devicePixelRatio;
}
addEventListener("resize", resize);
resize();

function frame(time) {
  ctx.fillStyle = "rgba(7, 8, 7, 0.22)";
  ctx.fillRect(0, 0, width, height);
  const count = 900;
  const scale = Math.min(width, height) / 62;
  for (let i = 0; i < count; i++) {
    const angle = i * GOLDEN + time / 4000;
    const radius = Math.sqrt(i) * scale;
    const x = width / 2 + Math.cos(angle) * radius;
    const y = height / 2 + Math.sin(angle) * radius;
    ctx.fillStyle = "hsl(" + (150 + i / 6) + ", 100%, " + (50 + 20 * Math.sin(i + time / 600)) + "%)";
    ctx.fillRect(x, y, 2 * devicePixelRatio, 2 * devicePixelRatio);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
console.log("Canvas", width, "x", height);`
  },
  {
    id: "clock",
    name: "Sketch clock",
    note: "SVG clock drawn and ticked by JS",
    html: `${KIT}
<style>
  .face { width: min(360px, 80vw); margin: 10px auto; display: block; padding: 14px; }
  .digital { text-align: center; font-size: 30px; }
</style>
<main class="kit">
  <h1>Sketch clock</h1>
  <svg class="face sketch" id="face" viewBox="-110 -110 220 220"></svg>
  <p class="digital" id="digital"></p>
</main>`,
    js: `const svg = document.getElementById("face");
const NS = "http://www.w3.org/2000/svg";

function el(name, attrs) {
  const node = document.createElementNS(NS, name);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
  svg.append(node);
  return node;
}

el("circle", { r: 100, fill: "#fff8e7", stroke: "#121212", "stroke-width": 4 });
for (let i = 0; i < 12; i++) {
  const a = i * Math.PI / 6;
  el("line", { x1: Math.sin(a) * 84, y1: -Math.cos(a) * 84, x2: Math.sin(a) * 94, y2: -Math.cos(a) * 94, stroke: "#121212", "stroke-width": i % 3 ? 3 : 6, "stroke-linecap": "round" });
}
const hour = el("line", { x1: 0, y1: 0, x2: 0, y2: -50, stroke: "#121212", "stroke-width": 8, "stroke-linecap": "round" });
const minute = el("line", { x1: 0, y1: 0, x2: 0, y2: -74, stroke: "#121212", "stroke-width": 5, "stroke-linecap": "round" });
const second = el("line", { x1: 0, y1: 12, x2: 0, y2: -82, stroke: "#ff4d8d", "stroke-width": 2.5, "stroke-linecap": "round" });
el("circle", { r: 6, fill: "#ff4d8d", stroke: "#121212", "stroke-width": 2 });

function tick() {
  const now = new Date();
  const s = now.getSeconds() + now.getMilliseconds() / 1000;
  const m = now.getMinutes() + s / 60;
  const h = (now.getHours() % 12) + m / 60;
  hour.setAttribute("transform", "rotate(" + h * 30 + ")");
  minute.setAttribute("transform", "rotate(" + m * 6 + ")");
  second.setAttribute("transform", "rotate(" + s * 6 + ")");
  document.getElementById("digital").textContent = now.toLocaleTimeString();
  requestAnimationFrame(tick);
}
tick();`
  },
  {
    id: "todo",
    name: "Sticky todo",
    note: "Add, tick, and clear notes",
    html: `${KIT}
<style>
  form { display: flex; gap: 10px; padding: 14px; margin-bottom: 22px; }
  form input { flex: 1; font: inherit; font-size: 18px; padding: 8px 10px; border: 2px solid var(--ink); border-radius: 8px; }
  ul { list-style: none; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 16px; }
  li { padding: 14px; background: var(--sun); cursor: pointer; min-height: 90px; font-size: 18px; }
  li:nth-child(3n+2) { background: var(--sky); }
  li:nth-child(3n) { background: var(--pop); }
  li.done { text-decoration: line-through; opacity: .55; }
</style>
<main class="kit">
  <h1>Sticky todo</h1>
  <p class="sub">Click a note to tick it. Double-click to remove it.</p>
  <form class="sketch" id="form">
    <input id="text" placeholder="Something to do" autocomplete="off" />
    <button class="btn3d">Add</button>
  </form>
  <ul id="list"></ul>
</main>`,
    js: `const notes = [
  { text: "Sketch the layout", done: true },
  { text: "Wire up the gallery", done: false },
  { text: "Ship it", done: false }
];
const list = document.getElementById("list");

function draw() {
  list.innerHTML = "";
  notes.forEach((note, index) => {
    const item = document.createElement("li");
    item.className = "sketch" + (note.done ? " done" : "");
    item.textContent = note.text;
    item.onclick = () => { note.done = !note.done; draw(); };
    item.ondblclick = () => { notes.splice(index, 1); draw(); };
    list.append(item);
  });
  console.log(notes.filter((note) => !note.done).length, "left to do");
}

document.getElementById("form").addEventListener("submit", (event) => {
  event.preventDefault();
  const input = document.getElementById("text");
  if (!input.value.trim()) return;
  notes.push({ text: input.value.trim(), done: false });
  input.value = "";
  draw();
});

draw();`
  },
  {
    id: "blank",
    name: "Blank",
    note: "Empty HTML and JavaScript",
    html: `<main>
  <h1>Hello</h1>
  <p id="out"></p>
</main>`,
    js: `document.getElementById("out").textContent = "Ready at " + new Date().toLocaleTimeString();
console.log("Hello from the preview");`
  }
];
