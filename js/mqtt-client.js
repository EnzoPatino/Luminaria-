/**
 * Project Luminaria - Cliente MQTT para Mosquitto (WebSocket)
 * Municipalidad de Neuquén
 * Manejador de comunicación MQTT con fallback a modo simulación
 */

class LuminariaMQTTClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.isSimulationMode = true; // Por defecto inicia en modo simulación
    
    // Configuración por defecto de Mosquitto MQTT en local
    this.config = {
      host: 'localhost',
      port: 9001,          // Puerto estándar de Mosquitto con WebSockets activado
      path: '/mqtt',
      clientId: 'luminaria_web_' + Math.random().toString(16).substring(2, 8),
      topics: ['neuquen/iluminacion/#', 'api/evento'],
      qos: 1,
      keepAlive: 60,
      cleanSession: true,
      username: '',
      password: ''
    };

    // Callbacks
    this.onStatusChangeCallback = null;
    this.onMessageCallback = null;
    this.onLogCallback = null;

    // Cargar configuración guardada
    this.loadSavedConfig();
  }

  loadSavedConfig() {
    try {
      const saved = localStorage.getItem('luminaria_mqtt_config');
      if (saved) {
        this.config = { ...this.config, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('No se pudo cargar la configuración guardada de MQTT:', e);
    }
  }

  saveConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    try {
      localStorage.setItem('luminaria_mqtt_config', JSON.stringify(this.config));
    } catch (e) {
      console.warn('No se pudo guardar la configuración MQTT:', e);
    }
  }

  log(message, type = 'info', topic = '') {
    const timestamp = new Date().toLocaleTimeString('es-AR');
    console.log(`[MQTT ${type.toUpperCase()}] ${timestamp} ${topic ? '| ' + topic : ''}:`, message);
    if (this.onLogCallback) {
      this.onLogCallback({ timestamp, message, type, topic });
    }
  }

  connect(configOverride = null) {
    if (configOverride) {
      this.saveConfig(configOverride);
    }

    if (typeof Paho === 'undefined' || !Paho.MQTT) {
      this.log('Librería Paho MQTT no detectada en el navegador. Activando modo simulación.', 'warning');
      this.enableSimulationMode('Paho MQTT no disponible');
      return;
    }

    try {
      this.log(`Conectando a broker Mosquitto en ws://${this.config.host}:${this.config.port}${this.config.path}...`, 'info');
      this.notifyStatusChange('connecting', 'Conectando a Mosquitto...');

      this.client = new Paho.MQTT.Client(
        this.config.host,
        Number(this.config.port),
        this.config.path,
        this.config.clientId
      );

      // Definir callbacks nativos de Paho
      this.client.onConnectionLost = (responseObject) => this.handleConnectionLost(responseObject);
      this.client.onMessageArrived = (message) => this.handleMessageArrived(message);

      const connectOptions = {
        timeout: 5,
        keepAliveInterval: this.config.keepAlive,
        cleanSession: this.config.cleanSession,
        onSuccess: () => this.handleConnectSuccess(),
        onFailure: (err) => this.handleConnectFailure(err)
      };

      if (this.config.username) {
        connectOptions.userName = this.config.username;
        connectOptions.password = this.config.password || '';
      }

      this.client.connect(connectOptions);
    } catch (err) {
      this.log(`Error al inicializar cliente MQTT: ${err.message}`, 'error');
      this.enableSimulationMode(`Error de conexión: ${err.message}`);
    }
  }

  handleConnectSuccess() {
    this.isConnected = true;
    this.isSimulationMode = false;
    this.log(`¡Conectado exitosamente a Mosquitto MQTT! ClientID: ${this.config.clientId}`, 'success');
    this.notifyStatusChange('connected', `Conectado a ${this.config.host}:${this.config.port}`);

    // Suscribir a topics configurados
    this.config.topics.forEach(topic => {
      if (topic.trim()) {
        this.subscribe(topic.trim());
      }
    });
  }

  handleConnectFailure(error) {
    this.isConnected = false;
    const errMsg = error.errorMessage || error.message || 'Broker no accesible';
    this.log(`Fallo al conectar con Mosquitto: ${errMsg}`, 'error');
    this.enableSimulationMode(`Fallo de conexión (${errMsg}). Modo simulación activado.`);
  }

  handleConnectionLost(responseObject) {
    this.isConnected = false;
    if (responseObject.errorCode !== 0) {
      this.log(`Conexión perdida con Mosquitto: ${responseObject.errorMessage}`, 'error');
      this.enableSimulationMode('Conexión perdida con broker. Reintentando o usando simulación.');
    }
  }

  handleMessageArrived(message) {
    const topic = message.destinationName;
    const payloadStr = message.payloadString;
    this.log(`Mensaje recibido [${topic}]: ${payloadStr}`, 'incoming', topic);

    try {
      const payloadJson = JSON.parse(payloadStr);
      if (this.onMessageCallback) {
        this.onMessageCallback(topic, payloadJson, payloadStr);
      }
    } catch (e) {
      this.log(`Payload no es un JSON válido: ${payloadStr}`, 'warning', topic);
      if (this.onMessageCallback) {
        this.onMessageCallback(topic, { raw: payloadStr }, payloadStr);
      }
    }
  }

  subscribe(topic) {
    if (!this.client || !this.isConnected) {
      this.log(`No se puede suscribir a "${topic}": Sin conexión a Mosquitto`, 'warning');
      return;
    }
    try {
      this.client.subscribe(topic, { qos: this.config.qos });
      this.log(`Suscrito exitosamente al topic: ${topic} (QoS ${this.config.qos})`, 'info', topic);
    } catch (e) {
      this.log(`Error al suscribir a ${topic}: ${e.message}`, 'error');
    }
  }

  publish(topic, jsonPayload) {
    const payloadString = typeof jsonPayload === 'string' ? jsonPayload : JSON.stringify(jsonPayload);
    
    if (this.isConnected && this.client) {
      try {
        const message = new Paho.MQTT.Message(payloadString);
        message.destinationName = topic;
        message.qos = this.config.qos;
        this.client.send(message);
        this.log(`Publicado en [${topic}]: ${payloadString}`, 'outgoing', topic);
      } catch (e) {
        this.log(`Error al publicar mensaje: ${e.message}`, 'error', topic);
      }
    } else {
      // Si está en simulación, procesar directo internamente
      this.log(`[SIMULACIÓN] Evento emitido localmente en [${topic}]: ${payloadString}`, 'simulated', topic);
      try {
        const payloadJson = JSON.parse(payloadString);
        if (this.onMessageCallback) {
          this.onMessageCallback(topic, payloadJson, payloadString);
        }
      } catch (e) {
        console.error('Error parseando JSON de simulación:', e);
      }
    }
  }

  disconnect() {
    if (this.client && this.isConnected) {
      try {
        this.client.disconnect();
      } catch (e) {
        console.warn('Error durante desconexión:', e);
      }
    }
    this.isConnected = false;
    this.enableSimulationMode('Desconectado manualmente');
  }

  enableSimulationMode(reason = 'Modo Simulación') {
    this.isSimulationMode = true;
    this.isConnected = false;
    this.log(`Modo Simulación Activo (${reason})`, 'simulated');
    this.notifyStatusChange('simulating', 'Modo Simulación Activo');
  }

  notifyStatusChange(status, label) {
    if (this.onStatusChangeCallback) {
      this.onStatusChangeCallback({ status, label, config: this.config, isSim: this.isSimulationMode });
    }
  }
}

// Instancia global accesible
window.luminariaMQTT = new LuminariaMQTTClient();
