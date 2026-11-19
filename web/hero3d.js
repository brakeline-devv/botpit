// Hero scene: glass slabs and small cubes that flow through eight formations on a 10 s loop
// (crown -> fan -> columns -> cross -> arc -> core -> wide V -> gate -> crown), with bloom.
// ?freeze=<seconds> renders one fixed moment (used to compare against the reference frame by frame).
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const host = document.getElementById("hero3d");
const params = new URLSearchParams(location.search);
const FREEZE = params.has("freeze") ? Number(params.get("freeze")) : null;
const LOOP = 10;
let lookY = 0.1;                  // raised on portrait screens so the formation sits lower
const GLOW = 0.42;                 // global emissive scale (formations use 0..4)
const N = 11;                     // slabs, index s = -5..5
const C = 5;                      // cubes, index c = -2..2

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.85;
renderer.setClearColor(0x000000, 1);
host.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
camera.position.set(0, 0.8, 20);
camera.lookAt(0, 0.1, 0);

// vertical gradient: periwinkle-white at the top, violet at the foot (the slabs in the reference)
function gradientTex(top, bottom) {
  const c = document.createElement("canvas"); c.width = 4; c.height = 256;
  const g = c.getContext("2d"), gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, top); gr.addColorStop(1, bottom);
  g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const slabTex = gradientTex("#8f97d8", "#231f52");      // base colour: dark navy-violet
const glowTex = gradientTex("#ffffff", "#8c86e0");      // what lights up when a slab glows
const slabGeo = new THREE.BoxGeometry(0.78, 4.8, 0.24);
const cubeGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);

const slabs = [], cubes = [];
for (let i = 0; i < N; i++) {
  const m = new THREE.MeshPhysicalMaterial({ map: slabTex, emissive: new THREE.Color("#eef3ff"), emissiveMap: glowTex, emissiveIntensity: 0.2,
    roughness: 0.4, metalness: 0.0, clearcoat: 0.35, clearcoatRoughness: 0.4, transparent: true, opacity: 0.94 });
  const mesh = new THREE.Mesh(slabGeo, m);
  scene.add(mesh); slabs.push(mesh);
}
for (let i = 0; i < C; i++) {
  const m = new THREE.MeshPhysicalMaterial({ color: "#7d8be0", emissive: new THREE.Color("#cfe0ff"), emissiveIntensity: 0.3, roughness: 0.35, clearcoat: 0.4 });
  const mesh = new THREE.Mesh(cubeGeo, m);
  scene.add(mesh); cubes.push(mesh);
}

scene.add(new THREE.AmbientLight(0x6f6aa8, 0.12));
const core = new THREE.PointLight(0xffffff, 8, 12, 2); core.position.set(0, -1.6, -1.2); scene.add(core);
const rimL = new THREE.DirectionalLight(0x9fb2ff, 0.55); rimL.position.set(-6, 4, 5); scene.add(rimL);
const rimR = new THREE.DirectionalLight(0xb7a6ff, 0.45); rimR.position.set(6, 3, 4); scene.add(rimR);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.85, 0.55, 0.62);
composer.addPass(bloom);
composer.addPass(new OutputPass());

