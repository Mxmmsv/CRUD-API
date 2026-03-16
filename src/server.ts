import Fastify from "fastify";
import { validate as isUuid } from "uuid";
import { catalog } from "@/storage/catalog.js";
import { Product } from "@/storage/types.js";

export function buildServer() {
  const app = Fastify({
    logger: true,
  });

  app.get("/api/products", async function handler(request, reply) {
    return reply.code(200).send(catalog);
  });

  app.get<{ Params: { id: string } }>(
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
    {
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
    },
    async (request, reply) => {
      const { name, description, price, category, inStock } = request.body;

      const product: Product = {
        id: crypto.randomUUID(),
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

  return app;
}
