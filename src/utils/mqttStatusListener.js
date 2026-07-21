const dbPool = require("../config/database");
const { connectClient, isMqttDebugEnabled } = require("./mqttClient");
const logger = require("./logger");
const { MACHINE_STATUSES, normalizeMachineStatus } = require("../domain/mesin");
const TransaksiModel = require("../models/transaksi");

const STATUS_TOPIC = "modul/+/status";
const PENDING_TRANSACTION_TOPIC = "modul/+/pendingTransaksi";
const MQTT_TOPICS = [STATUS_TOPIC, PENDING_TRANSACTION_TOPIC];
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

const parsePendingTransactionTopic = (topic) => {
  const parts = String(topic || "").split("/");

  if (parts.length !== 3 || parts[0] !== "modul" || parts[2] !== "pendingTransaksi") {
    return null;
  }

  return {
    espId: parts[1],
  };
};

const parsePendingTransactionPayload = (message) => {
  try {
    const payload = JSON.parse(message.toString());
    if (!payload || typeof payload !== "object") {
      return null;
    }

    return payload;
  } catch (error) {
    return null;
  }
};

const updateMesinReadyByEspId = async ({ espId, machineType = null }) => {
  const params = [MACHINE_STATUSES.READY, espId];
  let machineFilter = "";

  if (machineType) {
    machineFilter = " AND d.jenisMesin = ?";
    params.push(machineType);
  }

  const [result] = await dbPool.execute(
    `UPDATE tbl_mesin_detail d
     JOIN tbl_mesin_master m ON d.idMesinMaster = m.id
     SET d.status = ?
     WHERE m.espId = ?
       AND m.statusAktif = 1${machineFilter}`,
    params
  );

  return result.affectedRows || 0;
};

const createStatusMessageHandler = ({ updateReady = updateMesinReadyByEspId, logger: statusLogger = logger } = {}) =>
  async (topic, message) => {
    const topicData = parseStatusTopic(topic);
    if (!topicData) return;

    const payload = parseStatusPayload(message);
    if (!payload || normalizeMachineStatus(payload.status) !== MACHINE_STATUSES.READY) {
      return;
    }

    const machineType = payload.machineType ? String(payload.machineType).toUpperCase() : null;
    const affectedRows = await updateReady({
      espId: topicData.espId,
      machineType,
    });

    statusLogger.info({
      espId: topicData.espId,
      machineType: machineType || "ALL",
      affectedRows,
    }, "[MQTT STATUS] Mesin READY diterima");
  };

const handleStatusMessage = createStatusMessageHandler();

const createPendingTransactionMessageHandler = ({
  recoverPending = TransaksiModel.recoverPendingTransaksi,
  logger: recoveryLogger = logger,
} = {}) => async (topic, message) => {
  const topicData = parsePendingTransactionTopic(topic);
  if (!topicData) return;

  const payload = parsePendingTransactionPayload(message);
  if (!payload || normalizeMachineStatus(payload.status) !== MACHINE_STATUSES.READY || !payload.requestId) {
    return;
  }

  const machineType = payload.machineType ? String(payload.machineType).toUpperCase() : "DRYER";
  const recovery = await recoverPending({
    espId: topicData.espId,
    requestId: String(payload.requestId),
    machineType,
  });

  recoveryLogger.info({
    espId: topicData.espId,
    requestId: String(payload.requestId),
    machineType,
    recovery,
  }, "[MQTT RECOVERY] Transaksi pending dipulihkan");
};

const handlePendingTransactionMessage = createPendingTransactionMessageHandler();

const handleMqttMessage = async (topic, message) => {
  if (parseStatusTopic(topic)) {
    await handleStatusMessage(topic, message);
    return;
  }

  if (parsePendingTransactionTopic(topic)) {
    await handlePendingTransactionMessage(topic, message);
  }
};

const startMqttStatusListener = ({ clientFactory = connectClient, messageHandler = handleMqttMessage, logger: listenerLogger = logger } = {}) => {
  if (statusListenerClient) {
    return statusListenerClient;
  }

  try {
    statusListenerClient = clientFactory({
      clientIdPrefix: "mja-api-status-listener",
      reconnectPeriod: Number(process.env.MQTT_RECONNECT_PERIOD_MS) || 5000,
    });
  } catch (error) {
    listenerLogger.error({ err: error }, "[MQTT STATUS] Listener tidak bisa dimulai");
    return null;
  }

  statusListenerClient.on("connect", () => {
    statusListenerClient.subscribe(MQTT_TOPICS, { qos: 1 }, (error) => {
      if (error) {
        listenerLogger.error({ err: error }, "[MQTT STATUS] Gagal subscribe topic status/recovery");
        return;
      }

      listenerLogger.info({ topics: MQTT_TOPICS }, "[MQTT STATUS] Subscribed");
    });
  });

  statusListenerClient.on("message", (topic, message) => {
    Promise.resolve(messageHandler(topic, message)).catch((error) => {
      listenerLogger.error({
        topic,
        err: error,
      }, "[MQTT STATUS] Gagal memproses status/recovery mesin");
    });
  });

  statusListenerClient.on("error", (error) => {
    listenerLogger.error({ err: error }, "[MQTT STATUS] Client error");
  });

  statusListenerClient.on("reconnect", () => {
    if (isMqttDebugEnabled()) {
      listenerLogger.info("[MQTT STATUS] Reconnecting...");
    }
  });

  statusListenerClient.on("close", () => {
    if (isMqttDebugEnabled()) {
      listenerLogger.info("[MQTT STATUS] Connection closed");
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
    logger.error({ err: error }, "[MQTT STATUS] Gagal menghentikan listener");
  }

  return true;
};

module.exports = {
  startMqttStatusListener,
  stopMqttStatusListener,
  createStatusMessageHandler,
  createPendingTransactionMessageHandler,
  parsePendingTransactionTopic,
  parsePendingTransactionPayload,
};
