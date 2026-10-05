/**
 * Real product photography for the demo catalogue, by SKU.
 * Free-licence Unsplash photos (https://unsplash.com/license) served from their CDN, cropped 4:3
 * to match the shop cards. Replace with Devma's own photos when available (Products → Edit).
 */
const photo = (id) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&h=900&q=80`;

const PRODUCT_PHOTOS = {
  'CK-CHOC-1KG': photo('1605807646983-377bc5a76493'), // chocolate fudge cake with cherries
  'CK-VAN-RNB': photo('1624893235207-1408ecb9b271'), // sprinkle birthday cake with candles
  'CK-RIBBON': photo('1600653155864-88227b5b64b0'), // colourful layered cake
  'CK-REDVEL': photo('1714949134591-d6f2c581b20d'), // red velvet slice with strawberry
  'CK-WED-2T': photo('1604702433171-33756f3f3825'), // two-tier floral wedding cake
  'CK-WED-PCS': photo('1628655143209-c678e8e2a470'), // rich fruit cake slices
  'CK-CUP-12': photo('1618652970214-19b55729f0e6'), // vanilla and chocolate cupcakes
  'CK-JAR-6': photo('1630060257277-dcf4ec31374c'), // chocolate jar cake
  'DC-BAL-PST25': photo('1509909756405-be0199881695'), // pastel balloons
  'DC-BAL-NUM': photo('1663860585976-6a5231fa01fd'), // gold number foil balloons
  'DC-BAL-HRT': photo('1673553587445-885f2b596555'), // heart foil balloons
  'DC-BAL-ARCH': photo('1560128411-79892dd93bf8'), // balloon arch
  'DC-BAN-HBD': photo('1608209835252-458cabe4cb93'), // Happy Birthday banner with gold tinsel
  'DC-BAN-SEQ': photo('1632905460027-abad5efa8798'), // rose shimmer sequin wall
  'DC-BAN-BUNT': photo('1701566082955-080fc537dcf3'), // bunting flags
  'DC-TBL-CNDL': photo('1487022171932-100463e54b29'), // number candle on a cake
  'DC-TBL-TOP': photo('1627247359162-4645d9f8543b'), // gold "Happy Birthday" cake topper
  'DC-TBL-SET': photo('1585879304131-665d6cf7ee21'), // party plates and treats
};

/**
 * Gives demo products that still have the old drawn artwork (or no image) their photo.
 * Staff-uploaded images are never touched.
 */
async function applyProductPhotos(q) {
  let updated = 0;
  for (const [sku, url] of Object.entries(PRODUCT_PHOTOS)) {
    const r = await q(
      "UPDATE products SET image_url = ? WHERE sku = ? AND (image_url IS NULL OR image_url = '' OR image_url LIKE '/seed-images/%')",
      [url, sku]
    );
    updated += r.affectedRows || 0;
  }
  return updated;
}

module.exports = { PRODUCT_PHOTOS, applyProductPhotos };
