import * as THREE from 'three';
import { RoomEnvironment } from './lib/RoomEnvironment.js';
import { SharedRoom, getTopMerit } from './room.js';
import { WORK_FORTUNES } from './work-fortunes.js';
import { MILESTONES, milestoneTier } from './milestones.js';

/* =========================================================
   Chùa Hà Online 3D — game.js
   ========================================================= */

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const store = {
  get(k, d) { try { const v = localStorage.getItem('chuaha3d_' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('chuaha3d_' + k, JSON.stringify(v)); } catch (e) {} },
};

/* ---------------- Renderer / scene ---------------- */
const canvas = $('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x150809);
scene.fog = new THREE.Fog(0x150809, 22, 48);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 120);

scene.add(new THREE.HemisphereLight(0xffd9b0, 0x2a0e0a, 0.55));
const ambient = new THREE.AmbientLight(0xffb27a, 0.18);
scene.add(ambient);
const altarLight = new THREE.PointLight(0xffc46b, 45, 20, 1.5);
altarLight.position.set(0, 6, -15);
scene.add(altarLight);
const hallLight1 = new THREE.PointLight(0xff9a55, 18, 16, 1.6);
hallLight1.position.set(-7, 5.5, -2); scene.add(hallLight1);
const hallLight2 = new THREE.PointLight(0xff9a55, 18, 16, 1.6);
hallLight2.position.set(7, 5.5, -2); scene.add(hallLight2);
const hallLight3 = new THREE.PointLight(0xff9a55, 14, 16, 1.6);
hallLight3.position.set(0, 5.5, 9); scene.add(hallLight3);

/* ---------------- Helpers ---------------- */
function mat(color, opts = {}) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, ...opts });
  m.envMapIntensity = opts.envMapIntensity ?? 0.35;
  return m;
}
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); draw(x, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function mesh(geo, m, x = 0, y = 0, z = 0, parent = scene) {
  const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); parent.add(o); return o;
}

const M = {
  red: mat(0x9e1f24, { roughness: 0.55 }),
  redDark: mat(0x5e1014, { roughness: 0.6 }),
  gold: mat(0xd9a441, { metalness: 0.85, roughness: 0.32, envMapIntensity: 1.1, emissive: 0x3a2200, emissiveIntensity: 0.6 }),
  goldSoft: mat(0xe0b35a, { metalness: 0.6, roughness: 0.4, envMapIntensity: 0.9, emissive: 0x4a2c00, emissiveIntensity: 0.5 }),
  white: mat(0xf4efe6, { roughness: 0.35, envMapIntensity: 0.8, emissive: 0x3a3028, emissiveIntensity: 0.4 }),
  wood: mat(0x3b1c10, { roughness: 0.8 }),
  stone: mat(0x6f6a64, { roughness: 0.9 }),
  black: mat(0x111111, { roughness: 0.5 }),
};

/* ---------------- Hall ---------------- */
const HALL = { minX: -13.2, maxX: 13.2, minZ: -13.6, maxZ: 15.2 };

// floor
const floorTex = canvasTex(512, 512, (x, w, h) => {
  for (let i = 0; i < 8; i++) {
    x.fillStyle = `hsl(18,${40 + Math.random() * 10}%,${15 + Math.random() * 6}%)`; x.fillRect(0, i * 64, w, 64);
    x.fillStyle = 'rgba(0,0,0,.45)'; x.fillRect(0, i * 64, w, 2);
    x.fillRect(Math.random() * w, i * 64, 3, 64);
  }
  for (let k = 0; k < 600; k++) { x.fillStyle = `rgba(255,190,140,${Math.random() * 0.05})`; x.fillRect(Math.random() * w, Math.random() * h, rand(10, 80), 1); }
});
floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(5, 7);
const floor = mesh(new THREE.PlaneGeometry(30, 42), mat(0xffffff, { map: floorTex, roughness: 0.45, envMapIntensity: 0.6 }), 0, 0, -3);
floor.rotation.x = -Math.PI / 2;

// walls
const wallTex = canvasTex(512, 512, (x, w, h) => {
  x.fillStyle = '#2a120b'; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(0,0,0,${Math.random() * 0.25})`; x.fillRect(Math.random() * w, 0, 2, h); }
  // window
  const wx = 156, wy = 120, ww = 200, wh = 220;
  x.fillStyle = '#1a0805'; x.fillRect(wx - 14, wy - 14, ww + 28, wh + 28);
  const g = x.createLinearGradient(0, wy, 0, wy + wh); g.addColorStop(0, '#5b7c9a'); g.addColorStop(1, '#2c3c55');
  x.fillStyle = g; x.fillRect(wx, wy, ww, wh);
  x.strokeStyle = '#2a120b'; x.lineWidth = 9;
  for (let i = 1; i < 6; i++) { x.beginPath(); x.moveTo(wx + i * ww / 6, wy); x.lineTo(wx + i * ww / 6, wy + wh); x.stroke(); }
  x.beginPath(); x.moveTo(wx, wy + wh / 2); x.lineTo(wx + ww, wy + wh / 2); x.stroke();
  x.fillStyle = '#5a1a12'; x.fillRect(0, h - 70, w, 70);
  x.fillStyle = '#7a2a18'; x.fillRect(0, h - 74, w, 6);
});
wallTex.wrapS = THREE.RepeatWrapping; wallTex.repeat.set(5, 1);
const wallMat = mat(0xffffff, { map: wallTex, roughness: 0.85 });
const wallL = mesh(new THREE.PlaneGeometry(40, 8.5), wallMat, -14, 4.25, -3.5); wallL.rotation.y = Math.PI / 2;
const wallR = mesh(new THREE.PlaneGeometry(40, 8.5), wallMat, 14, 4.25, -3.5); wallR.rotation.y = -Math.PI / 2;
mesh(new THREE.PlaneGeometry(28, 8.5), mat(0x2a100a), 0, 4.25, -23.5);
// front wall with door
const fw = mat(0x2a120b);
mesh(new THREE.BoxGeometry(10, 8.5, 0.4), fw, -9, 4.25, 16.4);
mesh(new THREE.BoxGeometry(10, 8.5, 0.4), fw, 9, 4.25, 16.4);
mesh(new THREE.BoxGeometry(8, 3.5, 0.4), fw, 0, 6.75, 16.4);
const doorGlow = mesh(new THREE.PlaneGeometry(8, 5), new THREE.MeshBasicMaterial({ color: 0x8a6a55 }), 0, 2.5, 16.7);
doorGlow.rotation.y = Math.PI;
// steps at entrance
for (let i = 0; i < 3; i++) mesh(new THREE.BoxGeometry(9, 0.15, 0.6), M.stone, 0, -0.05 - i * 0.15, 16 + i * 0.6);

// ceiling + beams
const ceil = mesh(new THREE.PlaneGeometry(30, 42), mat(0x1c0a07), 0, 8.5, -3); ceil.rotation.x = Math.PI / 2;
for (let z = -22; z <= 16; z += 3.2) mesh(new THREE.BoxGeometry(28, 0.45, 0.35), M.red, 0, 7.6, z);
for (const x of [-12.5, -2.3, 2.3, 12.5]) mesh(new THREE.BoxGeometry(0.4, 0.5, 40), M.redDark, x, 7.3, -3.5);

// pillars
const PILLARS = [];
const pillarGeo = new THREE.CylinderGeometry(0.34, 0.38, 7.6, 20);
const baseGeo = new THREE.CylinderGeometry(0.52, 0.56, 0.35, 20);
for (const x of [-12.5, -2.3, 2.3, 12.5]) {
  for (const z of [-13, -6, 1, 8, 14.5]) {
    if (Math.abs(x) < 5 && z > -10 && z < 12) continue; // giữ lối đi giữa thoáng
    mesh(pillarGeo, M.red, x, 3.8, z);
    mesh(baseGeo, M.stone, x, 0.17, z);
    PILLARS.push({ x, z, r: 0.6 });
  }
}

// couplets on front inner pillars
function verticalText(text, w, h) {
  return canvasTex(w, h, (x) => {
    x.fillStyle = '#1b0a06'; x.fillRect(0, 0, w, h);
    x.strokeStyle = '#d9a441'; x.lineWidth = 6; x.strokeRect(6, 6, w - 12, h - 12);
    x.fillStyle = '#f2c46b'; x.font = `bold ${w * 0.62}px "Noto Serif", serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
    const chars = [...text]; const step = (h - 40) / chars.length;
    chars.forEach((c, i) => x.fillText(c, w / 2, 20 + step * (i + 0.5)));
  });
}
const cpl1 = mesh(new THREE.PlaneGeometry(0.55, 4.2), new THREE.MeshBasicMaterial({ map: verticalText('佛光普照三千界', 96, 740) }), -2.3, 4.2, -12.6);
const cpl2 = mesh(new THREE.PlaneGeometry(0.55, 4.2), new THREE.MeshBasicMaterial({ map: verticalText('法雨均霑億萬家', 96, 740) }), 2.3, 4.2, -12.6);

/* ---------------- Altar ---------------- */
const altar = new THREE.Group(); scene.add(altar);
mesh(new THREE.BoxGeometry(17, 0.35, 9.5), M.wood, 0, 0.17, -18.6, altar);
mesh(new THREE.BoxGeometry(17.2, 0.06, 0.2), M.gold, 0, 0.36, -13.9, altar);

// backdrop
mesh(new THREE.PlaneGeometry(16, 8), mat(0x6a1016, { roughness: 0.9 }), 0, 4.2, -23.3, altar);
const archHalo = mesh(new THREE.CircleGeometry(3.2, 48), new THREE.MeshBasicMaterial({ color: 0xffb550, transparent: true, opacity: 0.12 }), 0, 4.6, -23.2, altar);
for (const sx of [-1, 1]) {
  const cur = mesh(new THREE.BoxGeometry(1.4, 6.8, 0.25), mat(0x8e141b, { roughness: 0.95 }), sx * 6.2, 4.2, -22.6, altar);
  cur.rotation.z = sx * 0.04;
}
mesh(new THREE.BoxGeometry(14.5, 0.5, 0.3), M.gold, 0, 7.3, -22.5, altar);

// plaque 大雄寶殿
const plaqueTex = canvasTex(1024, 256, (x, w, h) => {
  x.fillStyle = '#1b0a06'; x.fillRect(0, 0, w, h);
  x.strokeStyle = '#d9a441'; x.lineWidth = 12; x.strokeRect(14, 14, w - 28, h - 28);
  x.fillStyle = '#f5c75e'; x.font = 'bold 150px "Noto Serif", serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('大 雄 寶 殿', w / 2, h / 2 + 6);
});
mesh(new THREE.PlaneGeometry(4.6, 1.15), new THREE.MeshBasicMaterial({ map: plaqueTex }), 0, 6.55, -22.3, altar);

// tiers
mesh(new THREE.BoxGeometry(9, 3.2, 2), M.red, 0, 1.6, -21.6, altar);
mesh(new THREE.BoxGeometry(9.1, 0.12, 2.1), M.gold, 0, 3.22, -21.6, altar);
mesh(new THREE.BoxGeometry(11, 1.5, 3), M.red, 0, 0.75, -19.2, altar);
mesh(new THREE.BoxGeometry(11.1, 0.12, 3.1), M.gold, 0, 1.52, -19.2, altar);
// front gold relief band
mesh(new THREE.BoxGeometry(10, 0.25, 0.05), M.goldSoft, 0, 1.0, -17.68, altar);

// offering table
const TABLE = { y: 1.32, z: -15.6 };
mesh(new THREE.BoxGeometry(4.4, 0.12, 1.4), M.red, 0, 1.25, TABLE.z, altar);
mesh(new THREE.BoxGeometry(4.0, 0.9, 1.1), M.redDark, 0, 0.75, TABLE.z, altar);
mesh(new THREE.BoxGeometry(3.6, 0.5, 0.04), M.goldSoft, 0, 0.85, TABLE.z + 0.57, altar);
for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(new THREE.BoxGeometry(0.15, 1.2, 0.15), M.redDark, sx * 2.05, 0.6, TABLE.z + sz * 0.6, altar);

// công đức box
const boxTex = canvasTex(256, 256, (x, w, h) => {
  x.fillStyle = '#9e1f24'; x.fillRect(0, 0, w, h);
  x.strokeStyle = '#e8b44c'; x.lineWidth = 10; x.strokeRect(20, 20, w - 40, h - 40);
  x.fillStyle = '#ffd98a'; x.font = 'bold 72px "Noto Serif", serif'; x.textAlign = 'center';
  x.fillText('功', w / 2, 110); x.fillText('德', w / 2, 190);
});
const cdBox = mesh(new THREE.BoxGeometry(1, 1.1, 0.8), [M.red, M.red, M.red, M.red, new THREE.MeshStandardMaterial({ map: boxTex }), M.red], 4.4, 0.9, -15.2, altar);

