import Link from 'next/link';

// Partikel dekoratif — posisi tetap (tanpa Math.random) agar tak ada mismatch hydration.
const PARTICLES = [
  { left: '10%', color: 'text-violet-400', delay: '0s', dur: '8s' },
  { left: '22%', color: 'text-cyan-400', delay: '1.4s', dur: '9.5s' },
  { left: '35%', color: 'text-indigo-400', delay: '2.6s', dur: '8.5s' },
  { left: '48%', color: 'text-fuchsia-400', delay: '0.8s', dur: '10s' },
  { left: '61%', color: 'text-cyan-300', delay: '3.2s', dur: '9s' },
  { left: '73%', color: 'text-violet-300', delay: '1.9s', dur: '8.2s' },
  { left: '85%', color: 'text-sky-400', delay: '2.2s', dur: '9.8s' },
  { left: '93%', color: 'text-fuchsia-300', delay: '0.4s', dur: '8.8s' },
];

export default function Home() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#0d1117] px-6 text-center">
      {/* Dekorasi bergerak — semua otomatis mati/tersembunyi di mode lite / reduce-motion */}
      <div className="cu-aurora" aria-hidden />
      <div className="cu-grid" aria-hidden />
      <div className="cu-orb cu-float text-violet-500" aria-hidden style={{ width: 360, height: 360, top: '-7rem', left: '-5rem' }} />
      <div className="cu-orb cu-float text-cyan-500" aria-hidden style={{ width: 320, height: 320, bottom: '-7rem', right: '-5rem', animationDelay: '1.6s' }} />
      <div className="cu-orb cu-float text-fuchsia-500" aria-hidden style={{ width: 240, height: 240, top: '28%', right: '12%', animationDelay: '3s' }} />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2" aria-hidden>
        {PARTICLES.map((p, i) => (
          <span
            key={i}
            className={`cu-particle ${p.color}`}
            style={{ left: p.left, bottom: 0, animationDelay: p.delay, animationDuration: p.dur }}
          />
        ))}
      </div>

      <div className="relative">
        {/* Logo + cincin berputar + halo denyut */}
        <div className="cu-fade-up relative mx-auto mb-6 h-44 w-44">
          <span
            className="cu-glow absolute -inset-10 rounded-full"
            aria-hidden
            style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.30), transparent 62%)' }}
          />
          <div className="cu-ring absolute -inset-6" aria-hidden />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-emblem.png" alt="UNISMUH CodeUnical" className="relative h-44 w-44" />
        </div>
        <p className="cu-fade-up cu-d1 mb-4 font-mono text-xs tracking-[0.3em] text-slate-500">
          UNISMUH · INFORMATIKA
        </p>
        <h1 className="cu-fade-up cu-d2 text-5xl font-extrabold tracking-tight sm:text-7xl">
          <span className="cu-gradient">CodeUnical</span>
        </h1>
        <p className="cu-fade-up cu-d3 mt-5 font-mono text-sm text-emerald-400">
          &gt; ketik manual · run · proctored<span className="cu-blink">_</span>
        </p>
        <p className="cu-fade-up cu-d4 mx-auto mt-5 max-w-md text-slate-400">
          Platform ujian koding anti-nyontek. Ketik kode secara manual, jalankan langsung, diawasi
          berlapis.
        </p>
        <Link
          href="/welcome"
          className="cu-fade-up cu-d5 cu-sheen relative mt-9 inline-flex items-center gap-2 overflow-hidden rounded-lg bg-violet-600 px-7 py-3 font-medium text-white shadow-lg shadow-violet-900/30 transition hover:-translate-y-0.5 hover:bg-violet-500"
        >
          Masuk →
        </Link>
      </div>

      <div className="cu-fade-up cu-d5 relative mt-14 flex items-center gap-2 font-mono text-xs text-slate-600">
        <span className="cu-pulse inline-block h-2 w-2 rounded-full bg-emerald-500" /> sistem aktif
      </div>
    </main>
  );
}
