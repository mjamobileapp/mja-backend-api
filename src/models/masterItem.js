const dbPool = require("../config/database");
const { getDatabaseTimestamp } = require("../utils/date");
const { createHttpError } = require("../utils/httpError");

const createNewMasterItem = async ({ namaItem, tipeItem, createdBy }) => {
  const [existingItem] = await dbPool.execute(
    "SELECT id FROM tbl_master_item_expense WHERE namaItem = ?",
    [namaItem]
  );

  if (existingItem.length > 0) {
    throw createHttpError(409, "Master Item sudah terdaftar", "MASTER_ITEM_DUPLICATE");
  }

  const statusAktif = true;
  const createdDate = getDatabaseTimestamp();
  const sql = `INSERT INTO tbl_master_item_expense (
    namaItem,
    tipeItem,
    createdBy,
    createdDate,
    statusAktif
  ) VALUES (?, ?, ?, ?, ?)`;

  await dbPool.execute(sql, [namaItem, tipeItem, createdBy, createdDate, statusAktif]);

  return { namaItem, tipeItem, createdBy, statusAktif };
};

const getAllMasterItem = async (status) => {
  let sql = "SELECT * FROM tbl_master_item_expense";

  if (status === "inactive") {
    sql += " WHERE statusAktif = 0";
  } else if (status !== "all") {
    sql += " WHERE statusAktif = 1";
  }

  const [items] = await dbPool.execute(sql);
  return items;
};

const getMasterItemById = async (id) => {
  const [items] = await dbPool.execute("SELECT * FROM tbl_master_item_expense WHERE id = ?", [id]);

  if (items.length === 0) {
    throw createHttpError(404, "data not found", "MASTER_ITEM_NOT_FOUND");
  }

  return items[0];
};

const getMasterItemByTipe = async (tipeItem) => {
  const [items] = await dbPool.execute(
    "SELECT * FROM tbl_master_item_expense WHERE tipeItem = ? AND statusAktif = 1",
    [tipeItem]
  );

  if (items.length === 0) {
    throw createHttpError(404, "data not found", "MASTER_ITEM_NOT_FOUND");
  }

  return items;
};

const deleteMasterItem = async (id, updatedBy) => {
  const [existing] = await dbPool.execute(
    "SELECT id FROM tbl_master_item_expense WHERE id = ? AND statusAktif = 1",
    [id]
  );

  if (existing.length === 0) {
    throw createHttpError(404, "data not found", "MASTER_ITEM_NOT_FOUND");
  }

  const updatedDate = getDatabaseTimestamp();
  return dbPool.execute(
    "UPDATE tbl_master_item_expense SET statusAktif = 0, updatedBy = ?, updatedDate = ? WHERE id = ?",
    [updatedBy, updatedDate, id]
  );
};

const updateMasterItem = async (id, { namaItem, tipeItem, updatedBy }) => {
  const [existingItem] = await dbPool.execute(
    "SELECT namaItem FROM tbl_master_item_expense WHERE id = ? AND statusAktif = 1",
    [id]
  );

  if (existingItem.length === 0) {
    throw createHttpError(404, "data not found", "MASTER_ITEM_NOT_FOUND");
  }

  if (namaItem !== existingItem[0].namaItem) {
    const [duplicate] = await dbPool.execute(
      "SELECT id FROM tbl_master_item_expense WHERE namaItem = ? AND id != ?",
      [namaItem, id]
    );

    if (duplicate.length > 0) {
      throw createHttpError(409, "Master Item sudah terdaftar", "MASTER_ITEM_DUPLICATE");
    }
  }

  const updatedDate = getDatabaseTimestamp();
  await dbPool.execute(
    "UPDATE tbl_master_item_expense SET namaItem = ?, tipeItem = ?, updatedBy = ?, updatedDate = ? WHERE id = ?",
    [namaItem, tipeItem, updatedBy, updatedDate, id]
  );

  const [result] = await dbPool.execute("SELECT * FROM tbl_master_item_expense WHERE id = ?", [id]);
  return result[0];
};

const restoreMasterItem = async (id, updatedBy) => {
  const [existing] = await dbPool.execute(
    "SELECT id FROM tbl_master_item_expense WHERE id = ? AND statusAktif = 0",
    [id]
  );

  if (existing.length === 0) {
    throw createHttpError(404, "data not found", "MASTER_ITEM_NOT_FOUND");
  }

  const updatedDate = getDatabaseTimestamp();
  return dbPool.execute(
    "UPDATE tbl_master_item_expense SET statusAktif = 1, updatedBy = ?, updatedDate = ? WHERE id = ?",
    [updatedBy, updatedDate, id]
  );
};

module.exports = {
  createNewMasterItem,
  getAllMasterItem,
  getMasterItemById,
  getMasterItemByTipe,
  updateMasterItem,
  deleteMasterItem,
  restoreMasterItem,
};