// big bell + drum stand (left)
const bellGroup = new THREE.Group(); bellGroup.position.set(-5.2, 0.35, -15.4); altar.add(bellGroup);
mesh(new THREE.BoxGeometry(1.4, 0.7, 0.9), M.redDark, 0, 0.35, 0, bellGroup);
const bowlBell = mesh(new THREE.SphereGeometry(0.42, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M.gold, -0.2, 1.12, 0, bellGroup);
bowlBell.rotation.x = Math.PI;
const moc = mesh(new THREE.SphereGeometry(0.3, 16, 12), mat(0x6a3416, { roughness: 0.5 }), 0.42, 0.95, 0, bellGroup);
moc.scale.set(1.1, 0.8, 1);

/* -------- Statues -------- */
function lotusBase(parent, r, m, y = 0) {
  mesh(new THREE.CylinderGeometry(r * 0.85, r, r * 0.3, 24), m, 0, y + r * 0.15, 0, parent);
  const pg = new THREE.SphereGeometry(1, 12, 8);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const p = mesh(pg, m, Math.sin(a) * r * 0.92, y + r * 0.32, Math.cos(a) * r * 0.92, parent);
    p.scale.set(r * 0.24, r * 0.14, r * 0.4); p.rotation.y = a; p.rotation.x = -0.5;
  }
}
function halo(parent, y, r, z) {
  const hm = new THREE.MeshBasicMaterial({ color: 0xffc860, transparent: true, opacity: 0.35, depthWrite: false });
  mesh(new THREE.CircleGeometry(r, 40), hm, 0, y, z, parent);
  const ring = mesh(new THREE.TorusGeometry(r, r * 0.05, 8, 48), M.gold, 0, y, z + 0.01, parent);
  return ring;
}
function seatedBuddha(s, m) {
  const g = new THREE.Group();
  lotusBase(g, 0.95, m);
  const legs = mesh(new THREE.SphereGeometry(1, 24, 16), m, 0, 0.55, 0, g); legs.scale.set(0.85, 0.3, 0.62);
  const torso = mesh(new THREE.LatheGeometry([new THREE.Vector2(0.56, 0), new THREE.Vector2(0.52, 0.35), new THREE.Vector2(0.42, 0.75), new THREE.Vector2(0.3, 0.95), new THREE.Vector2(0.12, 1.05), new THREE.Vector2(0, 1.06)], 24), m, 0, 0.55, 0, g);
  mesh(new THREE.SphereGeometry(0.3, 24, 18), m, 0, 1.82, 0.02, g);
  mesh(new THREE.SphereGeometry(0.15, 16, 12), m, 0, 2.1, 0, g);
  for (const sx of [-1, 1]) { const e = mesh(new THREE.SphereGeometry(0.07, 8, 8), m, sx * 0.3, 1.74, 0, g); e.scale.y = 2; }
  const hands = mesh(new THREE.SphereGeometry(0.2, 16, 12), m, 0, 0.75, 0.42, g); hands.scale.set(1.3, 0.5, 0.8);
  halo(g, 1.85, 0.55, -0.38);
  const bh = mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ color: 0xffb040, transparent: true, opacity: 0.12, depthWrite: false }), 0, 1.25, -0.45, g);
  bh.scale.set(1.05, 1.25, 1);
  g.scale.setScalar(s);
  return g;
}
function standingBodhisattva(s, m, vase) {
  const g = new THREE.Group();
  lotusBase(g, 0.55, M.gold);
  mesh(new THREE.LatheGeometry([new THREE.Vector2(0.42, 0), new THREE.Vector2(0.4, 0.3), new THREE.Vector2(0.3, 1.2), new THREE.Vector2(0.3, 1.6), new THREE.Vector2(0.2, 1.85), new THREE.Vector2(0.08, 1.95), new THREE.Vector2(0, 1.96)], 24), m, 0, 0.3, 0, g);
  mesh(new THREE.SphereGeometry(0.22, 20, 16), m, 0, 2.43, 0, g);
  mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.22, 12), M.gold, 0, 2.68, -0.02, g);
  const hand = mesh(new THREE.SphereGeometry(0.08, 10, 8), m, 0.12, 1.75, 0.3, g);
  if (vase) {
    mesh(new THREE.SphereGeometry(0.09, 12, 10), M.white, -0.18, 1.55, 0.3, g);
    mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.16, 8), M.white, -0.18, 1.68, 0.3, g);
  } else {
    const lot = mesh(new THREE.ConeGeometry(0.1, 0.16, 8), mat(0xffa3b8), -0.16, 1.7, 0.3, g); lot.rotation.x = Math.PI;
  }
  halo(g, 2.45, 0.4, -0.3);
  g.scale.setScalar(s);
  return g;
}
// A Di Đà center
const amida = seatedBuddha(1.85, M.gold); amida.position.set(0, 1.58, -19.6); altar.add(amida);
// Quan Âm (white) & Thế Chí
const quanam = standingBodhisattva(1.4, M.white, true); quanam.position.set(-3.4, 1.58, -19.3); altar.add(quanam);
const thechi = standingBodhisattva(1.4, M.gold, false); thechi.position.set(3.4, 1.58, -19.3); altar.add(thechi);
// Tam Thế Phật on top tier
for (const x of [-2.6, 0, 2.6]) { const b = seatedBuddha(0.95, M.gold); b.position.set(x, 3.28, -21.7); altar.add(b); }

// sign: chùa Hà cầu duyên (on front left of altar)
const signTex = canvasTex(512, 256, (x, w, h) => {
  x.fillStyle = '#fff3d6'; x.fillRect(0, 0, w, h);
  x.strokeStyle = '#9e1f24'; x.lineWidth = 12; x.strokeRect(10, 10, w - 20, h - 20);
  x.fillStyle = '#9e1f24'; x.textAlign = 'center';
  x.font = 'bold 54px "Noto Serif", serif'; x.fillText('CHÙA HÀ', w / 2, 100);
  x.font = 'italic 36px "Noto Serif", serif'; x.fillStyle = '#7d151b'; x.fillText('Thánh Đức tự · cầu duyên', w / 2, 168);
  x.font = '26px "Be Vietnam Pro", sans-serif'; x.fillStyle = '#a5603f'; x.fillText('tâm thành ắt linh', w / 2, 214);
});
const sign = new THREE.Group(); sign.position.set(7.2, 0, -14.6); scene.add(sign);
mesh(new THREE.BoxGeometry(0.1, 1.6, 0.1), M.wood, 0, 0.8, 0, sign);
const signBoard = mesh(new THREE.PlaneGeometry(2, 1), new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.8 }), 0, 1.9, 0.06, sign);
mesh(new THREE.BoxGeometry(2.1, 1.1, 0.08), M.wood, 0, 1.9, 0, sign);
sign.rotation.y = -0.35;
sign.position.set(3.4, 0, -15.4);
PILLARS.push({ x: 7.2, z: -14.6, r: 0.4 }, { x: 4.4, z: -15.2, r: 0.7 }, { x: -5.2, z: -15.4, r: 0.9 });

/* ---------------- Bảng công đức cạnh trái ban thờ ---------------- */
const meritBoard = new THREE.Group();
meritBoard.position.set(-8.6, 0, -14.4);
meritBoard.rotation.y = 0.18;
scene.add(meritBoard);
for (const x of [-1.65, 1.65]) {
  mesh(new THREE.BoxGeometry(0.2, 3.2, 0.24), M.wood, x, 1.6, 0, meritBoard);
  mesh(new THREE.BoxGeometry(0.85, 0.16, 0.85), M.wood, x, 0.08, 0, meritBoard);
}
mesh(new THREE.BoxGeometry(4.9, 5.5, 0.22), M.goldSoft, 0, 3.45, 0, meritBoard);
mesh(new THREE.BoxGeometry(4.76, 5.36, 0.25), M.wood, 0, 3.45, 0.02, meritBoard);
const meritBoardCanvas = document.createElement('canvas');
meritBoardCanvas.width = 1024; meritBoardCanvas.height = 1152;
const meritBoardTexture = new THREE.CanvasTexture(meritBoardCanvas);
meritBoardTexture.colorSpace = THREE.SRGBColorSpace;
meritBoardTexture.anisotropy = 4;
mesh(new THREE.PlaneGeometry(4.6, 5.2), new THREE.MeshBasicMaterial({ map: meritBoardTexture }), 0, 3.45, 0.16, meritBoard);
PILLARS.push({ x: -10.25, z: -14.4, r: 0.55 }, { x: -6.95, z: -14.4, r: 0.55 });
let meritBoardKey = '', meritBoardPlayers = [], meritBoardSelfId = '', meritBoardStatus = 'waiting';
function renderMeritBoard(players, selfId, status = 'connected', force = false) {
  const top = getTopMerit(players);
  const key = JSON.stringify([status, selfId, top.map(p => [p.id, p.name, p.merit])]);
  if (!force && key === meritBoardKey) return;
  meritBoardKey = key; meritBoardPlayers = players; meritBoardSelfId = selfId; meritBoardStatus = status;
  const ctx = meritBoardCanvas.getContext('2d');
  const bg = ctx.createLinearGradient(0, 0, 0, 1152);
  bg.addColorStop(0, '#411b12'); bg.addColorStop(1, '#1e100d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, 1024, 1152);
  ctx.strokeStyle = '#be914b'; ctx.lineWidth = 3; ctx.strokeRect(20, 20, 984, 1112);
  ctx.textAlign = 'center'; ctx.fillStyle = '#ffe2a3';
  ctx.font = 'bold 66px "Noto Serif", serif'; ctx.fillText('BẢNG CÔNG ĐỨC', 512, 126);
  ctx.font = '30px "Be Vietnam Pro", sans-serif';
  ctx.fillStyle = '#d9bc91'; ctx.fillText('TOP 5 · PHẬT TỬ TRONG PHÒNG', 512, 187);
  ctx.strokeStyle = '#806039'; ctx.beginPath(); ctx.moveTo(68, 226); ctx.lineTo(956, 226); ctx.stroke();
  ctx.textAlign = 'left'; ctx.font = '26px "Be Vietnam Pro", sans-serif'; ctx.fillText('HẠNG / PHÁP DANH', 75, 281);
  ctx.textAlign = 'right'; ctx.fillText('CÔNG ĐỨC', 950, 281);
  for (let i = 0; i < 5; i++) {
    const y = 370 + i * 130, entry = top[i];
    if (entry?.id === selfId) { ctx.fillStyle = '#65401e'; ctx.fillRect(48, y - 57, 928, 103); }
    ctx.textAlign = 'center'; ctx.fillStyle = ['#ffda76', '#e1d9c9', '#d6a179', '#bcaa91', '#bcaa91'][i];
    ctx.font = 'bold 46px "Noto Serif", serif'; ctx.fillText(String(i + 1), 100, y + 4);
    ctx.textAlign = 'left'; ctx.font = '600 34px "Be Vietnam Pro", sans-serif';
    ctx.fillStyle = entry ? '#fff1d8' : '#8c7562';
    let name = entry?.name || 'Chưa có phật tử';
    while (ctx.measureText(name).width > 490 && name.length > 1) name = name.slice(0, -2) + '…';
    ctx.fillText(name, 157, y);
    ctx.textAlign = 'right'; ctx.fillStyle = '#ffe2a3';
    ctx.font = 'bold 36px "Be Vietnam Pro", sans-serif';
    ctx.fillText(entry ? (entry.merit ?? 0).toLocaleString('vi-VN') : '—', 950, y);
  }
  ctx.textAlign = 'center'; ctx.fillStyle = '#d9bc91';
  ctx.font = '26px "Be Vietnam Pro", sans-serif';
  ctx.fillText(status === 'connected' ? 'Cập nhật trực tiếp · Chỉ tính người đang trong phòng'
    : status === 'waiting' ? 'Vào chùa để xem bảng xếp hạng' : 'Đang kết nối phòng chung…', 512, 1080);
  meritBoardTexture.needsUpdate = true;
}
renderMeritBoard([], '', 'waiting');
document.fonts?.ready?.then(() => renderMeritBoard(meritBoardPlayers, meritBoardSelfId, meritBoardStatus, true)).catch(() => {});

/* ---------------- Bảng cột mốc bên phải ban thờ ---------------- */
const milestoneBoard = meritBoard.clone();
milestoneBoard.name = 'milestoneBoard'; milestoneBoard.position.x = 8.6; milestoneBoard.rotation.y = -0.18;
const milestoneCanvas = document.createElement('canvas'); milestoneCanvas.width = 1024; milestoneCanvas.height = 1152;
const milestoneTexture = new THREE.CanvasTexture(milestoneCanvas); milestoneTexture.colorSpace = THREE.SRGBColorSpace; milestoneTexture.anisotropy = 4;
const milestoneFace = milestoneBoard.children.find(o => o.material?.map === meritBoardTexture);
milestoneFace.material = new THREE.MeshBasicMaterial({ map: milestoneTexture });
scene.add(milestoneBoard);
PILLARS.push({ x: 6.95, z: -14.4, r: 0.55 }, { x: 10.25, z: -14.4, r: 0.55 });
let milestoneBoardMerit = -1;
function renderMilestoneBoard(merit, force = false) {
  if (!force && merit === milestoneBoardMerit) return;
  milestoneBoardMerit = merit;
  const x = milestoneCanvas.getContext('2d');
  const bg = x.createLinearGradient(0, 0, 0, 1152); bg.addColorStop(0, '#411b12'); bg.addColorStop(1, '#1e100d');
  x.fillStyle = bg; x.fillRect(0, 0, 1024, 1152);
  x.strokeStyle = '#be914b'; x.lineWidth = 3; x.strokeRect(20, 20, 984, 1112);
  x.textAlign = 'center'; x.fillStyle = '#ffe2a3'; x.font = 'bold 62px "Noto Serif", serif'; x.fillText('CỘT MỐC CÔNG ĐỨC', 512, 120);
  x.fillStyle = '#d9bc91'; x.font = '30px "Be Vietnam Pro", sans-serif'; x.fillText('TÍCH ĐIỂM · MỞ KHÓA PHẦN THƯỞNG', 512, 183);
  MILESTONES.forEach((m, i) => {
    const y = 268 + i * 194, unlocked = merit >= m.merit;
    x.fillStyle = unlocked ? '#41482a' : '#311b12'; x.fillRect(48, y - 30, 928, 174);
    x.textAlign = 'left'; x.fillStyle = '#ffda76'; x.font = 'bold 38px "Be Vietnam Pro", sans-serif';
    x.fillText(`${m.merit.toLocaleString('vi-VN')} · ${m.title}`, 75, y + 12);
    x.textAlign = 'right'; x.font = '25px "Be Vietnam Pro", sans-serif'; x.fillStyle = unlocked ? '#bfe5aa' : '#b7a38c';
    x.fillText(unlocked ? 'ĐÃ ĐẠT' : 'CHƯA ĐẠT', 950, y + 10);
    x.textAlign = 'left'; x.font = '30px "Be Vietnam Pro", sans-serif'; x.fillStyle = '#fff1d8';
    m.rewards.forEach((line, j) => x.fillText(line, 75, y + 62 + j * 43));
  });
  x.textAlign = 'center'; x.fillStyle = '#d9bc91'; x.font = '27px "Be Vietnam Pro", sans-serif';
  x.fillText('Thưởng cộng dồn · Không trừ công đức', 512, 1060);
  x.fillText('Bấm nút 🏅 để xem và dùng phần thưởng', 512, 1105);
  milestoneTexture.needsUpdate = true;
}
document.fonts?.ready?.then(() => renderMilestoneBoard(milestoneBoardMerit, true)).catch(() => {});

/* ---------------- Hồ sen và nghi thức chung trong phòng ---------------- */
const pond = new THREE.Group(); pond.name = 'lotusPond'; pond.position.set(10.8, 0, 8.8); scene.add(pond);
const pondBase = mesh(new THREE.CylinderGeometry(1, 1.03, 0.2, 48), M.stone, 0, 0.1, 0, pond); pondBase.scale.set(1.95, 1, 2.85);
const water = mesh(new THREE.CircleGeometry(1, 48), mat(0x234e49, { roughness: 0.25, metalness: 0.3 }), 0, 0.205, 0, pond);
water.rotation.x = -Math.PI / 2; water.scale.set(1.8, 2.7, 1);
const pondRim = mesh(new THREE.RingGeometry(0.94, 1, 48), M.goldSoft, 0, 0.211, 0, pond);
pondRim.rotation.x = -Math.PI / 2; pondRim.scale.set(1.95, 2.85, 1);
const lotusPetalGeo = new THREE.SphereGeometry(1, 8, 6);
const lotusPink = mat(0xf0a6b4, { emissive: 0x3b101c, emissiveIntensity: 0.3 });
const lanternGold = new THREE.MeshBasicMaterial({ color: 0xffc763 });
const lanternFlameGeo = new THREE.SphereGeometry(0.07, 8, 6);
const lanternCupGeo = new THREE.CylinderGeometry(0.15, 0.1, 0.12, 12);
for (let i = 0; i < 5; i++) {
  const angle = i * 2.4, radius = i % 2 ? 1.1 : 0.7;
  const leaf = mesh(new THREE.CircleGeometry(0.29, 16), mat(0x476b44), Math.sin(angle) * radius, 0.22, Math.cos(angle) * radius * 1.5, pond);
  leaf.rotation.x = -Math.PI / 2;
  for (let j = 0; j < 7; j++) {
    const a = j * Math.PI * 2 / 7;
    const petal = mesh(lotusPetalGeo, lotusPink, leaf.position.x + Math.sin(a) * 0.1, 0.27, leaf.position.z + Math.cos(a) * 0.1, pond);
    petal.scale.set(0.07, 0.045, 0.15); petal.rotation.y = a;
  }
}
const ritualObjects = [], seenRituals = new Set();
function renderRitual(entry, live) {
  if (seenRituals.has(entry.id)) return;
  seenRituals.add(entry.id);
  if (seenRituals.size > 100) seenRituals.delete(seenRituals.values().next().value);
  const age = Math.max(0, (Date.now() - entry.time) / 1000);
  if (age > 90) return;
  const root = new THREE.Group(); root.name = entry.type === 'lamp' ? 'offeringLamp' : 'floatingLantern';
  for (let i = 0; i < 9; i++) {
    const angle = i * Math.PI * 2 / 9;
    const petal = mesh(lotusPetalGeo, entry.type === 'lamp' ? M.goldSoft : lotusPink,
      Math.sin(angle) * 0.18, 0.04, Math.cos(angle) * 0.18, root);
    petal.scale.set(0.09, 0.07, 0.2); petal.rotation.y = angle;
  }
  mesh(lanternCupGeo, M.goldSoft, 0, 0.12, 0, root);
  const flame = mesh(lanternFlameGeo, lanternGold, 0, 0.28, 0, root); flame.scale.y = 1.8;
  const phase = ritualObjects.length * 2.4;
  if (entry.type === 'lamp') { root.position.set(Math.sin(phase) * 1.25, TABLE.y, TABLE.z + 0.45); scene.add(root); }
  else { pond.add(root); }
  ritualObjects.push({ root, type: entry.type, age, phase });
  if (ritualObjects.length > 20) { const old = ritualObjects.shift(); old.root.removeFromParent(); }
  if (live) {
    feed(`🪷 ${entry.name} vừa ${entry.type === 'lamp' ? 'dâng đèn trước Phật' : 'thả hoa đăng'}`);
    if (entry.wish) floatText(entry.wish.length > 48 ? entry.wish.slice(0, 48) + '…' : entry.wish, 10.8, 1.4, 8.8, '#ffe2a3', 0.8);
  }
}
function updateRituals(dt, t) {
  for (let i = ritualObjects.length - 1; i >= 0; i--) {
    const item = ritualObjects[i]; item.age += dt;
    if (item.age > 90) { item.root.removeFromParent(); ritualObjects.splice(i, 1); continue; }
    if (item.type === 'lantern') {
      const angle = t * 0.08 + item.phase;
      item.root.position.set(Math.sin(angle) * 1.12, 0.24 + Math.sin(t * 1.8 + item.phase) * 0.015, Math.cos(angle) * 1.9);
      item.root.rotation.y = angle;
    }
    item.root.scale.setScalar(Math.min(1, (90 - item.age) / 5));
  }
}

/* -------- Candles, incense, offerings -------- */
const flames = [];
function candle(x, z, h = 0.5, parent = altar, y = TABLE.y) {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
  mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.08, 12), M.gold, 0, 0.04, 0, g);
  mesh(new THREE.CylinderGeometry(0.06, 0.06, h, 12), mat(0xc2191f, { roughness: 0.4 }), 0, h / 2 + 0.08, 0, g);
  const f = mesh(new THREE.ConeGeometry(0.045, 0.16, 10), new THREE.MeshBasicMaterial({ color: 0xffc35a }), 0, h + 0.18, 0, g);
  flames.push(f);
  return g;
}
candle(-1.75, TABLE.z, 0.6); candle(1.75, TABLE.z, 0.6);
const candleLight = new THREE.PointLight(0xffa040, 6, 6, 1.8); candleLight.position.set(0, 2.4, TABLE.z + 0.4); scene.add(candleLight);

