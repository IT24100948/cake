import * as THREE from 'three';
import { mulberry32 } from './random';

const TAU = Math.PI * 2;

/**
 * Side profile of one frosted tier: flat base, straight wall, rounded
 * buttercream shoulder, flat top. Returned as Vector2(radius, height).
 */
export function tierProfile(R, H, shoulder = 0.07) {
  const pts = [new THREE.Vector2(0, 0), new THREE.Vector2(R - 0.01, 0), new THREE.Vector2(R, 0.015)];
  const wallSteps = 10;
  for (let i = 1; i <= wallSteps; i++) pts.push(new THREE.Vector2(R, 0.015 + ((H - shoulder - 0.015) * i) / wallSteps));
  const arcSteps = 8;
  for (let i = 1; i <= arcSteps; i++) {
    const t = (i / arcSteps) * (Math.PI / 2);
    pts.push(new THREE.Vector2(R - shoulder + shoulder * Math.cos(t), H - shoulder + shoulder * Math.sin(t)));
  }
  pts.push(new THREE.Vector2((R - shoulder) * 0.5, H + 0.004));
  pts.push(new THREE.Vector2(0, H + 0.006));
  return pts;
}

/**
 * Lathe with a hand-finished wobble on the wall so the frosting does not look
 * machine-perfect. phiStart/phiLength allow a wedge to be cut out.
 */
export function tierGeometry(R, H, { phiStart = 0, phiLength = TAU, seed = 1 } = {}) {
  const geo = new THREE.LatheGeometry(tierProfile(R, H), 128, phiStart, phiLength);
  const pos = geo.attributes.position;
  const rnd = mulberry32(seed);
  const p1 = rnd() * TAU;
  const p2 = rnd() * TAU;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const r = Math.hypot(x, z);
    if (r < R * 0.8 || y < 0.02) continue;
    const phi = Math.atan2(x, z);
    const k = 1 + 0.0045 * Math.sin(3 * phi + p1 + y * 3) + 0.003 * Math.sin(7 * phi - y * 8 + p2);
    pos.setX(i, x * k);
    pos.setZ(i, z * k);
  }
  geo.computeVertexNormals();
  return geo;
}

/** Glossy glaze cap poured over the top and just past the shoulder. */
export function glazeCapGeometry(R, H, { phiStart = 0, phiLength = TAU } = {}) {
  const t = 0.014;
  const s = 0.07;
  const pts = [];
  pts.push(new THREE.Vector2(R + t * 0.9, H - 0.11));
  pts.push(new THREE.Vector2(R + t, H - s));
  for (let i = 1; i <= 8; i++) {
    const a = (i / 8) * (Math.PI / 2);
    pts.push(new THREE.Vector2(R - s + (s + t) * Math.cos(a), H - s + (s + t) * Math.sin(a)));
  }
  pts.push(new THREE.Vector2((R - s) * 0.5, H + t + 0.004));
  pts.push(new THREE.Vector2(0, H + t + 0.006));
  const geo = new THREE.LatheGeometry(pts.reverse(), 128, phiStart, phiLength);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Drip positions around a tier. Real drips alternate long and short with
 * irregular spacing; `skip(phi)` removes drips inside a cut wedge.
 */
export function dripLayout(R, H, { seed = 3, maxLen = 0.5, skip = () => false } = {}) {
  const rnd = mulberry32(seed);
  const count = Math.round(R * 26);
  const out = [];
  for (let i = 0; i < count; i++) {
    const phi = ((i + (rnd() - 0.5) * 0.5) / count) * TAU;
    if (skip(phi)) continue;
    const roll = rnd();
    const long = roll > 0.78 ? 1 : roll > 0.45 ? 0.55 : roll > 0.15 ? 0.3 : 0.14;
    const len = Math.min(H * 0.72, maxLen * long * (0.75 + rnd() * 0.4));
    const w = 0.03 + rnd() * 0.022;
    out.push({ phi, len, w });
  }
  return out;
}

/**
 * Piped star-tip rosette: a dollop profile, lathed, then fluted with ridges
 * that twist as they rise, the way buttercream leaves a star nozzle.
 */
export function rosetteGeometry() {
  const prof = [
    [0, 0], [0.1, 0], [0.118, 0.022], [0.116, 0.05], [0.1, 0.082], [0.075, 0.108],
    [0.048, 0.128], [0.024, 0.143], [0.008, 0.152], [0, 0.155],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const geo = new THREE.LatheGeometry(prof, 72);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const phi = Math.atan2(x, z);
    const h = y / 0.155;
    const ridge = 1 + 0.16 * Math.cos(8 * phi + h * 8.5) * (1 - h * 0.45);
    pos.setX(i, x * ridge);
    pos.setZ(i, z * ridge);
  }
  geo.computeVertexNormals();
  return geo;
}

/** Strawberry body (tip at y=0), lathed from a rounded heart profile. */
export function strawberryGeometry() {
  const prof = [
    [0, 0], [0.018, 0.008], [0.042, 0.03], [0.064, 0.062], [0.078, 0.095], [0.082, 0.122],
    [0.074, 0.143], [0.055, 0.158], [0.03, 0.166], [0, 0.168],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const geo = new THREE.LatheGeometry(prof, 40);
  geo.computeVertexNormals();
  return geo;
}

/** Leaf for strawberry calyx and floral greenery: a flattened, pointed ellipsoid. */
export function leafGeometry() {
  const geo = new THREE.SphereGeometry(0.05, 12, 8);
  geo.scale(0.45, 0.12, 1);
  geo.translate(0, 0, 0.045);
  return geo;
}

/** White ceramic cake stand: foot, fluted stem, wide plate with a lip. */
export function standGeometry(plateR) {
  const pts = [
    [0, 0], [0.5, 0], [0.56, 0.012], [0.57, 0.035], [0.52, 0.06], [0.34, 0.1], [0.19, 0.15],
    [0.13, 0.22], [0.115, 0.42], [0.13, 0.5], [0.2, 0.56], [plateR * 0.55, 0.6],
    [plateR * 0.95, 0.625], [plateR, 0.64], [plateR + 0.02, 0.665], [plateR - 0.01, 0.68],
    [plateR * 0.5, 0.672], [0, 0.672],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const geo = new THREE.LatheGeometry(pts, 96);
  geo.computeVertexNormals();
  return geo;
}

export const STAND_TOP = 0.672;

/** Shape of the tier profile (for the flat cut faces of a sliced cake). */
export function profileShape(R, H) {
  const pts = tierProfile(R, H);
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  pts.slice(1).forEach((p) => shape.lineTo(p.x, p.y));
  shape.lineTo(0, 0);
  return shape;
}
