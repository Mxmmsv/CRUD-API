import "dotenv/config";

import cluster from "node:cluster";
import { createServer, request } from "node:http";
import { availableParallelism } from "node:os";
import { setTimeout as delay } from "node:timers/promises";
import type { IncomingMessage, ServerResponse } from "node:http";

import {
  isProductStoreRequestMessage,
  isWorkerReadyMessage,
} from "@/cluster/product-store-messages.js";
import { createRoundRobinSelector } from "@/cluster/round-robin.js";
import { getPortFromEnv, getWorkerCountFromEnv } from "@/config/env.js";
import { buildServer } from "@/server.js";
import {
  createInMemoryProductStore,
  createIpcProductStore,
} from "@/storage/product-store.js";
import type {
  ProductStoreRequestMessage,
  ProductStoreResponseMessage,
} from "@/cluster/product-store-messages.js";
import type { ProductStore } from "@/storage/product-store.js";

const defaultWorkerCount = Math.max(1, availableParallelism() - 1);
const basePort = getPortFromEnv();
const workerCount = getWorkerCountFromEnv(defaultWorkerCount);

if (cluster.isPrimary) {
  await startPrimary();
} else {
  await startWorker();
}

async function startPrimary() {
  const store = createInMemoryProductStore();
  const workerPorts = Array.from(
    { length: workerCount },
    (_, index) => basePort + index + 1,
  );
  const readyWorkerPorts = new Set<number>();
  const selectWorkerPort = createRoundRobinSelector(workerPorts);

  for (const workerPort of workerPorts) {
    const worker = cluster.fork({
      ...process.env,
      PORT: process.env.PORT,
      WORKER_PORT: String(workerPort),
    });

    worker.on("message", (message) => {
      void handleWorkerMessage(worker, store, readyWorkerPorts, message);
    });
  }

  await waitForWorkers(workerPorts, readyWorkerPorts);

  const loadBalancer = createServer((incomingRequest, outgoingResponse) => {
    proxyRequest(selectWorkerPort(), incomingRequest, outgoingResponse);
  });

  loadBalancer.listen(basePort);
}

async function startWorker() {
  const workerPort = Number(process.env.WORKER_PORT);
  const app = buildServer({
    store: createIpcProductStore(),
  });

  if (!Number.isInteger(workerPort) || workerPort <= 0) {
    throw new Error(
      "WORKER_PORT environment variable must be a valid positive integer",
    );
  }

  try {
    await app.listen({ port: workerPort });

    process.send?.({
      channel: "cluster-control",
      port: workerPort,
      type: "ready",
    });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

async function handleStoreRequest(
  store: ProductStore,
  requestMessage: ProductStoreRequestMessage,
): Promise<ProductStoreResponseMessage> {
  try {
    switch (requestMessage.operation.type) {
      case "create": {
        const product = await store.create(requestMessage.operation.payload);

        return {
          channel: "product-store",
          data: product,
          ok: true,
          requestId: requestMessage.requestId,
        };
      }

      case "getAll": {
        const products = await store.getAll();

        return {
          channel: "product-store",
          data: products,
          ok: true,
          requestId: requestMessage.requestId,
        };
      }

      case "getById": {
        const product = await store.getById(requestMessage.operation.id);

        return {
          channel: "product-store",
          data: product ?? null,
          ok: true,
          requestId: requestMessage.requestId,
        };
      }

      case "remove": {
        const isDeleted = await store.remove(requestMessage.operation.id);

        return {
          channel: "product-store",
          data: isDeleted,
          ok: true,
          requestId: requestMessage.requestId,
        };
      }

      case "update": {
        const product = await store.update(
          requestMessage.operation.id,
          requestMessage.operation.payload,
        );

        return {
          channel: "product-store",
          data: product ?? null,
          ok: true,
          requestId: requestMessage.requestId,
        };
      }
    }
  } catch (error) {
    return {
      channel: "product-store",
      error: error instanceof Error ? error.message : "Unknown storage error",
      ok: false,
      requestId: requestMessage.requestId,
    };
  }
}

async function handleWorkerMessage(
  worker: cluster.Worker,
  store: ProductStore,
  readyWorkerPorts: Set<number>,
  message: unknown,
) {
  if (isWorkerReadyMessage(message)) {
    readyWorkerPorts.add(message.port);
    return;
  }

  if (!isProductStoreRequestMessage(message)) {
    return;
  }

  const responseMessage = await handleStoreRequest(store, message);

  worker.send(responseMessage);
}

function proxyRequest(
  workerPort: number,
  incomingRequest: IncomingMessage,
  outgoingResponse: ServerResponse,
) {
  const workerRequest = request(
    {
      headers: {
        ...incomingRequest.headers,
        host: `127.0.0.1:${workerPort}`,
      },
      hostname: "127.0.0.1",
      method: incomingRequest.method,
      path: incomingRequest.url,
      port: workerPort,
    },
    (workerResponse) => {
      outgoingResponse.writeHead(
        workerResponse.statusCode ?? 500,
        workerResponse.headers,
      );

      workerResponse.pipe(outgoingResponse);
    },
  );

  workerRequest.on("error", () => {
    outgoingResponse.writeHead(502, {
      "content-type": "application/json",
    });
    outgoingResponse.end(
      JSON.stringify({
        message: `Worker on port ${workerPort} is unavailable`,
      }),
    );
  });

  incomingRequest.pipe(workerRequest);
}

async function waitForWorkers(
  workerPorts: number[],
  readyWorkerPorts: Set<number>,
) {
  while (readyWorkerPorts.size < workerPorts.length) {
    await delay(50);
  }
}