// incense bowl
const bowl = new THREE.Group(); bowl.position.set(0, TABLE.y, TABLE.z); altar.add(bowl);
mesh(new THREE.CylinderGeometry(0.38, 0.28, 0.32, 24), M.gold, 0, 0.16, 0, bowl);
mesh(new THREE.TorusGeometry(0.38, 0.035, 8, 32), M.gold, 0, 0.32, 0, bowl).rotation.x = Math.PI / 2;
const stickTops = [];
for (let i = 0; i < 5; i++) {
  const a = rand(-0.3, 0.3), x = (i - 2) * 0.08;
  const s = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.8, 5), mat(0x9a4a2a), x, 0.7, rand(-0.05, 0.05), bowl); s.rotation.z = a * 0.4;
  const tip = mesh(new THREE.SphereGeometry(0.022, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff6a2a }), x - Math.sin(a * 0.4) * 0.4, 1.1, s.position.z, bowl);
  stickTops.push(tip);
}
// fruit & flowers fixed
function fruitPlate(x, z, parent = altar, y = TABLE.y) {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
  mesh(new THREE.CylinderGeometry(0.28, 0.12, 0.12, 16), M.gold, 0, 0.06, 0, g);
  const cols = [0xf29a2e, 0xe8c23a, 0xd94a2a, 0x7fbf3a, 0xf2a83a];
  const pos = [[0, 0.22, 0], [0.13, 0.2, 0.07], [-0.13, 0.2, 0.06], [0.05, 0.2, -0.13], [-0.06, 0.34, 0.01]];
  pos.forEach((p, i) => mesh(new THREE.SphereGeometry(0.1, 12, 10), mat(cols[i], { roughness: 0.5 }), ...p, g));
  return g;
}
function lotusFlower(x, z, parent = altar, y = TABLE.y) {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
  mesh(new THREE.CylinderGeometry(0.08, 0.11, 0.3, 12), M.white, 0, 0.15, 0, g);
  const pm = mat(0xff8fb0, { roughness: 0.5, emissive: 0x401020, emissiveIntensity: 0.3 });
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const p = mesh(new THREE.SphereGeometry(0.07, 8, 6), pm, Math.sin(a) * 0.07, 0.45, Math.cos(a) * 0.07, g);
    p.scale.set(0.8, 1.8, 0.6); p.rotation.y = a; p.rotation.x = 0.4;
  }
  mesh(new THREE.SphereGeometry(0.05, 8, 6), mat(0xffd35a), 0, 0.5, 0, g);
  return g;
}
fruitPlate(-0.85, TABLE.z - 0.2); lotusFlower(0.85, TABLE.z - 0.2);

// smoke particles
const smokeTex = canvasTex(64, 64, (x, w, h) => {
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,.8)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
});
const smoke = [];
for (let i = 0; i < 26; i++) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: 0xd8d0c8, transparent: true, opacity: 0, depthWrite: false }));
  sp.userData.t = Math.random() * 4; scene.add(sp); smoke.push(sp);
}

// lanterns
const lanterns = [];
function lantern(x, y, z) {
  const g = new THREE.Group(); g.position.set(x, y, z); scene.add(g);
  mesh(new THREE.CylinderGeometry(0.01, 0.01, 7.6 - y, 4), M.black, 0, (7.6 - y) / 2 + 0.4, 0, g);
  const body = mesh(new THREE.SphereGeometry(0.38, 18, 14), new THREE.MeshStandardMaterial({ color: 0xd8262f, emissive: 0xff3a1a, emissiveIntensity: 0.9, roughness: 0.6 }), 0, 0, 0, g);
  body.scale.y = 1.2;
  mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.08, 12), M.gold, 0, 0.45, 0, g);
  mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.08, 12), M.gold, 0, -0.45, 0, g);
  const tas = mesh(new THREE.CylinderGeometry(0.02, 0.06, 0.4, 6), mat(0xe8b44c), 0, -0.68, 0, g);
  const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: 0xff7a3a, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
  gl.scale.setScalar(2.4); g.add(gl);
  lanterns.push(g);
}
for (const x of [-7.4, 7.4]) for (const z of [-9, -2, 5, 12]) lantern(x, 5.4, z);

/* ---------------- Cushions (bồ đoàn) ---------------- */
const CUSHIONS = [];
for (const side of [-1, 1]) {
  for (let i = 0; i < 5; i++) for (let j = 0; j < 10; j++) {
    if (side === 1 && i >= 3 && j >= 7) continue; // Chừa chỗ cho hồ sen.
    CUSHIONS.push({ x: side * (3.6 + i * 1.95), z: -10.4 + j * 2.4, taken: null });
  }
}
{
  const cg = new THREE.CylinderGeometry(0.45, 0.48, 0.24, 24);
  const cm = mat(0x8c3a22, { roughness: 0.9 });
  const inst = new THREE.InstancedMesh(cg, cm, CUSHIONS.length);
  const rg = new THREE.TorusGeometry(0.42, 0.06, 8, 24);
  const rinst = new THREE.InstancedMesh(rg, mat(0x6e2814, { roughness: 0.9 }), CUSHIONS.length);
  const matTex = canvasTex(128, 128, (x, w, h) => {
    x.fillStyle = '#5a1418'; x.fillRect(0, 0, w, h);
    x.strokeStyle = '#c08a3a'; x.lineWidth = 5; x.strokeRect(8, 8, w - 16, h - 16);
    x.strokeStyle = 'rgba(192,138,58,.5)'; x.lineWidth = 2; x.strokeRect(18, 18, w - 36, h - 36);
  });
  const mg = new THREE.PlaneGeometry(1.45, 1.75);
  const minst = new THREE.InstancedMesh(mg, mat(0xffffff, { map: matTex, roughness: 0.95 }), CUSHIONS.length);
  const d = new THREE.Object3D();
  CUSHIONS.forEach((c, k) => {
    d.position.set(c.x, 0.13, c.z); d.rotation.set(0, 0, 0); d.updateMatrix(); inst.setMatrixAt(k, d.matrix);
    d.position.set(c.x, 0.25, c.z); d.rotation.set(Math.PI / 2, 0, 0); d.updateMatrix(); rinst.setMatrixAt(k, d.matrix);
    d.position.set(c.x, 0.012, c.z + 0.1); d.rotation.set(-Math.PI / 2, 0, 0); d.updateMatrix(); minst.setMatrixAt(k, d.matrix);
  });
  scene.add(inst, rinst, minst);
}

