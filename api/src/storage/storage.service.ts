import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Client } from 'minio';
import type { Readable } from 'node:stream';

/**
 * Penyimpanan objek bukti kamera di MinIO (S3-compatible).
 * NON-AKTIF bila env MINIO_* belum diisi -> pemanggil fallback simpan bytes di DB.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly log = new Logger('Storage');
  private client: Client | null = null;
  private readonly bucket = process.env.MINIO_BUCKET ?? 'codeunical-evidence';

  private get configured(): boolean {
    return Boolean(
      process.env.MINIO_ENDPOINT &&
        process.env.MINIO_ACCESS_KEY &&
        process.env.MINIO_SECRET_KEY,
    );
  }

  async onModuleInit(): Promise<void> {
    if (!this.configured) {
      this.log.log('MinIO nonaktif (env belum diisi) — bukti kamera disimpan di DB.');
      return;
    }
    try {
      this.client = new Client({
        endPoint: process.env.MINIO_ENDPOINT as string,
        port: Number(process.env.MINIO_PORT ?? 9000),
        useSSL: process.env.MINIO_USE_SSL === 'true',
        accessKey: process.env.MINIO_ACCESS_KEY as string,
        secretKey: process.env.MINIO_SECRET_KEY as string,
      });
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) await this.client.makeBucket(this.bucket);
      this.log.log(`MinIO aktif — bucket "${this.bucket}".`);
    } catch (e) {
      this.log.error(`MinIO init gagal, fallback ke DB: ${String(e)}`);
      this.client = null;
    }
  }

  get ready(): boolean {
    return this.client !== null;
  }

  /** Unggah objek; kembalikan true bila berhasil, false bila MinIO tak siap. */
  async put(key: string, buf: Buffer, mime: string): Promise<boolean> {
    if (!this.client) return false;
    await this.client.putObject(this.bucket, key, buf, buf.length, {
      'Content-Type': mime,
    });
    return true;
  }

  async get(key: string): Promise<Buffer | null> {
    if (!this.client) return null;
    const stream = (await this.client.getObject(this.bucket, key)) as Readable;
    const chunks: Buffer[] = [];
    for await (const c of stream) chunks.push(c as Buffer);
    return Buffer.concat(chunks);
  }

  async remove(key: string): Promise<void> {
    if (!this.client) return;
    await this.client.removeObject(this.bucket, key).catch(() => undefined);
  }
}
