/** Client-side rules mirroring the API validators. */
export const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());
// Spaces, dashes and brackets are allowed; the API strips them before saving.
export const isPhone = (v) => /^(\+94|0)?\d{9}$/.test(String(v || '').replace(/[\s().-]/g, ''));
export const passwordError = (v) =>
  !v || v.length < 8 || !/[A-Za-z]/.test(v) || !/\d/.test(v)
    ? 'Password must be at least 8 characters and include a letter and a number'
    : undefined;
export const required = (v, label) => (String(v ?? '').trim() ? undefined : `${label} is required`);