/* ---------------- Avatars ---------------- */
const ROBES = [
  { id: 'lam', name: 'Áo lam', c: 0x5d7fb0 },
  { id: 'nau', name: 'Áo nâu', c: 0x8a5a3a },
  { id: 'xam', name: 'Áo xám', c: 0x8d8d92 },
  { id: 'hong', name: 'Hồng phấn', c: 0xf0a6b4 },
  { id: 'tim', name: 'Tím nhạt', c: 0xb9a3dc },
  { id: 'trang', name: 'Trắng ngà', c: 0xeee4d0 },
  { id: 'vang', name: 'Vàng nghệ', c: 0xe0a13e },
  ...MILESTONES.filter(m => m.robe).map(m => ({ id: 'reward-' + m.merit, name: m.robeName, c: m.robe, required: m.merit })),
];
const HAIRS = [
  { id: 'troc', name: 'Đầu trọc' },
  { id: 'ngan', name: 'Tóc ngắn' },
  { id: 'bui', name: 'Búi tóc' },
  { id: 'bac', name: 'Tóc bạc' },
];
const G = {
  robe: new THREE.LatheGeometry([0, 0.5, 0.52, 0.5, 0.42, 0.3, 0.16, 0].map((r, i) => new THREE.Vector2(r, [0, 0, 0.1, 0.38, 0.66, 0.86, 0.96, 1][i])), 22),
  sash: new THREE.TorusGeometry(0.44, 0.055, 6, 24),
  beads: new THREE.TorusGeometry(0.3, 0.05, 6, 18),
  head: new THREE.SphereGeometry(0.42, 26, 20),
  hairCap: new THREE.SphereGeometry(0.445, 26, 14, 0, Math.PI * 2, 0, Math.PI * 0.56),
  bun: new THREE.SphereGeometry(0.17, 14, 12),
  eye: new THREE.SphereGeometry(0.045, 8, 8),
  blush: new THREE.CircleGeometry(0.06, 12),
  hand: new THREE.SphereGeometry(0.1, 12, 10),
  shadow: new THREE.CircleGeometry(0.55, 24),
  aura: new THREE.RingGeometry(0.6, 0.85, 40),
};
const AM = {
  skin: [mat(0xf6d2b3, { roughness: 0.6 }), mat(0xe9b994, { roughness: 0.6 }), mat(0xd9a07a, { roughness: 0.6 })],
  hair: mat(0x1a1210, { roughness: 0.55, envMapIntensity: 0.6 }),
  grey: mat(0x9a948e, { roughness: 0.6 }),
  sash: mat(0xe8b83a, { roughness: 0.5, envMapIntensity: 0.6 }),
  beads: mat(0x6b3a1a, { roughness: 0.4, envMapIntensity: 0.8 }),
  eye: new THREE.MeshBasicMaterial({ color: 0x1a0f0a }),
  blush: new THREE.MeshBasicMaterial({ color: 0xff9aa8, transparent: true, opacity: 0.6 }),
  shadow: new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false }),
  aura: new THREE.MeshBasicMaterial({ color: 0xffd36a, transparent: true, opacity: 0.0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
};
const robeMats = {};
function robeMat(c) { return robeMats[c] || (robeMats[c] = mat(c, { roughness: 0.7 })); }

function nameSprite(text, color = '#ffffff', sub = '') {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const x = c.getContext('2d');
  x.font = 'bold 46px "Be Vietnam Pro", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.lineWidth = 9; x.strokeStyle = 'rgba(0,0,0,.75)'; x.strokeText(text, 256, 50);
  x.fillStyle = color; x.fillText(text, 256, 50);
  if (sub) { x.font = '600 28px "Be Vietnam Pro", sans-serif'; x.lineWidth = 6; x.strokeText(sub, 256, 98); x.fillStyle = '#ffd98a'; x.fillText(sub, 256, 98); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
  s.scale.set(1.5, 0.375, 1);
  return s;
}

class Avatar {
  constructor({ name, robe, hair, skin = 0, isPlayer = false, level = 1, subtitle = null, rewardMerit = 0 }) {
    this.name = name; this.isPlayer = isPlayer; this.level = level; this.subtitle = subtitle;
    this.root = new THREE.Group();
    this.pivot = new THREE.Group(); this.pivot.position.y = 0.12; this.root.add(this.pivot);
    this.inner = new THREE.Group(); this.inner.position.y = -0.12; this.pivot.add(this.inner);
    this.shadow = new THREE.Mesh(G.shadow, AM.shadow); this.shadow.rotation.x = -Math.PI / 2; this.shadow.position.y = 0.02; this.root.add(this.shadow);
    this.aura = new THREE.Mesh(G.aura, AM.aura.clone()); this.aura.rotation.x = -Math.PI / 2; this.aura.position.y = 0.05; this.root.add(this.aura);
    this.robeMesh = new THREE.Mesh(G.robe, robeMat(robe)); this.inner.add(this.robeMesh);
    const sash = new THREE.Mesh(G.sash, AM.sash); sash.position.y = 0.48; sash.rotation.set(Math.PI / 2, 0.35, 0); sash.scale.set(1, 1, 1); this.inner.add(sash);
    this.sash = sash;
    const beads = new THREE.Mesh(G.beads, AM.beads); beads.position.set(0, 0.86, 0.04); beads.rotation.x = Math.PI / 2 + 0.25; this.inner.add(beads);
    const sk = AM.skin[skin % AM.skin.length];
    this.head = new THREE.Mesh(G.head, sk); this.head.position.y = 1.3; this.inner.add(this.head);
    if (hair !== 'troc') {
      const hm = hair === 'bac' ? AM.grey : AM.hair;
      const cap = new THREE.Mesh(G.hairCap, hm); cap.position.set(0, 1.31, -0.02); cap.rotation.x = -0.32; this.inner.add(cap);
      if (hair === 'bui' || hair === 'bac') { const b = new THREE.Mesh(G.bun, hm); b.position.set(0, 1.62, -0.3); this.inner.add(b); }
    }
    this.hands = [];
    for (const sx of [-1, 1]) {
      const e = new THREE.Mesh(G.eye, AM.eye); e.position.set(sx * 0.14, 1.3, 0.39); e.scale.y = 1.3; this.inner.add(e);
      const b = new THREE.Mesh(G.blush, AM.blush); b.position.set(sx * 0.24, 1.2, 0.36); b.rotation.y = sx * 0.55; this.inner.add(b);
      const h = new THREE.Mesh(G.hand, sk); h.position.set(sx * 0.05, 0.8, 0.43); h.scale.set(0.8, 1.4, 0.8); this.inner.add(h);
      this.hands.push(h);
    }
    this.tag = nameSprite(name, isPlayer ? '#ffd98a' : '#ffffff', subtitle ?? 'Hạt sen · bậc ' + level);
    this.tag.position.y = 2.15; this.root.add(this.tag);
    scene.add(this.root);

    this.state = 'stand'; // stand | walk | sit
    this.bowQueue = 0; this.bowT = 0;
    this.walkT = 0; this.aura.material.opacity = 0; this.meditating = false;
    this.cushion = null; this.phase = Math.random() * 10;
    this.rewardTier = 0; this.greetT = 0; this.petalT = 0; this.wasBowing = false;
    this.setRewards(rewardMerit);
  }
  setName(name, level) {
    this.name = name; this.level = level;
    this.root.remove(this.tag); this.tag.material.map.dispose(); this.tag.material.dispose();
    this.tag = nameSprite(name, this.isPlayer ? '#ffd98a' : '#ffffff', this.subtitle ?? `${MILESTONES[this.rewardTier - 1]?.title ?? 'Hạt sen'} · bậc ${level}`);
    this.tag.position.y = this.state === 'sit' ? 1.95 : 2.15; this.root.add(this.tag);
  }
  dispose() {
    if (this.cushion?.taken === this) this.cushion.taken = null;
    scene.remove(this.root);
    this.tag.material.map.dispose(); this.tag.material.dispose(); this.aura.material.dispose();
  }
  setLook(robe) { this.robeMesh.material = robeMat(robe); }
  setRewards(merit) {
    const tier = milestoneTier(merit);
    if (tier === this.rewardTier) return;
    this.rewardTier = tier; this.setName(this.name, this.level);
    this.aura.material.color.set(tier >= 4 ? 0xffd15c : 0xffdcb0);
    if (tier >= 1 && !this.rewardPetals) {
      this.rewardPetals = new THREE.Group(); this.root.add(this.rewardPetals);
      for (let i = 0; i < 12; i++) {
        const p = mesh(lotusPetalGeo, lotusPink, 0, 0, 0, this.rewardPetals); p.scale.set(0.045, 0.018, 0.09);
      }
      this.rewardPetals.visible = false;
    }
    if (tier >= 4 && !this.lotusHalo) {
      this.lotusHalo = new THREE.Group(); this.lotusHalo.position.y = 0.035; this.root.add(this.lotusHalo);
      for (let i = 0; i < 12; i++) {
        const angle = i * Math.PI * 2 / 12;
        const p = mesh(lotusPetalGeo, lanternGold, Math.sin(angle) * 0.77, 0, Math.cos(angle) * 0.77, this.lotusHalo);
        p.scale.set(0.13, 0.025, 0.31); p.rotation.y = angle;
      }
    }
    if (this.lotusHalo) this.lotusHalo.visible = tier >= 4;
    if (tier < 1 && this.rewardPetals) { this.petalT = 0; this.rewardPetals.visible = false; }
  }
  greet() { this.greetT = 3; }
  get pos() { return this.root.position; }
  faceTo(x, z) { this.root.rotation.y = Math.atan2(x - this.pos.x, z - this.pos.z); }
  faceAltar() { this.faceTo(0, -19); }
  sit(c) {
    this.state = 'sit'; this.cushion = c; c.taken = this;
    this.pos.set(c.x, 0.2, c.z); this.faceAltar(); this.tag.position.y = 1.95;
    this.pivot.scale.set(1.08, 0.86, 1.08); this.shadow.visible = false;
  }
  stand() {
    if (this.cushion) { this.cushion.taken = null; this.pos.z += 0.9; }
    this.cushion = null; this.state = 'stand'; this.pos.y = 0; this.tag.position.y = 2.15;
    this.pivot.scale.set(1, 1, 1); this.shadow.visible = true; this.meditating = false;
  }
  bow(n = 3) { this.bowQueue = n; this.bowT = 0; }
  get busy() { return this.bowQueue > 0; }
  update(dt, t, moving) {
    if (this.busy && !this.wasBowing && this.rewardTier >= 1) this.petalT = 4.5;
    this.wasBowing = this.busy;
    // bow animation
    let lean = 0;
    if (this.bowQueue > 0) {
      this.bowT += dt / 1.5;
      lean = Math.sin(Math.PI * Math.min(this.bowT, 1)) * (this.state === 'sit' ? 1.05 : 0.85);
      if (this.bowT >= 1) { this.bowT = 0; this.bowQueue--; if (this.onBow) this.onBow(this.bowQueue); }
    }
    this.pivot.rotation.x = lean;
    if (moving) {
      this.walkT += dt * 11;
      this.inner.position.y = -0.12 + Math.abs(Math.sin(this.walkT)) * 0.09;
      this.pivot.rotation.z = Math.sin(this.walkT) * 0.09;
    } else {
      this.inner.position.y += (-0.12 - this.inner.position.y) * Math.min(1, dt * 10);
      this.pivot.rotation.z *= 0.85;
      // idle breathing
      if (this.state !== 'walk') this.head.position.y = 1.3 + Math.sin(t * 1.6 + this.phase) * 0.012;
    }
    if (this.greetT > 0) {
      this.greetT = Math.max(0, this.greetT - dt);
      this.hands.forEach(h => { h.position.y = this.greetT > 0 ? 1.05 + Math.sin(t * 3) * 0.015 : 0.8; });
      if (!this.busy) this.pivot.rotation.x = Math.sin((3 - this.greetT) / 3 * Math.PI) * 0.18;
    }
    if (this.rewardPetals) {
      this.petalT = Math.max(0, this.petalT - dt); this.rewardPetals.visible = this.petalT > 0;
      if (this.rewardPetals.visible) this.rewardPetals.children.forEach((p, i) => {
        const angle = i * Math.PI / 6 + t * 1.3;
        p.position.set(Math.sin(angle) * 0.75, (t * 0.7 + i * 0.18) % 2, Math.cos(angle) * 0.75);
        p.rotation.set(t + i, angle, t * 0.5);
      });
    }
    if (this.lotusHalo) this.lotusHalo.rotation.y = t * 0.12;
    const target = this.meditating ? 0.55 + Math.sin(t * 2.2) * 0.2 : this.rewardTier >= 2 ? 0.25 + Math.sin(t * 2) * 0.07 : 0;
    this.aura.material.opacity += (target - this.aura.material.opacity) * Math.min(1, dt * 4);
    this.aura.scale.setScalar(1 + Math.sin(t * 2.2) * 0.06);
  }
}

/* ---------------- Floating texts ---------------- */
const floaters = [];
function floatText(text, x, y, z, color = '#ffe2a3', size = 1) {
  if (floaters.length > 40) { const f = floaters.shift(); scene.remove(f.s); f.s.material.map.dispose(); f.s.material.dispose(); }
  const c = document.createElement('canvas'); c.width = 512; c.height = 96;
  const ctx = c.getContext('2d');
  ctx.font = 'italic 600 52px "Noto Serif", serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(40,10,5,.8)'; ctx.strokeText(text, 256, 48); ctx.fillStyle = color; ctx.fillText(text, 256, 48);
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, transparent: true, depthWrite: false }));
  s.scale.set(2.6 * size, 0.49 * size, 1); s.position.set(x, y, z); scene.add(s);
  floaters.push({ s, t: 0, life: 2.4 });
}

/* ---------------- Audio ---------------- */
let actx = null, soundOn = store.get('sound', true);
function ac() {
  if (!soundOn) return null;
  try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch (e) { actx = null; }
  return actx;
}
function bellSound(base = 196, dur = 5, vol = 0.32) {
  const c = ac(); if (!c) return;
  const now = c.currentTime, out = c.createGain(); out.gain.value = vol; out.connect(c.destination);
  [[1, 1], [2.0, 0.5], [2.76, 0.32], [5.4, 0.16], [8.9, 0.07]].forEach(([r, a]) => {
    const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = base * r;
    g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(a, now + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, now + dur / (r * 0.5 + 0.5));
    o.connect(g); g.connect(out); o.start(now); o.stop(now + dur);
  });
}
function mo(vol = 0.5) { // tiếng mõ gỗ
  const c = ac(); if (!c) return;
  const now = c.currentTime;
  const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
  o.type = 'triangle'; o.frequency.setValueAtTime(820, now); o.frequency.exponentialRampToValueAtTime(520, now + 0.08);
  f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 3;
  g.gain.setValueAtTime(vol, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
  o.connect(f); f.connect(g); g.connect(c.destination); o.start(now); o.stop(now + 0.2);
}
function tick() { // tiếng hạt
  const c = ac(); if (!c) return;
  const now = c.currentTime, o = c.createOscillator(), g = c.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(1800, now); o.frequency.exponentialRampToValueAtTime(900, now + 0.03);
  g.gain.setValueAtTime(0.12, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
  o.connect(g); g.connect(c.destination); o.start(now); o.stop(now + 0.08);
}

/* ---------------- UI helpers ---------------- */
let toastT;
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600); }
function petals(n = 18) {
  for (let i = 0; i < n; i++) {
    const p = document.createElement('div'); p.className = 'petal'; p.style.left = Math.random() * 100 + 'vw';
    p.style.setProperty('--dx', rand(-100, 100) + 'px'); p.style.animationDuration = rand(4, 8) + 's'; p.style.animationDelay = rand(0, 1.5) + 's';
    p.style.background = ['#ff8fa3', '#ffb3c1', '#ffd1dc', '#ff6f8a'][i % 4]; document.body.appendChild(p); setTimeout(() => p.remove(), 10000);
  }
}
const feedQ = [];
function feed(msg) { feedQ.push(msg); }
let feedTimer = 0;
function updateFeed(dt) {
  feedTimer -= dt;
  if (feedTimer <= 0 && feedQ.length) {
    const el = $('#feed'); el.style.opacity = 0;
    const m = feedQ.shift();
    setTimeout(() => { el.textContent = m; el.style.opacity = 1; }, 250);
    feedTimer = 3.2;
  }
}
function openModal(id) { $('#' + id).classList.add('show'); }
function closeModal(id) { $('#' + id).classList.remove('show'); }
$$('[data-close]').forEach((b) => b.onclick = () => b.closest('.modal').classList.remove('show'));
$$('.modal').forEach((m) => m.addEventListener('pointerdown', (e) => { if (e.target === m && m.id !== 'start') m.classList.remove('show'); }));

