'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ReplayModal } from './ReplayModal';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:47080';
const opt: RequestInit = { credentials: 'include' };

interface Me {
  id: string;
  name: string;
  email: string;
  role: string;
}
interface Attempt {
  id: string;
  status: string;
  strikes: number;
  live: boolean;
  events: number;
  keystrokes: number;
}
interface Sub {
  id: string;
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
interface UserRow {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
}

type Tab = 'monitor' | 'subs' | 'sim' | 'users';

export default function Dashboard() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>('monitor');
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [problems, setProblems] = useState<ProblemLite[]>([]);
  const [simProblem, setSimProblem] = useState('');
  const [sim, setSim] = useState<{ total: number; pairs: SimPair[] } | null>(null);
  const [replayId, setReplayId] = useState<string | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [pForm, setPForm] = useState({ email: '', name: '', password: '' });
  const [pMsg, setPMsg] = useState('');

  useEffect(() => {
    fetch(`${API}/auth/me`, opt)
      .then((r) => r.json())
      .then((u: Me | null) => {
        if (!u || (u.role !== 'penguji' && u.role !== 'superadmin')) {
          router.replace('/welcome');
          setMe(null);
        } else {
          setMe(u);
        }
      })
      .catch(() => {
        router.replace('/welcome');
        setMe(null);
      });
  }, [router]);

