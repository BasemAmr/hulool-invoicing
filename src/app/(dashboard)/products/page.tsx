import { createContainer } from "@/application/container";
import { db } from "@/infrastructure/database";
import { ProductsTableClient } from "@/components/documents/products-table-client";

const container = createContainer(db);

export default async function GlobalProductsPage() {
  const products = await container.savedProductRepository.list(null, 500, 0);

  return <ProductsTableClient products={products} />;
}