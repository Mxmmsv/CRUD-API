import { buildServer } from "@/server.js";
import "dotenv/config";

const app = buildServer();

try {
  const port = Number(process.env.PORT);

  if (Number.isNaN(port)) {
    throw new Error("PORT environment variable must be a valid number");
  }

  await app.listen({ port });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
