import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  dripLayout, glazeCapGeometry, leafGeometry, profileShape, rosetteGeometry, standGeometry,
  STAND_TOP, strawberryGeometry, tierGeometry,
} from './geometry';
import { frostingBump, sliceTexture, strawberryMaps } from './textures';
import { mulberry32 } from './random';
import { getFlavor, getFrosting, getSize } from '../cakeOptions';

const TAU = Math.PI * 2;
export const CUT_CENTER = 0.5;
const CUT_WIDTH = 1.05;

const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const inCut = (phi, margin = 0.12) => Math.abs(angleDiff(phi, CUT_CENTER)) < CUT_WIDTH / 2 + margin;
const polar = (r, phi, y) => [r * Math.sin(phi), y, r * Math.cos(phi)];
const easeOutBack = (p) => { const c1 = 1.5; const c3 = c1 + 1; return 1 + c3 * (p - 1) ** 3 + c1 * (p - 1) ** 2; };

/** Shared geometries (created once per page). */
let SHARED;
function shared() {
  if (!SHARED) {
    SHARED = {
      rosette: rosetteGeometry(),
      berry: strawberryGeometry(),
      leaf: leafGeometry(),
      pearl: new THREE.SphereGeometry(1, 16, 12),
      petal: (() => { const g = new THREE.SphereGeometry(1, 16, 10); g.scale(0.052, 0.018, 0.085); g.translate(0, 0, 0.06); return g; })(),
      bud: new THREE.SphereGeometry(0.018, 10, 8),
      candle: new THREE.CylinderGeometry(0.022, 0.022, 0.32, 20),
      wick: new THREE.CylinderGeometry(0.003, 0.003, 0.03, 6),
      flame: (() => { const g = new THREE.SphereGeometry(0.022, 16, 12); g.scale(1, 2.1, 1); return g; })(),
      drip: new Map(),
    };
  }
  return SHARED;
}

function useMaterials() {
  return useMemo(() => {
    const berry = strawberryMaps();
    const bump = frostingBump();
    return {
      frosting: new THREE.MeshPhysicalMaterial({
        color: '#FBF0E1', roughness: 0.6, sheen: 0.8, sheenRoughness: 0.5, sheenColor: new THREE.Color('#ffffff'),
        clearcoat: 0.05, clearcoatRoughness: 0.6, bumpMap: bump, bumpScale: 2.6, side: THREE.DoubleSide,
      }),
      glaze: new THREE.MeshPhysicalMaterial({
        color: '#E4507F', roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.05, sheen: 0.2, side: THREE.DoubleSide,
      }),
      rosetteA: new THREE.MeshPhysicalMaterial({ color: '#FBF0E1', roughness: 0.55, sheen: 0.9, sheenRoughness: 0.4, sheenColor: new THREE.Color('#ffffff') }),
      rosetteB: new THREE.MeshPhysicalMaterial({ color: '#F7C9D4', roughness: 0.55, sheen: 0.9, sheenRoughness: 0.4, sheenColor: new THREE.Color('#ffffff') }),
      pearl: new THREE.MeshPhysicalMaterial({ color: '#FFF6EC', roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1, sheen: 0.5, sheenColor: new THREE.Color('#ffe7ef') }),
      gold: new THREE.MeshStandardMaterial({ color: '#D8AE62', metalness: 1, roughness: 0.28 }),
      strawberry: new THREE.MeshPhysicalMaterial({ map: berry.map, bumpMap: berry.bump, bumpScale: 1.5, roughness: 0.3, clearcoat: 0.9, clearcoatRoughness: 0.12 }),
      leaf: new THREE.MeshStandardMaterial({ color: '#4E7F3F', roughness: 0.5 }),
      petalBlush: new THREE.MeshPhysicalMaterial({ color: '#F6BACB', roughness: 0.6, sheen: 1, sheenColor: new THREE.Color('#fff0f4'), side: THREE.DoubleSide }),
      petalRose: new THREE.MeshPhysicalMaterial({ color: '#E48AA6', roughness: 0.6, sheen: 1, sheenColor: new THREE.Color('#ffd9e4'), side: THREE.DoubleSide }),
      petalIvory: new THREE.MeshPhysicalMaterial({ color: '#FFF3E8', roughness: 0.6, sheen: 1, sheenColor: new THREE.Color('#ffffff'), side: THREE.DoubleSide }),
      pollen: new THREE.MeshStandardMaterial({ color: '#E7BF63', roughness: 0.7 }),
      breath: new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.65 }),
      candle: new THREE.MeshPhysicalMaterial({ color: '#FFF1E3', roughness: 0.4, clearcoat: 0.4 }),
      wick: new THREE.MeshStandardMaterial({ color: '#2b1a12' }),
      flame: new THREE.MeshBasicMaterial({ color: '#FFC862', toneMapped: false, transparent: true, opacity: 0.95 }),
      stand: new THREE.MeshPhysicalMaterial({ color: '#FFFFFF', roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.06 }),
    };
  }, []);
}

