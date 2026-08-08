import Link from 'next/link';

export default function Home() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#0d1117] px-6 text-center">
      <div className="cu-grid" aria-hidden />
      <div
        className="cu-orb cu-float text-violet-500"
        aria-hidden
        style={{ width: 340, height: 340, top: '-6rem', left: '-4rem' }}
      />
      <div
        className="cu-orb cu-float text-cyan-500"
        aria-hidden
        style={{ width: 300, height: 300, bottom: '-6rem', right: '-4rem', animationDelay: '1.5s' }}
      />

      <div className="cu-fade-up relative">
        <p className="mb-4 font-mono text-xs tracking-[0.3em] text-slate-500">
          UNISMUH · INFORMATIKA
        </p>
        <h1 className="text-5xl font-extrabold tracking-tight sm:text-7xl">
          <span className="cu-gradient">CodeUnical</span>
        </h1>
        <p className="mt-5 font-mono text-sm text-emerald-400">
          &gt; ketik manual · run · proctored<span className="cu-blink">_</span>
        </p>
        <p className="mx-auto mt-5 max-w-md text-slate-400">
          Platform ujian koding anti-nyontek. Ketik kode secara manual, jalankan langsung, diawasi
          berlapis.
        </p>
        <Link
          href="/welcome"
          className="mt-9 inline-flex items-center gap-2 rounded-lg bg-violet-600 px-7 py-3 font-medium text-white transition hover:-translate-y-0.5 hover:bg-violet-500"
        >
          Masuk →
        </Link>
      </div>

      <div className="cu-fade-up relative mt-14 flex items-center gap-2 font-mono text-xs text-slate-600">
        <span className="cu-pulse inline-block h-2 w-2 rounded-full bg-emerald-500" /> sistem aktif
      </div>
    </main>
  );
}
