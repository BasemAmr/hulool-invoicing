import fs from "fs";
import * as xlsx from "xlsx";

const wb = xlsx.readFile("scripts/data/products.xlsx");
const sheetName = wb.SheetNames[0];
if (!sheetName) throw new Error("No sheet");
const sheet = wb.Sheets[sheetName];
if (!sheet) throw new Error("No sheet data");
const data = xlsx.utils.sheet_to_json(sheet) as any[];

let sql = "BEGIN;\n";
for (const row of data) {
  const name = String(row["item_name"] || "").replace(/'/g, "''").trim();
  if (!name) continue;
  let price = parseFloat(String(row["item_price"] || "0").replace(/,/g, ""));
  if (isNaN(price)) price = 0;
  const desc = row["item_description"] ? String(row["item_description"]).replace(/'/g, "''").trim() : null;
  sql += `INSERT INTO saved_products (id, name_ar, description, unit_price, vat_rate, is_active, created_at, updated_at) VALUES (gen_random_uuid(), '${name}', ${desc ? `'${desc}'` : "NULL"}, ${price.toFixed(2)}, 0.1500, true, NOW(), NOW());\n`;
}
sql += "COMMIT;\n";

fs.writeFileSync("scripts/data/seed_products.sql", sql, "utf8");
console.log("Generated seed_products.sql successfully with rows:", data.length);
