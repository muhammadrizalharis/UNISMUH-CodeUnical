'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

// Alamat API same-origin: /api diproksi Next ke backend (tanpa isu lintas-origin/cookie).
const API = process.env.NEXT_PUBLIC_API_URL || '/api';

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
    <main className="term relative flex min-h-screen flex-col items-center justify-center overflow-x-hidden bg-[#0a0f0d] px-4 py-10">
      <div className="term-vignette" aria-hidden />
      <div className="term-scan" aria-hidden />

      <div className="term-window w-full max-w-md" style={{ borderColor: 'rgba(251,113,133,0.3)' }}>
        <div className="term-bar" style={{ borderColor: 'rgba(251,113,133,0.2)' }}>
          <span className="term-dot" style={{ background: '#ff5f56' }} />
          <span className="term-dot" style={{ background: '#ffbd2e' }} />
          <span className="term-dot" style={{ background: '#27c93f' }} />
          <span className="term-title" style={{ color: '#fb7185' }}>
            root@codeunical: ~ — sudo
          </span>
          <span className="term-badge" style={{ color: '#fb7185' }}>
            <span
              className="term-live"
              style={{ background: '#fb7185', boxShadow: '0 0 8px #fb7185' }}
            />{' '}
            secure
          </span>
        </div>

        <div className="term-body">
          <p className="term-cmd">
            <span style={{ color: '#fb7185' }}>#</span> <span className="term-key">sudo</span>{' '}
            <span className="term-muted">akses super-admin</span>
          </p>
          <p className="term-line term-muted mt-1 mb-4" style={{ fontSize: '11px' }}>
            ⚠ area terbatas — hanya untuk super-admin
          </p>

          <form onSubmit={login} className="term-danger space-y-3">
            <div>
              <label className="term-label" style={{ color: '#fb7185' }}>
                root@login:
              </label>
              <input
                type="email"
                autoFocus
                autoComplete="username"
                placeholder="email super-admin"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="term-input"
              />
            </div>
            <div>
              <label className="term-label" style={{ color: '#fb7185' }}>
                password:
              </label>
              <input
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="term-input"
              />
            </div>
            {err && <p className="term-err">✗ {err}</p>}
            <button type="submit" disabled={loading} className="term-btn-danger">
              {loading ? 'autentikasi…' : 'sudo masuk'} <span aria-hidden>⏎</span>
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
