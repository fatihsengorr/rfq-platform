import { buildServer } from "./server.js";

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? "0.0.0.0";

const server = buildServer();

server
  .listen({ port, host })
  .then(() => {
    console.log(`API running on http://${host}:${port}`);
  })
  .catch((error) => {
    server.log.error(error);
    process.exit(1);
  });
