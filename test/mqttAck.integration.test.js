require("dotenv").config();

const assert = require("node:assert/strict");
const mqtt = require("mqtt");
const test = require("node:test");
const { publishAndWaitAck } = require("../src/utils/mqttClient");

const shouldRun = String(process.env.RUN_REMOTE_MQTT_TEST || "").toLowerCase() === "true";
const mqttTest = shouldRun ? test : test.skip;

const waitForConnectAndSubscribe = (client, topic) =>
  new Promise((resolve, reject) => {
    client.once("error", reject);
    client.once("connect", () => client.subscribe(topic, { qos: 1 }, (error) => (error ? reject(error) : resolve())));
  });

mqttTest("publishAndWaitAck resolves only after matching ACK on isolated topic", async () => {
  const previous = { ...process.env };
  process.env.MQTT_HOST = process.env.MQTT_TEST_HOST || "148.230.102.45";
  process.env.MQTT_PORT = process.env.MQTT_TEST_PORT || "1908";
  process.env.MQTT_PROTOCOL = "mqtt";
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const commandTopic = `refactor-test/${suffix}/command`;
  const ackTopic = `refactor-test/${suffix}/ack`;
  const device = mqtt.connect(`${process.env.MQTT_PROTOCOL}://${process.env.MQTT_HOST}:${process.env.MQTT_PORT}`, {
    username: process.env.MQTT_USERNAME || undefined,
    password: process.env.MQTT_PASSWORD || undefined,
    reconnectPeriod: 0,
  });

  try {
    await waitForConnectAndSubscribe(device, commandTopic);
    device.on("message", (topic, message) => {
      if (topic !== commandTopic) return;
      const command = JSON.parse(message.toString());
      device.publish(ackTopic, JSON.stringify({ requestId: command.requestId, status: "ok" }), { qos: 1 });
    });

    const result = await publishAndWaitAck({
      topic: commandTopic,
      ackTopic,
      payload: { command: "TEST", requestId: suffix },
      requestId: suffix,
      timeoutMs: 10000,
    });

    assert.equal(result.requestId, suffix);
  } finally {
    device.end(true);
    Object.assign(process.env, previous);
  }
});
