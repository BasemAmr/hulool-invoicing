import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { CustomerForm } from "@/components/forms/customer-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NewCustomerPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">عميل جديد</h1>
        <Link href="/customers">
          <Button variant="ghost">
            <ArrowRight data-icon="inline-start" /> رجوع
          </Button>
        </Link>
      </div>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>بيانات العميل</CardTitle>
        </CardHeader>
        <CardContent>
          <CustomerForm />
        </CardContent>
      </Card>
    </div>
  );
}
