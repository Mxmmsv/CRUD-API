import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createConnection, createServer } from "node:net";
import { availableParallelism } from "node:os";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";

import type { Product } from "../src/storage/index.ts";

type ErrorResponse = {
  message: string;
};

const workerCount = availableParallelism() - 1;
const testIsSkipped = workerCount < 1;

const createProductPayload = () => ({
  name: "Keyboard",
  description: "Mechanical keyboard",
  price: 120,
  category: "electronics",
  inStock: true,
});

const parseJson = async <T>(response: Response): Promise<T> => (await response.json()) as T;

void test(
  "start:multi balances requests across workers in round-robin order",
  { skip: testIsSkipped },
  async () => {
    const basePort = await getFreePortBlock(workerCount + 1);
    const multiProcess = startMultiProcess(basePort);

    try {
      await waitForCluster(basePort, multiProcess.process, multiProcess.stderrChunks);

      const workerPorts = createWorkerPorts(basePort);
      const expectedWorkerPorts = [...workerPorts, workerPorts[0]];

      for (const expectedWorkerPort of expectedWorkerPorts) {
        const response = await fetch(`http://127.0.0.1:${basePort}/api/products`);

        assert.equal(response.status, 200);
        assert.equal(getWorkerPortFromHeader(response), expectedWorkerPort);
      }
    } finally {
      multiProcess.process.kill();

      await once(multiProcess.process, "exit");
    }
  },
);

void test("start:multi shares state between workers", { skip: testIsSkipped }, async () => {
  const basePort = await getFreePortBlock(workerCount + 1);
  const multiProcess = startMultiProcess(basePort);

  try {
    await waitForCluster(basePort, multiProcess.process, multiProcess.stderrChunks);

    const workerPorts = createWorkerPorts(basePort);
    const createWorkerPort = workerPorts.at(0);
    const readWorkerPort = workerPorts.at(1) ?? workerPorts.at(0);
    const deleteWorkerPort = workerPorts.at(2) ?? workerPorts.at(-1);

    if (
      createWorkerPort === undefined ||
      readWorkerPort === undefined ||
      deleteWorkerPort === undefined
    ) {
      throw new Error("Unable to resolve worker ports for the multi-process test");
    }

    const createResponse = await fetch(`http://127.0.0.1:${createWorkerPort}/api/products`, {
      body: JSON.stringify(createProductPayload()),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    });

    assert.equal(createResponse.status, 201);

    const createdProduct = await parseJson<Product>(createResponse);

    const getCreatedResponse = await fetch(
      `http://127.0.0.1:${readWorkerPort}/api/products/${createdProduct.id}`,
    );

    assert.equal(getCreatedResponse.status, 200);
    assert.deepEqual(await parseJson<Product>(getCreatedResponse), createdProduct);

    const deleteResponse = await fetch(
      `http://127.0.0.1:${deleteWorkerPort}/api/products/${createdProduct.id}`,
      {
        method: "DELETE",
      },
    );

    assert.equal(deleteResponse.status, 204);

    const getDeletedResponse = await fetch(
      `http://127.0.0.1:${createWorkerPort}/api/products/${createdProduct.id}`,
    );

    assert.equal(getDeletedResponse.status, 404);
    assert.deepEqual(await parseJson<ErrorResponse>(getDeletedResponse), {
      message: "Product not found",
    });
  } finally {
    multiProcess.process.kill();

    await once(multiProcess.process, "exit");
  }
});

function createWorkerPorts(basePort: number): number[] {
  return Array.from({ length: workerCount }, (_, index) => basePort + index + 1);
}

async function getFreePortBlock(size: number) {
  for (let basePort = 45000; basePort < 65000 - size; basePort += size + 1) {
    const servers = [];

    try {
      for (let offset = 0; offset < size; offset += 1) {
        const server = createServer();

        await new Promise<void>((resolve, reject) => {
          server.once("error", reject);
          server.listen(basePort + offset, "127.0.0.1", () => {
            server.off("error", reject);
            resolve();
          });
        });

        servers.push(server);
      }

      await Promise.all(
        servers.map(
          (server) =>
            new Promise<void>((resolve, reject) => {
              server.close((error) => {
                if (error) {
                  reject(error);
                  return;
                }

                resolve();
              });
            }),
        ),
      );

      return basePort;
    } catch {
      await Promise.all(
        servers.map(
          (server) =>
            new Promise<void>((resolve) => {
              server.close(() => {
                resolve();
              });
            }),
        ),
      );
    }
  }

  throw new Error("Unable to reserve a free port block for multi-process test");
}

async function waitForCluster(
  basePort: number,
  multiProcess: ReturnType<typeof spawn>,
  stderrChunks: Buffer[],
) {
  const deadline = Date.now() + Math.max(15000, workerCount * 1000);

  while (Date.now() < deadline) {
    if (multiProcess.exitCode !== null) {
      throw new Error(readStderr(stderrChunks));
    }

    try {
      await waitForPort(basePort);
      return;
    } catch {
      await delay(200);
      continue;
    }
  }

  throw new Error(readStderr(stderrChunks));
}

function readStderr(stderrChunks: Buffer[]): string {
  return Buffer.concat(stderrChunks).toString("utf8");
}

async function waitForPort(port: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const socket = createConnection({
      host: "127.0.0.1",
      port,
    });

    socket.once("connect", () => {
      socket.end();
      resolve();
    });
    socket.once("error", (error) => {
      socket.destroy();
      reject(error);
    });
  });
}

function getWorkerPortFromHeader(response: Response): number {
  const workerPortHeader = response.headers.get("x-worker-port");

  if (!workerPortHeader) {
    throw new Error("Load balancer response does not include x-worker-port header");
  }

  const workerPort = Number(workerPortHeader);

  if (!Number.isInteger(workerPort)) {
    throw new Error("Load balancer returned an invalid worker port header");
  }

  return workerPort;
}

function startMultiProcess(basePort: number) {
  const processHandle = spawn(process.execPath, ["--import", "tsx", "src/multi.ts"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      EXPOSE_WORKER_PORT: "1",
      PORT: String(basePort),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const stderrChunks: Buffer[] = [];

  processHandle.stderr.on("data", (chunk: Buffer | string) => {
    stderrChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  });

  return {
    process: processHandle,
    stderrChunks,
  };
}
