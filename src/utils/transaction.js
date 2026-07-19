const dbPool = require("../config/database");

const createWithTransaction = (pool) => async (work) => {
  if (typeof work !== "function") {
    throw new TypeError("Transaction work must be a function");
  }

  const connection = await pool.getConnection();
  let transactionStarted = false;

  try {
    await connection.beginTransaction();
    transactionStarted = true;

    const result = await work(connection);

    await connection.commit();
    transactionStarted = false;

    return result;
  } catch (error) {
    if (transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Database rollback failed", {
          message: rollbackError.message,
          originalError: error.message,
        });
      }
    }

    throw error;
  } finally {
    connection.release();
  }
};

const withTransaction = createWithTransaction(dbPool);

module.exports = {
  createWithTransaction,
  withTransaction,
};
