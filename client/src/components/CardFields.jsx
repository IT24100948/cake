import { useEffect, useState } from 'react';
import { myApi } from '../api';
import { Alert, Field } from './ui';

/*
 * Card entry shared by checkout and the "Pay now" form. The checks mirror the gateway's
 * (server/src/services/paymentGateway.js), so most mistakes are caught before sending.
 */
export const digits = (v) => String(v || '').replace(/\D/g, '');

function luhn(n) {
  let sum = 0;
  let dbl = false;
  for (let i = n.length - 1; i >= 0; i -= 1) {
    let d = Number(n[i]);
    if (dbl) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
    dbl = !dbl;
  }
  return n.length > 0 && sum % 10 === 0;
}

export function cardBrand(n) {
  if (/^4/.test(n)) return 'Visa';
  if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(n)) return 'Mastercard';
  if (/^3[47]/.test(n)) return 'Amex';
  return '';
}

export const formatCardNumber = (v) => {
  const n = digits(v).slice(0, 19);
  return cardBrand(n) === 'Amex'
    ? n.replace(/^(\d{0,4})(\d{0,6})(\d{0,5}).*/, (_, a, b, c) => [a, b, c].filter(Boolean).join(' '))
    : n.replace(/(\d{4})(?=\d)/g, '$1 ');
};

const formatExpiry = (v) => {
  const n = digits(v).slice(0, 4);
  return n.length > 2 ? `${n.slice(0, 2)}/${n.slice(2)}` : n;
};

export const emptyCard = (name = '') => ({ cardholderName: name, cardNumber: '', expiry: '', cvc: '' });

/** Field errors for the card inputs (undefined when valid). */
export function validateCard(v) {
  const n = digits(v.cardNumber);
  const [mm, yy] = String(v.expiry || '').split('/');
  const month = Number(mm);
  const year = 2000 + Number(yy);
  const now = new Date();
  const brand = cardBrand(n);
  const cvcLength = brand === 'Amex' ? 4 : 3;
  return {
    cardholderName: String(v.cardholderName || '').trim().length >= 2 ? undefined : 'Enter the name on the card',
    cardNumber: n.length >= 13 && luhn(n) && brand ? undefined : 'Enter a valid card number',
    expiry: !(month >= 1 && month <= 12 && yy?.length === 2) ? 'Enter the expiry date as MM/YY'
      : year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1) ? 'This card has expired' : undefined,
    cvc: new RegExp(`^\\d{${cvcLength}}$`).test(v.cvc || '') ? undefined : `Enter the ${cvcLength}-digit security code`,
  };
}

/** The card as the API expects it. */
export function cardPayload(v) {
  const [mm, yy] = String(v.expiry || '').split('/');
  return { cardholderName: v.cardholderName.trim(), cardNumber: digits(v.cardNumber), expMonth: Number(mm), expYear: 2000 + Number(yy), cvc: v.cvc };
}

/** Maps API field errors (cardNumber, expMonth, card.cardNumber...) onto the form's field names. */
export function cardErrors(errors = {}) {
  const out = {};
  for (const [k, msg] of Object.entries(errors)) {
    const field = k.replace(/^card\./, '');
    out[['expMonth', 'expYear'].includes(field) ? 'expiry' : field] = msg;
  }
  return out;
}

export const newPaymentKey = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`);

/** Name, number (with brand), expiry and CVC inputs bound to a useForm() instance. */
export function CardFields({ f, idPrefix = 'card' }) {
  const brand = cardBrand(digits(f.values.cardNumber));
  return (
    <div className="stack">
      <Field label="Name on card" autoComplete="cc-name" required {...f.bind('cardholderName')} />
      <div className="field">
        <label htmlFor={`${idPrefix}-number`}>Card number<span className="req">*</span></label>
        <div className="pay-card-input">
          <input id={`${idPrefix}-number`} className="input" inputMode="numeric" autoComplete="cc-number" placeholder="1234 5678 9012 3456"
            value={f.values.cardNumber} aria-invalid={f.errors.cardNumber ? 'true' : undefined}
            onChange={(e) => f.set('cardNumber', formatCardNumber(e.target.value))} />
          {brand && <span className="pay-brand">{brand}</span>}
        </div>
        {f.errors.cardNumber && <span className="field-error">{f.errors.cardNumber}</span>}
      </div>
      <div className="form-grid">
        <Field label="Expiry (MM/YY)" inputMode="numeric" autoComplete="cc-exp" placeholder="MM/YY" required
          {...f.bind('expiry')} onChange={(e) => f.set('expiry', formatExpiry(e.target.value))} />
        <Field label="Security code (CVC)" inputMode="numeric" autoComplete="cc-csc" placeholder={brand === 'Amex' ? '4 digits' : '3 digits'} required
          {...f.bind('cvc')} onChange={(e) => f.set('cvc', digits(e.target.value).slice(0, 4))} />
      </div>
    </div>
  );
}

/** "This is a prototype" notice. */
export function SandboxNotice() {
  return (
    <Alert type="info">
      <strong>Prototype payments (DevmaPay sandbox).</strong> No real money is taken and the card number is never stored.
      Never enter a real card: use a test card below.
    </Alert>
  );
}

/** The gateway's test cards; picking one fills the form with it. */
export function TestCards({ f }) {
  const [cards, setCards] = useState([]);
  useEffect(() => { myApi.testCards().then((r) => setCards(r.data)).catch(() => {}); }, []);
  if (!cards.length) return null;
  const pick = (number) => {
    f.setValues((v) => ({ ...v, cardNumber: formatCardNumber(number), expiry: `12/${String(new Date().getFullYear() + 2).slice(2)}`, cvc: '123' }));
    f.setErrors({});
    f.setFormError('');
  };
  return (
    <details className="pay-test-cards">
      <summary>Test cards</summary>
      <ul>
        {cards.map((c) => (
          <li key={c.number}>
            <button type="button" className="link-btn" onClick={() => pick(c.number)}>{formatCardNumber(c.number)}</button>
            <span className={c.outcome === 'approved' ? 'success-text' : 'muted'}>{c.label}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs muted mb-0">Any future expiry date and any 3-digit CVC work. Other card numbers are declined.</p>
    </details>
  );
}
