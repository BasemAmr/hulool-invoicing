import { NextResponse } from "next/server";
import { createContainer } from "@/application/container";
import { db } from "@/infrastructure/database";

const container = createContainer(db);

export async function GET() {
  const customers = await container.customerRepository.list(null, 200, 0);
  return NextResponse.json(customers);
}
