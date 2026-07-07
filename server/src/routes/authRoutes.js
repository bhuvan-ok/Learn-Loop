const express = require('express');
const { register, login, me } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { registerValidators, loginValidators } = require('../validators/authValidators');

const router = express.Router();

router.post('/register', registerValidators, validate, register);
router.post('/login', loginValidators, validate, login);
router.get('/me', protect, me);

module.exports = router;
