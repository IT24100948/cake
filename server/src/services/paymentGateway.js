/**
 * DevmaPay sandbox - a built-in card payment gateway for the prototype. No third party is involved
 * and no real money moves; it behaves like a real processor so the whole payment flow can be tested:
 *
 *  - validates the card (Luhn check, brand, expiry, CVC length);
 *  - verifies a card at checkout and returns a token for it, so it can be charged later
 *    (when the final total is known) without the shop ever keeping the card number;
 *  - authorises a charge or declines it with a reason, decided by the test card number;
 *  - issues a unique gateway reference for every charge and refund;
 *  - refunds a previous charge back to the same card.
 *
 * Only the published test cards below are accepted, so a real card number is always declined.
 * Card numbers and CVCs are never stored or logged: callers keep only the brand and last four digits.
 */
const crypto = require('crypto');

/**
 * `outcome` is how the simulated bank answers. `atVerify: true` declines are caught when the card
 * is checked at checkout; insufficient funds only shows up when money is actually taken.
 */
const TEST_CARDS = {
  '4242424242424242': { outcome: 'approved', label: 'Visa - payment succeeds' },
  '5555555555554444': { outcome: 'approved', label: 'Mastercard - payment succeeds' },
  '4000000000000002': { outcome: 'card_declined', atVerify: true, label: 'Declined by the bank' },
  '4000000000009995': { outcome: 'insufficient_funds', label: 'Accepted at checkout, then declined when charged (insufficient funds)' },
  '4000000000000069': { outcome: 'expired_card', atVerify: true, label: 'Declined - card expired' },
  '4000000000000127': { outcome: 'incorrect_cvc', atVerify: true, label: 'Declined - incorrect CVC' },
};

const DECLINE_MESSAGES = {
  card_declined: 'Your card was declined. Please use a different card.',
  insufficient_funds: 'Your card has insufficient funds.',
  expired_card: 'Your card has expired.',
  incorrect_cvc: 'The security code (CVC) is incorrect.',
  not_a_test_card: 'This is a demo payment page. Please use one of the test cards shown - never a real card.',
};

const digitsOnly = (v) => String(v ?? '').replace(/[\s-]/g, '');

function luhnValid(number) {
  let sum = 0;
  let double = false;
  for (let i = number.length - 1; i >= 0; i -= 1) {
    let d = Number(number[i]);
    if (double) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

function cardBrand(number) {
  if (/^4/.test(number)) return 'Visa';
  if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(number)) return 'Mastercard';
  if (/^3[47]/.test(number)) return 'Amex';
  return null;
}

/** Returns { errors } with a message per invalid field, or { card } with the normalised details. */
function validateCard({ cardNumber, expMonth, expYear, cvc, cardholderName }, now = new Date()) {
  const errors = {};
  const number = digitsOnly(cardNumber);
  const brand = cardBrand(number);
  if (!/^\d{13,19}$/.test(number) || !luhnValid(number)) errors.cardNumber = 'Enter a valid card number';
  else if (!brand) errors.cardNumber = 'Only Visa, Mastercard and American Express are accepted';

  const month = Number(expMonth);
  let year = Number(expYear);
  if (year < 100) year += 2000;
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year)) {
    errors.expiry = 'Enter the expiry date as MM/YY';
  } else if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) {
    errors.expiry = 'This card has expired';
  } else if (year > now.getFullYear() + 20) {
    errors.expiry = 'Enter a valid expiry year';
  }

  const cvcLength = brand === 'Amex' ? 4 : 3;
  if (!new RegExp(`^\\d{${cvcLength}}$`).test(String(cvc ?? ''))) errors.cvc = `Enter the ${cvcLength}-digit security code`;

  const name = String(cardholderName ?? '').trim();
  if (name.length < 2 || name.length > 100) errors.cardholderName = 'Enter the name on the card';

  if (Object.keys(errors).length) return { errors };
  return { card: { number, brand, last4: number.slice(-4), holder: name } };
}

const newRef = (prefix) => `${prefix}_${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(5).toString('hex').toUpperCase()}`;

/**
 * Authorises a charge. `card` comes from validateCard().
 * Returns { approved, gatewayRef, failureCode?, message? }.
 */
function charge({ amount, card }) {
  const gatewayRef = newRef('ch');
  if (!(amount > 0)) return { approved: false, gatewayRef, failureCode: 'invalid_amount', message: 'Invalid amount' };
  const test = TEST_CARDS[card.number];
  const outcome = test ? test.outcome : 'not_a_test_card';
  if (outcome === 'approved') return { approved: true, gatewayRef };
  return { approved: false, gatewayRef, failureCode: outcome, message: DECLINE_MESSAGES[outcome] };
}

/**
 * Checks a card without taking money (a zero-amount authorisation) and returns a token for it.
 * Returns { approved, token, profile } or { approved: false, failureCode, message }.
 * `profile` stands in for the issuing bank inside the sandbox: it decides how later charges on this
 * token are answered. A real gateway keeps the card in its own vault; the shop only ever has the token.
 */
function verify(card) {
  const test = TEST_CARDS[card.number];
  if (!test) return { approved: false, failureCode: 'not_a_test_card', message: DECLINE_MESSAGES.not_a_test_card };
  if (test.atVerify) return { approved: false, failureCode: test.outcome, message: DECLINE_MESSAGES[test.outcome] };
  return { approved: true, token: newRef('pm'), profile: test.outcome };
}

/** Charges a card saved earlier with verify(), e.g. when the order is confirmed and its total is final. */
function chargeSaved({ amount, profile }) {
  const gatewayRef = newRef('ch');
  if (!(amount > 0)) return { approved: false, gatewayRef, failureCode: 'invalid_amount', message: 'Invalid amount' };
  if (profile === 'approved') return { approved: true, gatewayRef };
  return { approved: false, gatewayRef, failureCode: profile, message: DECLINE_MESSAGES[profile] || DECLINE_MESSAGES.card_declined };
}

/** Refunds (part of) an earlier approved charge back to the same card. */
function refund({ amount, originalRef }) {
  if (!(amount > 0) || !originalRef) return { approved: false, gatewayRef: newRef('re'), failureCode: 'invalid_refund', message: 'Invalid refund' };
  return { approved: true, gatewayRef: newRef('re') };
}

const testCards = () => Object.entries(TEST_CARDS).map(([number, { outcome, label }]) => ({ number, outcome, label }));

module.exports = { validateCard, charge, verify, chargeSaved, refund, testCards, luhnValid, cardBrand, TEST_CARDS };
