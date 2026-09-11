export interface FileRecord {
  id: string;
  filename: string;
  mimeType: string;
  byteSize: number;
  createdAt: string;
}

export interface FileRepository {
  create(input: { filename: string; mimeType: string; data: Uint8Array }): Promise<FileRecord>;
  findById(id: string): Promise<{ record: FileRecord; data: Uint8Array } | null>;
}
