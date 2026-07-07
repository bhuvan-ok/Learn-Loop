const bcrypt = require('bcryptjs');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const generateToken = require('../utils/generateToken');

const toPublicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
});

// Admin accounts are never created through public registration — they can
// only be granted by an existing admin (see adminController.setUserRole).
// This keeps privilege escalation out of the public API surface entirely.
const register = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    throw new ApiError(409, 'An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    name,
    email: email.toLowerCase(),
    passwordHash,
    role: role === 'tutor' ? 'tutor' : 'student',
  });

  res.status(201).json({
    user: toPublicUser(user),
    token: generateToken(user),
  });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    throw new ApiError(401, 'Invalid email or password');
  }

  res.json({
    user: toPublicUser(user),
    token: generateToken(user),
  });
});

const me = asyncHandler(async (req, res) => {
  res.json({ user: toPublicUser(req.user) });
});

module.exports = { register, login, me };
