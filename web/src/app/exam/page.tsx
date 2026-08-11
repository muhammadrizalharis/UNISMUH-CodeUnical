'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Editor, { type OnMount } from '@monaco-editor/react';
import { useProctor } from './useProctor';
import { useCamera } from './useCamera';

// Alamat API: ikut host halaman (LAN 10.33.33.11 / localhost) bila env kosong.
const API =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:47080`
    : 'http://localhost:47080');
const EXAM_SECONDS = 30 * 60;

// Peta id bahasa backend -> id bahasa Monaco (sebagian besar sama).
const MONACO_LANG: Record<string, string> = {
  python: 'python',
  javascript: 'javascript',
  typescript: 'typescript',
  cpp: 'cpp',
  c: 'c',
  go: 'go',
  java: 'java',
  php: 'php',
  ruby: 'ruby',
  rust: 'rust',
  html: 'html',
  sql: 'sql',
};

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
  setupSql?: string | null;
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

interface ExamProblemLite {
  order: number;
  id: string;
  title: string;
  language: string;
  difficulty: string;
}
interface PublicExamMeta {
  id: string;
  title: string;
  description: string;
  durationMin: number;
  startAt: string;
  endAt: string;
  courseName: string | null;
  problems: ExamProblemLite[];
}

function examStartMs(key: string): number {
  const saved = localStorage.getItem(key);
  if (saved) return Number(saved);
  const now = Date.now();
  localStorage.setItem(key, String(now));
  return now;
}

export default function ExamPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | undefined>(undefined);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [code, setCode] = useState('');
  const [saved, setSaved] = useState(true);
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [output, setOutput] = useState<RunResult | null>(null);
  const [grade, setGrade] = useState<Grade | null>(null);
  const [tab, setTab] = useState<'run' | 'grade'>('grade');
  const [pasteHits, setPasteHits] = useState(0);
  const [htmlSaved, setHtmlSaved] = useState(false);
  const [previewCode, setPreviewCode] = useState('');
  const [customStdin, setCustomStdin] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(EXAM_SECONDS);
  const [examId] = useState<string | null>(() =>
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('exam')
      : null,
  );
  const [exam, setExam] = useState<PublicExamMeta | null>(null);
  const [examError, setExamError] = useState(false);
  const startRef = useRef(0);
  const proctor = useProctor();
  const [camConsent, setCamConsent] = useState(false);
  const camera = useCamera(proctor.attemptId, proctor.active && camConsent);

  // Wajib login untuk mengerjakan ujian.
  useEffect(() => {
    fetch(`${API}/auth/me`, { credentials: 'include' })
      .then((r) => r.json())
      .then((u) => {
        if (!u) {
          router.replace('/welcome');
          setAuthed(false);
        } else {
          setAuthed(true);
        }
      })
      .catch(() => {
        router.replace('/welcome');
        setAuthed(false);
      });
  }, [router]);

  const loadProblem = useCallback((id: string) => {
    fetch(`${API}/problems/${id}`)
      .then((r) => r.json())
      .then((p: Problem) => {
        setProblem(p);
        const draft = localStorage.getItem(`codeunical:draft:${p.id}`);
        setCode(draft ?? p.starterCode);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (examId) {
      fetch(`${API}/public/exams/${examId}`)
        .then((r) => {
          if (!r.ok) throw new Error('unavailable');
          return r.json();
        })
        .then((e: PublicExamMeta) => {
          setExam(e);
          startRef.current = examStartMs(`codeunical:examStart:${e.id}`);
          const first = e.problems[0]?.id;
          if (first) loadProblem(first);
        })
        .catch(() => setExamError(true));
      return;
    }
    startRef.current = examStartMs('codeunical:examStart');
    const pid = new URLSearchParams(window.location.search).get('p');
    const url = pid ? `${API}/problems/${pid}` : `${API}/problems/random`;
    fetch(url)
      .then((r) => r.json())
      .then((p: Problem) => {
        setProblem(p);
        const draft = localStorage.getItem(`codeunical:draft:${p.id}`);
        setCode(draft ?? p.starterCode);
      })
      .catch(() => undefined);
  }, [examId, loadProblem]);

  // timer persisten (durasi ujian bila mode ujian; dibatasi juga oleh jadwal selesai)
  useEffect(() => {
    const tick = () => {
      if (!startRef.current) return;
      const total = exam ? exam.durationMin * 60 : EXAM_SECONDS;
      const elapsed = Math.floor((Date.now() - startRef.current) / 1000);
      let left = total - elapsed;
      if (exam) {
        const endLeft = Math.floor((new Date(exam.endAt).getTime() - Date.now()) / 1000);
        left = Math.min(left, endLeft);
      }
      setSecondsLeft(Math.max(0, left));
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [exam]);

  useEffect(() => {
    if (!problem) return;
    setSaved(false);
    const t = setTimeout(() => {
      localStorage.setItem(`codeunical:draft:${problem.id}`, code);
      setSaved(true);
    }, 800);
    return () => clearTimeout(t);
  }, [code, problem]);

  // pratinjau HTML/CSS (debounce); dipakai hanya saat bahasa = html
  useEffect(() => {
    const t = setTimeout(() => setPreviewCode(code), 300);
    return () => clearTimeout(t);
  }, [code]);

  // saat kicked: keluar fullscreen + reload (mengulang; timer & examStart tetap)
  useEffect(() => {
    if (!proctor.kicked) return;
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    const t = setTimeout(() => window.location.reload(), 4000);
    return () => clearTimeout(t);
  }, [proctor.kicked]);

  const onMount: OnMount = (editor, monaco) => {
    const dom = editor.getDomNode();
    const block = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      setPasteHits((v) => v + 1);
      proctor.logPaste();
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
        setPasteHits((v) => v + 1);
        proctor.logPaste();
      }
    });
  };

  const onChange = (v: string | undefined) => {
    const val = v ?? '';
    setCode(val);
    proctor.recordKeystroke(val);
  };

  const run = async () => {
    setRunning(true);
    setOutput(null);
    setTab('run');
    try {
      const runCode =
        problem?.language === 'sql' && problem?.setupSql
          ? `${problem.setupSql}\n${code}`
          : code;
      const res = await fetch(`${API}/execute`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: problem?.language ?? 'python', code: runCode, stdin: customStdin }),
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
    const html = problem.language === 'html';
    if (!html) {
      setGrade(null);
      setTab('grade');
    }
    try {
      const res = await fetch(`${API}/problems/${problem.id}/submit`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const g = (await res.json()) as Grade;
      if (html) {
        setHtmlSaved(true);
        setTimeout(() => setHtmlSaved(false), 4000);
      } else {
        setGrade(g);
      }
    } catch {
      // abaikan
    } finally {
      setSubmitting(false);
    }
  };

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');
  const editorLang = MONACO_LANG[problem?.language ?? 'python'] ?? 'plaintext';
  const isHtml = (problem?.language ?? '') === 'html';
  const timeUp = secondsLeft <= 0;
  const locked = timeUp || !proctor.active || proctor.kicked;
  const notStarted = !!exam && Date.now() < new Date(exam.startAt).getTime();
  const closed = !!exam && Date.now() > new Date(exam.endAt).getTime();
  const booting = !!examId && !exam && !examError;

  const camBadge = !camConsent
    ? { txt: 'off', cls: 'text-slate-500' }
    : camera.status === 'on'
      ? camera.faces === 0
        ? { txt: 'tanpa wajah', cls: 'text-amber-400' }
        : camera.faces > 1
          ? { txt: `${camera.faces} wajah`, cls: 'text-rose-400' }
          : { txt: 'aktif', cls: 'text-emerald-400' }
      : camera.status === 'denied'
        ? { txt: 'ditolak', cls: 'text-rose-400' }
        : camera.status === 'starting'
          ? { txt: 'memulai…', cls: 'text-slate-400' }
          : camera.status === 'error'
            ? { txt: 'error', cls: 'text-rose-400' }
            : { txt: 'off', cls: 'text-slate-500' };

  if (authed === undefined) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0d1117] text-sm text-slate-500">
        Memeriksa sesi…
      </div>
    );
  }
  if (!authed) return null; // dialihkan ke /welcome

  return (
    <div className="flex h-screen flex-col bg-[#0d1117] text-slate-200">
      <header className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
        <span className="text-lg font-bold tracking-tight text-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/LOGO-CODE-UNICAL.png" alt="" className="mr-2 inline-block h-7 w-7 rounded-md align-middle" />
          UNISMUH <span className="text-violet-400">CodeUnical</span>
          {exam && (
            <span className="ml-2 align-middle text-sm font-normal text-slate-400">
              · {exam.title}
            </span>
          )}
        </span>
        <div className="flex items-center gap-4 text-sm">
          <span className={saved ? 'text-emerald-400' : 'text-amber-400'}>
            {saved ? '✓ tersimpan' : '… menyimpan'}
          </span>
          <span className="text-slate-500">
            strike: <span className="font-mono text-rose-400">{proctor.strikes}/3</span>
          </span>
          <span className="text-slate-500">
            kamera: <span className={`font-mono ${camBadge.cls}`}>{camBadge.txt}</span>
          </span>
          <span className="text-slate-500">
            paste: <span className="font-mono text-amber-400">{pasteHits}</span>
          </span>
          <span className={`rounded px-2 py-1 font-mono ${timeUp ? 'bg-rose-950 text-rose-400' : 'bg-slate-800'}`}>
            ⏱ {mm}:{ss}
          </span>
          {!isHtml && (
            <button
              onClick={run}
              disabled={running || locked}
              className="rounded border border-slate-700 px-3 py-1.5 transition hover:bg-slate-800 disabled:opacity-40"
            >
              {running ? '…' : '▶ Run'}
            </button>
          )}
          <button
            onClick={submit}
            disabled={submitting || locked}
            className="rounded bg-violet-600 px-4 py-1.5 font-medium text-white transition hover:bg-violet-500 disabled:opacity-40"
          >
            {submitting ? 'menilai…' : isHtml ? '✓ Kumpulkan' : '✓ Submit'}
          </button>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[320px_1fr_360px]">
        <aside className="min-h-0 overflow-auto border-r border-slate-800 p-5">
          {!problem ? (
            <p className="text-slate-500">Memuat soal…</p>
          ) : (
            <>
              {exam && exam.problems.length > 1 && (
                <div className="mb-4">
                  <p className="mb-1 font-mono text-xs text-slate-500">
                    SOAL ({exam.problems.length})
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {exam.problems.map((ep, i) => (
                      <button
                        key={ep.id}
                        onClick={() => loadProblem(ep.id)}
                        title={ep.title}
                        className={`h-8 w-8 rounded font-mono text-xs transition ${
                          problem.id === ep.id
                            ? 'bg-violet-600 text-white'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>
                </div>
              )}
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
              {problem.setupSql && (
                <div className="mt-4">
                  <p className="font-mono text-xs text-slate-500">SKEMA &amp; DATA</p>
                  <pre className="mt-1 overflow-auto rounded border border-slate-800 bg-[#0b0e14] p-2 font-mono text-[11px] leading-relaxed text-sky-300">
                    {problem.setupSql}
                  </pre>
                </div>
              )}
              {isHtml ? (
                <div className="mt-5 rounded border border-slate-800 bg-[#0b0e14] p-3 text-xs text-slate-400">
                  Ketik HTML/CSS/JS di editor — <b className="text-slate-200">pratinjau langsung</b> muncul
                  di kanan. Klik <b className="text-slate-200">Kumpulkan</b> untuk mengirim; penilaian oleh penguji.
                </div>
              ) : (
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
                  <p className="font-mono text-xs text-slate-600">+ {problem.hiddenCount} uji tersembunyi</p>
                </div>
              )}
            </>
          )}
        </aside>

        <div className="relative min-h-0 border-r border-slate-800">
          <Editor
            height="100%"
            language={editorLang}
            defaultLanguage="python"
            theme="vs-dark"
            value={code}
            onChange={onChange}
            onMount={onMount}
            options={{
              fontSize: 14,
              minimap: { enabled: false },
              contextmenu: false,
              fontFamily: "'JetBrains Mono','Fira Code',monospace",
              scrollBeyondLastLine: false,
              readOnly: locked,
            }}
          />
        </div>

        {isHtml ? (
          <div className="flex min-h-0 flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 bg-[#0b0e14] px-4 py-2 font-mono text-xs text-slate-400">
              <span>PRATINJAU LANGSUNG</span>
              {htmlSaved && <span className="text-emerald-400">✓ dikumpulkan</span>}
            </div>
            <iframe
              title="pratinjau"
              srcDoc={previewCode}
              sandbox="allow-scripts"
              className="min-h-0 flex-1 border-0 bg-white"
            />
          </div>
        ) : (
        <div className="flex min-h-0 flex-col bg-[#0b0e14]">
          <div className="flex border-b border-slate-800 font-mono text-xs">
            <button onClick={() => setTab('grade')} className={`px-4 py-2 ${tab === 'grade' ? 'bg-slate-800 text-white' : 'text-slate-500'}`}>
              HASIL
            </button>
            <button onClick={() => setTab('run')} className={`px-4 py-2 ${tab === 'run' ? 'bg-slate-800 text-white' : 'text-slate-500'}`}>
              OUTPUT
            </button>
          </div>
          <div className="flex-1 overflow-auto p-4 font-mono text-sm">
            {tab === 'grade' &&
              (!grade ? (
                <span className="text-slate-600">Klik ✓ Submit untuk dinilai.</span>
              ) : (
                <>
                  <div className={`mb-3 text-lg font-bold ${grade.passed === grade.total ? 'text-emerald-400' : 'text-amber-400'}`}>
                    lolos {grade.passed}/{grade.total} · skor {grade.score}/{grade.maxScore}
                  </div>
                  {grade.results.map((r) => (
                    <div key={r.order} className="mb-1">
                      <span className={r.passed ? 'text-emerald-400' : 'text-rose-400'}>{r.passed ? '✓' : '✗'}</span> uji #{r.order}{' '}
                      {r.hidden && <span className="text-slate-600">🔒</span>}
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
            {tab === 'run' && (
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-[11px] text-slate-500">
                    Input (stdin) — untuk soal yang membaca input()
                  </label>
                  <textarea
                    value={customStdin}
                    onChange={(e) => setCustomStdin(e.target.value)}
                    rows={2}
                    placeholder="mis. 2 3"
                    className="w-full rounded border border-slate-700 bg-[#0d1117] p-2 font-mono text-xs text-slate-100 outline-none focus:border-violet-500"
                  />
                </div>
                {!output ? (
                  <span className="text-slate-600">Klik ▶ Run untuk mencoba kode.</span>
                ) : (
                  <>
                    {output.stdout && <pre className="whitespace-pre-wrap text-slate-200">{output.stdout}</pre>}
                    {output.stderr && <pre className="whitespace-pre-wrap text-rose-400">{output.stderr}</pre>}
                    {output.timedOut && <pre className="text-amber-400">⏱ melebihi batas waktu.</pre>}
                    <div className="mt-3 text-xs text-slate-600">exit={String(output.exitCode)} · {output.durationMs} ms</div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
        )}
      </div>

      <footer className="border-t border-slate-800 px-5 py-1.5 text-center font-mono text-[11px] text-slate-600">
        🛡️ ketik manual · paste diblokir · layar penuh dipantau · dijalankan di sandbox
      </footer>

      {/* Pratinjau kamera (pojok kiri bawah) */}
      {proctor.active && camConsent && (
        <div className="absolute bottom-8 left-3 z-20 overflow-hidden rounded-lg border border-slate-700 bg-black/70 shadow-lg">
          <video
            ref={camera.videoRef}
            muted
            playsInline
            className="h-24 w-32 -scale-x-100 object-cover"
          />
          <div className="flex items-center justify-between gap-2 px-2 py-1 text-[10px]">
            <span className={`font-mono ${camBadge.cls}`}>● {camBadge.txt}</span>
            {!camera.detReady && camera.status === 'on' && (
              <span className="text-slate-500">berkala</span>
            )}
          </div>
          {camera.vision && (
            <div
              className={`px-2 py-1 font-mono text-[10px] ${
                camera.vision.phone || camera.vision.violations.length
                  ? 'bg-rose-950/80 text-rose-300'
                  : 'text-emerald-500'
              }`}
            >
              GPU:{' '}
              {camera.vision.phone
                ? 'HP terdeteksi'
                : camera.vision.violations.includes('multi_face')
                  ? 'wajah asing'
                  : camera.vision.violations.includes('face_absent')
                    ? 'wajah hilang'
                    : 'aman'}
            </div>
          )}
        </div>
      )}

      {/* Overlay mulai ujian (gesture untuk fullscreen) */}
      {problem && !proctor.active && !proctor.kicked && !notStarted && !closed && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#0d1117]/95 text-center">
          <h2 className="text-2xl font-bold text-white">Siap mengerjakan?</h2>
          <p className="mt-2 max-w-md text-slate-400">
            Ujian berjalan dalam <b>layar penuh</b> dan dipantau. Keluar dari layar ujian dihitung
            pelanggaran — <b>3 pelanggaran = didiskualifikasi</b> dan mengulang.
          </p>
          <label className="mt-5 flex max-w-md items-start gap-3 rounded-lg border border-slate-700 bg-[#161b22] p-4 text-left text-sm text-slate-300">
            <input
              type="checkbox"
              checked={camConsent}
              onChange={(e) => setCamConsent(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-violet-600"
            />
            <span>
              Saya setuju <b>kamera direkam</b> selama ujian. Sistem hanya menyimpan{' '}
              <b>foto bukti</b> saat wajah tak terdeteksi atau ada lebih dari satu orang.
              Rekaman hanya dapat dilihat dosen penguji.
            </span>
          </label>
          <button
            onClick={() => proctor.start(problem.id, examId ?? undefined)}
            disabled={!camConsent}
            className="mt-6 rounded-lg bg-violet-600 px-7 py-3 font-medium text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Mulai Ujian (Layar Penuh) →
          </button>
          <p className="mt-3 text-xs text-slate-600">Centang persetujuan kamera untuk memulai.</p>
        </div>
      )}

      {/* Overlay status ujian: memuat / tidak tersedia / belum mulai / berakhir */}
      {(booting || examError || notStarted || closed) && !proctor.active && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#0d1117]/97 px-4 text-center">
          {booting ? (
            <p className="text-slate-400">Memuat ujian…</p>
          ) : examError ? (
            <>
              <p className="text-5xl">🚫</p>
              <h2 className="mt-4 text-2xl font-bold text-rose-400">Ujian tidak tersedia</h2>
              <p className="mt-2 max-w-md text-slate-400">
                Tautan tidak valid atau ujian belum ditayangkan.
              </p>
              <a href="/exams" className="mt-6 rounded bg-violet-600 px-5 py-2 font-medium text-white hover:bg-violet-500">
                Lihat ujian tersedia
              </a>
            </>
          ) : notStarted ? (
            <>
              <p className="text-5xl">⏳</p>
              <h2 className="mt-4 text-2xl font-bold text-white">Ujian belum mulai</h2>
              <p className="mt-2 max-w-md text-slate-400">
                {exam?.title} dijadwalkan mulai pada{' '}
                <b className="text-slate-200">
                  {exam && new Date(exam.startAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                </b>
                .
              </p>
              <a href="/exams" className="mt-6 rounded border border-slate-700 px-5 py-2 text-slate-300 hover:bg-slate-800">
                ← Kembali
              </a>
            </>
          ) : (
            <>
              <p className="text-5xl">🔒</p>
              <h2 className="mt-4 text-2xl font-bold text-rose-400">Ujian sudah berakhir</h2>
              <p className="mt-2 max-w-md text-slate-400">
                Waktu pengerjaan {exam?.title} telah lewat.
              </p>
              <a href="/exams" className="mt-6 rounded border border-slate-700 px-5 py-2 text-slate-300 hover:bg-slate-800">
                ← Kembali
              </a>
            </>
          )}
        </div>
      )}

      {/* Modal peringatan pelanggaran */}
      {proctor.warning && !proctor.kicked && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60">
          <div className="mx-4 max-w-md rounded-xl border border-amber-700 bg-[#161b22] p-6 text-center">
            <p className="text-4xl">⚠️</p>
            <p className="mt-3 text-slate-200">{proctor.warning}</p>
            <button
              onClick={proctor.dismissWarning}
              className="mt-5 rounded bg-amber-600 px-5 py-2 font-medium text-white hover:bg-amber-500"
            >
              Kembali ke Ujian
            </button>
          </div>
        </div>
      )}

      {/* Overlay diskualifikasi */}
      {proctor.kicked && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#0d1117] text-center">
          <p className="text-5xl">🚫</p>
          <h2 className="mt-4 text-2xl font-bold text-rose-400">Didiskualifikasi</h2>
          <p className="mt-2 text-slate-400">
            3 pelanggaran terlampaui. Ujian diulang dari awal (waktu tetap berjalan)…
          </p>
        </div>
      )}
    </div>
  );
}