/* ---------------- Profile / level ---------------- */
const P = {
  name: store.get('name', ''), robe: store.get('robe', ROBES[0].c), hair: store.get('hair', 'ngan'),
  merit: 0, beads: 0, rounds: 0, rewardMerit: 0, blocked: false,
};
// Old localStorage scores are not proof of legitimate earnings. The server restores verified points.
if (!ROBES.some(r => r.c === P.robe && (r.required ?? 0) <= P.rewardMerit)) P.robe = ROBES[0].c;
function levelOf(m) { return Math.floor(Math.sqrt(m / 12)) + 1; }
function levelMin(l) { return 12 * (l - 1) * (l - 1); }
let player;
function renderProfile() {
  const l = levelOf(P.merit), a = levelMin(l), b = levelMin(l + 1);
  $('#pName').textContent = P.name || 'Phật tử';
  $('#pLevel').textContent = `Hạt sen · bậc ${l}`;
  $('#pBar').style.width = ((P.merit - a) / (b - a) * 100).toFixed(1) + '%';
  $('#pMerit').textContent = P.merit;
  $('#pBadge').textContent = MILESTONES[milestoneTier(P.rewardMerit) - 1]?.title ?? '';
  document.body.classList.toggle('has-merit-badge', milestoneTier(P.rewardMerit) > 0);
  player?.setRewards(P.rewardMerit);
  renderMilestoneBoard(P.rewardMerit);
  renderRewards();
}
let meritRevision = -1;
function applyMeritStatus(status, live = true) {
  if (live && status.revision < meritRevision) return;
  meritRevision = status.revision;
  const before = P.merit, previousEarned = P.rewardMerit, wasBlocked = P.blocked;
  P.merit = status.merit; P.rewardMerit = status.rewardMerit;
  P.beads = status.beads; P.rounds = status.rounds; P.blocked = status.blocked;
  offerReadyAt = performance.now() + (status.offerWaitMs ?? 0);
  store.set('merit', P.merit); store.set('rewardMerit', P.rewardMerit);
  store.set('beads', P.beads); store.set('rounds', P.rounds);
  const selectedRobe = ROBES.find(r => r.c === P.robe);
  if ((selectedRobe?.required ?? 0) > P.rewardMerit) {
    P.robe = ROBES[0].c; robeSel = P.robe; store.set('robe', P.robe); player?.setLook(P.robe);
  }
  if (player && (player.name !== P.name || player.level !== levelOf(P.merit))) player.setName(P.name, levelOf(P.merit));
  renderProfile(); renderBeads(); syncStart();
  $('#pSecurity').textContent = P.blocked ? '⚠ Đã khóa tích công đức' : '';
  document.body.classList.toggle('merit-blocked', P.blocked);
  if (P.blocked) {
    stopAll(); beadAuto = false; $('#beadAuto').classList.remove('on');
    if (player) { player.pendingMeritBow = false; player.bowQueue = 0; }
    $('#milestoneCelebration').hidden = true;
    if (!wasBlocked || !live) {
      $('#integrityMessage').textContent = 'Phát hiện tích công đức bất thường. Công đức và phần thưởng đã được đưa về 0. Bạn đã bị khóa tích công đức; tải lại trang hoặc đổi tên không gỡ khóa. ' + (status.reason || '');
      $('#integrityBanner').hidden = false;
    }
    return;
  }
  if (live && P.merit > before && player) {
    floatText('+' + (P.merit - before) + ' công đức', player.pos.x, player.pos.y + 2.6, player.pos.z, '#9cf5b5', 0.7);
    if (levelOf(P.merit) > levelOf(before)) toast(`🪷 Thăng cấp: Hạt sen · bậc ${levelOf(P.merit)}`);
    const unlocked = MILESTONES.filter(m => previousEarned < m.merit && P.rewardMerit >= m.merit);
    if (unlocked.length) {
      const last = unlocked.at(-1); showMilestoneCelebration(last);
      petals(30); bellSound(330, 5, 0.25);
      feed(`🏅 ${P.name} đạt mốc ${last.merit.toLocaleString('vi-VN')} công đức · ${last.title}`);
    }
  }
  if (!live && !store.get('verifiedMeritV2', false)) {
    store.set('verifiedMeritV2', true);
    $('#integrityMessage').textContent = 'Hệ thống đã chuyển sang công đức do máy chủ xác thực. Điểm cũ lưu trên trình duyệt không thể kiểm chứng và được tính lại từ 0. Từ nay điểm và phần thưởng hợp lệ được máy chủ ghi nhận.';
    $('#integrityBanner').hidden = false;
  }
}
$('#integrityClose').onclick = () => { $('#integrityBanner').hidden = true; };
async function addMerit(action) {
  if (P.blocked) { toast('⚠ Đã khóa tích công đức do hoạt động bất thường.'); return null; }
  if (!room.ready) { toast('Chờ kết nối phòng chung để tích công đức.'); return null; }
  try { return await room.post('merit', { action }); }
  catch (error) { if (!P.blocked) toast(error.message); return null; }
}

/* ---------------- Start screen ---------------- */
let milestoneCelebrationTimer, ritualPending = false;
function showMilestoneCelebration(milestone) {
  const el = $('#milestoneCelebration');
  el.textContent = `🏅 Đạt ${milestone.merit.toLocaleString('vi-VN')} công đức · ${milestone.title}! ${milestone.rewards.join('. ')}. Bấm 🏅 để dùng phần thưởng.`;
  el.hidden = false;
  clearTimeout(milestoneCelebrationTimer);
  milestoneCelebrationTimer = setTimeout(() => { el.hidden = true; }, 6000);
}
function equipRewardRobe(milestone) {
  if (P.rewardMerit < milestone.merit) return;
  P.robe = milestone.robe; robeSel = P.robe; store.set('robe', P.robe);
  player?.setLook(P.robe); syncStart(); renderRewards();
  $('#rewardMessage').textContent = `Đã mặc áo ${milestone.robeName}.`;
}
function renderRewards() {
  const next = MILESTONES.find(m => P.rewardMerit < m.merit);
  $('#rewardProgress').textContent = next
    ? `Đã tích ${P.rewardMerit.toLocaleString('vi-VN')} · Còn ${(next.merit - P.rewardMerit).toLocaleString('vi-VN')} để đạt ${next.title}`
    : 'Bạn đã mở khóa đủ cả 4 mốc công đức!';
  const list = $('#rewardList'); list.replaceChildren();
  for (const m of MILESTONES) {
    const unlocked = P.rewardMerit >= m.merit;
    const row = document.createElement('div'); row.className = 'reward-row' + (unlocked ? ' unlocked' : '');
    const title = document.createElement('strong'); title.textContent = `${unlocked ? '✓' : '🔒'} ${m.merit.toLocaleString('vi-VN')} · ${m.title}`;
    const detail = document.createElement('div'); detail.textContent = m.rewards.join(' · '); row.append(title, detail);
    if (m.robe) {
      const button = document.createElement('button');
      button.textContent = P.robe === m.robe ? 'Đang mặc' : `Mặc áo ${m.robeName}`;
      button.disabled = !unlocked || P.robe === m.robe; button.dataset.rewardRobe = String(m.merit);
      button.onclick = () => equipRewardRobe(m); row.append(button);
    }
    list.append(row);
  }
  $('#rewardGreet').disabled = P.rewardMerit < 2000;
  $('#rewardLantern').disabled = P.rewardMerit < 3000;
  $('#rewardLamp').disabled = P.rewardMerit < 4000 || ritualPending;
  $('#releaseLantern').disabled = ritualPending;
}
$('#bRewards').onclick = () => {
  renderRewards(); $('#rewardMessage').textContent = ''; openModal('mRewards');
};
$('#rewardGreet').onclick = () => {
  if (!player || P.rewardMerit < 2000) return;
  if (player.busy) { $('#rewardMessage').textContent = 'Hãy lạy xong rồi chắp tay chào nhé.'; return; }
  player.greet(); closeModal('mRewards'); toast('🙏 Chắp tay chào mọi người');
};
$('#rewardLantern').onclick = () => {
  if (P.rewardMerit < 3000) return;
  $('#lanternForm').hidden = false; $('#lanternWish').focus();
};
async function sendRewardRitual(type) {
  if (ritualPending || !player || P.rewardMerit < (type === 'lamp' ? 4000 : 3000)) return;
  if (!room.ready) { $('#rewardMessage').textContent = 'Vào chùa và chờ kết nối phòng chung để thực hiện nghi thức.'; return; }
  ritualPending = true; renderRewards(); $('#rewardMessage').textContent = 'Đang thực hiện nghi thức…';
  try {
    await room.sync();
    await room.post('ritual', { type, wish: type === 'lantern' ? $('#lanternWish').value.trim() : '' });
    if (type === 'lamp') { player.faceAltar(); player.bow(1); }
    else { $('#lanternWish').value = ''; $('#lanternForm').hidden = true; }
    bellSound(330, 4, 0.2); petals(20);
    $('#rewardMessage').textContent = type === 'lamp' ? 'Đã dâng đèn trước Phật. Mọi người trong phòng đều thấy.' : 'Hoa đăng đã được thả xuống hồ sen bên phải cuối chùa. Mọi người trong phòng đều thấy.';
  } catch (error) { $('#rewardMessage').textContent = error.message; }
  finally { ritualPending = false; renderRewards(); }
}
$('#rewardLamp').onclick = () => sendRewardRitual('lamp');
$('#releaseLantern').onclick = () => sendRewardRitual('lantern');

let robeSel = P.robe, hairSel = P.hair;
$('#robeOpts').innerHTML = ROBES.map((r) => `<button class="opt sw" title="${r.name}" data-c="${r.c}" style="background:#${r.c.toString(16).padStart(6, '0')}"></button>`).join('');
$('#hairOpts').innerHTML = HAIRS.map((h) => `<button class="opt" data-h="${h.id}">${h.name}</button>`).join('');
function syncStart() {
  $$('#robeOpts .sw').forEach((b) => {
    const robe = ROBES.find(r => r.c === +b.dataset.c);
    b.disabled = (robe.required ?? 0) > P.rewardMerit;
    b.title = robe.name + (b.disabled ? ` · Cần ${robe.required.toLocaleString('vi-VN')} công đức` : '');
    b.classList.toggle('on', +b.dataset.c === robeSel);
  });
  $$('#hairOpts .opt').forEach((b) => b.classList.toggle('on', b.dataset.h === hairSel));
}
$('#robeOpts').onclick = (e) => { if (e.target.dataset.c) { robeSel = +e.target.dataset.c; syncStart(); } };
$('#hairOpts').onclick = (e) => { if (e.target.dataset.h) { hairSel = e.target.dataset.h; syncStart(); } };
$('#inName').value = P.name; syncStart();

let started = false;
$('#enter').onclick = () => {
  const n = $('#inName').value.trim() || 'Thích Code Dạo';
  const changedHair = player && hairSel !== P.hair;
  P.name = n; P.robe = robeSel; P.hair = hairSel;
  store.set('name', n); store.set('robe', robeSel); store.set('hair', hairSel);
  closeModal('start');
  if (!player || changedHair) {
    const old = player;
    player = new Avatar({ name: n, robe: robeSel, hair: hairSel, isPlayer: true, level: levelOf(P.merit), rewardMerit: P.rewardMerit });
    if (old) {
      player.pos.copy(old.pos); player.root.rotation.y = old.root.rotation.y;
      old.dispose();
      if (old.cushion) player.sit(old.cushion);
      player.meditating = old.meditating;
      player.bowQueue = old.bowQueue; player.bowT = old.bowT;
    }
    else { player.pos.set(rand(-1.3, 1.3), 0, rand(12.5, 14)); player.faceAltar(); }
    player.onBow = onPlayerBow;
  } else {
    player.setLook(robeSel); player.setName(n, levelOf(P.merit));
  }
  renderProfile();
  if (!started) {
    started = true; bellSound(); room.connect();
    toast('Nam mô A Di Đà Phật 🙏');
  }
};
$('#bLook').onclick = () => { $('#inName').value = P.name; robeSel = P.robe; hairSel = P.hair; syncStart(); openModal('start'); };

