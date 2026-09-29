const { validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');

/** Runs express-validator chains and responds 422 with { field: message } on failure. */
const validate = (chains) => [
  ...chains,
  (req, res, next) => {
    const result = validationResult(req);
    if (result.isEmpty()) return next();
    const errors = {};
    for (const e of result.array()) {
      const key = e.path || e.param || '_';
      if (!errors[key]) errors[key] = e.msg;
    }
    next(ApiError.unprocessable('Please correct the highlighted fields', errors));
  },
];

module.exports = { validate };
