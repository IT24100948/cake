import { motion } from 'framer-motion';
import { img, MOMENTS } from '../data';
import { EASE, fadeUp, reveal } from '../motion';

export default function Moments() {
  return (
    <section className="moments" aria-labelledby="moments-title">
      <motion.header className="section-head section-head-left" {...reveal}>
        <motion.p className="eyebrow eyebrow-rule" variants={fadeUp}>Celebrations we’ve baked for</motion.p>
        <motion.h2 id="moments-title" variants={fadeUp} custom={1}>Made for moments<br /><em>worth remembering.</em></motion.h2>
      </motion.header>
      <div className="moments-collage">
        {MOMENTS.map((m, i) => (
          <motion.div
            key={i}
            className={`moment moment-${m.kind}${m.h ? ` moment-${m.h}` : ''}`}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-6% 0px' }}
            transition={{ duration: 1, ease: EASE, delay: (i % 3) * 0.1 }}
          >
            {m.kind === 'photo' ? (
              <img src={img(m.photo, 700)} alt={m.alt} loading="lazy" />
            ) : (
              <blockquote>
                <p>“{m.text}”</p>
                <footer><strong>{m.name}</strong><span>{m.occasion}</span></footer>
              </blockquote>
            )}
          </motion.div>
        ))}
      </div>
    </section>
  );
}