/* ---------------- Shared room / chat ---------------- */
const remotePlayers = new Map();
let unread = 0;
function clearRemotePlayers() {
  for (const remote of remotePlayers.values()) remote.avatar.dispose();
  remotePlayers.clear();
}
function syncRoomPlayers(players, selfId) {
  $('#online').textContent = players.length;
  renderMeritBoard(players, selfId);
  const present = new Set();
  for (const data of players) {
    if (data.id === selfId) continue;
    present.add(data.id);
    let remote = remotePlayers.get(data.id);
    if (!remote || remote.hair !== data.hair) {
      remote?.avatar.dispose();
      const avatar = new Avatar(data);
      avatar.pos.set(data.x, data.state === 'sit' ? 0.2 : 0, data.z);
      remote = { avatar, hair: data.hair };
      remotePlayers.set(data.id, remote);
    }
    const a = remote.avatar;
    if (a.name !== data.name || a.level !== data.level) a.setName(data.name, data.level);
    a.setLook(data.robe);
    a.setRewards(data.rewardMerit ?? data.merit ?? 0);
    if (data.greeting && !remote.greeting) a.greet();
    remote.greeting = data.greeting;
    if (a.cushion?.taken === a) a.cushion.taken = null;
    a.cushion = null;
    if (data.state === 'sit') {
      const cushion = CUSHIONS.find(c => Math.hypot(c.x - data.x, c.z - data.z) < 0.2);
      if (cushion && !cushion.taken) { a.cushion = cushion; cushion.taken = a; }
    }
    a.state = data.state;
    a.pivot.scale.set(data.state === 'sit' ? 1.08 : 1, data.state === 'sit' ? 0.86 : 1, data.state === 'sit' ? 1.08 : 1);
    a.shadow.visible = data.state !== 'sit';
    a.tag.position.y = data.state === 'sit' ? 1.95 : 2.15;
    a.meditating = data.meditating;
    a.bowQueue = data.bowQueue; a.bowT = data.bowT;
    remote.target = data;
  }
  for (const [id, remote] of remotePlayers) {
    if (!present.has(id)) { remote.avatar.dispose(); remotePlayers.delete(id); }
  }
}
function updateRoomPlayers(dt, t) {
  for (const { avatar: a, target } of remotePlayers.values()) {
    if (!target) continue;
    const blend = Math.min(1, dt * 14);
    a.pos.x += (target.x - a.pos.x) * blend;
    a.pos.z += (target.z - a.pos.z) * blend;
    a.pos.y += ((target.state === 'sit' ? 0.2 : 0) - a.pos.y) * blend;
    const dy = target.yaw - a.root.rotation.y;
    a.root.rotation.y += Math.atan2(Math.sin(dy), Math.cos(dy)) * blend;
    a.update(dt, t, target.state === 'walk');
  }
}
function appendChat(entry, live) {
  const log = $('#chatLog');
  const row = document.createElement('p');
  if (entry.system) {
    row.className = 'chat-system'; row.textContent = entry.text;
    if (live) feed(entry.text);
  } else {
    const name = document.createElement('strong'); name.textContent = entry.name + ': ';
    const text = document.createElement('span'); text.textContent = entry.text;
    row.append(name, text);
    if (live) {
      const a = entry.playerId === room.session?.id ? player : remotePlayers.get(entry.playerId)?.avatar;
      if (a) floatText(entry.text.length > 48 ? entry.text.slice(0, 48) + '…' : entry.text, a.pos.x, a.pos.y + 2.8, a.pos.z, '#ffffff', 0.7);
      if ($('#chat').hidden) { unread++; $('#bChat').textContent = '💬 ' + unread; }
    }
  }
  const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 40;
  log.appendChild(row);
  while (log.children.length > 100) log.firstElementChild.remove();
  if (atBottom) log.scrollTop = log.scrollHeight;
}
const room = new SharedRoom({
  getState: () => ({
    name: P.name, robe: P.robe, hair: P.hair, greeting: player.greetT > 0,
    x: player.pos.x, z: player.pos.z,
    yaw: Math.atan2(Math.sin(player.root.rotation.y), Math.cos(player.root.rotation.y)),
    state: player.state, meditating: player.meditating, bowQueue: player.bowQueue, bowT: player.bowT,
  }),
  onPlayers: syncRoomPlayers,
  onChat: appendChat,
  onRitual: renderRitual,
  onMerit: applyMeritStatus,
  onStatus: status => {
    $('#roomStatus').textContent = status === 'outdated' ? 'Có bản mới · Hãy tải lại trang' : status === 'connected' ? 'Phòng chung · Đã kết nối' : status === 'connecting' ? 'Đang vào phòng chung…' : 'Mất kết nối · Đang thử lại…';
    $('#roomStatus').dataset.status = status;
    $('#chatSend').disabled = status !== 'connected';
    if (status !== 'connected') { $('#online').textContent = '—'; clearRemotePlayers(); renderMeritBoard([], '', status); }
  },
});
function toggleChat(open) {
  $('#chat').hidden = !open;
  $('#bChat').setAttribute('aria-expanded', String(open));
  if (open) {
    unread = 0; $('#bChat').textContent = '💬';
    $('#chatLog').scrollTop = $('#chatLog').scrollHeight;
    $('#chatInput').focus();
  } else $('#chatInput').blur();
}
$('#bChat').onclick = () => toggleChat($('#chat').hidden);
$('#chatClose').onclick = () => toggleChat(false);
$('#chatInput').addEventListener('focus', () => { for (const code in keys) keys[code] = false; joy.x = joy.y = 0; });
$('#chatForm').onsubmit = async event => {
  event.preventDefault();
  if (!started) { $('#chatError').textContent = 'Bấm “Vào chùa” trước khi trò chuyện nhé.'; return; }
  const input = $('#chatInput'), text = input.value.trim();
  if (!text || $('#chatSend').disabled) return;
  $('#chatSend').disabled = true; $('#chatError').textContent = '';
  try { await room.chat(text); if (input.value.trim() === text) input.value = ''; }
  catch (error) { $('#chatError').textContent = error.message; }
  finally { $('#chatSend').disabled = !room.ready; }
};

/* ---------------- Input ---------------- */
const keys = {};
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  keys[e.code] = true;
  if (e.code === 'Space') { e.preventDefault(); if (beadMode) beadTap(); }
  if (e.code === 'KeyE') $('#sitBtn').click();
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
addEventListener('blur', () => { for (const code in keys) keys[code] = false; joy.x = joy.y = 0; });

const joy = { x: 0, y: 0, id: null };
const joyEl = $('#joy'), knob = joyEl.querySelector('i');
joyEl.addEventListener('pointerdown', (e) => { joy.id = e.pointerId; joyEl.setPointerCapture(e.pointerId); joyMove(e); });
joyEl.addEventListener('pointermove', (e) => { if (e.pointerId === joy.id) joyMove(e); });
const joyEnd = (e) => { if (e.pointerId === joy.id) { joy.id = null; joy.x = joy.y = 0; knob.style.transform = ''; } };
joyEl.addEventListener('pointerup', joyEnd); joyEl.addEventListener('pointercancel', joyEnd);
function joyMove(e) {
  const r = joyEl.getBoundingClientRect(), R = r.width / 2;
  let dx = e.clientX - (r.left + R), dy = e.clientY - (r.top + R);
  const d = Math.hypot(dx, dy), m = R * 0.6;
  if (d > m) { dx = dx / d * m; dy = dy / d * m; }
  knob.style.transform = `translate(${dx}px,${dy}px)`;
  joy.x = dx / m; joy.y = -dy / m;
}

const cam = { yaw: 0, pitch: 0.5, dist: 8.5 };
const drag = new Map();
let pinchD = 0;
canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); drag.set(e.pointerId, { x: e.clientX, y: e.clientY }); });
canvas.addEventListener('pointermove', (e) => {
  const p = drag.get(e.pointerId); if (!p) return;
  if (drag.size === 2) {
    const [a, b] = [...drag.values()];
    p.x = e.clientX; p.y = e.clientY;
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinchD) cam.dist = clamp(cam.dist * (pinchD / d), 3, 15);
    pinchD = d; return;
  }
  cam.yaw -= (e.clientX - p.x) * 0.006;
  cam.pitch = clamp(cam.pitch + (e.clientY - p.y) * 0.004, 0.08, 1.25);
  p.x = e.clientX; p.y = e.clientY;
});
const dragEnd = (e) => { drag.delete(e.pointerId); pinchD = 0; };
canvas.addEventListener('pointerup', dragEnd); canvas.addEventListener('pointercancel', dragEnd);
canvas.addEventListener('wheel', (e) => { e.preventDefault(); cam.dist = clamp(cam.dist * (1 + Math.sign(e.deltaY) * 0.1), 3, 15); }, { passive: false });
$('#zIn').onclick = () => cam.dist = clamp(cam.dist * 0.85, 3, 15);
$('#zOut').onclick = () => cam.dist = clamp(cam.dist * 1.18, 3, 15);
$('#bCam').onclick = () => { cam.yaw = player ? player.root.rotation.y + Math.PI : 0; cam.pitch = 0.5; cam.dist = 8.5; };
$('#bHelp').onclick = () => openModal('mHelp');
const syncSound = () => $('#bSound').textContent = soundOn ? '🔊' : '🔇';
$('#bSound').onclick = () => { soundOn = !soundOn; store.set('sound', soundOn); syncSound(); }; syncSound();

/* ---------------- Player actions ---------------- */
let nearCushion = null, beadMode = false, beadAuto = false, beadAutoT = 0;
let chanting = false, chantT = 0, chantIdx = 0;
let medStart = 0, medAcc = 0;
const CHANT = ['Nam', 'mô', 'A', 'Di', 'Đà', 'Phật'];

function stopAll(except) {
  if (except !== 'chant' && chanting) { chanting = false; setOn('chant', false); }
  if (except !== 'medi' && player && player.meditating) { player.meditating = false; setOn('medi', false); $('#medi').style.display = 'none'; }
}
function setOn(a, on) { const b = $(`.act[data-a="${a}"]`); if (b) b.classList.toggle('on', on); }

function onPlayerBow(left) {
  bellSound(220 + Math.random() * 10, 3, 0.18);
  if (left === 0 && player.pendingMeritBow) {
    player.pendingMeritBow = false; addMerit('bow');
    feed(`🙇 ${P.name} vừa thành tâm lạy Phật 3 lạy`);
  }
}

const ACTIONS = {
  bow() {
    if (player.busy) return;
    stopAll(); player.pendingMeritBow = true; player.faceAltar(); player.bow(3);
    toast('Thành tâm 3 lạy 🙏');
  },
  beads() {
    beadMode = !beadMode; setOn('beads', beadMode);
    $('#beads').style.display = beadMode ? 'flex' : 'none';
    if (!beadMode) { beadAuto = false; $('#beadAuto').classList.remove('on'); }
    renderBeads();
  },
  chant() {
    chanting = !chanting; setOn('chant', chanting); chantT = 0; chantIdx = 0;
    if (chanting) { stopAll('chant'); toast('Gõ mõ tụng niệm · bấm lần nữa để dừng'); }
  },
  medi() {
    if (player.meditating) { stopAll(); return; }
    stopAll('medi');
    if (!player.cushion) {
      if (nearCushion) player.sit(nearCushion);
      else toast('Đang thiền tại chỗ — ngồi bồ đoàn sẽ thoải mái hơn');
    }
    player.meditating = true; medStart = performance.now(); medAcc = 0;
    setOn('medi', true); $('#medi').style.display = 'block'; bellSound(174, 6, 0.25);
  },
  offer() { openModal('mOffer'); },
  que() {
    $('#qName').value = $('#qName').value || P.name;
    openModal('mQue');
    $('.tab[data-t="que"]').click();
  },
};
$$('.act').forEach((b) => b.onclick = () => { if (player) ACTIONS[b.dataset.a](); });

function renderBeads() { $('#beadCnt').textContent = `${P.beads} / 108`; }
let beadRequestPending = false, lastBeadTap = -Infinity;
async function beadTap() {
  if (!player || beadRequestPending || performance.now() - lastBeadTap < 250) return;
  lastBeadTap = performance.now(); beadRequestPending = true;
  try {
    const result = await addMerit('bead');
    if (!result) return;
    tick();
    if (P.beads % 9 === 0) floatText('A Di Đà Phật', player.pos.x, player.pos.y + 2.6, player.pos.z, '#ffe2a3', 0.6);
    if (result.awarded === 20) {
      bellSound(); petals(20); toast(`📿 Tròn chuỗi 108 hạt (lần thứ ${P.rounds})`);
      feed(`📿 ${P.name} vừa tròn một chuỗi 108 hạt`);
    }
  } finally { beadRequestPending = false; }
}
$('#beadTap').onclick = beadTap;
$('#beadAuto').onclick = () => { beadAuto = !beadAuto; $('#beadAuto').classList.toggle('on', beadAuto); };
$('#beadClose').onclick = () => ACTIONS.beads();

$('#sitBtn').onclick = () => {
  if (!player) return;
  if (player.state === 'sit') { stopAll(); player.stand(); }
  else if (nearCushion) { player.sit(nearCushion); toast('Đã ngồi xuống bồ đoàn'); }
};

// Dâng lễ
let offerPending = false, offerReadyAt = 0;
const offerings = [];
const OFFER_NAMES = { lotus: 'hoa sen', fruit: 'mâm quả', incense: 'nén hương', candle: 'đôi nến' };
$$('.offer button').forEach((b) => b.onclick = async () => {
  if (offerPending || !player) return;
  if (performance.now() < offerReadyAt) { toast(`Chờ ${Math.ceil((offerReadyAt - performance.now()) / 1000)} giây để dâng lễ tiếp.`); return; }
  offerPending = true;
  const reward = await addMerit('offer');
  offerPending = false;
  if (!reward) return;
  const k = b.dataset.o; closeModal('mOffer');
  if (offerings.length >= 10) { const o = offerings.shift(); altar.remove(o); }
  const x = rand(-1.5, 1.5), z = TABLE.z + rand(0.15, 0.5);
  let o;
  if (k === 'lotus') o = lotusFlower(x, z);
  else if (k === 'fruit') o = fruitPlate(x, z);
  else if (k === 'candle') { o = new THREE.Group(); altar.add(o); o.add(candle(-0.15, 0, 0.35, o, 0), candle(0.15, 0, 0.35, o, 0)); o.position.set(x, TABLE.y, z); }
  else { o = new THREE.Group(); o.position.set(x, TABLE.y, z); altar.add(o);
    mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.12, 12), M.gold, 0, 0.06, 0, o);
    for (let i = 0; i < 3; i++) { mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.5, 5), mat(0x9a4a2a), (i - 1) * 0.04, 0.35, 0, o); mesh(new THREE.SphereGeometry(0.018, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff6a2a }), (i - 1) * 0.04, 0.6, 0, o); }
  }
  o.scale.setScalar(0.01); o.userData.grow = 0; offerings.push(o);
  stopAll(); player.pendingMeritBow = false; player.faceAltar(); player.bow(1);
  bellSound(247, 4, 0.25); petals(10);
  feed(`🪷 ${P.name} vừa dâng ${OFFER_NAMES[k]}`); toast(`Đã dâng ${OFFER_NAMES[k]} lên Phật 🙏`);
});

