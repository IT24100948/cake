import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GALLERY, img } from '../data';
import { EASE, fadeUp, reveal } from '../motion';

export default function Gallery() {
  return (
    <section className="gallery" id="gallery" aria-labelledby="gallery-title">
      <motion.header className="gallery-head" {...reveal}>
        <div>
          <motion.p className="eyebrow eyebrow-rule" variants={fadeUp}>The gallery</motion.p>
          <motion.h2 id="gallery-title" variants={fadeUp} custom={1}>A few of our <em>favourite</em> things</motion.h2>
        </div>
        <motion.p className="section-lede" variants={fadeUp} custom={2}>Birthdays, weddings, cupcakes by the dozen — every one made to order.</motion.p>
      </motion.header>
      <ul className="gallery-grid">
        {GALLERY.map((g, i) => (
          <motion.li
            key={g.name}
            className={`g-item g-${g.layout}`}
            initial={{ opacity: 0, y: 50, scale: 0.98 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: '-5% 0px' }}
            transition={{ duration: 1.1, ease: EASE, delay: (i % 4) * 0.07 }}
          >
            <Link to={`/shop?type=${g.type}`} className="g-link" aria-label={`${g.name}, ${g.category}. View cakes`}>
              <img src={img(g.photo, 800)} alt="" loading="lazy" />
              <span className="g-cap" aria-hidden="true">
                <span className="g-cat">{g.category}</span>
                <span className="g-name">{g.name}</span>
                <span className="g-view">View cake →</span>
              </span>
            </Link>
          </motion.li>
        ))}
      </ul>
    </section>
  );
}
