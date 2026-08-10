'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:47080';

interface PublicExam {
  id: string;
  title: string;
  description: string;
  durationMin: number;
  startAt: string;
  endAt: string;
  course: { name: string } | null;
  _count: { problems: number };
}

function statusOf(startAt: string, endAt: string, now: number) {
  const s = new Date(startAt).getTime();
  const e = new Date(endAt).getTime();
  if (now < s) return { label: 'Belum mulai', color: 'bg-slate-800 text-slate-300', open: false };
  if (now > e) return { label: 'Berakhir', color: 'bg-rose-950 text-rose-300', open: false };
  return { label: 'Berlangsung', color: 'bg-emerald-950 text-emerald-300', open: true };
}

export default function ExamsListPage() {
  const [exams, setExams] = useState<PublicExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    fetch(`${API}/public/exams`)
      .then((r) => r.json())
      .then((d: PublicExam[]) => setExams(Array.isArray(d) ? d : []))
      .catch(() => setExams([]))
      .finally(() => setLoading(false));
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <main className="min-h-screen bg-[#0d1117] px-4 py-10 text-slate-200">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Ujian Tersedia</h1>
            <p className="text-sm text-slate-500">UNISMUH CodeUnical — pilih ujian untuk dikerjakan.</p>
          </div>
          <Link href="/welcome" className="text-sm text-slate-400 hover:text-slate-200">
            ← Beranda
          </Link>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Memuat…</p>
        ) : exams.length === 0 ? (
          <div className="rounded-lg border border-slate-800 bg-[#0b0e14] p-8 text-center">
            <p className="text-slate-400">Belum ada ujian yang tayang.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {exams.map((ex) => {
              const st = statusOf(ex.startAt, ex.endAt, now);
              return (
                <li key={ex.id} className="rounded-lg border border-slate-800 bg-[#0b0e14] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="truncate font-semibold text-white">{ex.title}</h2>
                        <span className={`shrink-0 rounded px-2 py-0.5 text-[10px] ${st.color}`}>
                          {st.label}
                        </span>
                      </div>
                      {ex.course?.name && (
                        <p className="mt-0.5 text-xs text-slate-500">{ex.course.name}</p>
                      )}
                      {ex.description && (
                        <p className="mt-1 line-clamp-2 text-sm text-slate-400">{ex.description}</p>
                      )}
                      <p className="mt-2 font-mono text-[11px] text-slate-500">
                        {ex._count.problems} soal · {ex.durationMin} menit
                      </p>
                      <p className="font-mono text-[11px] text-slate-600">
                        {fmt(ex.startAt)} — {fmt(ex.endAt)}
                      </p>
                    </div>
                    {st.open ? (
                      <Link
                        href={`/exam?exam=${ex.id}`}
                        className="shrink-0 rounded bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
                      >
                        Kerjakan
                      </Link>
                    ) : (
                      <button
                        disabled
                        className="shrink-0 cursor-not-allowed rounded bg-slate-800 px-4 py-2 text-sm text-slate-500"
                      >
                        Kerjakan
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
