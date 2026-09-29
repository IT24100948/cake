import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { catalogApi } from '../../api';
import { useAsync } from '../../utils/useAsync';
import LineIcon from '../../components/site/LineIcon';
import { CREATIONS, img } from '../data';
import { EASE, fadeUp, reveal } from '../motion';

/** Links each card to the matching Devma catalogue category (falls back to the product type). */
function useCategoryLinks() {
  const { data } = useAsync(() => catalogApi.categories(), []);
  const cats = data?.data || [];
  return (c) => {
    const match = cats.find((x) => x.name === c.category);
    return match ? `/shop?type=${c.type}&category=${match.id}` : `/shop?type=${c.type}`;
  };
}

export default function Creations() {
  const linkFor = useCategoryLinks();
  return (
    <section className="creations" aria-labelledby="creations-title">
      <motion.header className="section-head" {...reveal}>
        <motion.p className="eyebrow eyebrow-rule" variants={fadeUp}>Our collection</motion.p>
        <motion.h2 id="creations-title" variants={fadeUp} custom={1}>Explore Our Delicious Creations</motion.h2>
        <motion.p className="section-lede" variants={fadeUp} custom={2}>Beautiful cakes, sweet treats and everything you need for your perfect celebration.</motion.p>
      </motion.header>

      <div className="creation-grid" role="list">
        {CREATIONS.map((c, i) => (
          <motion.div
            key={c.title}
            role="listitem"
            className={`creation creation-${c.span}`}
            initial={{ opacity: 0, y: 48 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-8% 0px' }}
            transition={{ duration: 1, ease: EASE, delay: i * 0.08 }}
          >
            <Link to={linkFor(c)} className="creation-card">
              <span className="creation-media">
                <img src={img(c.photo, c.span === 'feature' ? 900 : 700)} alt="" loading="lazy" style={c.position ? { objectPosition: c.position } : undefined} />
                <span className="creation-frost" aria-hidden="true" />
              </span>
              <span className="creation-label">
                <span className="creation-pill">
                  <span className="creation-name">{c.title}</span>
                  <span className="creation-blurb">{c.blurb}</span>
                </span>
                <span className="creation-go" aria-hidden="true">
                  <span className="creation-go-text">Shop</span>
                  <LineIcon name="arrow" size={18} />
                </span>
              </span>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
