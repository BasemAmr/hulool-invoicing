import type { InvoiceItemDto } from "@/application/dto";
import { formatMoney } from "@/lib/format";

export function ItemsTable({ items }: { items: InvoiceItemDto[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-muted-foreground">
          <th className="py-2 text-start font-medium">#</th>
          <th className="py-2 text-start font-medium">الوصف</th>
          <th className="py-2 text-start font-medium">الكمية</th>
          <th className="py-2 text-start font-medium">سعر الوحدة</th>
          <th className="py-2 text-start font-medium">الضريبة</th>
          <th className="py-2 text-start font-medium">الإجمالي</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.position} className="border-b last:border-0">
            <td className="py-2 tabular-nums">{item.position}</td>
            <td className="py-2">{item.description}</td>
            <td className="py-2 tabular-nums">{item.quantity}</td>
            <td className="py-2 tabular-nums">
              {formatMoney(item.unitPrice)}
            </td>
            <td className="py-2 tabular-nums">
              {formatMoney(item.lineVat)}
            </td>
            <td className="py-2 tabular-nums font-medium">
              {formatMoney(item.lineTotal)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
