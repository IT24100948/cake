/**
 * Single source of truth for "Build Your Cake": labels, swatches, 3D colours,
 * tier layouts and pricing. The builder UI, the 3D cake and the order request
 * sent to the Devma API all read from here.
 */

export const FLAVORS = [
  { id: 'vanilla', label: 'Vanilla', note: 'Madagascar vanilla sponge', sponge: '#F1D49B', filling: '#FFF3DF', drip: '#C98A4B', dripLabel: 'salted caramel drip', perKg: 0 },
  { id: 'chocolate', label: 'Chocolate', note: 'Dark cocoa & ganache', sponge: '#5B2E1F', filling: '#3A1B12', drip: '#3B1A12', dripLabel: 'dark ganache drip', perKg: 450 },
  { id: 'redvelvet', label: 'Red Velvet', note: 'Buttermilk cocoa crumb', sponge: '#9C1B33', filling: '#FBF1E4', drip: '#7E1029', dripLabel: 'berry drip', perKg: 650 },
  { id: 'strawberry', label: 'Strawberry', note: 'Fresh berry & cream', sponge: '#F4B8C2', filling: '#D1304F', drip: '#E4507F', dripLabel: 'strawberry glaze drip', perKg: 550 },
];

export const FROSTINGS = [
  { id: 'vanilla', label: 'Vanilla', color: '#FBF0E1', perKg: 0 },
  { id: 'strawberry', label: 'Strawberry', color: '#F9CDD7', perKg: 300 },
  { id: 'chocolate', label: 'Chocolate', color: '#6B3B2B', perKg: 350 },
  { id: 'creamcheese', label: 'Cream Cheese', color: '#FFF7EC', perKg: 500 },
];

export const DECORATIONS = [
  { id: 'minimal', label: 'Minimal', note: 'Pearl borders, clean lines', price: 0 },
  { id: 'floral', label: 'Floral', note: 'Hand-shaped sugar blooms', price: 1800 },
  { id: 'strawberry', label: 'Strawberry', note: 'Rosettes & fresh berries', price: 1400 },
  { id: 'celebration', label: 'Celebration', note: 'Candles & gold pearls', price: 1600 },
];

/** Tier layouts are in scene units (bottom tier first). */
export const SIZES = [
  { id: '1kg', label: '1 kg', serves: 'Serves 8–10', weightKg: 1, base: 5200, tiers: [{ r: 1, h: 1.02 }] },
  { id: '1.5kg', label: '1.5 kg', serves: 'Serves 12–15', weightKg: 1.5, base: 7400, tiers: [{ r: 1.06, h: 1.3 }] },
  { id: '2kg', label: '2 kg', serves: 'Serves 18–22', weightKg: 2, base: 9800, tiers: [{ r: 1.1, h: 0.92 }, { r: 0.74, h: 0.8 }] },
  { id: 'custom', label: 'Custom', serves: 'Tiered, 30+', weightKg: 3.5, base: 15500, from: true, tiers: [{ r: 1.16, h: 0.82 }, { r: 0.86, h: 0.74 }, { r: 0.58, h: 0.66 }] },
];

export const DEFAULT_CONFIG = { flavor: 'strawberry', frosting: 'vanilla', decoration: 'strawberry', size: '1kg' };
export const HERO_CONFIG = { flavor: 'strawberry', frosting: 'strawberry', decoration: 'strawberry', size: '1.5kg' };
/** The hero shows a tall, modern celebration cake (taller than the orderable 1.5 kg layout). */
export const HERO_TIERS = [{ r: 0.9, h: 1.55 }];
export const SIGNATURE_CONFIG = { flavor: 'strawberry', frosting: 'strawberry', decoration: 'strawberry', size: '1.5kg' };

const byId = (list, id) => list.find((x) => x.id === id) || list[0];
export const getFlavor = (id) => byId(FLAVORS, id);
export const getFrosting = (id) => byId(FROSTINGS, id);
export const getDecoration = (id) => byId(DECORATIONS, id);
export const getSize = (id) => byId(SIZES, id);

/** Estimated price in LKR. The final price is confirmed by the Devma team when the order is confirmed. */
export function estimatePrice(config) {
  const size = getSize(config.size);
  const kg = size.weightKg;
  const total = size.base
    + getFlavor(config.flavor).perKg * kg
    + getFrosting(config.frosting).perKg * kg
    + getDecoration(config.decoration).price;
  return Math.round(total / 50) * 50;
}

export function describe(config) {
  const f = getFlavor(config.flavor);
  return `${getSize(config.size).label} ${f.label} · ${getFrosting(config.frosting).label} frosting · ${getDecoration(config.decoration).label}`;
}

/**
 * Maps a builder design onto the API's cake requirement (US13).
 * UI-only fields (design, estimate, thumbnail) are stripped at checkout.
 */
export function toCakeRequirement(config, thumbnail) {
  const size = getSize(config.size);
  const flavor = getFlavor(config.flavor);
  const frosting = getFrosting(config.frosting);
  const deco = getDecoration(config.decoration);
  const estimate = estimatePrice(config);
  return {
    occasion: 'Celebration',
    flavor: flavor.label,
    weightKg: size.weightKg,
    shape: 'Round',
    tiers: size.tiers.length,
    icingType: `${frosting.label} buttercream`,
    colors: `${frosting.label} frosting with ${flavor.dripLabel}`,
    theme: `${deco.label} — ${deco.note}`,
    messageOnCake: '',
    dietaryNotes: '',
    additionalDetails: `Designed with Build Your Cake (${describe(config)}). Estimated ${size.from ? 'from ' : ''}LKR ${estimate.toLocaleString('en-LK')}.`,
    design: config,
    estimate,
    thumbnail: thumbnail || null,
  };
}
