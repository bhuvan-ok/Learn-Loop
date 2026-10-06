const jwt = require('jsonwebtoken');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const User = require('../models/User');

const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.split(' ')[1] : null;

  if (!token) {
    throw new ApiError(401, 'Not authorized, no token provided');
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch (err) {
    throw new ApiError(401, 'Not authorized, invalid or expired token');
  }

  const user = await User.findById(decoded.id).select('-passwordHash');
  if (!user) {
    throw new ApiError(401, 'Not authorized, user no longer exists');
  }

  req.user = user;
  next();
});

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    throw new ApiError(403, `Requires one of these roles: ${roles.join(', ')}`);
  }
  next();
};

// For routes that must stay publicly browsable (e.g. course detail) but still
// need to know *who's asking* when a token is present, so the controller can
// grant enrolled students/owning tutors/admins full content while anonymous
// visitors get a preview. Unlike `protect`, a missing or invalid token is
// never fatal here — the request just proceeds unauthenticated.
const optionalAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.split(' ')[1] : null;

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
      const user = await User.findById(decoded.id).select('-passwordHash');
      if (user) req.user = user;
    } catch {
      // Invalid/expired token on a route that supports anonymous access —
      // treat as unauthenticated rather than failing the whole request.
    }
  }

  next();
});

module.exports = { protect, requireRole, optionalAuth };
