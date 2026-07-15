const dbPool = require("../config/database");
const { getDateFilterCondition, getTodayStringYYYYMMDD } = require("../utils/date");
const { createHttpError } = require("../utils/httpError");
const { publishAndWaitAck } = require("../utils/mqttClient");
const { withTransaction } = require("../utils/transaction");
const { calculateLineSubtotal, sumMoney } = require("../domain/transaksi");

const jenisMesinToLayanan = {
  WASHER: "cuci",
  DRYER: "kering",
};

const normalizeEspId = (espId) => String(espId || "").trim().toUpperCase();
const isMqttDebugEnabled = () => String(process.env.MQTT_DEBUG || "").toLowerCase() === "true";

const getInvoiceDate = () => getTodayStringYYYYMMDD();

const generateInvoiceNumber = async (connection, cabangId) => {
  const invoiceDate = getInvoiceDate();
  const prefix = `INV-${cabangId}-${invoiceDate}-`;

  const [rows] = await connection.execute(
    `SELECT invoiceNumber
     FROM tbl_order_laundry
     WHERE invoiceNumber LIKE ?
     ORDER BY invoiceNumber DESC
     LIMIT 1
     FOR UPDATE`,
    [`${prefix}%`]
  );

  let sequence = 1;
  if (rows.length > 0) {
    const lastSequence = Number(rows[0].invoiceNumber.slice(-4));
    sequence = lastSequence + 1;
  }

  return `${prefix}${String(sequence).padStart(4, "0")}`;
};

const validateMasterData = async (connection, idMitra, cabangId, idUserMobile) => {
  const [mitraCheck] = await connection.execute(
    "SELECT id FROM tbl_mitra WHERE id = ? AND statusAktif = 1",
    [idMitra]
  );
  if (mitraCheck.length === 0) {
    throw createHttpError(404, "Mitra tidak ditemukan", "TRANSACTION_MITRA_NOT_FOUND");
  }

  const [cabangCheck] = await connection.execute(
    "SELECT id FROM tbl_cabang WHERE id = ? AND idMitra = ? AND statusAktif = 1",
    [cabangId, idMitra]
  );
  if (cabangCheck.length === 0) {
    throw createHttpError(404, "Cabang tidak ditemukan", "TRANSACTION_CABANG_NOT_FOUND");
  }

  const [userCheck] = await connection.execute(
    "SELECT id, namaLengkap FROM tbl_users_mobile WHERE id = ? AND statusAktif = 1",
    [idUserMobile]
  );
  if (userCheck.length === 0) {
    throw createHttpError(404, "User tidak ditemukan", "TRANSACTION_USER_NOT_FOUND");
  }

  return userCheck[0];
};

const validateAddonItem = async (connection, itemId) => {
  const [itemCheck] = await connection.execute(
    `SELECT id, namaItem, tipeItem
     FROM tbl_master_item_expense
     WHERE id = ? AND statusAktif = 1`,
    [itemId]
  );

  if (itemCheck.length === 0) {
    throw createHttpError(404, "Item tidak ditemukan", "TRANSACTION_ITEM_NOT_FOUND");
  }

  if (itemCheck[0].tipeItem !== "stok") {
    throw createHttpError(400, "Item addon harus bertipe stok", "TRANSACTION_ITEM_TYPE_INVALID");
  }

  return itemCheck[0];
};

const reduceStockAndNotify = async (
  connection,
  { idMitra, cabangId, item, itemData, updatedBy }
) => {
  const [stockRows] = await connection.execute(
    `SELECT id, stokSekarang
     FROM tbl_stok_cabang
     WHERE idMitra = ? AND cabangId = ? AND itemId = ?
     FOR UPDATE`,
    [idMitra, cabangId, item.itemId]
  );

  if (stockRows.length === 0) {
    throw createHttpError(400, "Stok cabang tidak ditemukan", "TRANSACTION_STOCK_NOT_CONFIGURED");
  }

  const currentStock = Number(stockRows[0].stokSekarang);
  const jumlah = Number(item.jumlah);

  if (currentStock < jumlah) {
    throw createHttpError(400, "Stok tidak mencukupi", "TRANSACTION_STOCK_INSUFFICIENT");
  }

  await connection.execute(
    `UPDATE tbl_stok_cabang
     SET stokSekarang = stokSekarang - ?,
         updatedBy = ?,
         updatedDate = UTC_TIMESTAMP()
     WHERE idMitra = ? AND cabangId = ? AND itemId = ?`,
    [jumlah, updatedBy, idMitra, cabangId, item.itemId]
  );

  const latestStock = currentStock - jumlah;
  const [thresholdRows] = await connection.execute(
    `SELECT batasMinimum
     FROM tbl_treshold_stok_mitra
     WHERE idMitra = ? AND itemId = ?`,
    [idMitra, item.itemId]
  );

  if (thresholdRows.length === 0) {
    return;
  }

  const batasMinimum = Number(thresholdRows[0].batasMinimum);
  if (latestStock <= batasMinimum) {
    await connection.execute(
      "INSERT INTO tbl_notifikasi (idMitra, cabangId, tipe, judul, pesan) VALUES (?, ?, ?, ?, ?)",
      [
        idMitra,
        cabangId,
        "STOK",
        "Stok Menipis",
        `Stok item ${itemData.namaItem} tersisa ${latestStock}, sudah mencapai batas minimum ${batasMinimum}.`,
      ]
    );
  }
};

