require("dotenv").config();

const { createApp } = require("./app");
const { validateServerEnvironment } = require("./config/environment");
const dbPool = require("./config/database");
const { startMqttStatusListener, stopMqttStatusListener } = require("./utils/mqttStatusListener");
const logger = require("./utils/logger");

const closeHttpServer = (server) =>
  new Promise((resolve, reject) => {
    if (!server || !server.listening) {
      resolve();
      return;
    }

    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });

const createGracefulShutdown = ({
  server,
  stopListener = stopMqttStatusListener,
  pool = dbPool,
  exit = process.exit,
  logger: shutdownLogger = logger,
} = {}) => {
  let isShuttingDown = false;

  return async (signal) => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    shutdownLogger.info({ event: "server_shutdown_started", signal }, "Menghentikan server");
    let hasError = false;

    for (const closeResource of [
      () => closeHttpServer(server),
      () => stopListener(),
      () => pool.end(),
    ]) {
      try {
        await closeResource();
      } catch (error) {
        hasError = true;
        shutdownLogger.error({ err: error, event: "server_shutdown_failed", signal }, "Graceful shutdown gagal");
      }
    }

    exit(hasError ? 1 : 0);
  };
};

const registerGracefulShutdown = (shutdown, signalEmitter = process) => {
  for (const signal of ["SIGTERM", "SIGINT"]) {
    signalEmitter.once(signal, () => shutdown(signal));
  }
};

const startServer = ({ environment = process.env, registerShutdown = true } = {}) => {
  validateServerEnvironment(environment);

  const app = createApp({ environment });
  const port = Number(environment.PORT) || 9090;
  const server = app.listen(port, () => {
    logger.info({ event: "server_started", port }, "Server berjalan");
    startMqttStatusListener();
  });

  if (registerShutdown) {
    registerGracefulShutdown(createGracefulShutdown({ server }));
  }

  return server;
};

if (require.main === module) {
  startServer();
}

module.exports = {
  closeHttpServer,
  createGracefulShutdown,
  registerGracefulShutdown,
  startServer,
};
