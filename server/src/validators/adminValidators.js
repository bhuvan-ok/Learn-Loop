const { body } = require('express-validator');

const setUserRoleValidators = [
  body('role')
    .isIn(['admin', 'student', 'tutor'])
    .withMessage('Role must be admin, student, or tutor'),
];

module.exports = { setUserRoleValidators };
