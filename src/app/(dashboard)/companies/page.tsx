import Link from "next/link";
import { Plus } from "lucide-react";

import { createContainer } from "@/application/container";
import { db } from "@/infrastructure/database";
import { DEFAULT_PAGE_SIZE } from "@/domain/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const container = createContainer(db);

export default async function CompaniesPage() {
  const companies = await container.companyRepository.list(DEFAULT_PAGE_SIZE, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">الشركات</h1>
        <Link href="/companies/new">
          <Button>
            <Plus data-icon="inline-start" /> شركة جديدة
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>قائمة الشركات ({companies.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {companies.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              لا توجد شركات بعد. أنشئ أول شركة لتبدأ إصدار الفواتير.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الاسم</TableHead>
                  <TableHead>البادئة</TableHead>
                  <TableHead>الرقم الضريبي</TableHead>
                  <TableHead>المدينة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell className="font-medium">{company.nameAr}</TableCell>
                    <TableCell className="tabular-nums">{company.prefix}</TableCell>
                    <TableCell className="tabular-nums">{company.vatNumber}</TableCell>
                    <TableCell>{company.addressCity ?? "—"}</TableCell>
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
