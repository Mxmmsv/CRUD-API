import Fastify from "fastify";

export function buildServer() {
  const app = Fastify({
    logger: true,
  });

  app.get("api/products", async function handler() {
    return { hello: "world" };
  });

  return app;
}
