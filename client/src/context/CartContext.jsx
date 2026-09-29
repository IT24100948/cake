import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { load, save } from '../utils/storage';

const CartContext = createContext(null);
const KEY = 'devma_cart_v1';

/**
 * Cart holds catalog items (US11, US14) and an optional custom cake request (US13).
 * The cake reference image (a File) lives in memory only - browsers cannot persist it.
 */
export function CartProvider({ children }) {
  const initial = load(KEY, { items: [], customCake: null });
  const [items, setItems] = useState(Array.isArray(initial.items) ? initial.items : []);
  const [customCake, setCustomCake] = useState(initial.customCake || null);
  const [cakeImage, setCakeImage] = useState(null);
  const [eventDate, setEventDate] = useState(initial.eventDate || '');

  useEffect(() => { save(KEY, { items, customCake, eventDate }); }, [items, customCake, eventDate]);

  const value = useMemo(() => {
    const add = (product, quantity = 1, notes = '') => {
      setItems((cur) => {
        const existing = cur.find((i) => i.productId === product.id && (i.notes || '') === (notes || ''));
        const max = product.stock_quantity;
        if (existing) {
          return cur.map((i) => (i === existing ? { ...i, quantity: Math.min(max, i.quantity + quantity), stock: max } : i));
        }
        return [...cur, {
          key: `${product.id}-${Date.now()}`,
          productId: product.id,
          name: product.name,
          price: product.price,
          image: product.image_url,
          type: product.product_type,
          stock: max,
          quantity: Math.min(max, quantity),
          notes,
        }];
      });
    };
    const update = (key, patch) => setItems((cur) => cur.map((i) => (i.key === key ? { ...i, ...patch } : i)));
    const remove = (key) => setItems((cur) => cur.filter((i) => i.key !== key));
    const clear = () => { setItems([]); setCustomCake(null); setCakeImage(null); setEventDate(''); };
    const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const count = items.reduce((s, i) => s + i.quantity, 0) + (customCake ? 1 : 0);
    return {
      items, customCake, cakeImage, subtotal, count, eventDate,
      add, update, remove, clear, setEventDate,
      setCustomCake: (cake, image) => { setCustomCake(cake); if (image !== undefined) setCakeImage(image); },
      removeCustomCake: () => { setCustomCake(null); setCakeImage(null); },
    };
  }, [items, customCake, cakeImage, eventDate]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);
