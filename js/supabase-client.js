/**
 * Luminaria — Integración Cliente Supabase
 * Maneja la inicialización, estado de conexión y acceso a servicios de Supabase.
 */

(function () {
  const DEFAULT_CONFIG = {
    url: "https://rhnglkhvqfmapwdbcktm.supabase.co",
    publishableKey: "sb_publishable_o3mrqL8225YgCj31CdfFzA_XMrLPMk7",
  };

  class LuminariaSupabaseClient {
    constructor() {
      this.config = { ...DEFAULT_CONFIG };
      this.client = null;
      this.status = "connecting"; // 'connecting' | 'connected' | 'disconnected' | 'error'
      this.statusListeners = [];
      this.initialized = false;
    }

    onStatusChange(callback) {
      if (typeof callback === "function") {
        this.statusListeners.push(callback);
      }
    }

    _setStatus(status, detail = null) {
      this.status = status;
      this.updateUI();
      this.statusListeners.forEach((fn) => {
        try {
          fn(status, detail);
        } catch (e) {
          console.error("[Supabase] Error en callback de estado:", e);
        }
      });
    }

    async init() {
      if (this.initialized) return this.client;
      this.initialized = true;

      // Intentar obtener credenciales actualizadas desde la API del backend si está disponible
      try {
        const res = await fetch("http://localhost:3000/api/config", {
          signal: AbortSignal.timeout ? AbortSignal.timeout(2000) : undefined,
        });
        if (res.ok) {
          const body = await res.json();
          if (body?.data?.supabaseUrl && body?.data?.supabasePublishableKey) {
            this.config.url = body.data.supabaseUrl;
            this.config.publishableKey = body.data.supabasePublishableKey;
          }
        }
      } catch (_) {
        // Fallback transparente a DEFAULT_CONFIG si el backend no está activo
      }

      // Inicializar el cliente Supabase usando la librería global
      if (window.supabase && typeof window.supabase.createClient === "function") {
        try {
          this.client = window.supabase.createClient(this.config.url, this.config.publishableKey, {
            auth: {
              persistSession: true,
              autoRefreshToken: true,
              detectSessionInUrl: true,
            },
          });
          window.supabaseClient = this.client;
          await this.checkConnection();
        } catch (err) {
          console.error("[Supabase] Error inicializando cliente:", err);
          this._setStatus("error", err);
        }
      } else {
        console.warn("[Supabase] Librería @supabase/supabase-js no detectada en window.supabase");
        this._setStatus("disconnected");
      }

      return this.client;
    }

    async checkConnection() {
      this._setStatus("connecting");
      try {
        // Verificación activa contra el endpoint de health de Supabase
        const healthUrl = `${this.config.url}/auth/v1/health`;
        const res = await fetch(healthUrl, {
          method: "GET",
          headers: {
            apikey: this.config.publishableKey,
          },
          signal: AbortSignal.timeout ? AbortSignal.timeout(4000) : undefined,
        });

        if (res.ok) {
          this._setStatus("connected");
          return true;
        } else {
          this._setStatus("disconnected");
          return false;
        }
      } catch (err) {
        console.warn("[Supabase] Fallo al verificar conexión:", err.message);
        this._setStatus("disconnected", err);
        return false;
      }
    }

    updateUI() {
      const dot = document.getElementById("supabaseStatusDot");
      const text = document.getElementById("supabaseStatusText");
      const pill = document.getElementById("supabaseStatusPill");

      if (!dot || !text) return;

      dot.className = "status-dot";

      if (this.status === "connected") {
        dot.classList.add("connected");
        text.textContent = "Supabase Online";
        if (pill) pill.setAttribute("title", `Supabase Conectado: ${this.config.url}`);
      } else if (this.status === "connecting") {
        dot.classList.add("simulating");
        text.textContent = "Supabase Conectando...";
        if (pill) pill.setAttribute("title", "Conectando a Supabase...");
      } else {
        dot.classList.add("disconnected");
        text.textContent = "Supabase Offline";
        if (pill) pill.setAttribute("title", "Supabase no disponible");
      }
    }
  }

  // Instancia única global
  window.luminariaSupabase = new LuminariaSupabaseClient();

  // Inicializar al cargar el DOM
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      window.luminariaSupabase.init();
    });
  } else {
    window.luminariaSupabase.init();
  }
})();
