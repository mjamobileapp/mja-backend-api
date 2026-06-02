const dbPool = require("../config/database");

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
  console.log(body);
  try {
    const dateNow = new Date().toISOString().slice(0, 19).replace("T", " ");
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
  } catch (error) {
    throw new Error("Failed to create new Code: " + error.message);
  }
};

const updateMenu = (body, id) => {
  // console.log("id user: " + id);

  console.log(body);
  const dateNow = new Date().toISOString().slice(0, 19).replace("T", " ");
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
    createdBy =?,
    createdDate=?
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
    body.createdBy, // ganti dari createdBy ke updatedBy
    dateNow,
    id, // penting! ID untuk tahu record mana yang diupdate
  ];
  // console.log(values);
  return dbPool.execute(SQLQuery, values);
};

const deleteMenu = (id) => {
  const SQLQuery = `DELETE FROM tbl_menu WHERE id=${id}`;

  return dbPool.execute(SQLQuery);
};

module.exports = {
  getAll,
  getById,
  createNewMenu,
  updateMenu,
  deleteMenu,
};
