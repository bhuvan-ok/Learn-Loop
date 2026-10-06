const express = require('express');
const { getStats, listUsers, setUserRole, listAllCourses } = require('../controllers/adminController');
const { protect, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { setUserRoleValidators } = require('../validators/adminValidators');

const router = express.Router();

router.use(protect, requireRole('admin'));

router.get('/stats', getStats);
router.get('/users', listUsers);
router.patch('/users/:id/role', setUserRoleValidators, validate, setUserRole);
router.get('/courses', listAllCourses);

module.exports = router;
