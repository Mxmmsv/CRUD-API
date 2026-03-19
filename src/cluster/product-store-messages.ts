import type { UUID } from "node:crypto";

import type { Product, ProductPayload } from "@/storage/types.js";

type ProductStoreOperation =
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

type ProductStoreResponseData = Product | Product[] | boolean | null;

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isProductStoreRequestMessage(
  value: unknown,
): value is ProductStoreRequestMessage {
  return (
    isRecord(value) &&
    value.channel === "product-store" &&
    typeof value.requestId === "string" &&
    isRecord(value.operation) &&
    typeof value.operation.type === "string"
  );
}

export function isProductStoreResponseMessage(
  value: unknown,
): value is ProductStoreResponseMessage {
  return (
    isRecord(value) &&
    value.channel === "product-store" &&
    typeof value.requestId === "string" &&
    typeof value.ok === "boolean" &&
    (value.ok ? "data" in value : typeof value.error === "string")
  );
}

export function isWorkerReadyMessage(
  value: unknown,
): value is WorkerReadyMessage {
  return (
    isRecord(value) &&
    value.channel === "cluster-control" &&
    value.type === "ready" &&
    typeof value.port === "number"
  );
}