const createTransaksi = async (data) => {
  const { idMitra, cabangId, idUserMobile, totalBayar, metodePembayaran, items } = data;
  return withTransaction(async (connection) => {

    const user = await validateMasterData(connection, idMitra, cabangId, idUserMobile);
    const updatedBy = user.namaLengkap || String(idUserMobile);
    const invoiceNumber = await generateInvoiceNumber(connection, cabangId);
    const addonItems = new Map();
    const pricedItems = [];

    for (const item of items) {
      const itemId = item.jenisLayanan === "addon_barang" ? item.itemId : null;
      let itemData = null;
      if (item.jenisLayanan === "addon_barang") {
        itemData = await validateAddonItem(connection, item.itemId);
        addonItems.set(item.itemId, itemData);
      }

      const harga = await getOfficialPrice(connection, { idMitra, cabangId, jenisLayanan: item.jenisLayanan, itemId });
      pricedItems.push({ ...item, itemId, subtotal: calculateLineSubtotal(harga, item.jumlah) });
    }

    const serverTotal = sumMoney(pricedItems.map((item) => item.subtotal));
    if (Number(totalBayar) !== serverTotal) {
      throw createHttpError(
        409,
        "Harga transaksi telah berubah. Muat ulang harga dan coba kembali.",
        "TRANSACTION_PRICE_CHANGED"
      );
    }

    const [orderResult] = await connection.execute(
      `INSERT INTO tbl_order_laundry (
        invoiceNumber,
        idMitra,
        cabangId,
        idUserMobile,
        totalBayar,
        metodePembayaran,
        statusPembayaran,
        waktuOrder
      ) VALUES (?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
      [invoiceNumber, idMitra, cabangId, idUserMobile, serverTotal, metodePembayaran, "PAID"]
    );

    const orderId = orderResult.insertId;

    for (const item of pricedItems) {
      const itemId = item.itemId;

      await connection.execute(
        `INSERT INTO tbl_detail_order (
          orderId,
          jenisLayanan,
          itemId,
          jumlah,
          subtotal
        ) VALUES (?, ?, ?, ?, ?)`,
        [orderId, item.jenisLayanan, itemId, Number(item.jumlah), item.subtotal]
      );

      if (item.jenisLayanan === "addon_barang") {
        await reduceStockAndNotify(connection, {
          idMitra,
          cabangId,
          item,
          itemData: addonItems.get(item.itemId),
          updatedBy,
        });
      }
    }

    const [orderRows] = await connection.execute(
      `SELECT id, invoiceNumber, idMitra, cabangId, idUserMobile, totalBayar, waktuOrder
       FROM tbl_order_laundry
       WHERE id = ?`,
      [orderId]
    );

    const [detailRows] = await connection.execute(
      `SELECT id, jenisLayanan, itemId, jumlah, subtotal
       FROM tbl_detail_order
       WHERE orderId = ?
       ORDER BY id ASC`,
      [orderId]
    );

    const order = orderRows[0];
    return {
      id: order.id,
      invoiceNumber: order.invoiceNumber,
      idMitra: String(order.idMitra),
      cabangId: String(order.cabangId),
      idUserMobile: String(order.idUserMobile),
      totalBayar: String(order.totalBayar),
      waktuOrder: order.waktuOrder ? new Date(order.waktuOrder).toISOString() : "",
      items: detailRows.map((item) => ({
        id: item.id,
        jenisLayanan: item.jenisLayanan,
        itemId: item.itemId,
        jumlah: item.jumlah,
        subtotal: Number(item.subtotal),
      })),
    };
  });
};

const getOfficialPrice = async (connection, { idMitra, cabangId, jenisLayanan, itemId }) => {
  const [rows] = await connection.execute(
    `SELECT harga
     FROM tbl_harga_cabang
     WHERE idMitra = ?
       AND cabangId = ?
       AND jenisLayanan = ?
       AND itemId <=> ?`,
    [idMitra, cabangId, jenisLayanan, itemId]
  );

  if (rows.length !== 1) {
    throw createHttpError(409, "Harga transaksi belum dikonfigurasi untuk cabang ini", "TRANSACTION_PRICE_NOT_CONFIGURED");
  }

  return Number(rows[0].harga);
};

const insertLogMesin = async (
  connection,
  { idMitra, cabangId, mesinId, kasirId, actor, invoiceNumber, statusPerintah, errorMessage = null }
) => {
  const auditActor = actor || { type: "kasir", id: kasirId, username: null };
  await connection.execute(
    `INSERT INTO tbl_log_mesin (
      idMitra,
      cabangId,
      mesinId,
      kasirId,
      actorType,
      actorId,
      actorUsername,
      invoiceNumber,
      statusPerintah,
      errorMessage,
      waktuLog
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
    [
      idMitra,
      cabangId,
      mesinId,
      kasirId,
      auditActor.type,
      auditActor.id,
      auditActor.username || null,
      invoiceNumber,
      statusPerintah,
      errorMessage,
    ]
  );
};

const isActiveCabangForMitra = async (idMitra, cabangId) => {
  const [rows] = await dbPool.execute(
    `SELECT c.id
     FROM tbl_cabang c
     JOIN tbl_mitra m ON m.id = c.idMitra
     WHERE c.id = ? AND c.idMitra = ? AND c.statusAktif = 1 AND m.statusAktif = 1`,
    [cabangId, idMitra]
  );

  return rows.length > 0;
};

const getMesinForStart = async (connection, { mesinId, idMitra, cabangId }) => {
  const [rows] = await connection.execute(
    `SELECT
      d.id AS mesinId,
      d.jenisMesin,
      d.status,
      m.espId,
      m.idMitra,
      m.cabangId
    FROM tbl_mesin_detail d
    JOIN tbl_mesin_master m ON d.idMesinMaster = m.id
    WHERE d.id = ?
      AND m.idMitra = ?
      AND m.cabangId = ?
      AND m.statusAktif = 1
    FOR UPDATE`,
    [mesinId, idMitra, cabangId]
  );

  if (rows.length === 0) {
    throw createHttpError(404, "Mesin tidak ditemukan", "MACHINE_NOT_FOUND");
  }

  const mesin = rows[0];
  if (String(mesin.status).toUpperCase() !== "READY") {
    throw createHttpError(409, "Mesin tidak tersedia", "MACHINE_NOT_READY");
  }

  if (!jenisMesinToLayanan[mesin.jenisMesin]) {
    throw createHttpError(400, "Jenis mesin tidak valid", "INVALID_MACHINE_TYPE");
  }

  return mesin;
};

const getMesinForStop = async (connection, { mesinId, idMitra, cabangId }) => {
  const [rows] = await connection.execute(
    `SELECT
      d.id AS mesinId,
      d.jenisMesin,
      d.status,
      m.espId,
      m.idMitra,
      m.cabangId
    FROM tbl_mesin_detail d
    JOIN tbl_mesin_master m ON d.idMesinMaster = m.id
    WHERE d.id = ?
      AND m.idMitra = ?
      AND m.cabangId = ?
      AND m.statusAktif = 1
    FOR UPDATE`,
    [mesinId, idMitra, cabangId]
  );

  if (rows.length === 0) {
    throw createHttpError(404, "Mesin tidak ditemukan", "MACHINE_NOT_FOUND");
  }

  const mesin = rows[0];
  if (String(mesin.status).toUpperCase() !== "IN_USE") {
    throw createHttpError(409, "Mesin tidak sedang digunakan", "MACHINE_NOT_IN_USE");
  }

  if (!jenisMesinToLayanan[mesin.jenisMesin]) {
    throw createHttpError(400, "Jenis mesin tidak valid", "INVALID_MACHINE_TYPE");
  }

  return mesin;
};

const getPendingDetailForStart = async (
  connection,
  { invoiceNumber, idMitra, cabangId, jenisLayanan }
) => {
  const [rows] = await connection.execute(
    `SELECT
      d.id AS detailOrderId,
      d.jenisLayanan,
      d.statusEksekusi,
      o.id AS orderId,
      o.invoiceNumber
    FROM tbl_detail_order d
    JOIN tbl_order_laundry o ON d.orderId = o.id
    WHERE o.invoiceNumber = ?
      AND o.idMitra = ?
      AND o.cabangId = ?
      AND d.jenisLayanan = ?
      AND d.statusEksekusi = 'pending'
    ORDER BY d.id ASC
    LIMIT 1
    FOR UPDATE`,
    [invoiceNumber, idMitra, cabangId, jenisLayanan]
  );

  if (rows.length === 0) {
    throw createHttpError(404, "Transaksi pending tidak ditemukan", "PENDING_TRANSACTION_NOT_FOUND");
  }

  return rows[0];
};

const validateDryerCanStart = async (connection, orderId) => {
  const [rows] = await connection.execute(
    `SELECT id, statusEksekusi
     FROM tbl_detail_order
     WHERE orderId = ?
       AND jenisLayanan = 'cuci'`,
    [orderId]
  );

  const hasUnfinishedWash = rows.some((row) => row.statusEksekusi !== "selesai");

  if (hasUnfinishedWash) {
    throw createHttpError(409, "Layanan cuci belum selesai", "WASH_NOT_COMPLETED");
  }
};

const startMesin = async ({ idMitra, cabangId, kasirId, actor, mesinId, invoiceNumber }) => {
  const connection = await dbPool.getConnection();
  let shouldRollback = false;

  try {
    await connection.beginTransaction();
    shouldRollback = true;

    const mesin = await getMesinForStart(connection, { mesinId, idMitra, cabangId });
    const jenisLayanan = jenisMesinToLayanan[mesin.jenisMesin];
    const detailOrder = await getPendingDetailForStart(connection, {
      invoiceNumber,
      idMitra,
      cabangId,
      jenisLayanan,
    });

    if (mesin.jenisMesin === "DRYER") {
      await validateDryerCanStart(connection, detailOrder.orderId);
    }

    const requestId = `${invoiceNumber}-${mesinId}-${Date.now()}`;
    const espId = normalizeEspId(mesin.espId);
    const topic = `modul/${espId}/${mesin.jenisMesin}/on`;
    const ackTopic = `modul/${espId}/${mesin.jenisMesin}/ack`;
    const mqttPayload = {
      command: "ON",
      requestId,
    };

    try {
      if (isMqttDebugEnabled()) {
        console.log("[TRANSAKSI] Start mesin MQTT command", {
          mesinId: Number(mesinId),
          jenisMesin: mesin.jenisMesin,
          espId,
          rawEspId: mesin.espId,
          topic,
          ackTopic,
          requestId,
        });
      }

      await publishAndWaitAck({
        topic,
        ackTopic,
        payload: mqttPayload,
        requestId,
      });
    } catch (mqttError) {
      await insertLogMesin(connection, {
        idMitra,
        cabangId,
        mesinId,
        kasirId,
        actor,
        invoiceNumber,
        statusPerintah: "failed",
        errorMessage: mqttError.message,
      });

      await connection.commit();
      shouldRollback = false;
      throw createHttpError(502, "Gagal mengirim perintah ke mesin", "MQTT_COMMAND_FAILED");
    }

    await connection.execute(
      `UPDATE tbl_detail_order
       SET mesinId = ?, statusEksekusi = 'selesai'
       WHERE id = ?`,
      [mesinId, detailOrder.detailOrderId]
    );

    await connection.execute(
      `UPDATE tbl_mesin_detail
       SET status = 'IN_USE'
       WHERE id = ?`,
      [mesinId]
    );

    await insertLogMesin(connection, {
      idMitra,
      cabangId,
      mesinId,
      kasirId,
      actor,
      invoiceNumber,
      statusPerintah: "success",
    });

    await connection.commit();
    shouldRollback = false;
    return null;
  } catch (error) {
    if (shouldRollback) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Rollback start mesin gagal:", rollbackError.message);
      }
    }

    throw error;
  } finally {
    connection.release();
  }
};

const stopMesin = async ({ idMitra, cabangId, kasirId, actor, mesinId, invoiceNumber = null }) => {
  const connection = await dbPool.getConnection();
  let shouldRollback = false;

  try {
    await connection.beginTransaction();
    shouldRollback = true;

    const mesin = await getMesinForStop(connection, { mesinId, idMitra, cabangId });
    const requestId = `${invoiceNumber || "NO-INVOICE"}-${mesinId}-OFF-${Date.now()}`;
    const espId = normalizeEspId(mesin.espId);
    const topic = `modul/${espId}/${mesin.jenisMesin}/off`;
    const ackTopic = `modul/${espId}/${mesin.jenisMesin}/ack`;
    const mqttPayload = {
      command: "OFF",
      requestId,
    };

    try {
      if (isMqttDebugEnabled()) {
        console.log("[TRANSAKSI] Stop mesin MQTT command", {
          mesinId: Number(mesinId),
          jenisMesin: mesin.jenisMesin,
          espId,
          rawEspId: mesin.espId,
          topic,
          ackTopic,
          requestId,
        });
      }

      await publishAndWaitAck({
        topic,
        ackTopic,
        payload: mqttPayload,
        requestId,
      });
    } catch (mqttError) {
      await insertLogMesin(connection, {
        idMitra,
        cabangId,
        mesinId,
        kasirId,
        actor,
        invoiceNumber,
        statusPerintah: "failed",
        errorMessage: mqttError.message,
      });

      await connection.commit();
      shouldRollback = false;
      throw createHttpError(502, "Gagal mengirim perintah off ke mesin", "MQTT_COMMAND_FAILED");
    }

    await connection.execute(
      `UPDATE tbl_mesin_detail
       SET status = 'READY'
       WHERE id = ?`,
      [mesinId]
    );

    await insertLogMesin(connection, {
      idMitra,
      cabangId,
      mesinId,
      kasirId,
      actor,
      invoiceNumber,
      statusPerintah: "success",
    });

    await connection.commit();
    shouldRollback = false;
    return null;
  } catch (error) {
    if (shouldRollback) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Rollback stop mesin gagal:", rollbackError.message);
      }
    }

    throw error;
  } finally {
    connection.release();
  }
};

