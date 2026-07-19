const dbPool = require("../config/database");
const { getDatabaseTimestamp } = require("../utils/date");

const getAll = () => {
  const SQLQuery = "SELECT * FROM tbl_menu order by createdDate desc";

  return dbPool.execute(SQLQuery);
};

const getById = (id) => {
  // console.log(id);
  const SQLQuery = `Select * from tbl_menu where id=?`;
  return dbPool.execute(SQLQuery, [id]);
};

const createNewMenu = (body) => {
  const dateNow = getDatabaseTimestamp();
  const SQLQuery = `  INSERT INTO tbl_menu
      ( url,
      namaMenu,
      parentId,
      menuParent,
      menuSubParent,
      iconMenu,
      levelMenu,
      tipeMenu,
      noUrut,
      createdBy,
      createdDate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const values = [
      body.url,
      body.namaMenu,
      body.parentId === "" ? null : body.parentId,
      body.menuParent === "" ? null : body.menuParent,
      body.menuSubParent === "" ? null : body.menuSubParent,
      body.iconMenu === "" || body.iconMenu === undefined
        ? null
        : body.iconMenu,
      body.levelMenu,
      body.tipeMenu,
      body.noUrut,
      body.createdBy,
      dateNow,
    ];
  return dbPool.execute(SQLQuery, values);
};

const updateMenu = (body, id) => {
  const modifiedDate = getDatabaseTimestamp();
  const SQLQuery = `
  UPDATE tbl_menu
  SET 
    url = ?,
    namaMenu = ?,
    parentId = ?,
    menuParent = ?,
    menuSubParent =?,
    iconMenu = ?,
    levelMenu = ?,
    tipeMenu = ?,
    noUrut = ?,
    modifiedBy =?,
    modifiedDate=?
  WHERE id = ?
`;

  const values = [
    body.url,
    body.namaMenu,
    body.parentId,
    body.menuParent === "" ? null : body.menuParent,
    body.menuSubParent === "" ? null : body.menuSubParent,
    body.iconMenu === "" || body.iconMenu === undefined ? null : body.iconMenu,
    body.levelMenu,
    body.tipeMenu,
    body.noUrut,
    body.modifiedBy,
    modifiedDate,
    id, // penting! ID untuk tahu record mana yang diupdate
  ];
  // console.log(values);
  return dbPool.execute(SQLQuery, values);
};

const deleteMenu = (id) => {
  const SQLQuery = "DELETE FROM tbl_menu WHERE id = ?";

  return dbPool.execute(SQLQuery, [id]);
};

const getMenuHeader = () => {
  const SQLQuery = "SELECT * FROM tbl_menu WHERE tipeMenu = 'Header'";
  return dbPool.execute(SQLQuery);
};

module.exports = {
  getAll,
  getById,
  createNewMenu,
  updateMenu,
  deleteMenu,
  getMenuHeader,
};
