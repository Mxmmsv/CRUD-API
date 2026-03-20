export function getPortFromEnv(): number {
  const port = Number(process.env.PORT);

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("PORT environment variable must be a valid positive integer");
  }

  return port;
}
