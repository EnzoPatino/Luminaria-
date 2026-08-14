/**
 * Project Luminaria - Lógica Principal de UI y Gestión de Eventos
 * EPET 14 × EPET 20 — Municipalidad de Neuquén
 * Control visual, medidores, alertas en vivo y simulador
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
        ubicacion: 'Aula Taller 3 - Planta Baja',
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
        ubicacion: 'Parque Norte - Sector Canchas',
        tension_v: 218.5,
        tension_nominal_v: 220.0,
        fase: 'L2',
        focos: {
          'FOCO_C1': { id: 'FOCO_C1', corriente_ma: 450.0, estado: 'ok' },
          'FOCO_C2': { id: 'FOCO_C2', corriente_ma: 447.0, estado: 'ok' },
          'FOCO_C3': { id: 'FOCO_C3', corriente_ma: 452.0, estado: 'ok' }
        }
      }
    },
    alerts: [],
    activeFilter: 'ALL', // ALL | CRITICA | ADVERTENCIA | INFO
    soundEnabled: true
  };

  // Referencias a elementos del DOM
  const elements = {
    // Header & KPIs
    mqttStatusDot: document.getElementById('mqttStatusDot'),
    mqttStatusText: document.getElementById('mqttStatusText'),
    kpiTensionVal: document.getElementById('kpiTensionVal'),
    kpiTensionSub: document.getElementById('kpiTensionSub'),
    kpiAlertasCriticas: document.getElementById('kpiAlertasCriticas'),
    kpiAdvertencias: document.getElementById('kpiAdvertencias'),
    kpiTotalFocos: document.getElementById('kpiTotalFocos'),

    // Panel Telemetría
    selectTablero: document.getElementById('selectTablero'),
    tableroUbicacion: document.getElementById('tableroUbicacion'),
    voltageGaugeNum: document.getElementById('voltageGaugeNum'),
    voltageGaugeFill: document.getElementById('voltageGaugeFill'),
    voltageStatusTag: document.getElementById('voltageStatusTag'),
    focosGridContainer: document.getElementById('focosGridContainer'),

    // Feed de Alertas
    alertsContainer: document.getElementById('alertsContainer'),
    alertsCountBadge: document.getElementById('alertsCountBadge'),
    filterChips: document.querySelectorAll('.filter-chip'),

    // Consola MQTT
    mqttConsoleLog: document.getElementById('mqttConsoleLog'),
    btnClearConsole: document.getElementById('btnClearConsole'),

    // Modales & Botones
    btnOpenMqttModal: document.getElementById('btnOpenMqttModal'),
    btnOpenSimModal: document.getElementById('btnOpenSimModal'),
    btnToggleSound: document.getElementById('btnToggleSound'),
    mqttModal: document.getElementById('mqttModal'),
    simModal: document.getElementById('simModal'),
    closeMqttModal: document.getElementById('closeMqttModal'),
    closeSimModal: document.getElementById('closeSimModal'),

    // Forms
    formMqttConfig: document.getElementById('formMqttConfig'),
    btnSaveMqttConfig: document.getElementById('btnSaveMqttConfig'),
    btnConnectMosquitto: document.getElementById('btnConnectMosquitto'),
    btnUseSimMode: document.getElementById('btnUseSimMode'),

    // Botones de Simulación Presets
    simBajaTension: document.getElementById('simBajaTension'),
    simDesconexionAbrupta: document.getElementById('simDesconexionAbrupta'),
    simFocoQuemado: document.getElementById('simFocoQuemado'),
    simTelemetriaNormal: document.getElementById('simTelemetriaNormal')
  };

  // ==========================================
  // INICIALIZACIÓN
  // ==========================================
  function init() {
    setupEventListeners();
    setupMqttCallbacks();
    renderTableroSelectOptions();
    updateTableroUI();
    renderAlerts();
    updateKPIs();

    // Intentar conectar con la configuración guardada o arrancar en modo simulación
    window.luminariaMQTT.connect();
  }

  // ==========================================
  // EVENT LISTENERS & DELEGACIÓN
  // ==========================================
  function setupEventListeners() {
    // Cambio de tablero seleccionado
    if (elements.selectTablero) {
      elements.selectTablero.addEventListener('change', (e) => {
        appState.selectedTableroId = e.target.value;
        updateTableroUI();
      });
    }

    // Filtros de alertas
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
          elements.mqttConsoleLog.innerHTML = `<div class="log-entry"><span class="log-time">[${new Date().toLocaleTimeString('es-AR')}]</span> <span class="log-payload">Consola limpiada.</span></div>`;
        }
      });
    }

    // Toggle Sonido
    if (elements.btnToggleSound) {
      elements.btnToggleSound.addEventListener('click', () => {
        appState.soundEnabled = !appState.soundEnabled;
        elements.btnToggleSound.innerHTML = appState.soundEnabled 
          ? '<i class="fas fa-volume-up"></i>' 
          : '<i class="fas fa-volume-mute"></i>';
        elements.btnToggleSound.title = appState.soundEnabled ? 'Sonido Activado' : 'Sonido Silenciado';
      });
    }

    // Modales
    if (elements.btnOpenMqttModal) elements.btnOpenMqttModal.addEventListener('click', () => openModal(elements.mqttModal));
    if (elements.btnOpenSimModal) elements.btnOpenSimModal.addEventListener('click', () => openModal(elements.simModal));
    if (elements.closeMqttModal) elements.closeMqttModal.addEventListener('click', () => closeModal(elements.mqttModal));
    if (elements.closeSimModal) elements.closeSimModal.addEventListener('click', () => closeModal(elements.simModal));

    // Cerrar modal al hacer click fuera del contenido
    [elements.mqttModal, elements.simModal].forEach(modal => {
      if (modal) {
        modal.addEventListener('click', (e) => {
          if (e.target === modal) closeModal(modal);
        });
      }
    });

    // Form de Configuración MQTT
    if (elements.formMqttConfig) {
      // Pre-llenar form con valores del cliente
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

    // Eventos de Simulación (Presets según Sección 3 de la Documentación Técnica)
    setupSimulationPresets();
  }

  function setupSimulationPresets() {
    // 1. Simular Baja Tensión (185.3V)
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

    // 2. Simular Desconexión Abrupta / Robo (FOCO_A3, 85ms)
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
          ubicacion: "Pasillo Principal - Luminaria 3"
        };
        window.luminariaMQTT.publish("api/evento", payload);
        closeModal(elements.simModal);
      });
    }

    // 3. Simular Foco Quemado (FOCO_B1, 12.5mA)
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
          ubicacion: "Laboratorio de Electrónica - Luminaria 1"
        };
        window.luminariaMQTT.publish("api/evento", payload);
        closeModal(elements.simModal);
      });
    }

    // 4. Simular Telemetría Normal (220V, 450mA)
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
    // Cambio de estado de la conexión MQTT
    window.luminariaMQTT.onStatusChangeCallback = ({ status, label, isSim }) => {
      elements.mqttStatusDot.className = 'status-dot ' + status;
      elements.mqttStatusText.textContent = label;
    };

    // Recepción de Logs para la Consola
    window.luminariaMQTT.onLogCallback = ({ timestamp, message, type, topic }) => {
      if (!elements.mqttConsoleLog) return;
      const logRow = document.createElement('div');
      logRow.className = `log-entry log-type-${type}`;
      
      let topicTag = topic ? `<span class="log-topic">[${topic}]</span>` : '';
      logRow.innerHTML = `<span class="log-time">[${timestamp}]</span> ${topicTag} <span class="log-payload">${escapeHtml(message)}</span>`;
      
      elements.mqttConsoleLog.prepend(logRow);
      // Limitar a máximo 60 líneas
      if (elements.mqttConsoleLog.children.length > 60) {
        elements.mqttConsoleLog.removeChild(elements.mqttConsoleLog.lastChild);
      }
    };

    // Procesamiento de Eventos JSON recibidos
    window.luminariaMQTT.onMessageCallback = (topic, payloadJson, rawPayload) => {
      processIncomingEvent(payloadJson);
    };
  }

  function processIncomingEvent(event) {
    if (!event || !event.tipo_evento) return;

    const tableroId = event.id_tablero || appState.selectedTableroId;
    if (!appState.tableros[tableroId]) {
      // Crear registro dinámico de tablero si no existe
      appState.tableros[tableroId] = {
        id: tableroId,
        ubicacion: event.ubicacion || 'Ubicación Desconocida',
        tension_v: 220.0,
        focos: {}
      };
      renderTableroSelectOptions();
    }

    const tablero = appState.tableros[tableroId];
    if (event.ubicacion) tablero.ubicacion = event.ubicacion;

    let alertTitle = '';
    let soundType = 'info';

    // 1. BAJA_TENSION
    if (event.tipo_evento === 'BAJA_TENSION') {
      const tension = event.datos?.tension_medida_v || 185.0;
      tablero.tension_v = tension;
      tablero.fase = event.datos?.fase || 'L1';
      alertTitle = `Baja Tensión Detectada: ${tension}V (Umbral: ${event.datos?.umbral_minimo_v || 190}V)`;
      soundType = 'critical';
    }

    // 2. DESCONEXION_ABRUPTA_FOCO
    else if (event.tipo_evento === 'DESCONEXION_ABRUPTA_FOCO') {
      const focoId = event.datos?.id_foco || 'FOCO_DESCONOCIDO';
      if (!tablero.focos[focoId]) {
        tablero.focos[focoId] = { id: focoId, corriente_ma: 0, estado: 'robado' };
      }
      tablero.focos[focoId].corriente_ma = event.datos?.corriente_actual_ma || 0.0;
      tablero.focos[focoId].estado = 'robado';
      alertTitle = `Desconexión Abrupta / Posible Robo: ${focoId} (${event.datos?.tiempo_caida_ms || 0}ms)`;
      soundType = 'critical';
    }

    // 3. FOCO_QUEMADO
    else if (event.tipo_evento === 'FOCO_QUEMADO') {
      const focoId = event.datos?.id_foco || 'FOCO_DESCONOCIDO';
      if (!tablero.focos[focoId]) {
        tablero.focos[focoId] = { id: focoId, corriente_ma: 12.5, estado: 'quemado' };
      }
      tablero.focos[focoId].corriente_ma = event.datos?.corriente_medida_ma || 12.5;
      tablero.focos[focoId].estado = 'quemado';
      alertTitle = `Foco Quemado / Falla Componente: ${focoId} (${event.datos?.corriente_medida_ma}mA)`;
      soundType = 'warning';
    }

    // 4. RESTAURACIÓN / TELEMETRIA_NORMAL
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
        // Restaurar todos
        Object.keys(tablero.focos).forEach(fId => {
          tablero.focos[fId].estado = 'ok';
          tablero.focos[fId].corriente_ma = 450.0;
        });
      }
      alertTitle = `Telemetría Normal Restablecida: Tensión 220V`;
      soundType = 'info';
    }

    // Registrar en el historial de alertas
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

    // Emitir sonido si está activado
    if (appState.soundEnabled) {
      playAlertAudioSound(soundType);
    }

    // Actualizar Vistas UI
    updateTableroUI();
    renderAlerts();
    updateKPIs();
  }

  // ==========================================
  // RENDERIZADO DE INTERFAZ (UI)
  // ==========================================
  function renderTableroSelectOptions() {
    if (!elements.selectTablero) return;
    elements.selectTablero.innerHTML = '';
    Object.keys(appState.tableros).forEach(id => {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = `${id} (${appState.tableros[id].ubicacion})`;
      if (id === appState.selectedTableroId) option.selected = true;
      elements.selectTablero.appendChild(option);
    });
  }

  function updateTableroUI() {
    const tablero = appState.tableros[appState.selectedTableroId];
    if (!tablero) return;

    // Actualizar datos del header del tablero
    if (elements.tableroUbicacion) {
      elements.tableroUbicacion.textContent = tablero.ubicacion;
    }

    // Actualizar Medidor de Tensión
    const tension = tablero.tension_v;
    if (elements.voltageGaugeNum) {
      elements.voltageGaugeNum.textContent = tension.toFixed(1);
      
      // Aplicar color según umbral (190V es el umbral de alerta)
      elements.voltageGaugeNum.className = 'gauge-val-num';
      elements.voltageStatusTag.className = 'badge-tag';

      if (tension < 190.0) {
        elements.voltageGaugeNum.classList.add('critical');
        elements.voltageStatusTag.textContent = 'BAJA TENSIÓN (CRÍTICA)';
        elements.voltageStatusTag.style.background = 'rgba(239, 68, 68, 0.2)';
        elements.voltageStatusTag.style.color = '#ef4444';
      } else if (tension < 210.0) {
        elements.voltageGaugeNum.classList.add('warning');
        elements.voltageStatusTag.textContent = 'TENSIÓN BORDEM';
        elements.voltageStatusTag.style.background = 'rgba(245, 158, 11, 0.2)';
        elements.voltageStatusTag.style.color = '#f59e0b';
      } else {
        elements.voltageStatusTag.textContent = 'RED NORMAL';
        elements.voltageStatusTag.style.background = 'rgba(16, 185, 129, 0.2)';
        elements.voltageStatusTag.style.color = '#10b981';
      }
    }

    if (elements.voltageGaugeFill) {
      // Porcentaje relativo a una escala max de 260V
      const pct = Math.min(Math.max((tension / 250.0) * 100, 0), 100);
      elements.voltageGaugeFill.style.width = `${pct}%`;
      elements.voltageGaugeFill.className = tension < 190.0 ? 'gauge-bar-fill critical' : 'gauge-bar-fill';
    }

    // Renderizar Grid de Focos
    renderFocosGrid(tablero.focos);
  }

  function renderFocosGrid(focos) {
    if (!elements.focosGridContainer) return;
    elements.focosGridContainer.innerHTML = '';

    const focosKeys = Object.keys(focos);
    if (focosKeys.length === 0) {
      elements.focosGridContainer.innerHTML = `<div style="grid-column: 1/-1; color: var(--text-dim); text-align: center; padding: 1rem;">No hay luminarias registradas en este tablero.</div>`;
      return;
    }

    focosKeys.forEach(focoId => {
      const foco = focos[focoId];
      const card = document.createElement('div');
      card.className = `foco-card ${foco.estado}`;

      let estadoText = 'Operativo';
      let icon = 'fa-lightbulb';

      if (foco.estado === 'quemado') {
        estadoText = 'Foco Quemado';
        icon = 'fa-exclamation-triangle';
      } else if (foco.estado === 'robado') {
        estadoText = 'Robo / Desconexión';
        icon = 'fa-bolt';
      } else if (foco.estado === 'inactivo') {
        estadoText = 'Circuito Inactivo';
        icon = 'fa-power-off';
      }

      card.innerHTML = `
        <div class="foco-card-top">
          <span class="foco-id">${foco.id}</span>
          <i class="fas ${icon} foco-bulb-icon"></i>
        </div>
        <div class="foco-metrics">
          <span class="foco-current">${foco.corriente_ma.toFixed(1)} mA</span>
          <span class="foco-status-text">${estadoText}</span>
        </div>
      `;
      elements.focosGridContainer.appendChild(card);
    });
  }

  function renderAlerts() {
    if (!elements.alertsContainer) return;
    elements.alertsContainer.innerHTML = '';

    // Filtrar alertas según tab de filtro
    const filtered = appState.alerts.filter(a => {
      if (appState.activeFilter === 'ALL') return true;
      return a.severidad === appState.activeFilter;
    });

    if (elements.alertsCountBadge) {
      elements.alertsCountBadge.textContent = filtered.length;
    }

    if (filtered.length === 0) {
      elements.alertsContainer.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: var(--text-dim);">
          <i class="fas fa-check-circle" style="font-size: 2rem; margin-bottom: 0.5rem; color: var(--color-ok);"></i>
          <p>No hay alertas registradas para este filtro.</p>
        </div>
      `;
      return;
    }

    filtered.forEach(alert => {
      const card = document.createElement('div');
      card.className = `alert-card ${alert.severidad} ${alert.resuelta ? 'resuelta' : ''}`;

      const timeFormatted = new Date(alert.timestamp).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      // Formatear detalles JSON en pares clave: valor
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

      // Listener para marcar como resuelta
      const btnResolve = card.querySelector('.btn-resolve');
      btnResolve.addEventListener('click', () => {
        alert.resuelta = !alert.resuelta;
        renderAlerts();
        updateKPIs();
      });

      elements.alertsContainer.appendChild(card);
    });
  }

  function updateKPIs() {
    const activeTableros = Object.values(appState.tableros);
    const selectedTablero = appState.tableros[appState.selectedTableroId];

    // 1. Tensión Promedio o Actual
    if (elements.kpiTensionVal && selectedTablero) {
      elements.kpiTensionVal.textContent = `${selectedTablero.tension_v.toFixed(1)}V`;
      elements.kpiTensionSub.textContent = `Fase ${selectedTablero.fase} • Nominal 220V`;
    }

    // 2. Alertas Críticas no resueltas
    const criticasCount = appState.alerts.filter(a => a.severidad === 'CRITICA' && !a.resuelta).length;
    if (elements.kpiAlertasCriticas) {
      elements.kpiAlertasCriticas.textContent = criticasCount;
    }

    // 3. Advertencias no resueltas
    const advertenciasCount = appState.alerts.filter(a => a.severidad === 'ADVERTENCIA' && !a.resuelta).length;
    if (elements.kpiAdvertencias) {
      elements.kpiAdvertencias.textContent = advertenciasCount;
    }

    // 4. Total Focos
    let totalFocosCount = 0;
    let focosOkCount = 0;
    activeTableros.forEach(t => {
      Object.values(t.focos).forEach(f => {
        totalFocosCount++;
        if (f.estado === 'ok') focosOkCount++;
      });
    });

    if (elements.kpiTotalFocos) {
      elements.kpiTotalFocos.textContent = `${focosOkCount}/${totalFocosCount}`;
    }
  }

  // ==========================================
  // SINTETIZADOR DE AUDIO WEBAUDIO API (Sintético)
  // ==========================================
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
        // Tono grave pulsante de alarma
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      } else if (type === 'warning') {
        // Tono suave de advertencia
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      }
    } catch (e) {
      // Ignorar restricciones de autoplay si no hubo interacción previa
    }
  }

  // ==========================================
  // HELPERS UTILS
  // ==========================================
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

  // Inicializar al cargar
  init();
});
