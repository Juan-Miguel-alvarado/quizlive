import type { UploadImageResponse } from '@quiz/shared';
import { ApiRequestError, SERVER_URL } from './api';
import { hostSession } from './session';

const MAX_SIDE = 1600;
const MAX_GIF_BYTES = 3 * 1024 * 1024;

export const imageUrl = (id: string) => `${SERVER_URL}/api/images/${id}`;

/** Reduce la foto en el navegador (una foto de celular pesa 5 MB; así queda en ~200 KB). */
async function shrink(file: File): Promise<Blob> {
  if (file.type === 'image/gif') {
    if (file.size > MAX_GIF_BYTES) throw new ApiRequestError('El GIF pesa más de 3 MB', 400);
    return file; // se conserva la animación
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new ApiRequestError('No se pudo leer la imagen', 400);
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.82));
  if (!blob) throw new ApiRequestError('No se pudo procesar la imagen', 400);
  return blob;
}

export async function uploadImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new ApiRequestError('El archivo no es una imagen', 400);
  const blob = await shrink(file);
  let res: Response;
  try {
    res = await fetch(`${SERVER_URL}/api/images`, {
      method: 'POST',
      headers: {
        'Content-Type': blob.type || 'application/octet-stream',
        ...(hostSession.get() ? { Authorization: `Bearer ${hostSession.get()}` } : {}),
      },
      body: blob,
    });
  } catch {
    throw new ApiRequestError('No se pudo conectar con el servidor', 0);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiRequestError(body.error ?? `Error ${res.status}`, res.status);
  return (body as UploadImageResponse).id;
}
