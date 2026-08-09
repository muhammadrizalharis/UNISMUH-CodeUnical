import { Injectable } from '@nestjs/common';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export interface ExecuteResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  durationMs: number;
}

const DOCKER_PARTS = (process.env.DOCKER_CMD ?? 'sudo -n docker').split(' ');
const DOCKER_BIN = DOCKER_PARTS[0];
const DOCKER_BASE = DOCKER_PARTS.slice(1);
const TIMEOUT_MS = Number(process.env.SANDBOX_TIMEOUT_SECONDS ?? 15) * 1000;
const MEMORY = process.env.SANDBOX_MEMORY ?? '512m';
const MAX_OUTPUT = 100_000;

interface LangSpec {
  /** Nama tampil untuk pesan/UI. */
  label: string;
  /** Image Docker sandbox (baked-in compiler/runtime, tanpa jaringan). */
  image: string;
  /** Nama berkas sumber di dalam /work. */
  file: string;
  /** Perintah yang dijalankan di dalam container. */
  cmd: string[];
  /** Env tambahan (-e KEY=VAL). */
  env: string[];
  /** Opsi mount /tmp. Bahasa terkompilasi butuh `exec` agar biner bisa dijalankan. */
  tmpfs: string;
  /** Override batas memori container (mis. JVM butuh lebih). Default MEMORY. */
  memory?: string;
  /** Override jumlah CPU (mis. build Go lebih cepat). Default '1'. */
  cpus?: string;
  /** Override batas PID (mis. toolchain Go banyak proses). Default '128'. */
  pids?: string;
  /** Override timeout ms (mis. compile Go lambat). Default TIMEOUT_MS. */
  timeoutMs?: number;
}

// Registry bahasa — TAMBAH BAHASA = tambah 1 entri di sini + `docker pull` image-nya.
// Semua berjalan di sandbox yang sama: tanpa jaringan, root read-only, non-root (nobody),
// cap-drop ALL, no-new-privileges, batas memori/cpu/pid, timeout global.
const LANGS: Record<string, LangSpec> = {
  python: {
    label: 'Python 3.12',
    image: process.env.SANDBOX_PYTHON_IMAGE ?? 'python:3.12-slim',
    file: 'main.py',
    cmd: ['python', '/work/main.py'],
    env: ['PYTHONDONTWRITEBYTECODE=1', 'PYTHONUNBUFFERED=1'],
    tmpfs: 'size=64m',
  },
  javascript: {
    label: 'JavaScript (Node 22)',
    image: process.env.SANDBOX_NODE_IMAGE ?? 'node:22-slim',
    file: 'main.js',
    cmd: ['node', '/work/main.js'],
    env: ['NODE_OPTIONS=--max-old-space-size=256'],
    tmpfs: 'size=64m',
  },
  cpp: {
    label: 'C++ (GCC 13, C++17)',
    image: process.env.SANDBOX_GCC_IMAGE ?? 'gcc:13',
    file: 'main.cpp',
    // Compile ke tmpfs lalu exec; jika gagal, stderr g++ ikut tertangkap dan exit != 0.
    cmd: ['sh', '-c', 'g++ -O2 -pipe -std=c++17 -o /tmp/a.out /work/main.cpp && exec /tmp/a.out'],
    env: [],
    tmpfs: 'size=256m,exec',
  },
  c: {
    label: 'C (GCC 13, C11)',
    image: process.env.SANDBOX_GCC_IMAGE ?? 'gcc:13',
    file: 'main.c',
    cmd: ['sh', '-c', 'gcc -O2 -pipe -std=c11 -o /tmp/a.out /work/main.c && exec /tmp/a.out'],
    env: [],
    tmpfs: 'size=256m,exec',
  },
  typescript: {
    label: 'TypeScript (Node 22, strip-types)',
    image: process.env.SANDBOX_NODE_IMAGE ?? 'node:22-slim',
    file: 'main.ts',
    // Node 22 menjalankan .ts langsung (hapus tipe); tanpa type-check (cocok untuk runner).
    cmd: [
      'node',
      '--experimental-strip-types',
      '--disable-warning=ExperimentalWarning',
      '/work/main.ts',
    ],
    env: ['NODE_OPTIONS=--max-old-space-size=256'],
    tmpfs: 'size=64m',
  },
  go: {
    label: 'Go 1.23',
    image: process.env.SANDBOX_GO_IMAGE ?? 'golang:1.23-bookworm',
    file: 'main.go',
    // Batasi paralelisme (-p 4/GOMAXPROCS=4) agar proses tak meledak; link Go tetap ~6s (cache dingin).
    cmd: ['sh', '-c', 'go build -p 4 -o /tmp/a.out /work/main.go && exec /tmp/a.out'],
    // GO111MODULE=off agar berkas tunggal (stdlib) bisa build tanpa go.mod.
    env: ['GO111MODULE=off', 'GOCACHE=/tmp/.gocache', 'GOPATH=/tmp/.gopath', 'GOMAXPROCS=4'],
    tmpfs: 'size=256m,exec',
    cpus: '4',
    pids: '256',
    timeoutMs: 30000,
  },
  java: {
    label: 'Java 21 (Temurin)',
    image: process.env.SANDBOX_JAVA_IMAGE ?? 'eclipse-temurin:21-jdk',
    file: 'Main.java',
    // Kelas publik WAJIB bernama Main. JVM baca .class dari /tmp (tanpa perlu exec).
    cmd: [
      'sh',
      '-c',
      'javac -d /tmp /work/Main.java && exec java -XX:-UsePerfData -Xmx256m -cp /tmp Main',
    ],
    env: [],
    tmpfs: 'size=256m',
    memory: '768m',
  },
};

