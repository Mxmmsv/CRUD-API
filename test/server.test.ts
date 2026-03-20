import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, test } from "node:test";
import type { FastifyInstance } from "fastify";

import { buildServer } from "../src/server.ts";
import { createInMemoryProductStore } from "../src/storage/index.ts";
import type { Product } from "../src/storage/index.ts";

let app: FastifyInstance;

type ErrorResponse = {
  message: string;
};

const parseBody = <T>(body: string): T => JSON.parse(body) as T;

const createProductPayload = (): Omit<Product, "id"> => ({
  name: "Keyboard",
  description: "Mechanical keyboard",
  price: 120,
  category: "electronics",
  inStock: true,
});

beforeEach(() => {
  app = buildServer({ store: createInMemoryProductStore() });
});

afterEach(async () => {
  await app.close();
});

void test("GET /api/products returns an empty array when catalog is empty", async () => {
  const response = await app.inject({
    method: "GET",
    url: "/api/products",
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(parseBody<Product[]>(response.body), []);
});

void test("POST then GET /api/products/:id returns the created product", async () => {
  const createResponse = await app.inject({
    method: "POST",
    url: "/api/products",
    payload: createProductPayload(),
  });

  assert.equal(createResponse.statusCode, 201);

  const createdProduct = parseBody<Product>(createResponse.body);

  const getResponse = await app.inject({
    method: "GET",
    url: `/api/products/${createdProduct.id}`,
  });

  assert.equal(getResponse.statusCode, 200);
  assert.deepEqual(parseBody<Product>(getResponse.body), createdProduct);
});

void test("PUT updates an existing product and DELETE removes it", async () => {
  const createResponse = await app.inject({
    method: "POST",
    url: "/api/products",
    payload: createProductPayload(),
  });

  const createdProduct = parseBody<Product>(createResponse.body);

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
  assert.deepEqual(parseBody<Product>(updateResponse.body), {
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
  assert.deepEqual(parseBody<ErrorResponse>(getDeletedResponse.body), {
    message: "Product not found",
  });
});

void test("invalid product id returns 400", async () => {
  const response = await app.inject({
    method: "GET",
    url: "/api/products/not-a-uuid",
  });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(parseBody<ErrorResponse>(response.body), {
    message: "Invalid productId. UUID is expected.",
  });
});

void test("invalid product payload returns 400", async () => {
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
  assert.deepEqual(parseBody<ErrorResponse>(response.body), {
    message: "Request validation failed",
  });
});

void test("PUT returns 400 for invalid product id", async () => {
  const response = await app.inject({
    method: "PUT",
    url: "/api/products/not-a-uuid",
    payload: createProductPayload(),
  });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(parseBody<ErrorResponse>(response.body), {
    message: "Invalid productId. UUID is expected.",
  });
});

void test("DELETE returns 400 for invalid product id", async () => {
  const response = await app.inject({
    method: "DELETE",
    url: "/api/products/not-a-uuid",
  });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(parseBody<ErrorResponse>(response.body), {
    message: "Invalid productId. UUID is expected.",
  });
});

void test("PUT returns 404 when product does not exist", async () => {
  const response = await app.inject({
    method: "PUT",
    url: `/api/products/${randomUUID()}`,
    payload: createProductPayload(),
  });

  assert.equal(response.statusCode, 404);
  assert.deepEqual(parseBody<ErrorResponse>(response.body), {
    message: "Product not found",
  });
});

void test("DELETE returns 404 when product does not exist", async () => {
  const response = await app.inject({
    method: "DELETE",
    url: `/api/products/${randomUUID()}`,
  });

  assert.equal(response.statusCode, 404);
  assert.deepEqual(parseBody<ErrorResponse>(response.body), {
    message: "Product not found",
  });
});

void test("unknown route returns 404 with a human-friendly message", async () => {
  const response = await app.inject({
    method: "GET",
    url: "/some-non/existing/resource",
  });

  assert.equal(response.statusCode, 404);
  assert.deepEqual(parseBody<ErrorResponse>(response.body), {
    message: "Route GET /some-non/existing/resource not found",
  });
});

void test("server errors return 500 with a human-friendly message", async () => {
  app.get("/api/test-error", () => {
    throw new Error("boom");
  });

  const response = await app.inject({
    method: "GET",
    url: "/api/test-error",
  });

  assert.equal(response.statusCode, 500);
  assert.deepEqual(parseBody<ErrorResponse>(response.body), {
    message: "Internal server error",
  });
});
