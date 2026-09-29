import * as THREE from 'three';
import { mulberry32 } from './random';

/** Canvas helper that returns a THREE texture (sRGB for color maps). */
function canvasTexture(w, h, draw, { color = false, repeat } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  if (color) tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  if (repeat) tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = 4;
  return tex;
}

/**
 * Bump map for buttercream: soft horizontal spatula sweeps plus fine grain,
 * so light catches the frosting the way it does on a hand-finished cake.
 */
export function frostingBump() {
  return canvasTexture(512, 512, (g, w, h) => {
    const rnd = mulberry32(7);
    g.fillStyle = '#808080';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) {
      const y = rnd() * h;
      const band = 6 + rnd() * 26;
      const grad = g.createLinearGradient(0, y - band, 0, y + band);
      const v = 128 + (rnd() - 0.5) * 70;
      grad.addColorStop(0, 'rgba(128,128,128,0)');
      grad.addColorStop(0.5, `rgba(${v},${v},${v},0.55)`);
      grad.addColorStop(1, 'rgba(128,128,128,0)');
      g.fillStyle = grad;
      const x = rnd() * w;
      g.fillRect(x - w, y - band, w * (0.6 + rnd()), band * 2);
      g.fillRect(x, y - band, w * (0.6 + rnd()), band * 2);
    }
    const img = g.getImageData(0, 0, w, h);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (rnd() - 0.5) * 18;
      img.data[i] += n;
      img.data[i + 1] += n;
      img.data[i + 2] += n;
    }
    g.putImageData(img, 0, 0);
  }, { repeat: [3, 1] });
}

/** Strawberry skin: glossy red with pale seed pits (used as both map and bump). */
export function strawberryMaps() {
  const draw = (asBump) => (g, w, h) => {
    const rnd = mulberry32(asBump ? 3 : 3);
    if (asBump) {
      g.fillStyle = '#9a9a9a';
    } else {
      const grad = g.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#d8243c');
      grad.addColorStop(0.75, '#c3122d');
      grad.addColorStop(1, '#e9707a');
      g.fillStyle = grad;
    }
    g.fillRect(0, 0, w, h);
    const cols = 14;
    const rows = 12;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = ((c + (r % 2) * 0.5) / cols) * w + (rnd() - 0.5) * 4;
        const y = ((r + 0.5) / rows) * h * 0.92 + (rnd() - 0.5) * 4;
        g.beginPath();
        g.ellipse(x, y, 2.6, 3.6, 0, 0, Math.PI * 2);
        g.fillStyle = asBump ? '#3a3a3a' : '#f2c46a';
        g.fill();
        if (!asBump) {
          g.beginPath();
          g.ellipse(x, y - 1, 1.2, 1.6, 0, 0, Math.PI * 2);
          g.fillStyle = '#fff1c0';
          g.fill();
        }
      }
    }
  };
  return {
    map: canvasTexture(256, 256, draw(false), { color: true }),
    bump: canvasTexture(256, 256, draw(true)),
  };
}

/**
 * Cut-face texture for the "see inside" slice. Layers run bottom → top:
 * sponge / filling / sponge / filling / sponge, frosting rim on the outside
 * edge and on top. The shape geometry maps x ∈ [0,R], y ∈ [0,H] onto it.
 */
export function sliceTexture({ sponge, filling, frosting, R, H }) {
  const tex = canvasTexture(512, 512, (g, w, h) => {
    const rnd = mulberry32(11);
    g.fillStyle = frosting;
    g.fillRect(0, 0, w, h);
    const rimX = w * (1 - 0.07 / R);
    const topY = h * (0.07 / H);
    const body = h - topY;
    const layers = [0.3, 0.07, 0.26, 0.07, 0.3];
    let y = h;
    layers.forEach((frac, i) => {
      const lh = body * frac;
      const isSponge = i % 2 === 0;
      g.fillStyle = isSponge ? sponge : filling;
      g.fillRect(0, y - lh, rimX, lh);
      if (isSponge) {
        // crumb: tiny darker and lighter pores
        for (let k = 0; k < 900; k++) {
          const px = rnd() * rimX;
          const py = y - rnd() * lh;
          g.fillStyle = rnd() > 0.5 ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.12)';
          g.beginPath();
          g.arc(px, py, 0.6 + rnd() * 1.6, 0, Math.PI * 2);
          g.fill();
        }
      }
      y -= lh;
    });
    // soft frosting edge between layers and rim
    const edge = g.createLinearGradient(rimX - 8, 0, rimX + 2, 0);
    edge.addColorStop(0, 'rgba(255,255,255,0)');
    edge.addColorStop(1, frosting);
    g.fillStyle = edge;
    g.fillRect(rimX - 8, topY, 10, h - topY);
  }, { color: true });
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.repeat.set(1 / R, 1 / H);
  return tex;
}
