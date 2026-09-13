const { createAdminClient } = require('@supabase/server/core');
const config = require('../config');

let adminClient = null;

function getSupabaseAdmin() {
  if (!adminClient) {
    if (!config.supabase.url || !config.supabase.secretKey) {
      console.warn('[Supabase] Credenciales incompletas en config.');
      return null;
    }
    try {
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
    const client = getSupabaseAdmin();
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
