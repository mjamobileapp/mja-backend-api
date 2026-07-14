const dbPool = require("../config/database");
const AksesModel = require("../models/akses");

/**
 * Mengambil daftar menu beserta status akses (checked) untuk role tertentu
 */
const getAksesRole = async (req, res) => {
  const { idRole } = req.params;
  const [cekAksesRows] = await dbPool.execute(
      "SELECT COUNT(*) AS count FROM tbl_akses WHERE roleId = ?",
      [idRole]
    );

    const adaDataAkses = cekAksesRows[0].count > 0;
    let finalMenus;

    if (adaDataAkses) {
      const [aksesResultRows] = await dbPool.execute(
        `SELECT m.id, m.namaMenu, m.parentId, m.noUrut, COALESCE(ar.akses, 0) AS checked
         FROM tbl_menu m
         LEFT JOIN tbl_akses ar ON m.id = ar.menuId AND ar.roleId = ?
         ORDER BY m.noUrut ASC`,
        [idRole]
      );
      finalMenus = aksesResultRows.map((menu) => ({
        ...menu,
        checked: !!menu.checked,
      }));
    } else {
      const [fallbackResultRows] = await dbPool.execute(
        "SELECT id, namaMenu, parentId, noUrut FROM tbl_menu ORDER BY noUrut ASC"
      );
      finalMenus = fallbackResultRows.map((menu) => ({
        ...menu,
        checked: false,
      }));
    }

    // Transformasi ke struktur Tree
    const treeMenus = finalMenus
      .filter((menu) => menu.parentId === null || menu.parentId === 0)
      .map((parent) => ({
        id: parent.id,
        name: parent.namaMenu,
        checked: parent.checked,
        children: finalMenus
          .filter((child) => child.parentId === parent.id)
          .map((child) => ({
            id: child.id,
            name: child.namaMenu,
            checked: child.checked,
          })),
      }));

  return res.json(treeMenus);
};

/**
 * Menyimpan konfigurasi akses menu untuk role (Menggunakan Transaction)
 */
const saveAksesRole = async (req, res) => {
  const { idRole } = req.params;
  const menuTree = req.body;
  if (!Array.isArray(menuTree)) {
    return res.status(400).json({ message: "Payload akses harus berupa array menu" });
  }

  await AksesModel.saveAksesRole(idRole, menuTree);
  return res.json({ message: "Akses role berhasil diperbarui" });
};

/**
 * Mengambil daftar menu yang diizinkan untuk sidebar berdasarkan email user
 */
const getAksesByUser = async (req, res) => {
  const { email } = req.params;
  const [menus] = await dbPool.query(
      `SELECT m.id, m.namaMenu, m.iconMenu, m.url, m.parentId, m.noUrut
       FROM tbl_users u
       JOIN tbl_role r ON r.id = u.roleId 
       JOIN tbl_akses ar ON ar.roleId = r.id 
       JOIN tbl_menu m ON m.id = ar.menuId
       WHERE u.username = ? AND ar.akses = 1
       ORDER BY m.parentId, m.noUrut ASC`,
      [email]
    );

    const parentMap = {};
    const items = [];

    menus.forEach((menu) => {
      if (menu.parentId === null || menu.parentId === 0) {
        parentMap[menu.id] = {
          title: menu.namaMenu,
          icon: menu.iconMenu,
          children: [],
        };
        items.push(parentMap[menu.id]);
      }
    });

    menus.forEach((menu) => {
      if (menu.parentId && parentMap[menu.parentId]) {
        parentMap[menu.parentId].children.push({
          title: menu.namaMenu,
          icon: menu.iconMenu,
          link: menu.url,
        });
      }
    });

  return res.json([{ heading: "Pages", items }]);
};

module.exports = {
  getAksesRole,
  saveAksesRole,
  getAksesByUser,
};
