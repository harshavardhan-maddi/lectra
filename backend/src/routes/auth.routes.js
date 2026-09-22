const express = require('express');
const router = express.Router();
const { login, register, deleteUser, updateUser, getUsers, getDepartments, me, updateProfile } = require('../controllers/auth.controller');
const {
  checkFingerprintStatus,
  generateRegisterOptions,
  verifyRegister,
  generateLoginOptions,
  verifyLogin,
  getFingerprintSettings,
  removeFingerprint,
  toggleFingerprint,
} = require('../controllers/fingerprint.controller');
const authMiddleware = require('../middleware/auth.middleware');
const roleMiddleware = require('../middleware/role.middleware');

router.post('/login', login);
router.get('/me', authMiddleware, me);
router.put('/profile', authMiddleware, updateProfile);
router.get('/departments', authMiddleware, getDepartments);

// Fingerprint Auth operations
router.post('/fingerprint/check', checkFingerprintStatus);
router.post('/fingerprint/login-options', generateLoginOptions);
router.post('/fingerprint/login-verify', verifyLogin);
router.get('/fingerprint/settings', authMiddleware, roleMiddleware(['HOD', 'SUB_ADMIN', 'SUPER_ADMIN']), getFingerprintSettings);
router.post('/fingerprint/register-options', authMiddleware, roleMiddleware(['HOD', 'SUB_ADMIN', 'SUPER_ADMIN']), generateRegisterOptions);
router.post('/fingerprint/register-verify', authMiddleware, roleMiddleware(['HOD', 'SUB_ADMIN', 'SUPER_ADMIN']), verifyRegister);
router.post('/fingerprint/remove', authMiddleware, roleMiddleware(['HOD', 'SUB_ADMIN', 'SUPER_ADMIN']), removeFingerprint);
router.put('/fingerprint/toggle', authMiddleware, roleMiddleware(['HOD', 'SUB_ADMIN', 'SUPER_ADMIN']), toggleFingerprint);

// Management operations (HOD & Super Admin)
router.post('/register', authMiddleware, roleMiddleware(['HOD', 'SUPER_ADMIN']), register);
router.put('/users/:id', authMiddleware, roleMiddleware(['HOD', 'SUPER_ADMIN']), updateUser);
router.delete('/users/:id', authMiddleware, roleMiddleware(['HOD', 'SUPER_ADMIN']), deleteUser);
router.get('/users', authMiddleware, roleMiddleware(['HOD', 'SUPER_ADMIN']), getUsers);

module.exports = router;
