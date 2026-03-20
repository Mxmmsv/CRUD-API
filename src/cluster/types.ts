import type { UUID } from "node:crypto";

import type { Product, ProductPayload } from "@/storage/types.js";

export type ProductStoreOperation =
  | {
      type: "getAll";
    }
  | {
      type: "getById";
      id: UUID;
    }
  | {
      type: "create";
      payload: ProductPayload;
    }
  | {
      type: "update";
      id: UUID;
      payload: ProductPayload;
    }
  | {
      type: "remove";
      id: UUID;
    };

export type ProductStoreResponseData = Product | Product[] | boolean | null;

export type ProductStoreRequestMessage = {
  channel: "product-store";
  operation: ProductStoreOperation;
  requestId: string;
};

export type ProductStoreResponseMessage =
  | {
      channel: "product-store";
      data: ProductStoreResponseData;
      ok: true;
      requestId: string;
    }
  | {
      channel: "product-store";
      error: string;
      ok: false;
      requestId: string;
    };

export type WorkerReadyMessage = {
  channel: "cluster-control";
  port: number;
  type: "ready";
};
