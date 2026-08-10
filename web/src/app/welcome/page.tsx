'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

// Alamat API: ikut host halaman (LAN 10.33.33.11 / localhost) bila env kosong.
const API =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:47080`
    : 'http://localhost:47080');

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

        {/* SSO UNISMUH (aktif otomatis saat env SSO_* terisi) */}
        {ssoMsg && (
          <p className="mb-3 rounded border border-amber-800 bg-amber-950/40 px-3 py-2 text-center text-xs text-amber-300">
            {ssoMsg}
          </p>
        )}
        <button
          onClick={() => sso.enabled && (window.location.href = `${API}/auth/sso/login`)}
          disabled={!sso.enabled}
          title={sso.enabled ? '' : 'Belum aktif — menunggu konfigurasi SSO oleh admin'}
          className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg border border-violet-700 bg-violet-950/40 px-6 py-3 font-medium text-violet-200 transition hover:bg-violet-900/50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span aria-hidden>🎓</span> Masuk dengan {sso.label}
          {!sso.enabled && (
            <span className="ml-1 rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
              segera
            </span>
          )}
        </button>

        {!ssoOnlyActive && (
          <>
        <div className="my-4 flex items-center gap-3 text-[11px] text-slate-600">
          <div className="h-px flex-1 bg-slate-800" /> atau masuk akun <div className="h-px flex-1 bg-slate-800" />
        </div>

        {/* Login satu pintu: dosen & mahasiswa */}
        <form onSubmit={login} className="space-y-3">
          <input
            type="email"
            placeholder="Email (NIM mahasiswa / email dosen)"
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
            {loading ? 'masuk…' : 'Masuk'}
          </button>
        </form>
          </>
        )}

        <p className="mt-4 text-center font-mono text-[11px] text-slate-600">
          {ssoOnlyActive
            ? 'Login hanya lewat SSO UNISMUH · dosen → penguji, mahasiswa → peserta'
            : sso.enabled
              ? 'Dosen → penguji, mahasiswa → peserta (otomatis dari SSO)'
              : 'SSO UNISMUH aktif otomatis saat admin memasang kredensial'}
        </p>
      </div>
    </main>
  );
}
