import { notFound } from "next/navigation";
import { createContainer } from "@/application/container";
import { db } from "@/infrastructure/database";
import { asInvoiceId } from "@/domain/branding";
import { PrintButton } from "./print-button";

const container = createContainer(db);

export default async function InvoicePreviewPage({
  params,
}: {
  params: Promise<{ companyId: string; id: string }>;
}) {
  const { id } = await params;

  const invoice = await container.invoiceRepository.findByIdWithItems(
    asInvoiceId(id)
  );
  if (!invoice) notFound();

  const pdfUrl = `/api/documents/${id}/pdf?preview=true`;

  return (
    <div className="min-h-screen bg-neutral-100 dark:bg-neutral-900 p-2 sm:p-6 flex flex-col items-center">
      {/* Controls Bar (Hidden on Print) */}
      <div className="w-full max-w-5xl mb-3 flex items-center justify-between print:hidden">
        <span className="text-xs text-muted-foreground font-mono">
          معاينة وتصدير الفاتورة الرسمية (PDF)
        </span>
        <div className="flex items-center gap-2">
          <a
            href={pdfUrl}
            download
            className="text-xs font-semibold px-3 py-1.5 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            تحميل PDF
          </a>
          <PrintButton />
        </div>
      </div>

      {/* PDF Viewer Container */}
      <div className="w-full max-w-5xl h-[850px] bg-white border border-border shadow-lg print:border-none print:shadow-none">
        <iframe
          src={pdfUrl}
          title={`Invoice ${invoice.invoiceNumber ?? id}`}
          className="w-full h-full border-none"
        />
      </div>
    </div>
  );
}