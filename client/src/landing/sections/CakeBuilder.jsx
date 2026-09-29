import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useMotionValueEvent, useSpring } from 'framer-motion';
import { useCart } from '../../context/CartContext';
import { useCartUI } from '../../context/CartUIContext';
import { useToast } from '../../context/ToastContext';
import LineIcon from '../../components/site/LineIcon';
import { formatPrice as formatLKR } from '../../utils/format';
import {
  DECORATIONS, estimatePrice, FLAVORS, FROSTINGS, getDecoration, getFlavor, getFrosting, getSize, SIZES, toCakeRequirement,
} from '../cakeOptions';
import { EASE, fadeUp, reveal } from '../motion';

const BuilderStage = lazy(() => import('./BuilderStage'));

function AnimatedPrice({ value, prefix }) {
  const mv = useSpring(value, { stiffness: 120, damping: 20 });
  const [shown, setShown] = useState(value);
  useEffect(() => { mv.set(value); }, [value, mv]);
  useMotionValueEvent(mv, 'change', (v) => setShown(Math.round(v / 10) * 10));
  return <span className="price-num">{prefix}{formatLKR(shown)}</span>;
}

function OptionGroup({ legend, name, options, value, onChange, render }) {
  return (
    <fieldset className="opt-group">
      <legend>{legend}</legend>
      <div className="opt-row" role="radiogroup" aria-label={legend}>
        {options.map((o) => (
          <label key={o.id} className={`opt${value === o.id ? ' is-on' : ''}`}>
            <input type="radio" name={name} value={o.id} checked={value === o.id} onChange={() => onChange(o.id)} className="sr-only" />
            {render ? render(o) : <span className="opt-label">{o.label}</span>}
            {value === o.id && <motion.span layoutId={`opt-${name}`} className="opt-ring" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Grabs a small square snapshot of the WebGL canvas for the cart thumbnail. */
function snapshot(gl) {
  try {
    const src = gl.domElement;
    const size = 240;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#FBEFF1';
    ctx.fillRect(0, 0, size, size);
    const s = Math.min(src.width, src.height) * 0.86;
    ctx.drawImage(src, (src.width - s) / 2, (src.height - s) / 2 + src.height * 0.03, s, s, 0, 0, size, size);
    return c.toDataURL('image/jpeg', 0.82);
  } catch {
    return null;
  }
}

export default function CakeBuilder({ config, setConfig, reduced }) {
  const cart = useCart();
  const ui = useCartUI();
  const toast = useToast();
  const [cut, setCut] = useState(true);
  const [added, setAdded] = useState(false);
  const gl = useRef(null);
  const btn = useRef(null);
  const price = estimatePrice(config);
  const size = getSize(config.size);
  const set = (k) => (v) => { setConfig((c) => ({ ...c, [k]: v })); setAdded(false); };
  const replacing = !!cart.customCake;

  const add = () => {
    const thumb = gl.current ? snapshot(gl.current) : null;
    cart.setCustomCake(toCakeRequirement(config, thumb), null);
    ui.fly(thumb, btn.current);
    setAdded(true);
    toast.success('Added to your celebration');
  };

  return (
    <section className="builder" id="build" aria-labelledby="builder-title">
      <motion.header className="section-head" {...reveal}>
        <motion.p className="eyebrow eyebrow-rule" variants={fadeUp}>Build your cake</motion.p>
        <motion.h2 id="builder-title" variants={fadeUp} custom={1}>Shape it. See it. <em>Taste it soon.</em></motion.h2>
        <motion.p className="section-lede" variants={fadeUp} custom={2}>Choose the sponge, the frosting and the finish — your cake takes shape as you go.</motion.p>
      </motion.header>

      <div className="builder-grid">
        <div className="builder-stage">
          <Suspense fallback={<div className="builder-canvas is-loading"><div className="cake-shimmer" /></div>}>
            <BuilderStage config={config} cut={cut} reduced={reduced} glRef={gl} />
          </Suspense>
          <div className="builder-stage-ui">
            <button type="button" className={`chip-toggle${cut ? ' is-on' : ''}`} onClick={() => setCut((c) => !c)} aria-pressed={cut}>
              <LineIcon name="slice" size={17} /> {cut ? 'Close the slice' : 'See inside'}
            </button>
            <AnimatePresence mode="wait">
              <motion.p key={`${config.flavor}-${config.frosting}`} className="builder-caption" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.35 }}>
                {getFlavor(config.flavor).note} · {getFrosting(config.frosting).label} buttercream · {getFlavor(config.flavor).dripLabel}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>

        <div className="builder-panel">
          <div className="sheet-handle" aria-hidden="true" />
          <OptionGroup legend="Cake" name="flavor" options={FLAVORS} value={config.flavor} onChange={set('flavor')}
            render={(o) => (
              <>
                <span className="opt-swatch sponge" style={{ background: `linear-gradient(180deg, ${o.sponge} 0 40%, ${o.filling} 40% 55%, ${o.sponge} 55%)` }} />
                <span className="opt-label">{o.label}</span>
              </>
            )} />
          <OptionGroup legend="Frosting" name="frosting" options={FROSTINGS} value={config.frosting} onChange={set('frosting')}
            render={(o) => (
              <>
                <span className="opt-swatch" style={{ background: o.color }} />
                <span className="opt-label">{o.label}</span>
              </>
            )} />
          <OptionGroup legend="Decoration" name="decoration" options={DECORATIONS} value={config.decoration} onChange={set('decoration')}
            render={(o) => (
              <span className="opt-stack">
                <span className="opt-label">{o.label}</span>
                <small>{o.note}</small>
              </span>
            )} />
          <OptionGroup legend="Size" name="size" options={SIZES} value={config.size} onChange={set('size')}
            render={(o) => (
              <span className="opt-stack">
                <span className="opt-label">{o.label}</span>
                <small>{o.serves}</small>
              </span>
            )} />

          <div className="builder-total">
            <div>
              <span className="total-label">{size.from ? 'From' : 'Estimated'}</span>
              <AnimatedPrice value={price} />
              <small>{getDecoration(config.decoration).label} · {size.label} · final price confirmed by our bakers</small>
            </div>
            <motion.button
              ref={btn}
              type="button"
              className="pill pill-primary pill-lg builder-add"
              onClick={add}
              whileTap={{ scale: 0.98 }}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span key={added ? 'added' : 'add'} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25, ease: EASE }} className="pill-inner">
                  {added ? <><LineIcon name="check" size={18} /> Added to order</> : <>{replacing ? 'Update my cake' : 'Add to Order'} <LineIcon name="arrow" size={18} /></>}
                </motion.span>
              </AnimatePresence>
            </motion.button>
          </div>
          <AnimatePresence>
            {added && (
              <motion.p className="builder-next" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                Want a message on it? <Link to="/custom-cake">Add details</Link> · <button type="button" className="text-link" onClick={ui.openDrawer}>View your order</button>
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
