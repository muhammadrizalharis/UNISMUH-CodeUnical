'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:47080';

export default function GateLogin() {
  const router = useRouter();
  const params = useParams<{ gate: string }>();
  const gate = decodeURIComponent(params.gate ?? '');
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
        body: JSON.stringify({ email, password, gate }),
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
    <main className="flex min-h-screen items-center justify-center bg-[#0d1117] px-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <p className="font-mono text-xs tracking-[0.3em] text-rose-500/80">SUPER ADMIN</p>
          <h1 className="mt-1 text-2xl font-bold text-white">Akses Terbatas 🔒</h1>
        </div>
        <form onSubmit={login} className="space-y-3">
          <input
            type="email"
            placeholder="Email super-admin"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-slate-700 bg-[#0b0e14] px-3 py-2 text-sm outline-none focus:border-rose-500"
          />
          <input
            type="password"
            placeholder="Sandi"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-slate-700 bg-[#0b0e14] px-3 py-2 text-sm outline-none focus:border-rose-500"
          />
          {err && <p className="text-sm text-rose-400">{err}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-rose-600 px-4 py-2 font-medium text-white transition hover:bg-rose-500 disabled:opacity-40"
          >
            {loading ? 'masuk…' : 'Masuk'}
          </button>
        </form>
      </div>
    </main>
  );
}