/* ---------------- Cầu duyên: khấn + quẻ ---------------- */
const TRAITS = ['hiểu mình', 'chân thành', 'biết nấu ăn', 'hiếu thảo', 'vui tính', 'chung chí hướng', 'không ghen vô lý', 'rep tin nhắn nhanh', 'chịu được mình deploy tối thứ Sáu', 'không push thẳng lên main'];
let meritNoticeTimer;
function canDrawLoveFortune() {
  if (Number.isFinite(P.merit) && P.merit >= 50) return true;
  const current = Number.isFinite(P.merit) ? Math.max(0, P.merit) : 0;
  const notice = $('#meritNotice');
  notice.textContent = `Cần đủ 50 công đức để rút quẻ cầu duyên. Bạn có ${current} công đức, còn thiếu ${50 - current}. Hãy lạy Phật, lần hạt hoặc thiền để tích thêm công đức nhé!`;
  notice.hidden = false;
  clearTimeout(meritNoticeTimer);
  meritNoticeTimer = setTimeout(() => { notice.hidden = true; }, 5000);
  return false;
}
$('#traits').innerHTML = TRAITS.map((t) => `<button class="opt">${t}</button>`).join('');
$('#traits').onclick = (e) => { if (e.target.classList.contains('opt')) e.target.classList.toggle('on'); };
$$('.tab').forEach((b) => b.onclick = () => {
  if (b.dataset.t === 'que' && !canDrawLoveFortune()) return;
  $$('.tab').forEach((x) => x.classList.toggle('on', x === b));
  $('#tPray').style.display = b.dataset.t === 'pray' ? 'block' : 'none';
  $('#tQue').style.display = b.dataset.t === 'que' ? 'block' : 'none';
  $('#tWork').style.display = b.dataset.t === 'work' ? 'block' : 'none';
});
const CAN = ['Canh', 'Tân', 'Nhâm', 'Quý', 'Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ'], CHI = ['Thân', 'Dậu', 'Tuất', 'Hợi', 'Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi'];
const canChi = (y) => { y = parseInt(y, 10); return y ? CAN[y % 10] + ' ' + CHI[y % 12] : ''; };
function copy(txt) { try { navigator.clipboard.writeText(txt).then(() => toast('Đã chép ✓'), () => toast('Trình duyệt chặn chép — bôi đen để copy')); } catch (e) { toast('Trình duyệt chặn chép — bôi đen để copy'); } }
let prayedToday = false;
$('#doPray').onclick = () => {
  const name = $('#qName').value.trim() || P.name || 'con', y = $('#qYear').value.trim(), cc = canChi(y), addr = $('#qAddr').value.trim();
  const traits = $$('#traits .opt.on').map((b) => b.textContent), wish = $('#qWish').value.trim();
  const d = new Date();
  let t = `Nam mô A Di Đà Phật! (3 lần)\n\nCon lạy chín phương Trời, mười phương chư Phật, chư Phật mười phương.\nCon kính lạy Đức Phật, Đức Thánh Mẫu, chư vị Tôn thần nơi Thánh Đức tự.\n\nHôm nay là ngày ${d.getDate()} tháng ${d.getMonth() + 1} năm ${d.getFullYear()}, tín chủ con là ${name}${cc ? `, sinh năm ${y} (${cc})` : ''}${addr ? `, ngụ tại ${addr}` : ''}.\nThành tâm sắm lễ hương hoa, kính dâng trước án, cúi xin chư vị chứng giám.\n\nCon xin cầu cho duyên lành sớm đến, gặp được người ${traits.length ? traits.join(', ') : 'tâm đầu ý hợp'}.`;
  if (wish) t += `\nCon xin khấn thêm: ${wish}`;
  t += `\n\nCúi xin chư vị phù hộ độ trì, cho lòng thành được thấu, duyên lành được nên.\nNam mô A Di Đà Phật! 🙏`;
  $('#prayOut').innerHTML = '<div class="prayer"></div><button class="btn ghost" id="cpPray">📋 Chép lời khấn</button> <button class="btn" id="toQue">🎋 Xin quẻ</button>';
  $('#prayOut .prayer').textContent = t;
  $('#cpPray').onclick = () => copy(t);
  $('#toQue').onclick = () => $('.tab[data-t="que"]').click();
  bellSound(262, 3, 0.25); petals(12);
  player.pendingMeritBow = false; player.faceAltar(); player.bow(1);
  if (!prayedToday) {
    addMerit('pray').then(result => { if (result) prayedToday = true; });
    feed(`💌 ${P.name} vừa khấn cầu duyên`);
  }
};
const QUE = [
  { lvl: 'Thượng cát', title: 'Hồng tuyến tự liên', tho: 'Chỉ hồng đã buộc từ lâu,\nNgười ở rất gần, chẳng đâu xa vời.', giai: 'Người hợp với bạn đang ở trong vòng quen biết — đồng nghiệp, bạn của bạn, hoặc ai đó hay tương tác. Để ý người hỏi han bạn đều đặn.', lam: 'Nhận lời một buổi cà phê, đi đám cưới bạn bè.', thoi: 'Trong 3 tháng tới' },
  { lvl: 'Thượng cát', title: 'Xuân phong đắc ý', tho: 'Gió xuân thổi mở cánh đào,\nDuyên lành đến sớm, cớ nào chần chừ.', giai: 'Vận đào hoa đang lên. Ai đó đã có thiện cảm nhưng chờ bạn cho tín hiệu.', lam: 'Chủ động nhắn trước một lần. Không mất gì cả.', thoi: 'Trước Tết' },
  { lvl: 'Thượng cát', title: 'Nguyệt viên nhân viên', tho: 'Trăng tròn người cũng vẹn tròn,\nTâm thành thì bến vẫn còn chờ ta.', giai: 'Mối quan hệ hiện tại (nếu có) rất bền. Nếu chưa có, người tới sẽ là người tử tế, chín chắn.', lam: 'Giữ sự chân thành, đừng thử lòng người khác.', thoi: 'Mùa trăng rằm' },
  { lvl: 'Đại cát', title: 'Song yến quy sào', tho: 'Đôi chim yến lại về tổ,\nHai lòng một ý, sóng vỗ thuyền yên.', giai: 'Quẻ rất tốt cho chuyện cưới hỏi, ra mắt gia đình. Hai bên gia đình thuận.', lam: 'Nói chuyện tương lai thẳng thắn với người ấy.', thoi: 'Năm nay' },
  { lvl: 'Trung cát', title: 'Thủy đáo cừ thành', tho: 'Nước chảy đá mòn chẳng vội,\nDuyên kia rồi tới khi tôi đủ đầy.', giai: 'Duyên đến muộn một chút nhưng chắc. Đây là lúc lo cho bản thân: sức khỏe, sự nghiệp, ngoại hình.', lam: 'Đầu tư cho mình — tập thể dục, học thêm một kỹ năng.', thoi: 'Khoảng 6–12 tháng' },
  { lvl: 'Trung cát', title: 'Cựu lộ tân hoa', tho: 'Đường xưa nay nở hoa mới,\nNgười quen ngày cũ, chuyện đời đổi thay.', giai: 'Một người cũ (bạn học, người từng quen) có thể quay lại với hình ảnh khác. Cân nhắc kỹ, đừng lặp lại lỗi cũ.', lam: 'Đi họp lớp. Nhưng tỉnh táo nhé.', thoi: 'Dịp hội họp cuối năm' },
  { lvl: 'Trung cát', title: 'Lữ trung ngộ hữu', tho: 'Lên đường gặp kẻ chung đường,\nMột câu chào hỏi, thành thương lúc nào.', giai: 'Duyên nằm ở những chuyến đi, khóa học, hoạt động nhóm. Ngồi nhà thì khó gặp.', lam: 'Tham gia một CLB, lớp học hoặc chuyến đi.', thoi: 'Khi bạn ra ngoài nhiều hơn' },
  { lvl: 'Trung bình', title: 'Vân già nguyệt ảnh', tho: 'Mây che bóng nguyệt đôi phần,\nĐợi khi mây tạnh, ánh trăng lại về.', giai: 'Hiện có chút trở ngại: hiểu lầm, khoảng cách, hoặc bạn quá bận. Không phải không có duyên, chỉ là chưa tới lúc.', lam: 'Bớt OT. Trả lời tin nhắn người ta đi 😄', thoi: 'Sau khi xong việc lớn đang làm' },
  { lvl: 'Trung bình', title: 'Kính trung khán hoa', tho: 'Hoa trong gương đẹp mà xa,\nChớ mơ người ảo, bỏ qua người gần.', giai: 'Bạn đang để ý một người khó với tới, hoặc chỉ quen qua mạng. Nhìn lại những người thật quanh mình.', lam: 'Bớt lướt, gặp mặt nhiều hơn.', thoi: 'Khi buông được hình mẫu lý tưởng' },
  { lvl: 'Thượng cát', title: 'Commit hợp nhất', tho: 'Hai nhánh rẽ rồi cũng nhập,\nMerge không xung đột, tình đắp thêm bền.', giai: 'Quẻ dành riêng cho dân code: hai người khác biệt nhưng bổ sung cho nhau. Conflict nhỏ, resolve dễ.', lam: 'Review lẫn nhau nhẹ nhàng, đừng force push cảm xúc.', thoi: 'Sprint tới' },
  { lvl: 'Trung cát', title: 'Bug tại tâm', tho: 'Lỗi chẳng ở người ta đâu,\nDebug từ dạ, duyên sau tự thành.', giai: 'Điều cản duyên là thói quen của chính mình: ngại giao tiếp, quá kén, hay ở nhà. Sửa một chút là chạy.', lam: 'Viết ra 3 điều mình thật sự cần ở người kia — bỏ bớt phần còn lại.', thoi: 'Ngay khi bạn sửa xong' },
  { lvl: 'Đại cát', title: 'Thiên định lương duyên', tho: 'Trời đã định, đất đã an,\nMột lời thành ý, muôn vàn duyên sinh.', giai: 'Quẻ rất hiếm. Duyên của bạn đã gần chín. Người phù hợp có thể xuất hiện ở nơi không ngờ nhất.', lam: 'Cứ sống tốt, cười nhiều, để ý xung quanh.', thoi: 'Rất gần' },
  { lvl: 'Trung bình', title: 'Hoa khai hữu thì', tho: 'Hoa nở có mùa, quả có thì,\nVội vàng hái sớm, ích gì hỡi ai.', giai: 'Đừng vội. Mối đang có cần thêm thời gian tìm hiểu, đừng gấp quyết định lớn.', lam: 'Hẹn hò chậm lại, quan sát người ấy khi có chuyện khó.', thoi: 'Qua vài mùa' },
  { lvl: 'Thượng cát', title: 'Lương nhân tại vọng', tho: 'Ngoảnh lại thấy người đứng chờ,\nBao lâu thầm lặng, chẳng ngờ là duyên.', giai: 'Có người đã thích bạn từ lâu mà bạn không để ý. Thường là người rất hay giúp đỡ bạn.', lam: 'Cảm ơn người hay giúp mình — bằng một bữa ăn.', thoi: 'Tháng này' },
];
$('#doShake').onclick = () => {
  if ($('#doShake').disabled || !canDrawLoveFortune()) return;
  $('#doShake').disabled = true;
  $('#queOut').innerHTML = '<div class="sub" style="text-align:center;margin-top:12px">🎋 Lóc cóc… lóc cóc…</div>'; $('#coinBox').style.display = 'none';
  let n = 0; const iv = setInterval(() => { mo(0.35); if (++n > 6) clearInterval(iv); }, 200);
  setTimeout(() => {
    const i = Math.floor(Math.random() * QUE.length), q = QUE[i];
    $('#queOut').innerHTML = `<div class="que"><span class="num">Quẻ số ${i + 1}</span><span class="lvl">${q.lvl}</span><h3>${q.title}</h3><div class="tho">${q.tho}</div><dl><dt>Lời giải</dt><dd>${q.giai}</dd><dt>Nên làm</dt><dd>${q.lam}</dd><dt>Thời điểm</dt><dd>${q.thoi}</dd></dl></div><button class="btn ghost" id="cpQue">📋 Chép quẻ để khoe</button>`;
    $('#cpQue').onclick = () => copy(`🎋 Quẻ duyên số ${i + 1} — ${q.title} (${q.lvl})\n${q.tho}\n\nLời giải: ${q.giai}\nNên làm: ${q.lam}\nThời điểm: ${q.thoi}\n\n— Xin tại Chùa Hà Online 3D 🙏`);
    $('#coinBox').style.display = 'block'; $('#coinMsg').textContent = ''; $('#c1').textContent = '?'; $('#c2').textContent = '?';
    bellSound(300, 2.5, 0.2);
    if (q.lvl.includes('cát')) petals(q.lvl === 'Đại cát' ? 30 : 14);
    feed(`🎋 ${P.name} vừa xin được quẻ ${q.lvl}`);
    addMerit('fortune');
    $('#doShake').disabled = false;
  }, 1500);
};
$('#doWorkShake').onclick = () => {
  const button = $('#doWorkShake');
  if (button.disabled || !player) return;
  button.disabled = true;
  $('#workQueOut').textContent = '🎋 Đang lắc ống xăm công việc…';
  let taps = 0;
  const sound = setInterval(() => { mo(0.35); if (++taps >= 6) clearInterval(sound); }, 200);
  setTimeout(() => {
    const index = Math.floor(Math.random() * WORK_FORTUNES.length), q = WORK_FORTUNES[index];
    const out = $('#workQueOut'); out.replaceChildren();
    const card = document.createElement('div'); card.className = 'que';
    for (const [tag, className, text] of [
      ['span', 'num', `Công việc · Quẻ số ${index + 1}`], ['span', 'lvl', q.lvl],
      ['h3', '', q.title], ['div', 'tho', q.tho],
    ]) {
      const el = document.createElement(tag); el.className = className; el.textContent = text; card.append(el);
    }
    const dl = document.createElement('dl');
    for (const [label, text] of [['Lời giải', q.giai], ['Nên làm', q.lam], ['Thời điểm', q.thoi]]) {
      const dt = document.createElement('dt'), dd = document.createElement('dd');
      dt.textContent = label; dd.textContent = text; dl.append(dt, dd);
    }
    card.append(dl);
    const copyButton = document.createElement('button'); copyButton.className = 'btn ghost';
    copyButton.textContent = '📋 Chép quẻ công việc';
    copyButton.onclick = () => copy(`💼 Quẻ công việc số ${index + 1} — ${q.title} (${q.lvl})\n${q.tho}\n\nLời giải: ${q.giai}\nNên làm: ${q.lam}\nThời điểm: ${q.thoi}\n\n— Chùa Hà Online 3D · Quẻ giải trí`);
    out.append(card, copyButton);
    bellSound(300, 2.5, 0.2);
    if (q.lvl.includes('cát')) petals(q.lvl === 'Đại cát' ? 30 : 14);
    feed(`💼 ${P.name} vừa xin quẻ công việc ${q.lvl}`);
    button.disabled = false;
  }, 1500);
};
$('#doCoin').onclick = () => {
  const a = Math.random() < 0.5, b = Math.random() < 0.5;
  ['#c1', '#c2'].forEach((s) => { const c = $(s); c.classList.remove('flip'); void c.offsetWidth; c.classList.add('flip'); c.textContent = '?'; });
  setTimeout(() => {
    $('#c1').textContent = a ? 'Dương' : 'Âm'; $('#c2').textContent = b ? 'Dương' : 'Âm';
    let m;
    if (a !== b) { m = 'Một âm một dương — Thánh chuẩn, quẻ ứng nghiệm! 🌸'; petals(20); bellSound(330, 3, 0.25); feed(`🌸 ${P.name} vừa gieo được âm dương — quẻ ứng nghiệm`); }
    else if (a && b) m = 'Hai dương — Thánh cười, xin gieo lại lần nữa.';
    else m = 'Hai âm — chưa thuận, tĩnh tâm rồi gieo lại.';
    $('#coinMsg').textContent = m;
  }, 900);
};

