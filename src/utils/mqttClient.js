const mqtt = require("mqtt");

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

const connectClient = () => {
  const options = {
    clientId: `mja-api-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    clean: true,
    connectTimeout: Number(process.env.MQTT_CONNECT_TIMEOUT_MS) || 5000,
    reconnectPeriod: 0,
  };

  if (process.env.MQTT_USERNAME) {
    options.username = process.env.MQTT_USERNAME;
  }

  if (process.env.MQTT_PASSWORD) {
    options.password = process.env.MQTT_PASSWORD;
  }

  return mqtt.connect(getMqttUrl(), options);
};

const publishAndWaitAck = ({ topic, ackTopic, payload, requestId, timeoutMs }) => {
  const client = connectClient();
  const ackTimeoutMs = Number(timeoutMs || process.env.MQTT_ACK_TIMEOUT_MS) || 10000;

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
      fail(new Error("ACK mesin tidak diterima"));
    }, ackTimeoutMs);

    client.on("connect", () => {
      client.subscribe(ackTopic, { qos: 1 }, (subscribeError) => {
        if (subscribeError) {
          fail(subscribeError);
          return;
        }

        client.publish(topic, JSON.stringify(payload), { qos: 1, retain: false }, (publishError) => {
          if (publishError) {
            fail(publishError);
          }
        });
      });
    });

    client.on("message", (receivedTopic, message) => {
      if (receivedTopic !== ackTopic) {
        return;
      }

      const ackPayload = parseAckMessage(message);
      const ackSuccess = isAckSuccess(ackPayload, requestId);
      if (ackSuccess === null) {
        return;
      }

      if (!ackSuccess) {
        fail(new Error("ACK mesin gagal"));
        return;
      }

      succeed(ackPayload);
    });

    client.on("error", fail);
    client.on("close", () => {
      if (!settled) {
        fail(new Error("Koneksi MQTT terputus"));
      }
    });
  });
};

module.exports = {
  publishAndWaitAck,
};
