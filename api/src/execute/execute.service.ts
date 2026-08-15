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
// Batas kontainer sandbox yang berjalan bersamaan (anti-lonjakan CPU saat banyak "Run" serentak).
const MAX_CONCURRENT = Math.max(1, Number(process.env.SANDBOX_MAX_CONCURRENT ?? 48));

// Semaphore penghitung: jalankan maksimal N tugas, sisanya antre. Tanpa dependensi.
class Semaphore {
  private active = 0;
  private readonly queue: Array<() => void> = [];
  constructor(private readonly max: number) {}
  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.max) await new Promise<void>((res) => this.queue.push(res));
    this.active++;
    try {
      return await fn();
    } finally {
      this.active--;
      this.queue.shift()?.();
    }
  }
  get inUse(): number {
    return this.active;
  }
  get waiting(): number {
    return this.queue.length;
  }
}
const sandboxLimiter = new Semaphore(MAX_CONCURRENT);

interface CompileSpec {
  /** Perintah menghasilkan artefak di /out (mis. /out/a.out) dari /work/<file>. */
  cmd: string[];
  /** Opsi mount /tmp container compile. Default 'size=256m,exec'. */
  tmpfs?: string;
  /** CPU untuk compile (mis. Go). Default '1'. */
  cpus?: string;
  /** Batas PID untuk compile (mis. toolchain Go). Default '128'. */
  pids?: string;
  /** Timeout compile ms (mis. Go lambat). Default TIMEOUT_MS. */
  timeoutMs?: number;
}

interface LangSpec {
  /** Nama tampil untuk pesan/UI. */
  label: string;
  /** Image Docker sandbox (baked-in compiler/runtime, tanpa jaringan). */
  image: string;
  /** Nama berkas sumber di dalam /work. */
  file: string;
  /** Env untuk container (compile & run). */
  env: string[];
  /** Opsi mount /tmp untuk container RUN. */
  tmpfs: string;
  /** Perintah RUN. Interpreted: jalankan /work/<file>. Terkompilasi: exec artefak di /run. */
  runCmd: string[];
  /** Jika ADA -> bahasa terkompilasi: compile SEKALI, jalankan artefak berkali-kali. */
  compile?: CompileSpec;
  /** Override batas memori container (mis. JVM). Default MEMORY. */
  memory?: string;
  /** CPU untuk RUN. Default '1'. */
  cpus?: string;
  /** Batas PID untuk RUN. Default '128'. */
  pids?: string;
}

