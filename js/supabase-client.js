/**
 * Luminaria — Integración Cliente Supabase (Data Architect)
 * Maneja inicialización, persistencia en nube (CRUD) y tiempo real para tableros y alertas.
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
      this.realtimeChannel = null;
    }

    onStatusChange(callback) {
      if (typeof callback === "function") {
        this.statusListeners.push(callback);
        // Notificar inmediatamente el estado actual si ya existe
        if (this.status !== "connecting") {
          try {
            callback(this.status);
          } catch (_) {}
        }
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

      // Intentar sincronizar credenciales actualizadas desde el backend
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
        // Fallback al DEFAULT_CONFIG
      }

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
        console.warn("[Supabase] SDK no disponible en window.supabase");
        this._setStatus("disconnected");
      }

      return this.client;
    }

    async checkConnection() {
      this._setStatus("connecting");
      try {
        const healthUrl = `${this.config.url}/auth/v1/health`;
        const res = await fetch(healthUrl, {
          method: "GET",
          headers: { apikey: this.config.publishableKey },
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

    // ==========================================
    // PERSISTENCIA EN LA NUBE (PostgreSQL Cloud)
    // ==========================================

    async fetchTableros() {
      if (!this.client || this.status !== "connected") return null;
      try {
        const { data, error } = await this.client
          .from("tableros")
          .select("*")
          .order("id_tablero", { ascending: true });
        if (error) throw error;
        return Array.isArray(data) && data.length > 0 ? data : null;
      } catch (err) {
        console.warn("[Supabase] Tableros no disponibles en nube (¿Se ejecutó supabase_schema.sql?):", err.message);
        return null;
      }
    }

    async fetchAlertas(limit = 50) {
      if (!this.client || this.status !== "connected") return null;
      try {
        const { data, error } = await this.client
          .from("alertas")
          .select("*")
          .order("fecha_hora_generada", { ascending: false })
          .limit(limit);
        if (error) throw error;
        return Array.isArray(data) ? data : null;
      } catch (err) {
        console.warn("[Supabase] Alertas no disponibles en nube:", err.message);
        return null;
      }
    }

    async insertAlerta(alerta) {
      if (!this.client || this.status !== "connected") return null;
      try {
        const record = {
          id_tablero: String(alerta.id_tablero || "TABLERO_01"),
          tipo_evento: String(alerta.tipo_evento || "ALERTA"),
          prioridad: ["CRITICA", "ADVERTENCIA", "INFO"].includes(alerta.severidad)
            ? alerta.severidad
            : "INFO",
          titulo: String(alerta.titulo || `Alerta en ${alerta.id_tablero || "tablero"}`),
          ubicacion: String(alerta.ubicacion || "Ubicación no informada"),
          datos_json: alerta.datos && typeof alerta.datos === "object" ? alerta.datos : {},
          estado_alerta: alerta.resuelta ? "resuelta" : "activa",
          fecha_hora_generada: alerta.timestamp || new Date().toISOString(),
        };

        const { data, error } = await this.client
          .from("alertas")
          .insert([record])
          .select();
        if (error) throw error;
        return data && data[0] ? data[0] : null;
      } catch (err) {
        console.warn("[Supabase] No se pudo persistir la alerta en nube:", err.message);
        return null;
      }
    }

    async resolveAlerta(idAlerta, tecnico = "Supervisor") {
      if (!this.client || this.status !== "connected") return null;
      try {
        // Soporta tanto ID numérico de Supabase como ID temporal
        const numericId = Number(idAlerta);
        let query = this.client
          .from("alertas")
          .update({
            estado_alerta: "resuelta",
            fecha_resolucion: new Date().toISOString(),
            tecnico_resolucion: tecnico,
          });

        if (Number.isFinite(numericId)) {
          query = query.eq("id_alerta", numericId);
        } else {
          query = query.eq("titulo", String(idAlerta));
        }

        const { data, error } = await query.select();
        if (error) throw error;
        return data;
      } catch (err) {
        console.warn("[Supabase] Error resolviendo alerta en nube:", err.message);
        return null;
      }
    }

    async updateTablero(idTablero, updates) {
      if (!this.client || this.status !== "connected") return null;
      try {
        const { data, error } = await this.client
          .from("tableros")
          .update({
            ...updates,
            ultima_actualizacion: new Date().toISOString(),
          })
          .eq("id_tablero", idTablero)
          .select();
        if (error) throw error;
        return data;
      } catch (err) {
        console.warn("[Supabase] Error actualizando tablero en nube:", err.message);
        return null;
      }
    }

    subscribeToRealtime(onAlertChange, onTableroChange) {
      if (!this.client || this.realtimeChannel) return this.realtimeChannel;
      try {
        this.realtimeChannel = this.client
          .channel("luminaria-live-sync")
          .on("postgres_changes", { event: "*", schema: "public", table: "alertas" }, (payload) => {
            if (typeof onAlertChange === "function") onAlertChange(payload);
          })
          .on("postgres_changes", { event: "*", schema: "public", table: "tableros" }, (payload) => {
            if (typeof onTableroChange === "function") onTableroChange(payload);
          })
          .subscribe();
        return this.realtimeChannel;
      } catch (err) {
        console.warn("[Supabase Realtime] Error en suscripción:", err.message);
        return null;
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

  window.luminariaSupabase = new LuminariaSupabaseClient();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      window.luminariaSupabase.init();
    });
  } else {
    window.luminariaSupabase.init();
  }
})();
