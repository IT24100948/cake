import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MotionConfig, useReducedMotion } from 'framer-motion';
import Hero from './sections/Hero';
import IcingDivider from './sections/IcingDivider';
import TrustBar from './sections/TrustBar';
import QuickLinks from './sections/QuickLinks';
import Creations from './sections/Creations';
import CakeBuilder from './sections/CakeBuilder';
import Signature from './sections/Signature';
import Moments from './sections/Moments';
import Gallery from './sections/Gallery';
import { DEFAULT_CONFIG, SIGNATURE_CONFIG } from './cakeOptions';
import { load, save } from '../utils/storage';
import './landing.css';

const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

/** Cake n' Party storefront landing. The builder's design is remembered per visitor. */
export default function Landing() {
  const reduced = useReducedMotion();
  const location = useLocation();
  const [config, setConfig] = useState(() => ({ ...DEFAULT_CONFIG, ...load('devma_builder_v1', {}) }));

  useEffect(() => { save('devma_builder_v1', config); }, [config]);

  // Deep links such as /#build or /#gallery (from the header, footer or drawer).
  useEffect(() => {
    const id = location.hash.replace('#', '');
    if (!id) return undefined;
    const t = setTimeout(() => scrollTo(id), 80);
    return () => clearTimeout(t);
  }, [location.hash]);

  return (
    <MotionConfig reducedMotion="user">
      <div className="lp">
        <Hero onBuild={() => scrollTo('build')} reduced={reduced} />
        <IcingDivider variant="drip-down" from="var(--blush)" to="var(--cream)" seed={5} height={130} />
        <TrustBar />
        <QuickLinks />
        <Creations />
        <IcingDivider variant="cream-wave" from="var(--cream)" to="var(--ivory-blush)" seed={3} height={110} />
        <CakeBuilder config={config} setConfig={setConfig} reduced={reduced} />
        <IcingDivider variant="piped-edge" from="var(--ivory-blush)" to="var(--cream)" height={70} />
        <Signature reduced={reduced} onReserve={() => { setConfig(SIGNATURE_CONFIG); scrollTo('build'); }} />
        <Moments />
        <Gallery />
        <IcingDivider variant="drip-down" from="var(--cream)" to="var(--espresso)" seed={11} height={120} />
      </div>
    </MotionConfig>
  );
}
