import { redirect } from "next/navigation";

export default async function SingularCustomerRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/customers/${id}`);
}
