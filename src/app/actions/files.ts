"use server";

import { createContainer } from "@/application/container";
import { db } from "@/infrastructure/database";

const container = createContainer(db);

const ALLOWED_MIMES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

export async function uploadFileAction(formData: FormData): Promise<
  | { status: 'success'; fileId: string; url: string }
  | { status: 'error'; message: string }
> {
  const file = formData.get('file') as File | null;
  if (!file || !(file instanceof File)) {
    return { status: 'error', message: 'لم يتم اختيار ملف' };
  }
  if (!ALLOWED_MIMES.includes(file.type)) {
    return { status: 'error', message: 'نوع الملف غير مدعوم — يُقبل PNG, JPEG, WebP, SVG فقط' };
  }
  if (file.size > MAX_SIZE) {
    return { status: 'error', message: 'حجم الملف يتجاوز 2 ميجابايت' };
  }
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const record = await container.fileRepository.create({
      filename: file.name,
      mimeType: file.type,
      data: bytes,
    });
    return { status: 'success', fileId: record.id, url: `/api/files/${record.id}` };
  } catch {
    return { status: 'error', message: 'تعذّر رفع الملف' };
  }
}
