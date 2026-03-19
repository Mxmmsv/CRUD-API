declare namespace NodeJS {
  interface ProcessEnv {
    PORT: string;
    EXPOSE_WORKER_PORT?: string;
    WORKER_PORT?: string;
  }
}
