const config = require('../config');

let adminClient = null;

async function getSupabaseAdmin() {
  if (!adminClient) {
    if (!config.supabase.url || !config.supabase.secretKey) {
      console.warn('[Supabase] Credenciales incompletas en config.');
      return null;
    }
    try {
      // Use the package's ESM entry point. Its CommonJS entry requires `jose`,
      // which is ESM-only and crashes in Vercel's Node runtime.
      const { createAdminClient } = await import('@supabase/server/core');
      adminClient = createAdminClient({
        supabaseUrl: config.supabase.url,
        secretKey: config.supabase.secretKey,
      });
    } catch (error) {
      console.error('[Supabase] Error inicializando admin client:', error.message);
      return null;
    }
  }
  return adminClient;
}

async function checkSupabaseHealth() {
  try {
    const client = await getSupabaseAdmin();
    if (!client) {
      return { status: 'unconfigured', message: 'Variables de Supabase no configuradas' };
    }
    // Verificación rápida consultando el servicio de autenticación
    const { error } = await client.auth.admin.listUsers({ page: 1, perPage: 1 });
    if (error) {
      return { status: 'error', error: error.message };
    }
    return { status: 'connected', url: config.supabase.url };
  } catch (error) {
    return { status: 'error', error: error.message };
  }
}

module.exports = {
  getSupabaseAdmin,
  checkSupabaseHealth,
};
