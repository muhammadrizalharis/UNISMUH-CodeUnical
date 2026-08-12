'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

// Alamat API same-origin: /api diproksi Next ke backend (tanpa isu lintas-origin/cookie).
const API = process.env.NEXT_PUBLIC_API_URL || '/api';

export default function Welcome() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [sso, setSso] = useState<{ enabled: boolean; label: string; ssoOnly: boolean }>({
    enabled: false,
    label: 'SSO UNISMUH',
    ssoOnly: false,
  });
  const [ssoMsg, setSsoMsg] = useState('');

  useEffect(() => {
    fetch(`${API}/auth/sso/status`)
      .then((r) => r.json())
      .then((d) =>
        setSso({
          enabled: !!d?.enabled,
          label: d?.label ?? 'SSO UNISMUH',
          ssoOnly: !!d?.ssoOnly,
        }),
      )
      .catch(() => undefined);
    const p = new URLSearchParams(window.location.search).get('sso');
    if (p === 'pending') setSsoMsg('Akun SSO kamu menunggu persetujuan super-admin.');
    else if (p === 'error') setSsoMsg('Login SSO gagal atau dibatalkan. Coba lagi.');
  }, []);

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
      const d = await res.json().catch(() => ({}));
      // Satu pintu login: mahasiswa -> ujian, dosen/admin -> dashboard.
      router.push(d?.user?.role === 'peserta' ? '/exams' : '/dashboard');
    } catch {
      setErr('Tidak bisa menghubungi server.');
    } finally {
      setLoading(false);
    }
  };

  // SSO-only efektif: form login lokal disembunyikan (super-admin lewat /welcome/[gate]).
  const ssoOnlyActive = sso.ssoOnly && sso.enabled;

  return (
    <main className="term relative flex min-h-screen flex-col items-center justify-center overflow-x-hidden bg-[#0a0f0d] px-4 py-10">
      <div className="term-vignette" aria-hidden />
      <div className="term-scan" aria-hidden />

      {/* Logo di atas jendela */}
      <div
        className="term-line mb-5 flex flex-col items-center gap-2"
        style={{ animationDelay: '0.1s' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-emblem.png"
          alt="UNISMUH CodeUnical"
          width={88}
          height={88}
          className="h-20 w-20"
          style={{ filter: 'drop-shadow(0 0 16px rgba(52,211,153,0.25))' }}
        />
        <span className="term-brand-txt">UNISMUH · CODEUNICAL</span>
      </div>

      <div className="term-window w-full max-w-md">
        <div className="term-bar">
          <span className="term-dot" style={{ background: '#ff5f56' }} />
          <span className="term-dot" style={{ background: '#ffbd2e' }} />
          <span className="term-dot" style={{ background: '#27c93f' }} />
          <span className="term-title">login@codeunical: ~ — bash</span>
          <span className="term-badge">
            <span className="term-live" /> online
          </span>
        </div>

        <div className="term-body">
          <p className="term-cmd mb-4">
            <span className="term-prompt">$</span> <span className="term-key">login</span>{' '}
            <span className="term-muted"># masuk untuk memulai ujian</span>
          </p>

          {ssoMsg && (
            <p
              className="term-line mb-3 rounded-md border px-3 py-2 text-xs"
              style={{
                borderColor: 'rgba(251,191,36,0.35)',
                background: 'rgba(120,53,15,0.25)',
                color: '#fcd34d',
              }}
            >
              ! {ssoMsg}
            </p>
          )}

          <button
            onClick={() => sso.enabled && (window.location.href = `${API}/auth/sso/login`)}
            disabled={!sso.enabled}
            title={sso.enabled ? '' : 'Belum aktif — menunggu konfigurasi SSO oleh admin'}
            className="term-btn-ghost"
          >
            <span className="term-btn-prompt">$</span> login --sso ({sso.label})
            {!sso.enabled && <span className="term-tag">segera</span>}
          </button>

          {!ssoOnlyActive && (
            <>
              <div className="term-or my-4">
                <span>atau masuk akun</span>
              </div>

              <form onSubmit={login} className="space-y-3">
                <div>
                  <label className="term-label">login:</label>
                  <input
                    type="email"
                    autoFocus
                    autoComplete="username"
                    placeholder="NIM mahasiswa / email dosen"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="term-input"
                  />
                </div>
                <div>
                  <label className="term-label">password:</label>
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
                <button type="submit" disabled={loading} className="term-btn w-full justify-center">
                  <span className="term-btn-prompt">$</span> {loading ? 'masuk…' : 'masuk'}
                  {!loading && <span aria-hidden>→</span>}
                </button>
              </form>
            </>
          )}

          <p className="term-line term-muted mt-4" style={{ fontSize: '11px' }}>
            {ssoOnlyActive
              ? '# login hanya lewat SSO · dosen → penguji, mahasiswa → peserta'
              : sso.enabled
                ? '# dosen → penguji, mahasiswa → peserta (otomatis dari SSO)'
                : '# SSO UNISMUH aktif otomatis saat admin memasang kredensial'}
          </p>
        </div>
      </div>
    </main>
  );
}
