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
  {
    title: 'Jumlah Dua Angka (TypeScript)',
    description:
      'Baca dua bilangan bulat dari input (dipisah spasi), lalu cetak jumlahnya. TypeScript di Node 22.',
    language: 'typescript',
    difficulty: 'mudah',
    starterCode:
      "const [a, b]: number[] = require('fs')\n  .readFileSync(0, 'utf8')\n  .trim()\n  .split(/\\s+/)\n  .map(Number);\n// cetak jumlahnya di sini\n",
    testCases: SUM_CASES,
  },
  {
    title: 'Jumlah Dua Angka (Go)',
    description:
      'Baca dua bilangan bulat dari input (dipisah spasi), lalu cetak jumlahnya. Gunakan Go.',
    language: 'go',
    difficulty: 'mudah',
    starterCode:
      'package main\n\nimport "fmt"\n\nfunc main() {\n\tvar a, b int64\n\tfmt.Scan(&a, &b)\n\t// cetak jumlahnya di sini\n}\n',
    testCases: SUM_CASES,
  },
  {
    title: 'Jumlah Dua Angka (Java)',
    description:
      'Baca dua bilangan bulat dari input (dipisah spasi), lalu cetak jumlahnya. Kelas publik WAJIB bernama Main.',
    language: 'java',
    difficulty: 'mudah',
    starterCode:
      'import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        long a = sc.nextLong(), b = sc.nextLong();\n        // cetak jumlahnya di sini\n    }\n}\n',
    testCases: SUM_CASES,
  },
  {
    title: 'Jumlah Dua Angka (PHP)',
    description:
      'Baca dua bilangan bulat dari input (dipisah spasi), lalu cetak jumlahnya. PHP 8.3 CLI.',
    language: 'php',
    difficulty: 'mudah',
    starterCode: '<?php\nfscanf(STDIN, "%d %d", $a, $b);\n// cetak jumlahnya di sini\n',
    testCases: SUM_CASES,
  },
  {
    title: 'Jumlah Dua Angka (Ruby)',
    description:
      'Baca dua bilangan bulat dari input (dipisah spasi), lalu cetak jumlahnya. Ruby 3.3.',
    language: 'ruby',
    difficulty: 'mudah',
    starterCode: 'a, b = gets.split.map(&:to_i)\n# cetak jumlahnya di sini\n',
    testCases: SUM_CASES,
  },
  {
    title: 'Jumlah Dua Angka (Rust)',
    description:
      'Baca dua bilangan bulat dari input (dipisah spasi), lalu cetak jumlahnya. Rust.',
    language: 'rust',
    difficulty: 'mudah',
    testCases: SUM_CASES,
  },
  {
    title: 'Kartu Profil (HTML/CSS)',
    description:
      'Buat kartu profil sederhana: nama, inisial bulat, dan satu tombol. Gaya bebas (HTML + CSS + JS opsional). Pratinjau langsung tampil di kanan; penilaian oleh penguji.',
    language: 'html',
    difficulty: 'mudah',
    starterCode:
      '<!doctype html>\n<html lang="id">\n<head>\n<meta charset="utf-8" />\n<style>\n  /* tulis gaya di sini */\n  body { font-family: system-ui, sans-serif; padding: 24px; }\n</style>\n</head>\n<body>\n  <!-- buat kartu profil di sini -->\n  <h1>Halo!</h1>\n</body>\n</html>\n',
    testCases: [],
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
