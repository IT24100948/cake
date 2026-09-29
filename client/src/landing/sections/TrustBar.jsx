import { motion } from 'framer-motion';
import LineIcon from '../../components/site/LineIcon';
import { TRUST } from '../data';
import { fadeUp, reveal } from '../motion';

export default function TrustBar() {
  return (
    <section className="trust" aria-label="Why Cake n’ Party">
      <motion.ul className="trust-band" {...reveal}>
        {TRUST.map((t, i) => (
          <motion.li key={t.title} className="trust-item" variants={fadeUp} custom={i}>
            <span className="trust-icon"><LineIcon name={t.icon} size={26} stroke={1.3} /></span>
            <span>
              <strong>{t.title}</strong>
              <small>{t.text}</small>
            </span>
          </motion.li>
        ))}
      </motion.ul>
    </section>
  );
}