export const SUPPORTED_LANGUAGES = Object.keys(LANGS);
export const LANGUAGE_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(LANGS).map(([k, v]) => [k, v.label]),
);

@Injectable()
export class ExecuteService {
  isSupported(language: string): boolean {
    return Object.prototype.hasOwnProperty.call(LANGS, language);
  }

  /** Eksekusi kode pada bahasa apa pun yang terdaftar di registry. */
  async run(language: string, code: string, stdin = ''): Promise<ExecuteResult> {
    const spec = LANGS[language];
    if (!spec) {
      return {
        stdout: '',
        stderr: `[executor] Bahasa "${language}" tidak didukung.`,
        exitCode: -1,
        timedOut: false,
        durationMs: 0,
      };
    }
    const dir = await mkdtemp(join(tmpdir(), 'codeunical-'));
    const name = `codeunical-exec-${randomUUID()}`;
    const started = Date.now();
    try {
      await chmod(dir, 0o755);
      await writeFile(join(dir, spec.file), code, 'utf8');
      await chmod(join(dir, spec.file), 0o644);
      const envArgs = spec.env.flatMap((e) => ['-e', e]);
      const runArgs = [
        ...DOCKER_BASE,
        'run', '--rm', '-i', '--name', name,
        '--network', 'none',
        '--memory', spec.memory ?? MEMORY,
        '--cpus', spec.cpus ?? '1', '--pids-limit', spec.pids ?? '128',
        '--read-only', '--tmpfs', `/tmp:${spec.tmpfs}`,
        '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
        '--user', '65534:65534',
        '-e', 'HOME=/tmp',
        ...envArgs,
        '-v', `${dir}:/work:ro`, '-w', '/work',
        spec.image, ...spec.cmd,
      ];
      const result = await this.spawnCollect(
        runArgs,
        name,
        stdin,
        spec.timeoutMs ?? TIMEOUT_MS,
      );
      return { ...result, durationMs: Date.now() - started };
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  /** Kompatibilitas lama: pembungkus tipis ke run('python', ...). */
  async runPython(code: string, stdin = ''): Promise<ExecuteResult> {
    return this.run('python', code, stdin);
  }

  private spawnCollect(
    runArgs: string[],
    name: string,
    stdin: string,
    timeoutMs: number,
  ): Promise<Omit<ExecuteResult, 'durationMs'>> {
    return new Promise((resolve) => {
      const child = spawn(DOCKER_BIN, runArgs, {
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      child.stdin.on('error', () => undefined);
      if (stdin) child.stdin.write(stdin);
      child.stdin.end();
      let stdout = '';
      let stderr = '';
      let timedOut = false;
      child.stdout.on('data', (c: Buffer) => {
        if (stdout.length < MAX_OUTPUT) stdout += c.toString();
      });
      child.stderr.on('data', (c: Buffer) => {
        if (stderr.length < MAX_OUTPUT) stderr += c.toString();
      });
      const timer = setTimeout(() => {
        timedOut = true;
        spawn(DOCKER_BIN, [...DOCKER_BASE, 'kill', name], { stdio: 'ignore' });
      }, timeoutMs);
      child.on('close', (exitCode) => {
        clearTimeout(timer);
        resolve({
          stdout: stdout.slice(0, MAX_OUTPUT),
          stderr: stderr.slice(0, MAX_OUTPUT),
          exitCode,
          timedOut,
        });
      });
      child.on('error', (err) => {
        clearTimeout(timer);
        resolve({
          stdout,
          stderr: `${stderr}\n[executor] ${String(err)}`,
          exitCode: -1,
          timedOut,
        });
      });
    });
  }
}
