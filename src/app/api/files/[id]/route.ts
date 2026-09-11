import { createContainer } from "@/application/container";
import { db } from "@/infrastructure/database";

const container = createContainer(db);

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const result = await container.fileRepository.findById(id);
  if (!result) {
    return Response.json({ error: "File not found" }, { status: 404 });
  }
  const body = new Uint8Array(result.data.byteLength);
  body.set(result.data);
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": result.record.mimeType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Length": String(result.record.byteSize),
    },
  });
}