/** Scales its children in with a soft overshoot after `delay` seconds. */
function Pop({ delay = 0, reduced, children, ...props }) {
  const ref = useRef();
  const start = useRef(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    if (reduced) { ref.current.scale.setScalar(1); return; }
    if (start.current === null) start.current = clock.elapsedTime;
    const p = Math.min(1, Math.max(0, (clock.elapsedTime - start.current - delay) / 0.55));
    ref.current.scale.setScalar(p === 0 ? 0.0001 : easeOutBack(p));
  });
  return <group ref={ref} scale={reduced ? 1 : 0.0001} {...props}>{children}</group>;
}

function Rosette({ position, scale = 1, material, rotation = 0 }) {
  const { rosette } = shared();
  return <mesh geometry={rosette} material={material} position={position} scale={scale} rotation={[0, rotation, 0]} castShadow />;
}

function Strawberry({ position, rotation = [0, 0, 0], scale = 1, mats }) {
  const { berry, leaf } = shared();
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh geometry={berry} material={mats.strawberry} castShadow />
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} geometry={leaf} material={mats.leaf} position={[0, 0.162, 0]} rotation={[-0.35, (i / 5) * TAU, 0]} />
      ))}
    </group>
  );
}

function BabysBreath({ position, seed = 1, mats, spread = 0.07 }) {
  const { bud } = shared();
  const pts = useMemo(() => {
    const rnd = mulberry32(seed);
    return Array.from({ length: 9 }, () => [(rnd() - 0.5) * spread, rnd() * 0.05, (rnd() - 0.5) * spread, 0.7 + rnd() * 0.6]);
  }, [seed, spread]);
  return (
    <group position={position}>
      {pts.map(([x, y, z, s], i) => <mesh key={i} geometry={bud} material={mats.breath} position={[x, y, z]} scale={s} />)}
    </group>
  );
}

function SugarFlower({ position, rotation = [0, 0, 0], scale = 1, petal, mats }) {
  const { petal: petalGeo, pearl } = shared();
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} geometry={petalGeo} material={petal} rotation={[0.35, (i / 5) * TAU, 0]} castShadow />
      ))}
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={`i${i}`} geometry={petalGeo} material={petal} rotation={[0.9, (i / 5) * TAU + 0.6, 0]} scale={0.62} position={[0, 0.012, 0]} />
      ))}
      <mesh geometry={pearl} material={mats.pollen} scale={0.03} position={[0, 0.03, 0]} />
    </group>
  );
}

function Candle({ position, mats, reduced }) {
  const { candle, wick, flame, pearl } = shared();
  const flameRef = useRef();
  const seed = useMemo(() => Math.random() * 10, []);
  useFrame(({ clock }) => {
    if (!flameRef.current || reduced) return;
    const t = clock.elapsedTime * 9 + seed;
    flameRef.current.scale.set(1 + Math.sin(t) * 0.06, 1 + Math.sin(t * 1.7) * 0.1, 1);
    flameRef.current.rotation.z = Math.sin(t * 0.8) * 0.08;
  });
  return (
    <group position={position}>
      <mesh geometry={candle} material={mats.candle} position={[0, 0.16, 0]} castShadow />
      <mesh geometry={pearl} material={mats.gold} scale={[0.026, 0.008, 0.026]} position={[0, 0.2, 0]} />
      <mesh geometry={wick} material={mats.wick} position={[0, 0.335, 0]} />
      <mesh ref={flameRef} geometry={flame} material={mats.flame} position={[0, 0.385, 0]} />
    </group>
  );
}

