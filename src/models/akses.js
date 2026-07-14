const { withTransaction } = require("../utils/transaction");

const saveAksesRole = async (idRole, menuTree) =>
  withTransaction(async (connection) => {
    await connection.execute("DELETE FROM tbl_akses WHERE roleId = ?", [idRole]);

    for (const parent of menuTree) {
      await connection.execute(
        "INSERT INTO tbl_akses (roleId, menuId, akses) VALUES (?, ?, ?)",
        [idRole, parent.id, parent.checked ? 1 : 0]
      );

      if (parent.children && Array.isArray(parent.children)) {
        for (const child of parent.children) {
          await connection.execute(
            "INSERT INTO tbl_akses (roleId, menuId, akses) VALUES (?, ?, ?)",
            [idRole, child.id, child.checked ? 1 : 0]
          );
        }
      }
    }
  });

module.exports = { saveAksesRole };
