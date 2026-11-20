// Brand images from the Blender renders: X profile picture (1000x1000), OG/share image (1200x630), banner (1500x500).
//   NODE_PATH=<dir with puppeteer-core> node brand.cjs      (needs build/logo3d.png from logo.py and web/media/lineup.webp)
const fs = require("fs"), path = require("path");
const puppeteer = require("puppeteer-core");
const ROOT = path.join(__dirname, "..");
const b64 = (f) => "data:image/" + path.extname(f).slice(1) + ";base64," + fs.readFileSync(path.join(ROOT, f)).toString("base64");
const LOGO = b64("build/logo3d.png"), LINE = b64("web/media/lineup.webp");
const FONT = `<link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600&display=swap" rel="stylesheet">`;
const BASE = `*{margin:0;box-sizing:border-box}body{background:#000;color:#fff;font-family:"Inter Tight";overflow:hidden}`;

const pages = {
  "pfp.png": [1000, 1000, `<div style="width:1000px;height:1000px;display:grid;place-items:center;background:radial-gradient(60% 60% at 50% 42%,#2a2560 0%,#0d0b22 55%,#050508 100%)">
    <img src="${LOGO}" style="width:900px;height:900px;margin-top:40px"></div>`],
  "og.png": [1200, 630, `<div style="position:relative;width:1200px;height:630px;background:radial-gradient(70% 80% at 50% 100%,rgba(130,120,255,.32),transparent 70%),#030306">
    <div style="position:absolute;left:0;right:0;top:56px;text-align:center">
      <div style="display:inline-flex;align-items:center;gap:14px;font-size:30px;font-weight:600;letter-spacing:-.01em"><img src="${LOGO}" style="width:74px;height:74px;margin:-12px -6px -10px -10px">Botpit</div>
      <div style="font-size:62px;line-height:1.04;letter-spacing:-.04em;margin-top:26px">Watch AI trade in real time.<br><span style="color:#b8b3ff">Can it beat a monkey?</span></div>
    </div>
    <img src="${LINE}" style="position:absolute;left:50%;bottom:-24px;width:1080px;transform:translateX(-50%)"></div>`],
  "banner.png": [1500, 500, `<div style="position:relative;width:1500px;height:500px;background:radial-gradient(60% 90% at 70% 100%,rgba(130,120,255,.3),transparent 70%),#030306">
    <img src="${LINE}" style="position:absolute;right:20px;bottom:-10px;width:1000px">
    <div style="position:absolute;left:300px;top:150px;font-size:46px;line-height:1.06;letter-spacing:-.035em;width:420px">Five AIs. One monkey.<br><span style="color:#b8b3ff">Real stock tokens.</span></div></div>`],
};

(async () => {
  const b = await puppeteer.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: "new" });
  const pg = await b.newPage();
  for (const [name, [w, h, html]] of Object.entries(pages)) {
    await pg.setViewport({ width: w, height: h });
    await pg.setContent(`<html><head>${FONT}<style>${BASE}</style></head><body>${html}</body></html>`, { waitUntil: "load", timeout: 60000 });
    await pg.evaluate(() => document.fonts.ready);
    await pg.screenshot({ path: path.join(ROOT, "web/brand", name) });
  }
  await b.close();
  console.log("brand images -> web/brand");
})();
