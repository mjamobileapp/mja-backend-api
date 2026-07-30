require("dotenv").config();

const dbPool = require("../src/config/database");

const columnsToAdd = [
  ["actorType", "VARCHAR(20) NULL AFTER kasirId"],
  ["actorId", "BIGINT NULL AFTER actorType"],
  ["actorUsername", "VARCHAR(255) NULL AFTER actorId"],
  ["commandType", "VARCHAR(3) NULL AFTER invoiceNumber"],
];

const migrateMachineLogActor = async (database = dbPool) => {
  const [columns] = await database.execute("SHOW COLUMNS FROM tbl_log_mesin");
  const existingColumns = new Set(columns.map((column) => column.Field));
  const kasirIdColumn = columns.find((column) => column.Field === "kasirId");

  if (kasirIdColumn?.Null !== "YES") {
    await database.query(`ALTER TABLE tbl_log_mesin MODIFY COLUMN kasirId ${kasirIdColumn.Type} NULL`);
  }

  for (const [name, definition] of columnsToAdd) {
    if (!existingColumns.has(name)) {
      await database.query(`ALTER TABLE tbl_log_mesin ADD COLUMN ${name} ${definition}`);
    }
  }

  await database.execute(
    `UPDATE tbl_log_mesin l
     LEFT JOIN tbl_users_mobile u ON u.id = l.kasirId
     SET l.actorType = COALESCE(l.actorType, 'kasir'),
         l.actorId = COALESCE(l.actorId, l.kasirId),
         l.actorUsername = COALESCE(l.actorUsername, u.username)
     WHERE l.kasirId IS NOT NULL`
  );
};

if (require.main === module) {
  migrateMachineLogActor()
    .then(() => console.log("Migrasi audit actor tbl_log_mesin selesai."))
    .catch((error) => {
      console.error("Migrasi audit actor tbl_log_mesin gagal:", error.message);
      process.exitCode = 1;
    })
    .finally(() => dbPool.end());
}

module.exports = { migrateMachineLogActor };