/* ---------------- Movement & collision ---------------- */
const fwd = new THREE.Vector3(), right = new THREE.Vector3();
function updatePlayer(dt, t) {
  let ix = joy.x, iy = joy.y;
  if (keys.KeyW || keys.ArrowUp) iy += 1;
  if (keys.KeyS || keys.ArrowDown) iy -= 1;
  if (keys.KeyA || keys.ArrowLeft) ix -= 1;
  if (keys.KeyD || keys.ArrowRight) ix += 1;
  const mag = Math.min(1, Math.hypot(ix, iy));
  let moving = false;
  const anyModal = $$('.modal.show').length > 0 || ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
  if (mag > 0.12 && !anyModal) {
    if (player.state === 'sit') { stopAll(); player.stand(); }
    if (player.meditating) stopAll();
    if (!player.busy) {
      const sx = -Math.sin(cam.yaw), sz = -Math.cos(cam.yaw);
      const mx = (sx * iy + Math.cos(cam.yaw) * ix), mz = (sz * iy - Math.sin(cam.yaw) * ix);
      const l = Math.hypot(mx, mz) || 1;
      const sp = 3.4 * mag * dt;
      let nx = player.pos.x + mx / l * sp, nz = player.pos.z + mz / l * sp;
      nx = clamp(nx, HALL.minX, HALL.maxX); nz = clamp(nz, HALL.minZ, HALL.maxZ);
      for (const p of PILLARS) {
        const dx = nx - p.x, dz = nz - p.z, d = Math.hypot(dx, dz), r = p.r + 0.35;
        if (d < r) { nx = p.x + dx / d * r; nz = p.z + dz / d * r; }
      }
      const pondDx = nx - 10.8, pondDz = nz - 8.8;
      const pondDistance = Math.hypot(pondDx / 2.3, pondDz / 3.2);
      if (pondDistance < 1) {
        nx = 10.8 + (pondDistance > 0 ? pondDx / pondDistance : -2.3);
        nz = 8.8 + (pondDistance > 0 ? pondDz / pondDistance : 0);
      }
      // altar front edge
      if (nz < -13.6) nz = -13.6;
      player.pos.x = nx; player.pos.z = nz;
      const targetYaw = Math.atan2(mx, mz);
      let dy = targetYaw - player.root.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      player.root.rotation.y += dy * Math.min(1, dt * 12);
      moving = true;
      player.state = 'walk';
    }
  } else if (player.state === 'walk') player.state = 'stand';

  // cushion proximity
  nearCushion = null;
  if (player.state !== 'sit') {
    let best = 1.25;
    for (const c of CUSHIONS) { if (c.taken) continue; const d = Math.hypot(c.x - player.pos.x, c.z - player.pos.z); if (d < best) { best = d; nearCushion = c; } }
  }
  const sb = $('#sitBtn');
  if (player.state === 'sit') { sb.style.display = 'block'; sb.textContent = 'Đứng dậy'; }
  else if (nearCushion) { sb.style.display = 'block'; sb.textContent = 'Ngồi xuống'; }
  else sb.style.display = 'none';

  // chant
  if (chanting) {
    chantT -= dt;
    if (chantT <= 0) {
      chantT = 0.55; mo(0.45);
      floatText(CHANT[chantIdx], player.pos.x + rand(-0.4, 0.4), player.pos.y + 2.5, player.pos.z, '#ffe2a3', 0.55);
      chantIdx++;
      if (chantIdx >= CHANT.length) { chantIdx = 0; chantT = 1.1; addMerit('chant'); }
    }
  }
  // beads auto
  if (beadMode && beadAuto) { beadAutoT -= dt; if (beadAutoT <= 0) { beadAutoT = 0.5; beadTap(); } }
  // meditation
  if (player.meditating) {
    const s = (performance.now() - medStart) / 1000;
    $('#mediT').textContent = `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    if (s - medAcc >= 10) { medAcc += 10; addMerit('meditate'); }
  }
  player.update(dt, t, moving);
}

/* ---------------- Nhân vật mô phỏng trong chùa ---------------- */
const npcs = [];
const NPC_NAMES = [
  'Thích em hơi nhiều', 'Thích đủ thứ', 'Thích mập mờ', 'Thích vậy đó',
  'Thích thì chiền', 'Doãn Chí Bình', 'Thích bình yên', 'Thích trà sữa',
  'Thích hết deadline', 'Thích ngủ sớm',
];
const NPC_CHANTS = ['Nam mô A Di Đà Phật', 'A Di Đà Phật', 'Nguyện cầu bình an', 'Cầu duyên lành 🙏'];
const PAUSE_MODES = ['bow', 'chant', 'meditate'];
const broomHandleMat = mat(0x9f6c36), broomStrawMat = mat(0xc9a65b);
const broomHandleGeo = new THREE.CylinderGeometry(0.025, 0.032, 1.4, 8);
const broomStrawGeo = new THREE.ConeGeometry(0.24, 0.38, 10);
const broomFiberGeo = new THREE.CylinderGeometry(0.009, 0.014, 0.39, 4);
function makeBroom(avatar) {
  const broom = new THREE.Group(); broom.position.set(0.48, 0.95, 0.44); broom.rotation.z = -0.22;
  mesh(broomHandleGeo, broomHandleMat, 0, 0, 0, broom);
  const straw = mesh(broomStrawGeo, broomStrawMat, 0, -0.67, 0, broom); straw.scale.z = 0.4;
  for (let i = -4; i <= 4; i++) {
    const fiber = mesh(broomFiberGeo, broomStrawMat, i * 0.036, -0.7, 0.035, broom);
    fiber.rotation.z = i * 0.07;
  }
  avatar.inner.add(broom);
  return broom;
}
for (let i = 0; i < NPC_NAMES.length; i++) {
  const side = i % 2 ? -1 : 1;
  // Lối giữa, hai đầu hàng bồ đoàn và khe giữa các dãy.
  const route = [{ x: side * 0.9, z: 13.4 }, { x: side * 0.9, z: -12 },
    { x: side * 4.575, z: -12 }, { x: side * 4.575, z: 13.4 }];
  const avatar = new Avatar({ name: NPC_NAMES[i], robe: ROBES[i % 7].c,
    hair: HAIRS[i % HAIRS.length].id, skin: i % 3, subtitle: 'Phật tử · Mô phỏng' });
  const segment = i % route.length, from = route[segment], to = route[(segment + 1) % route.length];
  avatar.pos.set(THREE.MathUtils.lerp(from.x, to.x, (i + 1) / 12), 0,
    THREE.MathUtils.lerp(from.z, to.z, (i + 1) / 12));
  avatar.faceAltar();
  avatar.ai = { role: 'pilgrim', route, waypoint: (segment + 1) % route.length,
    mode: i % 4 === 0 ? 'walk' : PAUSE_MODES[i % 3], timer: 5 + i, chantT: i * 0.4, cycle: i };
  if (avatar.ai.mode === 'bow') avatar.bow(3);
  npcs.push(avatar);
}
for (const [i, name] of ['Ni cô Tịnh Tâm', 'Ni cô Diệu An', 'Ni cô Liên Hoa'].entries()) {
  const route = i === 1
    ? [{ x: 8.475, z: 13.4 }, { x: 8.475, z: -12.2 }, { x: -8.475, z: -12.2 }, { x: -8.475, z: 13.4 }]
    : [{ x: -4.575, z: 13.4 }, { x: -4.575, z: -12.2 }, { x: 4.575, z: -12.2 }, { x: 4.575, z: 13.4 }];
  const avatar = new Avatar({ name, robe: i === 2 ? 0x8a5a3a : 0x8d8d92, hair: 'troc',
    subtitle: 'Ni cô quét chùa · Mô phỏng' });
  avatar.sash.material = robeMat(0x62616b);
  avatar.hands[0].position.set(0.4, 0.72, 0.44);
  avatar.hands[1].position.set(0.48, 1.08, 0.44);
  avatar.pos.set(route[i].x, 0, route[i].z);
  avatar.ai = { role: 'nun', route, waypoint: (i + 1) % route.length,
    mode: i % 2 ? 'walk' : 'sweep', timer: 3 + i * 2, broom: makeBroom(avatar) };
  npcs.push(avatar);
}
let npcSpeechCooldown = 0;
function updateNPCs(dt, t) {
  npcSpeechCooldown = Math.max(0, npcSpeechCooldown - dt);
  for (const a of npcs) {
    const ai = a.ai;
    let moving = false;
    if (ai.mode === 'walk') {
      const target = ai.route[ai.waypoint];
      const dx = target.x - a.pos.x, dz = target.z - a.pos.z, distance = Math.hypot(dx, dz);
      if (distance < 0.12) {
        ai.waypoint = (ai.waypoint + 1) % ai.route.length;
        ai.mode = ai.role === 'nun' ? 'sweep' : PAUSE_MODES[(ai.cycle++) % PAUSE_MODES.length];
        ai.timer = ai.role === 'nun' ? rand(4, 7) : rand(5, 10);
        a.state = 'stand'; a.faceAltar();
        if (ai.mode === 'bow') a.bow(3);
      } else if (!a.busy) {
        const blocked = (player && Math.hypot(player.pos.x - a.pos.x, player.pos.z - a.pos.z) < 0.85)
          || [...remotePlayers.values()].some(({ avatar }) => Math.hypot(avatar.pos.x - a.pos.x, avatar.pos.z - a.pos.z) < 0.85);
        if (!blocked) {
          const step = Math.min(distance, dt * (ai.role === 'nun' ? 0.9 : 1.25));
          a.pos.x += dx / distance * step; a.pos.z += dz / distance * step;
          const angle = Math.atan2(dx, dz) - a.root.rotation.y;
          a.root.rotation.y += Math.atan2(Math.sin(angle), Math.cos(angle)) * Math.min(1, dt * 8);
          moving = true;
        }
      }
    } else {
      ai.timer -= dt;
      if (ai.timer <= 0 && !a.busy) { ai.mode = 'walk'; a.meditating = false; }
    }
    a.state = moving ? 'walk' : 'stand';
    a.meditating = ai.mode === 'meditate';
    a.update(dt, t, moving);
    if (ai.mode === 'chant') {
      ai.chantT -= dt;
      if (ai.chantT <= 0 && npcSpeechCooldown <= 0 && camera.position.distanceToSquared(a.pos) < 160) {
        floatText(pick(NPC_CHANTS), a.pos.x, 2.55, a.pos.z, '#e4ddbc', 0.6);
        ai.chantT = rand(4, 7); npcSpeechCooldown = 1.2;
      }
    }
    if (ai.role === 'nun') {
      const sweeping = ai.mode === 'sweep', sway = Math.sin(t * 4 + a.phase);
      ai.broom.rotation.z = -0.22 + (sweeping ? sway * 0.28 : 0);
      ai.broom.rotation.y = sweeping ? sway * 0.45 : 0;
      ai.broom.position.x = 0.48 + (sweeping ? sway * 0.12 : 0);
      if (sweeping) { a.pivot.rotation.x = 0.12; a.pivot.rotation.z = sway * 0.035; }
    }
    a.tag.visible = camera.position.distanceToSquared(a.pos) < 200;
  }
}

/* ---------------- Camera ---------------- */
const camTarget = new THREE.Vector3();
function updateCamera(dt) {
  if (!player) {
    const t = performance.now() / 1000;
    camera.position.set(Math.sin(t * 0.08) * 6, 4.5, 12 + Math.cos(t * 0.08) * 2);
    camera.lookAt(0, 2.5, -16); return;
  }
  camTarget.lerp(new THREE.Vector3(player.pos.x, player.pos.y + 1.3, player.pos.z), Math.min(1, dt * 8));
  const cp = Math.cos(cam.pitch);
  let x = camTarget.x + Math.sin(cam.yaw) * cp * cam.dist;
  let y = camTarget.y + Math.sin(cam.pitch) * cam.dist;
  let z = camTarget.z + Math.cos(cam.yaw) * cp * cam.dist;
  x = clamp(x, -13.6, 13.6); z = clamp(z, -22, 16); y = clamp(y, 0.6, 7.8);
  camera.position.set(x, y, z);
  camera.lookAt(camTarget);
}

/* ---------------- Loop ---------------- */
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h;
  camera.fov = w < h ? 68 : 55; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

const clock = new THREE.Clock();
function loop() {
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  if (player) updatePlayer(dt, t);
  updateRoomPlayers(dt, t);
  updateNPCs(dt, t);
  updateRituals(dt, t);
  updateFeed(dt);
  // flames & lights
  for (const f of flames) { f.scale.set(1, 0.85 + Math.random() * 0.3, 1); }
  candleLight.intensity = 5 + Math.random() * 1.5;
  for (const s of stickTops) s.material.color.setHSL(0.05, 1, 0.5 + Math.sin(t * 5) * 0.08);
  lanterns.forEach((l, i) => { l.rotation.z = Math.sin(t * 0.9 + i) * 0.04; });
  archHalo.material.opacity = 0.1 + Math.sin(t * 0.8) * 0.03;
  // smoke
  for (const s of smoke) {
    s.userData.t += dt; let k = s.userData.t / 4;
    if (k >= 1) { s.userData.t = 0; k = 0; s.userData.ox = rand(-0.08, 0.08); }
    const ox = s.userData.ox || 0;
    s.position.set(ox + Math.sin(k * 6 + t) * 0.12 * k, TABLE.y + 1.1 + k * 2.4, TABLE.z + Math.cos(k * 5) * 0.08);
    s.scale.setScalar(0.15 + k * 0.9);
    s.material.opacity = Math.sin(Math.PI * k) * 0.28;
  }
  // offerings grow
  for (const o of offerings) if (o.userData.grow < 1) { o.userData.grow = Math.min(1, o.userData.grow + dt * 2.5); o.scale.setScalar(0.01 + o.userData.grow * 0.99); }
  // floaters
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i]; f.t += dt; f.s.position.y += dt * 0.5;
    f.s.material.opacity = 1 - Math.max(0, (f.t - f.life * 0.5) / (f.life * 0.5));
    if (f.t >= f.life) { scene.remove(f.s); f.s.material.map.dispose(); f.s.material.dispose(); floaters.splice(i, 1); }
  }
  updateCamera(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
document.fonts?.ready?.then(() => {}).catch(() => {});
$('#loading').remove();
renderProfile(); renderBeads();
loop();

// expose for debugging
window.__chuaha = { scene, player: () => player, remotePlayers, room, npcs, ACTIONS, cam };
