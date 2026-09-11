import { eq } from "drizzle-orm";
import type { Database } from "@/application/tx";
import type { FileRecord, FileRepository } from "@/application/ports/file-repository";
import { uploadedFiles } from "../schema";

export class FileRepositoryImpl implements FileRepository {
  constructor(private readonly db: Database) {}

  async create(input: { filename: string; mimeType: string; data: Uint8Array }): Promise<FileRecord> {
    const now = new Date();
    const [row] = await this.db
      .insert(uploadedFiles)
      .values({
        filename: input.filename,
        mimeType: input.mimeType,
        byteSize: input.data.length,
        data: Buffer.from(input.data),
        createdAt: now,
      })
      .returning({
        id: uploadedFiles.id,
        filename: uploadedFiles.filename,
        mimeType: uploadedFiles.mimeType,
        byteSize: uploadedFiles.byteSize,
        createdAt: uploadedFiles.createdAt,
      });

    if (!row) {
      throw new Error("Failed to insert file");
    }

    return {
      id: row.id,
      filename: row.filename,
      mimeType: row.mimeType,
      byteSize: row.byteSize,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async findById(id: string): Promise<{ record: FileRecord; data: Uint8Array } | null> {
    const [row] = await this.db
      .select()
      .from(uploadedFiles)
      .where(eq(uploadedFiles.id, id));

    if (!row) return null;

    return {
      record: {
        id: row.id,
        filename: row.filename,
        mimeType: row.mimeType,
        byteSize: row.byteSize,
        createdAt: row.createdAt.toISOString(),
      },
      data: new Uint8Array(row.data as any),
    };
  }
}
