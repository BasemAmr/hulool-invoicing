import Link from "next/link";
import { Plus } from "lucide-react";

import { createContainer } from "@/application/container";
import { db } from "@/infrastructure/database";
import { DEFAULT_PAGE_SIZE } from "@/domain/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const container = createContainer(db);

export default async function CustomersPage({
  searchParams,
}: PageProps<"/customers">) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim() : null;

  const customers = await container.customerRepository.list(
    query,
    DEFAULT_PAGE_SIZE,
    0,
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">العملاء</h1>
        <Link href="/customers/new">
          <Button>
            <Plus data-icon="inline-start" /> عميل جديد
          </Button>
        </Link>
      </div>

      <form className="max-w-sm">
        <Input name="q" defaultValue={query ?? ""} placeholder="بحث بالاسم أو الجوال..." />
      </form>

      <Card>
        <CardHeader>
          <CardTitle>قائمة العملاء ({customers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {customers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {query ? "لا نتائج مطابقة للبحث." : "لا يوجد عملاء بعد."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الاسم</TableHead>
                  <TableHead>الجوال</TableHead>
                  <TableHead>الرقم الضريبي</TableHead>
                  <TableHead>المدينة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium">{customer.nameAr}</TableCell>
                    <TableCell className="tabular-nums">{customer.phone ?? "—"}</TableCell>
                    <TableCell className="tabular-nums">{customer.vatNumber ?? "—"}</TableCell>
                    <TableCell>{customer.addressCity ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
