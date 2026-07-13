const dbPool = require("../config/database");
const { connectClient, isMqttDebugEnabled } = require("./mqttClient");

const STATUS_TOPIC = "modul/+/status";
let statusListenerClient = null;

const parseStatusTopic = (topic) => {
  const parts = String(topic || "").split("/");

  if (parts.length !== 3 || parts[0] !== "modul" || parts[2] !== "status") {
    return null;
  }

  return {
    espId: parts[1],
  };
};

const parseStatusPayload = (message) => {
  try {
    return JSON.parse(message.toString());
  } catch (error) {
    return null;
  }
};

const updateMesinReadyByEspId = async ({ espId, machineType = null }) => {
  const params = [espId];
  let machineFilter = "";

  if (machineType) {
    machineFilter = " AND d.jenisMesin = ?";
    params.push(machineType);
  }

  const [result] = await dbPool.execute(
    `UPDATE tbl_mesin_detail d
     JOIN tbl_mesin_master m ON d.idMesinMaster = m.id
     SET d.status = 'READY'
     WHERE m.espId = ?
       AND m.statusAktif = 1${machineFilter}`,
    params
  );

  return result.affectedRows || 0;
};

const handleStatusMessage = async (topic, message) => {
  const topicData = parseStatusTopic(topic);
  if (!topicData) return;

  const payload = parseStatusPayload(message);
  if (!payload || String(payload.status || "").toUpperCase() !== "READY") {
    return;
  }

  const machineType = payload.machineType ? String(payload.machineType).toUpperCase() : null;
  const affectedRows = await updateMesinReadyByEspId({
    espId: topicData.espId,
    machineType,
  });

  console.log("[MQTT STATUS] Mesin READY diterima", {
    espId: topicData.espId,
    machineType: machineType || "ALL",
    affectedRows,
  });
};

const startMqttStatusListener = ({ clientFactory = connectClient } = {}) => {
  if (statusListenerClient) {
    return statusListenerClient;
  }

  try {
    statusListenerClient = clientFactory({
      clientIdPrefix: "mja-api-status-listener",
      reconnectPeriod: Number(process.env.MQTT_RECONNECT_PERIOD_MS) || 5000,
    });
  } catch (error) {
    console.error("[MQTT STATUS] Listener tidak bisa dimulai:", error.message);
    return null;
  }

  statusListenerClient.on("connect", () => {
    statusListenerClient.subscribe(STATUS_TOPIC, { qos: 1 }, (error) => {
      if (error) {
        console.error("[MQTT STATUS] Gagal subscribe topic status:", error.message);
        return;
      }

      console.log("[MQTT STATUS] Subscribed:", STATUS_TOPIC);
    });
  });

  statusListenerClient.on("message", (topic, message) => {
    handleStatusMessage(topic, message).catch((error) => {
      console.error("[MQTT STATUS] Gagal memproses status mesin:", {
        topic,
        error: error.message,
      });
    });
  });

  statusListenerClient.on("error", (error) => {
    console.error("[MQTT STATUS] Client error:", error.message);
  });

  statusListenerClient.on("reconnect", () => {
    if (isMqttDebugEnabled()) {
      console.log("[MQTT STATUS] Reconnecting...");
    }
  });

  statusListenerClient.on("close", () => {
    if (isMqttDebugEnabled()) {
      console.log("[MQTT STATUS] Connection closed");
    }
  });

  return statusListenerClient;
};

const stopMqttStatusListener = async () => {
  const client = statusListenerClient;
  statusListenerClient = null;

  if (!client) {
    return false;
  }

  try {
    client.removeAllListeners();

    if (typeof client.end === "function") {
      await new Promise((resolve) => {
        client.end(true, resolve);
      });
    }
  } catch (error) {
    console.error("[MQTT STATUS] Gagal menghentikan listener:", error.message);
  }

  return true;
};

module.exports = {
  startMqttStatusListener,
  stopMqttStatusListener,
};
