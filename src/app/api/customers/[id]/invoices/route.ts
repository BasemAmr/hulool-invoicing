import { NextResponse } from "next/server";
import { createContainer } from "@/application/container";
import { db } from "@/infrastructure/database";
import { toDecimalString } from "@/domain/value-objects/money";
import type { CustomerId } from "@/domain/branding";

const container = createContainer(db);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10)));
    const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0", 10));

    const [invoices, totalCount, allCompanies] = await Promise.all([
      container.invoiceRepository.listByCustomer(id as CustomerId, limit, offset),
      container.invoiceRepository.countByCustomer(id as CustomerId),
      container.companyRepository.list(200, 0),
    ]);

    const companyMap = new Map<string, string>(
      allCompanies.map((c) => [c.id as string, c.nameAr])
    );

    const items = invoices.map((inv) => ({
      id: inv.id,
      companyId: inv.companyId,
      companyNameAr: companyMap.get(inv.companyId as string) || "منشأة غير معروفة",
      invoiceNumber: inv.invoiceNumber,
      status: inv.status,
      invoiceType: inv.invoiceType,
      issueDate: inv.issueDate,
      issueTime: inv.issueTime || "00:00",
      subtotal: toDecimalString(inv.subtotal),
      vatAmount: toDecimalString(inv.vatAmount),
      total: toDecimalString(inv.total),
      currency: inv.currency,
    }));

    return NextResponse.json({
      invoices: items,
      hasMore: offset + invoices.length < totalCount,
      totalCount,
      nextOffset: offset + invoices.length,
    });
  } catch (error) {
    console.error("Failed to load customer invoices:", error);
    return NextResponse.json(
      { error: "Failed to load customer invoices" },
      { status: 500 }
    );
  }
}
