// Fig «Пасхалія»: how the Orthodox Pascha date is found, drawn with the Anatomy skill kit.
// node docs/pascha/build.mjs [--light]   (ANATOMY=/path/to/anatomy, default ~/.claude/skills/anatomy)
import { writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { pascha, MONTHS } from "./model.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.ANATOMY ?? join(homedir(), ".claude/skills/anatomy");
const k = await import(pathToFileURL(join(ROOT, "kit/iso-kit.mjs")).href);
const G = await import(pathToFileURL(join(ROOT, "kit/lathe.mjs")).href);
const { kitScript } = await import(pathToFileURL(join(ROOT, "scripts/inline-kit.mjs")).href);
const theme = process.argv.includes("--light") ? "light" : "dark";

const WIDTH = 620;
const HEIGHT = 300;
const START = 2026;

// Day t = days after 21 March (Julian). One day is U world units along x.
const U = 6;
const X0 = -64;
const X = (t) => X0 + U * t;
const T_FROM = -6;
const T_TO = 36;

const PLATE = { x: -196, y: -64, w: 404, d: 124, r: 8 };
const PLATE_H = 12;
const FOOT_H = 5;

const LUNAR = { at: [-150, -28], r: 21, count: 19 };
const SOLAR = { at: [-150, 26], r: 21, count: 28 };
const PLINTH_H = 5;
const DISC_H = 5;
const DISC_TOP = PLINTH_H + DISC_H;

const RAIL_FROM = X(T_FROM) - 4;
const RAIL_TO = 196;
const MOON_Y = -38;
const COMB_Y = -12;
const PASCHA_Y = 12;
const JULIAN = { x: X(T_FROM) - 4, y: 28, w: X(T_TO) - X(T_FROM) + 8, d: 9, r: 1 };
const CIVIL = { ...JULIAN, y: 42 };
const RAIL_H = 3;
const CAR_TOP = 8;

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [X(20), PASCHA_Y, 28], [X(20), MOON_Y, 22]],
  WIDTH,
  HEIGHT,
  { pad: 18, azimuth: 58 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

function plate() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 22))) {
    out.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // label plate between the two circles' plinths and the rails
  const label = { x: 162, y: 42, w: 34, d: 9, r: 1 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 3), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.4), 0.8, P, 3), { tone: "faint" }));
  out.push(L([10, 18, 26].map((w, i) => k.lineOnTop([label.x + 4, label.y + 2.4 + i * 1.6], [label.x + 4 + (w * 26) / 26, label.y + 2.4 + i * 1.6], 0.8, P)).join(""), { tone: "lo", free: true }));
  out.push(D([at([label.x + 1.6, label.y + 4, 0.8]), at([label.x + label.w - 1.6, label.y + 4, 0.8])], { size: 0.4 }));
  return out.join("");
}

// A turntable: plinth, knurled disc and tick ring. The needle lies on the face, drawn live, under the hub.
const hub = ({ at: [x, y] }) => S(k.cylinder(x, y, 2.6, DISC_TOP, 1.6, P, 20), { tone: "mid" });
function circle({ at: [x, y], r, count }) {
  const out = [];
  const plinth = { x: x - r - 5, y: y - r - 5, w: 2 * r + 10, d: 2 * r + 10, r: 3 };
  out.push(`<path class="iso-halo" d="${k.haloOf(k.insetPlan(plinth, 2), 0, 0.1, P)}" style="filter:blur(3px)"/>`);
  out.push(S(k.slabOf(plinth, 0, PLINTH_H, P, 4, 0.6), { tone: "mid" }));
  out.push(D(k.corners(plinth, 2.6).map(([px, py]) => at([px, py, PLINTH_H])), { size: 0.45 }));
  out.push(S(k.cylinder(x, y, r, PLINTH_H, DISC_H, P, 72, 0.8), { tone: "hi", crease: "lo" }));
  out.push(L(k.knurl(x, y, r, PLINTH_H + 0.6, DISC_TOP - 1.2, 90, P, 0.3), { tone: "lo" }));
  out.push(L(k.ring(x, y, r - 2, DISC_TOP, P, 72), { tone: "lo" }));
  const ticks = k.radialTicks(x, y, r - 2, count, count, DISC_TOP, [2.2, 4.4], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "hi" }));
  out.push(L(k.ring(x, y, r - 7.5, DISC_TOP, P, 48), { tone: "faint" }));
  return out.join("");
}

