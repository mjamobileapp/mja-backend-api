const MasterMenuModel = require("../models/menus");
const { withAuthenticatedAuditUsername } = require("../utils/validation");

const getAll = async (req, res) => {
  try {
    const [data] = await MasterMenuModel.getAll();
    // console.log(data);
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
    res.json({
      message: "GET all Menu success",
      data: mappedData,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server Error",
      serverMessage: error,
    });
  }
};

const getById = async (req, res) => {
  const { id } = req.params;

  try {
    const [data] = await MasterMenuModel.getById(id);
    if (data.length === 0) {
      return res.status(404).json({ message: "Menu not found" });
    }

    const item = data[0];
    // console.log(item);
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
    // console.log(mappedData);
    res.json({
      message: "Get by Id Menu success",
      data: mappedData,
    });
  } catch (error) {
    console.error("Error fetching Menu:", error);
    res.status(500).json({
      message: "Server Error",
    });
  }
};

const createNewMenu = async (req, res) => {
  const body = withAuthenticatedAuditUsername(req.body, req.user, "createdBy");
  if (!body.namaMenu || !body.url) {
    return res.status(400).json({
      message: "Anda mengirimkan data yang salah",
      data: null,
    });
  }

  try {
    await MasterMenuModel.createNewMenu(body);
    res.status(201).json({
      message: "CREATE new Menu success",
      data: body,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server Error",
      serverMessage: error.message,
    });
  }
};

const updateMenu = async (req, res) => {
  const { id } = req.params;
  const body = withAuthenticatedAuditUsername(req.body, req.user, "modifiedBy");

  try {
    await MasterMenuModel.updateMenu(body, id);
    res.json({
      message: "UPDATE Menu success",
      data: {
        id: id,
        ...body,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Server Error",
      serverMessage: error,
    });
  }
};

const deleteMenu = async (req, res) => {
  const { id } = req.params;
  try {
    await MasterMenuModel.deleteMenu(id);
    res.json({
      message: "DELETE Menu success",
      data: null,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server Error",
      serverMessage: error,
    });
  }
};

const getMenuHeader = async (req, res) => {
  try {
    const [result] = await MasterMenuModel.getMenuHeader();

    if (result.length === 0) {
      return res.status(404).json({
        message: "Data tidak ditemukan.",
      });
    }

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

    res.json({
      message: "GET Menu Header success",
      data: mappedData,
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      message: "Terjadi kesalahan saat memanggil data",
      serverMessage: error.message,
    });
  }
};

module.exports = {
  getAll,
  getById,
  createNewMenu,
  updateMenu,
  deleteMenu,
  getMenuHeader,
};
