import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";

import type { Product } from "../src/storage/index.ts";

type ErrorResponse = {
  message: string;
};

const workerCount = 3;

const createProductPayload = () => ({
  name: "Keyboard",
  description: "Mechanical keyboard",
  price: 120,
  category: "electronics",
  inStock: true,
});

const parseJson = async <T>(response: Response): Promise<T> => (await response.json()) as T;

void test("start:multi shares state between workers", async () => {
  const basePort = await getFreePortBlock(workerCount + 1);
  const multiProcess = spawn(process.execPath, ["--import", "tsx", "src/multi.ts"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(basePort),
      WORKER_COUNT: String(workerCount),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const stderrChunks: Buffer[] = [];

  multiProcess.stderr.on("data", (chunk: Buffer | string) => {
    stderrChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  });

  try {
    await waitForCluster(basePort, multiProcess, stderrChunks);

    const createResponse = await fetch(`http://127.0.0.1:${basePort + 1}/api/products`, {
      body: JSON.stringify(createProductPayload()),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    });

    assert.equal(createResponse.status, 201);

    const createdProduct = await parseJson<Product>(createResponse);

    const getCreatedResponse = await fetch(
      `http://127.0.0.1:${basePort + 2}/api/products/${createdProduct.id}`,
    );

    assert.equal(getCreatedResponse.status, 200);
    assert.deepEqual(await parseJson<Product>(getCreatedResponse), createdProduct);

    const deleteResponse = await fetch(
      `http://127.0.0.1:${basePort + 3}/api/products/${createdProduct.id}`,
      {
        method: "DELETE",
      },
    );

    assert.equal(deleteResponse.status, 204);

    const getDeletedResponse = await fetch(
      `http://127.0.0.1:${basePort + 1}/api/products/${createdProduct.id}`,
    );

    assert.equal(getDeletedResponse.status, 404);
    assert.deepEqual(await parseJson<ErrorResponse>(getDeletedResponse), {
      message: "Product not found",
    });
  } finally {
    multiProcess.kill();

    await once(multiProcess, "exit");
  }
});

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
  const deadline = Date.now() + 15000;

  while (Date.now() < deadline) {
    if (multiProcess.exitCode !== null) {
      throw new Error(readStderr(stderrChunks));
    }

    try {
      const response = await fetch(`http://127.0.0.1:${basePort}/api/products`);

      if (response.status === 200) {
        return;
      }
    } catch {
      await delay(200);
      continue;
    }

    await delay(200);
  }

  throw new Error(readStderr(stderrChunks));
}

function readStderr(stderrChunks: Buffer[]): string {
  return Buffer.concat(stderrChunks).toString("utf8");
}
