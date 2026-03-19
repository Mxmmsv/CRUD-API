import { UUID } from "node:crypto";

export type Product = {
  id: UUID;
  name: string;
  description: string;
  price: number;
  category: string;
  inStock: boolean;
};

export type ProductPayload = Omit<Product, "id">;
