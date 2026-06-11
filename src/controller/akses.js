const dbPool = require("../config/database");

/**
 * Mengambil daftar menu beserta status akses (checked) untuk role tertentu
 */
const getAksesRole = async (req, res) => {
  const { idRole } = req.params;
  try {
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
         LEFT JOIN tbl_akses ar ON m.id = ar.id AND ar.roleId = ?
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

    res.json(treeMenus);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/**
 * Menyimpan konfigurasi akses menu untuk role (Menggunakan Transaction)
 */
const saveAksesRole = async (req, res) => {
  const { idRole } = req.params;
  const menuTree = req.body;
  const conn = await dbPool.getConnection();

  try {
    await conn.beginTransaction();

    // 1. Hapus akses lama
    await conn.execute("DELETE FROM tbl_akses WHERE roleId = ?", [idRole]);

    // 2. Insert data baru secara iteratif
    for (const parent of menuTree) {
      await conn.execute(
        "INSERT INTO tbl_akses (roleId, menuId, akses) VALUES (?, ?, ?)",
        [idRole, parent.id, parent.checked ? 1 : 0]
      );

      if (parent.children && Array.isArray(parent.children)) {
        for (const child of parent.children) {
          await conn.execute(
            "INSERT INTO tbl_akses (roleId, menuId, akses) VALUES (?, ?, ?)",
            [idRole, child.id, child.checked ? 1 : 0]
          );
        }
      }
    }

    await conn.commit();
    res.json({ message: "Akses role berhasil diperbarui" });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ message: "Gagal menyimpan akses", error: err.message });
  } finally {
    conn.release();
  }
};

/**
 * Mengambil daftar menu yang diizinkan untuk sidebar berdasarkan email user
 */
const getAksesByUser = async (req, res) => {
  const { email } = req.params;
  try {
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

    res.json([{ heading: "Pages", items }]);
  } catch (err) {
    res.status(500).json({ error: "Server error", details: err.message });
  }
};

module.exports = {
  getAksesRole,
  saveAksesRole,
  getAksesByUser,
};