// Registry bahasa — TAMBAH BAHASA = tambah 1 entri di sini + `docker pull` image-nya.
// Semua berjalan di sandbox yang sama: tanpa jaringan, root read-only, non-root (nobody),
// cap-drop ALL, no-new-privileges, batas memori/cpu/pid, timeout. Bahasa terkompilasi
// (ada `compile`) dikompilasi SEKALI ke artefak lalu artefaknya dijalankan tiap test case.
const LANGS: Record<string, LangSpec> = {
  python: {
    label: 'Python 3.12',
    image: process.env.SANDBOX_PYTHON_IMAGE ?? 'python:3.12-slim',
    file: 'main.py',
    runCmd: ['python', '/work/main.py'],
    env: ['PYTHONDONTWRITEBYTECODE=1', 'PYTHONUNBUFFERED=1'],
    tmpfs: 'size=64m',
  },
  javascript: {
    label: 'JavaScript (Node 22)',
    image: process.env.SANDBOX_NODE_IMAGE ?? 'node:22-slim',
    file: 'main.js',
    runCmd: ['node', '/work/main.js'],
    env: ['NODE_OPTIONS=--max-old-space-size=256'],
    tmpfs: 'size=64m',
  },
  typescript: {
    label: 'TypeScript (Node 22, strip-types)',
    image: process.env.SANDBOX_NODE_IMAGE ?? 'node:22-slim',
    file: 'main.ts',
    // Node 22 menjalankan .ts langsung (hapus tipe); tanpa type-check (cocok untuk runner).
    runCmd: [
      'node',
      '--experimental-strip-types',
      '--disable-warning=ExperimentalWarning',
      '/work/main.ts',
    ],
    env: ['NODE_OPTIONS=--max-old-space-size=256'],
    tmpfs: 'size=64m',
  },
  cpp: {
    label: 'C++ (GCC 13, C++17)',
    image: process.env.SANDBOX_GCC_IMAGE ?? 'gcc:13',
    file: 'main.cpp',
    compile: {
      cmd: ['g++', '-O2', '-pipe', '-std=c++17', '-o', '/out/a.out', '/work/main.cpp'],
    },
    runCmd: ['/run/a.out'],
    env: [],
    tmpfs: 'size=64m',
  },
  c: {
    label: 'C (GCC 13, C11)',
    image: process.env.SANDBOX_GCC_IMAGE ?? 'gcc:13',
    file: 'main.c',
    compile: {
      cmd: ['gcc', '-O2', '-pipe', '-std=c11', '-o', '/out/a.out', '/work/main.c'],
    },
    runCmd: ['/run/a.out'],
    env: [],
    tmpfs: 'size=64m',
  },
  go: {
    label: 'Go 1.23',
    image: process.env.SANDBOX_GO_IMAGE ?? 'golang:1.23-bookworm',
    file: 'main.go',
    // Compile SEKALI: link Go ~6-12s (cache dingin); batasi paralelisme agar proses tak meledak.
    compile: {
      cmd: ['go', 'build', '-p', '4', '-o', '/out/a.out', '/work/main.go'],
      cpus: '4',
      pids: '256',
      timeoutMs: 30000,
    },
    runCmd: ['/run/a.out'],
    // GO111MODULE=off agar berkas tunggal (stdlib) bisa build tanpa go.mod.
    env: ['GO111MODULE=off', 'GOCACHE=/tmp/.gocache', 'GOPATH=/tmp/.gopath', 'GOMAXPROCS=4'],
    tmpfs: 'size=64m',
  },
  java: {
    label: 'Java 21 (Temurin)',
    image: process.env.SANDBOX_JAVA_IMAGE ?? 'eclipse-temurin:21-jdk',
    file: 'Main.java',
    // Kelas publik WAJIB bernama Main. Compile -> /out/*.class; run: java -cp /run Main.
    compile: {
      cmd: ['javac', '-d', '/out', '/work/Main.java'],
    },
    runCmd: ['java', '-XX:-UsePerfData', '-Xmx256m', '-cp', '/run', 'Main'],
    env: [],
    tmpfs: 'size=256m',
    memory: '768m',
  },
  php: {
    label: 'PHP 8.3',
    image: process.env.SANDBOX_PHP_IMAGE ?? 'php:8.3-cli',
    file: 'main.php',
    runCmd: ['php', '/work/main.php'],
    env: [],
    tmpfs: 'size=64m',
  },
  ruby: {
    label: 'Ruby 3.3',
    image: process.env.SANDBOX_RUBY_IMAGE ?? 'ruby:3.3-slim',
    file: 'main.rb',
    runCmd: ['ruby', '/work/main.rb'],
    env: [],
    tmpfs: 'size=64m',
  },
  rust: {
    label: 'Rust 1 (edition 2021)',
    image: process.env.SANDBOX_RUST_IMAGE ?? 'rust:1-slim',
    file: 'main.rs',
    compile: {
      cmd: ['rustc', '-O', '-o', '/out/a.out', '/work/main.rs'],
    },
    runCmd: ['/run/a.out'],
    env: [],
    tmpfs: 'size=64m',
  },
  sql: {
    label: 'SQL (SQLite)',
    image: process.env.SANDBOX_SQLITE_IMAGE ?? 'codeunical-sqlite:latest',
    file: 'main.sql',
    // Jalankan skema+query di DB in-memory; kolom dipisah '|', tanpa header (deterministik).
    runCmd: ['sh', '-c', 'sqlite3 -batch -noheader :memory: < /work/main.sql'],
    env: [],
    tmpfs: 'size=32m',
  },
};

export const SUPPORTED_LANGUAGES = Object.keys(LANGS);
export const LANGUAGE_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(LANGS).map(([k, v]) => [k, v.label]),
);

/** Konteks hasil prepare (dipakai berulang oleh grading, opaque bagi pemanggil). */
export interface PrepContext {
  spec: LangSpec;
  workDir: string;
  outDir: string | null;
}
export type PrepareResult =
  | { ok: true; ctx: PrepContext }
  | { ok: false; result: ExecuteResult };

@Injectable()
export class ExecuteService {
  isSupported(language: string): boolean {
    return Object.prototype.hasOwnProperty.call(LANGS, language);
  }

