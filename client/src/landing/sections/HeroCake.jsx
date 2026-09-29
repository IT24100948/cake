import { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import * as THREE from 'three';
import CakeStage from '../three/CakeStage';
import Cake from '../three/Cake';
import { HERO_CONFIG, HERO_TIERS } from '../cakeOptions';
import LineIcon from '../../components/site/LineIcon';

const DEG = Math.PI / 180;
const damp = THREE.MathUtils.damp;

/**
 * Drives the hero cake: idle float, pointer tilt (±8° X / ±12° Y, critically
 * damped), drag-to-spin with inertia, a key light that follows the pointer so
 * the glaze highlight moves, and a scroll-linked quarter turn + dolly-in.
 */
function Rig({ input, progress, keyLight, reduced, coarse }) {
  const group = useRef();
  const { camera, size } = useThree();
  const state = useRef({ rx: 0, ry: 0, spin: 0, vel: 0 });

  useFrame(({ clock }, dt) => {
    const g = group.current;
    if (!g) return;
    const s = state.current;
    const p = input.current;
    const scroll = reduced ? 0 : progress.get();

    if (!p.dragging) {
      s.spin += s.vel * dt;
      s.vel = damp(s.vel, 0, 2.2, dt);
      if (coarse && !reduced) s.spin += dt * 0.22; // gentle turntable on touch devices
    }
    s.spin += p.dragDelta;
    if (p.dragging) s.vel = THREE.MathUtils.clamp(p.dragDelta / Math.max(dt, 1 / 120), -6, 6);
    p.dragDelta = 0;

    const follow = !reduced && !coarse;
    const tx = follow ? p.y * 8 * DEG : 0;
    const ty = follow ? p.x * 12 * DEG : 0;
    s.rx = damp(s.rx, tx, 5, dt);
    s.ry = damp(s.ry, ty, 5, dt);

    const float = reduced ? 0 : Math.sin((clock.elapsedTime * Math.PI * 2) / 6) * 0.055;
    g.position.y = float;
    g.rotation.x = s.rx;
    g.rotation.y = s.ry + s.spin + scroll * 12 * DEG - 0.35;

    if (keyLight.current) {
      keyLight.current.position.x = damp(keyLight.current.position.x, 3.2 + (follow ? p.x * 1.6 : 0), 3, dt);
      keyLight.current.position.y = damp(keyLight.current.position.y, 5.2 - (follow ? p.y * 0.8 : 0), 3, dt);
    }
    // Pull back on narrow canvases so the stand never crops.
    const baseZ = 6.3 * Math.max(1, 0.98 / (size.width / size.height));
    camera.position.z = baseZ - scroll * 0.55;
    camera.position.y = 3.05 - scroll * 0.25;
    camera.lookAt(0, 1.2 + scroll * 0.05, 0);
  });

  return (
    <group ref={group}>
      <Cake config={HERO_CONFIG} tiers={HERO_TIERS} reduced={reduced} fitHeight={2.6} />
    </group>
  );
}

export default function HeroCake({ progress, reduced }) {
  const input = useRef({ x: 0, y: 0, dragging: false, dragDelta: 0, lastX: 0 });
  const keyLight = useRef();
  const wrap = useRef(null);
  const [coarse] = useState(() => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches);
  const [hover, setHover] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const cx = useMotionValue(0);
  const cy = useMotionValue(0);
  const sx = useSpring(cx, { stiffness: 500, damping: 40 });
  const sy = useSpring(cy, { stiffness: 500, damping: 40 });

  // Pointer anywhere over the hero steers the cake; normalised to the cake's box.
  useEffect(() => {
    const onMove = (e) => {
      const r = wrap.current?.getBoundingClientRect();
      if (!r) return;
      input.current.x = THREE.MathUtils.clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1.2, 1.2);
      input.current.y = THREE.MathUtils.clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1.2, 1.2);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  const onPointerDown = (e) => {
    input.current.dragging = true;
    input.current.lastX = e.clientX;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setInteracted(true);
  };
  const onPointerMove = (e) => {
    const r = wrap.current.getBoundingClientRect();
    cx.set(e.clientX - r.left);
    cy.set(e.clientY - r.top);
    if (!input.current.dragging) return;
    input.current.dragDelta += (e.clientX - input.current.lastX) * 0.0085;
    input.current.lastX = e.clientX;
  };
  const endDrag = () => { input.current.dragging = false; };

  return (
    <div
      ref={wrap}
      className={`hero-cake${hover && !coarse ? ' has-cursor' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => { setHover(false); endDrag(); }}
    >
      <CakeStage className="hero-canvas" keyLightRef={keyLight} camera={{ position: [0, 3.05, 6.3], fov: 30 }} lookY={1.2} label="A strawberry drip celebration cake on a white ceramic stand. Drag to turn it.">
        <Rig input={input} progress={progress} keyLight={keyLight} reduced={reduced} coarse={coarse} />
      </CakeStage>

      {!coarse && (
        <motion.div className="cake-cursor" style={{ x: sx, y: sy }} animate={{ opacity: hover ? 1 : 0, scale: hover ? 1 : 0.6 }} transition={{ duration: 0.25 }} aria-hidden="true">
          <LineIcon name="drag" size={18} />
          <span>Drag</span>
        </motion.div>
      )}
      <motion.div className="drag-hint" animate={{ opacity: interacted ? 0 : 1 }} transition={{ duration: 0.6 }} aria-hidden="true">
        <LineIcon name="drag" size={16} /> Drag to explore
      </motion.div>
    </div>
  );
}
