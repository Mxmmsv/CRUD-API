import type { UUID } from "node:crypto";

export type Product = {
  id: UUID;
  name: string;
  description: string;
  price: number;
  category: string;
  inStock: boolean;
};

export type ProductPayload = Omit<Product, "id">;

export type ProductStore = {
  create(payload: ProductPayload): Promise<Product>;
  getAll(): Promise<Product[]>;
  getById(id: UUID): Promise<Product | undefined>;
  remove(id: UUID): Promise<boolean>;
  update(id: UUID, payload: ProductPayload): Promise<Product | undefined>;
};

export type PendingRequest = {
  reject: (reason?: unknown) => void;
  resolve: (value: unknown) => void;
};
