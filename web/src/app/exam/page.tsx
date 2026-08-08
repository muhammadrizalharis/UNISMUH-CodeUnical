'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:47080';
const EXAM_SECONDS = 30 * 60;

interface PublicCase {
  stdin: string;
  expected: string;
  order: number;
  points: number;
}
interface Problem {
  id: string;
  title: string;
  description: string;
  language: string;
  starterCode: string;
  difficulty: string;
  hiddenCount: number;
  testCases: PublicCase[];
}
interface CaseResult {
  order: number;
  hidden: boolean;
  passed: boolean;
  points: number;
  timedOut: boolean;
  expected?: string;
  actual?: string;
  stderr?: string;
}
interface Grade {
  passed: number;
  total: number;
  score: number;
  maxScore: number;
  results: CaseResult[];
}
interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  durationMs: number;
}

export default function ExamPage() {
  const [problem, setProblem] = useState<Problem | null>(null);
  const [code, setCode] = useState('');
  const [saved, setSaved] = useState(true);
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [output, setOutput] = useState<RunResult | null>(null);
  const [grade, setGrade] = useState<Grade | null>(null);
  const [tab, setTab] = useState<'run' | 'grade'>('grade');
  const [violations, setViolations] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(EXAM_SECONDS);
  const bump = useCallback(() => setViolations((v) => v + 1), []);

  useEffect(() => {
    fetch(`${API}/problems/random`)
      .then((r) => r.json())
      .then((p: Problem) => {
        setProblem(p);
        const draft = localStorage.getItem(`codeunical:draft:${p.id}`);
        setCode(draft ?? p.starterCode);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!problem) return;
    setSaved(false);
    const t = setTimeout(() => {
      localStorage.setItem(`codeunical:draft:${problem.id}`, code);
      setSaved(true);
    }, 800);
    return () => clearTimeout(t);
  }, [code, problem]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [secondsLeft]);

  const onMount: OnMount = (editor, monaco) => {
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
      const blocked =
        (mod &&
          (e.keyCode === monaco.KeyCode.KeyV ||
            e.keyCode === monaco.KeyCode.KeyC ||
            e.keyCode === monaco.KeyCode.KeyX)) ||
        (e.shiftKey && e.keyCode === monaco.KeyCode.Insert);
      if (blocked) {
        e.preventDefault();
        e.stopPropagation();
        bump();
      }
    });
  };

  const run = async () => {
    setRunning(true);
    setOutput(null);
    setTab('run');
    try {
      const res = await fetch(`${API}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: 'python', code }),
      });
      setOutput((await res.json()) as RunResult);
    } catch (e) {
      setOutput({ stdout: '', stderr: String(e), exitCode: -1, timedOut: false, durationMs: 0 });
    } finally {
      setRunning(false);
    }
  };

  const submit = async () => {
    if (!problem) return;
    setSubmitting(true);
    setGrade(null);
    setTab('grade');
    try {
      const res = await fetch(`${API}/problems/${problem.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      setGrade((await res.json()) as Grade);
    } catch {
      // abaikan
    } finally {
      setSubmitting(false);
    }
  };

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');
  const timeUp = secondsLeft <= 0;

  return (
    <div className="flex h-screen flex-col bg-[#0d1117] text-slate-200">
      <header className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
        <span className="text-lg font-bold tracking-tight text-white">
          UNISMUH <span className="text-violet-400">CodeUnical</span>
        </span>
        <div className="flex items-center gap-4 text-sm">
          <span className={saved ? 'text-emerald-400' : 'text-amber-400'}>
            {saved ? '✓ tersimpan' : '… menyimpan'}
          </span>
          <span className="text-slate-500">
            paste: <span className="font-mono text-rose-400">{violations}</span>
          </span>
          <span
            className={`rounded px-2 py-1 font-mono ${timeUp ? 'bg-rose-950 text-rose-400' : 'bg-slate-800'}`}
          >
            ⏱ {mm}:{ss}
          </span>
          <button
            onClick={run}
            disabled={running || timeUp || !problem}
            className="rounded border border-slate-700 px-3 py-1.5 transition hover:bg-slate-800 disabled:opacity-40"
          >
            {running ? '…' : '▶ Run'}
          </button>
          <button
            onClick={submit}
            disabled={submitting || timeUp || !problem}
            className="rounded bg-violet-600 px-4 py-1.5 font-medium text-white transition hover:bg-violet-500 disabled:opacity-40"
          >
            {submitting ? 'menilai…' : '✓ Submit'}
          </button>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[320px_1fr_360px]">
        {/* Panel soal */}
        <aside className="min-h-0 overflow-auto border-r border-slate-800 p-5">
          {!problem ? (
            <p className="text-slate-500">Memuat soal…</p>
          ) : (
            <>
              <div className="mb-2 flex items-center gap-2">
                <span className="rounded bg-violet-950 px-2 py-0.5 font-mono text-xs text-violet-300">
                  {problem.difficulty}
                </span>
                <span className="font-mono text-xs text-slate-500">{problem.language}</span>
              </div>
              <h1 className="text-xl font-semibold text-white">{problem.title}</h1>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
                {problem.description}
              </p>
              <div className="mt-5 space-y-2">
                <p className="font-mono text-xs text-slate-500">CONTOH</p>
                {problem.testCases.map((c) => (
                  <div key={c.order} className="rounded border border-slate-800 bg-[#0b0e14] p-2 font-mono text-xs">
                    <div className="text-slate-500">input</div>
                    <pre className="whitespace-pre-wrap text-slate-300">{c.stdin || '(kosong)'}</pre>
                    <div className="mt-1 text-slate-500">output</div>
                    <pre className="whitespace-pre-wrap text-emerald-400">{c.expected}</pre>
                  </div>
                ))}
                <p className="font-mono text-xs text-slate-600">
                  + {problem.hiddenCount} uji tersembunyi
                </p>
              </div>
            </>
          )}
        </aside>

        {/* Editor */}
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

        {/* Panel hasil */}
        <div className="flex min-h-0 flex-col bg-[#0b0e14]">
          <div className="flex border-b border-slate-800 font-mono text-xs">
            <button
              onClick={() => setTab('grade')}
              className={`px-4 py-2 ${tab === 'grade' ? 'bg-slate-800 text-white' : 'text-slate-500'}`}
            >
              HASIL
            </button>
            <button
              onClick={() => setTab('run')}
              className={`px-4 py-2 ${tab === 'run' ? 'bg-slate-800 text-white' : 'text-slate-500'}`}
            >
              OUTPUT
            </button>
          </div>
          <div className="flex-1 overflow-auto p-4 font-mono text-sm">
            {tab === 'grade' &&
              (!grade ? (
                <span className="text-slate-600">Klik ✓ Submit untuk dinilai.</span>
              ) : (
                <>
                  <div
                    className={`mb-3 text-lg font-bold ${grade.passed === grade.total ? 'text-emerald-400' : 'text-amber-400'}`}
                  >
                    lolos {grade.passed}/{grade.total} · skor {grade.score}/{grade.maxScore}
                  </div>
                  {grade.results.map((r) => (
                    <div key={r.order} className="mb-1">
                      <span className={r.passed ? 'text-emerald-400' : 'text-rose-400'}>
                        {r.passed ? '✓' : '✗'}
                      </span>{' '}
                      uji #{r.order} {r.hidden && <span className="text-slate-600">🔒</span>}
                      {r.timedOut && <span className="text-amber-400"> (timeout)</span>}
                      {!r.hidden && !r.passed && (
                        <div className="ml-4 text-xs text-slate-500">
                          diharapkan: <span className="text-emerald-500">{r.expected}</span> · dapat:{' '}
                          <span className="text-rose-400">{r.actual || '(kosong)'}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </>
              ))}
            {tab === 'run' &&
              (!output ? (
                <span className="text-slate-600">Klik ▶ Run untuk mencoba kode.</span>
              ) : (
                <>
                  {output.stdout && <pre className="whitespace-pre-wrap text-slate-200">{output.stdout}</pre>}
                  {output.stderr && <pre className="whitespace-pre-wrap text-rose-400">{output.stderr}</pre>}
                  {output.timedOut && <pre className="text-amber-400">⏱ melebihi batas waktu.</pre>}
                  <div className="mt-3 text-xs text-slate-600">
                    exit={String(output.exitCode)} · {output.durationMs} ms
                  </div>
                </>
              ))}
          </div>
        </div>
      </div>

      <footer className="border-t border-slate-800 px-5 py-1.5 text-center font-mono text-[11px] text-slate-600">
        🛡️ ketik manual · paste diblokir · dijalankan di sandbox terisolasi
      </footer>
    </div>
  );
}
