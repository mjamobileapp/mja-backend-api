const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const test = require("node:test");
const { publishAndWaitAck } = require("../src/utils/mqttClient");
const {
  createPendingTransactionMessageHandler,
  createStatusMessageHandler,
  startMqttStatusListener,
  stopMqttStatusListener,
} = require("../src/utils/mqttStatusListener");

const silentLogger = { log() {}, error() {} };
const waitForAsyncHandler = () =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

class FakeMqttClient extends EventEmitter {
  constructor({ onPublish } = {}) {
    super();
    this.onPublish = onPublish;
    this.subscriptions = [];
    this.endCalls = [];
  }

  subscribe(topic, options, callback) {
    this.subscriptions.push({ topic, options });
    callback(null);
  }

  publish(topic, payload, options, callback) {
    this.onPublish?.({ topic, payload: JSON.parse(payload), options });
    callback?.(null);
  }

  end(force, callback) {
    this.endCalls.push(force);
    callback?.();
  }
}

const runFakeAck = ({ onPublish, timeoutMs = 25 }) => {
  const client = new FakeMqttClient({ onPublish });
  const result = publishAndWaitAck({
    topic: "modul/ESP-001/WASHER/on",
    ackTopic: "modul/ESP-001/WASHER/ack",
    payload: { command: "ON", requestId: "request-1" },
    requestId: "request-1",
    timeoutMs,
    clientFactory: () => {
      queueMicrotask(() => client.emit("connect"));
      return client;
    },
    logger: silentLogger,
  });

  return { client, result };
};

test("fake MQTT resolves a matching success ACK", async () => {
  const { client, result } = runFakeAck({
    onPublish: () => {
      queueMicrotask(() => {
        client.emit("message", "modul/ESP-001/WASHER/ack", Buffer.from('{"requestId":"request-1","status":"ok"}'));
      });
    },
  });

  assert.deepEqual(await result, { requestId: "request-1", status: "ok" });
  assert.deepEqual(client.endCalls, [true]);
});

test("fake MQTT ignores a wrong request ID until the matching ACK arrives", async () => {
  const { client, result } = runFakeAck({
    onPublish: () => {
      queueMicrotask(() => {
        client.emit("message", "modul/ESP-001/WASHER/ack", Buffer.from('{"requestId":"other-request","status":"ok"}'));
        client.emit("message", "modul/ESP-001/WASHER/ack", Buffer.from('{"requestId":"request-1","status":"ok"}'));
      });
    },
  });

  assert.deepEqual(await result, { requestId: "request-1", status: "ok" });
  assert.deepEqual(client.endCalls, [true]);
});

test("fake MQTT rejects a negative ACK", async () => {
  const { client, result } = runFakeAck({
    onPublish: () => {
      queueMicrotask(() => {
        client.emit("message", "modul/ESP-001/WASHER/ack", Buffer.from('{"requestId":"request-1","success":false}'));
      });
    },
  });

  await assert.rejects(result, /ACK mesin gagal/);
  assert.deepEqual(client.endCalls, [true]);
});

test("fake MQTT rejects when ACK times out", async () => {
  const { client, result } = runFakeAck({ onPublish: () => {}, timeoutMs: 10 });

  await assert.rejects(result, /ACK mesin tidak diterima/);
  assert.deepEqual(client.endCalls, [true]);
});

test("fake MQTT rejects when the connection closes before ACK", async () => {
  const { client, result } = runFakeAck({
    onPublish: () => {
      queueMicrotask(() => client.emit("close"));
    },
  });

  await assert.rejects(result, /Koneksi MQTT terputus/);
  assert.deepEqual(client.endCalls, [true]);
});

test("fake MQTT status listener updates READY only for a valid status topic and payload", async () => {
  const client = new FakeMqttClient();
  const updates = [];
  const messageHandler = createStatusMessageHandler({
    updateReady: async (params) => {
      updates.push(params);
      return 1;
    },
    logger: silentLogger,
  });

  try {
    assert.equal(
      startMqttStatusListener({ clientFactory: () => client, messageHandler, logger: silentLogger }),
      client
    );
    client.emit("connect");
    assert.deepEqual(client.subscriptions, [{
      topic: ["modul/+/status", "modul/+/pendingTransaksi"],
      options: { qos: 1 },
    }]);

    client.emit("message", "modul/ESP-READY/status", Buffer.from('{"status":"READY","machineType":"dryer"}'));
    await waitForAsyncHandler();
    assert.deepEqual(updates, [{ espId: "ESP-READY", machineType: "DRYER" }]);

    client.emit("message", "modul/ESP-READY/other", Buffer.from('{"status":"READY"}'));
    client.emit("message", "modul/ESP-READY/status", Buffer.from('{"status":"IN_USE"}'));
    await waitForAsyncHandler();
    assert.equal(updates.length, 1);
  } finally {
    await stopMqttStatusListener();
  }
});

test("pending transaction listener recovers dryer transaction from MQTT payload", async () => {
  const recoveries = [];
  const messageHandler = createPendingTransactionMessageHandler({
    recoverPending: async (params) => {
      recoveries.push(params);
      return { invoiceNumber: "INV-1-20260718-0001" };
    },
    logger: silentLogger,
  });

  await messageHandler(
    "modul/ESP-READY/pendingTransaksi",
    Buffer.from('{"requestId":"INV-1-20260718-0001-10-12345","status":"READY","machineType":"DRYER"}')
  );

  assert.deepEqual(recoveries, [{
    espId: "ESP-READY",
    requestId: "INV-1-20260718-0001-10-12345",
    machineType: "DRYER",
  }]);
});
