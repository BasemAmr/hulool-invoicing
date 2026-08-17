import { formatSar } from "@/lib/format";

/**
 * Renders a DTO money string ("1150.00") as a formatted SAR amount.
 * Takes the decimal string (not halalas) — DTOs never leak branded ints.
 */
export function MoneyText({
  amount,
  className,
}: {
  amount: string;
  className?: string;
}) {
  return <span className={className}>{formatSar(amount)}</span>;
}
