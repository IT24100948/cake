import { lazy, Suspense, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import LineIcon from '../../components/site/LineIcon';
import { EASE } from '../motion';
import { img, PHOTOS } from '../data';

const HeroCake = lazy(() => import('./HeroCake'));

function Leaf({ className }) {
  return (
    <svg className={className} viewBox="0 0 220 260" fill="none" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="1.1" strokeLinecap="round">
        <path d="M110 255C104 190 112 120 150 40" />
        <path d="M121 170c-26-6-45-24-52-52 26 4 44 22 52 52z" />
        <path d="M128 132c24-8 42-28 46-56-24 8-40 28-46 56z" />
        <path d="M115 210c-24-2-42-16-52-38 24 0 42 14 52 38z" />
        <path d="M139 90c-20-6-34-22-38-44 20 6 34 22 38 44z" />
        <path d="M146 64c16-8 26-22 28-40-16 8-26 22-28 40z" />
      </g>
    </svg>
  );
}

function Heart() {
  return (
    <svg className="hero-heart" viewBox="0 0 40 36" fill="none" aria-hidden="true">
      <path d="M20 33S3 22.6 3 11.4C3 6 7 2.5 11.6 2.5c3.6 0 6.4 2.2 8.4 5.3 2-3.1 4.8-5.3 8.4-5.3C33 2.5 37 6 37 11.4 37 22.6 20 33 20 33z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

const line = (i) => ({
  initial: { opacity: 0, y: 34, filter: 'blur(6px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  transition: { duration: 1.05, ease: EASE, delay: 0.15 + i * 0.12 },
});

export default function Hero({ onBuild, reduced }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const textY = useTransform(scrollYProgress, [0, 1], [0, reduced ? 0 : -90]);
  const textOpacity = useTransform(scrollYProgress, [0, 0.75], [1, reduced ? 1 : 0]);
  const cakeScale = useTransform(scrollYProgress, [0, 1], [1, reduced ? 1 : 1.06]);

  return (
    <section className="hero" ref={ref} id="home" aria-labelledby="hero-title">
      <Leaf className="hero-leaf leaf-a" />
      <Leaf className="hero-leaf leaf-b" />
      <div className="hero-glow" aria-hidden="true" />

      <div className="hero-grid">
        <motion.div className="hero-copy" style={{ y: textY, opacity: textOpacity }}>
          <motion.p className="eyebrow" {...line(0)}>Freshly baked <span aria-hidden="true">•</span> Made with love</motion.p>
          <h1 id="hero-title" className="hero-title">
            <motion.span className="ht-line" {...line(1)}>Life is Sweeter</motion.span>
            <motion.span className="ht-line ht-accent" {...line(2)}>with Cake.<Heart /></motion.span>
          </h1>
          <motion.p className="hero-lede" {...line(3)}>
            Custom cakes, beautiful treats, and everything you need to make your celebration unforgettable.
          </motion.p>
          <motion.div className="hero-ctas" {...line(4)}>
            <Link to="/shop?type=CAKE" className="pill pill-primary pill-lg">
              <LineIcon name="cake" size={20} /> Explore Cakes <LineIcon name="arrow" size={18} className="pill-arrow" />
            </Link>
            <button type="button" className="pill pill-ghost pill-lg" onClick={onBuild}>Build Your Cake</button>
          </motion.div>
          <motion.p className="hero-meta" {...line(5)}>
            <LineIcon name="pin" size={16} /> Baked to order in Colombo · Island-wide delivery
          </motion.p>
        </motion.div>

        <motion.div className="hero-stage" style={{ scale: cakeScale }}>
          <div className="hero-backdrop" aria-hidden="true">
            <img src={img(PHOTOS.balloons, 900)} alt="" />
          </div>
          <motion.div className="hero-plinth" aria-hidden="true" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.4, ease: EASE }} />
          <Suspense fallback={<div className="hero-cake is-loading"><div className="cake-shimmer" /></div>}>
            <motion.div className="hero-cake-in" initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.3, ease: EASE, delay: 0.2 }}>
              <HeroCake progress={scrollYProgress} reduced={reduced} />
            </motion.div>
          </Suspense>

          {[
            { label: 'Handcrafted', sub: 'Piped by hand', cls: 'ann-a', d: 0.9 },
            { label: 'Fresh today', sub: 'Baked this morning', cls: 'ann-b', d: 1.05 },
            { label: 'Custom design', sub: 'Yours to shape', cls: 'ann-c', d: 1.2 },
          ].map((a) => (
            <motion.div key={a.label} className={`annotation ${a.cls}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: EASE, delay: a.d }}>
              <span className="ann-dot" aria-hidden="true" />
              <span><strong>{a.label}</strong><small>{a.sub}</small></span>
            </motion.div>
          ))}

          <motion.div className="hero-note" initial={{ opacity: 0, rotate: -8 }} animate={{ opacity: 1, rotate: -6 }} transition={{ duration: 1, delay: 1.3, ease: EASE }} aria-hidden="true">
            <span>Custom Cakes</span>
            <span>for Every Occasion</span>
            <svg viewBox="0 0 90 60" fill="none"><path d="M82 6C70 30 48 46 14 50m0 0 12-9M14 50l11 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
