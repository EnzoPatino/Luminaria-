/**
 * Project Luminaria - Lógica Principal de UI y Gestión de Eventos por Tableros
 * EPET 14 x EPET 20 — Municipalidad de Neuquén
 * Monitoreo centralizado por Tableros Eléctricos
 */

document.addEventListener('DOMContentLoaded', () => {
  // ==========================================
  // ESTADO DE LA APLICACIÓN
  // ==========================================
  const appState = {
    selectedTableroId: 'TABLERO_01',
    tableros: {
      'TABLERO_01': {
        id: 'TABLERO_01',
        nombre: 'EPET 14 / EPET 20',
        ubicacion: 'Aula Taller 3 - Planta Baja',
        posX: 20,
        posY: 45,
        tension_v: 220.0,
        tension_nominal_v: 220.0,
        fase: 'L1',
        focos: {
          'FOCO_A1': { id: 'FOCO_A1', corriente_ma: 450.0, estado: 'ok' },
          'FOCO_A2': { id: 'FOCO_A2', corriente_ma: 448.0, estado: 'ok' },
          'FOCO_A3': { id: 'FOCO_A3', corriente_ma: 452.0, estado: 'ok' },
          'FOCO_A4': { id: 'FOCO_A4', corriente_ma: 445.0, estado: 'ok' },
          'FOCO_B1': { id: 'FOCO_B1', corriente_ma: 450.0, estado: 'ok' },
          'FOCO_B2': { id: 'FOCO_B2', corriente_ma: 449.0, estado: 'ok' },
          'FOCO_B3': { id: 'FOCO_B3', corriente_ma: 451.0, estado: 'ok' },
          'FOCO_B4': { id: 'FOCO_B4', corriente_ma: 446.0, estado: 'ok' }
        }
      },
      'TABLERO_02': {
        id: 'TABLERO_02',
        nombre: 'Parque Norte',
        ubicacion: 'Parque Norte - Sector Canchas',
        posX: 45,
        posY: 30,
        tension_v: 218.5,
        tension_nominal_v: 220.0,
        fase: 'L2',
        focos: {
          'FOCO_C1': { id: 'FOCO_C1', corriente_ma: 450.0, estado: 'ok' },
          'FOCO_C2': { id: 'FOCO_C2', corriente_ma: 447.0, estado: 'ok' },
          'FOCO_C3': { id: 'FOCO_C3', corriente_ma: 452.0, estado: 'ok' }
        }
      },
      'TABLERO_03': {
        id: 'TABLERO_03',
        nombre: 'Paseo de la Costa',
        ubicacion: 'Paseo de la Costa - Río Limay',
        posX: 75,
        posY: 75,
        tension_v: 220.0,
        tension_nominal_v: 220.0,
        fase: 'L3',
        focos: {
          'FOCO_D1': { id: 'FOCO_D1', corriente_ma: 450.0, estado: 'ok' },
          'FOCO_D2': { id: 'FOCO_D2', corriente_ma: 450.0, estado: 'ok' }
        }
      },
      'TABLERO_04': {
        id: 'TABLERO_04',
        nombre: 'Avenida Argentina',
        ubicacion: 'Av. Argentina y Monolito',
        posX: 55,
        posY: 50,
        tension_v: 221.0,
        tension_nominal_v: 220.0,
        fase: 'L1',
        focos: {
          'FOCO_E1': { id: 'FOCO_E1', corriente_ma: 450.0, estado: 'ok' }
        }
      }
    },
    alerts: [],
    activeFilter: 'ALL',
    soundEnabled: true
  };

  // Referencias a elementos DOM
  const elements = {
    mqttStatusDot: document.getElementById('mqttStatusDot'),
    mqttStatusText: document.getElementById('mqttStatusText'),
    kpiTensionVal: document.getElementById('kpiTensionVal'),
    kpiTensionSub: document.getElementById('kpiTensionSub'),
    kpiAlertasCriticas: document.getElementById('kpiAlertasCriticas'),
    kpiAdvertencias: document.getElementById('kpiAdvertencias'),
    kpiTotalFocos: document.getElementById('kpiTotalFocos'),

    mapPinsContainer: document.getElementById('mapPinsContainer'),
    selectTablero: document.getElementById('selectTablero'),
    tableroUbicacion: document.getElementById('tableroUbicacion'),
    voltageGaugeNum: document.getElementById('voltageGaugeNum'),
    voltageGaugeFill: document.getElementById('voltageGaugeFill'),
    voltageStatusTag: document.getElementById('voltageStatusTag'),

    alertsContainer: document.getElementById('alertsContainer'),
    alertsCountBadge: document.getElementById('alertsCountBadge'),
    filterChips: document.querySelectorAll('.filter-chip'),

    mqttConsoleLog: document.getElementById('mqttConsoleLog'),
    btnClearConsole: document.getElementById('btnClearConsole'),

    btnOpenMqttModal: document.getElementById('btnOpenMqttModal'),
    btnOpenSimModal: document.getElementById('btnOpenSimModal'),
    btnToggleSound: document.getElementById('btnToggleSound'),
    btnToggleTheme: document.getElementById('btnToggleTheme'),
    btnHeaderMenu: document.getElementById('btnHeaderMenu'),
    headerActions: document.getElementById('headerActions'),
    soundLabelMobile: document.getElementById('soundLabelMobile'),
    themeLabelMobile: document.getElementById('themeLabelMobile'),
    mqttModal: document.getElementById('mqttModal'),
    simModal: document.getElementById('simModal'),
    closeMqttModal: document.getElementById('closeMqttModal'),
    closeSimModal: document.getElementById('closeSimModal'),

    formMqttConfig: document.getElementById('formMqttConfig'),
    btnConnectMosquitto: document.getElementById('btnConnectMosquitto'),
    btnUseSimMode: document.getElementById('btnUseSimMode'),

    simBajaTension: document.getElementById('simBajaTension'),
    simDesconexionAbrupta: document.getElementById('simDesconexionAbrupta'),
    simFocoQuemado: document.getElementById('simFocoQuemado'),
    simTelemetriaNormal: document.getElementById('simTelemetriaNormal')
  };

  // ==========================================
  // INICIALIZACIÓN
  // ==========================================
  function init() {
    setupTabNavigation();
    setupEventListeners();
    setupMqttCallbacks();
    applyStoredTheme();
    updateTableroUI();
    renderAlerts();
    updateKPIs();
    renderMapPins();

    // Conectar a MQTT o Modo Simulación
    window.luminariaMQTT.connect();
  }

  // ==========================================
  // TEMA CLARO / OSCURO
  // ==========================================
  const THEME_STORAGE_KEY = 'luminaria_theme';

  function getStoredTheme() {
    try {
      const t = localStorage.getItem(THEME_STORAGE_KEY);
      return (t === 'light' || t === 'dark') ? t : 'dark';
    } catch (e) {
      return 'dark';
    }
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.classList.toggle('light-mode', theme === 'light');
    if (document.body) {
      document.body.classList.toggle('light-mode', theme === 'light');
    }
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (e) {}
    updateThemeIcon(theme);
  }

  function applyStoredTheme() {
    // Sincronizar tema y clase según valor guardado o atributo en html
    const current = document.documentElement.getAttribute('data-theme') || getStoredTheme();
    setTheme(current);
  }

  function updateThemeIcon(theme) {
    if (!elements.btnToggleTheme) return;
    const icon = elements.btnToggleTheme.querySelector('i');
    if (theme === 'light') {
      if (icon) icon.className = 'fas fa-sun';
      elements.btnToggleTheme.title = 'Cambiar a modo oscuro';
      elements.btnToggleTheme.setAttribute('aria-label', 'Cambiar a modo oscuro');
      if (elements.themeLabelMobile) elements.themeLabelMobile.textContent = 'Modo: Claro (Tocar para Oscuro)';
    } else {
      if (icon) icon.className = 'fas fa-moon';
      elements.btnToggleTheme.title = 'Cambiar a modo claro';
      elements.btnToggleTheme.setAttribute('aria-label', 'Cambiar a modo claro');
      if (elements.themeLabelMobile) elements.themeLabelMobile.textContent = 'Modo: Oscuro (Tocar para Claro)';
    }
  }

  // ==========================================
  // NAVEGACIÓN POR PESTAÑAS (TABS)
  // ==========================================
  function setupTabNavigation() {
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');

        const targetTab = tab.dataset.tab;
        document.querySelectorAll('.tab-pane').forEach(pane => {
          pane.classList.remove('active');
        });

        const targetPaneId = 'tab' + targetTab.charAt(0).toUpperCase() + targetTab.slice(1);
        const targetPane = document.getElementById(targetPaneId);
        if (targetPane) {
          targetPane.classList.add('active');
        }
      });
    });
  }

  // ==========================================
  // EVENT LISTENERS & DELEGACIÓN
  // ==========================================
  function setupEventListeners() {
    // Cambio en selector hidden si existiera
    if (elements.selectTablero) {
      elements.selectTablero.addEventListener('change', (e) => {
        appState.selectedTableroId = e.target.value;
        updateTableroUI();
        renderMapPins();
      });
    }

    // Filtros de Alertas
    elements.filterChips.forEach(chip => {
      chip.addEventListener('click', () => {
        elements.filterChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        appState.activeFilter = chip.dataset.filter;
        renderAlerts();
      });
    });

    // Limpiar consola
    if (elements.btnClearConsole) {
      elements.btnClearConsole.addEventListener('click', () => {
        if (elements.mqttConsoleLog) {
          elements.mqttConsoleLog.innerHTML = `<div class="log-row"><span class="log-time">[${new Date().toLocaleTimeString('es-AR')}]</span> <span class="log-text">Consola limpiada.</span></div>`;
        }
      });
    }

    // Activar / Desactivar Sonido
    if (elements.btnToggleSound) {
      elements.btnToggleSound.addEventListener('click', () => {
        appState.soundEnabled = !appState.soundEnabled;
        const soundIcon = elements.btnToggleSound.querySelector('i');
        if (soundIcon) {
          soundIcon.className = appState.soundEnabled ? 'fas fa-volume-up' : 'fas fa-volume-mute';
        }
        if (elements.soundLabelMobile) {
          elements.soundLabelMobile.textContent = appState.soundEnabled ? 'Sonido: Activado' : 'Sonido: Silenciado';
        }
        elements.btnToggleSound.title = appState.soundEnabled ? 'Sonido Activado' : 'Sonido Silenciado';
        elements.btnToggleSound.setAttribute('aria-label', appState.soundEnabled ? 'Silenciar sonido de alarma' : 'Activar sonido de alarma');
      });
    }

    // Cambiar tema claro / oscuro
    if (elements.btnToggleTheme) {
      elements.btnToggleTheme.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme') || 'dark';
        const next = current === 'dark' ? 'light' : 'dark';
        setTheme(next);
      });
    }

    // Menú Hamburguesa en Mobile
    function toggleHeaderMenu(forceState) {
      if (!elements.btnHeaderMenu || !elements.headerActions) return;
      const isOpen = typeof forceState === 'boolean' ? forceState : !elements.headerActions.classList.contains('is-open');
      elements.headerActions.classList.toggle('is-open', isOpen);
      elements.btnHeaderMenu.classList.toggle('active', isOpen);
      elements.btnHeaderMenu.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      const icon = elements.btnHeaderMenu.querySelector('i');
      if (icon) {
        icon.className = isOpen ? 'fas fa-xmark' : 'fas fa-bars';
      }
    }

    function closeHeaderMenu() {
      toggleHeaderMenu(false);
    }

    if (elements.btnHeaderMenu) {
      elements.btnHeaderMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleHeaderMenu();
      });
    }

    // Cerrar el menú desplegable al hacer clic afuera
    document.addEventListener('click', (e) => {
      if (elements.headerActions && elements.headerActions.classList.contains('is-open')) {
        if (!elements.headerActions.contains(e.target) && e.target !== elements.btnHeaderMenu && !elements.btnHeaderMenu.contains(e.target)) {
          closeHeaderMenu();
        }
      }
    });

    // Cerrar menú con tecla Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeHeaderMenu();
      }
    });

    // Al hacer clic en una opción del menú en mobile, cerrarlo suavemente
    if (elements.headerActions) {
      elements.headerActions.querySelectorAll('.btn').forEach(btn => {
        btn.addEventListener('click', () => {
          if (window.innerWidth <= 768) {
            setTimeout(closeHeaderMenu, 150);
          }
        });
      });
    }

    // Modales
    if (elements.btnOpenMqttModal) elements.btnOpenMqttModal.addEventListener('click', () => openModal(elements.mqttModal));
    if (elements.btnOpenSimModal) elements.btnOpenSimModal.addEventListener('click', () => openModal(elements.simModal));
    if (elements.closeMqttModal) elements.closeMqttModal.addEventListener('click', () => closeModal(elements.mqttModal));
    if (elements.closeSimModal) elements.closeSimModal.addEventListener('click', () => closeModal(elements.simModal));

    [elements.mqttModal, elements.simModal].forEach(modal => {
      if (modal) {
        modal.addEventListener('click', (e) => {
          if (e.target === modal) closeModal(modal);
        });
      }
    });

    // Form MQTT Config
    if (elements.formMqttConfig) {
      const cfg = window.luminariaMQTT.config;
      document.getElementById('mqttHost').value = cfg.host;
      document.getElementById('mqttPort').value = cfg.port;
      document.getElementById('mqttPath').value = cfg.path;
      document.getElementById('mqttClientId').value = cfg.clientId;
      document.getElementById('mqttTopic').value = cfg.topics.join(', ');

      elements.formMqttConfig.addEventListener('submit', (e) => {
        e.preventDefault();
        const newCfg = {
          host: document.getElementById('mqttHost').value.trim() || 'localhost',
          port: parseInt(document.getElementById('mqttPort').value.trim(), 10) || 9001,
          path: document.getElementById('mqttPath').value.trim() || '/mqtt',
          clientId: document.getElementById('mqttClientId').value.trim() || 'luminaria_web',
          topics: document.getElementById('mqttTopic').value.split(',').map(t => t.trim()).filter(Boolean)
        };
        window.luminariaMQTT.connect(newCfg);
        closeModal(elements.mqttModal);
      });
    }

    if (elements.btnUseSimMode) {
      elements.btnUseSimMode.addEventListener('click', () => {
        window.luminariaMQTT.disconnect();
        closeModal(elements.mqttModal);
      });
    }

    setupSimulationPresets();
  }

  function setupSimulationPresets() {
    if (elements.simBajaTension) {
      elements.simBajaTension.addEventListener('click', () => {
        const payload = {
          tipo_evento: "BAJA_TENSION",
          id_tablero: appState.selectedTableroId,
          timestamp: new Date().toISOString(),
          datos: {
            tension_medida_v: 185.3,
            tension_nominal_v: 220.0,
            umbral_minimo_v: 190.0,
            fase: "L1"
          },
          severidad: "CRITICA",
          ubicacion: appState.tableros[appState.selectedTableroId]?.ubicacion || "Aula Taller 3 - Planta Baja"
        };
        window.luminariaMQTT.publish("api/evento", payload);
        closeModal(elements.simModal);
      });
    }

    if (elements.simDesconexionAbrupta) {
      elements.simDesconexionAbrupta.addEventListener('click', () => {
        const payload = {
          tipo_evento: "DESCONEXION_ABRUPTA_FOCO",
          id_tablero: appState.selectedTableroId,
          timestamp: new Date().toISOString(),
          datos: {
            id_foco: "FOCO_A3",
            corriente_previa_ma: 450.0,
            corriente_actual_ma: 0.0,
            tiempo_caida_ms: 85,
            estado_circuito: "ACTIVO"
          },
          severidad: "CRITICA",
          ubicacion: appState.tableros[appState.selectedTableroId]?.ubicacion || "Pasillo Principal"
        };
        window.luminariaMQTT.publish("api/evento", payload);
        closeModal(elements.simModal);
      });
    }

    if (elements.simFocoQuemado) {
      elements.simFocoQuemado.addEventListener('click', () => {
        const payload = {
          tipo_evento: "FOCO_QUEMADO",
          id_tablero: appState.selectedTableroId,
          timestamp: new Date().toISOString(),
          datos: {
            id_foco: "FOCO_B1",
            corriente_esperada_ma: 450.0,
            corriente_medida_ma: 12.5,
            duracion_anomalia_s: 30,
            estado_circuito: "ACTIVO"
          },
          severidad: "ADVERTENCIA",
          ubicacion: appState.tableros[appState.selectedTableroId]?.ubicacion || "Sector Canchas"
        };
        window.luminariaMQTT.publish("api/evento", payload);
        closeModal(elements.simModal);
      });
    }

    if (elements.simTelemetriaNormal) {
      elements.simTelemetriaNormal.addEventListener('click', () => {
        const payload = {
          tipo_evento: "TELEMETRIA_NORMAL",
          id_tablero: appState.selectedTableroId,
          timestamp: new Date().toISOString(),
          datos: {
            tension_medida_v: 220.0,
            tension_nominal_v: 220.0,
            fase: "L1",
            focos_restaurados: ["FOCO_A3", "FOCO_B1"]
          },
          severidad: "INFO",
          ubicacion: appState.tableros[appState.selectedTableroId]?.ubicacion || "Aula Taller 3"
        };
        window.luminariaMQTT.publish("api/evento", payload);
        closeModal(elements.simModal);
      });
    }
  }

  // ==========================================
  // CALLBACKS Y PROCESAMIENTO MQTT
  // ==========================================
  function setupMqttCallbacks() {
    window.luminariaMQTT.onStatusChangeCallback = ({ status, label }) => {
      elements.mqttStatusDot.className = 'status-dot ' + status;
      elements.mqttStatusText.textContent = label;
    };

    window.luminariaMQTT.onLogCallback = ({ timestamp, message, type, topic }) => {
      if (!elements.mqttConsoleLog) return;
      const logRow = document.createElement('div');
      logRow.className = `log-row log-type-${type}`;
      
      let topicTag = topic ? `<span class="log-topic">[${topic}]</span>` : '';
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
    if (!event || !event.tipo_evento) return;

    const tableroId = event.id_tablero || appState.selectedTableroId;
    if (!appState.tableros[tableroId]) {
      appState.tableros[tableroId] = {
        id: tableroId,
        nombre: tableroId,
        ubicacion: event.ubicacion || 'Ubicación Desconocida',
        posX: 50,
        posY: 50,
        tension_v: 220.0,
        focos: {}
      };
    }

    const tablero = appState.tableros[tableroId];
    if (event.ubicacion) tablero.ubicacion = event.ubicacion;

    let alertTitle = '';
    let soundType = 'info';

    if (event.tipo_evento === 'BAJA_TENSION') {
      const tension = event.datos?.tension_medida_v || 185.0;
      tablero.tension_v = tension;
      tablero.fase = event.datos?.fase || 'L1';
      alertTitle = `Baja Tensión Detectada: ${tension}V (Umbral: ${event.datos?.umbral_minimo_v || 190}V)`;
      soundType = 'critical';
    }
    else if (event.tipo_evento === 'DESCONEXION_ABRUPTA_FOCO') {
      const focoId = event.datos?.id_foco || 'FOCO_DESCONOCIDO';
      if (!tablero.focos[focoId]) {
        tablero.focos[focoId] = { id: focoId, corriente_ma: 0, estado: 'robado' };
      }
      tablero.focos[focoId].corriente_ma = event.datos?.corriente_actual_ma || 0.0;
      tablero.focos[focoId].estado = 'robado';
      alertTitle = `Desconexión Abrupta / Posible Robo en ${tablero.nombre || tableroId}`;
      soundType = 'critical';
    }
    else if (event.tipo_evento === 'FOCO_QUEMADO') {
      const focoId = event.datos?.id_foco || 'FOCO_DESCONOCIDO';
      if (!tablero.focos[focoId]) {
        tablero.focos[focoId] = { id: focoId, corriente_ma: 12.5, estado: 'quemado' };
      }
      tablero.focos[focoId].corriente_ma = event.datos?.corriente_medida_ma || 12.5;
      tablero.focos[focoId].estado = 'quemado';
      alertTitle = `Anomalía de Consumo / Foco Quemado en ${tablero.nombre || tableroId}`;
      soundType = 'warning';
    }
    else if (event.tipo_evento === 'TELEMETRIA_NORMAL') {
      tablero.tension_v = event.datos?.tension_medida_v || 220.0;
      if (event.datos?.focos_restaurados) {
        event.datos.focos_restaurados.forEach(fId => {
          if (tablero.focos[fId]) {
            tablero.focos[fId].estado = 'ok';
            tablero.focos[fId].corriente_ma = 450.0;
          }
        });
      } else {
        Object.keys(tablero.focos).forEach(fId => {
          tablero.focos[fId].estado = 'ok';
          tablero.focos[fId].corriente_ma = 450.0;
        });
      }
      alertTitle = `Telemetría Normal Restablecida en ${tablero.nombre || tableroId}`;
      soundType = 'info';
    }

    const alertRecord = {
      id: 'ALR-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
      tipo_evento: event.tipo_evento,
      severidad: event.severidad || 'INFO',
      titulo: alertTitle,
      timestamp: event.timestamp || new Date().toISOString(),
      ubicacion: event.ubicacion || tablero.ubicacion,
      datos: event.datos || {},
      id_tablero: tableroId,
      resuelta: false
    };

    appState.alerts.unshift(alertRecord);

    if (appState.soundEnabled) {
      playAlertAudioSound(soundType);
    }

    updateTableroUI();
    renderAlerts();
    updateKPIs();
    renderMapPins();
  }

  // ==========================================
  // RENDERIZADO Y ACTUALIZACIÓN VISTA TABLEROS
  // ==========================================
  function updateTableroUI() {
    renderTablerosGrid();
  }

  function renderTablerosGrid() {
    const container = document.getElementById('tablerosGridContainer');
    if (!container) return;
    container.innerHTML = '';

    Object.values(appState.tableros).forEach(tablero => {
      let statusClass = 'ok';
      let statusLabel = 'Funcionamiento Normal';
      let statusBadgeClass = 'badge-ok';
      let statusIcon = 'fa-check-circle';

      if (tablero.tension_v < 190.0) {
        statusClass = 'critical';
        statusLabel = 'Baja Tensión (<190V)';
        statusBadgeClass = 'badge-critical';
        statusIcon = 'fa-triangle-exclamation';
      } else if (tablero.tension_v < 210.0) {
        statusClass = 'warning';
        statusLabel = 'Tensión Borde (Baja)';
        statusBadgeClass = 'badge-warning';
        statusIcon = 'fa-exclamation-triangle';
      }

      let totalFocos = Object.keys(tablero.focos || {}).length;
      let focosOk = 0;
      let focosRobados = 0;
      let focosQuemados = 0;

      Object.values(tablero.focos || {}).forEach(f => {
        if (f.estado === 'ok') focosOk++;
        else if (f.estado === 'robado') focosRobados++;
        else if (f.estado === 'quemado') focosQuemados++;
      });

      if (focosRobados > 0) {
        statusClass = 'critical';
        statusLabel = `Desconexión Abrupta (${focosRobados})`;
        statusBadgeClass = 'badge-critical';
        statusIcon = 'fa-bolt';
      } else if (focosQuemados > 0 && statusClass !== 'critical') {
        statusClass = 'warning';
        statusLabel = `Foco Quemado (${focosQuemados})`;
        statusBadgeClass = 'badge-warning';
        statusIcon = 'fa-exclamation-circle';
      }

      const isSelected = tablero.id === appState.selectedTableroId;
      const pctVoltage = Math.min(Math.max((tablero.tension_v / 250.0) * 100, 0), 100);

      const card = document.createElement('article');
      card.className = `tablero-card ${statusClass} ${isSelected ? 'selected' : ''}`;

      card.innerHTML = `
        <div class="tablero-card-header">
          <div class="tablero-title-group">
            <span class="tablero-tag">${tablero.id}</span>
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
            <span class="meter-val ${statusClass}">${tablero.tension_v.toFixed(1)} <span class="meter-unit">Volts</span></span>
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
            <span class="info-cell-val">${tablero.fase || 'L1'}</span>
          </div>
          <div class="info-cell">
            <span class="info-cell-lbl">Circuito Luminarias</span>
            <span class="info-cell-val">${focosOk} de ${totalFocos} Operativas</span>
          </div>
        </div>

        <div class="tablero-card-actions">
          <button class="btn btn-secondary btn-sm btn-select-tablero">
            <i class="fas ${isSelected ? 'fa-circle-dot' : 'fa-circle'}"></i> ${isSelected ? 'Tablero Seleccionado' : 'Seleccionar Tablero'}
          </button>
        </div>
      `;

      card.querySelector('.btn-select-tablero').addEventListener('click', () => {
        appState.selectedTableroId = tablero.id;
        if (elements.selectTablero) elements.selectTablero.value = tablero.id;
        updateTableroUI();
        renderMapPins();
      });

      container.appendChild(card);
    });
  }

  function renderAlerts() {
    if (!elements.alertsContainer) return;
    elements.alertsContainer.innerHTML = '';

    const filtered = appState.alerts.filter(a => {
      if (appState.activeFilter === 'ALL') return true;
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

    filtered.forEach(alert => {
      const card = document.createElement('div');
      card.className = `alert-card ${alert.severidad} ${alert.resuelta ? 'resuelta' : ''}`;

      const timeFormatted = new Date(alert.timestamp).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      let detailsHtml = '';
      if (alert.datos) {
        detailsHtml = Object.entries(alert.datos).map(([k, v]) => `
          <div class="alert-detail-item">
            <span class="alert-detail-key">${k}:</span>
            <span class="alert-detail-val">${v}</span>
          </div>
        `).join('');
      }

      card.innerHTML = `
        <div class="alert-card-top">
          <span class="alert-badge ${alert.severidad}">${alert.severidad}</span>
          <span class="alert-time"><i class="far fa-clock"></i> ${timeFormatted}</span>
        </div>
        <div class="alert-title">${escapeHtml(alert.titulo)}</div>
        <div class="alert-location"><i class="fas fa-map-marker-alt"></i> ${escapeHtml(alert.ubicacion)}</div>
        ${detailsHtml ? `<div class="alert-details-grid">${detailsHtml}</div>` : ''}
        <div class="alert-actions">
          <button class="btn btn-secondary btn-sm btn-resolve" data-id="${alert.id}">
            <i class="fas ${alert.resuelta ? 'fa-check-double' : 'fa-check'}"></i> ${alert.resuelta ? 'Resuelta' : 'Marcar Resuelta'}
          </button>
        </div>
      `;

      const btnResolve = card.querySelector('.btn-resolve');
      btnResolve.addEventListener('click', () => {
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
    elements.mapPinsContainer.innerHTML = '';

    Object.values(appState.tableros).forEach(tablero => {
      let worstSeverity = 'ok';

      if (tablero.tension_v < 190.0) {
        worstSeverity = 'critical';
      } else if (tablero.tension_v < 210.0 && worstSeverity !== 'critical') {
        worstSeverity = 'warning';
      }

      Object.values(tablero.focos || {}).forEach(foco => {
        if (foco.estado === 'robado') {
          worstSeverity = 'critical';
        } else if (foco.estado === 'quemado' && worstSeverity !== 'critical') {
          worstSeverity = 'warning';
        }
      });

      const tableroAlerts = appState.alerts.filter(a => a.id_tablero === tablero.id && !a.resuelta);
      if (tableroAlerts.some(a => a.severidad === 'CRITICA')) {
        worstSeverity = 'critical';
      } else if (tableroAlerts.some(a => a.severidad === 'ADVERTENCIA') && worstSeverity !== 'critical') {
        worstSeverity = 'warning';
      }

      let pinColor = 'var(--color-ok)';
      let pinIcon = 'fa-check';
      if (worstSeverity === 'critical') {
        pinColor = 'var(--color-critical)';
        pinIcon = 'fa-triangle-exclamation';
      } else if (worstSeverity === 'warning') {
        pinColor = 'var(--color-warning)';
        pinIcon = 'fa-exclamation';
      }

      const isSelected = tablero.id === appState.selectedTableroId;

      const pinNode = document.createElement('div');
      pinNode.className = `map-pin-node ${isSelected ? 'selected' : ''}`;
      pinNode.style.left = `${tablero.posX}%`;
      pinNode.style.top = `${tablero.posY}%`;
      pinNode.style.setProperty('--pin-color', pinColor);
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

      pinNode.addEventListener('click', () => {
        appState.selectedTableroId = tablero.id;
        if (elements.selectTablero) elements.selectTablero.value = tablero.id;
        updateTableroUI();
        renderMapPins();

        // Cambiar a la pestaña de Tableros si hace clic en el mapa
        const tablerosNavTab = document.querySelector('.nav-tab[data-tab="tableros"]');
        if (tablerosNavTab) tablerosNavTab.click();
      });

      elements.mapPinsContainer.appendChild(pinNode);
    });
  }

  function updateKPIs() {
    const activeTableros = Object.values(appState.tableros);
    const selectedTablero = appState.tableros[appState.selectedTableroId];

    if (elements.kpiTensionVal && selectedTablero) {
      elements.kpiTensionVal.textContent = `${selectedTablero.tension_v.toFixed(1)} V`;
      elements.kpiTensionSub.textContent = `${selectedTablero.nombre || selectedTablero.id} • Fase ${selectedTablero.fase || 'L1'}`;
    }

    const criticasCount = appState.alerts.filter(a => a.severidad === 'CRITICA' && !a.resuelta).length;
    if (elements.kpiAlertasCriticas) {
      elements.kpiAlertasCriticas.textContent = `${criticasCount} Alertas`;
    }

    const advertenciasCount = appState.alerts.filter(a => a.severidad === 'ADVERTENCIA' && !a.resuelta).length;
    if (elements.kpiAdvertencias) {
      elements.kpiAdvertencias.textContent = `${advertenciasCount} Advertencias`;
    }

    if (elements.kpiTotalFocos) {
      elements.kpiTotalFocos.textContent = `${activeTableros.length} Tableros`;
    }

    const banner = document.getElementById('generalStatusBanner');
    const bannerIcon = document.getElementById('generalStatusIcon');
    const bannerTitle = document.getElementById('generalStatusTitle');
    const bannerDesc = document.getElementById('generalStatusDesc');

    if (banner && bannerTitle && bannerDesc) {
      if (criticasCount > 0) {
        banner.className = 'status-banner red';
        if (bannerIcon) bannerIcon.className = 'fas fa-triangle-exclamation';
        bannerTitle.textContent = 'ALERTA URGENTE: REVISAR TABLERO INMEDIATAMENTE';
        bannerDesc.textContent = `Se detectaron ${criticasCount} problema(s) crítico(s) de caída de tensión o desconexión en la red.`;
      } else if (advertenciasCount > 0) {
        banner.className = 'status-banner yellow';
        if (bannerIcon) bannerIcon.className = 'fas fa-triangle-exclamation';
        bannerTitle.textContent = 'ATENCIÓN: REVISIÓN DE RED REQUERIDA';
        bannerDesc.textContent = `Se registraron ${advertenciasCount} anomalías de consumo o fallas en luminarias.`;
      } else {
        banner.className = 'status-banner green';
        if (bannerIcon) bannerIcon.className = 'fas fa-check-circle';
        bannerTitle.textContent = 'FUNCIONAMIENTO NORMAL';
        bannerDesc.textContent = 'Todos los tableros eléctricos de la ciudad operan sin anomalías.';
      }
    }
  }

  function playAlertAudioSound(type) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'critical') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      } else if (type === 'warning') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      }
    } catch (e) {}
  }

  function openModal(modal) {
    if (modal) modal.classList.add('active');
  }

  function closeModal(modal) {
    if (modal) modal.classList.remove('active');
  }

  function escapeHtml(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/[&<>"']/g, function(m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
    });
  }

  init();
});
