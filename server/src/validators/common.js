const { body, param } = require('express-validator');

const PASSWORD_RULE_MSG = 'Password must be at least 8 characters and include a letter and a number';

const passwordRule = (field = 'password') =>
  body(field)
    .isString().withMessage(PASSWORD_RULE_MSG)
    .isLength({ min: 8, max: 72 }).withMessage(PASSWORD_RULE_MSG)
    .matches(/[A-Za-z]/).withMessage(PASSWORD_RULE_MSG)
    .matches(/\d/).withMessage(PASSWORD_RULE_MSG);

const emailRule = (field = 'email') =>
  body(field).trim().isEmail().withMessage('Enter a valid email address').isLength({ max: 150 }).normalizeEmail({ gmail_remove_dots: false });

const phoneRule = (field = 'phone', { optional = false } = {}) => {
  const chain = body(field);
  return (optional ? chain.optional({ values: 'falsy' }) : chain)
    .trim()
    // Accept the way people actually type numbers ("077 123 4567", "+94-77-123-4567") and store digits only.
    .customSanitizer((v) => String(v ?? '').replace(/[\s().-]/g, ''))
    .matches(/^(\+94|0)?\d{9}$/).withMessage('Enter a valid phone number (e.g. 0771234567)');
};

const nameRule = (field = 'fullName', label = 'Full name') =>
  body(field).trim().isLength({ min: 2, max: 100 }).withMessage(`${label} must be 2-100 characters`);

const idParam = (name = 'id') => param(name).isInt({ min: 1 }).withMessage('Invalid id').toInt();

module.exports = { passwordRule, emailRule, phoneRule, nameRule, idParam, PASSWORD_RULE_MSG };