const needleOf = (turn, x, y, r, z) => {
  const angle = turn * Math.PI * 2;
  return lineOnTop([x - Math.sin(angle) * 3.2, y + Math.cos(angle) * 3.2], [x + Math.sin(angle) * (r - 2), y - Math.cos(angle) * (r - 2)], z, P);
};
const lineOnTop = k.lineOnTop;

function rail(y, from = RAIL_FROM, to = RAIL_TO) {
  const out = [];
  out.push(S(k.slabOf({ x: from, y: y - 3, w: to - from, d: 6, r: 1 }, 0, RAIL_H, P, 3, 0.4), { tone: "mid" }));
  out.push(D([from + 5, (from + to) / 2, to - 5].map((x) => at([x, y, RAIL_H])), { size: 0.4 }));
  for (const x of [from - 5, to]) {
    out.push(S(k.slabOf({ x, y: y - 6, w: 5, d: 12, r: 1.2 }, 0, 7, P, 3, 0.5), { tone: "mid" }));
    out.push(D([at([x + 2.5, y - 3, 7]), at([x + 2.5, y + 3, 7])], { size: 0.4 }));
  }
  return out.join("");
}

// Julian and civil scales: one tick per day, a long tick on the 1st of each month.
function ruler(strip, firsts) {
  const out = [S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" })];
  const minor = [];
  const major = [];
  for (let t = T_FROM; t <= T_TO; t++) {
    const big = firsts.includes(t);
    const mid = !big && firsts.some((f) => (t - f) % 10 === 0);
    // a month line crosses the whole strip; day ticks hang from its back edge
    (big ? major : minor).push(k.lineOnTop([X(t), strip.y], [X(t), big ? strip.y + strip.d : strip.y + (mid ? 3.6 : 2)], 0.6, P));
  }
  out.push(L(minor.join(""), { tone: "lo" }), L(major.join(""), { tone: "hi" }));
  out.push(D([at([strip.x + 2, strip.y + strip.d / 2, 0.6]), at([strip.x + strip.w - 2, strip.y + strip.d / 2, 0.6])], { size: 0.45 }));
  return out.join("");
}

// Four bushing blocks gripping the rail, two each side, with a screw on each.
function bushings(body) {
  const out = [];
  const blocks = [body.x + 1.5, body.x + body.w - 6.5].flatMap((x) => [body.y + 1.5, body.y + body.d - 5.5].map((y) => [x, y]));
  for (const [x, y] of byDepth(blocks)) {
    out.push(S(k.slabOf({ x, y, w: 5, d: 4, r: 0.8 }, CAR_TOP, 1.4, P, 2, 0.3), { tone: "mid", crease: "none" }));
    out.push(D([at([x + 2.5, y + 2, CAR_TOP + 1.4])], { size: 0.38 }));
  }
  return out.join("");
}

// The moon carriage, built at t = 0: it stands on the paschal full moon.
function moon() {
  const out = [];
  const body = { x: -11, y: MOON_Y - 9, w: 22, d: 18, r: 2.5 };
  out.push(`<path class="iso-halo" d="${k.haloOf(k.insetPlan(body, 2), RAIL_H, 0.1, P)}" style="filter:blur(3px)"/>`);
  out.push(S(k.slabOf(body, RAIL_H, CAR_TOP - RAIL_H, P, 4, 0.5), { tone: "mid" }));
  out.push(bushings(body));
  out.push(S(k.cylinder(0, MOON_Y, 4.2, CAR_TOP, 2, P, 28), { tone: "mid" }));
  out.push(S(k.cylinder(0, MOON_Y, 1.6, CAR_TOP + 2, 8, P, 16), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(0, MOON_Y, 2.6, CAR_TOP + 9, 1.4, P, 20), { tone: "mid" }));
  out.push(S(G.sphereOf([0, MOON_Y, CAR_TOP + 16.4], 6.4, P), { tone: "hi" }));
  // index finger reaching toward the comb, ending on a tip pad
  out.push(S(k.slabOf({ x: -1.4, y: MOON_Y + 9, w: 2.8, d: 13, r: 0.6 }, CAR_TOP - 2, 1.4, P, 2), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(0, MOON_Y + 22, 1.8, CAR_TOP - 2.4, 2, P, 16), { tone: "mid" }));
  return out.join("");
}

// The Sunday comb, built at offset 0: pegs on every seventh day.
const PEGS = [0, 1, 2, 3, 4, 5].map((n) => 7 * n);
function comb() {
  const out = [];
  const bar = { x: X(-1.5), y: COMB_Y - 4, w: U * 37, d: 8, r: 1.5 };
  out.push(`<path class="iso-halo" d="${k.haloOf(k.insetPlan(bar, 1), RAIL_H, 0.1, P)}" style="filter:blur(3px)"/>`);
  out.push(S(k.slabOf(bar, RAIL_H, 3, P, 3, 0.4), { tone: "mid" }));
  out.push(L(k.lineOnTop([bar.x, COMB_Y], [bar.x + bar.w, COMB_Y], RAIL_H + 3, P), { tone: "faint" }));
  for (const t of PEGS) {
    out.push(S(k.cylinder(X(t), COMB_Y, 2.4, RAIL_H + 3, 1.2, P, 20), { tone: "mid" }));
    out.push(S(k.cylinder(X(t), COMB_Y, 1.5, RAIL_H + 4.2, 6, P, 16, 0.3), { tone: "hi", crease: "none" }));
  }
  const handle = [bar.x - 4, COMB_Y];
  out.push(S(k.slabOf({ x: bar.x - 4, y: COMB_Y - 1.6, w: 4, d: 3.2, r: 0.6 }, RAIL_H + 0.6, 2, P, 2), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(handle[0], handle[1], 2.8, RAIL_H, 5, P, 20), { tone: "mid" }));
  out.push(L(k.knurl(handle[0], handle[1], 2.8, RAIL_H + 0.4, RAIL_H + 4.6, 18, P), { tone: "lo" }));
  return out.join("");
}

// The Pascha carriage, built at t = 0: the one lit part; its tongue reads both scales.
function paschaCarriage() {
  const out = [];
  const body = { x: -10, y: PASCHA_Y - 8, w: 20, d: 16, r: 2.5 };
  out.push(`<path class="iso-halo" d="${k.haloOf(k.insetPlan(body, 2), RAIL_H, 0.1, P)}" style="filter:blur(3px)"/>`);
  out.push(S(k.slabOf(body, RAIL_H, CAR_TOP - RAIL_H, P, 4, 0.5), { tone: "mid" }));
  out.push(bushings(body));
  // pawl reaching back to the comb peg
  out.push(S(k.slabOf({ x: -1.6, y: COMB_Y + 3.2, w: 3.2, d: PASCHA_Y - 8 - COMB_Y - 3.2, r: 0.6 }, CAR_TOP - 1.6, 1.6, P, 2), { tone: "mid", crease: "none" }));
  // tongue over the two scales
  out.push(S(k.slabOf({ x: -1.6, y: PASCHA_Y + 8, w: 3.2, d: CIVIL.y + CIVIL.d - PASCHA_Y - 8, r: 0.6 }, 1.4, 1.2, P, 2), { tone: "hi", lit: true, crease: "none" }));
  // drop leg from the carriage's front face down to the tongue
  out.push(S(k.slabOf({ x: -2.2, y: PASCHA_Y + 7, w: 4.4, d: 3.4, r: 0.6 }, 1.4, CAR_TOP - 1.4, P, 2, 0.3), { tone: "mid", crease: "none" }));
  out.push(D([at([0, PASCHA_Y + 8.7, CAR_TOP])], { size: 0.38 }));
  out.push(S(k.cylinder(0, PASCHA_Y, 3.2, CAR_TOP, 2, P, 24), { tone: "mid" }));
  out.push(S(k.cylinder(0, PASCHA_Y, 1.8, CAR_TOP + 2, 12, P, 16), { tone: "hi", lit: true, crease: "none" }));
  out.push(S(k.cylinder(0, PASCHA_Y, 3.6, CAR_TOP + 14, 2.6, P, 28, 0.4), { tone: "hi", lit: true }));
  return out.join("");
}

const first = pascha(START);
const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A paschalion bench. Two turntables count the year round the lunar circle of 19 years and the solar circle of 28. A moon carriage stands on the paschal full moon, a comb of Sunday pegs slides to the weekday, and a lit carriage stops on the first Sunday after the full moon, reading the date on the Julian scale and, 13 days on, the civil scale.",
  body: [
    plate(),
    circle(LUNAR),
    `<path data-part="lunar" class="iso-line" data-tone="hi" data-free="start" d="${needleOf(first.c / 19, ...LUNAR.at, LUNAR.r, DISC_TOP)}" style="stroke-width:1"/>`,
    hub(LUNAR),
    circle(SOLAR),
    `<path data-part="solar" class="iso-line" data-tone="hi" data-free="start" d="${needleOf(first.s / 28, ...SOLAR.at, SOLAR.r, DISC_TOP)}" style="stroke-width:1"/>`,
    hub(SOLAR),
    rail(MOON_Y),
    `<g data-part="moon" transform="${k.translateAlong(P, [X(first.d), 0, 0])}">${moon()}</g>`,
    rail(COMB_Y, RAIL_FROM, RAIL_TO),
    `<g data-part="comb" transform="${k.translateAlong(P, [U * first.o, 0, 0])}">${comb()}</g>`,
    rail(PASCHA_Y),
    ruler(JULIAN, [11]),
    ruler(CIVIL, [-2, 28]),
    `<g data-part="pascha" transform="${k.translateAlong(P, [X(first.t), 0, 0])}">${paschaCarriage()}</g>`,
  ],
});

