import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#0d1117] px-6 text-center text-slate-200">
      <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
        UNISMUH <span className="text-violet-400">CodeUnical</span>
      </h1>
      <p className="mt-3 font-mono text-sm text-emerald-400">
        &gt; ketik manual · run · proctored · integrity by design
      </p>
      <p className="mt-4 max-w-md text-slate-400">
        Platform ujian koding anti-nyontek. Ketik kode secara manual, jalankan langsung, diawasi
        berlapis.
      </p>
      <Link
        href="/exam"
        className="mt-8 rounded-lg bg-violet-600 px-6 py-3 font-medium text-white transition hover:bg-violet-500"
      >
        Buka Editor Demo →
      </Link>
      <p className="mt-10 font-mono text-xs text-slate-600">MVP · tahap 1</p>
    </main>
  );
}
