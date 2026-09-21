import express, { Router } from 'express';
import { prisma } from '../lib/prisma';
import type { UploadImageResponse } from '@quiz/shared';

const MAX_BYTES = 3 * 1024 * 1024;

// Se comprueban los primeros bytes: el Content-Type lo manda el cliente y no es confiable.
const SIGNATURES: { mime: string; test: (b: Buffer) => boolean }[] = [
  { mime: 'image/jpeg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/png', test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: 'image/gif', test: (b) => b.subarray(0, 4).toString('ascii') === 'GIF8' },
  {
    mime: 'image/webp',
    test: (b) => b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP',
  },
];

export const imagesRouter = Router();

imagesRouter.post('/', express.raw({ type: 'image/*', limit: MAX_BYTES }), async (req, res) => {
  const body = req.body;
  if (!Buffer.isBuffer(body) || body.length === 0) {
    res.status(400).json({ error: 'Envía una imagen (JPEG, PNG, WebP o GIF)' });
    return;
  }
  const mime = SIGNATURES.find((s) => s.test(body))?.mime;
  if (!mime) {
    res.status(400).json({ error: 'Formato de imagen no soportado' });
    return;
  }
  const image = await prisma.image.create({ data: { mime, data: new Uint8Array(body) }, select: { id: true } });
  res.status(201).json({ id: image.id } satisfies UploadImageResponse);
});

imagesRouter.get('/:id', async (req, res) => {
  const image = await prisma.image.findUnique({ where: { id: req.params.id } });
  if (!image) {
    res.status(404).json({ error: 'Imagen no encontrada' });
    return;
  }
  // Las imágenes nunca cambian (editar = subir otra), así que se pueden cachear para siempre.
  res.set('Content-Type', image.mime).set('Cache-Control', 'public, max-age=31536000, immutable');
  res.send(Buffer.from(image.data));
});

/** Borra imágenes que ninguna pregunta usa (con margen de un día para las recién subidas). */
export async function deleteOrphanImages() {
  await prisma.image.deleteMany({
    where: { questions: { none: {} }, createdAt: { lt: new Date(Date.now() - 24 * 3600_000) } },
  });
}
