const mqtt = require("mqtt");
const logger = require("./logger");

const isMqttDebugEnabled = () => String(process.env.MQTT_DEBUG || "").toLowerCase() === "true";

const getMqttUrl = () => {
  const protocol = process.env.MQTT_PROTOCOL || "mqtt";
  const host = process.env.MQTT_HOST;
  const port = process.env.MQTT_PORT || 1883;

  if (!host) {
    throw new Error("Konfigurasi MQTT belum lengkap");
  }

  return `${protocol}://${host}:${port}`;
};

const parseAckMessage = (message) => {
  const rawMessage = message.toString();

  try {
    return JSON.parse(rawMessage);
  } catch (error) {
    return rawMessage;
  }
};

const isAckSuccess = (ackPayload, requestId) => {
  if (ackPayload && typeof ackPayload === "object") {
    if (ackPayload.requestId && ackPayload.requestId !== requestId) {
      return null;
    }

    if (ackPayload.success === false) {
      return false;
    }

    const status = ackPayload.status || ackPayload.result || ackPayload.statusPerintah;
    if (!status) {
      return true;
    }

    return ["success", "ok", "on", "ack"].includes(String(status).toLowerCase());
  }

  return ["success", "ok", "on", "ack"].includes(String(ackPayload).toLowerCase());
};

const connectClient = (clientOptions = {}) => {
  const options = {
    clientId: `${clientOptions.clientIdPrefix || "mja-api"}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    clean: clientOptions.clean ?? true,
    connectTimeout: Number(process.env.MQTT_CONNECT_TIMEOUT_MS) || 5000,
    reconnectPeriod: clientOptions.reconnectPeriod ?? 0,
  };

  if (process.env.MQTT_USERNAME) {
    options.username = process.env.MQTT_USERNAME;
  }

  if (process.env.MQTT_PASSWORD) {
    options.password = process.env.MQTT_PASSWORD;
  }

  return mqtt.connect(getMqttUrl(), options);
};

const publishAndWaitAck = ({
  topic,
  ackTopic,
  payload,
  requestId,
  timeoutMs,
  clientFactory = connectClient,
  logger: mqttLogger = logger,
}) => {
  const client = clientFactory();
  const ackTimeoutMs = Number(timeoutMs || process.env.MQTT_ACK_TIMEOUT_MS) || 10000;
  const mqttDebug = isMqttDebugEnabled();
  const subscribeTopics = mqttDebug
    ? [ackTopic, ackTopic.split("/").slice(0, 2).join("/") + "/#"]
    : ackTopic;

  return new Promise((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      clearTimeout(timer);
      client.removeAllListeners();
      client.end(true);
    };

    const fail = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    const succeed = (ackPayload) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(ackPayload);
    };

    const timer = setTimeout(() => {
      mqttLogger.error({
        topic,
        ackTopic,
        requestId,
        timeoutMs: ackTimeoutMs,
      }, "[MQTT] ACK timeout");
      fail(new Error("ACK mesin tidak diterima"));
    }, ackTimeoutMs);

    client.on("connect", () => {
      if (mqttDebug) {
        mqttLogger.info({
          mqttUrl: getMqttUrl(),
          ackTopic,
          subscribeTopics,
          requestId,
        }, "[MQTT] Connected");
      }

      client.subscribe(subscribeTopics, { qos: 1 }, (subscribeError) => {
        if (subscribeError) {
          mqttLogger.error({
            ackTopic,
            subscribeTopics,
            requestId,
            error: subscribeError.message,
          }, "[MQTT] Subscribe ACK topic failed");
          fail(subscribeError);
          return;
        }

        if (mqttDebug) {
          mqttLogger.info({ ackTopic, requestId }, "[MQTT] Subscribed ACK topic");
          mqttLogger.info({ topic, payload }, "[MQTT] Publish command");
        }

        client.publish(topic, JSON.stringify(payload), { qos: 1, retain: false }, (publishError) => {
          if (publishError) {
            mqttLogger.error({
              topic,
              requestId,
              error: publishError.message,
            }, "[MQTT] Publish command failed");
            fail(publishError);
          }
        });
      });
    });

    client.on("message", (receivedTopic, message) => {
      const ackPayload = parseAckMessage(message);
      if (receivedTopic !== ackTopic) {
        if (mqttDebug) {
          mqttLogger.info({
            receivedTopic,
            expectedAckTopic: ackTopic,
            ackPayload,
          }, "[MQTT] Ignored message from non-ACK topic");
        }
        return;
      }

      const ackSuccess = isAckSuccess(ackPayload, requestId);
      if (ackSuccess === null) {
        if (mqttDebug) {
          mqttLogger.info({
            ackTopic,
            expectedRequestId: requestId,
            ackPayload,
          }, "[MQTT] Ignored ACK with different requestId");
        }
        return;
      }

      if (!ackSuccess) {
        mqttLogger.error({ ackTopic, requestId, ackPayload }, "[MQTT] ACK failed");
        fail(new Error("ACK mesin gagal"));
        return;
      }

      if (mqttDebug) {
        mqttLogger.info({ ackTopic, requestId, ackPayload }, "[MQTT] ACK received");
      }
      succeed(ackPayload);
    });

    client.on("error", (error) => {
      mqttLogger.error({
        topic,
        ackTopic,
        requestId,
        error: error.message,
      }, "[MQTT] Client error");
      fail(error);
    });

    client.on("close", () => {
      if (!settled) {
        mqttLogger.error({ topic, ackTopic, requestId }, "[MQTT] Connection closed before ACK");
        fail(new Error("Koneksi MQTT terputus"));
      }
    });
  });
};

module.exports = {
  connectClient,
  getMqttUrl,
  isMqttDebugEnabled,
  publishAndWaitAck,
};