  /** Siapkan eksekusi: tulis sumber, dan untuk bahasa terkompilasi COMPILE sekali ke artefak. */
  async prepare(language: string, code: string): Promise<PrepareResult> {
    const spec = LANGS[language];
    if (!spec) {
      return {
        ok: false,
        result: {
          stdout: '',
          stderr: `[executor] Bahasa "${language}" tidak didukung.`,
          exitCode: -1,
          timedOut: false,
          durationMs: 0,
        },
      };
    }
    const workDir = await mkdtemp(join(tmpdir(), 'cu-src-'));
    await chmod(workDir, 0o755);
    await writeFile(join(workDir, spec.file), code, 'utf8');
    await chmod(join(workDir, spec.file), 0o644);

    if (!spec.compile) {
      return { ok: true, ctx: { spec, workDir, outDir: null } };
    }

    const outDir = await mkdtemp(join(tmpdir(), 'cu-out-'));
    await chmod(outDir, 0o777); // compiler (uid 65534) menulis artefak di sini
    const name = `cu-cc-${randomUUID()}`;
    const timeout = spec.compile.timeoutMs ?? TIMEOUT_MS;
    const args = this.dockerArgs({
      name,
      image: spec.image,
      cmd: spec.compile.cmd,
      env: spec.env,
      memory: spec.memory ?? MEMORY,
      cpus: spec.compile.cpus ?? '1',
      pids: spec.compile.pids ?? '128',
      tmpfs: spec.compile.tmpfs ?? 'size=256m,exec',
      mounts: ['-v', `${workDir}:/work:ro`, '-v', `${outDir}:/out`],
      workdir: '/work',
    });
    const cc = await this.spawnCollect(args, name, '', timeout);
    if (cc.timedOut || cc.exitCode !== 0) {
      await this.cleanupDirs(workDir, outDir);
      return {
        ok: false,
        result: {
          stdout: '',
          stderr: cc.timedOut
            ? `[compile] Waktu kompilasi habis (> ${timeout / 1000}s).`
            : cc.stderr || '[compile] Gagal kompilasi.',
          exitCode: cc.exitCode ?? 1,
          timedOut: cc.timedOut,
          durationMs: 0,
        },
      };
    }
    return { ok: true, ctx: { spec, workDir, outDir } };
  }

  /** Jalankan SATU eksekusi dari konteks yang sudah disiapkan (artefak/sumber dipakai ulang). */
  async runPrepared(ctx: PrepContext, stdin = ''): Promise<ExecuteResult> {
    const { spec, workDir, outDir } = ctx;
    const name = `cu-run-${randomUUID()}`;
    const started = Date.now();
    const args = this.dockerArgs({
      name,
      image: spec.image,
      cmd: spec.runCmd,
      env: spec.env,
      memory: spec.memory ?? MEMORY,
      cpus: spec.cpus ?? '1',
      pids: spec.pids ?? '128',
      tmpfs: spec.tmpfs,
      // Terkompilasi: hanya artefak (/run:ro), TANPA sumber & TANPA compiler. Interpreted: sumber /work.
      mounts: outDir
        ? ['-v', `${outDir}:/run:ro`]
        : ['-v', `${workDir}:/work:ro`],
      workdir: outDir ? '/tmp' : '/work',
    });
    const r = await this.spawnCollect(args, name, stdin, TIMEOUT_MS);
    return { ...r, durationMs: Date.now() - started };
  }

  /** Hapus direktori sementara milik konteks. */
  async cleanup(ctx: PrepContext): Promise<void> {
    await this.cleanupDirs(ctx.workDir, ctx.outDir);
  }

  private async cleanupDirs(...dirs: (string | null)[]): Promise<void> {
    await Promise.all(
      dirs
        .filter((d): d is string => Boolean(d))
        .map((d) => rm(d, { recursive: true, force: true }).catch(() => undefined)),
    );
  }

  /** Eksekusi sekali-jalan (endpoint /execute): prepare -> run -> cleanup. */
  async run(language: string, code: string, stdin = ''): Promise<ExecuteResult> {
    const prep = await this.prepare(language, code);
    if (!prep.ok) return prep.result;
    try {
      return await this.runPrepared(prep.ctx, stdin);
    } finally {
      await this.cleanup(prep.ctx);
    }
  }

  /** Kompatibilitas lama: pembungkus tipis ke run('python', ...). */
  async runPython(code: string, stdin = ''): Promise<ExecuteResult> {
    return this.run('python', code, stdin);
  }

  private dockerArgs(opts: {
    name: string;
    image: string;
    cmd: string[];
    env: string[];
    memory: string;
    cpus: string;
    pids: string;
    tmpfs: string;
    mounts: string[];
    workdir: string;
  }): string[] {
    const envArgs = opts.env.flatMap((e) => ['-e', e]);
    return [
      ...DOCKER_BASE,
      'run', '--rm', '-i', '--name', opts.name,
      '--network', 'none',
      '--memory', opts.memory,
      '--cpus', opts.cpus, '--pids-limit', opts.pids,
      '--read-only', '--tmpfs', `/tmp:${opts.tmpfs}`,
      '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
      '--user', '65534:65534',
      '-e', 'HOME=/tmp',
      ...envArgs,
      ...opts.mounts,
      '-w', opts.workdir,
      opts.image, ...opts.cmd,
    ];
  }

  private spawnCollect(
    runArgs: string[],
    name: string,
    stdin: string,
    timeoutMs: number,
  ): Promise<Omit<ExecuteResult, 'durationMs'>> {
    // Tiap kontainer sandbox memakai 1 slot; sisanya antre (jaga CPU saat banyak "Run" serentak).
    return sandboxLimiter.run(() => new Promise((resolve) => {
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
    }));
  }
}
