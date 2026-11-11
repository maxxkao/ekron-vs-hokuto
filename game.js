// EKRON 對 HOKUTO — Three.js low-poly 3D version
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as skClone } from 'three/addons/utils/SkeletonUtils.js';
import { mergeVertices, mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ---------------------------------------------------------------- constants
const PX = 1 / 170;                    // game px -> metres
const WALL_L = 60, WALL_R = 1220, MAXHP = 1000, GRAV = 0.95;
const STEP = 1000 / 60;
const D2R = Math.PI / 180;
const IS_TOUCH = matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window || location.search.includes('touch');
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a);
const wx = x => (x - 640) * PX;

const CHARS = {
  ekron: { name: 'EKRON', sub: 'SWORD MASTER', walk: 4.3, back: 3.4, jvx: 4.6, reach: 190, sword: true, superName: '雷霆一閃', col: '#ffb030' },
  hokuto: { name: 'HOKUTO', sub: 'GIRAFFE TAMER & GIRAFFE', walk: 5.0, back: 4.1, jvx: 5.0, reach: 120, sword: false, superName: '北斗百裂拳', col: '#a070ff' },
};

// ---------------------------------------------------------------- poses / moves (ported from the 2D game)
const E_BASE = { tor: 6, hd: 0, ua1: 42, fa1: 118, ua2: 26, fa2: 106, th1: 22, sh1: 2, th2: -20, sh2: -8, sw: 152, hx: 0 };
const H_BASE = { tor: 8, hd: 0, ua1: 36, fa1: 146, ua2: 22, fa2: 152, th1: 25, sh1: 0, th2: -24, sh2: -10, sw: 0, hx: 0 };
const SQUAT = { th1: 95, sh1: -18, th2: 68, sh2: -80, tor: 22 };
const JUMP = { th1: 72, sh1: -22, th2: 22, sh2: -62, tor: 4 };
const LYING = { tor: -90, hd: -8, ua1: -100, fa1: -128, ua2: 82, fa2: 98, th1: 92, sh1: 86, th2: 126, sh2: 46, sw: 60, hx: 0 };
const AIRHIT = { tor: -45, hd: -25, ua1: -60, fa1: -20, ua2: -80, fa2: -40, th1: 45, sh1: 20, th2: 10, sh2: -15 };
const HIT = { tor: -22, hd: -22, ua1: -15, fa1: 25, ua2: -25, fa2: 10, th1: 28, sh1: 12, th2: -16, sh2: -14, hx: -6 };
const CHIT = { tor: -5, hd: -25, ua1: -10, fa1: 30, ua2: -20, fa2: 20 };
const M = (...o) => Object.assign({}, ...o);

const MOVE_DEF = { level: 1, st: 6, ac: 4, rc: 12, dmg: 40, box: [30, 250, 150, 110], hs: 16, bs: 10, push: 5, kind: 'mid', kd: false, launch: 0,
  rehit: 0, maxhits: 1, air: false, crouch: false, proj: null, proj_end: null, snd: 'whoosh', hsnd: 'hit_l', vx: 0, vy: 0, inv: 0, cost: 0,
  hstop: 7, shake: 3, w: {}, a: {}, a2: null, drag: false, last_hs: 0, noscale: false, trail: false, fists: false, spin: false };
function mv(base, o) {
  const d = M(MOVE_DEF, o);
  d.W = M(base, d.w); d.A = M(base, d.a); d.A2 = d.a2 ? M(base, d.a2) : null;
  return d;
}
function ekronMoves() {
  const B = E_BASE, C = M(B, SQUAT), J = M(B, JUMP);
  return {
    a: mv(B, { st: 7, ac: 4, rc: 13, dmg: 45, box: [20, 270, 178, 125], hs: 17, bs: 11, push: 5, snd: 'slash', trail: true,
      w: { ua1: 75, fa1: 160, sw: 208, tor: -4, ua2: 60, fa2: 150 }, a: { ua1: 88, fa1: 84, sw: 82, tor: 16, th1: 32, sh1: 4, hx: 10, ua2: 72, fa2: 82 } }),
    b: mv(B, { level: 3, st: 14, ac: 5, rc: 22, dmg: 95, box: [10, 305, 200, 250], hs: 22, bs: 16, push: 9, hsnd: 'hit_h', hstop: 11, shake: 8, snd: 'slash', trail: true,
      w: { ua1: 160, fa1: 178, sw: 196, tor: -16, ua2: 150, fa2: 176, th1: 18, th2: -26 }, a: { ua1: 72, fa1: 56, sw: 46, tor: 30, th1: 48, sh1: 8, th2: -38, sh2: -22, hx: 22, ua2: 70, fa2: 58 } }),
    c: mv(B, { level: 2, st: 8, ac: 4, rc: 14, dmg: 60, box: [30, 215, 130, 80], hs: 18, push: 7, w: { th1: 88, sh1: -45, tor: -8 }, a: { th1: 94, sh1: 94, tor: -20, th2: -4, sh2: -4, sw: 170 } }),
    da: mv(C, { crouch: true, st: 6, ac: 4, rc: 11, dmg: 36, kind: 'low', box: [20, 130, 195, 70], hs: 15, snd: 'slash', trail: true, w: { ua1: 60, fa1: 120, sw: 130 }, a: { ua1: 86, fa1: 90, sw: 96, tor: 28 } }),
    db: mv(C, { crouch: true, level: 3, st: 12, ac: 5, rc: 24, dmg: 80, kind: 'low', kd: true, launch: 6, box: [10, 85, 225, 85], snd: 'slash', hsnd: 'hit_h', hstop: 10, shake: 6, trail: true,
      w: { sw: -50, ua1: -30, fa1: -40, tor: 12 }, a: { ua1: 62, fa1: 72, sw: 82, tor: 36 } }),
    dc: mv(C, { crouch: true, level: 2, st: 7, ac: 4, rc: 13, dmg: 45, kind: 'low', box: [30, 70, 140, 60], hs: 16, a: { th1: 86, sh1: 90, tor: -6, sw: 160 } }),
    ja: mv(J, { air: true, st: 6, ac: 7, rc: 8, dmg: 50, kind: 'high', box: [10, 230, 170, 250], hs: 18, snd: 'slash', trail: true, w: { ua1: 150, fa1: 175, sw: 200 }, a: { ua1: 96, fa1: 62, sw: 46, tor: 15 } }),
    jb: mv(J, { air: true, level: 3, st: 9, ac: 6, rc: 10, dmg: 82, kind: 'high', box: [0, 250, 190, 270], hs: 21, hsnd: 'hit_h', hstop: 10, shake: 6, snd: 'slash', trail: true,
      w: { ua1: 165, fa1: 178, sw: 195, tor: -10, ua2: 150, fa2: 170 }, a: { ua1: 80, fa1: 40, sw: 30, tor: 28, ua2: 70, fa2: 40 } }),
    jc: mv(J, { air: true, level: 2, st: 6, ac: 8, rc: 8, dmg: 60, kind: 'high', box: [20, 90, 115, 100], hs: 18, a: { th1: 72, sh1: 58, th2: -10, sh2: -52, tor: -10 } }),
    s: mv(B, { level: 4, st: 14, ac: 3, rc: 22, box: null, proj: 'beam', snd: 'beam', w: { ua1: 165, fa1: 178, sw: 186, tor: -8, ua2: 160, fa2: 178 }, a: { ua1: 86, fa1: 82, sw: 88, tor: 20, th1: 35, hx: 10 } }),
    ds: mv(C, { level: 4, st: 4, ac: 10, rc: 22, dmg: 90, box: [0, 340, 140, 340], inv: 12, vy: 16, vx: 3, kd: true, launch: 15, hsnd: 'hit_h', snd: 'slash', hstop: 11, shake: 8, trail: true,
      w: { sw: -40, ua1: 20, fa1: 30 }, a: { ua1: 172, fa1: 178, sw: 181, tor: -5, th1: 60, sh1: 0, th2: -10, sh2: -30 } }),
    x: mv(B, { level: 5, cost: 100, st: 10, ac: 28, rc: 26, dmg: 36, rehit: 4, maxhits: 7, box: [0, 290, 170, 290], vx: 15, inv: 38, kd: true, launch: 13, hsnd: 'hit_h', snd: 'thunder', hs: 26,
      drag: true, noscale: true, hstop: 5, shake: 6, trail: true,
      w: { tor: -12, ua1: 170, fa1: 178, sw: 190, ua2: 160, fa2: 176 }, a: { tor: 36, ua1: 90, fa1: 90, sw: 90, th1: 62, sh1: 10, th2: -50, sh2: -30, hx: 16 },
      a2: { tor: 22, ua1: 140, fa1: 170, sw: 200, th1: 62, sh1: 10, th2: -50, sh2: -30, hx: 16 } }),
  };
}
function hokutoMoves() {
  const B = H_BASE, C = M(B, SQUAT), J = M(B, JUMP);
  return {
    a: mv(B, { st: 4, ac: 3, rc: 9, dmg: 32, box: [40, 255, 100, 55], hs: 15, bs: 9, push: 4, w: { ua1: 48, fa1: 135 }, a: { ua1: 90, fa1: 90, tor: 14, hx: 6 } }),
    b: mv(B, { level: 3, st: 9, ac: 4, rc: 17, dmg: 82, box: [30, 250, 132, 65], hs: 21, push: 9, hsnd: 'hit_h', hstop: 10, shake: 6,
      w: { tor: -6, ua2: 8, fa2: 128 }, a: { ua2: 90, fa2: 90, tor: 28, hx: 24, th1: 46, sh1: 5, ua1: 28, fa1: 120 } }),
    c: mv(B, { level: 2, st: 10, ac: 4, rc: 16, dmg: 78, box: [25, 300, 150, 100], hs: 20, push: 8, hsnd: 'hit_h', hstop: 9, shake: 5,
      w: { th1: 88, sh1: -40, tor: -12 }, a: { th1: 118, sh1: 114, tor: -32, th2: -6, sh2: -6, ua1: 20, fa1: 120, ua2: -10, fa2: 40 } }),
    da: mv(C, { crouch: true, st: 4, ac: 3, rc: 9, dmg: 30, box: [40, 165, 95, 50], hs: 14, a: { ua1: 86, fa1: 88, tor: 24 } }),
    db: mv(C, { crouch: true, level: 3, st: 10, ac: 5, rc: 22, dmg: 72, kind: 'low', kd: true, launch: 6, box: [20, 65, 170, 65], hsnd: 'hit_h', hstop: 9, shake: 5,
      w: { tor: 16 }, a: { th1: 88, sh1: 90, tor: 36, ua2: 55, fa2: 20, ua1: 60, fa1: 30 } }),
    dc: mv(C, { crouch: true, level: 2, st: 6, ac: 4, rc: 12, dmg: 40, kind: 'low', box: [30, 65, 130, 55], hs: 15, a: { th1: 82, sh1: 89, tor: -6 } }),
    ja: mv(J, { air: true, st: 5, ac: 7, rc: 8, dmg: 45, kind: 'high', box: [25, 235, 105, 120], hs: 17, a: { ua1: 66, fa1: 60, tor: 10 } }),
    jb: mv(J, { air: true, level: 3, st: 8, ac: 6, rc: 10, dmg: 76, kind: 'high', box: [10, 215, 125, 210], hs: 21, hsnd: 'hit_h', hstop: 10, shake: 6,
      w: { ua1: 170, fa1: 178, ua2: 165, fa2: 178 }, a: { ua1: 72, fa1: 40, ua2: 70, fa2: 38, tor: 22 } }),
    jc: mv(J, { air: true, level: 2, st: 6, ac: 9, rc: 8, dmg: 68, kind: 'high', box: [20, 95, 135, 105], hs: 19, a: { th1: 74, sh1: 74, th2: -10, sh2: -56, tor: -16 } }),
    s: mv(B, { level: 4, st: 16, ac: 3, rc: 24, box: null, proj: 'giraffe', snd: 'giraffe', w: { ua1: 172, fa1: 180, tor: -8 }, a: { ua1: 92, fa1: 90, tor: 15, ua2: -20, fa2: 10 } }),
    ds: mv(B, { level: 4, st: 7, ac: 24, rc: 16, dmg: 36, rehit: 8, maxhits: 3, vx: 6.5, box: [-60, 285, 215, 115], kd: true, launch: 10, hsnd: 'hit_h', hs: 22, inv: 6, spin: true,
      a: { th1: 106, sh1: 106, tor: -26, th2: -10, sh2: -10, ua1: -40, fa1: 0, ua2: 60, fa2: 120 },
      a2: { th2: 106, sh2: 106, th1: -12, sh1: -12, tor: -26, ua2: -40, fa2: 0, ua1: 60, fa1: 120 } }),
    x: mv(B, { level: 5, cost: 100, st: 8, ac: 36, rc: 34, dmg: 14, rehit: 3, maxhits: 12, box: [25, 285, 150, 150], vx: 1.4, inv: 44, hs: 22, last_hs: 70, drag: true, noscale: true,
      proj_end: 'giraffe_super', hsnd: 'hit_l', hstop: 3, shake: 3, fists: true,
      w: { tor: -10, ua1: 10, fa1: 150, ua2: 10, fa2: 150 }, a: { ua1: 90, fa1: 90, ua2: 40, fa2: 140, tor: 16, hx: 10 }, a2: { ua2: 90, fa2: 90, ua1: 40, fa1: 140, tor: 22, hx: 14 } }),
  };
}

