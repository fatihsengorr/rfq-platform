/**
 * Shared application logger.
 * Uses pino (same as Fastify) for structured JSON logging.
 */
import pino from "pino";
import { config } from "./config.js";

export const logger = pino({
  level: config.isProd ? "info" : "debug",
});
