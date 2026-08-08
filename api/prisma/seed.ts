import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const existing = await prisma.problem.count();
  if (existing > 0) {
    console.log(`Sudah ada ${existing} soal — seed dilewati.`);
    return;
  }

  await prisma.problem.create({
    data: {
      title: 'Jumlah Dua Angka',
      description:
        'Baca dua bilangan bulat dari input (dipisah spasi dalam satu baris), lalu cetak jumlahnya.',
      language: 'python',
      difficulty: 'mudah',
      starterCode: 'a, b = map(int, input().split())\n# cetak jumlahnya di sini\n',
      testCases: {
        create: [
          { stdin: '2 3\n', expected: '5', hidden: false, points: 1, order: 1 },
          { stdin: '10 20\n', expected: '30', hidden: false, points: 1, order: 2 },
          { stdin: '-5 8\n', expected: '3', hidden: true, points: 1, order: 3 },
          { stdin: '1000000 1\n', expected: '1000001', hidden: true, points: 2, order: 4 },
        ],
      },
    },
  });

  await prisma.problem.create({
    data: {
      title: 'FizzBuzz',
      description:
        'Baca N. Untuk setiap angka 1..N: cetak "Fizz" bila kelipatan 3, "Buzz" bila kelipatan 5, "FizzBuzz" bila keduanya, selain itu cetak angkanya. Satu hasil per baris.',
      language: 'python',
      difficulty: 'sedang',
      starterCode: 'n = int(input())\n# tulis solusimu\n',
      testCases: {
        create: [
          {
            stdin: '5\n',
            expected: '1\n2\nFizz\n4\nBuzz',
            hidden: false,
            points: 1,
            order: 1,
          },
          {
            stdin: '15\n',
            expected:
              '1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz\n13\n14\nFizzBuzz',
            hidden: true,
            points: 2,
            order: 2,
          },
        ],
      },
    },
  });

  console.log('Seed selesai: 2 soal ditambahkan.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