// ---------------------------------------------------------------- audio (synthesised)
const Audio = {
  ctx: null, master: null, noise: null, music: true, mtimer: null,
  init() {
    if (this.ctx) { this.ctx.resume(); return; }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain(); this.master.gain.value = 0.55; this.master.connect(this.ctx.destination);
      const n = this.ctx.createBuffer(1, this.ctx.sampleRate * 1.5, this.ctx.sampleRate);
      const d = n.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noise = n;
      if (this.music) this.startMusic();
    } catch (e) { this.ctx = null; }
  },
  env(g, t, a, peak, dur) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); },
  osc(type, f0, f1, dur, vol, t0 = 0, dest) {
    const c = this.ctx, t = c.currentTime + t0, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    this.env(g, t, 0.005, vol, dur); o.connect(g); g.connect(dest || this.master); o.start(t); o.stop(t + dur + 0.05);
  },
  nz(dur, vol, ftype, f0, f1, t0 = 0, q = 1) {
    const c = this.ctx, t = c.currentTime + t0, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; f.type = ftype; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    this.env(g, t, 0.01, vol, dur); s.connect(f); f.connect(g); g.connect(this.master); s.start(t); s.stop(t + dur + 0.05);
  },
  play(n, v = 1) {
    if (!this.ctx) return;
    switch (n) {
      case 'hit_l': this.nz(0.13, 0.7 * v, 'lowpass', 2500, 600); this.osc('sine', 220, 90, 0.12, 0.5 * v); break;
      case 'hit_h': this.nz(0.32, 0.9 * v, 'lowpass', 1400, 200); this.osc('sine', 150, 45, 0.3, 0.8 * v); break;
      case 'whoosh': this.nz(0.17, 0.35 * v, 'bandpass', 500, 1800, 0, 2); break;
      case 'slash': this.nz(0.2, 0.4 * v, 'bandpass', 700, 2500, 0, 2); this.osc('sine', 2350, 2300, 0.25, 0.06 * v); this.osc('sine', 3170, 3100, 0.2, 0.04 * v); break;
      case 'block': this.osc('square', 760, 700, 0.08, 0.15 * v); this.nz(0.06, 0.3 * v, 'highpass', 2000, 2000); break;
      case 'beam': this.osc('square', 250, 1500, 0.45, 0.12 * v); this.nz(0.45, 0.3 * v, 'bandpass', 800, 3000, 0, 1); break;
      case 'thunder': this.nz(1.3, 1.0 * v, 'lowpass', 900, 120); this.nz(0.15, 0.6 * v, 'highpass', 3000, 1500); break;
      case 'ko': this.osc('square', 700, 60, 1.0, 0.18 * v); this.nz(1.0, 0.5 * v, 'lowpass', 1500, 100); break;
      case 'bell': [660, 990, 1320].forEach((f, i) => this.osc('sine', f, f, 1.4, 0.18 / (i + 1) * v)); break;
      case 'fight': this.osc('sawtooth', 200, 900, 0.6, 0.15 * v); this.nz(0.6, 0.5 * v, 'bandpass', 600, 2400); break;
      case 'select': this.osc('square', 988, 988, 0.09, 0.1 * v); break;
      case 'move': this.osc('square', 660, 660, 0.05, 0.07 * v); break;
      case 'super': this.osc('sawtooth', 120, 2000, 0.8, 0.14 * v); this.nz(0.8, 0.4 * v, 'bandpass', 300, 4000); break;
      case 'giraffe': for (let k = 0; k < 6; k++) this.osc('sine', 80, 35, 0.16, 0.8 * v, k * 0.13); break;
      case 'land': this.nz(0.12, 0.5 * v, 'lowpass', 600, 100); this.osc('sine', 70, 40, 0.12, 0.6 * v); break;
    }
  },
  startMusic() {
    if (!this.ctx || this.mtimer) return;
    const nf = m => 440 * Math.pow(2, (m - 69) / 12);
    const prog = [[57, [57, 60, 64]], [53, [53, 57, 60]], [55, [55, 59, 62]], [52, [52, 55, 59]], [57, [57, 60, 64]], [53, [53, 57, 60]], [50, [50, 53, 57]], [52, [52, 56, 59]]];
    const mel = [[76, 0, 74, 72, 74, 0, 76, 79], [77, 0, 76, 74, 72, 0, 69, 0], [74, 0, 72, 71, 72, 74, 71, 67], [71, 0, 0, 72, 71, 0, 68, 0],
      [76, 0, 74, 72, 74, 0, 76, 81], [81, 0, 79, 77, 76, 0, 77, 0], [74, 0, 77, 0, 81, 79, 77, 74], [76, 0, 0, 0, 80, 0, 83, 0]];
    const arp = [0, 1, 2, 1, 2, 0, 1, 2];
    const bus = this.ctx.createGain(); bus.gain.value = 0.22; bus.connect(this.master); this.mbus = bus;
    const e = 60 / 142 / 2; let step = 0, next = this.ctx.currentTime + 0.1;
    this.mtimer = setInterval(() => {
      while (next < this.ctx.currentTime + 0.3) {
        const b = Math.floor(step / 8) % 8, k = step % 8, t0 = next - this.ctx.currentTime;
        const [root, ch] = prog[b];
        this.osc('square', nf(root - 24 + (k % 2 ? 12 : 0)), nf(root - 24 + (k % 2 ? 12 : 0)), e * 0.85, 0.25, t0, bus);
        this.osc('sawtooth', nf(ch[arp[k]] + 12), nf(ch[arp[k]] + 12), e * 0.7, 0.08, t0, bus);
        if (mel[b][k]) this.osc('square', nf(mel[b][k]), nf(mel[b][k]), e * 1.5, 0.1, t0, bus);
        if (k === 0 || k === 4) this.osc('sine', 110, 40, 0.2, 0.9, t0, bus);
        if (k === 2 || k === 6) { const s = this.ctx.createBufferSource(); s.buffer = this.noise; const g = this.ctx.createGain(); const tt = next;
          this.env(g, tt, 0.005, 0.35, 0.14); s.connect(g); g.connect(bus); s.start(tt); s.stop(tt + 0.2); }
        step++; next += e;
      }
    }, 100);
  },
  stopMusic() { clearInterval(this.mtimer); this.mtimer = null; if (this.mbus) { this.mbus.disconnect(); this.mbus = null; } },
};
const play = (n, v) => Audio.play(n, v);

// ---------------------------------------------------------------- renderer / scene
const canvas = document.getElementById('c');
// WebGL2 is required (iOS 15+); say so plainly instead of showing a blank screen
if (!document.createElement('canvas').getContext('webgl2')) {
  document.getElementById('load').innerHTML = '這台裝置的瀏覽器不支援 WebGL2<br>iPhone 請更新到 iOS 15 以上（建議 16.4 以上）再開啟';
  throw new Error('WebGL2 not supported');
}
// phones: no MSAA, lower resolution, cheaper shadows; quality drops further on its own if frames run slow
const QUALITY = { pr: IS_TOUCH ? Math.min(window.devicePixelRatio, 1.25) : Math.min(window.devicePixelRatio, 2), level: 0 };
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !IS_TOUCH, powerPreference: 'high-performance' });
renderer.setPixelRatio(QUALITY.pr);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = IS_TOUCH ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
{ // pastel gradient sky
  const cv = document.createElement('canvas'); cv.width = 4; cv.height = 256;
  const g = cv.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#8fb6e6'); gr.addColorStop(0.55, '#d9c6e6'); gr.addColorStop(1, '#f8d3cf');
  g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; scene.background = t;
}
scene.fog = new THREE.Fog(0xf3d6da, 45, 120);
const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 200);
camera.position.set(0, 1.9, 9);

const hemi = new THREE.HemisphereLight(0xdfe9ff, 0xf2c3b4, 1.25); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0dc, 2.6);
sun.position.set(-6, 10, 7); sun.castShadow = true;
sun.shadow.mapSize.set(IS_TOUCH ? 1024 : 2048, IS_TOUCH ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 8, bottom: -3, near: 1, far: 40 });
sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03; sun.shadow.radius = 4;
scene.add(sun); scene.add(sun.target);
const rim = new THREE.DirectionalLight(0xffc89a, 1.3); rim.position.set(8, 4, -5); scene.add(rim);

