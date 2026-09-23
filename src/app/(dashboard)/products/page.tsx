import { createContainer } from "@/application/container";
import { db } from "@/infrastructure/database";
import { connection } from "next/server";
import { ProductsTableClient } from "@/components/documents/products-table-client";

export const dynamic = "force-dynamic";

const container = createContainer(db);

export default async function GlobalProductsPage() {
  await connection();
  const products = await container.savedProductRepository.list(null, 5000, 0);

  return <ProductsTableClient products={products} />;
}