  const poll = useCallback(() => {
    fetch(`${API}/monitor/attempts`, opt).then((r) => r.json()).then(setAttempts).catch(() => undefined);
    fetch(`${API}/monitor/submissions`, opt).then((r) => r.json()).then(setSubs).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!me) return;
    poll();
    fetch(`${API}/problems`, opt).then((r) => r.json()).then(setProblems).catch(() => undefined);
    const t = setInterval(poll, 4000);
    return () => clearInterval(t);
  }, [me, poll]);

  const loadUsers = useCallback(() => {
    fetch(`${API}/auth/users`, opt).then((r) => r.json()).then(setUsers).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (me && tab === 'users') loadUsers();
  }, [me, tab, loadUsers]);

  const loadSim = (id: string) => {
    setSimProblem(id);
    setSim(null);
    if (!id) return;
    fetch(`${API}/problems/${id}/similarity`, opt).then((r) => r.json()).then(setSim).catch(() => undefined);
  };

  const createPenguji = async (e: React.FormEvent) => {
    e.preventDefault();
    setPMsg('');
    const res = await fetch(`${API}/auth/users`, {
      ...opt,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pForm),
    });
    if (res.ok) {
      setPMsg(`Penguji ${pForm.email} dibuat.`);
      setPForm({ email: '', name: '', password: '' });
      loadUsers();
    } else {
      const d = await res.json().catch(() => ({}));
      setPMsg(d.message || 'Gagal.');
    }
  };

  const logout = async () => {
    await fetch(`${API}/auth/logout`, { ...opt, method: 'POST' }).catch(() => undefined);
    router.replace('/welcome');
  };

  if (me === undefined) {
    return <div className="flex min-h-screen items-center justify-center bg-[#0d1117] text-slate-500">Memeriksa akses…</div>;
  }
  if (!me) return null;

  const liveCount = attempts.filter((a) => a.live && a.status === 'active').length;
  const simColor = (v: number) => (v >= 90 ? 'text-rose-400' : v >= 75 ? 'text-amber-400' : 'text-slate-300');
  const tabs: [Tab, string][] = [
    ['monitor', 'Monitoring Live'],
    ['subs', 'Submission & Nilai'],
    ['sim', 'Kemiripan Kode'],
  ];
  if (me.role === 'superadmin') tabs.push(['users', 'Kelola Penguji']);

  return (
    <div className="min-h-screen bg-[#0d1117] text-slate-200">
      <header className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
        <div>
          <h1 className="text-xl font-bold text-white">
            UNISMUH <span className="text-violet-400">CodeUnical</span> · Dashboard
          </h1>
          <p className="font-mono text-xs text-slate-500">
            {me.name} · <span className="text-violet-400">{me.role}</span>
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-2 font-mono">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            {liveCount} aktif
          </span>
          <button onClick={logout} className="rounded border border-slate-700 px-3 py-1.5 text-xs hover:bg-slate-800">
            Keluar
          </button>
        </div>
      </header>

      <nav className="flex gap-1 border-b border-slate-800 px-6">
        {tabs.map(([k, label]) => (
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
                    <td colSpan={7} className="px-4 py-6 text-center text-slate-600">Belum ada peserta.</td>
                  </tr>
                )}
                {attempts.map((a) => (
                  <tr key={a.id} className="border-t border-slate-800 font-mono">
                    <td className="px-4 py-2 text-slate-400">{a.id.slice(-6)}</td>
                    <td className="px-4 py-2">
                      <span className={a.status === 'kicked' ? 'text-rose-400' : a.status === 'active' ? 'text-emerald-400' : 'text-slate-400'}>
                        {a.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-rose-400">{a.strikes}/3</td>
                    <td className="px-4 py-2 text-amber-400">{a.events}</td>
                    <td className="px-4 py-2 text-slate-400">{a.keystrokes}</td>
                    <td className="px-4 py-2">{a.live ? <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" /> : <span className="text-slate-700">·</span>}</td>
                    <td className="px-4 py-2">
                      <button onClick={() => setReplayId(a.id)} className="rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800">
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
                    <td className={`px-4 py-2 ${s.passed === s.total ? 'text-emerald-400' : 'text-amber-400'}`}>{s.passed}/{s.total}</td>
                    <td className="px-4 py-2 text-slate-300">{s.score}/{s.maxScore}</td>
                    <td className="px-4 py-2 text-slate-500">{new Date(s.createdAt).toLocaleTimeString('id-ID')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'sim' && (
          <div>
            <select value={simProblem} onChange={(e) => loadSim(e.target.value)} className="mb-4 rounded border border-slate-700 bg-[#0b0e14] px-3 py-2 text-sm">
              <option value="">— pilih soal —</option>
              {problems.map((p) => (
                <option key={p.id} value={p.id}>{p.title} ({p.difficulty})</option>
              ))}
            </select>
            {sim && (
              <div className="rounded-lg border border-slate-800 p-4">
                <p className="mb-3 text-sm text-slate-400">{sim.total} submission · {sim.pairs.length} pasangan mirip (≥60%)</p>
                {sim.pairs.length === 0 ? (
                  <p className="text-slate-600">Tak ada kemiripan mencurigakan.</p>
                ) : (
                  <div className="space-y-1 font-mono text-sm">
                    {sim.pairs.map((p, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className={`w-12 font-bold ${simColor(p.similarity)}`}>{p.similarity}%</span>
                        <span className="text-slate-400">{p.a.slice(-6)} ↔ {p.b.slice(-6)}</span>
                        {p.similarity >= 90 && <span className="text-rose-500">⚠ nyaris identik</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {tab === 'users' && me.role === 'superadmin' && (
          <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
            <form onSubmit={createPenguji} className="space-y-3 rounded-lg border border-slate-800 p-4">
              <h3 className="font-semibold text-white">Tambah Penguji</h3>
              <input placeholder="Email" value={pForm.email} onChange={(e) => setPForm({ ...pForm, email: e.target.value })} className="w-full rounded border border-slate-700 bg-[#0b0e14] px-3 py-2 text-sm" />
              <input placeholder="Nama" value={pForm.name} onChange={(e) => setPForm({ ...pForm, name: e.target.value })} className="w-full rounded border border-slate-700 bg-[#0b0e14] px-3 py-2 text-sm" />
              <input placeholder="Sandi (min 8)" value={pForm.password} onChange={(e) => setPForm({ ...pForm, password: e.target.value })} className="w-full rounded border border-slate-700 bg-[#0b0e14] px-3 py-2 text-sm" />
              {pMsg && <p className="text-xs text-emerald-400">{pMsg}</p>}
              <button type="submit" className="w-full rounded bg-violet-600 px-4 py-2 text-sm text-white hover:bg-violet-500">Buat</button>
            </form>
            <div className="overflow-hidden rounded-lg border border-slate-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#0b0e14] font-mono text-xs text-slate-500">
                  <tr>
                    <th className="px-4 py-2">Nama</th>
                    <th className="px-4 py-2">Email</th>
                    <th className="px-4 py-2">Peran</th>
                    <th className="px-4 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-t border-slate-800">
                      <td className="px-4 py-2">{u.name}</td>
                      <td className="px-4 py-2 font-mono text-slate-400">{u.email}</td>
                      <td className="px-4 py-2 text-violet-400">{u.role}</td>
                      <td className="px-4 py-2 text-slate-400">{u.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {replayId && <ReplayModal attemptId={replayId} onClose={() => setReplayId(null)} />}
    </div>
  );
}
