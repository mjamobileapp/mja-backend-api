const dbPool = require("../config/database");
const { getDateFilterCondition } = require("../utils/date");
const { publishAndWaitAck } = require("../utils/mqttClient");

const jenisMesinToLayanan = {
  WASHER: "cuci",
  DRYER: "kering",
};

const createHttpError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getInvoiceDate = async (connection) => {
  const [rows] = await connection.execute("SELECT DATE_FORMAT(NOW(), '%Y%m%d') AS invoiceDate");
  return rows[0].invoiceDate;
};

const generateInvoiceNumber = async (connection, cabangId) => {
  const invoiceDate = await getInvoiceDate(connection);
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
    throw new Error("Mitra tidak ditemukan");
  }

  const [cabangCheck] = await connection.execute(
    "SELECT id FROM tbl_cabang WHERE id = ? AND idMitra = ? AND statusAktif = 1",
    [cabangId, idMitra]
  );
  if (cabangCheck.length === 0) {
    throw new Error("Cabang tidak ditemukan");
  }

  const [userCheck] = await connection.execute(
    "SELECT id, namaLengkap FROM tbl_users_mobile WHERE id = ? AND statusAktif = 1",
    [idUserMobile]
  );
  if (userCheck.length === 0) {
    throw new Error("User tidak ditemukan");
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
    throw new Error("Item tidak ditemukan");
  }

  if (itemCheck[0].tipeItem !== "stok") {
    throw new Error("Item addon harus bertipe stok");
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
    throw new Error("Stok cabang tidak ditemukan");
  }

  const currentStock = Number(stockRows[0].stokSekarang);
  const jumlah = Number(item.jumlah);

  if (currentStock < jumlah) {
    throw new Error("Stok tidak mencukupi");
  }

  await connection.execute(
    `UPDATE tbl_stok_cabang
     SET stokSekarang = stokSekarang - ?,
         updatedBy = ?,
         updatedDate = NOW()
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
  const connection = await dbPool.getConnection();

  try {
    await connection.beginTransaction();

    const user = await validateMasterData(connection, idMitra, cabangId, idUserMobile);
    const updatedBy = user.namaLengkap || String(idUserMobile);
    const invoiceNumber = await generateInvoiceNumber(connection, cabangId);

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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [invoiceNumber, idMitra, cabangId, idUserMobile, totalBayar, metodePembayaran, "PAID"]
    );

    const orderId = orderResult.insertId;
    const addonItems = new Map();

    for (const item of items) {
      const itemId = item.jenisLayanan === "addon_barang" ? item.itemId : null;

      let itemData = null;
      if (item.jenisLayanan === "addon_barang") {
        itemData = await validateAddonItem(connection, item.itemId);
        addonItems.set(item.itemId, itemData);
      }

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

    await connection.commit();

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
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const insertLogMesin = async (
  connection,
  { idMitra, cabangId, mesinId, kasirId, invoiceNumber, statusPerintah, errorMessage = null }
) => {
  await connection.execute(
    `INSERT INTO tbl_log_mesin (
      idMitra,
      cabangId,
      mesinId,
      kasirId,
      invoiceNumber,
      statusPerintah,
      errorMessage,
      waktuLog
    ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
    [idMitra, cabangId, mesinId, kasirId, invoiceNumber, statusPerintah, errorMessage]
  );
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
    throw createHttpError("Mesin tidak ditemukan", 404);
  }

  const mesin = rows[0];
  if (String(mesin.status).toUpperCase() !== "READY") {
    throw createHttpError("Mesin tidak tersedia", 409);
  }

  if (!jenisMesinToLayanan[mesin.jenisMesin]) {
    throw createHttpError("Jenis mesin tidak valid", 400);
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
    throw createHttpError("Mesin tidak ditemukan", 404);
  }

  const mesin = rows[0];
  if (String(mesin.status).toUpperCase() !== "IN_USE") {
    throw createHttpError("Mesin tidak sedang digunakan", 409);
  }

  if (!jenisMesinToLayanan[mesin.jenisMesin]) {
    throw createHttpError("Jenis mesin tidak valid", 400);
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
    throw createHttpError("Transaksi pending tidak ditemukan", 404);
  }

  return rows[0];
};

const validateDryerCanStart = async (connection, orderId) => {
  const [rows] = await connection.execute(
    `SELECT id
     FROM tbl_detail_order
     WHERE orderId = ?
       AND jenisLayanan = 'cuci'
       AND statusEksekusi = 'selesai'
     LIMIT 1`,
    [orderId]
  );

  if (rows.length === 0) {
    throw createHttpError("Layanan cuci belum selesai", 409);
  }
};

const startMesin = async ({ idMitra, cabangId, kasirId, mesinId, invoiceNumber }) => {
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
    const topic = `modul/${mesin.espId}/${mesin.jenisMesin}/on`;
    const ackTopic = `modul/${mesin.espId}/${mesin.jenisMesin}/ack`;
    const mqttPayload = {
      command: "ON",
      mesinId: Number(mesinId),
      invoiceNumber,
      // channelRelay: mesin.channelRelay,
      requestId,
    };

    try {
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
        invoiceNumber,
        statusPerintah: "failed",
        errorMessage: mqttError.message,
      });

      await connection.commit();
      shouldRollback = false;
      throw createHttpError("Gagal mengirim perintah ke mesin", 502);
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

const stopMesin = async ({ idMitra, cabangId, kasirId, mesinId, invoiceNumber = null }) => {
  const connection = await dbPool.getConnection();
  let shouldRollback = false;

  try {
    await connection.beginTransaction();
    shouldRollback = true;

    const mesin = await getMesinForStop(connection, { mesinId, idMitra, cabangId });
    const requestId = `${invoiceNumber || "NO-INVOICE"}-${mesinId}-OFF-${Date.now()}`;
    const topic = `modul/${mesin.espId}/${mesin.jenisMesin}/off`;
    const ackTopic = `modul/${mesin.espId}/${mesin.jenisMesin}/ack`;
    const mqttPayload = {
      command: "OFF",
      mesinId: Number(mesinId),
      invoiceNumber,
      // channelRelay: mesin.channelRelay,
      requestId,
    };

    try {
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
        invoiceNumber,
        statusPerintah: "failed",
        errorMessage: mqttError.message,
      });

      await connection.commit();
      shouldRollback = false;
      throw createHttpError("Gagal mengirim perintah off ke mesin", 502);
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

const getJumlahTransaksi = async (cabangId, idMitra, filter = "hari_ini") => {
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
  startMesin,
  stopMesin,
};