/* ---------- formations: each returns the pose of slab s (or cube c) ---------- */
const sgn = (x) => (x < 0 ? -1 : x > 0 ? 1 : 0);
const P = {
  crown: { // tight cluster, tops leaning out, white light pouring from the centre
    slab: (s) => { const a = Math.abs(s); return { x: s * 0.62, y: -1.6 + (a > 3 ? -0.8 : 0), z: -a * 0.35, rx: 0, ry: -s * 0.08, rz: -sgn(s) * Math.min(a, 3) * 0.12, h: 1 - a * 0.05, g: a === 0 ? 3.2 : a === 1 ? 1.6 : a === 2 ? 0.5 : 0.12 }; },
    cube: (c) => ({ x: c * 1.15, y: -3.3 + Math.abs(c) * 0.2, z: 1, r: 0.6 + c, g: c === 0 ? 0 : 0.6, k: c === 0 ? 0.01 : 0.9 }),
  },
  fan: { // spokes of a wheel fanned out from a pivot below the frame
    slab: (s) => { const th = s * 0.23, R = s === 0 ? 2.2 : 3.6; return { x: Math.sin(th) * R, y: -6.2 + Math.cos(th) * R, z: -Math.abs(s) * 0.2, rx: 0, ry: 0, rz: -th, h: s === 0 ? 0.55 : 1, g: Math.abs(s) >= 4 ? 1.5 : Math.abs(s) === 0 ? 0.9 : 0.25 }; },
    cube: (c) => ({ x: c * 1.5, y: -2.4 - Math.abs(c) * 0.3, z: 0.6, r: 0.8 + c * 0.5, g: Math.abs(c) === 1 ? 1.4 : 0.3, k: c === 0 ? 0.5 : 0.85 }),
  },
  columns: { // upright columns spread across the stage, cubes in a row underneath
    slab: (s) => ({ x: s * 1.02, y: -0.9 + (Math.abs(s) % 2) * 0.35, z: -Math.cos(s * 0.25) * 0.5, rx: 0, ry: -s * 0.12, rz: 0, h: 0.86, g: Math.abs(s) === 5 ? 1.4 : Math.abs(s) === 3 ? 0.9 : 0.2 }),
    cube: (c) => ({ x: c * 1.6, y: -3.4, z: 1.2, r: 0.3 + c * 0.2, g: c === 0 ? 1.6 : 0.9, k: 0.95 }),
  },
  cross: { // columns lean inwards and cross behind the headline
    slab: (s) => { const a = Math.abs(s); return { x: s * 0.82, y: -1.3, z: -a * 0.25, rx: 0, ry: -s * 0.1, rz: sgn(s) * (0.2 + a * 0.035), h: 0.95, g: a >= 3 && a <= 4 ? 1.7 : a === 0 ? 0.6 : 0.3 }; },
    cube: (c) => ({ x: c * 2.6, y: -2.6 + Math.abs(c) * 0.35, z: 0.8, r: 1 + c, g: 1.4, k: c === 0 ? 0.01 : 0.85 }),
  },
  arc: { // nine slabs on an arc, all facing the camera axis (the 5 s frame of the reference)
    slab: (s) => { const th = s * 0.29, R = 6.4, a = Math.abs(s); return { x: Math.sin(th) * R, y: -0.9 - (a === 5 ? 3 : 0), z: -(1 - Math.cos(th)) * R, rx: 0, ry: -th * 0.9, rz: 0, h: a === 0 ? 1.12 : 1.02 - a * 0.015, g: a === 0 ? 2.2 : a >= 4 ? 1.1 : 0.35, o: a === 5 ? 0 : 1 }; },
    cube: (c) => ({ x: c * 2.4, y: -4.6, z: 0.5, r: c, g: 0.2, k: 0.01 }),
  },
  core: { // centre opens up to a single glowing cube, the rest step back
    slab: (s) => { const a = Math.abs(s); return { x: s * (a <= 1 ? 0.95 : 1.55), y: -1.0 - (a <= 1 ? 0 : 0.3), z: -a * 0.45, rx: 0, ry: -s * 0.14, rz: a > 2 ? -sgn(s) * 0.12 : 0, h: a === 0 ? 0.08 : 0.92, g: a === 5 ? 1.2 : 0.15, o: a === 0 ? 0 : 1 }; },
    cube: (c) => ({ x: c === 0 ? 0 : c * 1.35, y: c === 0 ? -1.9 : -1.3 - Math.abs(c) * 0.9, z: c === 0 ? 1.5 : 0.8, r: c === 0 ? 0.785 : c * 0.7, g: c === 0 ? 4 : 0.9, k: c === 0 ? 1.1 : 0.8 }),
  },
  wide: { // outer slabs swing out into a wide V, inner pair stands guard around the cube
    slab: (s) => { const a = Math.abs(s); return a <= 1
      ? { x: s * 0.95, y: -1.3, z: 0, rx: 0, ry: -s * 0.15, rz: 0, h: 0.85, g: a === 0 ? 0 : 0.35, o: a === 0 ? 0 : 1 }
      : { x: sgn(s) * (1.9 + a * 0.6), y: -1.2 + a * 0.15, z: -a * 0.3, rx: 0, ry: 0, rz: -sgn(s) * (0.32 + a * 0.05), h: 1, g: a === 3 ? 1.9 : 0.3 }; },
    cube: (c) => ({ x: c * 1.0, y: c === 0 ? -1.2 : -2.3, z: 1.2, r: 0.785 + c * 0.3, g: c === 0 ? 2.6 : 0.8, k: c === 0 ? 1 : 0.7 }),
  },
  gate: { // two white slabs as a lit gate, the rest folded low behind, light from below
    slab: (s) => { const a = Math.abs(s); return a === 1
      ? { x: s * 1.0, y: -1.7, z: 0.5, rx: 0, ry: 0, rz: 0, h: 0.8, g: 3.4 }
      : { x: sgn(s) * (1.2 + a * 0.55), y: -3.2, z: -0.8 - a * 0.2, rx: -0.3, ry: 0, rz: -sgn(s) * (0.5 + a * 0.1), h: 0.95, g: a === 0 ? 0 : 0.25, o: a === 0 ? 0 : 1 }; },
    cube: (c) => ({ x: c * 1.3, y: c === 0 ? 0.1 : -2.9, z: 0.7, r: c * 0.9, g: c === 0 ? 1.3 : 0.5, k: c === 0 ? 0.9 : 0.75 }),
  },
};
const TIMELINE = [[0, "crown"], [1.55, "fan"], [2.9, "columns"], [4.0, "cross"], [5.0, "arc"], [6.5, "core"], [7.9, "wide"], [9.1, "gate"], [10, "crown"]];
const ease = (x) => x * x * x * (x * (x * 6 - 15) + 10); // smootherstep
const lerp = (a, b, k) => a + (b - a) * k;

