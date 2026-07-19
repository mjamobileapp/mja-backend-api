const MasterMenuModel = require("../models/menus");
const { withAuthenticatedAuditUsername } = require("../utils/validation");
const { audit, getAuditSnapshot, A, E } = require("../utils/auditBackoffice");

const getAll = async (req, res) => {
  const [data] = await MasterMenuModel.getAll();
  const mappedData = data.map((item) => ({
    id: item.id,
    namaMenu: item.namaMenu,
    parentId: item.parentId,
    menuParent: item.menuParent,
    menuSubParent: item.menuSubParent,
    icon: item.iconMenu,
    menuLevel: item.levelMenu,
    menuType: item.tipeMenu,
    noUrut: item.noUrut,
    createdDate: item.createdDate,
  }));
  return res.json({ message: "GET all Menu success", data: mappedData });
};

const getById = async (req, res) => {
  const [data] = await MasterMenuModel.getById(req.params.id);
  if (data.length === 0) return res.status(404).json({ message: "Menu not found" });
  const item = data[0];
  const mappedData = {
    id: item.id,
    namaMenu: item.namaMenu,
    url: item.url,
    parentId: item.parentId,
    noUrut: item.noUrut,
    levelMenu: item.levelMenu,
    tipeMenu: item.tipeMenu,
    iconMenu: item.iconMenu !== null ? item.iconMenu : "",
  };
  return res.json({ message: "Get by Id Menu success", data: mappedData });
};

const createNewMenu = async (req, res) => {
  const body = withAuthenticatedAuditUsername(req.body, req.user, "createdBy");
  if (!body.namaMenu || !body.url) return res.status(400).json({ message: "Anda mengirimkan data yang salah", data: null });
  const resultTuple = await MasterMenuModel.createNewMenu(body);
  const result = resultTuple?.[0] || {};
  await audit(req, A.CREATE, E.MENU, result.insertId, null, { id: result.insertId, namaMenu: body.namaMenu, url: body.url });
  return res.status(201).json({ message: "CREATE new Menu success", data: body });
};

const updateMenu = async (req, res) => {
  const oldValues = await getAuditSnapshot(MasterMenuModel, "getById", req.params.id);
  const body = withAuthenticatedAuditUsername(req.body, req.user, "modifiedBy");
  await MasterMenuModel.updateMenu(body, req.params.id);
  await audit(req, A.UPDATE, E.MENU, req.params.id, oldValues, body);
  return res.json({ message: "UPDATE Menu success", data: { id: req.params.id, ...body } });
};

const deleteMenu = async (req, res) => {
  const oldValues = await getAuditSnapshot(MasterMenuModel, "getById", req.params.id);
  await MasterMenuModel.deleteMenu(req.params.id);
  await audit(req, A.DELETE, E.MENU, req.params.id, oldValues, null);
  return res.json({ message: "DELETE Menu success", data: null });
};

const getMenuHeader = async (req, res) => {
  const [result] = await MasterMenuModel.getMenuHeader();
  if (result.length === 0) return res.status(404).json({ message: "Data tidak ditemukan." });
  const mappedData = result.map((item) => ({
    id: item.id,
    url: item.url,
    namaMenu: item.namaMenu,
    parentId: item.parentId,
    menuParent: item.menuParent,
    menuSubParent: item.menuSubParent,
    icon: item.iconMenu,
    menuLevel: item.levelMenu,
    menuType: item.tipeMenu,
    noUrut: item.noUrut,
  }));
  return res.json({ message: "GET Menu Header success", data: mappedData });
};

module.exports = { getAll, getById, createNewMenu, updateMenu, deleteMenu, getMenuHeader };
