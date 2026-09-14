import path from "node:path";
import dotenv from "dotenv";
import * as xlsx from "xlsx";
import { db } from "./index";
import { savedProducts } from "./schema";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env.development") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

async function main() {
  const filePath = path.resolve(process.cwd(), "scripts", "data", "products.xlsx");
  console.log(`[Seed Products] Reading Excel file from: ${filePath}`);
  
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("No sheets found in the Excel file");
  }
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error("Sheet not found");
  }
  const data = xlsx.utils.sheet_to_json(sheet) as any[];

  console.log(`[Seed Products] Found ${data.length} rows in the first sheet.`);

  let insertedCount = 0;
  for (const row of data) {
    const itemName = row["item_name"];
    let itemPrice = row["item_price"];
    let itemDescription = row["item_description"] || null;
    let taxRatePercent = row["tax_rate_percent"];

    if (!itemName) continue;

    // Remove any comma in price and parse float
    const priceStr = itemPrice ? String(itemPrice).replace(/,/g, '') : "0";
    let unitPrice = parseFloat(priceStr);
    if (isNaN(unitPrice)) unitPrice = 0;

    // Determine vatRate based on tax_rate_percent
    // If tax_rate_percent is something like 15, we convert it to 0.1500
    // Default is 0.1500
    let vatRate = 0.15;
    if (taxRatePercent !== undefined && taxRatePercent !== null) {
      const parsedTax = parseFloat(String(taxRatePercent).replace(/,/g, ''));
      if (!isNaN(parsedTax)) {
        if (parsedTax > 1) {
          vatRate = parsedTax / 100;
        } else {
          vatRate = parsedTax;
        }
      }
    }

    try {
      await db.insert(savedProducts).values({
        nameAr: itemName.trim(),
        nameEn: null,
        description: itemDescription ? itemDescription.trim() : null,
        unitPrice: unitPrice.toFixed(2),
        vatRate: vatRate.toFixed(4),
        isActive: true,
      });
      insertedCount++;
    } catch (err) {
      console.error(`[Seed Products] Failed to insert product: ${itemName}`, err);
    }
  }

  console.log(`[Seed Products] Inserted ${insertedCount} products successfully.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[Seed Products] Error:", err);
  process.exit(1);
});
