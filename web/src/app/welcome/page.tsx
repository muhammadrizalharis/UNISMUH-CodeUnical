'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:47080';

export default function Welcome() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErr('');
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setErr(d.message || 'Login gagal.');
        return;
      }
      router.push('/dashboard');
    } catch {
      setErr('Tidak bisa menghubungi server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0d1117] px-6">
      <div className="cu-grid" aria-hidden />
      <div className="cu-orb cu-float text-violet-500" aria-hidden style={{ width: 320, height: 320, top: '-6rem', left: '-4rem' }} />

      <div className="cu-fade-up relative w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-extrabold tracking-tight">
            <span className="cu-gradient">CodeUnical</span>
          </h1>
          <p className="mt-1 font-mono text-xs text-slate-500">UNISMUH · Ujian Koding</p>
        </div>

        {/* Peserta */}
        <button
          onClick={() => router.push('/exam')}
          className="w-full rounded-lg bg-violet-600 px-6 py-3 font-medium text-white transition hover:bg-violet-500"
        >
          Mulai Ujian (Peserta) →
        </button>

        <div className="my-6 flex items-center gap-3 text-xs text-slate-600">
          <div className="h-px flex-1 bg-slate-800" /> penguji <div className="h-px flex-1 bg-slate-800" />
        </div>

        {/* Penguji login */}
        <form onSubmit={login} className="space-y-3">
          <input
            type="email"
            placeholder="Email penguji"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-slate-700 bg-[#0b0e14] px-3 py-2 text-sm outline-none focus:border-violet-500"
          />
          <input
            type="password"
            placeholder="Sandi"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-slate-700 bg-[#0b0e14] px-3 py-2 text-sm outline-none focus:border-violet-500"
          />
          {err && <p className="text-sm text-rose-400">{err}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded border border-slate-700 px-4 py-2 text-sm transition hover:bg-slate-800 disabled:opacity-40"
          >
            {loading ? 'masuk…' : 'Login Penguji'}
          </button>
        </form>

        <p className="mt-4 text-center font-mono text-[11px] text-slate-600">
          Login SSO UNISMUH menyusul (dosen otomatis jadi penguji)
        </p>
      </div>
    </main>
  );
}
