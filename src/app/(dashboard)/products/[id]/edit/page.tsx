import { notFound } from "next/navigation";
import { createContainer } from "@/application/container";
import { db } from "@/infrastructure/database";
import { EditProductForm } from "./edit-product-form";

const container = createContainer(db);

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await container.savedProductRepository.findById(id);
  if (!product) notFound();

  return (
    <div className="max-w-xl mx-auto flex flex-col gap-4">
      <EditProductForm product={product} />
    </div>
  );
}