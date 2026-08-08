import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

interface TC {
  stdin: string;
  expected: string;
  hidden: boolean;
  points: number;
  order: number;
}
interface ProblemSpec {
  title: string;
  description: string;
  language: string;
  difficulty: string;
  starterCode: string;
  testCases: TC[];
}

// Kontrak I/O sama untuk semua bahasa "Jumlah Dua Angka" agar mudah diuji lintas runner.
const SUM_CASES: TC[] = [
  { stdin: '2 3\n', expected: '5', hidden: false, points: 1, order: 1 },
  { stdin: '10 20\n', expected: '30', hidden: false, points: 1, order: 2 },
  { stdin: '-5 8\n', expected: '3', hidden: true, points: 1, order: 3 },
  { stdin: '1000000 1\n', expected: '1000001', hidden: true, points: 2, order: 4 },
];

const PROBLEMS: ProblemSpec[] = [
  {
    title: 'Jumlah Dua Angka',
    description:
      'Baca dua bilangan bulat dari input (dipisah spasi dalam satu baris), lalu cetak jumlahnya.',
    language: 'python',
    difficulty: 'mudah',
    starterCode: 'a, b = map(int, input().split())\n# cetak jumlahnya di sini\n',
    testCases: SUM_CASES,
  },
  {
    title: 'FizzBuzz',
    description:
      'Baca N. Untuk setiap angka 1..N: cetak "Fizz" bila kelipatan 3, "Buzz" bila kelipatan 5, "FizzBuzz" bila keduanya, selain itu cetak angkanya. Satu hasil per baris.',
    language: 'python',
    difficulty: 'sedang',
    starterCode: 'n = int(input())\n# tulis solusimu\n',
    testCases: [
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
  {
    title: 'Jumlah Dua Angka (JavaScript)',
    description:
      'Baca dua bilangan bulat dari input (dipisah spasi), lalu cetak jumlahnya. Gunakan Node.js.',
    language: 'javascript',
    difficulty: 'mudah',
    starterCode:
      "const [a, b] = require('fs')\n  .readFileSync(0, 'utf8')\n  .trim()\n  .split(/\\s+/)\n  .map(Number);\n// cetak jumlahnya di sini\n",
    testCases: SUM_CASES,
  },
  {
    title: 'Jumlah Dua Angka (C++)',
    description:
      'Baca dua bilangan bulat dari input (dipisah spasi), lalu cetak jumlahnya. Gunakan C++17.',
    language: 'cpp',
    difficulty: 'mudah',
    starterCode:
      '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    long long a, b;\n    cin >> a >> b;\n    // cetak jumlahnya di sini\n    return 0;\n}\n',
    testCases: SUM_CASES,
  },
];

async function main() {
  let added = 0;
  for (const spec of PROBLEMS) {
    const exists = await prisma.problem.findFirst({
      where: { title: spec.title },
      select: { id: true },
    });
    if (exists) {
      console.log(`Lewati (sudah ada): ${spec.title}`);
      continue;
    }
    await prisma.problem.create({
      data: {
        title: spec.title,
        description: spec.description,
        language: spec.language,
        difficulty: spec.difficulty,
        starterCode: spec.starterCode,
        testCases: { create: spec.testCases },
      },
    });
    added += 1;
    console.log(`Ditambahkan: ${spec.title} [${spec.language}]`);
  }
  console.log(`Seed selesai: ${added} soal baru ditambahkan.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