const readoutOf = (r) => `${r.year} · Пасха ${r.julian.day} ${MONTHS[r.julian.month]} ст. ст. = ${r.civil.day} ${MONTHS[r.civil.month]}`;

const live = `
${(await import("node:fs")).readFileSync(join(HERE, "model.mjs"), "utf8").replace(/^export /gm, "")}
const P = ${JSON.stringify(P)};
const U = ${U}, X0 = ${X0}, Z = ${DISC_TOP};
const LUNAR = ${JSON.stringify(LUNAR)}, SOLAR = ${JSON.stringify(SOLAR)};
const X = (t) => X0 + U * t;
const needleOf = ${needleOf.toString()};
const readoutOf = ${readoutOf.toString()};
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const part = (name) => svg.querySelector('[data-part="' + name + '"]');
const moon = part("moon"), comb = part("comb"), carriage = part("pascha"), lunar = part("lunar"), solar = part("solar");
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const FIRST = 1900, LAST = 2099, TOUR = [${START}, ${START + 14}];
let year = ${START}, shown = { y: year, d: ${first.d}, o: ${first.o}, t: ${first.t}, rate: 0 };
let frame = 0, last = 0, clock = 0, touring = true, visible = false, idleTimer = 0;
const follow = (from, to, dt, seconds) => (still.matches ? to : from + (to - from) * (1 - Math.exp(-dt / seconds)));
function draw() {
  moon.setAttribute("transform", translateAlong(P, [X(shown.d), 0, 0]));
  comb.setAttribute("transform", translateAlong(P, [U * shown.o, 0, 0]));
  carriage.setAttribute("transform", translateAlong(P, [X(shown.t), 0, 0]));
  lunar.setAttribute("d", needleOf(shown.y / 19, LUNAR.at[0], LUNAR.at[1], LUNAR.r, Z));
  solar.setAttribute("d", needleOf(shown.y / 28, SOLAR.at[0], SOLAR.at[1], SOLAR.r, Z));
  const text = readoutOf(pascha(year));
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuenow", String(year));
  stage.setAttribute("aria-valuetext", text);
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  if (touring) {
    clock += dt;
    const next = TOUR[0] + (Math.floor(clock / 2.8) % (TOUR[1] - TOUR[0] + 1));
    if (next !== year) year = next;
  }
  const want = pascha(year);
  shown.y = follow(shown.y, year, dt, 0.35);
  shown.d = follow(shown.d, want.d, dt, 0.3);
  shown.o = follow(shown.o, want.o, dt, 0.3);
  // the lit carriage trails the moon, then springs onto its Sunday peg
  const goal = Math.max(want.t, shown.d + 1);
  const stiff = 260, drag = still.matches ? 2 * Math.sqrt(stiff) : 24;
  for (let i = 0; i < 4; i++) { shown.rate += ((goal - shown.t) * stiff - shown.rate * drag) * dt / 4; shown.t += shown.rate * dt / 4; }
  if (still.matches) { shown.t = want.t; shown.rate = 0; }
  let settled = true;
  for (const [key, to] of [["y", year], ["d", want.d], ["o", want.o]]) {
    if (Math.abs(shown[key] - to) < 0.002) shown[key] = to; else settled = false;
  }
  if (Math.abs(want.t - shown.t) < 0.002 && Math.abs(shown.rate) < 0.01) { shown.t = want.t; shown.rate = 0; } else settled = false;
  draw();
  frame = visible && !(settled && !touring) ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
const steer = (next) => {
  touring = false;
  year = Math.min(LAST, Math.max(FIRST, Math.round(next)));
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { touring = !still.matches; clock = 0; run(); }, 4000);
  run();
};
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
if (still.matches) touring = false;
stage.addEventListener("pointermove", (event) => {
  const box = svg.getBoundingClientRect();
  const share = Math.min(1, Math.max(0, ((event.clientX - box.left) / box.width - 0.15) / 0.7));
  steer(2000 + share * 50);
});
stage.addEventListener("keydown", (event) => {
  const moves = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 19, PageDown: -19 };
  let to = null;
  if (event.key in moves) to = year + moves[event.key];
  if (event.key === "Home") to = FIRST;
  if (event.key === "End") to = LAST;
  if (to === null) return;
  event.preventDefault();
  steer(to);
});
draw();
`;