function PearlRing({ R, y, count, size, material, cut }) {
  const ref = useRef();
  const { pearl } = shared();
  const items = useMemo(() => {
    const list = [];
    for (let i = 0; i < count; i++) {
      const phi = (i / count) * TAU;
      if (cut && inCut(phi, 0.03)) continue;
      list.push(phi);
    }
    return list;
  }, [count, cut]);
  useEffect(() => {
    const m = new THREE.Matrix4();
    items.forEach((phi, i) => {
      m.compose(new THREE.Vector3(...polar(R, phi, y)), new THREE.Quaternion(), new THREE.Vector3(size, size, size));
      ref.current.setMatrixAt(i, m);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  }, [items, R, y, size]);
  return <instancedMesh ref={ref} args={[pearl, material, items.length]} key={items.length} castShadow />;
}

function Drips({ R, H, seed, glaze, cut, maxLen }) {
  const s = shared();
  const drips = useMemo(() => dripLayout(R, H, { seed, maxLen, skip: cut ? (phi) => inCut(phi, 0.02) : () => false }), [R, H, seed, cut, maxLen]);
  const top = H - 0.07;
  return drips.map(({ phi, len, w }, i) => {
    const key = `${w.toFixed(3)}-${len.toFixed(3)}`;
    if (!s.drip.has(key)) s.drip.set(key, new THREE.CapsuleGeometry(w, len, 6, 14));
    return (
      <group key={i} position={polar(R + 0.004, phi, 0)} rotation={[0, phi, 0]}>
        <mesh geometry={s.drip.get(key)} material={glaze} position={[0, top - len / 2, 0]} scale={[1, 1, 0.42]} />
        <mesh geometry={s.pearl} material={glaze} position={[0, top - len - w * 0.35, 0.004]} scale={[w * 1.2, w * 1.25, w * 0.6]} />
      </group>
    );
  });
}

function Tier({ R, H, y, mats, cut, sliceMat, seed, dripLen }) {
  const phiStart = cut ? CUT_CENTER + CUT_WIDTH / 2 : 0;
  const phiLength = cut ? TAU - CUT_WIDTH : TAU;
  const body = useMemo(() => tierGeometry(R, H, { phiStart, phiLength, seed }), [R, H, phiStart, phiLength, seed]);
  const cap = useMemo(() => glazeCapGeometry(R, H, { phiStart, phiLength }), [R, H, phiStart, phiLength]);
  const face = useMemo(() => new THREE.ShapeGeometry(profileShape(R, H), 12), [R, H]);
  useEffect(() => () => { body.dispose(); cap.dispose(); face.dispose(); }, [body, cap, face]);
  return (
    <group position={[0, y, 0]}>
      <mesh geometry={body} material={mats.frosting} castShadow receiveShadow />
      <mesh geometry={cap} material={mats.glaze} castShadow />
      <Drips R={R} H={H} seed={seed * 7} glaze={mats.glaze} cut={cut} maxLen={dripLen} />
      <PearlRing R={R + 0.018} y={0.024} count={Math.round(R * 70)} size={0.026} material={mats.pearl} cut={cut} />
      {cut && sliceMat && (
        <>
          <mesh geometry={face} material={sliceMat} rotation={[0, CUT_CENTER - CUT_WIDTH / 2 - Math.PI / 2, 0]} />
          <mesh geometry={face} material={sliceMat} rotation={[0, CUT_CENTER + CUT_WIDTH / 2 - Math.PI / 2, 0]} />
        </>
      )}
    </group>
  );
}

/** Topper arrangement for the top tier. */
function Decorations({ type, R, y, mats, cut, reduced }) {
  const ok = (phi) => !cut || !inCut(phi);
  const rnd = mulberry32(21);
  const items = [];

  if (type === 'strawberry' || type === 'celebration') {
    const n = type === 'strawberry' ? 11 : 9;
    for (let i = 0; i < n; i++) {
      const phi = (i / n) * TAU + 0.2;
      if (!ok(phi)) continue;
      items.push(
        <Pop key={`r${i}`} delay={0.03 * i} reduced={reduced} position={polar(R - 0.17, phi, y)}>
          <Rosette position={[0, 0, 0]} material={i % 2 ? mats.rosetteB : mats.rosetteA} scale={1.32 + (i % 3) * 0.08} rotation={phi} />
        </Pop>,
      );
    }
  }

  if (type === 'strawberry') {
    const berries = [
      [0.05, 0.04, 0.2, [0.4, 0.3, 0.9]], [-0.22, 0.02, 0.05, [-0.2, 1.2, 0.5]], [0.2, 0.02, -0.16, [0.9, -0.4, 0.2]],
      [-0.08, 0.02, -0.26, [0.3, 2, -0.7]], [0.28, 0.02, 0.12, [-0.7, 0.8, -0.2]], [-0.26, 0.03, 0.3, [0.5, -1, 0.3]],
      [0.02, 0.1, -0.02, [0.1, 0.5, 0.1]],
    ];
    berries.forEach(([x, dy, z, rot], i) => {
      if (!ok(Math.atan2(x, z)) && Math.hypot(x, z) > 0.2) return;
      items.push(
        <Pop key={`b${i}`} delay={0.25 + i * 0.05} reduced={reduced} position={[x * R, y + dy, z * R]}>
          <Strawberry position={[0, 0, 0]} rotation={rot} scale={1.55} mats={mats} />
        </Pop>,
      );
    });
    [[0.3, 0.3], [-0.35, -0.1], [0.1, -0.38], [-0.1, 0.42]].forEach(([x, z], i) => {
      if (!ok(Math.atan2(x, z))) return;
      items.push(
        <Pop key={`bb${i}`} delay={0.5 + i * 0.05} reduced={reduced} position={[x * R, y + 0.05, z * R]}>
          <BabysBreath position={[0, 0, 0]} seed={i + 3} mats={mats} />
        </Pop>,
      );
    });
  }

  if (type === 'floral') {
    const petals = [mats.petalBlush, mats.petalRose, mats.petalIvory];
    // crown cluster on the top edge, cascading down the front-left wall
    const crown = [[-0.9, 0.0, 1.2], [-0.55, 0.02, 1.05], [-1.2, 0.03, 0.95], [-0.72, 0.06, 0.8], [-1.05, 0.02, 0.75]];
    crown.forEach(([phi, dy, s], i) => {
      if (!ok(phi)) return;
      const r = R - 0.14 - (i % 2) * 0.12;
      items.push(
        <Pop key={`f${i}`} delay={i * 0.06} reduced={reduced} position={polar(r, phi, y + dy)}>
          <SugarFlower position={[0, 0, 0]} rotation={[-0.25, phi, 0.15 * (i - 2)]} scale={s * 1.25} petal={petals[i % 3]} mats={mats} />
        </Pop>,
      );
    });
    const cascade = [[-0.8, -0.25, 1], [-0.62, -0.5, 0.85], [-0.9, -0.72, 0.75], [-0.55, -0.92, 0.65]];
    cascade.forEach(([phi, dy, s], i) => {
      if (!ok(phi)) return;
      items.push(
        <Pop key={`c${i}`} delay={0.3 + i * 0.07} reduced={reduced} position={polar(R + 0.03, phi, y + dy)}>
          <SugarFlower position={[0, 0, 0]} rotation={[Math.PI / 2 - 0.2, 0, -phi]} scale={s} petal={petals[(i + 1) % 3]} mats={mats} />
        </Pop>,
      );
    });
    for (let i = 0; i < 9; i++) {
      const phi = -1.35 + i * 0.12 + (rnd() - 0.5) * 0.1;
      if (!ok(phi)) continue;
      items.push(
        <Pop key={`l${i}`} delay={0.2 + i * 0.03} reduced={reduced} position={polar(R - 0.05, phi, y + 0.03)}>
          <mesh geometry={shared().leaf} material={mats.leaf} rotation={[0.3, phi + (i % 2 ? 0.9 : -0.9), 0]} scale={1.6} />
        </Pop>,
      );
    }
    [[-0.4, 1], [-1.3, 2], [-0.7, 3]].forEach(([phi, seed], i) => {
      if (!ok(phi)) return;
      items.push(
        <Pop key={`bb${i}`} delay={0.45 + i * 0.05} reduced={reduced} position={polar(R - 0.3, phi, y + 0.02)}>
          <BabysBreath position={[0, 0, 0]} seed={seed} mats={mats} spread={0.12} />
        </Pop>,
      );
    });
  }

  if (type === 'celebration') {
    [[0, 0], [0.28, 0.9], [0.28, 2.15], [0.28, 3.4], [0.28, 4.65], [0.28, 5.6]].forEach(([r, phi], i) => {
      if (r > 0 && !ok(phi)) return;
      items.push(
        <Pop key={`k${i}`} delay={0.2 + i * 0.06} reduced={reduced} position={polar(r * R, phi, y)}>
          <Candle position={[0, 0, 0]} mats={mats} reduced={reduced} />
        </Pop>,
      );
    });
    for (let i = 0; i < 46; i++) {
      const phi = rnd() * TAU;
      const r = Math.sqrt(rnd()) * (R - 0.3);
      if (!ok(phi)) continue;
      items.push(
        <mesh key={`g${i}`} geometry={shared().pearl} material={mats.gold} position={polar(r, phi, y + 0.012)} scale={0.012 + rnd() * 0.008} />,
      );
    }
  }

  if (type === 'minimal') {
    items.push(<PearlRing key="top" R={R - 0.05} y={y + 0.02} count={Math.round(R * 60)} size={0.022} material={mats.pearl} cut={cut} />);
    items.push(<PearlRing key="gold" R={R - 0.12} y={y + 0.012} count={Math.round(R * 40)} size={0.008} material={mats.gold} cut={cut} />);
  }

  return <group>{items}</group>;
}

/**
 * The parametric cake: stand + stacked tiers + glaze drips + decorations.
 * `cut` removes a wedge to show the sponge and fillings of the chosen flavour.
 */
export default function Cake({ config, cut = false, reduced = false, fitHeight = 2.55, tiers: tiersOverride }) {
  const mats = useMaterials();
  const size = getSize(config.size);
  const flavor = getFlavor(config.flavor);
  const frosting = getFrosting(config.frosting);
  const group = useRef();
  const popStart = useRef(-10);
  const key = `${config.size}|${config.decoration}|${config.flavor}|${config.frosting}|${cut}`;

  // Colour targets, lerped every frame so option changes melt rather than snap.
  const targets = useMemo(() => {
    const light = new THREE.Color(frosting.color).lerp(new THREE.Color('#ffffff'), 0.35);
    return {
      frosting: new THREE.Color(frosting.color),
      glaze: new THREE.Color(flavor.drip),
      rosetteA: light,
      rosetteB: config.frosting === 'chocolate' ? new THREE.Color('#8A5540') : new THREE.Color(config.flavor === 'strawberry' ? '#F4A9BC' : '#F7D7DF'),
    };
  }, [frosting.color, flavor.drip, config.frosting, config.flavor]);

  const tiers = useMemo(() => {
    let y = STAND_TOP;
    return (tiersOverride || size.tiers).map((t, i) => {
      const tier = { ...t, y, seed: i + 2 };
      y += t.h;
      return tier;
    });
  }, [size, tiersOverride]);
  const top = tiers[tiers.length - 1];
  const topY = top.y + top.h + 0.012;
  const plateR = tiers[0].r + 0.32;
  const standGeo = useMemo(() => standGeometry(plateR), [plateR]);
  const fit = Math.min(1, fitHeight / (topY + (config.decoration === 'celebration' ? 0.35 : 0.15)), 1.45 / plateR);

  const sliceMats = useMemo(() => {
    if (!cut) return null;
    return tiers.map((t) => new THREE.MeshStandardMaterial({
      map: sliceTexture({ sponge: flavor.sponge, filling: flavor.filling, frosting: frosting.color, R: t.r, H: t.h }),
      roughness: 0.85,
      side: THREE.DoubleSide,
    }));
  }, [cut, tiers, flavor.sponge, flavor.filling, frosting.color]);
  useEffect(() => () => sliceMats?.forEach((m) => { m.map.dispose(); m.dispose(); }), [sliceMats]);

  useEffect(() => { popStart.current = -1; }, [key]);

  useFrame(({ clock }, dt) => {
    const k = reduced ? 1 : 1 - Math.exp(-dt * 7);
    mats.frosting.color.lerp(targets.frosting, k);
    mats.glaze.color.lerp(targets.glaze, k);
    mats.rosetteA.color.lerp(targets.rosetteA, k);
    mats.rosetteB.color.lerp(targets.rosetteB, k);
    if (!group.current) return;
    if (popStart.current === -1) popStart.current = clock.elapsedTime;
    const t = clock.elapsedTime - popStart.current;
    const squash = reduced || t > 1.2 ? 0 : Math.exp(-t * 6) * Math.cos(t * 16) * 0.035;
    group.current.scale.set(fit * (1 + squash * 0.6), fit * (1 - squash), fit * (1 + squash * 0.6));
  });

  return (
    <group ref={group} scale={fit}>
      <mesh geometry={standGeo} material={mats.stand} castShadow receiveShadow />
      {tiers.map((t, i) => (
        <Tier key={`${config.size}-${tiersOverride ? 'o' : ''}-${i}`} R={t.r} H={t.h} y={t.y} mats={mats} cut={cut} sliceMat={sliceMats?.[i]} seed={t.seed}
          dripLen={i === tiers.length - 1 ? 0.55 : 0.32} />
      ))}
      <Decorations key={`${config.decoration}-${config.size}-${cut}`} type={config.decoration} R={top.r} y={topY} mats={mats} cut={cut} reduced={reduced} />
    </group>
  );
}
