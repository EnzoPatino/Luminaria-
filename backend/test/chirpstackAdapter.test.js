const test = require('node:test');
const assert = require('node:assert/strict');

const {
  adaptChirpstackUplink,
  unwrapChirpstackUplink,
} = require('../src/services/chirpstackAdapter');

function chirpstackRecord(publishedAt, corrienteMa) {
  return {
    type: 'up',
    payload: {
      applicationID: '6',
      deviceName: 'SHIELD',
      devEUI: 'JOEkdG45IkI=',
      fPort: 1,
      fCnt: 17761,
      data: Buffer.from([(corrienteMa >> 8) & 0xff, corrienteMa & 0xff]).toString('base64'),
      objectJSON: JSON.stringify({ corriente_A: corrienteMa / 1000, corriente_mA: corrienteMa }),
      rxInfo: [{ rssi: -117, loRaSNR: -14.5 }],
      publishedAt,
    },
  };
}

test('adapta el formato type/payload exportado por ChirpStack', () => {
  const record = chirpstackRecord('2026-11-10T12:08:31.466976299Z', 1120);
  const { normalizedEvent, meta } = adaptChirpstackUplink(record);

  assert.equal(normalizedEvent.id_tablero, 'TABLERO_01');
  assert.equal(normalizedEvent.tipo_evento, 'SOBRECORRIENTE');
  assert.equal(normalizedEvent.datos.corriente_medida_ma, 1120);
  assert.equal(normalizedEvent.datos.rssi_lora, -117);
  assert.equal(meta.snr, -14.5);
  assert.equal(normalizedEvent.timestamp, '2026-11-10T12:08:31.466Z');
});

test('en un lote elige el uplink más reciente', () => {
  const oldRecord = chirpstackRecord('2026-11-10T12:07:58.945759493Z', 1083);
  const latestRecord = chirpstackRecord('2026-11-10T12:08:31.466976299Z', 1120);
  const { body, eventType } = unwrapChirpstackUplink([oldRecord, latestRecord]);

  assert.equal(eventType, 'up');
  assert.equal(body.publishedAt, latestRecord.payload.publishedAt);
});
