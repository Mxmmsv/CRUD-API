declare namespace NodeJS {
  interface ProcessEnv {
    PORT: string;
    WORKER_COUNT?: string;
    WORKER_PORT?: string;
  }
}
