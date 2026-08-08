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
const PYTHON_IMAGE = process.env.SANDBOX_PYTHON_IMAGE ?? 'python:3.12-slim';
const TIMEOUT_MS = Number(process.env.SANDBOX_TIMEOUT_SECONDS ?? 15) * 1000;
const MEMORY = process.env.SANDBOX_MEMORY ?? '512m';
const MAX_OUTPUT = 100_000;

@Injectable()
export class ExecuteService {
  async runPython(code: string, stdin = ''): Promise<ExecuteResult> {
    const dir = await mkdtemp(join(tmpdir(), 'codeunical-'));
    const name = `codeunical-exec-${randomUUID()}`;
    const started = Date.now();
    try {
      await chmod(dir, 0o755);
      await writeFile(join(dir, 'main.py'), code, 'utf8');
      await chmod(join(dir, 'main.py'), 0o644);
      const runArgs = [
        ...DOCKER_BASE,
        'run', '--rm', '-i', '--name', name,
        '--network', 'none',
        '--memory', MEMORY, '--cpus', '1', '--pids-limit', '128',
        '--read-only', '--tmpfs', '/tmp:size=64m',
        '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
        '--user', '65534:65534',
        '-e', 'HOME=/tmp', '-e', 'PYTHONDONTWRITEBYTECODE=1',
        '-v', `${dir}:/work:ro`, '-w', '/work',
        PYTHON_IMAGE, 'python', '/work/main.py',
      ];
      const result = await this.spawnCollect(runArgs, name, stdin);
      return { ...result, durationMs: Date.now() - started };
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  private spawnCollect(
    runArgs: string[],
    name: string,
    stdin: string,
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
      }, TIMEOUT_MS);
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
