import { randomUUID } from "node:crypto";
import type { UUID } from "node:crypto";

import { isProductStoreResponseMessage } from "@/cluster/product-store-messages.js";
import type { ProductStoreRequestMessage } from "@/cluster/product-store-messages.js";

import type { Product, ProductPayload } from "./types.js";

export type ProductStore = {
  create(payload: ProductPayload): Promise<Product>;
  getAll(): Promise<Product[]>;
  getById(id: UUID): Promise<Product | undefined>;
  remove(id: UUID): Promise<boolean>;
  update(id: UUID, payload: ProductPayload): Promise<Product | undefined>;
};

export function createInMemoryProductStore(): ProductStore {
  const catalog: Product[] = [];

  return {
    create(payload) {
      const product: Product = {
        id: randomUUID(),
        ...payload,
      };

      catalog.push(product);

      return Promise.resolve(structuredClone(product));
    },
    getAll() {
      return Promise.resolve(structuredClone(catalog));
    },
    getById(id) {
      const product = catalog.find((element) => element.id === id);

      return Promise.resolve(product ? structuredClone(product) : undefined);
    },
    remove(id) {
      const productIndex = catalog.findIndex((element) => element.id === id);

      if (productIndex === -1) {
        return Promise.resolve(false);
      }

      catalog.splice(productIndex, 1);

      return Promise.resolve(true);
    },
    update(id, payload) {
      const product = catalog.find((element) => element.id === id);

      if (!product) {
        return Promise.resolve(undefined);
      }

      product.name = payload.name;
      product.description = payload.description;
      product.price = payload.price;
      product.category = payload.category;
      product.inStock = payload.inStock;

      return Promise.resolve(structuredClone(product));
    },
  };
}

type PendingRequest = {
  reject: (reason?: unknown) => void;
  resolve: (value: unknown) => void;
};

export function createIpcProductStore(): ProductStore {
  const pendingRequests = new Map<string, PendingRequest>();

  const handleMessage = (message: unknown) => {
    if (!isProductStoreResponseMessage(message)) {
      return;
    }

    const pendingRequest = pendingRequests.get(message.requestId);

    if (!pendingRequest) {
      return;
    }

    pendingRequests.delete(message.requestId);

    if (message.ok) {
      pendingRequest.resolve(message.data);
      return;
    }

    pendingRequest.reject(new Error(message.error));
  };

  const sendRequest = (
    operation: ProductStoreRequestMessage["operation"],
  ): Promise<unknown> => {
    if (!process.send) {
      return Promise.reject(new Error("IPC channel is not available"));
    }

    const requestId = randomUUID();
    const requestMessage: ProductStoreRequestMessage = {
      channel: "product-store",
      operation,
      requestId,
    };

    return new Promise((resolve, reject) => {
      pendingRequests.set(requestId, {
        reject,
        resolve,
      });

      process.send?.(requestMessage, (error) => {
        if (!error) {
          return;
        }

        pendingRequests.delete(requestId);
        reject(error);
      });
    });
  };

  process.on("message", handleMessage);

  return {
    async create(payload: ProductPayload): Promise<Product> {
      return (await sendRequest({
        type: "create",
        payload,
      })) as Product;
    },
    async getAll(): Promise<Product[]> {
      return (await sendRequest({
        type: "getAll",
      })) as Product[];
    },
    async getById(id: UUID): Promise<Product | undefined> {
      const product = (await sendRequest({
        type: "getById",
        id,
      })) as Product | null;

      return product ?? undefined;
    },
    async remove(id: UUID): Promise<boolean> {
      return (await sendRequest({
        type: "remove",
        id,
      })) as boolean;
    },
    async update(
      id: UUID,
      payload: ProductPayload,
    ): Promise<Product | undefined> {
      const product = (await sendRequest({
        type: "update",
        id,
        payload,
      })) as Product | null;

      return product ?? undefined;
    },
  };
}
