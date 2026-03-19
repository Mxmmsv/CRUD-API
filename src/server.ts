import Fastify from "fastify";
import { validate as isUuid } from "uuid";
import type { FastifyError } from "fastify";
import type { UUID } from "node:crypto";

import { createInMemoryProductStore } from "@/storage/index.js";
import type { ProductPayload } from "@/storage/index.js";
import type { BuildServerOptions } from "@/types.js";

const productBodySchema = {
  schema: {
    body: {
      type: "object",
      required: ["name", "description", "price", "category", "inStock"],
      additionalProperties: false,
      properties: {
        name: { type: "string" },
        description: { type: "string" },
        price: { type: "number", exclusiveMinimum: 0 },
        category: { type: "string" },
        inStock: { type: "boolean" },
      },
    },
  },
};

export function buildServer({
  store = createInMemoryProductStore(),
}: BuildServerOptions = {}) {
  const app = Fastify({
    logger: true,
  });

  app.get("/api/products", async function handler(request, reply) {
    return reply.code(200).send(await store.getAll());
  });

  app.get<{ Params: { id: UUID } }>(
    "/api/products/:id",
    async (request, reply) => {
      const { id } = request.params;

      if (!isUuid(id)) {
        return reply
          .code(400)
          .send({ message: "Invalid productId. UUID is expected." });
      }

      const product = await store.getById(id);

      if (!product) {
        return reply.code(404).send({ message: "Product not found" });
      }

      return reply.code(200).send(product);
    },
  );

  app.post<{ Body: ProductPayload }>(
    "/api/products",
    productBodySchema,
    async (request, reply) => {
      const product = await store.create(request.body);

      return reply.code(201).send(product);
    },
  );

  app.put<{ Params: { id: UUID }; Body: ProductPayload }>(
    "/api/products/:id",
    productBodySchema,
    async (request, reply) => {
      const { id } = request.params;

      if (!isUuid(id)) {
        return reply
          .code(400)
          .send({ message: "Invalid productId. UUID is expected." });
      }

      const product = await store.update(id, request.body);

      if (!product) {
        return reply.code(404).send({ message: "Product not found" });
      }

      return reply.code(200).send(product);
    },
  );

  app.delete<{ Params: { id: UUID } }>(
    "/api/products/:id",
    async (request, reply) => {
      const { id } = request.params;

      if (!isUuid(id)) {
        return reply
          .code(400)
          .send({ message: "Invalid productId. UUID is expected." });
      }

      const isDeleted = await store.remove(id);

      if (!isDeleted) {
        return reply.code(404).send({ message: "Product not found" });
      }

      return reply.code(204).send();
    },
  );

  app.setNotFoundHandler((request, reply) => {
    return reply.code(404).send({
      message: `Route ${request.method} ${request.url} not found`,
    });
  });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error.validation) {
      return reply.code(400).send({
        message: "Request validation failed",
      });
    }

    request.log.error(error);

    return reply.code(500).send({
      message: "Internal server error",
    });
  });

  return app;
}
