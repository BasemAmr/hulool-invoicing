import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { createContainer } from "@/application/container";
import { db } from "@/infrastructure/database";
import { DEFAULT_PAGE_SIZE } from "@/domain/constants";
import { InvoiceForm } from "@/components/forms/invoice-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const container = createContainer(db);

export default async function NewInvoicePage() {
  const [companies, customers] = await Promise.all([
    container.companyRepository.list(DEFAULT_PAGE_SIZE, 0),
    container.customerRepository.list(null, DEFAULT_PAGE_SIZE, 0),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">فاتورة جديدة</h1>
        <Link href="/invoices">
          <Button variant="ghost">
            <ArrowRight data-icon="inline-start" /> رجوع
          </Button>
        </Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>بيانات الفاتورة</CardTitle>
        </CardHeader>
        <CardContent>
          {companies.length === 0 || customers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              تحتاج شركة واحدة وعميل واحد على الأقل قبل إنشاء فاتورة — أنشئهما أولاً.
            </p>
          ) : (
            <InvoiceForm
              companies={companies.map((c) => ({ id: c.id, nameAr: c.nameAr, prefix: c.prefix }))}
              customers={customers.map((c) => ({ id: c.id, nameAr: c.nameAr }))}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
