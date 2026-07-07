const { validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');

// Runs after a route's express-validator chains. Surfaces the first
// validation failure as a clean 400 rather than letting bad input reach
// controller logic or the database.
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(400, errors.array()[0].msg);
  }
  next();
}

module.exports = validate;
