const net = require('net');
const tls = require('tls');
const { EventEmitter } = require('events');

function encodeRemainingLength(length) {
  const bytes = [];
  let value = length;

  do {
    let encodedByte = value % 128;
    value = Math.floor(value / 128);
    if (value > 0) encodedByte |= 128;
    bytes.push(encodedByte);
  } while (value > 0);

  return Buffer.from(bytes);
}

function encodeString(value) {
  const payload = Buffer.from(String(value), 'utf8');
  const length = Buffer.alloc(2);
  length.writeUInt16BE(payload.length, 0);
  return Buffer.concat([length, payload]);
}

function readString(buffer, offset) {
  if (offset + 2 > buffer.length) {
    throw new Error('Paquete MQTT incompleto al leer string.');
  }

  const length = buffer.readUInt16BE(offset);
  const start = offset + 2;
  const end = start + length;

  if (end > buffer.length) {
    throw new Error('Paquete MQTT incompleto al leer payload de string.');
  }

  return {
    value: buffer.subarray(start, end).toString('utf8'),
    offset: end,
  };
}

function buildPacket(type, flags, body = Buffer.alloc(0)) {
  return Buffer.concat([
    Buffer.from([(type << 4) | flags]),
    encodeRemainingLength(body.length),
    body,
  ]);
}

class MqttTcpClient extends EventEmitter {
  constructor(options) {
    super();

    this.options = {
      host: options.host,
      port: options.port,
      clientId: options.clientId,
      username: options.username || '',
      password: options.password || '',
      topics: options.topics || [],
      qos: options.qos || 0,
      keepAliveSeconds: options.keepAliveSeconds || 60,
      reconnectMs: options.reconnectMs || 5000,
      connectTimeoutMs: options.connectTimeoutMs || 10000,
      useTls: Boolean(options.useTls),
    };

    this.socket = null;
    this.buffer = Buffer.alloc(0);
    this.connected = false;
    this.stopped = true;
    this.packetId = 1;
    this.pingTimer = null;
    this.reconnectTimer = null;
  }

  start() {
    if (!this.stopped) return;

    this.stopped = false;
    this.connect();
  }

  stop() {
    this.stopped = true;
    this.clearTimers();

    if (this.socket && !this.socket.destroyed) {
      // Seccion: cierre ordenado MQTT para no dejar sesiones colgadas en Mosquitto.
      this.socket.write(buildPacket(14, 0));
      this.socket.end();
    }
  }

  connect() {
    this.clearReconnectTimer();

    const socketFactory = this.options.useTls ? tls.connect : net.connect;
    const socket = socketFactory({
      host: this.options.host,
      port: this.options.port,
      servername: this.options.host,
    });

    this.socket = socket;
    this.buffer = Buffer.alloc(0);

    socket.setTimeout(this.options.connectTimeoutMs, () => {
      socket.destroy(new Error('Timeout conectando al broker MQTT.'));
    });

    const readyEvent = this.options.useTls ? 'secureConnect' : 'connect';
    socket.once(readyEvent, () => {
      socket.setTimeout(0);
      this.sendConnectPacket();
    });

    socket.on('data', (chunk) => this.handleData(chunk));
    socket.on('error', (error) => this.emit('error', error));
    socket.on('close', () => this.handleClose());
  }

  sendConnectPacket() {
    const flags = 0x02
      | (this.options.username ? 0x80 : 0)
      | (this.options.password ? 0x40 : 0);

    const keepAlive = Buffer.alloc(2);
    keepAlive.writeUInt16BE(this.options.keepAliveSeconds, 0);

    const variableHeader = Buffer.concat([
      encodeString('MQTT'),
      Buffer.from([4, flags]),
      keepAlive,
    ]);

    const payloadParts = [encodeString(this.options.clientId)];
    if (this.options.username) payloadParts.push(encodeString(this.options.username));
    if (this.options.password) payloadParts.push(encodeString(this.options.password));

    this.writePacket(buildPacket(1, 0, Buffer.concat([
      variableHeader,
      ...payloadParts,
    ])));
  }

