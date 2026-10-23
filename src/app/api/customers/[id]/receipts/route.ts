import { NextResponse } from "next/server";
import { createContainer } from "@/application/container";
import { db } from "@/infrastructure/database";
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

    const [receipts, totalCount, allCompanies] = await Promise.all([
      container.receiptVoucherRepository.listByCustomer(id as CustomerId, limit, offset),
      container.receiptVoucherRepository.countByCustomer(id as CustomerId),
      container.companyRepository.list(200, 0),
    ]);

    const companyMap = new Map<string, string>(
      allCompanies.map((c) => [c.id as string, c.nameAr])
    );

    const items = receipts.map((rec) => ({
      id: rec.id,
      companyId: rec.companyId,
      companyNameAr: companyMap.get(rec.companyId) || "منشأة غير معروفة",
      voucherNumber: rec.voucherNumber,
      voucherDate: rec.voucherDate,
      amount: (rec.amount / 100).toFixed(2),
      paymentMethod: rec.paymentMethod,
      reference: rec.reference,
      notes: rec.notes,
      invoiceId: rec.invoiceId,
    }));

    return NextResponse.json({
      receipts: items,
      hasMore: offset + receipts.length < totalCount,
      totalCount,
      nextOffset: offset + receipts.length,
    });
  } catch (error) {
    console.error("Failed to load customer receipts:", error);
    return NextResponse.json(
      { error: "Failed to load customer receipts" },
      { status: 500 }
    );
  }
}
