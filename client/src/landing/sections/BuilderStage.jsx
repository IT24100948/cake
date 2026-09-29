import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import CakeStage from '../three/CakeStage';
import Cake, { CUT_CENTER } from '../three/Cake';
import { describe } from '../cakeOptions';

const TAU = Math.PI * 2;

/**
 * Slow turntable while whole. When sliced, it eases to the nearest angle that
 * turns the cut toward the viewer, with a gentle sway. Drag to turn it yourself.
 */
function Turntable({ cut, reduced, children }) {
  const g = useRef();
  const drag = useRef({ on: false, last: 0, offset: 0 });
  // Opening the slice always presents the cut face-on, whatever the turntable angle.
  useEffect(() => { if (cut) drag.current.offset = 0; }, [cut]);
  useFrame((state, dt) => {
    if (!g.current) return;
    const d = drag.current;
    if (!d.on && !reduced && !cut) d.offset += dt * 0.18;
    const sway = cut && !reduced ? Math.sin(state.clock.elapsedTime * 0.35) * 0.12 : 0;
    let target = (cut ? -CUT_CENTER + sway : 0) + d.offset;
    const cur = g.current.rotation.y;
    target += Math.round((cur - target) / TAU) * TAU;
    g.current.rotation.y = THREE.MathUtils.damp(cur, target, 3, dt);
  });
  return (
    <group
      ref={g}
      onPointerDown={(e) => { drag.current.on = true; drag.current.last = e.clientX; e.target.setPointerCapture?.(e.pointerId); }}
      onPointerMove={(e) => { if (!drag.current.on) return; drag.current.offset += (e.clientX - drag.current.last) * 0.01; drag.current.last = e.clientX; }}
      onPointerUp={() => { drag.current.on = false; }}
      onPointerLeave={() => { drag.current.on = false; }}
    >
      {children}
    </group>
  );
}

export default function BuilderStage({ config, cut, reduced, glRef }) {
  return (
    <CakeStage
      className="builder-canvas"
      camera={{ position: [0, 2.1, 6.6], fov: 30 }}
      lookY={1.1}
      preserveDrawingBuffer
      onCreated={({ gl }) => { glRef.current = gl; }}
      label={`Preview of your cake: ${describe(config)}${cut ? ', sliced to show the layers' : ''}.`}
    >
      <Turntable cut={cut} reduced={reduced}>
        <Cake config={config} cut={cut} reduced={reduced} fitHeight={2.45} />
      </Turntable>
    </CakeStage>
  );
}