  subscribeToTopics() {
    this.options.topics.forEach((topic) => {
      const packetId = this.nextPacketId();
      const header = Buffer.alloc(2);
      header.writeUInt16BE(packetId, 0);

      const payload = Buffer.concat([
        encodeString(topic),
        Buffer.from([this.options.qos]),
      ]);

      this.writePacket(buildPacket(8, 2, Buffer.concat([header, payload])));
      this.emit('subscribe', { topic, qos: this.options.qos, packetId });
    });
  }

  handleData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);

    while (this.buffer.length >= 2) {
      const firstByte = this.buffer[0];
      const decoded = this.decodeRemainingLength(this.buffer);
      if (!decoded) return;

      const packetEnd = decoded.offset + decoded.length;
      if (this.buffer.length < packetEnd) return;

      const body = this.buffer.subarray(decoded.offset, packetEnd);
      try {
        this.handlePacket(firstByte, body);
      } catch (error) {
        this.emit('error', error);
        this.socket.destroy(error);
        return;
      }
      this.buffer = this.buffer.subarray(packetEnd);
    }
  }

  decodeRemainingLength(buffer) {
    let multiplier = 1;
    let value = 0;
    let offset = 1;
    let encodedByte = 0;

    do {
      if (offset >= buffer.length) return null;

      encodedByte = buffer[offset];
      value += (encodedByte & 127) * multiplier;
      multiplier *= 128;
      offset += 1;

      if (multiplier > 128 * 128 * 128 * 128) {
        this.socket.destroy(new Error('Remaining length MQTT invalido.'));
        return null;
      }
    } while ((encodedByte & 128) !== 0);

    return { length: value, offset };
  }

  handlePacket(firstByte, body) {
    const type = firstByte >> 4;

    if (type === 2) return this.handleConnack(body);
    if (type === 3) return this.handlePublish(firstByte, body);
    if (type === 9) return this.emit('suback', body);
    if (type === 13) return this.emit('pingresp');

    return this.emit('packet', { type, length: body.length });
  }

  handleConnack(body) {
    if (body.length < 2 || body[1] !== 0) {
      const code = body.length >= 2 ? body[1] : 'unknown';
      this.socket.destroy(new Error(`CONNACK MQTT rechazado con codigo ${code}.`));
      return;
    }

    this.connected = true;
    this.emit('connect');
    this.subscribeToTopics();
    this.startPingLoop();
  }

  handlePublish(firstByte, body) {
    const qos = (firstByte & 0x06) >> 1;
    const dup = Boolean(firstByte & 0x08);
    const retain = Boolean(firstByte & 0x01);
    let cursor = 0;

    const topicInfo = readString(body, cursor);
    const topic = topicInfo.value;
    cursor = topicInfo.offset;

    let packetId = null;
    if (qos > 0) {
      if (cursor + 2 > body.length) {
        throw new Error('Paquete PUBLISH MQTT incompleto al leer packetId.');
      }
      packetId = body.readUInt16BE(cursor);
      cursor += 2;
    }

    const payload = body.subarray(cursor);
    this.emit('message', topic, payload, { qos, dup, retain, packetId });

    if (qos === 1 && packetId !== null) {
      this.sendPuback(packetId);
    }
  }

  sendPuback(packetId) {
    const body = Buffer.alloc(2);
    body.writeUInt16BE(packetId, 0);
    this.writePacket(buildPacket(4, 0, body));
  }

  startPingLoop() {
    this.clearPingTimer();

    // Seccion: keepalive para detectar cortes silenciosos del broker o la red.
    this.pingTimer = setInterval(() => {
      if (this.socket && !this.socket.destroyed) {
        this.writePacket(buildPacket(12, 0));
      }
    }, Math.max(1, Math.floor(this.options.keepAliveSeconds / 2)) * 1000);
  }

  handleClose() {
    this.connected = false;
    this.clearPingTimer();
    this.emit('close');

    if (!this.stopped) {
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => {
      this.emit('reconnect');
      this.connect();
    }, this.options.reconnectMs);
  }

  writePacket(packet) {
    if (this.socket && !this.socket.destroyed) {
      this.socket.write(packet);
    }
  }

  nextPacketId() {
    const current = this.packetId;
    this.packetId += 1;
    if (this.packetId > 65535) this.packetId = 1;
    return current;
  }

  clearPingTimer() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  clearTimers() {
    this.clearPingTimer();
    this.clearReconnectTimer();
  }
}

module.exports = { MqttTcpClient };
