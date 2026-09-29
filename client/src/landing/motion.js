/** Shared motion language: soft, weighted, never bouncy-cartoon. */
export const EASE = [0.22, 1, 0.36, 1];
export const spring = { type: 'spring', stiffness: 170, damping: 24, mass: 0.9 };
export const springSoft = { type: 'spring', stiffness: 110, damping: 20 };

export const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.9, ease: EASE, delay: i * 0.08 } }),
};

export const reveal = { initial: 'hidden', whileInView: 'show', viewport: { once: true, margin: '-12% 0px' } };
