import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

const CartUIContext = createContext(null);

/**
 * UI state around the cart: the slide-in drawer, the header badge bounce and
 * the "fly to cart" thumbnail that travels from an Add button to the cart icon.
 */
export function CartUIProvider({ children }) {
  const [open, setOpen] = useState(false);
  const [bump, setBump] = useState(0);
  const [flyers, setFlyers] = useState([]);
  const cartIconRef = useRef(null);
  const reduced = useReducedMotion();

  const fly = useCallback((src, fromEl) => {
    const target = cartIconRef.current?.getBoundingClientRect();
    const from = fromEl?.getBoundingClientRect?.();
    if (reduced || !target || !from || !src) { setBump((b) => b + 1); return; }
    const id = Date.now() + Math.random();
    setFlyers((f) => [...f, {
      id, src,
      from: { x: from.left + from.width / 2 - 36, y: from.top + from.height / 2 - 36 },
      to: { x: target.left + target.width / 2 - 36, y: target.top + target.height / 2 - 36 },
    }]);
  }, [reduced]);

  const value = useMemo(() => ({
    open, setOpen, openDrawer: () => setOpen(true), closeDrawer: () => setOpen(false),
    bump, pulse: () => setBump((b) => b + 1), fly, cartIconRef,
  }), [open, bump, fly]);

  return (
    <CartUIContext.Provider value={value}>
      {children}
      <AnimatePresence>
        {flyers.map((f) => (
          <motion.img
            key={f.id}
            src={f.src}
            alt=""
            aria-hidden="true"
            className="fly-thumb"
            initial={{ x: f.from.x, y: f.from.y, scale: 1, opacity: 1, rotate: 0 }}
            animate={{
              x: [f.from.x, (f.from.x + f.to.x) / 2, f.to.x],
              y: [f.from.y, Math.min(f.from.y, f.to.y) - 120, f.to.y],
              scale: [1, 0.8, 0.28],
              rotate: [0, -8, 0],
              opacity: [1, 1, 0.6],
            }}
            transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1], times: [0, 0.45, 1] }}
            onAnimationComplete={() => {
              setFlyers((all) => all.filter((x) => x.id !== f.id));
              setBump((b) => b + 1);
            }}
          />
        ))}
      </AnimatePresence>
    </CartUIContext.Provider>
  );
}

export const useCartUI = () => useContext(CartUIContext);
