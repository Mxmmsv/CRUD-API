import "dotenv/config";

import { getPortFromEnv } from "@/config/env.js";

import { buildServer } from "./server.js";

const app = buildServer();

try {
  await app.listen({ port: getPortFromEnv() });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
