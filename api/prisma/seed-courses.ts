/** Seed katalog Mata Kuliah kurikulum (idempoten). Jalankan: npx tsx prisma/seed-courses.ts */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const CATALOG: Record<number, string[]> = {
  1: [
    'Pancasila',
    'Bahasa Indonesia',
    'Bahasa Inggris Teknik I',
    'Pendidikan Agama Islam',
    'Ilmu Sosial Budaya Dasar (ISBD)',
    'Matematika Dasar I',
    'Matematika Informatika',
    'Pengantar Sains dan Informatika',
    'Dasar Algoritma dan Pemrograman',
  ],
  2: [
    'Al Islam Kemuhammadiyahan II',
    'Pendidikan Kewarganegaraan',
    'Bahasa Inggris Teknik II',
    'Matematika Dasar 2',
    'Aljabar Linear dan Matriks',
    'Pengantar Pengolahan Citra',
    'Dasar Pemrograman Web',
    'Organisasi dan Arsitektur Komputer',
    'Pengantar Komputasi Modern',
    'Konsep Teknologi Informasi',
    'Algoritma dan Pemrograman',
  ],
  3: [
    'Al Islam Kemuhammadiyahan III',
    'Pemodelan dan Metode Numerik',
    'Aritmatika Komputer',
    'Sistem Basis Data Relasional',
    'Statistika',
    'Rekayasa Perangkat Lunak Skalabilitas',
    'Sistem Operasi',
    'Teori Bahasa dan Otomata',
    'Struktur Data',
    'Strategi dan Simulasi Algoritma',
  ],
  4: [
    'Al Islam Kemuhammadiyahan IV',
    'Kriptografi',
    'Riset Operasional',
    'Sistem Basis Data Modern',
    'Interaksi Manusia dan Komputer',
    'Sistem Informasi Manajemen',
    'Pemrograman Web',
    'Rekayasa Komputasional',
    'Sistem Terdistribusi',
    'Kecerdasan Buatan',
    'Jaringan Komputer',
  ],
  5: [
    'Etika Profesi',
    'Technopreneurship (Kepemimpinan dan Kewirausahaan)',
    'Metodologi Penelitian dan Publikasi Ilmiah',
    'Standarisasi Keselamatan Kerja',
    'Pemrograman Berbasis Objek',
    'Desain dan Analisis Algoritma',
    'Grafik Komputer',
    'Sistem Pakar',
    'Applied Machine Learning',
    'Data Engineering and Big Data Systems',
    'Mathematics for AI',
  ],
  6: [
    'Praktikum Aplikasi Komputasi Bergerak',
    'Praktikum Deep Learning and Neural Networks',
    'Praktikum Generative AI and Large Language Models',
    'Praktikum Natural Language Processing (NLP)',
    'Legal Aspek Produk Teknologi Informasi dan Komunikasi',
    'Algoritma Pemrograman Paralel',
    'Aplikasi Komputasi Bergerak',
    'Teknologi Game',
    'Deep Learning and Neural Networks',
    'Generative AI and Large Language Models',
    'Natural Language Processing (NLP)',
    'MLOps (Machine Learning in Production)',
    'Responsible AI: Ethics and Governance',
  ],
};

async function main() {
  let added = 0;
  for (const [sem, names] of Object.entries(CATALOG)) {
    for (const name of names) {
      const exists = await prisma.course.findFirst({
        where: { name, semester: Number(sem) },
      });
      if (exists) continue;
      await prisma.course.create({ data: { name, semester: Number(sem) } });
      added += 1;
    }
  }
  const total = await prisma.course.count();
  console.log(`Katalog MK: +${added} baru, total ${total}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
