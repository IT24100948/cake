/**
 * Slot for a scanned / photogrammetry cake (GLB), for when Devma has one.
 *
 * The site currently renders a fully procedural, parametric cake (<Cake />),
 * which is what lets "Build Your Cake" recolour the frosting, swap the drip,
 * change tiers and slice it open. A scanned GLB can replace the HERO cake only:
 *
 *   1. Put the file in client/public/models/signature-cake.glb (keep it < 4 MB;
 *      compress with `npx gltf-transform optimize in.glb out.glb --texture-compress webp`).
 *   2. Uncomment the component below.
 *   3. In landing/sections/HeroCake.jsx replace
 *        <Cake config={HERO_CONFIG} tiers={HERO_TIERS} ... />
 *      with
 *        <Suspense fallback={null}><CakeModel /></Suspense>
 *   4. Tune `scale` / `position` so the stand sits on y = 0 (the contact shadow plane).
 *
 * Lighting, pointer tilt, drag-to-spin and the scroll camera all keep working,
 * because they act on the parent group, not on the cake itself.
 */

// import { useGLTF } from '@react-three/drei';
//
// export default function CakeModel(props) {
//   const { scene } = useGLTF('/models/signature-cake.glb');
//   scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
//   return <primitive object={scene} scale={1.6} position={[0, 0, 0]} {...props} />;
// }
//
// useGLTF.preload('/models/signature-cake.glb');

export {};
