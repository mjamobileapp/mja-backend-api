const dbPool = require("../config/database");
const { getDateFilterCondition } = require("../utils/date");

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
};
