// Face textures for the 3D bots: one PNG per agent x mood, drawn for the bot's screen (aspect 0.92 : 0.70).
// Robots get a glowing face (light strokes, transparent elsewhere); the monkey has no screen, so its face is ink on tan.
//   NODE_PATH=<dir with puppeteer-core> node faces.cjs
const fs = require("fs"), path = require("path");
const puppeteer = require("puppeteer-core");
const OUT = path.join(__dirname, "faces");
fs.mkdirSync(OUT, { recursive: true });

const AG = { rocket: "#ff5a36", boomer: "#5b8def", sigma: "#2fd4a3", doomer: "#a07cff", hype: "#ffc531", monkey: "#9aa3ad" };
const MOODS = ["euphoric", "confident", "calm", "nervous", "salty", "smug"];
const mix = (a, b, t) => "#" + [1, 3, 5].map((i) => Math.round(parseInt(a.substr(i, 2), 16) * (1 - t) + parseInt(b.substr(i, 2), 16) * t).toString(16).padStart(2, "0")).join("");

function parts(L, D) {
  return {
    EYES: {
      euphoric: `<path d="M32 52 Q38 43 44 52 M56 52 Q62 43 68 52" stroke="${L}" stroke-width="4.5" fill="none" stroke-linecap="round"/>`,
      confident: `<circle cx="38" cy="49" r="4.8" fill="${L}"/><circle cx="62" cy="49" r="4.8" fill="${L}"/>`,
      calm: `<rect x="34" y="45.5" width="8" height="9" rx="4" fill="${L}"/><rect x="58" y="45.5" width="8" height="9" rx="4" fill="${L}"/>`,
      nervous: `<circle cx="38" cy="50" r="5.8" fill="${L}"/><circle cx="62" cy="50" r="5.8" fill="${L}"/><circle cx="38" cy="51" r="2.6" fill="${D}"/><circle cx="62" cy="51" r="2.6" fill="${D}"/><path d="M76 34 q4 8 0 11 q-4 -3 0 -11z" fill="#9fe3ff"/>`,
      salty: `<circle cx="38" cy="51" r="4.2" fill="${L}"/><circle cx="62" cy="51" r="4.2" fill="${L}"/><path d="M30 40 L45 45 M70 40 L55 45" stroke="${L}" stroke-width="4" stroke-linecap="round"/>`,
      smug: `<path d="M32 50 L44 50 M56 50 L68 50" stroke="${L}" stroke-width="4.5" stroke-linecap="round"/><path d="M31 43 L45 41 M55 43 L69 45" stroke="${L}" stroke-width="3" stroke-linecap="round"/>`,
    },
    MOUTH: {
      euphoric: `<path d="M37 63 Q50 80 63 63 Z" fill="${L}"/>`,
      confident: `<path d="M39 64 Q50 73 61 64" stroke="${L}" stroke-width="4" fill="none" stroke-linecap="round"/>`,
      calm: `<path d="M42 67 Q50 71 58 67" stroke="${L}" stroke-width="3.6" fill="none" stroke-linecap="round"/>`,
      nervous: `<path d="M37 68 q3.25 -4 6.5 0 t6.5 0 t6.5 0 t6.5 0" stroke="${L}" stroke-width="3.4" fill="none" stroke-linecap="round"/>`,
      salty: `<path d="M40 71 Q50 62 60 71" stroke="${L}" stroke-width="4" fill="none" stroke-linecap="round"/>`,
      smug: `<path d="M41 68 Q53 71 61 62" stroke="${L}" stroke-width="4" fill="none" stroke-linecap="round"/>`,
    },
  };
}

function svg(id, mood) {
  const isMonkey = id === "monkey";
  const L = isMonkey ? "#1a120c" : mix("#ffffff", AG[id], 0.28), D = isMonkey ? "#d9a77a" : "#000000";
  const { EYES, MOUTH } = parts(L, D);
  let extra = "", eyes = EYES[mood], mouth = MOUTH[mood];
  if (id === "rocket") eyes = "";                                  // hidden behind 3D shades
  if (id === "boomer") extra = `<path d="M37 61 Q44 56 50 61 Q56 56 63 61 Q57 66 50 63 Q43 66 37 61 Z" fill="${L}" opacity=".9"/>`;
  if (id === "doomer") extra = `<path d="M31 58 Q38 61 45 58 M55 58 Q62 61 69 58" stroke="${mix("#000000", AG.doomer, 0.85)}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
  if (id === "monkey") { extra = `<circle cx="46" cy="59" r="1.9" fill="${L}"/><circle cx="54" cy="59" r="1.9" fill="${L}"/>`; mouth = `<g transform="translate(0 4)">${mouth}</g>`; }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 12 100 76" width="920" height="700">${eyes}${extra}${mouth}</svg>`;
}

(async () => {
  const b = await puppeteer.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: "new" });
  const pg = await b.newPage();
  await pg.setViewport({ width: 920, height: 700 });
  for (const id of Object.keys(AG)) for (const m of MOODS) {
    await pg.setContent(`<html><body style="margin:0;background:transparent">${svg(id, m)}</body></html>`);
    await pg.screenshot({ path: path.join(OUT, `${id}-${m}.png`), omitBackground: true, clip: { x: 0, y: 0, width: 920, height: 700 } });
  }
  await b.close();
  console.log("faces ->", OUT);
})();
