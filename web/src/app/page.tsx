import Link from 'next/link';
import EnterToStart from './enter-to-start';

// Status "boot" yang tercetak baris-per-baris di terminal.
const BOOT = [
  { k: 'proctoring AI', v: 'aktif' },
  { k: 'editor terkunci', v: 'aktif' },
  { k: 'pemantauan real-time', v: 'aktif' },
  { k: 'anti-paste & pindah-tab', v: 'aktif' },
];

// ASCII "CU" (backslash digandakan agar tak dimakan template literal).
const LOGO = `  ___ _   _ 
 / __| | | |
| (__| |_| |
 \\___|\\___/ `;

export default function Home() {
  return (
    <main className="term relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#0a0f0d] px-4 py-10">
      {/* Latar CRT — statis di mode lite */}
      <div className="term-vignette" aria-hidden />
      <div className="term-scan" aria-hidden />
      <EnterToStart href="/welcome" />

      {/* Lockup merek (kalem) */}
      <div className="term-line mb-5 flex items-center gap-2" style={{ animationDelay: '0.15s' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-emblem.png" alt="" width={24} height={24} className="opacity-90" />
        <span className="term-brand-txt">UNISMUH · CODEUNICAL</span>
      </div>

      {/* Jendela terminal */}
      <div className="term-window w-full max-w-2xl">
        <div className="term-bar">
          <span className="term-dot" style={{ background: '#ff5f56' }} />
          <span className="term-dot" style={{ background: '#ffbd2e' }} />
          <span className="term-dot" style={{ background: '#27c93f' }} />
          <span className="term-title">peserta@codeunical: ~/ujian — bash</span>
          <span className="term-badge">
            <span className="term-live" /> online
          </span>
        </div>

        <div className="term-body">
          <p className="term-cmd">
            <span className="term-prompt">$</span>{' '}
            <span className="term-type">./codeunical --start</span>
          </p>

          <pre className="term-line term-logo" style={{ animationDelay: '1.15s' }}>
            {LOGO}
          </pre>

          <p className="term-line" style={{ animationDelay: '1.35s' }}>
            <span className="term-key">UNISMUH CodeUnical</span>{' '}
            <span className="term-muted">v1.0</span>
          </p>
          <p className="term-line term-muted" style={{ animationDelay: '1.5s' }}>
            # ujian coding anti-nyontek · Fakultas Teknik UNISMUH Makassar
          </p>

          <div
            className="term-line my-3 h-px bg-emerald-500/15"
            style={{ animationDelay: '1.65s' }}
            aria-hidden
          />

          {BOOT.map((b, i) => (
            <p
              key={b.k}
              className="term-line term-check"
              style={{ animationDelay: `${1.8 + i * 0.15}s` }}
            >
              <span className="term-ok">[ OK ]</span>
              <span>{b.k}</span>
              <span className="term-lead" aria-hidden />
              <span className="term-val">{b.v}</span>
            </p>
          ))}

          <p className="term-line mt-3" style={{ animationDelay: '2.5s' }}>
            <span className="term-prompt">$</span> <span className="term-key">login</span>{' '}
            <span className="term-flag">--masuk</span>
            <span className="term-caret">▋</span>
          </p>
        </div>
      </div>

      {/* Aksi */}
      <div
        className="term-line mt-6 flex w-full max-w-2xl flex-wrap items-center justify-center gap-3"
        style={{ animationDelay: '2.7s' }}
      >
        <Link href="/welcome" className="term-btn">
          <span className="term-btn-prompt">$</span> masuk <span aria-hidden>→</span>
        </Link>
        <span className="term-hint">
          tekan <kbd className="term-kbd">Enter</kbd> untuk mulai ujian
        </span>
      </div>

      {/* Status bar */}
      <div className="term-status term-line mt-8 justify-center" style={{ animationDelay: '2.85s' }}>
        <span className="inline-flex items-center gap-1.5">
          <span className="term-live" /> sistem aktif
        </span>
        <span>node v22</span>
        <span>:47300</span>
        <span>UNISMUH · INFORMATIKA</span>
      </div>
    </main>
  );
}
