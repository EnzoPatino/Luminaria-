/**
 * Project Luminaria - Lógica Principal de UI y Gestión de Eventos por Tableros
 * Municipalidad de Neuquén
 * Monitoreo centralizado por Tableros Eléctricos
 */

document.addEventListener("DOMContentLoaded", () => {
  const API_BASE_URL = window.LUMINARIA_CONFIG?.apiBaseUrl?.trim()
    ? `${window.LUMINARIA_CONFIG.apiBaseUrl.trim().replace(/\/$/, "")}/api`
    : window.location.protocol === "file:"
      ? "http://localhost:3000/api"
      : `${window.location.origin}/api`;
  const API_TIMEOUT_MS = 5000;
  // ==========================================
  // ESTADO DE LA APLICACIÓN
  // ==========================================
  const appState = {
    selectedTableroId: null,
    userRole: "admin",
    tableros: {},
    alerts: [],
    activeFilter: "ALL",
    soundEnabled: true,
    expandedTableroId: null,
    telemetry: {
      selectedTableroId: null,
      range: "1h",
      readings: {},
      maxHistoryPoints: 720,
    },
  };

  // Instancias de Chart.js
  let sensorLineChartInstance = null;
  let sensorBarChartInstance = null;

  // Referencias a elementos DOM
  const elements = {
    mqttStatusDot: document.getElementById("mqttStatusDot"),
    mqttStatusText: document.getElementById("mqttStatusText"),
    kpiAlertasCriticas: document.getElementById("kpiAlertasCriticas"),
    kpiAdvertencias: document.getElementById("kpiAdvertencias"),
    kpiTotalTableros: document.getElementById("kpiTotalTableros"),

    leafletMapContainer: document.getElementById("leafletMapContainer"),

    alertsContainer: document.getElementById("alertsContainer"),
    alertsCountBadge: document.getElementById("alertsCountBadge"),
    filterChips: document.querySelectorAll(".filter-chip"),

    mqttConsoleLog: document.getElementById("mqttConsoleLog"),
    btnClearConsole: document.getElementById("btnClearConsole"),

    btnOpenMqttModal: document.getElementById("btnOpenMqttModal"),
    roleSelector: document.getElementById("roleSelector"),
    roleIcon: document.getElementById("roleIcon"),
    btnToggleSound: document.getElementById("btnToggleSound"),
    btnToggleTheme: document.getElementById("btnToggleTheme"),
    btnHeaderMenu: document.getElementById("btnHeaderMenu"),
    headerActions: document.getElementById("headerActions"),
    soundLabelMobile: document.getElementById("soundLabelMobile"),
    themeLabelMobile: document.getElementById("themeLabelMobile"),
    mqttModal: document.getElementById("mqttModal"),
    closeMqttModal: document.getElementById("closeMqttModal"),

    formMqttConfig: document.getElementById("formMqttConfig"),
    btnConnectMosquitto: document.getElementById("btnConnectMosquitto"),


    // Elementos de la sección Sensores
  };

  // ==========================================
  // INICIALIZACIÓN
  // ==========================================
  async function init() {
    setupTabNavigation();
    setupEventListeners();
    setupMqttCallbacks();
    applyStoredTheme();
    applyAuthenticatedRole();
    updateTableroUI();
    renderAlerts();
    updateKPIs();
    renderMapPins();
    initTelemetryCharts();
    updateTelemetryUI();

    // Cargar datos persistidos antes de conectar el canal MQTT.
    await loadInitialData();
    await loadTelemetryHistory();
    if (window.luminariaMQTT) window.luminariaMQTT.connect();

    // Sincronización periódica automática (resguardo cada 5 segundos sin necesidad de F5)
    setInterval(async () => {
      if (document.visibilityState !== "hidden") {
        await loadInitialData();
        const telemetryView = document.getElementById("view-sensores");
        if (telemetryView && telemetryView.classList.contains("active")) {
          await loadTelemetryHistory();
        }
      }
    }, 5000);

    // Reloj para recalcular enlace activo o transmisión inactiva cada 5 segundos
    setInterval(() => {
      if (document.visibilityState !== "hidden") {
        renderTablerosGrid();
        updateKPIs();
      }
    }, 5000);
  }

  // La API es la fuente obligatoria para todo estado persistente.
  async function requestAPI(path, options = {}) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS);
    try {
      const response = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${window.luminariaAuth?.token || localStorage.getItem("luminaria_access_token") || ""}`,
          ...(options.headers || {}),
        },
        signal: controller.signal,
      });
      if (response.status === 401) {
        window.dispatchEvent(new Event("luminaria:session-expired"));
      }
      if (!response.ok) throw new Error(`API ${response.status}: ${path}`);
      const body = await response.json();
      if (!body || body.status !== "ok") throw new Error(`Invalid API response: ${path}`);
      return body.data;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  async function fetchTablerosFromAPI() {
    const tableros = await requestAPI("/tableros");
    if (!Array.isArray(tableros)) throw new Error("Invalid boards list.");
    return tableros;
  }

  async function fetchAlertasFromAPI() {
    const alertas = await requestAPI("/alertas");
    if (!Array.isArray(alertas)) throw new Error("Invalid alerts list.");
    return alertas;
  }

  async function resolveAlertaAPI(id) {
    return requestAPI(`/alertas/${encodeURIComponent(String(id))}/resolver`, {
      method: "PATCH",
    });
  }

  function toFiniteNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function normalizarTableroAPI(tablero) {
    const focos = {};
    if (Array.isArray(tablero.focos)) {
      tablero.focos.forEach((foco) => {
        const id = foco && foco.id_foco != null ? String(foco.id_foco) : "";
        if (!id) return;
        focos[id] = {
          id,
          corriente_ma: toFiniteNumber(foco.corriente_medida_ma, null),
          estado: ["ok", "robado", "quemado"].includes(foco.estado) ? foco.estado : "ok",
        };
      });
    } else if (tablero.focos && typeof tablero.focos === "object") {
      Object.entries(tablero.focos).forEach(([id, foco]) => {
        focos[id] = {
          id,
          corriente_ma: toFiniteNumber(foco.corriente_ma ?? foco.corriente_medida_ma, null),
          estado: ["ok", "robado", "quemado"].includes(foco.estado) ? foco.estado : "ok",
        };
      });
    }

    const rawId = tablero.id_tablero || tablero.codigo;
    const computedId = rawId
      ? String(rawId)
      : tablero.id != null
      ? `TABLERO_${String(tablero.id).padStart(2, "0")}`
      : "TABLERO_01";

    if (tablero.estado === "ok") {
      Object.keys(focos).forEach((id) => {
        focos[id].estado = "ok";
      });
    }

    return {
      id: computedId,
      nombre: tablero.nombre_tablero || tablero.nombre || computedId,
      ubicacion: tablero.ubicacion || "Ubicacion no informada",
      posX: Math.min(Math.max(toFiniteNumber(tablero.pos_x, 50), 0), 100),
      posY: Math.min(Math.max(toFiniteNumber(tablero.pos_y, 50), 0), 100),
      tension_v: toFiniteNumber(tablero.tension_medida_v, null),
      tension_nominal_v: toFiniteNumber(tablero.tension_nominal, 220),
      corriente_ma: toFiniteNumber(tablero.corriente_medida_ma ?? tablero.corriente_ma, null),
      fase: tablero.fase || "L1",
      estado: tablero.estado || "ok",
      ultimaLectura: tablero.ultima_lectura || tablero.ultimaLectura || null,
      estadoConexion: tablero.estado_conexion || tablero.estadoConexion || "ONLINE",
      fallaActiva: tablero.estado === "ok" ? "" : (tablero.fallaActiva || ""),
      focos,
    };
  }

  function normalizarAlertaAPI(alerta) {
    const tipo = alerta.tipo_alerta || alerta.tipo_evento || alerta.tipo || "ALERTA";
    const severidad = ["CRITICA", "ADVERTENCIA", "INFO"].includes(alerta.prioridad)
      ? alerta.prioridad
      : "INFO";
    const idTableroStr = alerta.id_tablero
      ? String(alerta.id_tablero).startsWith("TABLERO_")
        ? String(alerta.id_tablero)
        : `TABLERO_${String(alerta.id_tablero).padStart(2, "0")}`
      : alerta.id_tablero_num
      ? `TABLERO_${String(alerta.id_tablero_num).padStart(2, "0")}`
      : "TABLERO_01";

    return {
      id: String(alerta.id_alerta || alerta.id),
      tipo_evento: tipo,
      severidad,
      titulo: alerta.titulo || `${tipo.replace(/_/g, " ")} en ${idTableroStr}`,
      timestamp: alerta.fecha_hora_generada || alerta.fecha_hora || new Date().toISOString(),
      ubicacion: alerta.ubicacion || "Ubicacion no informada",
      datos: alerta.datos_json && typeof alerta.datos_json === "object" ? alerta.datos_json : {},
      id_tablero: idTableroStr,
      resuelta: alerta.estado_alerta === "resuelta" || alerta.estado === "resuelta",
    };
  }

  async function loadInitialData() {
    try {
      const [tablerosAPI, alertasAPI] = await Promise.all([
        fetchTablerosFromAPI(),
        fetchAlertasFromAPI(),
      ]);
      const tableros = Object.fromEntries(
        tablerosAPI
          .filter((tablero) => tablero && tablero.id_tablero != null)
          .map((tablero) => {
            const normalized = normalizarTableroAPI(tablero);
            // Fallback de fecha si el backend aún no exponía ultima_lectura
            if (!normalized.ultimaLectura && Array.isArray(alertasAPI)) {
              const latestAlert = alertasAPI.find(
                (a) => (a.id_tablero || a.id_tablero_num) === normalized.id
              );
              if (latestAlert && (latestAlert.fecha_hora_generada || latestAlert.fecha_hora)) {
                normalized.ultimaLectura = latestAlert.fecha_hora_generada || latestAlert.fecha_hora;
              }
            }
            // Preservar la lectura en memoria si es más reciente
            const existing = appState.tableros[normalized.id];
            if (existing && existing.ultimaLectura) {
              if (!normalized.ultimaLectura || new Date(existing.ultimaLectura) > new Date(normalized.ultimaLectura)) {
                normalized.ultimaLectura = existing.ultimaLectura;
              }
            }
            return [normalized.id, normalized];
          }),
      );
      if (Object.keys(tableros).length === 0) throw new Error("No persisted boards.");
      appState.tableros = tableros;
      appState.alerts = alertasAPI.map(normalizarAlertaAPI);
      if (!appState.tableros[appState.selectedTableroId]) {
        appState.selectedTableroId = Object.keys(appState.tableros)[0];
      }
      appState.telemetry.selectedTableroId = appState.selectedTableroId;
      populateTelemetryBoardSelect();
      refreshAllViews();
    } catch (error) {
      console.error("[Luminaria] No se pudieron cargar datos desde la API local.", error);
      const container = document.getElementById("tablerosGridContainer");
      if (container) container.innerHTML = '<p class="empty-state">No se pudo conectar con el servidor de datos. Reintentando…</p>';
    }
  }

  function populateTelemetryBoardSelect() {
    const select = document.getElementById("telemetryBoardSelect");
    if (!select) return;
    select.replaceChildren();
    Object.values(appState.tableros).forEach((tablero) => {
      const option = document.createElement("option");
      option.value = tablero.id;
      option.textContent = tablero.nombre || tablero.id;
      select.appendChild(option);
    });
    select.value = appState.telemetry.selectedTableroId || "";
  }

  // ==========================================
  // TEMA CLARO / OSCURO
  // ==========================================
  const THEME_STORAGE_KEY = "luminaria_theme";

  function getStoredTheme() {
    try {
      const t = localStorage.getItem(THEME_STORAGE_KEY);
      return t === "light" || t === "dark" ? t : "dark";
    } catch (e) {
      return "dark";
    }
  }

  function setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.classList.toggle("light-mode", theme === "light");
    if (document.body) {
      document.body.classList.toggle("light-mode", theme === "light");
    }
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (e) {}
    updateThemeIcon(theme);
    updateTelemetryChartsTheme();
  }

  function applyStoredTheme() {
    // Sincronizar tema y clase según valor guardado o atributo en html
    const current =
      document.documentElement.getAttribute("data-theme") || getStoredTheme();
    setTheme(current);
  }

  function updateThemeIcon(theme) {
    if (!elements.btnToggleTheme) return;
    const icon = elements.btnToggleTheme.querySelector("i");
    if (theme === "light") {
      if (icon) icon.className = "fas fa-sun";
      elements.btnToggleTheme.title = "Cambiar a modo oscuro";
      elements.btnToggleTheme.setAttribute(
        "aria-label",
        "Cambiar a modo oscuro",
      );
      if (elements.themeLabelMobile)
        elements.themeLabelMobile.textContent =
          "Modo: Claro (Tocar para Oscuro)";
    } else {
      if (icon) icon.className = "fas fa-moon";
      elements.btnToggleTheme.title = "Cambiar a modo claro";
      elements.btnToggleTheme.setAttribute(
        "aria-label",
        "Cambiar a modo claro",
      );
      if (elements.themeLabelMobile)
        elements.themeLabelMobile.textContent =
          "Modo: Oscuro (Tocar para Claro)";
    }
  }

  // ==========================================
  // GESTIÓN DE VISTAS POR ROL (ADMINISTRADOR / TÉCNICO)
  // ==========================================
  function setRole(role) {
    const authenticatedRole = window.luminariaAuth?.user?.rol;
    if (authenticatedRole && role !== authenticatedRole) role = authenticatedRole;
    appState.userRole = role;
    document.documentElement.setAttribute("data-role", role);
    if (document.body) {
      document.body.setAttribute("data-role", role);
    }
    if (elements.roleSelector && elements.roleSelector.value !== role) {
      elements.roleSelector.value = role;
    }

    const roleToggleText = document.getElementById("roleToggleText");
    if (roleToggleText) {
      roleToggleText.textContent = role === "admin" ? "Vista Administrador" : "Vista Técnico";
    }

    updateRoleIcon(role);

    // Si la pestaña activa actual está restringida al cambiar a Técnico, cambiar automáticamente a Tableros
    if (role === "tecnico") {
      const activeTabBtn = document.querySelector(".nav-tab.active");
      if (activeTabBtn && activeTabBtn.dataset.tab === "consola") {
        const tablerosBtn = document.querySelector(
          '.nav-tab[data-tab="tableros"]',
        );
        if (tablerosBtn) tablerosBtn.click();
      }
    }
  }

  function applyAuthenticatedRole() {
    setRole(window.luminariaAuth?.user?.rol || "tecnico");
  }

  function updateRoleIcon(role) {
    if (!elements.roleIcon) return;
    if (role === "tecnico") {
      elements.roleIcon.className = "fas fa-user-gear role-icon";
      elements.roleIcon.title = "Vista Técnico activa (monitoreo operativo)";
    } else {
      elements.roleIcon.className = "fas fa-user-shield role-icon";
      elements.roleIcon.title = "Vista Administrador activa (control total)";
    }
  }

  // ==========================================
  // NAVEGACIÓN POR PESTAÑAS (TABS)
  // ==========================================
  function setupTabNavigation() {
    const tabs = document.querySelectorAll(".nav-tab");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        tabs.forEach((t) => {
          t.classList.remove("active");
          t.setAttribute("aria-selected", "false");
        });
        tab.classList.add("active");
        tab.setAttribute("aria-selected", "true");

        const targetTab = tab.dataset.tab;
        document.querySelectorAll(".tab-pane").forEach((pane) => {
          pane.classList.remove("active");
        });

        const targetPaneId =
          "tab" + targetTab.charAt(0).toUpperCase() + targetTab.slice(1);
        const targetPane = document.getElementById(targetPaneId);
          if (targetPane) {
            targetPane.classList.add("active");
            if (targetPaneId === "tabMapa" && leafletMap) {
               setTimeout(() => leafletMap.invalidateSize(), 50);
            }
          }

        if (targetTab === "sensores") {
          setTimeout(() => {
            if (sensorLineChartInstance) sensorLineChartInstance.resize();
            if (sensorBarChartInstance) sensorBarChartInstance.resize();
          }, 50);
        }
      });
    });
  }

  // ==========================================
  // EVENT LISTENERS & DELEGACIÓN
  // ==========================================
  function setupEventListeners() {
    const telemetryBoardSelect = document.getElementById("telemetryBoardSelect");
    if (telemetryBoardSelect) {
      telemetryBoardSelect.addEventListener("change", async (event) => {
        appState.telemetry.selectedTableroId = event.target.value;
        await loadTelemetryHistory();
      });
    }
    document.querySelectorAll("[data-telemetry-range]").forEach((button) => {
      button.addEventListener("click", async () => {
        appState.telemetry.range = button.dataset.telemetryRange;
        document.querySelectorAll("[data-telemetry-range]").forEach((item) => item.classList.toggle("active", item === button));
        await loadTelemetryHistory();
      });
    });

    const createUserForm = document.getElementById("createUserForm");
    createUserForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const nameInput = document.getElementById("newUserName");
      const message = document.getElementById("createUserMessage");
      const submit = document.getElementById("createUserSubmit");
      const result = document.getElementById("credentialResult");
      if (!nameInput?.value.trim()) return;
      submit.disabled = true;
      if (message) { message.textContent = "Creando cuenta…"; message.className = "login-message"; }
      try {
        const response = await window.luminariaRequest("/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nombre: nameInput.value.trim() }),
        });
        const body = await response.json();
        if (!response.ok || !body?.data) throw new Error(body?.message || "No se pudo crear la cuenta.");
        document.getElementById("createdUsername").textContent = body.data.usuario;
        document.getElementById("createdPassword").textContent = body.data.password;
        result?.classList.add("visible");
        nameInput.value = "";
        if (message) { message.textContent = "Entregá estas credenciales por un canal privado."; message.className = "login-message success"; }
      } catch (error) {
        if (message) { message.textContent = error.message || "No se pudo crear la cuenta."; message.className = "login-message error"; }
      } finally { submit.disabled = false; }
    });

    // Filtros de Alertas
    elements.filterChips.forEach((chip) => {
      chip.addEventListener("click", () => {
        elements.filterChips.forEach((c) => c.classList.remove("active"));
        chip.classList.add("active");
        appState.activeFilter = chip.dataset.filter;
        renderAlerts();
      });
    });

    // Limpiar consola
    if (elements.btnClearConsole) {
      elements.btnClearConsole.addEventListener("click", () => {
        if (elements.mqttConsoleLog) {
          elements.mqttConsoleLog.innerHTML = `<div class="log-row"><span class="log-time">[${new Date().toLocaleTimeString("es-AR")}]</span> <span class="log-text">Consola limpiada.</span></div>`;
        }
      });
    }

    // Activar / Desactivar Sonido
    if (elements.btnToggleSound) {
      elements.btnToggleSound.addEventListener("click", () => {
        appState.soundEnabled = !appState.soundEnabled;
        const soundIcon = elements.btnToggleSound.querySelector("i");
        if (soundIcon) {
          soundIcon.className = appState.soundEnabled
            ? "fas fa-volume-up"
            : "fas fa-volume-mute";
        }
        if (elements.soundLabelMobile) {
          elements.soundLabelMobile.textContent = appState.soundEnabled
            ? "Sonido: Activado"
            : "Sonido: Silenciado";
        }
        elements.btnToggleSound.title = appState.soundEnabled
          ? "Sonido Activado"
          : "Sonido Silenciado";
        elements.btnToggleSound.setAttribute(
          "aria-label",
          appState.soundEnabled
            ? "Silenciar sonido de alarma"
            : "Activar sonido de alarma",
        );
      });
    }

    // Cambiar tema claro / oscuro
    if (elements.btnToggleTheme) {
      elements.btnToggleTheme.addEventListener("click", () => {
        const current =
          document.documentElement.getAttribute("data-theme") || "dark";
        const next = current === "dark" ? "light" : "dark";
        setTheme(next);
      });
    }

    // Menú Hamburguesa en Mobile
    function toggleHeaderMenu(forceState) {
      if (!elements.btnHeaderMenu || !elements.headerActions) return;
      const isOpen =
        typeof forceState === "boolean"
          ? forceState
          : !elements.headerActions.classList.contains("is-open");
      elements.headerActions.classList.toggle("is-open", isOpen);
      elements.btnHeaderMenu.classList.toggle("active", isOpen);
      elements.btnHeaderMenu.setAttribute(
        "aria-expanded",
        isOpen ? "true" : "false",
      );
      const icon = elements.btnHeaderMenu.querySelector("i");
      if (icon) {
        icon.className = isOpen ? "fas fa-xmark" : "fas fa-bars";
      }
    }

    function closeHeaderMenu() {
      toggleHeaderMenu(false);
    }

    if (elements.btnHeaderMenu) {
      elements.btnHeaderMenu.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleHeaderMenu();
      });
    }

    // Cerrar el menú desplegable al hacer clic afuera
    document.addEventListener("click", (e) => {
      if (
        elements.headerActions &&
        elements.headerActions.classList.contains("is-open")
      ) {
        if (
          !elements.headerActions.contains(e.target) &&
          e.target !== elements.btnHeaderMenu &&
          !elements.btnHeaderMenu.contains(e.target)
        ) {
          closeHeaderMenu();
        }
      }
    });

    // Cerrar menú con tecla Escape
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeHeaderMenu();
      }
    });

    // Al hacer clic en una opción del menú en mobile, cerrarlo suavemente
    if (elements.headerActions) {
      elements.headerActions.querySelectorAll(".btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          if (window.innerWidth <= 768) {
            setTimeout(closeHeaderMenu, 150);
          }
        });
      });
    }

    // Modales
    if (elements.btnOpenMqttModal)
      elements.btnOpenMqttModal.addEventListener("click", () =>
        openModal(elements.mqttModal),
      );
    // Form MQTT Config
    if (elements.formMqttConfig) {
      const cfg = window.luminariaMQTT.config;
      document.getElementById("mqttHost").value = cfg.host;
      document.getElementById("mqttPort").value = cfg.port;
      document.getElementById("mqttPath").value = cfg.path;
      document.getElementById("mqttClientId").value = cfg.clientId;
      document.getElementById("mqttUsername").value = cfg.username || "";
      document.getElementById("mqttPassword").value = "";
      document.getElementById("mqttTopic").value = cfg.topics.join(", ");

      elements.formMqttConfig.addEventListener("submit", (e) => {
        e.preventDefault();
        const newCfg = {
          host: document.getElementById("mqttHost").value.trim() || "localhost",
          port:
            parseInt(document.getElementById("mqttPort").value.trim(), 10) ||
            9001,
          path: document.getElementById("mqttPath").value.trim() || "/mqtt",
          clientId:
            document.getElementById("mqttClientId").value.trim() ||
            "luminaria_web",
          username: document.getElementById("mqttUsername").value.trim(),
          password: document.getElementById("mqttPassword").value,
          topics: document
            .getElementById("mqttTopic")
            .value.split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        };
        window.luminariaMQTT.connect(newCfg);
        document.getElementById("mqttPassword").value = "";
        closeModal(elements.mqttModal);
      });
    }

  }

  // ==========================================
  // CALLBACKS Y PROCESAMIENTO MQTT
  // ==========================================
  function setupMqttCallbacks() {
    window.luminariaMQTT.onStatusChangeCallback = ({ status, label }) => {
      elements.mqttStatusDot.className = "status-dot " + status;
      elements.mqttStatusText.textContent = label;
    };

    window.luminariaMQTT.onLogCallback = ({
      timestamp,
      message,
      type,
      topic,
    }) => {
      if (!elements.mqttConsoleLog) return;
      const logRow = document.createElement("div");
      const safeType = ["info", "success", "warning", "error", "incoming", "outgoing"].includes(type) ? type : "info";
      logRow.className = `log-row log-type-${safeType}`;

      const topicTag = topic ? `<span class="log-topic">[${escapeHtml(topic)}]</span>` : "";
      logRow.innerHTML = `<span class="log-time">[${escapeHtml(timestamp)}]</span> ${topicTag} <span class="log-text">${escapeHtml(message)}</span>`;

      elements.mqttConsoleLog.prepend(logRow);
      if (elements.mqttConsoleLog.children.length > 60) {
        elements.mqttConsoleLog.removeChild(elements.mqttConsoleLog.lastChild);
      }
    };

    window.luminariaMQTT.onMessageCallback = (topic, payloadJson) => {
      processIncomingEvent(payloadJson);
    };
  }

  function esMismaAlertaActiva(a, b) {
    if (!a || !b || a.resuelta || b.resuelta) return false;
    if (a.id_tablero !== b.id_tablero || a.tipo_evento !== b.tipo_evento) return false;
    if (!["FOCO_QUEMADO", "DESCONEXION_ABRUPTA_FOCO"].includes(b.tipo_evento)) return true;

    const focoA = a.datos?.id_foco ?? a.id_foco_afectado ?? "";
    const focoB = b.datos?.id_foco ?? b.id_foco_afectado ?? "";
    return String(focoA) === String(focoB);
  }

  function processIncomingEvent(event) {
    if (!event) return;

    if (isElectricalTelemetryEvent(event)) {
      processElectricalTelemetry(event);
    }

    // Eventos eléctricos reales publicados por el backend tras su persistencia.

    if (!event.tipo_evento) return;

    const tableroId = event.id_tablero || appState.selectedTableroId;
    const tablero = appState.tableros[tableroId];
    if (!tablero) {
      console.warn(`[Luminaria] Evento recibido para tablero inexistente: ${tableroId}`);
      return;
    }
    if (event.ubicacion) tablero.ubicacion = event.ubicacion;
    tablero.ultimaLectura = event.timestamp || new Date().toISOString();

    let alertTitle = "";
    let soundType = "info";

    if (event.tipo_evento === "BAJA_TENSION") {
      const tension = toFiniteNumber(event.datos?.tension_medida_v, NaN);
      if (!Number.isFinite(tension)) return;
      tablero.tension_v = tension;
      tablero.fase = event.datos?.fase || "L1";
      tablero.fallaActiva = `Baja tensión: ${tension.toFixed(1)} V`;
      tablero.estado = "critico";
      alertTitle = `Baja Tensión Detectada: ${tension}V (Umbral: ${event.datos?.umbral_minimo_v || 190}V)`;
      soundType = "critical";
    } else if (event.tipo_evento === "DESCONEXION_ABRUPTA_FOCO") {
      const focoId = event.datos?.id_foco;
      if (!focoId) return;
      if (!tablero.focos[focoId]) {
        tablero.focos[focoId] = {
          id: focoId,
          corriente_ma: null,
          estado: "robado",
        };
      }
      const corrienteActual = toFiniteNumber(event.datos?.corriente_actual_ma, NaN);
      if (Number.isFinite(corrienteActual)) tablero.focos[focoId].corriente_ma = corrienteActual;
      tablero.focos[focoId].estado = "robado";
      tablero.fallaActiva = "Desconexión detectada en el tablero";
      tablero.estado = "critico";
      alertTitle = `Desconexión Abrupta / Posible Robo en ${tablero.nombre || tableroId}`;
      soundType = "critical";
    } else if (event.tipo_evento === "FOCO_QUEMADO") {
      const focoId = event.datos?.id_foco;
      if (!focoId) return;
      if (!tablero.focos[focoId]) {
        tablero.focos[focoId] = {
          id: focoId,
          corriente_ma: null,
          estado: "quemado",
        };
      }
      const corrienteMedida = toFiniteNumber(event.datos?.corriente_medida_ma, NaN);
      if (Number.isFinite(corrienteMedida)) tablero.focos[focoId].corriente_ma = corrienteMedida;
      tablero.focos[focoId].estado = "quemado";
      tablero.fallaActiva = `Foco quemado detectado: ${focoId}`;
      tablero.estado = "advertencia";
      alertTitle = `Anomalía de Consumo / Foco Quemado en ${tablero.nombre || tableroId}`;
      soundType = "warning";
    } else if (event.tipo_evento === "TELEMETRIA_NORMAL") {
      const tensionMedida = toFiniteNumber(event.datos?.tension_medida_v, NaN);
      if (!Number.isFinite(tensionMedida)) return;
      tablero.tension_v = tensionMedida;
      const corrienteMedida = toFiniteNumber(
        event.datos?.corriente_actual_ma ?? event.datos?.corriente_medida_ma,
        NaN,
      );
      if (Number.isFinite(corrienteMedida)) tablero.corriente_ma = corrienteMedida;
      const focosRestaurados = Array.isArray(event.datos?.focos_restaurados)
        ? event.datos.focos_restaurados.map(String)
        : [];
      focosRestaurados.forEach((fId) => {
        if (tablero.focos[fId]) tablero.focos[fId].estado = "ok";
      });
      tablero.fallaActiva = "";
      tablero.estado = "ok";
      // Auto-resolver alertas activas previas de este tablero al restablecerse la telemetría normal
      appState.alerts.forEach((a) => {
        if (
          !a.resuelta &&
          a.id_tablero === tableroId &&
          (a.tipo_evento === "BAJA_TENSION" ||
            ((a.tipo_evento === "FOCO_QUEMADO" ||
              a.tipo_evento === "DESCONEXION_ABRUPTA_FOCO") &&
             focosRestaurados.includes(String(a.datos?.id_foco ?? a.id_foco_afectado ?? ""))))
        ) {
          a.resuelta = true;
        }
      });
      alertTitle = `Telemetría Normal Restablecida en ${tablero.nombre || tableroId}`;
      soundType = "info";
    }

    // Registrar en la lista de avisos solo si es una anomalía
    if (event.tipo_evento !== "TELEMETRIA_NORMAL") {
      const alertRecord = {
        id: "ALR-" + Math.random().toString(36).substr(2, 6).toUpperCase(),
        tipo_evento: event.tipo_evento,
        severidad: event.severidad || "INFO",
        titulo: alertTitle,
        timestamp: event.timestamp || new Date().toISOString(),
        ubicacion: event.ubicacion || tablero.ubicacion,
        datos: event.datos || {},
        id_tablero: tableroId,
        resuelta: false,
      };

      const yaActiva = appState.alerts.some((a) => esMismaAlertaActiva(a, alertRecord));
      if (!yaActiva) {
        appState.alerts.unshift(alertRecord);

        // El backend persistió el evento antes de publicarlo por MQTT.
        fetchAlertasFromAPI().then((alertas) => {
          appState.alerts = alertas.map(normalizarAlertaAPI);
          refreshAllViews();
        }).catch(() => {});
      }

      if (!yaActiva && appState.soundEnabled) {
        playAlertAudioSound(soundType);
      }
    }

    refreshAllViews();
  }

  // ==========================================
  // RENDERIZADO Y ACTUALIZACIÓN VISTA TABLEROS
  // ==========================================
  function updateTableroUI() {
    renderTablerosGrid();
  }

  function refreshAllViews() {
    updateTableroUI();
    renderAlerts();
    updateKPIs();
    renderMapPins();
  }

  function renderTablerosGrid() {
    const container = document.getElementById("tablerosGridContainer");
    if (!container) return;
    container.innerHTML = "";

    Object.values(appState.tableros).forEach((tablero) => {
      // Detección de enlace activo o transmisión inactiva
      let isStale = false;
      let timeAgoText = "Sin enlace";
      if (tablero.ultimaLectura) {
        const diffMs = Date.now() - new Date(tablero.ultimaLectura).getTime();
        const diffSec = Math.floor(diffMs / 1000);
        if (diffSec < 60) {
          timeAgoText = `Hace ${Math.max(1, diffSec)}s`;
        } else if (diffSec < 3600) {
          timeAgoText = `Hace ${Math.floor(diffSec / 60)} min`;
        } else {
          timeAgoText = `Hace ${Math.floor(diffSec / 3600)} h`;
        }
        if (diffSec > 60) {
          isStale = true;
        }
      } else {
        isStale = true;
      }

      let statusClass = "ok";
      let statusLabel = isStale ? `Enlace Inactivo (${timeAgoText})` : "En servicio (En vivo)";
      let statusBadgeClass = isStale ? "badge-neutral" : "badge-ok";
      let statusIcon = isStale ? "fa-satellite-dish" : "fa-check-circle";

      const hasVoltageReading = Number.isFinite(tablero.tension_v);
      const voltageCritical = hasVoltageReading && tablero.tension_v < 190.0;
      const voltageWarning = hasVoltageReading && tablero.tension_v >= 190.0 && tablero.tension_v < 210.0;
      const focos = Object.values(tablero.focos || {});
      const hayDesconexion = focos.some((foco) => foco.estado === "robado");
      const hayFallaLuminaria = focos.some((foco) => foco.estado === "quemado");

      if (voltageCritical || hayDesconexion) {
        statusClass = "critical";
        statusBadgeClass = "badge-critical";
        statusIcon = "fa-triangle-exclamation";
        statusLabel = [
          voltageCritical ? "Baja tensión" : "",
          hayDesconexion ? "Desconexión de luminaria" : "",
          isStale ? "(Transmisión detenida)" : "",
        ].filter(Boolean).join(" · ");
      } else if (voltageWarning || hayFallaLuminaria) {
        statusClass = "warning";
        statusBadgeClass = "badge-warning";
        statusIcon = "fa-exclamation-circle";
        statusLabel = [
          voltageWarning ? "Tensión baja" : "",
          hayFallaLuminaria ? "Foco quemado" : "",
          isStale ? "(Transmisión detenida)" : "",
        ].filter(Boolean).join(" · ");
      } else if (isStale) {
        statusClass = "neutral";
        statusBadgeClass = "badge-neutral";
        statusIcon = "fa-satellite-dish";
        statusLabel = `Enlace Inactivo (${timeAgoText})`;
      }

      const fallasActivas = [];
      if (hasVoltageReading && tablero.tension_v < 210) {
        fallasActivas.push(`${tablero.tension_v < 190 ? "Baja tensión" : "Tensión fuera de rango"}: ${fmtVoltage(tablero.tension_v)} V`);
      }
      if (hayDesconexion) fallasActivas.push("Desconexión detectada en el tablero");
      if (hayFallaLuminaria) {
        const focosQuemados = focos
          .filter((foco) => foco.estado === "quemado")
          .map((foco) => foco.id)
          .filter(Boolean);
        fallasActivas.push(
          focosQuemados.length
            ? `Foco quemado: ${focosQuemados.join(", ")}`
            : "Foco quemado detectado",
        );
      }

      const isSelected = tablero.id === appState.selectedTableroId;
      const isExpanded = tablero.id === appState.expandedTableroId;
      const pctVoltage = Math.min(
        Math.max(((tablero.tension_v || 0) / 250.0) * 100, 0),
        100,
      );

      const card = document.createElement("article");
      card.className = `tablero-card ${statusClass} ${isSelected ? "selected" : ""}`;

      card.innerHTML = `
        <div class="tablero-card-header">
          <div class="tablero-title-group">
            <span class="tablero-tag">${escapeHtml(tablero.id)}</span>
            <h4 class="tablero-title">${escapeHtml(tablero.nombre || tablero.id)}</h4>
          </div>
          <span class="tablero-status-badge ${statusBadgeClass}">
            <i class="fas ${statusIcon}"></i> ${statusLabel}
          </span>
        </div>

        <div class="tablero-location">
          <i class="fas fa-location-dot"></i> ${escapeHtml(tablero.ubicacion)}
        </div>

        ${fallasActivas.length ? `<div class="tablero-fault ${statusClass}" role="status"><i class="fas fa-triangle-exclamation"></i><span>Fallas detectadas: ${fallasActivas.map((falla) => escapeHtml(falla)).join(" · ")}</span></div>` : ""}

        <div class="tablero-meter-section">
          <div class="meter-head">
            <span class="meter-lbl">Tensión RMS</span>
            <span class="meter-val ${statusClass}">${fmtVoltage(tablero.tension_v)} <span class="meter-unit">V</span></span>
          </div>
          <div class="meter-track">
            <div class="meter-danger-line" title="Límite mínimo 190V (IRAM 2001)"></div>
            <div class="meter-fill ${statusClass}" style="width: ${pctVoltage}%;"></div>
          </div>
          <div class="meter-ticks">
            <span>0V</span>
            <span class="danger-tick">190V Mín</span>
            <span>220V Nominal</span>
          </div>
        </div>

        <div class="tablero-info-grid">
          <div class="info-cell">
            <span class="info-cell-lbl">Fase Eléctrica</span>
            <span class="info-cell-val">${escapeHtml(tablero.fase || "L1")}</span>
          </div>
          <div class="info-cell">
            <span class="info-cell-lbl">Telemetría / Enlace</span>
            <span class="info-cell-val">${isStale ? `<i class="fas fa-clock"></i> ${timeAgoText} (Inactivo)` : `<i class="fas fa-circle text-success pulse"></i> ${timeAgoText} (En vivo)`}</span>
          </div>
        </div>

        <div class="tablero-card-actions">
          <button class="btn btn-secondary btn-sm btn-select-tablero">
            <i class="fas ${isSelected ? "fa-circle-dot" : "fa-circle"}"></i> ${isSelected ? "Tablero Seleccionado" : "Seleccionar Tablero"}
            ${isSelected ? `<i class="fas ${isExpanded ? "fa-chevron-up" : "fa-chevron-down"} btn-select-chevron"></i>` : ""}
          </button>
        </div>

        ${
          isSelected
            ? `
        <div class="tablero-expand ${isExpanded ? "open" : ""}">
          <div class="tablero-expand-inner">
            <div class="expand-stats-grid">
              <div class="expand-stat">
                <span class="expand-stat-lbl">Tensión Nominal</span>
                <span class="expand-stat-val">${fmtVoltage(tablero.tension_nominal_v || 220.0)} V</span>
              </div>
              <div class="expand-stat">
                <span class="expand-stat-lbl">Corriente Reportada</span>
                <span class="expand-stat-val">${Number.isFinite(tablero.corriente_ma) ? `${(tablero.corriente_ma / 1000).toFixed(2)} A` : "--"}</span>
              </div>
              <div class="expand-stat">
                <span class="expand-stat-lbl">Último Reporte</span>
                <span class="expand-stat-val">${tablero.ultimaLectura ? new Date(tablero.ultimaLectura).toLocaleTimeString("es-AR") : "Nunca"}</span>
              </div>
              <div class="expand-stat">
                <span class="expand-stat-lbl">Ubicación Mapa</span>
                <span class="expand-stat-val">X ${tablero.posX}% · Y ${tablero.posY}%</span>
              </div>
            </div>

          </div>
        </div>`
            : ""
        }
      `;

      card
        .querySelector(".btn-select-tablero")
        .addEventListener("click", () => {
          const isSameTablero = tablero.id === appState.selectedTableroId;
          const shouldClose =
            isSameTablero && appState.expandedTableroId === tablero.id;

          appState.selectedTableroId = tablero.id;
          appState.expandedTableroId = shouldClose ? null : tablero.id;

          updateTableroUI();
          renderMapPins();
        });

      container.appendChild(card);
    });
  }

  function renderAlerts() {
    if (!elements.alertsContainer) return;
    elements.alertsContainer.innerHTML = "";

    const filtered = appState.alerts.filter((a) => {
      if (appState.activeFilter === "ALL") return true;
      return a.severidad === appState.activeFilter;
    });

    if (elements.alertsCountBadge) {
      elements.alertsCountBadge.textContent = `${filtered.length} Avisos`;
    }

    if (filtered.length === 0) {
      elements.alertsContainer.innerHTML = `
        <div class="empty-alerts">
          <i class="fas fa-check-circle"></i>
          <p>No hay alertas registradas para este filtro.</p>
        </div>
      `;
      return;
    }

    filtered.forEach((alert) => {
      const card = document.createElement("div");
      card.className = `alert-card ${alert.severidad} ${alert.resuelta ? "resuelta" : ""}`;

      const timeFormatted = new Date(alert.timestamp).toLocaleTimeString(
        "es-AR",
        { hour: "2-digit", minute: "2-digit", second: "2-digit" },
      );

      let detailsHtml = "";
      if (alert.datos) {
        detailsHtml = Object.entries(alert.datos)
          .map(
            ([k, v]) => `
          <div class="alert-detail-item">
            <span class="alert-detail-key">${escapeHtml(k)}:</span>
            <span class="alert-detail-val">${escapeHtml(safeText(v))}</span>
          </div>
        `,
          )
          .join("");
      }

      card.innerHTML = `
        <div class="alert-card-top">
          <span class="alert-badge ${alert.severidad}">${alert.severidad}</span>
          <span class="alert-time"><i class="far fa-clock"></i> ${timeFormatted}</span>
        </div>
        <div class="alert-title">${escapeHtml(alert.titulo)}</div>
        <div class="alert-location"><i class="fas fa-map-marker-alt"></i> ${escapeHtml(alert.ubicacion)}</div>
        ${detailsHtml ? `<div class="alert-details-grid">${detailsHtml}</div>` : ""}
        <div class="alert-actions">
          <button class="btn btn-secondary btn-sm btn-resolve">
            <i class="fas ${alert.resuelta ? "fa-check-double" : "fa-check"}"></i> ${alert.resuelta ? "Resuelta" : "Marcar Resuelta"}
          </button>
        </div>
      `;

      const btnResolve = card.querySelector(".btn-resolve");
      btnResolve.addEventListener("click", async () => {
        const tecnicoResponsable =
          appState.userRole === "tecnico" ? "Técnico de Guardia" : "Administrador Municipal";

        if (alert.resuelta) return;
        btnResolve.disabled = true;
        try {
          await resolveAlertaAPI(alert.id);
          alert.resuelta = true;
          refreshAllViews();
        } catch (error) {
          console.warn("[Luminaria] No se pudo resolver la alerta en la API.", error);
          btnResolve.disabled = false;
        }
      });

      elements.alertsContainer.appendChild(card);
    });
  }



  let leafletMap = null;
  let leafletMarkers = {};

  function initLeafletMap() {
    const neuquenCoords = [-38.9516, -68.0591];

    if (!elements.leafletMapContainer || typeof L === 'undefined') return;

    // Inicializar el mapa sin la marca de agua (attributionControl: false)
    leafletMap = L.map(elements.leafletMapContainer, { attributionControl: false }).setView(neuquenCoords, 13);

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19
    }).addTo(leafletMap);

    renderMapPins();
  }

  setTimeout(() => {
    initLeafletMap();
  }, 100);

  function renderMapPins() {
    if (!leafletMap) return;

    const baseLat = -38.98;
    const baseLng = -68.08;

    Object.values(appState.tableros).forEach((tablero) => {
      let worstSeverity = "ok";

      if (tablero.tension_v < 190.0) {
        worstSeverity = "critical";
      } else if (tablero.tension_v < 210.0 && worstSeverity !== "critical") {
        worstSeverity = "warning";
      }

      Object.values(tablero.focos || {}).forEach((foco) => {
        if (foco.estado === "robado") {
          worstSeverity = "critical";
        } else if (foco.estado === "quemado" && worstSeverity !== "critical") {
          worstSeverity = "warning";
        }
      });

      const tableroAlerts = appState.alerts.filter(
        (a) => a.id_tablero === tablero.id && !a.resuelta,
      );
      if (tableroAlerts.some((a) => a.severidad === "CRITICA")) {
        worstSeverity = "critical";
      } else if (
        tableroAlerts.some((a) => a.severidad === "ADVERTENCIA") &&
        worstSeverity !== "critical"
      ) {
        worstSeverity = "warning";
      }

      let pinColor = "#10b981";
      if (worstSeverity === "critical") {
        pinColor = "#ef4444";
      } else if (worstSeverity === "warning") {
        pinColor = "#f59e0b";
      }

      const isSelected = tablero.id === appState.selectedTableroId;

      const lat = baseLat + (tablero.posY / 100) * 0.05;
      const lng = baseLng + (tablero.posX / 100) * 0.08;

      if (leafletMarkers[tablero.id]) {
        const marker = leafletMarkers[tablero.id];
        marker.setLatLng([lat, lng]);
        marker.setStyle({
          color: isSelected ? "#000000" : "#ffffff",
          fillColor: pinColor,
          weight: isSelected ? 3 : 2
        });
      } else {
        const marker = L.circleMarker([lat, lng], {
          radius: 10,
          fillColor: pinColor,
          color: isSelected ? "#000000" : "#ffffff",
          weight: isSelected ? 3 : 2,
          opacity: 1,
          fillOpacity: 1
        }).addTo(leafletMap);

        marker.bindTooltip(tablero.nombre || tablero.id, {
          direction: 'top',
          offset: [0, -10]
        });

        marker.on("click", () => {
          appState.selectedTableroId = tablero.id;
          appState.expandedTableroId = tablero.id;
          updateTableroUI();
          renderMapPins();

          const tablerosNavTab = document.querySelector(
            '.nav-tab[data-tab="tableros"]',
          );
          if (tablerosNavTab) tablerosNavTab.click();
        });

        leafletMarkers[tablero.id] = marker;
      }
    });
  }

  function updateKPIs() {
    const activeTableros = Object.values(appState.tableros);
    const criticasCount = appState.alerts.filter(
      (a) => a.severidad === "CRITICA" && !a.resuelta,
    ).length;
    if (elements.kpiAlertasCriticas) {
      elements.kpiAlertasCriticas.textContent = criticasCount;
    }

    const advertenciasCount = appState.alerts.filter(
      (a) => a.severidad === "ADVERTENCIA" && !a.resuelta,
    ).length;
    if (elements.kpiAdvertencias) {
      elements.kpiAdvertencias.textContent = advertenciasCount;
    }

    if (elements.kpiTotalTableros) {
      elements.kpiTotalTableros.textContent = activeTableros.length;
    }

    const banner = document.getElementById("generalStatusBanner");
    const bannerIcon = document.getElementById("generalStatusIcon");
    const bannerTitle = document.getElementById("generalStatusTitle");
    const bannerDesc = document.getElementById("generalStatusDesc");

    const anyActiveTransmission = activeTableros.some((t) => {
      if (!t.ultimaLectura) return false;
      return (Date.now() - new Date(t.ultimaLectura).getTime()) < 65000;
    });

    if (banner && bannerTitle && bannerDesc) {
      if (criticasCount > 0) {
        banner.className = "status-banner red";
        if (bannerIcon) bannerIcon.className = "fas fa-triangle-exclamation";
        bannerTitle.textContent =
          "ALERTA URGENTE: REVISAR TABLERO INMEDIATAMENTE";
        bannerDesc.textContent = `Se detectaron ${criticasCount} problema(s) crítico(s) de caída de tensión o anomalía eléctrica en la red.`;
      } else if (advertenciasCount > 0) {
        banner.className = "status-banner yellow";
        if (bannerIcon) bannerIcon.className = "fas fa-triangle-exclamation";
        bannerTitle.textContent = "ATENCIÓN: REVISIÓN DE RED REQUERIDA";
        bannerDesc.textContent = `Se registraron ${advertenciasCount} anomalías de consumo o fallas en luminarias.`;
      } else if (!anyActiveTransmission) {
        banner.className = "status-banner neutral";
        if (bannerIcon) bannerIcon.className = "fas fa-satellite-dish";
        bannerTitle.textContent = "RED EN ESPERA / SIN TELEMETRÍA ACTIVA";
        bannerDesc.textContent =
          "No se registran datos recientes en los últimos 60 segundos. Transmisión inactiva o nodos apagados.";
      } else {
        banner.className = "status-banner green";
        if (bannerIcon) bannerIcon.className = "fas fa-check-circle";
        bannerTitle.textContent = "FUNCIONAMIENTO NORMAL";
        bannerDesc.textContent =
          "Todos los tableros eléctricos de la ciudad operan sin anomalías en tiempo real.";
      }
    }
  }

  let audioCtx = null;

  function playAlertAudioSound(type) {
    try {
      if (!audioCtx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        audioCtx = new AudioCtx();
      }
      const ctx = audioCtx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === "critical") {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      } else if (type === "warning") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      }
    } catch (e) {}
  }

  function openModal(modal) {
    if (modal) modal.classList.add("active");
  }

  function closeModal(modal) {
    if (modal) modal.classList.remove("active");
  }

  function escapeHtml(str) {
    if (typeof str !== "string") return str;
    return str.replace(/[&<>"']/g, function (m) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      }[m];
    });
  }

  function fmtVoltage(v, decimals = 1) {
    if (v === null || v === undefined || v === "") return "--";
    const n = Number(v);
    if (!isFinite(n)) return "--";
    return n.toFixed(decimals);
  }

  function safeText(v) {
    if (v === null || v === undefined) return "";
    if (typeof v === "string") return v;
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
  }

  // ==========================================
  // TELEMETRÍA DE SENSORES Y GESTIÓN DE GRÁFICOS
  // ==========================================
  function getChartThemeColors() {
    const isLight =
      document.documentElement.getAttribute("data-theme") === "light" ||
      document.documentElement.classList.contains("light-mode");
    return {
      textColor: isLight ? "#3a5778" : "#bcd2e8",
      textDim: isLight ? "#607e9f" : "#7da5c9",
      gridColor: isLight
        ? "rgba(208, 225, 242, 0.7)"
        : "rgba(26, 60, 102, 0.5)",
      tooltipBg: isLight ? "#ffffff" : "#0d2544",
      tooltipBorder: isLight ? "#d0e1f2" : "#1a3c66",
      tooltipText: isLight ? "#0d2544" : "#f8fafc",
    };
  }

  function updateTelemetryChartsTheme() {
    const theme = getChartThemeColors();

    if (sensorLineChartInstance) {
      sensorLineChartInstance.options.plugins.tooltip.backgroundColor =
        theme.tooltipBg;
      sensorLineChartInstance.options.plugins.tooltip.titleColor =
        theme.tooltipText;
      sensorLineChartInstance.options.plugins.tooltip.bodyColor =
        theme.tooltipText;
      sensorLineChartInstance.options.plugins.tooltip.borderColor =
        theme.tooltipBorder;

      if (sensorLineChartInstance.options.scales.x) {
        sensorLineChartInstance.options.scales.x.grid.color = theme.gridColor;
        sensorLineChartInstance.options.scales.x.ticks.color = theme.textDim;
      }
      if (sensorLineChartInstance.options.scales.y) {
        sensorLineChartInstance.options.scales.y.grid.color = theme.gridColor;
        sensorLineChartInstance.options.scales.y.ticks.color = theme.textDim;
        sensorLineChartInstance.options.scales.y.title.color = theme.textColor;
      }
      if (sensorLineChartInstance.options.scales.yTemp) {
        sensorLineChartInstance.options.scales.yTemp.grid.color =
          theme.gridColor;
        sensorLineChartInstance.options.scales.yTemp.ticks.color =
          theme.textDim;
      }
      if (sensorLineChartInstance.options.scales.yAmp) {
        sensorLineChartInstance.options.scales.yAmp.ticks.color =
          theme.textDim;
      }
      sensorLineChartInstance.update();
    }

    if (sensorBarChartInstance) {
      sensorBarChartInstance.options.plugins.legend.labels.color =
        theme.textColor;
      sensorBarChartInstance.options.plugins.tooltip.backgroundColor =
        theme.tooltipBg;
      sensorBarChartInstance.options.plugins.tooltip.titleColor =
        theme.tooltipText;
      sensorBarChartInstance.options.plugins.tooltip.bodyColor =
        theme.tooltipText;
      sensorBarChartInstance.options.plugins.tooltip.borderColor =
        theme.tooltipBorder;

      if (sensorBarChartInstance.options.scales.x) {
        sensorBarChartInstance.options.scales.x.grid.color = theme.gridColor;
        sensorBarChartInstance.options.scales.x.ticks.color = theme.textColor;
      }
      if (sensorBarChartInstance.options.scales.y) {
        sensorBarChartInstance.options.scales.y.grid.color = theme.gridColor;
        sensorBarChartInstance.options.scales.y.ticks.color = theme.textDim;
        sensorBarChartInstance.options.scales.y.title.color = theme.textColor;
      }
      sensorBarChartInstance.update();
    }
  }

  // ==========================================
  // TELEMETRÍA ELÉCTRICA OPERATIVA
  // ==========================================
  function isElectricalTelemetryEvent(event) {
    return Boolean(event && event.datos && (
      event.datos.tension_medida_v !== undefined ||
      event.datos.corriente_medida_ma !== undefined ||
      event.datos.rssi_lora !== undefined
    ));
  }

  function formatTelemetryTime(timestamp) {
    const date = new Date(timestamp);
    return Number.isNaN(date.getTime()) ? "--:--" : date.toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  function normaliseElectricalReading(event) {
    const data = event.datos || event;
    const tension = Number(data.tension_medida_v ?? data.valor_tension);
    const currentRaw = Number(data.corriente_medida_ma ?? data.valor_corriente);
    return {
      timestamp: event.timestamp || data.timestamp || new Date().toISOString(),
      tension: Number.isFinite(tension) ? tension : null,
      corriente: Number.isFinite(currentRaw) ? currentRaw / 1000 : null,
      fase: data.fase || "--",
      rssi: Number.isFinite(Number(data.rssi_lora)) ? Number(data.rssi_lora) : null,
      conexion: data.estado_conexion || "ONLINE",
    };
  }

  function processElectricalTelemetry(event) {
    const tableroId = event.id_tablero || appState.telemetry.selectedTableroId;
    const reading = normaliseElectricalReading(event);
    if (!appState.telemetry.readings[tableroId]) appState.telemetry.readings[tableroId] = [];
    const readings = appState.telemetry.readings[tableroId];
    readings.push(reading);
    if (readings.length > appState.telemetry.maxHistoryPoints) readings.splice(0, readings.length - appState.telemetry.maxHistoryPoints);

    if (appState.tableros[tableroId] && reading.tension !== null) {
      appState.tableros[tableroId].tension_v = reading.tension;
      appState.tableros[tableroId].fase = reading.fase;
      appState.tableros[tableroId].ultimaLectura = reading.timestamp;
      if (reading.corriente !== null) {
        appState.tableros[tableroId].corriente_ma = reading.corriente * 1000;
      }
    }
    if (tableroId === appState.telemetry.selectedTableroId) {
      updateTelemetryUI();
      if (reading.tension !== null && reading.tension < 190 && appState.soundEnabled) playAlertAudioSound("critical");
    }
  }

  function telemetryStartDate() {
    const hours = { "1h": 1, "24h": 24, "7d": 168 }[appState.telemetry.range] || 1;
    return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  }

  async function loadTelemetryHistory() {
    const tableroId = appState.telemetry.selectedTableroId;
    if (!tableroId) {
      updateTelemetryUI();
      return;
    }
    try {
      const params = new URLSearchParams({ id_tablero: tableroId, inicio: telemetryStartDate(), limit: "720" });
      const data = await requestAPI(`/telemetria/historico?${params.toString()}`);
      if (Array.isArray(data)) {
        appState.telemetry.readings[tableroId] = data.reverse().map((row) => normaliseElectricalReading({ ...row, timestamp: row.timestamp, datos: row })).filter((reading) => reading.tension !== null || reading.corriente !== null);
      }
    } catch (error) {
      console.warn("No se pudo cargar el historial de telemetría:", error.message);
    }
    updateTelemetryUI();
  }

  function getSelectedTelemetryReadings() {
    const start = new Date(telemetryStartDate()).getTime();
    return (appState.telemetry.readings[appState.telemetry.selectedTableroId] || []).filter((reading) => new Date(reading.timestamp).getTime() >= start);
  }

  function voltageStatus(voltage) {
    if (!Number.isFinite(voltage)) return { label: "Sin lectura", className: "badge-neutral" };
    if (voltage < 198) return { label: "Baja tensión", className: "badge-critical" };
    if (voltage > 242) return { label: "Sobretensión", className: "badge-warning" };
    return { label: "Normal", className: "badge-ok" };
  }

  function setTelemetryText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }

  function updateTelemetryUI() {
    const readings = getSelectedTelemetryReadings();
    const latest = readings[readings.length - 1];
    const voltages = readings.map((reading) => reading.tension).filter(Number.isFinite);
    const voltage = latest?.tension;
    const status = voltageStatus(voltage);
    setTelemetryText("telemetryVoltageValue", Number.isFinite(voltage) ? voltage.toFixed(1) : "--");
    setTelemetryText("telemetryCurrentValue", Number.isFinite(latest?.corriente) ? latest.corriente.toFixed(2) : "--");
    setTelemetryText("telemetryLastUpdate", latest ? formatTelemetryTime(latest.timestamp) : "--:--");
    setTelemetryText("telemetryAverageValue", voltages.length ? `${(voltages.reduce((sum, value) => sum + value, 0) / voltages.length).toFixed(1)} V` : "--");
    setTelemetryText("telemetryMinimumValue", voltages.length ? `${Math.min(...voltages).toFixed(1)} V` : "--");
    setTelemetryText("telemetryMaximumValue", voltages.length ? `${Math.max(...voltages).toFixed(1)} V` : "--");
    const phaseNames = { L1: "L1 / R", L2: "L2 / S", L3: "L3 / T" };
    setTelemetryText("telemetryPhaseValue", phaseNames[latest?.fase] || latest?.fase || "--");
    setTelemetryText("telemetryRssiValue", Number.isFinite(latest?.rssi) ? `${latest.rssi} dBm` : "-- dBm");
    const isLatestStale = !latest || (Date.now() - new Date(latest.timestamp).getTime()) > 60000;
    const connectionText = isLatestStale
      ? (latest ? `Inactivo (${formatTelemetryTime(latest.timestamp)})` : "Sin enlace")
      : (latest?.conexion === "ONLINE" ? "En servicio (En vivo)" : latest?.conexion || "En servicio");

    setTelemetryText("telemetryConnectionState", connectionText);
    const badge = document.getElementById("telemetryVoltageBadge");
    if (badge) { badge.className = `sensor-range-badge ${status.className}`; badge.textContent = status.label; }
    const rssiFill = document.getElementById("telemetrySignalFill");
    if (rssiFill) {
      const quality = Number.isFinite(latest?.rssi) ? Math.max(0, Math.min(100, ((latest.rssi + 120) / 50) * 100)) : 0;
      rssiFill.style.width = `${quality}%`;
      rssiFill.style.backgroundColor = quality >= 60 ? "var(--color-ok)" : quality >= 25 ? "var(--color-warning)" : "var(--color-critical)";
    }
    const statusText = document.getElementById("sensorStatusText");
    if (statusText) statusText.textContent = isLatestStale ? "Transmisión inactiva / Sin enlace" : (latest?.conexion === "ONLINE" ? "Telemetría en línea (En vivo)" : "Sin enlace");
    updateTelemetryCharts(readings);
  }

  function initTelemetryCharts() {
    if (typeof Chart === "undefined") return;
    const theme = getChartThemeColors();
    const buildLineOptions = (title, min, max) => ({ responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false }, plugins: { legend: { display: false }, tooltip: { backgroundColor: theme.tooltipBg, titleColor: theme.tooltipText, bodyColor: theme.tooltipText, borderColor: theme.tooltipBorder, borderWidth: 1, callbacks: { title: (items) => {
      const timestamp = items[0]?.chart.$telemetryTimestamps?.[items[0].dataIndex];
      return timestamp ? new Date(timestamp).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : items[0]?.label || "";
    } } } }, scales: { x: { grid: { color: theme.gridColor }, ticks: { color: theme.textDim, maxTicksLimit: 5, font: { family: "JetBrains Mono", size: 10 } } }, y: { min, max, title: { display: true, text: title, color: theme.textColor }, grid: { color: theme.gridColor }, ticks: { color: theme.textDim, font: { family: "JetBrains Mono", size: 10 } } } } });
    const voltageCanvas = document.getElementById("sensorLineChart");
    const currentCanvas = document.getElementById("sensorBarChart");
    if (voltageCanvas) sensorLineChartInstance = new Chart(voltageCanvas, { type: "line", data: { labels: [], datasets: [
      { label: "Tensión RMS", data: [], borderColor: "#4fb3e0", borderWidth: 2, pointRadius: 3, pointHoverRadius: 6, tension: .2 },
      { label: "Límite inferior", data: [], borderColor: "#ef4444", borderWidth: 1, pointRadius: 0, borderDash: [5, 4] },
      { label: "Nominal", data: [], borderColor: "#10b981", borderWidth: 1, pointRadius: 0, borderDash: [3, 3] },
      { label: "Límite superior", data: [], borderColor: "#f59e0b", borderWidth: 1, pointRadius: 0, borderDash: [5, 4] }
    ] }, options: buildLineOptions("Tensión (V)", 160, 260) });
    if (currentCanvas) sensorBarChartInstance = new Chart(currentCanvas, { type: "line", data: { labels: [], datasets: [{ label: "Corriente de línea", data: [], borderColor: "#d8b45c", backgroundColor: "rgba(216, 180, 92, .12)", fill: true, borderWidth: 2, pointRadius: 3, pointHoverRadius: 6, tension: .2 }] }, options: buildLineOptions("Corriente (A)", 0, 0.05) });
  }

  function updateTelemetryCharts(readings) {
    const labels = readings.map((reading) => formatTelemetryTime(reading.timestamp));
    if (sensorLineChartInstance) {
      sensorLineChartInstance.$telemetryTimestamps = readings.map((reading) => reading.timestamp);
      sensorLineChartInstance.data.labels = labels;
      sensorLineChartInstance.data.datasets[0].data = readings.map((reading) => reading.tension);
      sensorLineChartInstance.data.datasets[1].data = readings.map(() => 198);
      sensorLineChartInstance.data.datasets[2].data = readings.map(() => 220);
      sensorLineChartInstance.data.datasets[3].data = readings.map(() => 242);
      sensorLineChartInstance.update("none");
    }
    if (sensorBarChartInstance) {
      sensorBarChartInstance.$telemetryTimestamps = readings.map((reading) => reading.timestamp);
      sensorBarChartInstance.data.labels = labels;
      sensorBarChartInstance.data.datasets[0].data = readings.map((reading) => reading.corriente);
      sensorBarChartInstance.options.scales.y.max = 0.05;
      sensorBarChartInstance.update("none");
    }
  }

  window.addEventListener("luminaria:authenticated", init, { once: true });
});
