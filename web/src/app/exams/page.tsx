'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// Alamat API: ikut host halaman (LAN 10.33.33.11 / localhost) bila env kosong.
const API =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:47080`
    : 'http://localhost:47080');

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
  const router = useRouter();
  const [me, setMe] = useState<{ name: string; code?: string | null } | null | undefined>(undefined);
  const [exams, setExams] = useState<PublicExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  // Wajib login untuk melihat/mengerjakan ujian.
  useEffect(() => {
    fetch(`${API}/auth/me`, { credentials: 'include' })
      .then((r) => r.json())
      .then((u) => {
        if (!u) {
          router.replace('/welcome');
          setMe(null);
        } else {
          setMe(u);
        }
      })
      .catch(() => {
        router.replace('/welcome');
        setMe(null);
      });
  }, [router]);

  useEffect(() => {
    if (!me) return;
    fetch(`${API}/public/exams`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d: PublicExam[]) => setExams(Array.isArray(d) ? d : []))
      .catch(() => setExams([]))
      .finally(() => setLoading(false));
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [me]);

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });

  if (me === undefined) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0d1117] text-sm text-slate-500">
        Memeriksa sesi…
      </main>
    );
  }
  if (!me) return null; // sedang dialihkan ke /welcome

  return (
    <main className="min-h-screen bg-[#0d1117] px-4 py-10 text-slate-200">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/LOGO-CODE-UNICAL.png" alt="" className="h-11 w-11 rounded-lg" />
            <div>
              <h1 className="text-2xl font-bold text-white">Ujian Tersedia</h1>
              <p className="text-sm text-slate-500">UNISMUH CodeUnical — pilih ujian untuk dikerjakan.</p>
            </div>
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
