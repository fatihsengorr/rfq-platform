import { config } from "./config.js";
import { buildServer } from "./server.js";

const server = buildServer();

server
  .listen({ port: config.port, host: config.host })
  .then(() => {
    server.log.info(`API running on http://${config.host}:${config.port}`);
  })
  .catch((error) => {
    server.log.error(error);
    process.exit(1);
  });
