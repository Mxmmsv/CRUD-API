export function getPortFromEnv(): number {
  const port = Number(process.env.PORT);

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(
      "PORT environment variable must be a valid positive integer",
    );
  }

  return port;
}

export function getWorkerCountFromEnv(defaultWorkerCount: number): number {
  if (!process.env.WORKER_COUNT) {
    return defaultWorkerCount;
  }

  const workerCount = Number(process.env.WORKER_COUNT);

  if (!Number.isInteger(workerCount) || workerCount <= 0) {
    throw new Error(
      "WORKER_COUNT environment variable must be a valid positive integer",
    );
  }

  return workerCount;
}
