const express = require('express');
const { handleLogin, handleRegister, handleMe } = require('../controllers/authController');
const { requireAuth, requireRole } = require('../middlewares/authMiddleware');
const { audit } = require('../middlewares/auditMiddleware');

const router = express.Router();

// POST /api/auth/login — Público
router.post('/login', audit('LOGIN', 'auth'), handleLogin);

// POST /api/auth/register — Solo admins pueden registrar usuarios nuevos
router.post(
  '/register',
  requireAuth,
  requireRole('admin'),
  audit('REGISTRO_USUARIO', 'usuarios'),
  handleRegister
);

// GET /api/auth/me — Obtener datos del usuario autenticado
router.get('/me', requireAuth, handleMe);

module.exports = router;
