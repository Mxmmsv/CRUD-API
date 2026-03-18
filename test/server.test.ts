import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../src/server.ts";
import { catalog } from "../src/storage/catalog.ts";

let app: FastifyInstance;

const createProductPayload = () => ({
  name: "Keyboard",
  description: "Mechanical keyboard",
  price: 120,
  category: "electronics",
  inStock: true,
});

beforeEach(() => {
  catalog.length = 0;
  app = buildServer();
});

afterEach(async () => {
  await app.close();
});

test("GET /api/products returns an empty array when catalog is empty", async () => {
  const response = await app.inject({
    method: "GET",
    url: "/api/products",
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), []);
});

test("POST then GET /api/products/:id returns the created product", async () => {
  const createResponse = await app.inject({
    method: "POST",
    url: "/api/products",
    payload: createProductPayload(),
  });

  assert.equal(createResponse.statusCode, 201);

  const createdProduct = createResponse.json();

  const getResponse = await app.inject({
    method: "GET",
    url: `/api/products/${createdProduct.id}`,
  });

  assert.equal(getResponse.statusCode, 200);
  assert.deepEqual(getResponse.json(), createdProduct);
});

test("PUT updates an existing product and DELETE removes it", async () => {
  const createResponse = await app.inject({
    method: "POST",
    url: "/api/products",
    payload: createProductPayload(),
  });

  const createdProduct = createResponse.json();

  const updatePayload = {
    name: "Mouse",
    description: "Wireless mouse",
    price: 80,
    category: "electronics",
    inStock: false,
  };

  const updateResponse = await app.inject({
    method: "PUT",
    url: `/api/products/${createdProduct.id}`,
    payload: updatePayload,
  });

  assert.equal(updateResponse.statusCode, 200);
  assert.deepEqual(updateResponse.json(), {
    id: createdProduct.id,
    ...updatePayload,
  });

  const deleteResponse = await app.inject({
    method: "DELETE",
    url: `/api/products/${createdProduct.id}`,
  });

  assert.equal(deleteResponse.statusCode, 204);

  const getDeletedResponse = await app.inject({
    method: "GET",
    url: `/api/products/${createdProduct.id}`,
  });

  assert.equal(getDeletedResponse.statusCode, 404);
  assert.deepEqual(getDeletedResponse.json(), {
    message: "Product not found",
  });
});

test("invalid product id returns 400", async () => {
  const response = await app.inject({
    method: "GET",
    url: "/api/products/not-a-uuid",
  });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.json(), {
    message: "Invalid productId. UUID is expected.",
  });
});

test("invalid product payload returns 400", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/api/products",
    payload: {
      name: "Keyboard",
      description: "Mechanical keyboard",
      price: 0,
      category: "electronics",
      inStock: true,
    },
  });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.json(), {
    message: "Request validation failed",
  });
});

test("PUT returns 400 for invalid product id", async () => {
  const response = await app.inject({
    method: "PUT",
    url: "/api/products/not-a-uuid",
    payload: createProductPayload(),
  });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.json(), {
    message: "Invalid productId. UUID is expected.",
  });
});

test("DELETE returns 400 for invalid product id", async () => {
  const response = await app.inject({
    method: "DELETE",
    url: "/api/products/not-a-uuid",
  });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.json(), {
    message: "Invalid productId. UUID is expected.",
  });
});

test("PUT returns 404 when product does not exist", async () => {
  const response = await app.inject({
    method: "PUT",
    url: `/api/products/${crypto.randomUUID()}`,
    payload: createProductPayload(),
  });

  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.json(), {
    message: "Product not found",
  });
});

test("DELETE returns 404 when product does not exist", async () => {
  const response = await app.inject({
    method: "DELETE",
    url: `/api/products/${crypto.randomUUID()}`,
  });

  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.json(), {
    message: "Product not found",
  });
});

test("unknown route returns 404 with a human-friendly message", async () => {
  const response = await app.inject({
    method: "GET",
    url: "/some-non/existing/resource",
  });

  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.json(), {
    message: "Route GET /some-non/existing/resource not found",
  });
});

test("server errors return 500 with a human-friendly message", async () => {
  app.get("/api/test-error", async () => {
    throw new Error("boom");
  });

  const response = await app.inject({
    method: "GET",
    url: "/api/test-error",
  });

  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.json(), {
    message: "Internal server error",
  });
});
