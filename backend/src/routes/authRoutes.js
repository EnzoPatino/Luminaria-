const express = require('express');
const { handleLogin, handleRegister, handleMe } = require('../controllers/authController');
const { requireAuth, requireRole } = require('../middlewares/authMiddleware');
const { audit } = require('../middlewares/auditMiddleware');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// POST /api/auth/login — Público
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { status: 'error', statusCode: 429, message: 'Demasiados intentos. Probá de nuevo más tarde.' },
});
router.post('/login', loginLimiter, audit('LOGIN', 'auth'), handleLogin);

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