function poseAt(t) {
  t = ((t % LOOP) + LOOP) % LOOP;
  let i = 0; while (i < TIMELINE.length - 2 && t >= TIMELINE[i + 1][0]) i++;
  const [ta, A] = TIMELINE[i], [tb, B] = TIMELINE[i + 1];
  // hold each formation briefly, then flow to the next
  const k = ease(Math.min(1, Math.max(0, (t - ta - 0.18) / (tb - ta - 0.18))));
  return { A: P[A], B: P[B], k };
}

function apply(t) {
  const { A, B, k } = poseAt(t);
  for (let i = 0; i < N; i++) {
    const s = i - 5, a = A.slab(s), b = B.slab(s), m = slabs[i];
    const wob = Math.sin(t * 1.3 + s) * 0.03;
    m.position.set(lerp(a.x, b.x, k), lerp(a.y, b.y, k) + wob, lerp(a.z, b.z, k));
    m.rotation.set(lerp(a.rx, b.rx, k), lerp(a.ry, b.ry, k), lerp(a.rz, b.rz, k) + wob * 0.3);
    m.scale.y = lerp(a.h, b.h, k);
    m.material.emissiveIntensity = GLOW * lerp(a.g, b.g, k);
    m.material.opacity = 0.94 * lerp(a.o ?? 1, b.o ?? 1, k);
    m.visible = m.material.opacity > 0.02;
  }
  for (let i = 0; i < C; i++) {
    const c = i - 2, a = A.cube(c), b = B.cube(c), m = cubes[i];
    m.position.set(lerp(a.x, b.x, k), lerp(a.y, b.y, k) + Math.sin(t * 2 + c) * 0.06, lerp(a.z, b.z, k));
    const r = lerp(a.r, b.r, k) + t * 0.35;
    m.rotation.set(r * 0.6, r, r * 0.3);
    m.scale.setScalar(Math.max(0.001, lerp(a.k, b.k, k)));
    m.material.emissiveIntensity = GLOW * lerp(a.g, b.g, k);
  }
  // the core light breathes with the brightest formations
  const glowNow = slabs.reduce((s, m) => Math.max(s, m.material.emissiveIntensity), 0);
  core.intensity = 4 + glowNow * 6;
  camera.position.x = Math.sin((t / LOOP) * Math.PI * 2) * 0.35;
  camera.lookAt(0, lookY, 0);
}

function resize() {
  const w = host.clientWidth, h = host.clientHeight;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  bloom.resolution.set(w, h);
  camera.aspect = w / h;
  // keep the formation the same width on narrow screens
  // portrait: back off until the ~13-unit-wide formation fits the width
  camera.position.z = Math.max(20, 13 / (2 * Math.tan(THREE.MathUtils.degToRad(16)) * (w / h)));
  lookY = w / h < 1 ? 2.6 : 0.1;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(host);
resize();

let visible = true, start = performance.now();
new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(host);
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
function frame(now) {
  requestAnimationFrame(frame);
  if (!visible || window.__heroManual) return;
  const t = FREEZE != null ? FREEZE : reduce ? 5.0 : (now - start) / 1000;
  apply(t);
  composer.render();
}
requestAnimationFrame(frame);
window.__hero = { apply, render: () => composer.render() };
