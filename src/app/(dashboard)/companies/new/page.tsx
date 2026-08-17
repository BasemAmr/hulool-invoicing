import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { CompanyForm } from "@/components/forms/company-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NewCompanyPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">شركة جديدة</h1>
        <Link href="/companies">
          <Button variant="ghost">
            <ArrowRight data-icon="inline-start" /> رجوع
          </Button>
        </Link>
      </div>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>بيانات الشركة</CardTitle>
        </CardHeader>
        <CardContent>
          <CompanyForm />
        </CardContent>
      </Card>
    </div>
  );
}
