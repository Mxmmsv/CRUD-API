import { randomUUID, UUID } from "node:crypto";

import Fastify, { FastifyError } from "fastify";
import { validate as isUuid } from "uuid";

import { catalog } from "@/storage/catalog.js";
import { Product } from "@/storage/types.js";

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

export function buildServer() {
  const app = Fastify({
    logger: true,
  });

  app.get("/api/products", async function handler(request, reply) {
    return reply.code(200).send(catalog);
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

      const product = catalog.find((element) => element.id === id);

      if (!product) {
        return reply.code(404).send({ message: "Product not found" });
      }

      return reply.code(200).send(product);
    },
  );

  app.post<{ Body: Omit<Product, "id"> }>(
    "/api/products",
    productBodySchema,
    async (request, reply) => {
      const { name, description, price, category, inStock } = request.body;

      const product: Product = {
        id: randomUUID(),
        name,
        description,
        price,
        category,
        inStock,
      };

      catalog.push(product);

      return reply.code(201).send(product);
    },
  );

  app.put<{ Params: { id: UUID }; Body: Omit<Product, "id"> }>(
    "/api/products/:id",
    productBodySchema,
    async (request, reply) => {
      const { id } = request.params;
      const { name, description, price, category, inStock } = request.body;

      if (!isUuid(id)) {
        return reply
          .code(400)
          .send({ message: "Invalid productId. UUID is expected." });
      }

      const product = catalog.find((element) => element.id === id);

      if (!product) {
        return reply.code(404).send({ message: "Product not found" });
      }

      product.name = name;
      product.description = description;
      product.price = price;
      product.category = category;
      product.inStock = inStock;

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

      const productIndex = catalog.findIndex((element) => element.id === id);

      if (productIndex === -1) {
        return reply.code(404).send({ message: "Product not found" });
      }

      catalog.splice(productIndex, 1);

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
