/**
 * !!! DESTRUKTIF — reset ke kondisi QA bersih.
 * Hapus: Submission, ExamAttempt (cascade event/keystroke/snapshot), Session,
 * User non-superadmin, semua objek bukti MinIO. Lalu buat QA peserta + QA penguji.
 * Soal (Problem) & super-admin TIDAK dihapus. Jalankan: npx tsx scripts/qa-reset.ts
 */
import 'dotenv/config';
import { randomBytes, scrypt as _scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { PrismaPg } from '@prisma/adapter-pg';
import { Client } from 'minio';
import { PrismaClient } from '../src/generated/prisma/client';

const scrypt = promisify(_scrypt);
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function hash(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString('hex')}`;
}
const genPass = () => randomBytes(9).toString('base64url');

async function clearMinio(): Promise<void> {
  if (!process.env.MINIO_ENDPOINT) return;
  try {
    const mc = new Client({
      endPoint: process.env.MINIO_ENDPOINT,
      port: Number(process.env.MINIO_PORT ?? 9000),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY as string,
      secretKey: process.env.MINIO_SECRET_KEY as string,
    });
    const bucket = process.env.MINIO_BUCKET ?? 'codeunical-evidence';
    const names: string[] = [];
    await new Promise<void>((resolve, reject) => {
      const stream = mc.listObjectsV2(bucket, '', true);
      stream.on('data', (o) => o.name && names.push(o.name));
      stream.on('end', () => resolve());
      stream.on('error', reject);
    });
    if (names.length) await mc.removeObjects(bucket, names);
    console.log(`MinIO: hapus ${names.length} objek bukti.`);
  } catch (e) {
    console.log('MinIO clear dilewati:', String(e));
  }
}

async function main() {
  const sub = await prisma.submission.deleteMany({});
  const att = await prisma.examAttempt.deleteMany({}); // cascade event/keystroke/snapshot
  const ses = await prisma.session.deleteMany({});
  const usr = await prisma.user.deleteMany({ where: { role: { not: 'superadmin' } } });
  console.log(
    `Dibersihkan: submission ${sub.count}, attempt ${att.count}, session ${ses.count}, user ${usr.count}.`,
  );
  await clearMinio();

  const accounts = [
    { email: 'qa.penguji@codeunical.local', name: 'QA Penguji', role: 'penguji' },
    { email: 'qa.peserta@codeunical.local', name: 'QA Peserta', role: 'peserta' },
  ];
  console.log('\n=== AKUN QA (ganti sandi setelah dipakai) ===');
  for (const a of accounts) {
    const pw = genPass();
    await prisma.user.create({
      data: {
        email: a.email,
        name: a.name,
        role: a.role,
        status: 'active',
        passwordHash: await hash(pw),
      },
    });
    console.log(`${a.role.padEnd(8)} | ${a.email} | ${pw}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
