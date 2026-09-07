/**
 * Project Luminaria - Lógica Principal de UI y Gestión de Eventos por Tableros
 * Municipalidad de Neuquén
 * Monitoreo centralizado por Tableros Eléctricos
 */

document.addEventListener("DOMContentLoaded", () => {
  // ==========================================
  // ESTADO DE LA APLICACIÓN
  // ==========================================
  const appState = {
    selectedTableroId: "TABLERO_01",
    userRole: "supervisor",
    tableros: {
      TABLERO_01: {
        id: "TABLERO_01",
        nombre: "Centro / Palacio Municipal",
        ubicacion: "Centro / Palacio Municipal",
        posX: 20,
        posY: 45,
        tension_v: 220.0,
        tension_nominal_v: 220.0,
        fase: "L1",
        focos: {
          FOCO_A1: { id: "FOCO_A1", corriente_ma: 450.0, estado: "ok" },
          FOCO_A2: { id: "FOCO_A2", corriente_ma: 448.0, estado: "ok" },
          FOCO_A3: { id: "FOCO_A3", corriente_ma: 452.0, estado: "ok" },
          FOCO_A4: { id: "FOCO_A4", corriente_ma: 445.0, estado: "ok" },
          FOCO_B1: { id: "FOCO_B1", corriente_ma: 450.0, estado: "ok" },
          FOCO_B2: { id: "FOCO_B2", corriente_ma: 449.0, estado: "ok" },
          FOCO_B3: { id: "FOCO_B3", corriente_ma: 451.0, estado: "ok" },
          FOCO_B4: { id: "FOCO_B4", corriente_ma: 446.0, estado: "ok" },
        },
      },
      TABLERO_02: {
        id: "TABLERO_02",
        nombre: "Parque Norte",
        ubicacion: "Parque Norte - Sector Canchas",
        posX: 45,
        posY: 30,
        tension_v: 218.5,
        tension_nominal_v: 220.0,
        fase: "L2",
        focos: {
          FOCO_C1: { id: "FOCO_C1", corriente_ma: 450.0, estado: "ok" },
          FOCO_C2: { id: "FOCO_C2", corriente_ma: 447.0, estado: "ok" },
          FOCO_C3: { id: "FOCO_C3", corriente_ma: 452.0, estado: "ok" },
        },
      },
      TABLERO_03: {
        id: "TABLERO_03",
        nombre: "Paseo de la Costa",
        ubicacion: "Paseo de la Costa - Río Limay",
        posX: 75,
        posY: 75,
        tension_v: 220.0,
        tension_nominal_v: 220.0,
        fase: "L3",
        focos: {
          FOCO_D1: { id: "FOCO_D1", corriente_ma: 450.0, estado: "ok" },
          FOCO_D2: { id: "FOCO_D2", corriente_ma: 450.0, estado: "ok" },
        },
      },
      TABLERO_04: {
        id: "TABLERO_04",
        nombre: "Avenida Argentina",
        ubicacion: "Av. Argentina y Monolito",
        posX: 55,
        posY: 50,
        tension_v: 221.0,
        tension_nominal_v: 220.0,
        fase: "L1",
        focos: {
          FOCO_E1: { id: "FOCO_E1", corriente_ma: 450.0, estado: "ok" },
        },
      },
    },
    alerts: [],
    activeFilter: "ALL",
    soundEnabled: true,
    expandedTableroId: null,
    sensor: {
      apiKey: "ClaveUnicaParaSensoresToken123",
      temperatura: 23.0,
      humedad: 40.0,
      lastUpdate: "22:35:00",
      history: [
        { time: "22:30:00", temp: 22.4, hum: 42.0 },
        { time: "22:31:00", temp: 22.6, hum: 41.5 },
        { time: "22:32:00", temp: 22.8, hum: 41.0 },
        { time: "22:33:00", temp: 23.0, hum: 40.5 },
        { time: "22:34:00", temp: 23.1, hum: 40.2 },
        { time: "22:35:00", temp: 23.0, hum: 40.0 },
      ],
      maxHistoryPoints: 15,
      ranges: {
        temp: { min: 18.0, max: 35.0, unit: "°C" },
        hum: { min: 30.0, max: 70.0, unit: "%" },
      },
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

    mapPinsContainer: document.getElementById("mapPinsContainer"),
    selectTablero: document.getElementById("selectTablero"),
    tableroUbicacion: document.getElementById("tableroUbicacion"),
    voltageGaugeNum: document.getElementById("voltageGaugeNum"),
    voltageGaugeFill: document.getElementById("voltageGaugeFill"),
    voltageStatusTag: document.getElementById("voltageStatusTag"),

    alertsContainer: document.getElementById("alertsContainer"),
    alertsCountBadge: document.getElementById("alertsCountBadge"),
    filterChips: document.querySelectorAll(".filter-chip"),

    mqttConsoleLog: document.getElementById("mqttConsoleLog"),
    btnClearConsole: document.getElementById("btnClearConsole"),

    btnOpenMqttModal: document.getElementById("btnOpenMqttModal"),
    btnOpenSimModal: document.getElementById("btnOpenSimModal"),
    roleSelector: document.getElementById("roleSelector"),
    roleIcon: document.getElementById("roleIcon"),
    btnToggleSound: document.getElementById("btnToggleSound"),
    btnToggleTheme: document.getElementById("btnToggleTheme"),
    btnHeaderMenu: document.getElementById("btnHeaderMenu"),
    headerActions: document.getElementById("headerActions"),
    soundLabelMobile: document.getElementById("soundLabelMobile"),
    themeLabelMobile: document.getElementById("themeLabelMobile"),
    mqttModal: document.getElementById("mqttModal"),
    simModal: document.getElementById("simModal"),
    closeMqttModal: document.getElementById("closeMqttModal"),
    closeSimModal: document.getElementById("closeSimModal"),

    formMqttConfig: document.getElementById("formMqttConfig"),
    btnConnectMosquitto: document.getElementById("btnConnectMosquitto"),
    btnUseSimMode: document.getElementById("btnUseSimMode"),

    simBajaTension: document.getElementById("simBajaTension"),
    simDesconexionAbrupta: document.getElementById("simDesconexionAbrupta"),
    simFocoQuemado: document.getElementById("simFocoQuemado"),
    simTelemetriaNormal: document.getElementById("simTelemetriaNormal"),

    // Elementos de la sección Sensores
    btnSimulateSensorMsg: document.getElementById("btnSimulateSensorMsg"),
    sensorCurrentTemp: document.getElementById("sensorCurrentTemp"),
    sensorCurrentHum: document.getElementById("sensorCurrentHum"),
    sensorApiKey: document.getElementById("sensorApiKey"),
    sensorLastUpdate: document.getElementById("sensorLastUpdate"),
    sensorTempBadge: document.getElementById("sensorTempBadge"),
    sensorHumBadge: document.getElementById("sensorHumBadge"),
    sensorTempCard: document.getElementById("sensorTempCard"),
    sensorHumCard: document.getElementById("sensorHumCard"),
    simSensorNormal: document.getElementById("simSensorNormal"),
    simSensorAlerta: document.getElementById("simSensorAlerta"),
  };

  // ==========================================
  // INICIALIZACIÓN
  // ==========================================
  function init() {
    setupTabNavigation();
    setupEventListeners();
    setupMqttCallbacks();
    applyStoredTheme();
    applyStoredRole();
    updateTableroUI();
    renderAlerts();
    updateKPIs();
    renderMapPins();
    initSensorCharts();
    updateSensorUI();

    // Conectar a MQTT o Modo Simulación
    window.luminariaMQTT.connect();
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
    updateSensorChartsTheme();
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
  // GESTIÓN DE VISTAS POR ROL (SUPERVISOR / TÉCNICO)
  // ==========================================
  const ROLE_STORAGE_KEY = "luminaria_user_role";

  function getStoredRole() {
    try {
      const r = localStorage.getItem(ROLE_STORAGE_KEY);
      return r === "tecnico" || r === "supervisor" ? r : "supervisor";
    } catch (e) {
      return "supervisor";
    }
  }

  function setRole(role) {
    appState.userRole = role;
    document.documentElement.setAttribute("data-role", role);
    if (document.body) {
      document.body.setAttribute("data-role", role);
    }
    try {
      localStorage.setItem(ROLE_STORAGE_KEY, role);
    } catch (e) {}

    if (elements.roleSelector && elements.roleSelector.value !== role) {
      elements.roleSelector.value = role;
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

  function applyStoredRole() {
    const current =
      document.documentElement.getAttribute("data-role") || getStoredRole();
    setRole(current);
  }

  function updateRoleIcon(role) {
    if (!elements.roleIcon) return;
    if (role === "tecnico") {
      elements.roleIcon.className = "fas fa-user-gear role-icon";
      elements.roleIcon.title = "Vista Técnico activa (monitoreo operativo)";
    } else {
      elements.roleIcon.className = "fas fa-user-shield role-icon";
      elements.roleIcon.title = "Vista Supervisor activa (control total)";
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
    // Cambio de Rol (Supervisor / Técnico)
    if (elements.roleSelector) {
      elements.roleSelector.addEventListener("change", (e) => {
        setRole(e.target.value);
      });
    }

    // Cambio en selector hidden si existiera
    if (elements.selectTablero) {
      elements.selectTablero.addEventListener("change", (e) => {
        appState.selectedTableroId = e.target.value;
        appState.expandedTableroId = null;
        updateTableroUI();
        renderMapPins();
      });
    }

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
    if (elements.btnOpenSimModal)
      elements.btnOpenSimModal.addEventListener("click", () =>
        openModal(elements.simModal),
      );
    if (elements.closeMqttModal)
      elements.closeMqttModal.addEventListener("click", () =>
        closeModal(elements.mqttModal),
      );
    if (elements.closeSimModal)
      elements.closeSimModal.addEventListener("click", () =>
        closeModal(elements.simModal),
      );

    [elements.mqttModal, elements.simModal].forEach((modal) => {
      if (modal) {
        modal.addEventListener("click", (e) => {
          if (e.target === modal) closeModal(modal);
        });
      }
    });

    // Form MQTT Config
    if (elements.formMqttConfig) {
      const cfg = window.luminariaMQTT.config;
      document.getElementById("mqttHost").value = cfg.host;
      document.getElementById("mqttPort").value = cfg.port;
      document.getElementById("mqttPath").value = cfg.path;
      document.getElementById("mqttClientId").value = cfg.clientId;
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
          topics: document
            .getElementById("mqttTopic")
            .value.split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        };
        window.luminariaMQTT.connect(newCfg);
        closeModal(elements.mqttModal);
      });
    }

    if (elements.btnUseSimMode) {
      elements.btnUseSimMode.addEventListener("click", () => {
        window.luminariaMQTT.disconnect();
        closeModal(elements.mqttModal);
      });
    }

    // Botón de lectura demo en la pestaña de sensores
    if (elements.btnSimulateSensorMsg) {
      elements.btnSimulateSensorMsg.addEventListener("click", () => {
        const randTemp = (22.0 + (Math.random() * 3 - 1.5)).toFixed(1);
        const randHum = (40.0 + (Math.random() * 6 - 3)).toFixed(1);
        const payload = {
          ApiKey: appState.sensor.apiKey,
          Tem: randTemp,
          Hum: randHum,
        };
        window.luminariaMQTT.publish("sensores/ambiente", payload);
      });
    }

    setupSimulationPresets();
  }

  function setupSimulationPresets() {
    if (elements.simBajaTension) {
      elements.simBajaTension.addEventListener("click", () => {
        const payload = {
          tipo_evento: "BAJA_TENSION",
          id_tablero: appState.selectedTableroId,
          timestamp: new Date().toISOString(),
          datos: {
            tension_medida_v: 185.3,
            tension_nominal_v: 220.0,
            umbral_minimo_v: 190.0,
            fase: "L1",
          },
          severidad: "CRITICA",
          ubicacion:
            appState.tableros[appState.selectedTableroId]?.ubicacion ||
            "Centro / Palacio Municipal",
        };
        window.luminariaMQTT.publish("api/evento", payload);
        closeModal(elements.simModal);
      });
    }

    if (elements.simDesconexionAbrupta) {
      elements.simDesconexionAbrupta.addEventListener("click", () => {
        const payload = {
          tipo_evento: "DESCONEXION_ABRUPTA_FOCO",
          id_tablero: appState.selectedTableroId,
          timestamp: new Date().toISOString(),
          datos: {
            id_foco: "FOCO_A3",
            corriente_previa_ma: 450.0,
            corriente_actual_ma: 0.0,
            tiempo_caida_ms: 85,
            estado_circuito: "ACTIVO",
          },
          severidad: "CRITICA",
          ubicacion:
            appState.tableros[appState.selectedTableroId]?.ubicacion ||
            "Pasillo Principal",
        };
        window.luminariaMQTT.publish("api/evento", payload);
        closeModal(elements.simModal);
      });
    }

    if (elements.simFocoQuemado) {
      elements.simFocoQuemado.addEventListener("click", () => {
        const payload = {
          tipo_evento: "FOCO_QUEMADO",
          id_tablero: appState.selectedTableroId,
          timestamp: new Date().toISOString(),
          datos: {
            id_foco: "FOCO_B1",
            corriente_esperada_ma: 450.0,
            corriente_medida_ma: 12.5,
            duracion_anomalia_s: 30,
            estado_circuito: "ACTIVO",
          },
          severidad: "ADVERTENCIA",
          ubicacion:
            appState.tableros[appState.selectedTableroId]?.ubicacion ||
            "Sector Canchas",
        };
        window.luminariaMQTT.publish("api/evento", payload);
        closeModal(elements.simModal);
      });
    }

    if (elements.simTelemetriaNormal) {
      elements.simTelemetriaNormal.addEventListener("click", () => {
        const payload = {
          tipo_evento: "TELEMETRIA_NORMAL",
          id_tablero: appState.selectedTableroId,
          timestamp: new Date().toISOString(),
          datos: {
            tension_medida_v: 220.0,
            tension_nominal_v: 220.0,
            fase: "L1",
            focos_restaurados: ["FOCO_A3", "FOCO_B1"],
          },
          severidad: "INFO",
          ubicacion:
            appState.tableros[appState.selectedTableroId]?.ubicacion ||
            "Centro / Palacio Municipal",
        };
        window.luminariaMQTT.publish("api/evento", payload);
        closeModal(elements.simModal);
      });
    }

    if (elements.simSensorNormal) {
      elements.simSensorNormal.addEventListener("click", () => {
        const payload = {
          ApiKey: "ClaveUnicaParaSensoresToken123",
          Tem: "23.0",
          Hum: "40.0",
        };
        window.luminariaMQTT.publish("sensores/ambiente", payload);
        closeModal(elements.simModal);
      });
    }

    if (elements.simSensorAlerta) {
      elements.simSensorAlerta.addEventListener("click", () => {
        const payload = {
          ApiKey: "ClaveUnicaParaSensoresToken123",
          Tem: "39.5",
          Hum: "82.0",
        };
        window.luminariaMQTT.publish("sensores/ambiente", payload);
        closeModal(elements.simModal);
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
      logRow.className = `log-row log-type-${type}`;

      let topicTag = topic ? `<span class="log-topic">[${topic}]</span>` : "";
      logRow.innerHTML = `<span class="log-time">[${timestamp}]</span> ${topicTag} <span class="log-text">${escapeHtml(message)}</span>`;

      elements.mqttConsoleLog.prepend(logRow);
      if (elements.mqttConsoleLog.children.length > 60) {
        elements.mqttConsoleLog.removeChild(elements.mqttConsoleLog.lastChild);
      }
    };

    window.luminariaMQTT.onMessageCallback = (topic, payloadJson) => {
      processIncomingEvent(payloadJson);
    };
  }

  function processIncomingEvent(event) {
    if (!event) return;

    // 1. Detectar si es un mensaje de telemetría de sensor ambiental
    // Formato broker: {"ApiKey":"ClaveUnicaParaSensoresToken123","Tem":"23.0","Hum":"40.0"}
    if (isSensorTelemetryEvent(event)) {
      processSensorTelemetry(event);
      return;
    }

    // 2. Eventos estándar de tableros eléctricos
    if (!event.tipo_evento) return;

    const tableroId = event.id_tablero || appState.selectedTableroId;
    if (!appState.tableros[tableroId]) {
      appState.tableros[tableroId] = {
        id: tableroId,
        nombre: tableroId,
        ubicacion: event.ubicacion || "Ubicación Desconocida",
        posX: 50,
        posY: 50,
        tension_v: 220.0,
        focos: {},
      };
    }

    const tablero = appState.tableros[tableroId];
    if (event.ubicacion) tablero.ubicacion = event.ubicacion;

    let alertTitle = "";
    let soundType = "info";

    if (event.tipo_evento === "BAJA_TENSION") {
      const tension = event.datos?.tension_medida_v || 185.0;
      tablero.tension_v = tension;
      tablero.fase = event.datos?.fase || "L1";
      alertTitle = `Baja Tensión Detectada: ${tension}V (Umbral: ${event.datos?.umbral_minimo_v || 190}V)`;
      soundType = "critical";
    } else if (event.tipo_evento === "DESCONEXION_ABRUPTA_FOCO") {
      const focoId = event.datos?.id_foco || "FOCO_DESCONOCIDO";
      if (!tablero.focos[focoId]) {
        tablero.focos[focoId] = {
          id: focoId,
          corriente_ma: 0,
          estado: "robado",
        };
      }
      tablero.focos[focoId].corriente_ma =
        event.datos?.corriente_actual_ma || 0.0;
      tablero.focos[focoId].estado = "robado";
      alertTitle = `Desconexión Abrupta / Posible Robo en ${tablero.nombre || tableroId}`;
      soundType = "critical";
    } else if (event.tipo_evento === "FOCO_QUEMADO") {
      const focoId = event.datos?.id_foco || "FOCO_DESCONOCIDO";
      if (!tablero.focos[focoId]) {
        tablero.focos[focoId] = {
          id: focoId,
          corriente_ma: 12.5,
          estado: "quemado",
        };
      }
      tablero.focos[focoId].corriente_ma =
        event.datos?.corriente_medida_ma || 12.5;
      tablero.focos[focoId].estado = "quemado";
      alertTitle = `Anomalía de Consumo / Foco Quemado en ${tablero.nombre || tableroId}`;
      soundType = "warning";
    } else if (event.tipo_evento === "TELEMETRIA_NORMAL") {
      tablero.tension_v = event.datos?.tension_medida_v || 220.0;
      if (event.datos?.focos_restaurados) {
        event.datos.focos_restaurados.forEach((fId) => {
          if (tablero.focos[fId]) {
            tablero.focos[fId].estado = "ok";
            tablero.focos[fId].corriente_ma = 450.0;
          }
        });
      } else {
        Object.keys(tablero.focos).forEach((fId) => {
          tablero.focos[fId].estado = "ok";
          tablero.focos[fId].corriente_ma = 450.0;
        });
      }
      alertTitle = `Telemetría Normal Restablecida en ${tablero.nombre || tableroId}`;
      soundType = "info";
    }

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

    appState.alerts.unshift(alertRecord);

    if (appState.soundEnabled) {
      playAlertAudioSound(soundType);
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
      let statusClass = "ok";
      let statusLabel = "Funcionamiento Normal";
      let statusBadgeClass = "badge-ok";
      let statusIcon = "fa-check-circle";

      if (tablero.tension_v < 190.0) {
        statusClass = "critical";
        statusLabel = "Baja Tensión (<190V)";
        statusBadgeClass = "badge-critical";
        statusIcon = "fa-triangle-exclamation";
      } else if (tablero.tension_v < 210.0) {
        statusClass = "warning";
        statusLabel = "Tensión Borde (Baja)";
        statusBadgeClass = "badge-warning";
        statusIcon = "fa-exclamation-triangle";
      }

      let totalFocos = Object.keys(tablero.focos || {}).length;
      let focosOk = 0;
      let focosRobados = 0;
      let focosQuemados = 0;

      Object.values(tablero.focos || {}).forEach((f) => {
        if (f.estado === "ok") focosOk++;
        else if (f.estado === "robado") focosRobados++;
        else if (f.estado === "quemado") focosQuemados++;
      });

      if (focosRobados > 0) {
        statusClass = "critical";
        statusLabel = `Desconexión Abrupta (${focosRobados})`;
        statusBadgeClass = "badge-critical";
        statusIcon = "fa-bolt";
      } else if (focosQuemados > 0 && statusClass !== "critical") {
        statusClass = "warning";
        statusLabel = `Foco Quemado (${focosQuemados})`;
        statusBadgeClass = "badge-warning";
        statusIcon = "fa-exclamation-circle";
      }

      const isSelected = tablero.id === appState.selectedTableroId;
      const isExpanded = tablero.id === appState.expandedTableroId;
      const pctVoltage = Math.min(
        Math.max((tablero.tension_v / 250.0) * 100, 0),
        100,
      );

      const focosArr = Object.values(tablero.focos || {});
      const avgCorriente =
        totalFocos > 0
          ? focosArr.reduce(
              (sum, f) => sum + (Number(f.corriente_ma) || 0),
              0,
            ) / totalFocos
          : 0;

      let focosListHtml = "";
      if (totalFocos === 0) {
        focosListHtml =
          '<div class="foco-row-empty">Sin focos registrados en este tablero.</div>';
      } else {
        focosListHtml = focosArr
          .map((f) => {
            const estado = f.estado || "ok";
            const estadoLabel =
              estado === "robado"
                ? "Robado"
                : estado === "quemado"
                  ? "Quemado"
                  : "Operativo";
            return `
          <div class="foco-row ${estado}">
            <span class="foco-row-id">${escapeHtml(f.id)}</span>
            <span class="foco-row-current">${(Number(f.corriente_ma) || 0).toFixed(1)} mA</span>
            <span class="foco-state-badge ${estado}">${estadoLabel}</span>
          </div>`;
          })
          .join("");
      }

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

        <div class="tablero-meter-section">
          <div class="meter-head">
            <span class="meter-lbl">Tensión de Red</span>
            <span class="meter-val ${statusClass}">${fmtVoltage(tablero.tension_v)} <span class="meter-unit">Volts</span></span>
          </div>
          <div class="meter-track">
            <div class="meter-danger-line" title="Límite mínimo 190V"></div>
            <div class="meter-fill ${statusClass}" style="width: ${pctVoltage}%;"></div>
          </div>
          <div class="meter-ticks">
            <span>0V</span>
            <span class="danger-tick">190V Mín.</span>
            <span>220V Normal</span>
          </div>
        </div>

        <div class="tablero-info-grid">
          <div class="info-cell">
            <span class="info-cell-lbl">Fase Eléctrica</span>
            <span class="info-cell-val">${escapeHtml(tablero.fase || "L1")}</span>
          </div>
          <div class="info-cell">
            <span class="info-cell-lbl">Circuito Luminarias</span>
            <span class="info-cell-val">${focosOk} de ${totalFocos} Operativas</span>
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
                <span class="expand-stat-lbl">Corriente Promedio</span>
                <span class="expand-stat-val">${avgCorriente.toFixed(1)} mA</span>
              </div>
              <div class="expand-stat">
                <span class="expand-stat-lbl">Operativos</span>
                <span class="expand-stat-val ok">${focosOk}</span>
              </div>
              <div class="expand-stat">
                <span class="expand-stat-lbl">Robados</span>
                <span class="expand-stat-val critical">${focosRobados}</span>
              </div>
              <div class="expand-stat">
                <span class="expand-stat-lbl">Quemados</span>
                <span class="expand-stat-val warning">${focosQuemados}</span>
              </div>
              <div class="expand-stat">
                <span class="expand-stat-lbl">Ubicación Mapa</span>
                <span class="expand-stat-val">X ${tablero.posX}% · Y ${tablero.posY}%</span>
              </div>
            </div>

            <div class="focos-list">
              <div class="focos-list-title"><i class="fas fa-lightbulb"></i> Focos del Circuito (${totalFocos})</div>
              ${focosListHtml}
            </div>
          </div>
        </div>`
            : ""
        }
      `;

      card
        .querySelector(".btn-select-tablero")
        .addEventListener("click", () => {
          if (tablero.id !== appState.selectedTableroId) {
            appState.selectedTableroId = tablero.id;
            appState.expandedTableroId = tablero.id;
            if (elements.selectTablero)
              elements.selectTablero.value = tablero.id;
          } else {
            appState.expandedTableroId =
              appState.expandedTableroId === tablero.id ? null : tablero.id;
          }
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
          <button class="btn btn-secondary btn-sm btn-resolve" data-id="${alert.id}">
            <i class="fas ${alert.resuelta ? "fa-check-double" : "fa-check"}"></i> ${alert.resuelta ? "Resuelta" : "Marcar Resuelta"}
          </button>
        </div>
      `;

      const btnResolve = card.querySelector(".btn-resolve");
      btnResolve.addEventListener("click", () => {
        alert.resuelta = !alert.resuelta;
        renderAlerts();
        updateKPIs();
        renderMapPins();
      });

      elements.alertsContainer.appendChild(card);
    });
  }

  function renderMapPins() {
    if (!elements.mapPinsContainer) return;
    elements.mapPinsContainer.innerHTML = "";

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

      let pinColor = "var(--color-ok)";
      let pinIcon = "fa-check";
      if (worstSeverity === "critical") {
        pinColor = "var(--color-critical)";
        pinIcon = "fa-triangle-exclamation";
      } else if (worstSeverity === "warning") {
        pinColor = "var(--color-warning)";
        pinIcon = "fa-exclamation";
      }

      const isSelected = tablero.id === appState.selectedTableroId;

      const pinNode = document.createElement("div");
      pinNode.className = `map-pin-node ${isSelected ? "selected" : ""}`;
      pinNode.style.left = `${tablero.posX}%`;
      pinNode.style.top = `${tablero.posY}%`;
      pinNode.style.setProperty("--pin-color", pinColor);
      pinNode.title = `${tablero.nombre || tablero.id}: ${tablero.ubicacion} (Clic para seleccionar)`;

      pinNode.innerHTML = `
        <div class="map-pin-icon-wrap">
          <i class="fas ${pinIcon}"></i>
        </div>
        <div class="map-pin-label">
          <span class="map-pin-status-dot"></span>
          <span>${escapeHtml(tablero.nombre || tablero.id)}</span>
        </div>
      `;

      pinNode.addEventListener("click", () => {
        appState.selectedTableroId = tablero.id;
        appState.expandedTableroId = tablero.id;
        if (elements.selectTablero) elements.selectTablero.value = tablero.id;
        updateTableroUI();
        renderMapPins();

        // Cambiar a la pestaña de Tableros si hace clic en el mapa
        const tablerosNavTab = document.querySelector(
          '.nav-tab[data-tab="tableros"]',
        );
        if (tablerosNavTab) tablerosNavTab.click();
      });

      elements.mapPinsContainer.appendChild(pinNode);
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

    if (banner && bannerTitle && bannerDesc) {
      if (criticasCount > 0) {
        banner.className = "status-banner red";
        if (bannerIcon) bannerIcon.className = "fas fa-triangle-exclamation";
        bannerTitle.textContent =
          "ALERTA URGENTE: REVISAR TABLERO INMEDIATAMENTE";
        bannerDesc.textContent = `Se detectaron ${criticasCount} problema(s) crítico(s) de caída de tensión o desconexión en la red.`;
      } else if (advertenciasCount > 0) {
        banner.className = "status-banner yellow";
        if (bannerIcon) bannerIcon.className = "fas fa-triangle-exclamation";
        bannerTitle.textContent = "ATENCIÓN: REVISIÓN DE RED REQUERIDA";
        bannerDesc.textContent = `Se registraron ${advertenciasCount} anomalías de consumo o fallas en luminarias.`;
      } else {
        banner.className = "status-banner green";
        if (bannerIcon) bannerIcon.className = "fas fa-check-circle";
        bannerTitle.textContent = "FUNCIONAMIENTO NORMAL";
        bannerDesc.textContent =
          "Todos los tableros eléctricos de la ciudad operan sin anomalías.";
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
  function isSensorTelemetryEvent(event) {
    if (!event || typeof event !== "object") return false;
    return (
      event.Tem !== undefined ||
      event.Hum !== undefined ||
      (event.ApiKey !== undefined &&
        (event.Tem !== undefined || event.Hum !== undefined)) ||
      event.tipo_evento === "TELEMETRIA_SENSOR"
    );
  }

  function processSensorTelemetry(event) {
    const rawTem =
      event.Tem !== undefined
        ? event.Tem
        : event.tem !== undefined
          ? event.tem
          : event.temperatura || event.temp;
    const rawHum =
      event.Hum !== undefined
        ? event.Hum
        : event.hum !== undefined
          ? event.hum
          : event.humedad || event.hum;
    const apiKey = event.ApiKey || event.apiKey || appState.sensor.apiKey;

    const tempVal = parseFloat(rawTem);
    const humVal = parseFloat(rawHum);

    if (!isNaN(tempVal)) {
      appState.sensor.temperatura = Number(tempVal.toFixed(1));
    }
    if (!isNaN(humVal)) {
      appState.sensor.humedad = Number(humVal.toFixed(1));
    }
    if (apiKey) {
      appState.sensor.apiKey = String(apiKey);
    }

    const nowTime = new Date().toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    appState.sensor.lastUpdate = nowTime;

    // Añadir al historial para el gráfico de líneas
    appState.sensor.history.push({
      time: nowTime,
      temp: appState.sensor.temperatura,
      hum: appState.sensor.humedad,
    });

    if (appState.sensor.history.length > appState.sensor.maxHistoryPoints) {
      appState.sensor.history.shift();
    }

    // Verificar si está dentro de los rangos aceptables
    const tempInRange =
      appState.sensor.temperatura >= appState.sensor.ranges.temp.min &&
      appState.sensor.temperatura <= appState.sensor.ranges.temp.max;
    const humInRange =
      appState.sensor.humedad >= appState.sensor.ranges.hum.min &&
      appState.sensor.humedad <= appState.sensor.ranges.hum.max;

    // Sonido sutil de advertencia si hay anomalía ambiental
    if ((!tempInRange || !humInRange) && appState.soundEnabled) {
      playAlertAudioSound("warning");
    }

    updateSensorUI();
  }

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

  function initSensorCharts() {
    if (typeof Chart === "undefined") {
      console.warn(
        "Chart.js no disponible para renderizar gráficos de sensores.",
      );
      return;
    }

    const theme = getChartThemeColors();
    const ctxLine = document.getElementById("sensorLineChart");
    const ctxBar = document.getElementById("sensorBarChart");

    // 1. Gráfico de Líneas (Historial de Temperatura y Humedad)
    if (ctxLine) {
      sensorLineChartInstance = new Chart(ctxLine, {
        type: "line",
        data: {
          labels: appState.sensor.history.map((h) => h.time),
          datasets: [
            {
              label: "Temperatura (°C)",
              data: appState.sensor.history.map((h) => h.temp),
              borderColor: "#f59e0b",
              backgroundColor: "rgba(245, 158, 11, 0.12)",
              borderWidth: 2.5,
              tension: 0.35,
              fill: true,
              pointBackgroundColor: "#f59e0b",
              pointBorderColor: "#ffffff",
              pointBorderWidth: 1.5,
              pointRadius: 4,
              pointHoverRadius: 6,
              yAxisID: "yTemp",
            },
            {
              label: "Humedad (%)",
              data: appState.sensor.history.map((h) => h.hum),
              borderColor: "#0284c7",
              backgroundColor: "rgba(2, 132, 199, 0.12)",
              borderWidth: 2.5,
              tension: 0.35,
              fill: true,
              pointBackgroundColor: "#0284c7",
              pointBorderColor: "#ffffff",
              pointBorderWidth: 1.5,
              pointRadius: 4,
              pointHoverRadius: 6,
              yAxisID: "yHum",
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: "index",
            intersect: false,
          },
          plugins: {
            legend: {
              display: false,
            },
            tooltip: {
              backgroundColor: theme.tooltipBg,
              titleColor: theme.tooltipText,
              bodyColor: theme.tooltipText,
              borderColor: theme.tooltipBorder,
              borderWidth: 1,
              padding: 10,
              callbacks: {
                label: function (context) {
                  return ` ${context.dataset.label}: ${context.parsed.y.toFixed(1)}`;
                },
              },
            },
          },
          scales: {
            x: {
              grid: { color: theme.gridColor },
              ticks: {
                color: theme.textDim,
                font: { family: "JetBrains Mono", size: 11 },
              },
            },
            yTemp: {
              type: "linear",
              display: true,
              position: "left",
              min: 0,
              max: 50,
              title: {
                display: true,
                text: "Temperatura (°C)",
                color: "#f59e0b",
                font: { weight: "bold", size: 11 },
              },
              grid: { color: theme.gridColor },
              ticks: {
                color: theme.textDim,
                font: { family: "JetBrains Mono", size: 11 },
              },
            },
            yHum: {
              type: "linear",
              display: true,
              position: "right",
              min: 0,
              max: 100,
              title: {
                display: true,
                text: "Humedad (%)",
                color: "#0284c7",
                font: { weight: "bold", size: 11 },
              },
              grid: { drawOnChartArea: false },
              ticks: {
                color: theme.textDim,
                font: { family: "JetBrains Mono", size: 11 },
              },
            },
          },
        },
      });
    }

    // 2. Gráfico de Barras (2 Barras: Temperatura y Humedad con Rangos Aceptables)
    if (ctxBar) {
      const temp = appState.sensor.temperatura;
      const hum = appState.sensor.humedad;
      const tempInRange =
        temp >= appState.sensor.ranges.temp.min &&
        temp <= appState.sensor.ranges.temp.max;
      const humInRange =
        hum >= appState.sensor.ranges.hum.min &&
        hum <= appState.sensor.ranges.hum.max;

      sensorBarChartInstance = new Chart(ctxBar, {
        type: "bar",
        data: {
          labels: ["Temperatura (°C)", "Humedad (%)"],
          datasets: [
            {
              label: "Valor Actual Medido",
              data: [temp, hum],
              backgroundColor: [
                tempInRange ? "#10b981" : temp > 35 ? "#ef4444" : "#f59e0b",
                humInRange ? "#0284c7" : hum > 70 ? "#ef4444" : "#f59e0b",
              ],
              borderColor: [
                tempInRange ? "#059669" : "#dc2626",
                humInRange ? "#0369a1" : "#dc2626",
              ],
              borderWidth: 1.5,
              borderRadius: 8,
              barPercentage: 0.65,
              categoryPercentage: 0.65,
            },
            {
              label: "Mínimo Aceptable",
              data: [
                appState.sensor.ranges.temp.min,
                appState.sensor.ranges.hum.min,
              ],
              backgroundColor: "rgba(79, 179, 224, 0.25)",
              borderColor: "rgba(79, 179, 224, 0.8)",
              borderWidth: 1.5,
              borderRadius: 6,
              barPercentage: 0.65,
              categoryPercentage: 0.65,
            },
            {
              label: "Máximo Aceptable",
              data: [
                appState.sensor.ranges.temp.max,
                appState.sensor.ranges.hum.max,
              ],
              backgroundColor: "rgba(216, 180, 92, 0.25)",
              borderColor: "rgba(216, 180, 92, 0.8)",
              borderWidth: 1.5,
              borderRadius: 6,
              barPercentage: 0.65,
              categoryPercentage: 0.65,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: true,
              position: "top",
              labels: {
                color: theme.textColor,
                font: { family: "Outfit", size: 12, weight: "bold" },
                boxWidth: 14,
                padding: 12,
              },
            },
            tooltip: {
              backgroundColor: theme.tooltipBg,
              titleColor: theme.tooltipText,
              bodyColor: theme.tooltipText,
              borderColor: theme.tooltipBorder,
              borderWidth: 1,
              padding: 10,
              callbacks: {
                afterBody: function (items) {
                  const idx = items[0].dataIndex;
                  if (idx === 0) {
                    const val = appState.sensor.temperatura;
                    const ok = val >= 18 && val <= 35;
                    return `\nRango admisible: 18.0°C a 35.0°C\nEstado: ${ok ? " En Rango Aceptable" : "⚠️ Fuera de Rango Aceptable"}`;
                  } else {
                    const val = appState.sensor.humedad;
                    const ok = val >= 30 && val <= 70;
                    return `\nRango admisible: 30.0% a 70.0%\nEstado: ${ok ? " En Rango Aceptable" : "⚠️ Fuera de Rango Aceptable"}`;
                  }
                },
              },
            },
          },
          scales: {
            x: {
              grid: { color: theme.gridColor },
              ticks: {
                color: theme.textColor,
                font: { family: "Outfit", size: 13, weight: "bold" },
              },
            },
            y: {
              min: 0,
              max: 100,
              grid: { color: theme.gridColor },
              ticks: {
                color: theme.textDim,
                font: { family: "JetBrains Mono", size: 11 },
              },
              title: {
                display: true,
                text: "Escala Medida (°C / %)",
                color: theme.textColor,
                font: { weight: "bold", size: 11 },
              },
            },
          },
        },
      });
    }
  }

  function updateSensorUI() {
    const temp = appState.sensor.temperatura;
    const hum = appState.sensor.humedad;

    if (elements.sensorCurrentTemp) {
      elements.sensorCurrentTemp.textContent = temp.toFixed(1);
    }
    if (elements.sensorCurrentHum) {
      elements.sensorCurrentHum.textContent = hum.toFixed(1);
    }
    if (elements.sensorApiKey) {
      elements.sensorApiKey.textContent = appState.sensor.apiKey;
    }
    if (elements.sensorLastUpdate) {
      elements.sensorLastUpdate.textContent = appState.sensor.lastUpdate;
    }

    // Badges de rango aceptable
    const tempMin = appState.sensor.ranges.temp.min;
    const tempMax = appState.sensor.ranges.temp.max;
    if (elements.sensorTempBadge) {
      if (temp < tempMin) {
        elements.sensorTempBadge.className = "sensor-range-badge badge-warning";
        elements.sensorTempBadge.textContent = `Baja Temp (<${tempMin}°C)`;
      } else if (temp > tempMax) {
        elements.sensorTempBadge.className =
          "sensor-range-badge badge-critical";
        elements.sensorTempBadge.textContent = `Alta Temp (>${tempMax}°C)`;
      } else {
        elements.sensorTempBadge.className = "sensor-range-badge badge-ok";
        elements.sensorTempBadge.textContent = "Rango Aceptable";
      }
    }

    const humMin = appState.sensor.ranges.hum.min;
    const humMax = appState.sensor.ranges.hum.max;
    if (elements.sensorHumBadge) {
      if (hum < humMin) {
        elements.sensorHumBadge.className = "sensor-range-badge badge-warning";
        elements.sensorHumBadge.textContent = `Baja Humedad (<${humMin}%)`;
      } else if (hum > humMax) {
        elements.sensorHumBadge.className = "sensor-range-badge badge-critical";
        elements.sensorHumBadge.textContent = `Alta Humedad (>${humMax}%)`;
      } else {
        elements.sensorHumBadge.className = "sensor-range-badge badge-ok";
        elements.sensorHumBadge.textContent = "Rango Aceptable";
      }
    }

    // Actualizar Gráfico de Líneas
    if (sensorLineChartInstance) {
      sensorLineChartInstance.data.labels = appState.sensor.history.map(
        (h) => h.time,
      );
      sensorLineChartInstance.data.datasets[0].data =
        appState.sensor.history.map((h) => h.temp);
      sensorLineChartInstance.data.datasets[1].data =
        appState.sensor.history.map((h) => h.hum);
      sensorLineChartInstance.update();
    }

    // Actualizar Gráfico de Barras
    if (sensorBarChartInstance) {
      const tempInRange = temp >= tempMin && temp <= tempMax;
      const humInRange = hum >= humMin && hum <= humMax;

      sensorBarChartInstance.data.datasets[0].data = [temp, hum];
      sensorBarChartInstance.data.datasets[0].backgroundColor = [
        tempInRange ? "#10b981" : temp > tempMax ? "#ef4444" : "#f59e0b",
        humInRange ? "#0284c7" : hum > humMax ? "#ef4444" : "#f59e0b",
      ];
      sensorBarChartInstance.data.datasets[0].borderColor = [
        tempInRange ? "#059669" : "#dc2626",
        humInRange ? "#0369a1" : "#dc2626",
      ];
      sensorBarChartInstance.update();
    }
  }

  function updateSensorChartsTheme() {
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
      if (sensorLineChartInstance.options.scales.yTemp) {
        sensorLineChartInstance.options.scales.yTemp.grid.color =
          theme.gridColor;
        sensorLineChartInstance.options.scales.yTemp.ticks.color =
          theme.textDim;
      }
      if (sensorLineChartInstance.options.scales.yHum) {
        sensorLineChartInstance.options.scales.yHum.ticks.color = theme.textDim;
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

  init();
});