const body = k.plateHtml({
  fig: "Fig 1",
  title: "Пасхалія",
  hint: "Наведіть або ← → — рік",
  readout: readoutOf(first),
  keys: [
    { mark: "lit", label: "Каретка Пасхи: перша неділя після пасхальної повні" },
    { mark: "raised", label: "Місяць — повня: 21 березня + (19·(рік mod 19) + 15) mod 30 днів" },
    { mark: "raised", label: "Гребінець неділь зсувається з кругом сонцю (28 років)" },
    { mark: "flat", label: "Лінійки: старий стиль і новий (+13 днів у 1900–2099)" },
  ],
  caption:
    "Пасха — перша неділя після першої повні від 21 березня за юліанським календарем. Круг місяцю (19 років) ставить повню, круг сонцю (28 років) — дні тижня, тож уся пасхалія повторюється через 19 × 28 = 532 роки. Дату за старим стилем переводять на цивільну, додаючи 13 днів.",
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Пасхалія: стрілки змінюють рік" aria-valuemin="1900" aria-valuemax="2099" aria-valuenow="${START}">${svg}</div>`,
});

const name = theme === "light" ? "pascha-light.html" : "pascha.html";
writeFileSync(join(HERE, name), k.pageHtml({ title: "Пасхалія", theme, body, script: kitScript() + live }));
console.log("wrote", name);
