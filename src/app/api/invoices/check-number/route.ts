import { NextResponse } from "next/server";
import { createContainer } from "@/application/container";
import { db } from "@/infrastructure/database";

const container = createContainer(db);

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const numberParam = url.searchParams.get("number")?.trim();
    const excludeId = url.searchParams.get("excludeId")?.trim() || undefined;

    if (!numberParam) {
      return NextResponse.json({ available: true, exists: false });
    }

    const existing = await container.invoiceRepository.findByGlobalNumber(
      numberParam,
      excludeId
    );

    return NextResponse.json({
      available: !existing,
      exists: !!existing,
      clashInvoiceId: existing?.id,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to verify invoice number" },
      { status: 500 }
    );
  }
}
