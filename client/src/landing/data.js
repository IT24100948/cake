/**
 * Landing-page content. Photos are free-licence Unsplash images served from
 * their CDN (swap for Devma's own photography when available).
 * Testimonials are placeholders — replace with real customer reviews before launch.
 */
export const img = (id, w = 900, h) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}${h ? `&h=${h}` : ''}&q=78`;

export const PHOTOS = {
  pinkDrip: 'photo-1677840147140-252adb9ca347',
  sprinkleDrip: 'photo-1558301211-0d8c8ddee6ec',
  coneDrip: 'photo-1621303837174-89787a7d4729',
  chocRosettes: 'photo-1606983340126-99ab4feaa64a',
  chocDripWhite: 'photo-1588195538326-c5b1e9f80a1b',
  chocDripPink: 'photo-1554163328-61681c4f303f',
  chocOreo: 'photo-1626263468007-a9e0cf83f1ac',
  sparklers: 'photo-1577998474517-7eeeed4e448a',
  chocSparkler: 'photo-1559553156-2e97137af16f',
  bunting: 'photo-1571926422939-1abb99c50fd8',
  weddingRoses: 'photo-1535254973040-607b474cb50d',
  weddingBerries: 'photo-1623428454614-abaf00244e52',
  weddingBokeh: 'photo-1535141192574-5d4897c12636',
  floralLavender: 'photo-1562777717-dc6984f65a63',
  floralCarnation: 'photo-1629389861081-43cc4f172b0c',
  floralHydrangea: 'photo-1563910930658-1907bfa80f42',
  meringueFloral: 'photo-1557308536-ee471ef2c390',
  roseOmbre: 'photo-1597520595747-23260411dc4e',
  cupcakes: 'photo-1690584177253-58e128f05ceb',
  miniCakes: 'photo-1530648672449-81f6c723e2f1',
  cherryCake: 'photo-1569289522127-c0452f372d46',
  frostingTexture: 'photo-1581016327131-6cf17ab1f2c1',
  balloons: 'photo-1529244927325-b3ef2247b9fb',
  tableSetting: 'photo-1655386068478-e8283085cac7',
  macarons: 'photo-1595665094099-10d5b8c7aaeb',
  redVelvet: 'photo-1602630209855-dceac223adfe',
  shortcake: 'photo-1602663491496-73f07481dbea',
  layered: 'photo-1627308595171-d1b5d67129c4',
  fraisier: 'photo-1611293388250-580b08c4a145',
};

/** "Explore Our Delicious Creations" — `category` matches the Devma catalogue category names. */
export const CREATIONS = [
  { title: 'Birthday Cakes', blurb: 'Drips, sprinkles & candles', photo: PHOTOS.sprinkleDrip, type: 'CAKE', category: 'Birthday Cakes', span: 'feature' },
  { title: 'Wedding Cakes', blurb: 'Tiered, floral, timeless', photo: PHOTOS.weddingRoses, type: 'CAKE', category: 'Wedding Cakes', span: 'tall' },
  { title: 'Cupcakes', blurb: 'Piped roses by the dozen', photo: PHOTOS.roseOmbre, type: 'CAKE', category: 'Cupcakes & Mini Cakes', span: 'std', position: '50% 85%' },
  { title: 'Party Packs', blurb: 'Balloons & backdrops', photo: PHOTOS.balloons, type: 'DECORATION', category: 'Balloons', span: 'wide' },
  { title: 'Party Essentials', blurb: 'Tableware, candles & toppers', photo: PHOTOS.tableSetting, type: 'DECORATION', category: 'Tableware & Candles', span: 'std' },
];

export const TRUST = [
  { icon: 'whisk', title: 'Premium Quality', text: 'Fresh ingredients, always' },
  { icon: 'truck', title: 'Reliable Delivery', text: 'On time, every time' },
  { icon: 'shield', title: 'Safe & Secure', text: 'Easy & safe payments' },
  { icon: 'heart', title: 'Customer Support', text: 'We’re here to help' },
];

/** Social proof collage. Quotes are placeholders — replace with real reviews. */
export const MOMENTS = [
  { kind: 'photo', photo: PHOTOS.sparklers, alt: 'Cake with lit sparklers', h: 'tall' },
  { kind: 'quote', text: 'The drip cake looked exactly like the design we built online — and tasted even better.', name: 'Nethmi', occasion: 'Daughter’s 6th birthday' },
  { kind: 'photo', photo: PHOTOS.floralCarnation, alt: 'Buttercream cake with pink carnations', h: 'std' },
  { kind: 'photo', photo: PHOTOS.bunting, alt: 'Birthday cake with bunting and confetti', h: 'std' },
  { kind: 'quote', text: 'Delivered right on time for our engagement. Every guest asked where it was from.', name: 'Ravindu', occasion: 'Engagement, Kandy' },
  { kind: 'photo', photo: PHOTOS.chocSparkler, alt: 'Chocolate cake with berries and a sparkler', h: 'tall' },
  { kind: 'photo', photo: PHOTOS.miniCakes, alt: 'Pink mini cakes with fresh berries', h: 'std' },
  { kind: 'quote', text: 'Ordering the balloons and the cake together saved me a whole afternoon.', name: 'Amaya', occasion: 'Office celebration' },
  { kind: 'photo', photo: PHOTOS.layered, alt: 'Layered strawberry cream cake', h: 'std' },
];

export const GALLERY = [
  { photo: PHOTOS.coneDrip, name: 'Sprinkle Cone Drip', category: 'Birthday', type: 'CAKE', layout: 'a' },
  { photo: PHOTOS.weddingBerries, name: 'Berry Garden Tiers', category: 'Wedding', type: 'CAKE', layout: 'b' },
  { photo: PHOTOS.floralLavender, name: 'Lavender Buttercream', category: 'Floral', type: 'CAKE', layout: 'c' },
  { photo: PHOTOS.chocDripWhite, name: 'Midnight Ganache', category: 'Chocolate drip', type: 'CAKE', layout: 'd' },
  { photo: PHOTOS.cupcakes, name: 'Bloom Cupcakes', category: 'Cupcakes', type: 'CAKE', layout: 'e' },
  { photo: PHOTOS.cherryCake, name: 'Cherry Blush', category: 'Birthday', type: 'CAKE', layout: 'f' },
  { photo: PHOTOS.floralHydrangea, name: 'Hydrangea Crown', category: 'Floral', type: 'CAKE', layout: 'g' },
  { photo: PHOTOS.chocRosettes, name: 'Cocoa Rosettes', category: 'Chocolate drip', type: 'CAKE', layout: 'h' },
  { photo: PHOTOS.weddingBokeh, name: 'Evening Berry Tiers', category: 'Wedding', type: 'CAKE', layout: 'i' },
  { photo: PHOTOS.meringueFloral, name: 'Meringue & Peony', category: 'Floral', type: 'CAKE', layout: 'j' },
];

export const INSTAGRAM = [PHOTOS.macarons, PHOTOS.redVelvet, PHOTOS.shortcake, PHOTOS.chocOreo];
