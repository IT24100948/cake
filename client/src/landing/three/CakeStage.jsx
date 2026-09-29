import { useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { ContactShadows, Environment, Lightformer } from '@react-three/drei';

/**
 * Warm studio for the cake: a key softbox, a blush rim, and a local
 * Lightformer environment (no network HDRI) that gives the glaze and the
 * ceramic stand their reflections. Rendering pauses while off-screen.
 */
export default function CakeStage({ children, className, camera = { position: [0, 1.55, 6.4], fov: 29 }, lookY = 1.05,
  shadowOpacity = 0.42, preserveDrawingBuffer = false, onCreated, keyLightRef, label }) {
  const wrap = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = wrap.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setVisible(true); return undefined; }
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: '120px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={wrap} className={className} role="img" aria-label={label}>
      <Canvas
        shadows
        dpr={[1, 1.75]}
        frameloop={visible ? 'always' : 'never'}
        camera={camera}
        gl={{ antialias: true, alpha: true, preserveDrawingBuffer }}
        onCreated={(state) => {
          // Neutral tone mapping keeps frosting pinks and creams true instead of greying them.
          state.gl.toneMapping = THREE.NeutralToneMapping;
          state.gl.toneMappingExposure = 1.05;
          state.camera.lookAt(0, lookY, 0);
          onCreated?.(state);
        }}
      >
        <hemisphereLight intensity={0.85} color="#fffaf6" groundColor="#f3c6d1" />
        <directionalLight
          ref={keyLightRef}
          position={[3.2, 5.2, 4.2]}
          intensity={1.9}
          color="#fff4ec"
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-bias={-0.0004}
          shadow-camera-left={-3}
          shadow-camera-right={3}
          shadow-camera-top={4}
          shadow-camera-bottom={-1}
        />
        <directionalLight position={[-4.5, 2.5, -2.5]} intensity={0.9} color="#ffd6e1" />
        <Environment resolution={256} frames={1}>
          <Lightformer form="rect" intensity={3} color="#fff6ef" position={[2.5, 4, 5]} scale={[5, 3, 1]} target={[0, 1, 0]} />
          <Lightformer form="rect" intensity={1.4} color="#ffffff" position={[-3, 3, 5]} scale={[3, 3, 1]} target={[0, 1, 0]} />
          <Lightformer form="rect" intensity={1.2} color="#ffd9e3" position={[-5, 2, 1]} scale={[2, 6, 1]} target={[0, 1, 0]} />
          <Lightformer form="ring" intensity={0.8} color="#ffffff" position={[0, 6, 0]} scale={4} target={[0, 0, 0]} />
          <Lightformer form="rect" intensity={0.6} color="#f8dde2" position={[0, -2, 4]} scale={[8, 2, 1]} target={[0, 1, 0]} />
        </Environment>
        {children}
        <ContactShadows position={[0, 0.001, 0]} opacity={shadowOpacity} scale={5.5} blur={2.6} far={2.2} resolution={512} color="#5a1428" frames={Infinity} />
      </Canvas>
    </div>
  );
}
