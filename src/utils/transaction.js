const dbPool = require("../config/database");
const globalLogger = require("./logger");

const createWithTransaction = (pool) => async (work, logger = globalLogger) => {
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
        logger.error(
          { err: rollbackError, originalErrorMessage: error.message, event: "database_rollback_failed" },
          "Database rollback failed"
        );
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