const getPendingTransaksi = async (cabangId, idMitra) => {
  const [rows] = await dbPool.execute(
    `SELECT 
      d_pending.id AS idDetailPending,
      o.invoiceNumber,
      d_pending.jenisLayanan AS layananPending,
      o.waktuOrder,
      d_asal.mesinId AS idMesinAsal
    FROM tbl_detail_order d_pending
    JOIN tbl_order_laundry o ON d_pending.orderId = o.id
    LEFT JOIN tbl_detail_order d_asal 
      ON d_pending.orderId = d_asal.orderId 
      AND d_asal.jenisLayanan = 'cuci' 
      AND d_asal.statusEksekusi = 'selesai'
    WHERE 
      d_pending.statusEksekusi = 'pending' 
      AND d_pending.jenisLayanan IN ('cuci', 'kering')
      AND o.cabangId = ?
      AND o.idMitra = ?
    ORDER BY o.waktuOrder ASC`,
    [cabangId, idMitra]
  );

  return rows;
};

const getJumlahTransaksi = async (cabangId, idMitra, filter = "") => {
  const dateFilter = getDateFilterCondition("o.waktuOrder", filter);

  const [rows] = await dbPool.execute(
    `SELECT
      COUNT(o.id) AS totalTransaksi,
      SUM(CASE WHEN o.metodePembayaran = 'CASH' THEN 1 ELSE 0 END) AS totalCash,
      SUM(CASE WHEN o.metodePembayaran = 'QRIS' THEN 1 ELSE 0 END) AS totalQris
    FROM tbl_order_laundry o
    WHERE o.cabangId = ?
      AND o.idMitra = ?
      AND (o.statusPembayaran = 'PAID' OR o.statusPembayaran IS NULL)
      AND ${dateFilter}`,
    [cabangId, idMitra]
  );

  const data = rows[0] || {};

  return {
    Total: Number(data.totalTransaksi) || 0,
    Cash: Number(data.totalCash) || 0,
    Qris: Number(data.totalQris) || 0,
  };
};

module.exports = {
  createTransaksi,
  getPendingTransaksi,
  getJumlahTransaksi,
  isActiveCabangForMitra,
  startMesin,
  stopMesin,
};
