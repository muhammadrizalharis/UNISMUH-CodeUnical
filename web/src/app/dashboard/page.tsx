'use client';

import { useCallback, useEffect, useState } from 'react';
import { ReplayModal } from './ReplayModal';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:47080';

interface Attempt {
  id: string;
  problemId: string | null;
  status: string;
  strikes: number;
  startedAt: string;
  lastSeenAt: string;
  live: boolean;
  events: number;
  keystrokes: number;
}
interface Sub {
  id: string;
  problemId: string;
  passed: number;
  total: number;
  score: number;
  maxScore: number;
  createdAt: string;
}
interface ProblemLite {
  id: string;
  title: string;
  difficulty: string;
}
interface SimPair {
  a: string;
  b: string;
  similarity: number;
}

type Tab = 'monitor' | 'subs' | 'sim';

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>('monitor');
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [problems, setProblems] = useState<ProblemLite[]>([]);
  const [simProblem, setSimProblem] = useState('');
  const [sim, setSim] = useState<{ total: number; pairs: SimPair[] } | null>(null);
  const [replayId, setReplayId] = useState<string | null>(null);

  const poll = useCallback(() => {
    fetch(`${API}/monitor/attempts`).then((r) => r.json()).then(setAttempts).catch(() => undefined);
    fetch(`${API}/monitor/submissions`).then((r) => r.json()).then(setSubs).catch(() => undefined);
  }, []);

  useEffect(() => {
    poll();
    fetch(`${API}/problems`).then((r) => r.json()).then(setProblems).catch(() => undefined);
    const t = setInterval(poll, 4000);
    return () => clearInterval(t);
  }, [poll]);

  const loadSim = (id: string) => {
    setSimProblem(id);
    setSim(null);
    if (!id) return;
    fetch(`${API}/problems/${id}/similarity`).then((r) => r.json()).then(setSim).catch(() => undefined);
  };

  const liveCount = attempts.filter((a) => a.live && a.status === 'active').length;

  const simColor = (v: number) =>
    v >= 90 ? 'text-rose-400' : v >= 75 ? 'text-amber-400' : 'text-slate-300';

  return (
    <div className="min-h-screen bg-[#0d1117] text-slate-200">
      <header className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
        <div>
          <h1 className="text-xl font-bold text-white">
            UNISMUH <span className="text-violet-400">CodeUnical</span> · Dashboard Penguji
          </h1>
          <p className="font-mono text-xs text-amber-500/80">
            sementara terbuka — nanti dibatasi ke peran penguji
          </p>
        </div>
        <div className="flex items-center gap-2 font-mono text-sm">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
          {liveCount} peserta aktif
        </div>
      </header>

      <nav className="flex gap-1 border-b border-slate-800 px-6">
        {(
          [
            ['monitor', 'Monitoring Live'],
            ['subs', 'Submission & Nilai'],
            ['sim', 'Kemiripan Kode'],
          ] as [Tab, string][]
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`border-b-2 px-4 py-3 text-sm ${
              tab === k ? 'border-violet-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      <main className="p-6">
        {tab === 'monitor' && (
          <div className="overflow-hidden rounded-lg border border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#0b0e14] font-mono text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-2">Attempt</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Strike</th>
                  <th className="px-4 py-2">Pelanggaran</th>
                  <th className="px-4 py-2">Ketikan</th>
                  <th className="px-4 py-2">Live</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {attempts.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-slate-600">
                      Belum ada peserta.
                    </td>
                  </tr>
                )}
                {attempts.map((a) => (
                  <tr key={a.id} className="border-t border-slate-800 font-mono">
                    <td className="px-4 py-2 text-slate-400">{a.id.slice(-6)}</td>
                    <td className="px-4 py-2">
                      <span
                        className={
                          a.status === 'kicked'
                            ? 'text-rose-400'
                            : a.status === 'active'
                              ? 'text-emerald-400'
                              : 'text-slate-400'
                        }
                      >
                        {a.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-rose-400">{a.strikes}/3</td>
                    <td className="px-4 py-2 text-amber-400">{a.events}</td>
                    <td className="px-4 py-2 text-slate-400">{a.keystrokes}</td>
                    <td className="px-4 py-2">
                      {a.live ? (
                        <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                      ) : (
                        <span className="text-slate-700">·</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => setReplayId(a.id)}
                        className="rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800"
                      >
                        🎬 Replay
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'subs' && (
          <div className="overflow-hidden rounded-lg border border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#0b0e14] font-mono text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-2">Submission</th>
                  <th className="px-4 py-2">Lolos</th>
                  <th className="px-4 py-2">Skor</th>
                  <th className="px-4 py-2">Waktu</th>
                </tr>
              </thead>
              <tbody>
                {subs.map((s) => (
                  <tr key={s.id} className="border-t border-slate-800 font-mono">
                    <td className="px-4 py-2 text-slate-400">{s.id.slice(-6)}</td>
                    <td className={`px-4 py-2 ${s.passed === s.total ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {s.passed}/{s.total}
                    </td>
                    <td className="px-4 py-2 text-slate-300">
                      {s.score}/{s.maxScore}
                    </td>
                    <td className="px-4 py-2 text-slate-500">
                      {new Date(s.createdAt).toLocaleTimeString('id-ID')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'sim' && (
          <div>
            <select
              value={simProblem}
              onChange={(e) => loadSim(e.target.value)}
              className="mb-4 rounded border border-slate-700 bg-[#0b0e14] px-3 py-2 text-sm"
            >
              <option value="">— pilih soal —</option>
              {problems.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} ({p.difficulty})
                </option>
              ))}
            </select>
            {sim && (
              <div className="rounded-lg border border-slate-800 p-4">
                <p className="mb-3 text-sm text-slate-400">
                  {sim.total} submission · {sim.pairs.length} pasangan mirip (≥60%)
                </p>
                {sim.pairs.length === 0 ? (
                  <p className="text-slate-600">Tak ada kemiripan mencurigakan.</p>
                ) : (
                  <div className="space-y-1 font-mono text-sm">
                    {sim.pairs.map((p, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className={`w-12 font-bold ${simColor(p.similarity)}`}>{p.similarity}%</span>
                        <span className="text-slate-400">
                          {p.a.slice(-6)} ↔ {p.b.slice(-6)}
                        </span>
                        {p.similarity >= 90 && <span className="text-rose-500">⚠ nyaris identik</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {replayId && <ReplayModal attemptId={replayId} onClose={() => setReplayId(null)} />}
    </div>
  );
}
