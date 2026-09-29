import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import LineIcon from '../../components/site/LineIcon';
import { formatPrice as formatLKR } from '../../utils/format';
import { estimatePrice, SIGNATURE_CONFIG } from '../cakeOptions';
import { img, PHOTOS } from '../data';
import { EASE, fadeUp, reveal } from '../motion';

const DETAILS = [
  ['Hand-piped cream', 'Every rosette and drip finished by hand, never from a mould.'],
  ['Fresh seasonal fruit', 'Strawberries picked for the day, glazed just before it leaves us.'],
  ['Made to order', 'Baked for your date — nothing sits in a display case.'],
];

export default function Signature({ onReserve, reduced }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const bigY = useTransform(scrollYProgress, [0, 1], reduced ? [0, 0] : [60, -60]);
  const smallY = useTransform(scrollYProgress, [0, 1], reduced ? [0, 0] : [120, -110]);

  return (
    <section className="signature" id="story" ref={ref} aria-labelledby="signature-title">
      <div className="sig-grid">
        <motion.div className="sig-copy" {...reveal}>
          <motion.p className="eyebrow" variants={fadeUp}>The signature</motion.p>
          <motion.h2 id="signature-title" className="sig-title" variants={fadeUp} custom={1}>
            Made for<br /><em>the moment.</em>
          </motion.h2>
          <motion.p className="sig-lede" variants={fadeUp} custom={2}>
            Our strawberry drip celebration cake: vanilla-bean sponge, fresh berry filling, blush buttercream and a glossy glaze poured the morning it’s collected.
          </motion.p>
          <ol className="sig-details">
            {DETAILS.map(([t, d], i) => (
              <motion.li key={t} variants={fadeUp} custom={3 + i}>
                <span className="sig-num">0{i + 1}</span>
                <span><strong>{t}</strong><small>{d}</small></span>
              </motion.li>
            ))}
          </ol>
          <motion.div className="sig-cta" variants={fadeUp} custom={6}>
            <button type="button" className="pill pill-primary pill-lg" onClick={onReserve}>
              Reserve this cake <LineIcon name="arrow" size={18} className="pill-arrow" />
            </button>
            <span className="sig-price">from {formatLKR(estimatePrice(SIGNATURE_CONFIG))} · 1.5 kg</span>
          </motion.div>
        </motion.div>

        <div className="sig-media">
          <motion.figure className="sig-big" style={{ y: bigY }}
            initial={{ clipPath: 'inset(12% 0% 12% 18% round 28px)' }} whileInView={{ clipPath: 'inset(0% 0% 0% 0% round 28px)' }}
            viewport={{ once: true, margin: '-10% 0px' }} transition={{ duration: 1.4, ease: EASE }}>
            <img src={img(PHOTOS.pinkDrip, 1400)} alt="Strawberry drip cake with pink buttercream rosettes and fresh strawberries" loading="lazy" />
          </motion.figure>
          <motion.figure className="sig-small" style={{ y: smallY }}>
            <img src={img(PHOTOS.fraisier, 700)} alt="Strawberry layer cake cross-section" loading="lazy" />
          </motion.figure>
          <motion.div className="sig-tag" initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.8, delay: 0.6, ease: EASE }}>
            <span className="script">Freshly glazed</span>
            <small>every morning</small>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
