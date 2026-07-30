const assert = require("node:assert/strict");
const test = require("node:test");
const { createGracefulShutdown, registerGracefulShutdown } = require("../src/server");
const { startMqttStatusListener, stopMqttStatusListener } = require("../src/utils/mqttStatusListener");

test("MQTT status listener can stop once and be started again", async () => {
  const events = [];
  const client = {
    on() {},
    removeAllListeners() {
      events.push("removeAllListeners");
    },
    end(force, callback) {
      events.push(`end:${force}`);
      callback();
    },
  };

  assert.equal(startMqttStatusListener({ clientFactory: () => client }), client);
  assert.equal(await stopMqttStatusListener(), true);
  assert.equal(await stopMqttStatusListener(), false);
  assert.deepEqual(events, ["removeAllListeners", "end:true"]);
  assert.equal(startMqttStatusListener({ clientFactory: () => client }), client);
  await stopMqttStatusListener();
});

test("graceful shutdown closes HTTP, MQTT, and database once before exit", async () => {
  const events = [];
  const shutdown = createGracefulShutdown({
    server: {
      listening: true,
      close(callback) {
        events.push("http");
        callback();
      },
    },
    stopListener: async () => {
      events.push("mqtt");
    },
    pool: {
      async end() {
        events.push("database");
      },
    },
    exit(code) {
      events.push(`exit:${code}`);
    },
    logger: { info() {}, error() {} },
  });

  await shutdown("SIGTERM");
  await shutdown("SIGINT");

  assert.deepEqual(events, ["http", "mqtt", "database", "exit:0"]);
});

test("graceful shutdown registers SIGTERM and SIGINT handlers", () => {
  const registeredSignals = [];
  registerGracefulShutdown(() => {}, {
    once(signal) {
      registeredSignals.push(signal);
    },
  });

  assert.deepEqual(registeredSignals, ["SIGTERM", "SIGINT"]);
});
