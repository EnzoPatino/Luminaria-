const { z } = require('zod');
const { login, register } = require('../services/authService');
const { IngestionError } = require('../errors/ingestionError');

// ─────────────────────────────────────────────────────────────────────────────
// BE-04: Controlador de autenticación (login y registro de usuarios).
// ─────────────────────────────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().min(1, 'Email o nombre de usuario requerido.'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres.'),
});

const registerSchema = z.object({
  nombre: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres.').max(120),
  apellido: z.string().trim().optional().default(''),
  usuario: z.string().trim().min(3, 'El usuario debe tener al menos 3 caracteres.').optional(),
  dni: z.string().trim().optional(),
  telefono: z.string().trim().optional(),
  email: z.string().email('Email inválido.').optional(),
  password: z.string().min(12, 'La contraseña debe tener al menos 12 caracteres.').max(128).optional(),
  rol: z.enum(['admin', 'tecnico']).optional().default('tecnico'),
});

async function handleLogin(req, res, next) {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Datos de login inválidos.',
        details: parsed.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
      });
    }

    const result = await login(parsed.data.email, parsed.data.password, req.ip);

    if (!result) {
      return res.status(401).json({
        status: 'error',
        message: 'Credenciales incorrectas.',
      });
    }

    return res.json({
      status: 'ok',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

async function handleRegister(req, res, next) {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Datos de registro inválidos.',
        details: parsed.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
      });
    }

    const baseUsuario = (parsed.data.usuario || parsed.data.nombre)
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '')
      .slice(0, 24) || 'usuario';
    const usuario = await register({
      ...parsed.data,
      usuario: parsed.data.usuario || `${baseUsuario}.${require('crypto').randomInt(100, 1000)}`,
      id_admin: req.user.id_usuario,
    }, req.ip);

    return res.status(201).json({
      status: 'ok',
      data: usuario,
    });
  } catch (error) {
    // Duplicado de email
    if (error.code === '23505') {
      return res.status(409).json({
        status: 'error',
        message: 'Ya existe un usuario con ese email.',
      });
    }
    next(error);
  }
}

async function handleMe(req, res) {
  return res.json({
    status: 'ok',
    data: req.user,
  });
}

module.exports = { handleLogin, handleRegister, handleMe };
