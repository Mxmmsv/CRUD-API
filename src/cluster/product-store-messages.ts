import type {
  ProductStoreRequestMessage,
  ProductStoreResponseMessage,
  WorkerReadyMessage,
} from "./types.js";

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
