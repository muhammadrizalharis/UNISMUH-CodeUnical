'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:47080';
const STORAGE_KEY = 'codeunical:draft:demo';
const EXAM_SECONDS = 30 * 60;
const STARTER = `# UNISMUH CodeUnical — demo\n# Ketik kodemu (paste dinonaktifkan)\n\nfor i in range(1, 6):\n    print(f"baris {i}")\n`;

interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  durationMs: number;
}

export default function ExamPage() {
  const [code, setCode] = useState(STARTER);
  const [saved, setSaved] = useState(true);
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState<RunResult | null>(null);
  const [violations, setViolations] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(EXAM_SECONDS);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

  useEffect(() => {
    const draft = localStorage.getItem(STORAGE_KEY);
    if (draft) setCode(draft);
  }, []);

  useEffect(() => {
    setSaved(false);
    const t = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, code);
      setSaved(true);
    }, 800);
    return () => clearTimeout(t);
  }, [code]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [secondsLeft]);

  const bump = useCallback(() => setViolations((v) => v + 1), []);

  const onMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    const dom = editor.getDomNode();
    const block = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      bump();
    };
    ['paste', 'copy', 'cut', 'contextmenu', 'drop', 'dragover'].forEach((ev) =>
      dom?.addEventListener(ev, block, true),
    );
    editor.onKeyDown((e) => {
      const mod = e.ctrlKey || e.metaKey;
      const blockedCombo =
        (mod &&
          (e.keyCode === monaco.KeyCode.KeyV ||
            e.keyCode === monaco.KeyCode.KeyC ||
            e.keyCode === monaco.KeyCode.KeyX)) ||
        (e.shiftKey && e.keyCode === monaco.KeyCode.Insert);
      if (blockedCombo) {
        e.preventDefault();
        e.stopPropagation();
        bump();
      }
    });
  };

  const run = async () => {
    setRunning(true);
    setOutput(null);
    try {
      const res = await fetch(`${API}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: 'python', code }),
      });
      setOutput((await res.json()) as RunResult);
    } catch (e) {
      setOutput({
        stdout: '',
        stderr: `Gagal menghubungi server: ${String(e)}`,
        exitCode: -1,
        timedOut: false,
        durationMs: 0,
      });
    } finally {
      setRunning(false);
    }
  };

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');
  const timeUp = secondsLeft <= 0;

  return (
    <div className="flex h-screen flex-col bg-[#0d1117] text-slate-200">
      <header className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold tracking-tight text-white">
            UNISMUH <span className="text-violet-400">CodeUnical</span>
          </span>
          <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-xs text-slate-400">
            python · demo
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className={saved ? 'text-emerald-400' : 'text-amber-400'}>
            {saved ? '✓ tersimpan' : '… menyimpan'}
          </span>
          <span className="text-slate-500">
            pelanggaran paste: <span className="font-mono text-rose-400">{violations}</span>
          </span>
          <span
            className={`rounded px-2 py-1 font-mono ${
              timeUp ? 'bg-rose-950 text-rose-400' : 'bg-slate-800 text-slate-200'
            }`}
          >
            ⏱ {mm}:{ss}
          </span>
          <button
            onClick={run}
            disabled={running || timeUp}
            className="rounded bg-violet-600 px-4 py-1.5 font-medium text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {running ? 'menjalankan…' : '▶ Run'}
          </button>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-1 overflow-hidden md:grid-cols-2">
        <div className="min-h-0 border-r border-slate-800">
          <Editor
            height="100%"
            defaultLanguage="python"
            theme="vs-dark"
            value={code}
            onChange={(v) => setCode(v ?? '')}
            onMount={onMount}
            options={{
              fontSize: 14,
              minimap: { enabled: false },
              contextmenu: false,
              fontFamily: "'JetBrains Mono','Fira Code',monospace",
              scrollBeyondLastLine: false,
              readOnly: timeUp,
            }}
          />
        </div>

        <div className="flex min-h-0 flex-col bg-[#0b0e14]">
          <div className="border-b border-slate-800 px-4 py-2 font-mono text-xs text-slate-500">
            OUTPUT
          </div>
          <div className="flex-1 overflow-auto p-4 font-mono text-sm">
            {!output && <span className="text-slate-600">Klik ▶ Run untuk menjalankan kode.</span>}
            {output && (
              <>
                {output.stdout && <pre className="whitespace-pre-wrap text-slate-200">{output.stdout}</pre>}
                {output.stderr && <pre className="whitespace-pre-wrap text-rose-400">{output.stderr}</pre>}
                {output.timedOut && <pre className="text-amber-400">⏱ melebihi batas waktu — dihentikan.</pre>}
                <div className="mt-3 text-xs text-slate-600">
                  exit={String(output.exitCode)} · {output.durationMs} ms
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <footer className="border-t border-slate-800 px-5 py-1.5 text-center font-mono text-[11px] text-slate-600">
        🛡️ ketik manual · paste diblokir · dijalankan di sandbox terisolasi
      </footer>
    </div>
  );
}