// Phones held upright: turn the whole game 90° so it always plays widescreen.
let ROTATED = false;
function resize() {
  ROTATED = IS_TOUCH && innerHeight > innerWidth;
  const app = document.getElementById('app');
  const w = ROTATED ? innerHeight : innerWidth, h = ROTATED ? innerWidth : innerHeight;
  app.style.width = w + 'px'; app.style.height = h + 'px';
  document.body.classList.toggle('rot', ROTATED);
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('orientationchange', () => setTimeout(resize, 200));
addEventListener('resize', resize); resize();

// glow sprite texture
function glowTex(r, g, b) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const c = cv.getContext('2d'), gr = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, `rgba(255,255,255,1)`); gr.addColorStop(0.25, `rgba(${r},${g},${b},0.9)`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
  c.fillStyle = gr; c.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const TEX = { spark: glowTex(255, 200, 90), blue: glowTex(110, 170, 255), purple: glowTex(180, 120, 255), dust: glowTex(230, 210, 210) };
const texLoader = new THREE.TextureLoader();
function loadTex(u) { const t = texLoader.load(u); t.colorSpace = THREE.SRGBColorSpace; return t; }
TEX.slash = loadTex('tex/fx_slash.png'); TEX.crescent = loadTex('tex/fx_crescent.png');

// ---------------------------------------------------------------- particles
const particles = [];
const pGroup = new THREE.Group(); scene.add(pGroup);
const spMats = {};
function spMat(key, add = true) {
  if (!spMats[key]) spMats[key] = new THREE.SpriteMaterial({ map: TEX[key], blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: false, transparent: true });
  return spMats[key];
}
function spawn(x, y, z, vx, vy, life, size, key = 'spark', grav = 0, grow = 0, add = true) {
  const s = new THREE.Sprite(spMat(key, add).clone());
  s.position.set(x, y, z); s.scale.setScalar(size); pGroup.add(s);
  particles.push({ s, vx, vy, life, ml: life, size, grav, grow });
}
function burst(x, y, n, key, speed, size, life = 18, grav = 0.004) {
  for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, sp = rnd(0.3, 1) * speed; spawn(x, y, 0.45, Math.cos(a) * sp, Math.sin(a) * sp, Math.floor(rnd(life / 2, life)), size, key, grav); }
}
function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.s.position.x += p.vx; p.s.position.y += p.vy; p.vy -= p.grav; p.vx *= 0.93; p.vy *= 0.93; p.life--;
    const t = p.life / p.ml;
    p.s.material.opacity = t; p.s.scale.setScalar(p.size * (p.grow ? 1 + (1 - t) * p.grow : 0.4 + 0.6 * t));
    if (p.life <= 0) { pGroup.remove(p.s); p.s.material.dispose(); particles.splice(i, 1); }
  }
}
// lightning bolts (Ekron super)
const bolts = [];
const boltMat = new THREE.LineBasicMaterial({ color: 0xd8c8ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
function bolt(x1, y1, x2, y2, life = 5) {
  const pts = []; const n = 9;
  for (let i = 0; i <= n; i++) { const t = i / n; pts.push(new THREE.Vector3(lerp(x1, x2, t) + (i && i < n ? rnd(-0.15, 0.15) : 0), lerp(y1, y2, t) + (i && i < n ? rnd(-0.12, 0.12) : 0), 0.5)); }
  const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), boltMat); scene.add(l); bolts.push({ l, life });
}
function updateBolts() { for (let i = bolts.length - 1; i >= 0; i--) { if (--bolts[i].life <= 0) { scene.remove(bolts[i].l); bolts[i].l.geometry.dispose(); bolts.splice(i, 1); } } }

// ---------------------------------------------------------------- assets
const loader = new GLTFLoader();
const ASSETS = {};
const BUILD = '20261111b';   // bump when models change so browsers don't keep old copies
let PACKED = null;
async function loadGLB(name) {
  try { return await new Promise((res, rej) => loader.load(`models/${name}.glb?v=${BUILD}`, g => res(g.scene), undefined, rej)); }
  catch (e) {   // fall back to the base64-packed models (used where .glb files cannot be served)
    PACKED = PACKED || (await import(`./models/glb.js?v=${BUILD}`)).default;
    const bin = Uint8Array.from(atob(PACKED[name]), c => c.charCodeAt(0)).buffer;
    return new Promise((res, rej) => loader.parse(bin, 'models/', g => res(g.scene), rej));
  }
}
function prepShadows(o, cast = true, recv = true) { o.traverse(c => { if (c.isMesh) { c.castShadow = cast; c.receiveShadow = recv; } }); }

// ---------------------------------------------------------------- input
const KEYS = ['l', 'r', 'u', 'd', 'a', 'b', 'c', 's', 'x'];
const blank = () => Object.fromEntries(KEYS.map(k => [k, false]));
class Input {
  constructor() { this.clear(); }
  clear() { this.held = blank(); this.buf = Object.fromEntries(KEYS.map(k => [k, 999])); }
  feed(h) { for (const k of KEYS) { this.buf[k] = (h[k] && !this.held[k]) ? 0 : this.buf[k] + 1; } this.held = { ...h }; }
  pressed(k, w = 4) { return this.buf[k] <= w; }
  consume(k) { this.buf[k] = 999; }
}
const keyDown = new Set();
addEventListener('keydown', e => { keyDown.add(e.code); if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault(); onMenuKey(e); });
addEventListener('keyup', e => keyDown.delete(e.code));
addEventListener('blur', () => keyDown.clear());
const MAP_1P = { l: ['KeyA', 'ArrowLeft'], r: ['KeyD', 'ArrowRight'], u: ['KeyW', 'ArrowUp'], d: ['KeyS', 'ArrowDown'], a: ['KeyJ', 'KeyF', 'Numpad1'], b: ['KeyK', 'KeyG', 'Numpad2'],
  c: ['KeyL', 'KeyH', 'Numpad3'], s: ['KeyU', 'KeyR', 'Numpad4'], x: ['KeyI', 'KeyT', 'Numpad5'] };
const MAP_P1 = { l: ['KeyA'], r: ['KeyD'], u: ['KeyW'], d: ['KeyS'], a: ['KeyF'], b: ['KeyG'], c: ['KeyH'], s: ['KeyR'], x: ['KeyT'] };
const MAP_P2 = { l: ['ArrowLeft'], r: ['ArrowRight'], u: ['ArrowUp'], d: ['ArrowDown'], a: ['Numpad1', 'KeyJ'], b: ['Numpad2', 'KeyK'], c: ['Numpad3', 'KeyL'], s: ['Numpad4', 'KeyU'], x: ['Numpad5', 'KeyI'] };
const readKeys = m => Object.fromEntries(KEYS.map(k => [k, m[k].some(c => keyDown.has(c))]));
const orH = (a, b) => Object.fromEntries(KEYS.map(k => [k, a[k] || b[k]]));
// gamepad
function readPad(i) {
  const h = blank(); const gp = (navigator.getGamepads ? navigator.getGamepads() : [])[i]; if (!gp) return h;
  const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0, B = j => gp.buttons[j] && gp.buttons[j].pressed;
  h.l = ax < -0.5 || B(14); h.r = ax > 0.5 || B(15); h.u = ay < -0.6 || B(12); h.d = ay > 0.6 || B(13);
  h.a = B(2); h.b = B(3); h.c = B(0); h.s = B(1); h.x = B(4) || B(5); return h;
}
// touch
const touchH = blank();
{
  const stick = document.getElementById('stick'), knob = document.getElementById('knob');
  let sid = null;
  const upd = e => {
    for (const t of e.changedTouches) {
      if (t.identifier !== sid) continue;
      const r = stick.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      let dx = (t.clientX - cx) / (r.width / 2), dy = (t.clientY - cy) / (r.height / 2);
      if (ROTATED) [dx, dy] = [dy, -dx];
      const L = Math.hypot(dx, dy); if (L > 1) { dx /= L; dy /= L; }
      knob.style.transform = `translate(${dx * 70}%,${dy * 70}%)`;
      touchH.l = dx < -0.38; touchH.r = dx > 0.38; touchH.u = dy < -0.5; touchH.d = dy > 0.5;
    }
  };
  stick.addEventListener('touchstart', e => { e.preventDefault(); Audio.init(); sid = e.changedTouches[0].identifier; upd(e); }, { passive: false });
  stick.addEventListener('touchmove', e => { e.preventDefault(); upd(e); }, { passive: false });
  const end = e => { for (const t of e.changedTouches) if (t.identifier === sid) { sid = null; knob.style.transform = ''; touchH.l = touchH.r = touchH.u = touchH.d = false; } };
  stick.addEventListener('touchend', end); stick.addEventListener('touchcancel', end);
  document.querySelectorAll('.tb').forEach(b => {
    const k = b.dataset.k;
    b.addEventListener('touchstart', e => { e.preventDefault(); Audio.init(); touchH[k] = true; b.classList.add('on'); }, { passive: false });
    const off = e => { e.preventDefault(); touchH[k] = false; b.classList.remove('on'); };
    b.addEventListener('touchend', off, { passive: false }); b.addEventListener('touchcancel', off, { passive: false });
  });
}

