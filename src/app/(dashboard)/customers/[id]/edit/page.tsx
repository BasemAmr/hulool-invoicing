import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, User } from "lucide-react";

import { createContainer } from "@/application/container";
import { asCustomerId } from "@/domain/branding";
import { db } from "@/infrastructure/database";
import { CustomerForm } from "@/components/forms/customer-form";
import { Button } from "@/components/ui/button";

const container = createContainer(db);

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await container.customerRepository.findById(asCustomerId(id));

  if (!customer) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6 max-w-xl mx-auto">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <Link href="/customers">
            <Button variant="outline" size="icon-sm" aria-label="رجوع">
              <ArrowRight className="size-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <User className="size-5 text-primary" />
              <span>تعديل بيانات العميل</span>
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              تحديث بيانات {customer.nameAr}
            </p>
          </div>
        </div>
      </div>

      <CustomerForm initialCustomer={customer} />
    </div>
  );
}