// ---------------------------------------------------------------- fighter
const BODY_YAW = 32 * D2R, HEAD_YAW = 22 * D2R;
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const HEAD_SCALE = 1.32;
const JOINTS = ['root', 'hips', 'spine', 'neck', 'head', 'sh1', 'el1', 'ha1', 'sh2', 'el2', 'ha2', 'th1', 'kn1', 'an1', 'th2', 'kn2', 'an2', 'toe1', 'toe2', 'sw'];
class Fighter {
  constructor(cid, idx) {
    this.cid = cid; this.c = CHARS[cid]; this.idx = idx;
    this.moves = cid === 'ekron' ? ekronMoves() : hokutoMoves();
    this.base = cid === 'ekron' ? E_BASE : H_BASE;
    this.holder = new THREE.Group();
    this.model = skClone(ASSETS[cid]);
    prepShadows(this.model, true, false);
    this.holder.add(this.model); scene.add(this.holder);
    this.j = {}; for (const n of JOINTS) this.j[n] = this.model.getObjectByName(n);
    this.hipY0 = this.j.hips.position.y; this.hipX0 = this.j.hips.position.x;
    this.meshes = []; this.model.traverse(o => {
      if (!o.isMesh) return;
      o.material = o.material.clone(); o.frustumCulled = false; this.meshes.push(o);
      if (o.material.name === 'lens') Object.assign(o.material, { transparent: true, opacity: 0.22, depthWrite: false, roughness: 0.05, metalness: 0.2 });
    });
    // rest frames: every joint swings about the character's side axis (model Z), whatever the bone's own orientation
    this.model.updateMatrixWorld(true);
    const mq = this.model.getWorldQuaternion(new THREE.Quaternion()).invert();
    this.rest = {};
    for (const n of JOINTS) {
      const b = this.j[n]; if (!b) continue;
      const qb = mq.clone().multiply(b.getWorldQuaternion(new THREE.Quaternion()));
      const qi = qb.clone().invert();
      this.rest[n] = { q: b.quaternion.clone(), qb, qi, z: new THREE.Vector3(0, 0, 1).applyQuaternion(qi), y: new THREE.Vector3(0, 1, 0).applyQuaternion(qi) };
    }
    // soft glow over the whole blade: two additive shells pushed out along smooth normals
    const blade = this.meshes.find(m => m.material.name === 'blade');
    if (blade) {
      blade.material.emissiveIntensity = 2.2;
      let geo = blade.geometry.clone(); geo.deleteAttribute('normal'); if (geo.attributes.uv) geo.deleteAttribute('uv');
      geo = mergeVertices(geo, 1e-4); geo.computeVertexNormals();
      for (const [push, op] of [[0.012, 0.55], [0.035, 0.28], [0.075, 0.12]]) {
        const m = new THREE.MeshBasicMaterial({ color: 0xffc860, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false });
        m.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
 transformed += normalize(objectNormal) * ${push.toFixed(3)};`); };
        m.customProgramCacheKey = () => 'glow' + push;
        const g = new THREE.SkinnedMesh(geo, m);
        g.bind(blade.skeleton, blade.bindMatrix); g.frustumCulled = false; g.renderOrder = 2;
        blade.parent.add(g); g.position.copy(blade.position); g.quaternion.copy(blade.quaternion); g.scale.copy(blade.scale);
      }
    }
    this.meter = 0; this.opp = null;
    this.reset(idx === 0 ? 380 : 900);
  }
  reset(x) {
    Object.assign(this, { x, y: 0, vx: 0, vy: 0, facing: this.idx === 0 ? 1 : -1, hp: MAXHP, hpTrail: MAXHP, trailDelay: 0, state: 'idle', timer: 0,
      move: null, mkey: null, mt: 0, hits: 0, lasthit: -99, moveHit: false, inv: 0, flash: 0, t: 0, walkPh: 0, backHeld: false, downHeld: false,
      guarding: false, juggle: 0, combo: 0, ko: false, cancelUsed: false, crouchBlock: false, spinA: 0 });
    this.disp = { ...this.base };
  }
  get air() { return this.y > 0.5; }
  hurtbox() {
    if (['down', 'getup', 'ko', 'win', 'lose'].includes(this.state) || this.inv > 0) return null;
    if (this.state === 'air_hit') return this.juggle >= 3 ? null : [this.x - 70, this.x + 70, this.y, this.y + 130];
    if (this.air) return [this.x - 34, this.x + 34, this.y + 10, this.y + 250];
    const cr = this.state === 'crouch' || ((this.state === 'blockstun' || this.state === 'hitstun') && this.crouchBlock) || (this.state === 'attack' && this.move.crouch);
    return [this.x - 36, this.x + 36, this.y, this.y + (cr ? 228 : 292)];
  }
  hitbox() {
    const m = this.move;
    if (this.state !== 'attack' || !m || !m.box) return null;
    if (!(m.st < this.mt && this.mt <= m.st + m.ac)) return null;
    if (this.hits >= m.maxhits) return null;
    if (this.hits > 0 && (m.rehit === 0 || this.mt - this.lasthit < m.rehit)) return null;
    const [fx, top, w, h] = m.box;
    const x0 = this.facing > 0 ? this.x + fx : this.x - fx - w;
    return [x0, x0 + w, this.y + top - h, this.y + top];
  }
  canBlock(kind) {
    if (this.air || !['idle', 'walk', 'crouch', 'blockstun'].includes(this.state) || !this.backHeld) return false;
    if (kind === 'low' && !this.downHeld) return false;
    if (kind === 'high' && this.downHeld) return false;
    return true;
  }
  startMove(key, fight) {
    const m = this.moves[key];
    if (m.cost) { if (this.meter < m.cost) return false; this.meter -= m.cost; fight.superFreeze(this); }
    Object.assign(this, { state: 'attack', move: m, mkey: key, mt: 0, hits: 0, lasthit: -99, moveHit: false, cancelUsed: false, inv: m.inv });
    if (!m.air) this.vx = 0;
    return true;
  }
  toIdle() { this.state = 'idle'; this.move = null; }
  update(inp, fight) {
    const opp = this.opp; this.t++;
    if (this.flash > 0) this.flash--; if (this.inv > 0) this.inv--;
    let fwd = this.facing > 0 ? 'r' : 'l', back = this.facing > 0 ? 'l' : 'r';
    this.backHeld = inp.held[back]; this.downHeld = inp.held.d;
    const st = this.state;
    if (st === 'idle' || st === 'walk' || st === 'crouch') {
      if (!this.air) {
        if (opp.x !== this.x) this.facing = opp.x > this.x ? 1 : -1;
        fwd = this.facing > 0 ? 'r' : 'l'; back = this.facing > 0 ? 'l' : 'r'; this.backHeld = inp.held[back];
      }
      if (this.tryAttacks(inp, fight, true)) { /* started */ }
      else if (inp.held.u) { this.state = 'jump'; this.vy = 19.5; this.vx = inp.held[fwd] ? this.c.jvx : inp.held[back] ? -this.c.jvx : 0; this.vx *= this.facing; this.y += 1; play('whoosh', 0.3); }
      else if (inp.held.d) { this.state = 'crouch'; this.vx = 0; }
      else {
        this.guarding = this.backHeld && fight.threatTo(this);
        if (this.guarding) { this.state = 'idle'; this.vx = 0; }
        else if (inp.held[fwd]) { this.state = 'walk'; this.vx = this.facing * this.c.walk; this.walkPh += 0.16; }
        else if (inp.held[back]) { this.state = 'walk'; this.vx = -this.facing * this.c.back; this.walkPh -= 0.13; }
        else { this.state = 'idle'; this.vx = 0; }
      }
      if (this.state === 'crouch') this.guarding = this.backHeld && fight.threatTo(this);
    } else if (st === 'jump') this.tryAttacks(inp, fight, false);
    else if (st === 'attack') this.updateAttack(inp, fight);
    else if (st === 'hitstun' || st === 'blockstun') { this.timer--; if (!this.air) this.vx *= 0.82; if (this.timer <= 0) this.toIdle(); }
    else if (st === 'land') { this.vx = 0; if (--this.timer <= 0) this.toIdle(); }
    else if (st === 'down') { this.vx *= 0.8; if (--this.timer <= 0 && !this.ko) { this.state = 'getup'; this.timer = 22; } }
    else if (st === 'getup') { if (--this.timer <= 0) { this.toIdle(); this.inv = 6; this.juggle = 0; } }
    else this.vx *= 0.85;
    // physics
    this.x += this.vx;
    if (this.air || this.vy > 0) {
      this.y += this.vy; this.vy -= GRAV;
      if (this.y <= 0) { this.y = 0; this.impact = -this.vy; this.onLand(fight); }
    }
    this.x = clamp(this.x, WALL_L, WALL_R);
    if (['down', 'ko', 'lose', 'getup'].includes(this.state)) {
      const lo = WALL_L + 120, hi = WALL_R - 120;
      if (this.x < lo) this.x += (lo - this.x) * 0.2; else if (this.x > hi) this.x += (hi - this.x) * 0.2;
    }
    this.updatePose();
    if (this.trailDelay > 0) this.trailDelay--; else if (this.hpTrail > this.hp) this.hpTrail = Math.max(this.hp, this.hpTrail - 6);
  }
  onLand(fight) {
    this.vy = 0; const st = this.state;
    if (st === 'jump') { this.state = 'land'; this.timer = 3; this.vx = 0; fight.dust(this.x, 4); }
    else if (st === 'attack') { this.state = 'land'; this.timer = this.mkey === 'ds' ? 12 : 5; this.vx = 0; }
    else if (st === 'air_hit' && !this.bounced && this.impact > 6) {
      this.bounced = true; this.vy = Math.min(7, this.impact * 0.35); this.y = 1; this.vx *= 0.6;
      play('land', 0.9); fight.shake = Math.max(fight.shake, 6); fight.dust(this.x, 12);
    }
    else if (st === 'air_hit') {
      if (this.hp <= 0) { this.state = 'ko'; this.ko = true; } else { this.state = 'down'; this.timer = 40; }
      this.vx *= 0.4; play('land', 0.8); fight.shake = Math.max(fight.shake, 5); fight.dust(this.x, 10);
    } else if (st === 'hitstun' || st === 'blockstun') this.vx *= 0.5;
  }
  tryAttacks(inp, fight, ground) {
    if (ground) {
      if (inp.pressed('x') && this.meter >= 100) { inp.consume('x'); return this.startMove('x', fight); }
      if (inp.pressed('s')) { inp.consume('s'); return this.startMove(inp.held.d ? 'ds' : 's', fight); }
      for (const b of 'bca') if (inp.pressed(b)) { inp.consume(b); return this.startMove(inp.held.d ? 'd' + b : b, fight); }
    } else for (const b of 'bca') if (inp.pressed(b)) { inp.consume(b); return this.startMove('j' + b, fight); }
    return false;
  }
  updateAttack(inp, fight) {
    const m = this.move; this.mt++;
    const { st, ac, rc } = m;
    if (this.mt === st + 1) {
      play(m.snd, 0.8);
      if (m.vy) { this.vy = m.vy; this.vx = this.facing * m.vx; this.y += 1; }
      if (m.proj) fight.spawnProj(this, m.proj);
    }
    if (m.proj === 'giraffe' && this.mt <= st) this.vx = this.mt <= 9 ? -this.facing * 5.5 : this.vx * 0.6;   // hop back
    if (this.mt > st && this.mt <= st + ac) {
      if (m.vx && !m.vy) this.vx = this.facing * m.vx;
      if (m.fists && this.t % 2 === 0) spawn(wx(this.x + this.facing * rnd(90, 170)), rnd(170, 260) * PX + this.y * PX, 0.5, this.facing * 0.01, 0, 8, 0.32, 'spark');
      if (this.mkey === 'x' && this.cid === 'ekron' && this.t % 2 === 0)
        bolt(wx(this.x - this.facing * 120), (this.y + rnd(80, 280)) * PX, wx(this.x + this.facing * 140), (this.y + rnd(80, 280)) * PX);
      if (m.spin) this.spinA += 0.55;
    } else if (this.mt > st + ac && m.vx && !m.air && !this.air) this.vx *= 0.7;
    if (m.proj_end && this.mt === st + ac + 1) fight.spawnProj(this, m.proj_end);
    if (this.moveHit && !this.cancelUsed && this.mt > st && !m.air) {
      let nxt = null;
      if (m.level < 5 && inp.pressed('x') && this.meter >= 100) nxt = 'x';
      else if (m.level < 4 && inp.pressed('s')) nxt = inp.held.d ? 'ds' : 's';
      else for (const b of 'bca') if (inp.pressed(b)) { const k = inp.held.d ? 'd' + b : b; if (this.moves[k].level > m.level) nxt = k; break; }
      if (nxt) { for (const b of 'abcsx') inp.consume(b); this.startMove(nxt, fight); return; }
    }
    if (this.mt >= st + ac + rc) { if (this.air) { this.state = 'jump'; this.move = null; } else this.toIdle(); }
  }
  blockPose(cr) {
    const p = this.cid === 'ekron' ? M(this.base, { tor: -6, ua1: 62, fa1: 168, sw: 178, ua2: 52, fa2: 160, th1: 18, th2: -28, sh2: -14 })
      : M(this.base, { tor: -6, ua1: 50, fa1: 176, ua2: 46, fa2: 170, th1: 18, th2: -28, sh2: -14 });
    if (cr) { Object.assign(p, SQUAT); p.tor = 10; }
    return p;
  }
  targetPose() {
    const st = this.state, b = this.base;
    if (st === 'attack') {
      const m = this.move;
      if (this.mt <= m.st) return [m.W, 0.38];
      if (this.mt <= m.st + m.ac) return [(m.A2 && Math.floor((this.mt - m.st) / Math.max(2, m.rehit || 4)) % 2) ? m.A2 : m.A, 0.6];
      const fr = (this.mt - m.st - m.ac) / Math.max(1, m.rc);
      if (fr < 0.4) return [m.A, 0.3];
      if (m.air) return [M(b, JUMP), 0.18];
      return [this.downHeld && !m.vy ? M(b, SQUAT) : b, 0.16];
    }
    if (st === 'idle' || st === 'walk') {
      if (this.guarding) return [this.blockPose(false), 0.45];
      if (st === 'walk') {
        const ph = this.walkPh, p = { ...b };
        p.th1 = b.th1 * 0.3 + 24 * Math.sin(ph); p.sh1 = p.th1 - 28 * Math.max(0, Math.cos(ph));
        p.th2 = b.th2 * 0.3 + 24 * Math.sin(ph + Math.PI); p.sh2 = p.th2 - 28 * Math.max(0, Math.cos(ph + Math.PI)); p.tor = b.tor + 3;
        return [p, 0.35];
      }
      const p = { ...b }, br = Math.sin(this.t * 0.07);
      p.tor += br * 2; p.ua1 += br * 3; p.fa1 += br * 4; p.ua2 += br * 3; p.sw += br * 3; p.th1 += br * 2; p.th2 -= br * 2;
      return [p, 0.22];
    }
    if (st === 'crouch') return [this.guarding ? this.blockPose(true) : M(b, SQUAT), 0.35];
    if (st === 'jump') { const p = M(b, JUMP); if (this.vy < -4) Object.assign(p, { th1: 30, sh1: 0, th2: -10, sh2: -25 }); return [p, 0.25]; }
    if (st === 'land') return [M(b, SQUAT, { tor: 10 }), 0.4];
    if (st === 'blockstun') return [this.blockPose(this.crouchBlock), 0.5];
    if (st === 'hitstun') return [this.crouchBlock ? M(b, SQUAT, CHIT) : M(b, HIT), 0.5];
    if (st === 'air_hit') return this.bounced ? [M(b, LYING), 0.3] : [M(b, AIRHIT), 0.25];
    if (st === 'down' || st === 'ko' || st === 'lose') return [M(b, LYING), 0.3];
    if (st === 'getup') return [M(b, SQUAT), 0.2];
    if (st === 'win') {
      const k = Math.sin(this.t * 0.08);
      return [this.cid === 'ekron' ? M(b, { tor: -4, ua1: 168 + k * 4, fa1: 178, sw: 180, ua2: -20, fa2: 10, th1: 18, sh1: 0, th2: -18, sh2: 0 })
        : M(b, { tor: 0, ua1: 68, fa1: 150 + k * 3, ua2: 72, fa2: 160 + k * 3, th1: 6, sh1: 0, th2: -6, sh2: 0, hd: 8 }), 0.12];
    }
    return [b, 0.22];
  }
  updatePose() {
    const [tg, r] = this.targetPose();
    for (const k in tg) this.disp[k] += (tg[k] - this.disp[k]) * r;
    if (!(this.state === 'attack' && this.move && this.move.spin)) this.spinA *= 0.7;
  }
  // ----- 3D
  render(shakeX, shakeY) {
    const p = this.disp, j = this.j, f = this.facing;
    const R = v => v * D2R;
    const rot = (n, a) => { const r = this.rest[n]; if (!r) return; j[n].quaternion.copy(r.q).multiply(_q.setFromAxisAngle(r.z, a)); };
    rot('spine', -R(p.tor));
    { const r = this.rest.head; j.head.quaternion.copy(r.q).multiply(_q.setFromAxisAngle(r.y, -HEAD_YAW)).multiply(_q2.setFromAxisAngle(r.z, -R(p.hd))); }
    rot('sh1', R(p.ua1 + p.tor)); rot('el1', R(p.fa1 - p.ua1));
    rot('sh2', R(p.ua2 + p.tor)); rot('el2', R(p.fa2 - p.ua2));
    rot('th1', R(p.th1)); rot('kn1', R(p.sh1 - p.th1));
    rot('th2', R(p.th2)); rot('kn2', R(p.sh2 - p.th2));
    rot('sw', R(p.sw - p.fa1));
    j.hips.position.x = this.hipX0 + p.hx * PX;
    const h = this.holder;
    h.position.set(wx(this.x) + shakeX, 0, 0);
    h.scale.x = f;
    h.rotation.y = -f * BODY_YAW + this.spinA * f;
    // put the lowest body point on the floor (or at the jump height)
    j.root.position.y = 0;
    h.updateMatrixWorld(true);
    let low = 1e9;
    const tmp = new THREE.Vector3();
    const chk = (n, pad, up = 0) => { const node = j[n]; if (!node) return; tmp.set(0, 0, 0); if (up) tmp.copy(this.rest[n].y).multiplyScalar(up); node.localToWorld(tmp); low = Math.min(low, tmp.y - pad); };
    chk('toe1', 0); chk('toe2', 0); chk('an1', 0.09); chk('an2', 0.09); chk('kn1', 0.07); chk('kn2', 0.07);
    chk('ha1', 0.05); chk('ha2', 0.05); chk('head', 0.2, 0.18); chk('hips', 0.13); chk('spine', 0.13, 0.42);
    j.root.position.y = this.y * PX - low + shakeY;
    // hit flash
    const fl = this.flash > 0;
    if (fl !== this._fl) { this._fl = fl; for (const m of this.meshes) { if (!m.material.emissive) continue; if (fl) { m.userData.e = m.userData.e || m.material.emissive.clone(); m.material.emissive.setRGB(0.6, 0.5, 0.35); } else if (m.userData.e) m.material.emissive.copy(m.userData.e); } }
  }
  swordTip() { const t = new THREE.Vector3(); if (!this.j.sw) return null; t.set(0, -1.1, 0); this.j.sw.localToWorld(t); return t; }
}

// ---------------------------------------------------------------- giraffe
class Giraffe {
  constructor() {
    this.holder = new THREE.Group(); this.model = skClone(ASSETS.giraffe); prepShadows(this.model, true, false);
    this.model.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
    this.holder.add(this.model); scene.add(this.holder);
    // bones swing about the giraffe's side axis (model Z), whatever their own rest orientation
    this.model.updateMatrixWorld(true);
    const mq = this.model.getWorldQuaternion(new THREE.Quaternion()).invert();
    this.b = {};
    for (const n of ['hip_fl', 'hip_fr', 'hip_bl', 'hip_br', 'knee_fl', 'knee_fr', 'knee_bl', 'knee_br', 'neckj', 'headj', 'tail']) {
      const o = this.model.getObjectByName(n);
      const qb = mq.clone().multiply(o.getWorldQuaternion(new THREE.Quaternion()));
      this.b[n] = { o, q: o.quaternion.clone(), z: new THREE.Vector3(0, 0, 1).applyQuaternion(qb.invert()) };
    }
    this.legs = ['fl', 'fr', 'bl', 'br'].map((n, i) => ({ n, ph: [0, Math.PI, Math.PI, 0][i] }));
    this.t = 0;
  }
  rot(n, a) { const b = this.b[n]; b.o.quaternion.copy(b.q).multiply(_q.setFromAxisAngle(b.z, a)); }
  pose(x, f, run, nod, z = -0.9, vis = true) {
    this.holder.visible = vis; if (!vis) return;
    this.t += 1 + run * 1.2;
    const t = this.t * 0.12;
    for (const L of this.legs) {
      const s = Math.sin(t * 2.2 + L.ph) * 0.5 * run, bend = Math.max(0, Math.cos(t * 2.2 + L.ph)) * 0.7 * run;
      this.rot('hip_' + L.n, s); this.rot('knee_' + L.n, -bend);
    }
    const neck = -(0.62 + nod) + Math.sin(t * 0.4) * 0.03 - run * 0.2;
    this.rot('neckj', neck);
    // keep the head roughly level (snout slightly down) whatever the neck does
    this.rot('headj', -neck - 0.22 - nod * 0.4);
    this.rot('tail', -0.25 + Math.sin(t * 0.8) * 0.15 - run * 0.4);
    const S = 0.76;   // smaller and further back so the head stays inside the camera frame
    this.holder.position.set(wx(x), Math.abs(Math.sin(t * 2.2)) * 0.05 * run, z);
    this.holder.scale.set(f * S, S, S); this.holder.rotation.y = -f * 0.3;
  }
}

// ---------------------------------------------------------------- projectiles
class Proj {
  constructor(owner, kind, x, y, vx, g) {
    Object.assign(this, { owner, kind, x, y, vx, f: vx > 0 ? 1 : -1, t: 0, dead: false, hit: false, g });
    if (kind === 'beam') {
      Object.assign(this, { dmg: 70, hs: 20, bs: 14, push: 6, launch: 0, kd: false });
      this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.25), new THREE.MeshBasicMaterial({ map: TEX.crescent, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      this.mesh.scale.x = this.f; scene.add(this.mesh);
    } else Object.assign(this, { dmg: kind === 'giraffe' ? 95 : 90, hs: 24, bs: 18, push: 8, kd: true, launch: kind === 'giraffe' ? 11 : 15 });
  }
  rect() { return this.kind === 'beam' ? [this.x - 32, this.x + 32, this.y - 70, this.y + 70] : [this.x - 40 + this.f * 40 - 75, this.x - 40 + this.f * 40 + 75, 0, 330]; }
  update(fight) {
    this.t++; this.x += this.vx;
    if (this.kind === 'beam') {
      this.mesh.position.set(wx(this.x), this.y * PX, 0.4);
      if (this.t % 2 === 0) spawn(wx(this.x - this.f * 20), (this.y + rnd(-50, 50)) * PX, 0.4, -this.f * 0.01, 0, 16, 0.18, 'spark');
    } else {
      if (this.g) this.g.pose(this.x, this.f, 1, 0.45, 0, true);   // charges in the fighters' lane
      if (this.t % 8 === 0) { fight.shake = Math.max(fight.shake, 3); fight.dust(this.x - this.f * 50, 4); }
    }
    if (this.x < -400 || this.x > 1680) this.dead = true;
  }
  dispose() { if (this.mesh) { scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.material.dispose(); } }
}

// ---------------------------------------------------------------- CPU
class CPU {
  constructor(lv) { [this.think, this.blockP, this.aggr, this.comboP, this.specialP] = [[18, 0.22, 0.30, 0.15, 0.10], [10, 0.55, 0.50, 0.50, 0.18], [5, 0.82, 0.68, 0.85, 0.22]][lv]; this.cool = 0; this.hold = {}; this.queue = []; this.tried = null; }
  dir(me, d) { return d === 'fwd' ? (me.facing > 0 ? 'r' : 'l') : d === 'back' ? (me.facing > 0 ? 'l' : 'r') : d; }
  get(me, opp, fight) {
    const out = blank();
    for (const k in this.hold) { if (--this.hold[k] <= 0) delete this.hold[k]; else out[this.dir(me, k)] = true; }
    this.queue = this.queue.filter(it => { if (--it[0] <= 0) { for (const k of it[1]) out[this.dir(me, k)] = true; return false; } return true; });
    if (me.state === 'attack' && me.moveHit && this.tried !== me.move) {
      this.tried = me.move;
      if (Math.random() < this.comboP) {
        const lv = me.move.level;
        if (lv < 3 && !me.move.air) this.queue.push([3 + Math.floor(Math.random() * 4), lv === 1 ? ['b'] : ['s']]);
        else if (lv < 5 && me.meter >= 100 && Math.random() < 0.6) this.queue.push([4, ['x']]);
        else if (lv === 3) this.queue.push([4, ['s']]);
      }
    }
    if (--this.cool > 0) return out;
    this.cool = this.think + Math.floor(Math.random() * this.think);
    if (fight.phase !== 'fight') return out;
    if (!['idle', 'walk', 'crouch', 'jump'].includes(me.state)) {
      if (me.state === 'blockstun' && Math.random() < this.blockP) { this.hold.back = 12; if (opp.state === 'attack' && opp.move.kind === 'low') this.hold.d = 12; }
      return out;
    }
    const d = Math.abs(opp.x - me.x), r = Math.random();
    const threat = opp.state === 'attack' && opp.move && opp.mt <= opp.move.st + opp.move.ac && d < 330;
    const proj = fight.projThreat(me);
    if ((threat || proj) && r < this.blockP) {
      if (proj && Math.random() < 0.35 && d > 250) { this.hold.u = 3; this.hold.fwd = 25; this.queue.push([16, ['c']]); return out; }
      this.hold.back = 18; if (threat && (opp.move.kind === 'low' || (opp.move.crouch && Math.random() < 0.7))) this.hold.d = 18; return out;
    }
    if (opp.air && ['jump', 'attack'].includes(opp.state) && d < 240 && r < this.blockP) { this.queue.push([1, me.cid === 'ekron' ? ['d', 's'] : ['b']]); return out; }
    if (['down', 'getup', 'ko'].includes(opp.state)) { if (Math.random() < 0.5) this.hold.fwd = 10; return out; }
    if (me.meter >= 100 && d < 260 && Math.random() < 0.3 * this.aggr) { this.queue.push([1, ['x']]); return out; }
    const reach = me.c.reach;
    if (d > 380) {
      const r2 = Math.random();
      if (r2 < this.specialP * 1.6 && !fight.hasProj(me)) this.queue.push([1, ['s']]);
      else if (r2 < 0.7) this.hold.fwd = 15 + Math.floor(Math.random() * 25);
      else if (r2 < 0.8) { this.hold.u = 3; this.hold.fwd = 30; this.queue.push([12 + Math.floor(Math.random() * 8), [Math.random() < 0.5 ? 'b' : 'c']]); }
    } else if (d > reach + 20) {
      const r2 = Math.random();
      if (r2 < this.aggr) this.hold.fwd = 8 + Math.floor(Math.random() * 16);
      else if (r2 < this.aggr + 0.12) { this.hold.u = 3; this.hold.fwd = 30; this.queue.push([12 + Math.floor(Math.random() * 8), [Math.random() < 0.5 ? 'b' : 'c']]); }
      else if (r2 < this.aggr + 0.12 + this.specialP && !fight.hasProj(me)) this.queue.push([1, ['s']]);
      else if (r2 < 0.9) this.hold.back = 6 + Math.floor(Math.random() * 10);
    } else if (Math.random() < this.aggr + 0.2) {
      const ch = ['a', 'a', 'b', 'c', 'da', 'db', 'dc', 'ds'][Math.floor(Math.random() * 8)];
      this.queue.push([1, ch[0] === 'd' ? ['d', ch[1]] : [ch]]);
    } else if (Math.random() < 0.5) { this.hold.back = 8 + Math.floor(Math.random() * 10); if (Math.random() < 0.4) this.hold.d = this.hold.back; }
    else this.hold.back = 10;
    return out;
  }
}

// ---------------------------------------------------------------- fight
const $ = id => document.getElementById(id);
const G_BACK = -1.7;   // companion giraffe walks behind the fighters
const SLASH_ANG = { a: 8, b: -38, da: 12, db: 18, ja: -30, jb: -45, ds: 70, x: 0 };
class Fight {
  constructor(c1, c2, mode, diff) {
    this.mode = mode;
    this.f = [new Fighter(c1, 0), new Fighter(c2, 1)];
    this.f[0].opp = this.f[1]; this.f[1].opp = this.f[0];
    this.inp = [new Input(), new Input()];
    this.cpu = mode === '1p' ? new CPU(diff) : null;
    this.wins = [0, 0]; this.round = 1; this.paused = false;
    this.giraffes = [new Giraffe(), new Giraffe()];
    this.slashes = [];
    for (let i = 0; i < 2; i++) {
      $('por' + i).style.backgroundImage = `url(tex/portrait_${this.f[i].cid}.jpg)`;
      $('nm' + i).textContent = this.f[i].c.name; $('sub' + i).textContent = this.f[i].c.sub;
    }
    this.newRound();
  }
  dispose() {
    for (const fi of this.f) scene.remove(fi.holder);
    for (const g of this.giraffes) scene.remove(g.holder);
    for (const p of this.projs) p.dispose();
    for (const s of this.slashes) { scene.remove(s.m); s.m.material.dispose(); }
  }
  hokuto() { return this.f.find(fi => fi.cid === 'hokuto'); }
  newRound() {
    this.f.forEach((fi, i) => fi.reset(i === 0 ? 380 : 900));
    this.projs && this.projs.forEach(p => p.dispose());
    this.projs = []; this.timer = 99; this.tick = 0; this.phase = 'intro'; this.pt = 0;
    this.hitstop = 0; this.shake = 0; this.freeze = 0; this.freezeWho = null; this.slow = 0; this.flash = 0;
    this.combo = [null, null]; this.koText = 'K.O.'; this.winner = null;
    const hk = this.hokuto();
    this.gx = hk ? hk.x - hk.facing * 210 : 2000; this.gf = hk ? hk.facing : -1; this.grun = 0; this.gProj = null; this.gz = G_BACK;
    this.inp.forEach(i => i.clear());
  }
  threatTo(me) {
    const o = me.opp;
    if (o.state === 'attack' && o.move && o.mt <= o.move.st + o.move.ac + 2 && Math.abs(o.x - me.x) < 330) return true;
    return this.projThreat(me);
  }
  projThreat(me) { return this.projs.some(p => p.owner !== me && !p.hit && (p.x - me.x) * p.vx < 0 && Math.abs(p.x - me.x) < 420); }
  hasProj(me) { const k = me.cid === 'ekron' ? ['beam'] : ['giraffe', 'giraffe_super']; return this.projs.some(p => p.owner === me && k.includes(p.kind)); }
  spawnProj(owner, kind) {
    if (kind === 'beam') { if (this.hasProj(owner)) return; this.projs.push(new Proj(owner, 'beam', owner.x + owner.facing * 110, owner.y + 175, owner.facing * 11)); return; }
    if (kind === 'giraffe' && this.hasProj(owner)) return;
    const f = owner.facing; let x, g;
    if (owner.cid === 'hokuto' && !this.gProj && this.gx > -200 && this.gx < 1480) { x = this.gx; g = this.giraffes[0]; }
    else { x = f > 0 ? -300 : 1580; g = this.giraffes[this.gProj ? 1 : 0]; }
    const p = new Proj(owner, kind, x, 0, f * (kind === 'giraffe' ? 15 : 22), g);
    this.projs.push(p); if (g === this.giraffes[0]) this.gProj = p;
    play('giraffe', 1);
  }
  superFreeze(who) {
    this.freeze = 55; this.freezeWho = who; play('super', 1);
    $('cutimg').src = `tex/portrait_${who.cid}.jpg`;
    $('cutimg').style.left = who.idx === 0 ? '6%' : ''; $('cutimg').style.right = who.idx === 1 ? '6%' : '';
    $('cutt').textContent = who.c.superName; $('cut').style.display = 'flex';
    document.querySelector('#cut .band').style.background = `linear-gradient(transparent,${who.cid === 'ekron' ? 'rgba(255,150,30,.55)' : 'rgba(150,90,255,.55)'},transparent)`;
  }
  dust(x, n) { for (let i = 0; i < n; i++) spawn(wx(x) + rnd(-0.2, 0.2), 0.05, rnd(-0.3, 0.4), rnd(-0.03, 0.03), rnd(0.005, 0.02), 26, 0.35, 'dust', 0, 1.5, false); }
  applyHit(att, dfn, o) {
    const d = o.proj ? (att.facing > 0 ? 1 : -1) : (dfn.x - att.x >= 0 ? 1 : -1);
    const [px, py] = o.pt;
    if (dfn.canBlock(o.kind)) {
      dfn.state = 'blockstun'; dfn.crouchBlock = dfn.downHeld; dfn.timer = o.bs; dfn.vx = d * o.push * 0.9;
      if (o.level >= 4) { dfn.hp = Math.max(1, dfn.hp - Math.floor(o.dmg * 0.12)); dfn.trailDelay = 30; }
      att.meter = Math.min(100, att.meter + 2); dfn.meter = Math.min(100, dfn.meter + 3);
      play('block', 0.9); burst(wx(px), py * PX, 10, 'blue', 0.07, 0.22); spawn(wx(px), py * PX, 0.5, 0, 0, 10, 1.0, 'blue');
      this.hitstop = Math.max(this.hitstop, 5);
      if (!o.proj && (dfn.x <= WALL_L + 2 || dfn.x >= WALL_R - 2)) att.vx = -d * o.push * 0.8;
      return;
    }
    const cont = dfn.state === 'hitstun' || dfn.state === 'air_hit';
    att.combo = cont ? att.combo + 1 : 1;
    const sc = o.noscale ? 1 : Math.max(0.35, 1 - 0.12 * (att.combo - 1));
    const real = Math.max(1, Math.floor(o.dmg * sc));
    dfn.hp = Math.max(0, dfn.hp - real); dfn.trailDelay = 40; dfn.flash = 6;
    att.moveHit = true; att.meter = Math.min(100, att.meter + real * 0.09 + 1); dfn.meter = Math.min(100, dfn.meter + real * 0.06);
    if (dfn.state === 'attack') dfn.move = null;
    if (dfn.hp <= 0 || o.kd || dfn.air || dfn.state === 'air_hit') {
      dfn.state = 'air_hit'; dfn.bounced = false; dfn.juggle++; dfn.vy = o.launch || 9; dfn.vx = d * (dfn.hp <= 0 ? 8 : 6); dfn.y = Math.max(dfn.y, 1);
      if (o.drag && !o.last) { dfn.state = 'hitstun'; dfn.vy = 0; if (dfn.y < 2) dfn.y = 0; dfn.juggle--; dfn.timer = o.hs; dfn.vx = att.vx ? att.vx * 0.95 : d; }
    } else {
      dfn.state = 'hitstun'; dfn.crouchBlock = dfn.downHeld; dfn.timer = (o.last && o.last_hs) ? o.last_hs : o.hs;
      dfn.vx = (o.drag && att.vx) ? att.vx * 0.95 : d * o.push;
      if (!o.proj && (dfn.x <= WALL_L + 2 || dfn.x >= WALL_R - 2)) att.vx = -d * o.push * 0.7;
    }
    play(o.hsnd, 1);
    this.hitstop = Math.max(this.hitstop, o.hstop); this.shake = Math.max(this.shake, o.shake);
    const heavy = o.hsnd === 'hit_h';
    burst(wx(px), py * PX, heavy ? 18 : 11, 'spark', heavy ? 0.14 : 0.09, 0.2);
    spawn(wx(px), py * PX, 0.5, 0, 0, 12, heavy ? 1.6 : 1.0, 'spark');
    if (heavy) spawn(wx(px), py * PX, 0.5, 0, 0, 14, 0.6, 'spark', 0, 3);
    if (att.combo >= 2) this.combo[att.idx] = [att.combo, 100];
  }
  checkHits() {
    const ov = (a, b) => a[0] < b[1] && b[0] < a[1] && a[2] < b[3] && b[2] < a[3];
    const ctr = (a, b) => [(Math.max(a[0], b[0]) + Math.min(a[1], b[1])) / 2, (Math.max(a[2], b[2]) + Math.min(a[3], b[3])) / 2];
    const hits = [];
    for (const a of this.f) { const hb = a.hitbox(); if (!hb) continue; const hu = a.opp.hurtbox(); if (hu && ov(hb, hu)) hits.push([a, ctr(hb, hu)]); }
    for (const [a, pt] of hits) {
      const m = a.move; if (!m) continue;
      a.hits++; a.lasthit = a.mt; const last = a.hits >= m.maxhits;
      this.applyHit(a, a.opp, { dmg: m.dmg, hs: m.hs, bs: m.bs, push: m.push, kind: m.kind, kd: m.kd && (m.maxhits === 1 || last), launch: m.launch, hsnd: m.hsnd,
        hstop: m.hstop, shake: m.shake, pt, level: m.level, drag: m.drag, last, noscale: m.noscale, last_hs: m.last_hs });
    }
    for (const p of this.projs) {
      if (p.dead || p.hit) continue;
      const t = p.owner.opp, hu = t.hurtbox(), pr = p.rect();
      if (hu && ov(pr, hu)) {
        p.hit = true;
        this.applyHit(p.owner, t, { dmg: p.dmg, hs: p.hs, bs: p.bs, push: p.push, kind: 'mid', kd: p.kd, launch: p.launch, hsnd: 'hit_h', hstop: 10, shake: 8, pt: ctr(pr, hu), level: 4, proj: true });
        if (p.kind === 'beam') p.dead = true;
      }
    }
    for (let i = 0; i < this.projs.length; i++) for (let k = i + 1; k < this.projs.length; k++) {
      const p = this.projs[i], q = this.projs[k];
      if (p.owner === q.owner || p.dead || q.dead || !ov(p.rect(), q.rect())) continue;
      for (const z of [p, q]) if (z.kind === 'beam') z.dead = true;
      const c = ctr(p.rect(), q.rect()); burst(wx(c[0]), c[1] * PX, 20, 'spark', 0.12, 0.22); play('block');
    }
  }
  pushApart() {
    const [a, b] = this.f;
    if (['down', 'ko', 'getup'].includes(a.state) || ['down', 'ko', 'getup'].includes(b.state) || Math.abs(a.y - b.y) > 200) return;
    let dx = b.x - a.x; const minD = 64;
    if (Math.abs(dx) < minD) {
      if (dx === 0) dx = a.facing > 0 ? 1 : -1;
      const ov = (minD - Math.abs(dx)) / 2, s = dx > 0 ? 1 : -1;
      a.x = clamp(a.x - s * ov, WALL_L, WALL_R); b.x = clamp(b.x + s * ov, WALL_L, WALL_R);
      if (Math.abs(b.x - a.x) < minD - 1) {
        const [lo, hi] = a.x < b.x ? [a, b] : [b, a];
        if (lo.x <= WALL_L + 1) hi.x = lo.x + minD; else if (hi.x >= WALL_R - 1) lo.x = hi.x - minD;
      }
    }
  }
  update() {
    if (this.paused) return;
    this.tick++;
    let h0, h1;
    const none = blank();
    if (this.mode === '1p') { h0 = window.__autoP1 ? (this.cpu0 ||= new CPU(2)).get(this.f[0], this.f[1], this) : orH(orH(readKeys(MAP_1P), readPad(0)), touchH); h1 = this.phase === 'fight' ? this.cpu.get(this.f[1], this.f[0], this) : none; }
    else { h0 = orH(readKeys(MAP_P1), readPad(0)); h1 = orH(readKeys(MAP_P2), readPad(1)); }
    if (this.phase !== 'fight') { h0 = none; if (this.mode === '2p') h1 = none; }
    this.inp[0].feed(h0); this.inp[1].feed(h1);
    if (this.flash > 0) this.flash--;
    if (this.freeze > 0) { if (--this.freeze === 0) $('cut').style.display = 'none'; updateParticles(); return; }
    if (this.hitstop > 0) { this.hitstop--; if (this.shake > 0) this.shake -= 0.5; return; }
    if (this.slow > 0) { this.slow--; if (this.slow % 3) return; }
    if (this.shake > 0) this.shake = Math.max(0, this.shake - 0.6);
    this.pt++;
    if (this.phase === 'intro') {
      if (this.pt === 10) play('bell'); if (this.pt === 85) play('fight');
      if (this.pt >= 120) { this.phase = 'fight'; this.pt = 0; }
    }
    this.f.forEach((fi, i) => fi.update(this.inp[i], this));
    this.pushApart();
    for (const p of this.projs) p.update(this);
    if (this.phase === 'fight' || this.phase === 'ko') this.checkHits();
    this.projs = this.projs.filter(p => { if (p.dead) { p.dispose(); return false; } return true; });
    updateParticles(); updateBolts();
    for (let i = 0; i < 2; i++) { const c = this.combo[i]; if (c && --c[1] <= 0) this.combo[i] = null; }
    this.updateCompanion();
    if (this.phase === 'fight') {
      if (this.tick % 60 === 0 && this.timer > 0) this.timer--;
      const ko = this.f.map(fi => fi.hp <= 0);
      if (ko[0] || ko[1]) {
        this.phase = 'ko'; this.pt = 0; this.slow = 90; this.flash = 12; this.koText = ko[0] && ko[1] ? 'DOUBLE K.O.' : 'K.O.';
        play('ko'); play('thunder', 0.6); this.winner = ko[0] && ko[1] ? null : (ko[1] ? 0 : 1);
      } else if (this.timer <= 0) {
        this.phase = 'ko'; this.pt = 0; this.koText = 'TIME UP'; play('bell');
        const [a, b] = [this.f[0].hp, this.f[1].hp]; this.winner = a === b ? null : (a > b ? 0 : 1);
      }
    } else if (this.phase === 'ko') {
      if (this.pt === 110) {
        if (this.winner !== null) {
          const w = this.f[this.winner];
          if (w.state !== 'ko') { w.state = 'win'; w.move = null; w.vx = 0; }
          const l = w.opp; if (!['ko', 'air_hit', 'down'].includes(l.state)) { l.state = 'down'; l.ko = true; l.timer = 99999; }
          this.wins[this.winner]++;
        } else { this.wins[0]++; this.wins[1]++; }
      }
      if (this.pt >= 260) {
        if (Math.max(...this.wins) >= 2) { this.phase = 'end'; showEnd(this); }
        else { this.round++; this.newRound(); }
      }
    } else if (this.phase === 'end') this.f.forEach(fi => { fi.t++; fi.updatePose(); });
  }
  updateCompanion() {
    const hk = this.hokuto(); if (!hk) return;
    if (this.gProj) { if (this.projs.includes(this.gProj)) return; this.gx = this.gProj.vx < 0 ? -300 : 1580; this.gz = 0; this.gProj = null; }
    const calling = hk.state === 'attack' && hk.mkey === 's' && hk.mt <= hk.move.st;
    if (calling) {        // step into the lane right in front of Hokuto
      const tx = clamp(hk.x + hk.facing * 150, 40, 1240);
      this.gx += clamp((tx - this.gx) * 0.3, -16, 16);
      this.gz += (0 - this.gz) * 0.3; this.grun = 1; this.gf = hk.facing;
      return;
    }
    this.gz += (G_BACK - this.gz) * 0.05;
    const target = clamp(hk.x - hk.facing * 210, -60, 1340), dx = target - this.gx;
    const sp = Math.abs(dx) > 10 ? clamp(dx * 0.06, -7.5, 7.5) : 0;
    this.gx += sp; this.grun += (Math.min(1, Math.abs(sp) / 5) - this.grun) * 0.2;
    this.gf = Math.abs(sp) > 1.5 ? (sp > 0 ? 1 : -1) : hk.facing;
  }
  render(dt) {
    const sx = this.shake > 0 ? rnd(-this.shake, this.shake) * PX : 0, sy = this.shake > 0 ? rnd(-this.shake, this.shake) * PX : 0;
    for (const fi of this.f) fi.render(sx * 0.5, 0);
    // companion giraffe
    const hk = this.hokuto();
    const used = new Set(this.projs.filter(p => p.g).map(p => p.g));
    if (hk && !this.gProj) {
      let nod = 0.08 * Math.sin(this.tick * 0.03);
      if (hk.state === 'win') nod = 0.25 + 0.25 * Math.sin(this.tick * 0.12);
      this.giraffes[0].pose(this.gx, this.gf, this.grun, nod, this.gz, true);
    } else if (!used.has(this.giraffes[0])) this.giraffes[0].holder.visible = false;
    if (!used.has(this.giraffes[1])) this.giraffes[1].holder.visible = false;
    // sword slash sprites
    for (const fi of this.f) {
      const m = fi.move;
      if (fi.c.sword && fi.state === 'attack' && m && m.trail && m.box) {
        const since = fi.mt - m.st;
        if (since === 1) {
          const [bx, top, bw, bh] = m.box;
          const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.42), new THREE.MeshBasicMaterial({ map: TEX.slash, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
          const w = bw * 1.25 * PX; mesh.scale.set(w * fi.facing, w, 1);
          mesh.rotation.z = (SLASH_ANG[fi.mkey] || 0) * D2R * fi.facing;
          mesh.position.set(wx(fi.x + fi.facing * (bx + bw / 2)), (fi.y + top - bh / 2) * PX, 0.35);
          scene.add(mesh); this.slashes.push({ m: mesh, life: m.ac + 7, ml: m.ac + 7, owner: fi });
        }
      }
    }
    for (let i = this.slashes.length - 1; i >= 0; i--) {
      const s = this.slashes[i]; s.life -= (this.hitstop || this.freeze) ? 0 : 1;
      s.m.material.opacity = Math.min(1, s.life / 6);
      if (s.life <= 0) { scene.remove(s.m); s.m.geometry.dispose(); s.m.material.dispose(); this.slashes.splice(i, 1); }
    }
    // camera follows the midpoint
    const [a, b] = this.f, mid = (a.x + b.x) / 2, sep = Math.abs(a.x - b.x) * PX;
    const asp = camera.aspect, base = asp < 1.5 ? 8.2 : 6.4;
    const tz = clamp(base + sep * 0.62, base, base + 3.2);
    const tx = clamp(wx(mid), -2.2, 2.2);
    if (!window.__camLock) {
    camera.position.x += (tx - camera.position.x) * 0.08; camera.position.z += (tz - camera.position.z) * 0.06;
    camera.position.y = 1.75 + sy;
    camera.lookAt(camera.position.x * 0.98, 1.3, 0);
    }
    if (window.__shotCam) { camera.position.copy(window.__shotCam[0]); camera.lookAt(window.__shotCam[1]); }
    sun.target.position.set(camera.position.x, 0, 0); sun.position.set(camera.position.x - 6, 10, 7);
    hemi.intensity = 1.25 + (this.flash > 0 ? this.flash * 0.15 : 0) - (this.freeze > 0 ? 0.6 : 0);
    sun.intensity = this.freeze > 0 ? 1.0 : 2.6;
    this.hud();
  }
  hud() {
    for (let i = 0; i < 2; i++) {
      const fi = this.f[i];
      $('hp' + i).style.width = (fi.hp / MAXHP * 100) + '%'; $('tr' + i).style.width = (fi.hpTrail / MAXHP * 100) + '%';
      $('hp' + i).classList.toggle('low', fi.hp < 300 && (this.tick >> 3) % 2 === 0);
      $('mt' + i).style.width = fi.meter + '%'; $('mtw' + i).classList.toggle('full', fi.meter >= 100);
      [...$('w' + i).children].forEach((bb, k) => bb.classList.toggle('on', this.wins[i] > k));
      const c = this.combo[i], el = $('combo' + i);
      if (c) { el.style.display = 'block'; el.innerHTML = `${c[0]}<small>HITS</small>`; el.style.opacity = Math.min(1, c[1] / 30); } else el.style.display = 'none';
    }
    $('timer').textContent = this.timer; $('timer').style.color = this.timer > 10 ? '#fff' : '#ff6050';
    let ann = '', ann2 = '';
    if (this.phase === 'intro') { if (this.pt >= 10 && this.pt < 80) { ann = 'ROUND ' + this.round; ann2 = `第 ${this.round} 回合`; } else if (this.pt >= 85) ann = 'FIGHT!'; }
    else if (this.phase === 'ko') {
      if (this.pt < 200) ann = this.koText;
      if (this.pt >= 120) ann2 = this.winner !== null ? `${this.f[this.winner].c.name} WIN!` : 'DRAW';
    }
    if ($('ann').textContent !== ann) $('ann').textContent = ann;
    if ($('ann2').textContent !== ann2) $('ann2').textContent = ann2;
    const showHint = this.round === 1 && (this.phase === 'intro' || (this.phase === 'fight' && this.pt < 300)) && !IS_TOUCH;
    $('hint').textContent = showHint ? (this.mode === '1p' ? '移動 WASD/方向鍵　J 輕攻擊　K 重攻擊　L 踢　U 必殺　I 超必殺' : '1P：WASD + F G H R T　　2P：方向鍵 + 數字鍵 1 2 3 4 5') : '';
  }
}

// ---------------------------------------------------------------- menus & flow
let fight = null, mode = '1p', charSel = 0, diff = 1, scene_ = 'title';
let demo = null;
const menus = ['m-title', 'm-select', 'm-diff', 'm-help', 'm-pause', 'm-end'];
function show(id) {
  scene_ = id;
  menus.forEach(m => $(m).classList.toggle('show', m === id));
  const inFight = id === 'fight';
  $('hud').style.display = inFight || id === 'm-pause' || id === 'm-end' ? 'block' : 'none';
  $('touch').style.display = inFight && IS_TOUCH ? 'block' : 'none';
  $('pause').style.display = inFight && IS_TOUCH ? 'block' : 'none';
  if (id !== 'fight') $('cut').style.display = 'none';
}
function startFight() {
  if (fight) fight.dispose();
  if (demo) { demo.dispose(); demo = null; }
  const mine = ['ekron', 'hokuto'][charSel], other = ['hokuto', 'ekron'][charSel];
  fight = new Fight(mine, other, mode, diff);
  show('fight');
  if (IS_TOUCH && document.documentElement.requestFullscreen && !document.fullscreenElement)
    document.documentElement.requestFullscreen().then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {})).catch(() => {});
}
function showEnd(fg) {
  const w = fg.wins[0] === fg.wins[1] ? -1 : (fg.wins[0] > fg.wins[1] ? 0 : 1);
  $('endt').textContent = w < 0 ? 'DRAW GAME' : `${fg.f[w].c.name} WINS`;
  $('ends').textContent = w < 0 ? '平手！' : fg.mode === '1p' ? (w === 0 ? '你贏了！' : '你輸了…再接再厲！') : `${w + 1}P 獲勝！`;
  setTimeout(() => show('m-end'), 600);
}
function toTitle() {
  if (fight) { fight.dispose(); fight = null; }
  demo = new Fight('ekron', 'hokuto', 'demo', 1); demo.phase = 'menu';
  show('m-title');
}
function selCard(i) { charSel = i; document.querySelectorAll('.card').forEach(c => c.classList.toggle('sel', +c.dataset.c === charSel)); }
function selDiff(d) { diff = d; document.querySelectorAll('#m-diff [data-d]').forEach(b => b.classList.toggle('sel', +b.dataset.d === diff)); }
document.addEventListener('click', e => {
  Audio.init();
  const b = e.target.closest('[data-act],[data-c],[data-d]'); if (!b) return;
  play('select');
  if (b.dataset.c !== undefined) { selCard(+b.dataset.c); return; }
  if (b.dataset.d !== undefined) { selDiff(+b.dataset.d); startFight(); return; }
  const a = b.dataset.act;
  if (a === '1p' || a === '2p') { mode = a; $('seltitle').textContent = a === '1p' ? '選擇你的角色' : '1P 選擇角色（2P 用另一位）'; show('m-select'); }
  else if (a === 'help') show('m-help');
  else if (a === 'music') { Audio.music = !Audio.music; Audio.music ? Audio.startMusic() : Audio.stopMusic(); $('bmusic').textContent = '音樂：' + (Audio.music ? '開' : '關'); }
  else if (a === 'back') show(scene_ === 'm-diff' ? 'm-select' : 'm-title');
  else if (a === 'pick') { mode === '1p' ? show('m-diff') : startFight(); }
  else if (a === 'resume') { fight.paused = false; show('fight'); }
  else if (a === 'quit') toTitle();
  else if (a === 'again') startFight();
});
$('pause').addEventListener('click', e => { e.stopPropagation(); if (fight && fight.phase !== 'end') { fight.paused = true; show('m-pause'); } });
if (IS_TOUCH) $('b2p').style.display = 'none';
// keyboard menu navigation
function onMenuKey(e) {
  Audio.init();
  if (e.code === 'KeyM') { $('bmusic').click(); return; }
  if (scene_ === 'fight') { if ((e.code === 'Escape' || e.code === 'KeyP') && fight && fight.phase !== 'end') { fight.paused = true; show('m-pause'); } return; }
  const menu = $(scene_); if (!menu) return;
  const btns = [...menu.querySelectorAll('.btn')].filter(b => b.offsetParent);
  let i = btns.findIndex(b => b.classList.contains('sel')); if (i < 0) i = 0;
  if (scene_ === 'm-select' && ['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(e.code)) { selCard(charSel ^ 1); play('move'); return; }
  if (['ArrowUp', 'KeyW', 'ArrowLeft'].includes(e.code)) i = (i - 1 + btns.length) % btns.length;
  else if (['ArrowDown', 'KeyS', 'ArrowRight'].includes(e.code)) i = (i + 1) % btns.length;
  else if (['Enter', 'Space', 'KeyJ', 'KeyF', 'NumpadEnter'].includes(e.code)) { btns[i] && btns[i].click(); return; }
  else if (e.code === 'Escape' || e.code === 'Backspace') { const bk = menu.querySelector('[data-act=back],[data-act=resume],[data-act=quit]'); bk && bk.click(); return; }
  else return;
  btns.forEach((b, k) => b.classList.toggle('sel', k === i)); play('move');
}

// ---------------------------------------------------------------- main loop
let acc = 0, last = performance.now();
// merge the static stage by material: ~220 draw calls -> a few dozen (matters a lot on older phones)
function mergeStatic(root) {
  root.updateMatrixWorld(true);
  const groups = new Map();
  root.traverse(o => {
    if (!o.isMesh) return;
    const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
    const key = [o.material.uuid, Object.keys(g.attributes).sort().join(','), g.index ? 1 : 0, o.castShadow ? 1 : 0].join('|');
    if (!groups.has(key)) groups.set(key, { mat: o.material, cast: o.castShadow, geos: [] });
    groups.get(key).geos.push(g);
  });
  const out = new THREE.Group();
  for (const { mat, cast, geos } of groups.values()) {
    const merged = geos.length > 1 ? mergeGeometries(geos) : geos[0];
    if (!merged) continue;
    const m = new THREE.Mesh(merged, mat); m.castShadow = cast; m.receiveShadow = true; m.matrixAutoUpdate = false;
    out.add(m);
  }
  return out;
}
// automatic downgrade when a fight runs slow: first lower resolution, then turn shadows off
const perf = { n: 0, sum: 0, last: 0 };
function watchPerf(now) {
  if (!fight || scene_ !== 'fight' || fight.paused || QUALITY.level >= 2) { perf.n = perf.sum = 0; perf.last = now; return; }
  const dt = now - perf.last; perf.last = now;
  if (dt <= 0 || dt > 200) return;
  perf.n++; perf.sum += dt;
  if (perf.n < 150) return;
  const avg = perf.sum / perf.n; perf.n = perf.sum = 0;
  if (avg < 24) return;
  QUALITY.level++;
  if (QUALITY.level === 1) { QUALITY.pr = 1; renderer.setPixelRatio(1); resize(); }
  else { renderer.shadowMap.enabled = false; sun.castShadow = false; scene.traverse(o => { if (o.material) o.material.needsUpdate = true; }); }
}
function frame(now) {
  requestAnimationFrame(frame);
  watchPerf(now);
  acc += Math.min(100, now - last); last = now;
  while (acc >= STEP) {
    acc -= STEP;
    if (fight && scene_ === 'fight') fight.update();
    else if (demo) { demo.tick++; demo.f.forEach(fi => { fi.t++; fi.state = 'idle'; fi.updatePose(); }); demo.updateCompanion(); }
    else if (fight) { updateParticles(); }
  }
  const fg = fight || demo;
  if (fg) fg.render();
  renderer.render(scene, camera);
}

(async () => {
  try {
    const [e, h, g, s] = await Promise.all(['ekron', 'hokuto', 'giraffe', 'stage'].map(loadGLB));
    Object.assign(ASSETS, { ekron: e, hokuto: h, giraffe: g });
    s.traverse(o => { if (o.isMesh) { o.receiveShadow = true; o.castShadow = !/terrain|plaza|tile|edge|mtn|snow|hill|cloud/.test(o.name); } });
    scene.add(mergeStatic(s));
    $('load').style.display = 'none';
    toTitle();
    requestAnimationFrame(frame);
  } catch (err) {
    $('load').textContent = '載入失敗：' + err.message + '（請用 start_server.bat 開啟）';
    console.error(err);
  }
})();
window.__game = { scene, camera, THREE, renderer, QUALITY, shot(px, py, pz, tx, ty, tz) { (fight || demo).render(); camera.position.set(px, py, pz); camera.lookAt(tx, ty, tz); renderer.render(scene, camera); }, get fight() { return fight; }, step(n = 1) { for (let i = 0; i < n; i++) { if (fight && scene_ === 'fight') fight.update(); } (fight || demo).render(); renderer.render(scene, camera); return fight && [fight.phase, fight.timer, fight.f[0].hp, fight.f[1].hp, fight.wins]; }, startFight: (m = '1p', c = 0, d = 1) => { mode = m; charSel = c; diff = d; startFight(); } };
