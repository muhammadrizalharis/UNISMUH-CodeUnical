'use client';

import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ReplayModal } from './ReplayModal';

// Alamat API same-origin: /api diproksi Next ke backend (tanpa isu lintas-origin/cookie).
const API = process.env.NEXT_PUBLIC_API_URL || '/api';
const opt: RequestInit = { credentials: 'include' };

interface Me {
  id: string;
  code?: string | null;
  name: string;
  email: string;
  role: string;
}
interface Attempt {
  id: string;
  status: string;
  strikes: number;
  live: boolean;
  events: number;
  keystrokes: number;
  startedAt: string;
  lastSeenAt: string;
  peserta?: { name: string; code: string | null } | null;
  examTitle?: string | null;
}
interface Sub {
  id: string;
  passed: number;
  total: number;
  score: number;
  maxScore: number;
  createdAt: string;
  peserta?: { name: string; code: string | null } | null;
}
interface ProblemLite {
  id: string;
  title: string;
  difficulty: string;
}
interface SimPerson {
  name: string | null;
  code: string | null;
  sub?: string;
  subId?: string;
}
interface SimPair {
  a: SimPerson;
  b: SimPerson;
  similarity: number;
}
interface PairSide {
  name: string | null;
  code: string | null;
  sub?: string;
  source: string;
  matched: number[];
}
interface PairDetail {
  similarity: number;
  a: PairSide;
  b: PairSide;
}
interface UserRow {
  id: string;
  code?: string | null;
  email: string;
  name: string;
  role: string;
  status: string;
}

interface ProdiInfo {
  synced: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
  allowed: string[];
  prodi: {
    code: string;
    kodeFakultas: string;
    kodeProdi: string;
    kodeNim: string | null;
    name: string;
    allowed: boolean;
  }[];
}

interface Course {
  id: string;
  code: string | null;
  name: string;
  semester: number | null;
  createdById: string | null;
  _count: { problems: number };
}
interface CourseDetail extends Course {
  problems: { id: string; title: string; language: string; difficulty: string }[];
}

interface CaseForm {
  stdin: string;
  expected: string;
  points: number;
  hidden: boolean;
}
interface SoalForm {
  id: string | null;
  courseId: string;
  title: string;
  language: string;
  difficulty: string;
  description: string;
  starterCode: string;
  setupSql: string;
  testCases: CaseForm[];
}

interface Material {
  id: string;
  title: string;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

interface ExamLite {
  id: string;
  title: string;
  durationMin: number;
  startAt: string;
  endAt: string;
  published: boolean;
  _count: { problems: number };
}
interface ExamForm {
  id: string | null;
  courseId: string;
  title: string;
  description: string;
  durationMin: number;
  startAt: string; // datetime-local
  endAt: string; // datetime-local
  published: boolean;
  problemIds: string[];
}

const SOAL_LANGS = [
  'python',
  'javascript',
  'typescript',
  'java',
  'cpp',
  'c',
  'csharp',
  'go',
  'rust',
  'php',
  'ruby',
  'sql',
  'html',
];

type Tab = 'monitor' | 'arsip' | 'subs' | 'sim' | 'users' | 'examiners' | 'courses';

// Ikon garis (Feather/Lucide) per tab — currentColor mengikuti warna teks tab.
const TAB_ICON: Record<Tab, ReactNode> = {
  monitor: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h4l2 6 3-15 3 12 2-5h4" /></svg>
  ),
  arsip: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="4" rx="1" /><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" /><path d="M10 12h4" /></svg>
  ),
  subs: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 20h18" /><path d="M6 20v-7" /><path d="M12 20V5" /><path d="M18 20v-10" /></svg>
  ),
  sim: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="12" r="6" /><circle cx="15" cy="12" r="6" /></svg>
  ),
  courses: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
  ),
  examiners: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
  ),
};

// Jam berjalan — komponen terisolasi agar render per-detik tak memicu render seluruh dashboard.
function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <>
      <span>{now.toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short', year: '2-digit' })}</span>
      <b>{now.toLocaleTimeString('id-ID')}</b>
    </>
  );
}

// Label peserta di daftar kemiripan (nama + kode, atau Anonim + potongan id submission).
function SimName({ p }: { p: SimPerson }) {
  if (!p.name) return <span className="text-slate-500">Anonim #{p.sub}</span>;
  return (
    <span className="text-slate-200">
      {p.name}
      {p.code && <span className="ml-1 text-[11px] text-slate-500">{p.code}</span>}
    </span>
  );
}

// Modal detail sepasang submission: kode berdampingan, baris identik strukturnya disorot merah.
function SimPairModal({
  problemId,
  a,
  b,
  onClose,
}: {
  problemId: string;
  a: SimPerson;
  b: SimPerson;
  onClose: () => void;
}) {
  const [data, setData] = useState<PairDetail | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (!a.subId || !b.subId) {
      setErr('ID submission tidak tersedia.');
      return;
    }
    fetch(
      `${API}/problems/${problemId}/similarity/pair?a=${encodeURIComponent(a.subId)}&b=${encodeURIComponent(b.subId)}`,
      { credentials: 'include' },
    )
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('http'))))
      .then(setData)
      .catch(() => setErr('Gagal memuat detail.'));
  }, [problemId, a.subId, b.subId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="flex max-h-[88vh] w-full max-w-5xl flex-col rounded-xl border border-slate-700 bg-[#0b0e14]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2">
          <span className="font-mono text-sm text-slate-300">
            🔍 Detail kemiripan{data ? ` · ${data.similarity}%` : ''}
          </span>
          <button onClick={onClose} className="text-slate-500 hover:text-white">
            ✕
          </button>
        </div>
        {err ? (
          <p className="p-6 text-center text-rose-400">{err}</p>
        ) : !data ? (
          <p className="p-8 text-center text-slate-500">Memuat…</p>
        ) : (
          <div className="grid flex-1 gap-3 overflow-auto p-4 md:grid-cols-2">
            {[data.a, data.b].map((side, idx) => (
              <div key={idx} className="flex min-w-0 flex-col rounded-lg border border-slate-800">
                <div className="border-b border-slate-800 px-3 py-2 text-xs">
                  <SimName p={side} />
                  <span className="ml-1 text-slate-600">· {side.matched.length} baris cocok</span>
                </div>
                <pre className="flex-1 overflow-auto text-xs leading-5">
                  <code>
                    {side.source.split('\n').map((line, i) => {
                      const hit = side.matched.includes(i);
                      return (
                        <div key={i} className={hit ? 'flex bg-rose-500/15' : 'flex'}>
                          <span className="w-9 shrink-0 select-none border-r border-slate-800 px-2 text-right text-slate-600">
                            {i + 1}
                          </span>
                          <span className={`whitespace-pre px-2 ${hit ? 'text-rose-200' : 'text-slate-300'}`}>
                            {line || ' '}
                          </span>
                        </div>
                      );
                    })}
                  </code>
                </pre>
              </div>
            ))}
          </div>
        )}
        {data && (
          <div className="border-t border-slate-800 px-4 py-2 text-[11px] text-slate-500">
            Baris berlatar merah = struktur identik setelah normalisasi (nama variabel/angka
            diseragamkan) — indikasi kuat penyalinan.
          </div>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>('monitor');
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [examFilter, setExamFilter] = useState('');
  const [examOptions, setExamOptions] = useState<{ id: string; title: string; count: number }[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [problems, setProblems] = useState<ProblemLite[]>([]);
  const [simProblem, setSimProblem] = useState('');
  const [sim, setSim] = useState<{ total: number; exam: string | null; pairs: SimPair[] } | null>(
    null,
  );
  const [simPair, setSimPair] = useState<{ a: SimPerson; b: SimPerson } | null>(null);
  const [replayId, setReplayId] = useState<string | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [prodiInfo, setProdiInfo] = useState<ProdiInfo | null>(null);
  const [pForm, setPForm] = useState({ email: '', name: '', password: '', role: 'penguji' });
  const [pMsg, setPMsg] = useState('');
  const [examiners, setExaminers] = useState<string[]>([]);
  const [enrollName, setEnrollName] = useState('');
  const [enrollMsg, setEnrollMsg] = useState('');
  const [enrollShots, setEnrollShots] = useState<{ front?: string; left?: string; right?: string }>({});
  const [enrollBusy, setEnrollBusy] = useState(false);
  const [enrollCamOn, setEnrollCamOn] = useState(false);
  const enrollVideoRef = useRef<HTMLVideoElement | null>(null);
  const enrollStreamRef = useRef<MediaStream | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [openCourse, setOpenCourse] = useState<CourseDetail | null>(null);
  const [ncName, setNcName] = useState('');
  const [ncSem, setNcSem] = useState('');
  const [courseMsg, setCourseMsg] = useState('');
  const [impPeriode, setImpPeriode] = useState('');
  const [impProdi, setImpProdi] = useState('');
  const [impBusy, setImpBusy] = useState(false);
  const [impMsg, setImpMsg] = useState('');
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{
    configured: boolean;
    enabled: boolean;
    last: {
      at: string;
      ok: boolean;
      trigger: string;
      periode?: string;
      imported?: number;
      skipped?: number;
      reason?: string;
      message?: string;
    } | null;
  } | null>(null);
  const [soal, setSoal] = useState<SoalForm | null>(null);
  const [soalMsg, setSoalMsg] = useState('');
  const [soalBusy, setSoalBusy] = useState(false);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [matMsg, setMatMsg] = useState('');
  const [matBusy, setMatBusy] = useState(false);
  const [exams, setExams] = useState<ExamLite[]>([]);
  const [exam, setExam] = useState<ExamForm | null>(null);
  const [examMsg, setExamMsg] = useState('');
  const [examBusy, setExamBusy] = useState(false);
  const [showGen, setShowGen] = useState(false);
  const [genMaterialIds, setGenMaterialIds] = useState<string[]>([]);
  const [genCount, setGenCount] = useState(2);
  const [genLang, setGenLang] = useState('python');
  const [genDiff, setGenDiff] = useState('sedang');
  const [genBusy, setGenBusy] = useState(false);
  const [genMsg, setGenMsg] = useState('');
  const [genDrafts, setGenDrafts] = useState<SoalForm[]>([]);

  useEffect(() => {
    fetch(`${API}/auth/me`, opt)
      .then((r) => r.json())
      .then((u: Me | null) => {
        if (!u || (u.role !== 'penguji' && u.role !== 'superadmin')) {
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

  const poll = useCallback(() => {
    const q = examFilter ? `?examId=${encodeURIComponent(examFilter)}` : '';
    fetch(`${API}/monitor/attempts${q}`, opt).then((r) => r.json()).then(setAttempts).catch(() => undefined);
    fetch(`${API}/monitor/submissions`, opt).then((r) => r.json()).then(setSubs).catch(() => undefined);
  }, [examFilter]);

  useEffect(() => {
    if (!me) return;
    poll();
    fetch(`${API}/problems`, opt).then((r) => r.json()).then(setProblems).catch(() => undefined);
    fetch(`${API}/monitor/exam-filters`, opt).then((r) => r.json()).then(setExamOptions).catch(() => undefined);
    const t = setInterval(poll, 4000);
    return () => clearInterval(t);
  }, [me, poll]);

  const loadUsers = useCallback(() => {
    fetch(`${API}/auth/users`, opt).then((r) => r.json()).then(setUsers).catch(() => undefined);
  }, []);

  const loadProdi = useCallback(() => {
    fetch(`${API}/prodi`, opt).then((r) => r.json()).then(setProdiInfo).catch(() => undefined);
  }, []);

  const toggleProdi = async (code: string, on: boolean) => {
    const r = await fetch(`${API}/prodi/toggle`, {
      ...opt,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, on }),
    });
    if (r.ok) setProdiInfo(await r.json());
  };

  useEffect(() => {
    if (me && tab === 'users') {
      loadUsers();
      loadProdi();
    }
  }, [me, tab, loadUsers, loadProdi]);

  const loadExaminers = useCallback(() => {
    fetch(`${API}/examiners`, opt).then((r) => r.json()).then(setExaminers).catch(() => undefined);
  }, []);

  useEffect(() => {
    // Daftar semua penguji hanya untuk super-admin; penguji cukup mendaftarkan wajahnya.
    if (me && tab === 'examiners' && me.role === 'superadmin') loadExaminers();
  }, [me, tab, loadExaminers]);

  const loadCourses = useCallback(() => {
    fetch(`${API}/courses`, opt).then((r) => r.json()).then(setCourses).catch(() => undefined);
    fetch(`${API}/courses/sync-status`, opt).then((r) => r.json()).then(setSyncStatus).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (me && tab === 'courses') loadCourses();
  }, [me, tab, loadCourses]);

  const loadSim = (id: string) => {
    setSimProblem(id);
    setSim(null);
    if (!id) return;
    fetch(`${API}/problems/${id}/similarity`, opt).then((r) => r.json()).then(setSim).catch(() => undefined);
  };

  const createPenguji = async (e: React.FormEvent) => {
    e.preventDefault();
    setPMsg('');
    const res = await fetch(`${API}/auth/users`, {
      ...opt,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pForm),
    });
    if (res.ok) {
      setPMsg(`${pForm.role === 'peserta' ? 'Mahasiswa' : 'Penguji'} ${pForm.email} dibuat.`);
      setPForm({ email: '', name: '', password: '', role: pForm.role });
      loadUsers();
    } else {
      const d = await res.json().catch(() => ({}));
      setPMsg(d.message || 'Gagal.');
    }
  };

  const setUserStatus = async (id: string, status: string) => {
    await fetch(`${API}/auth/users/${id}/status`, {
      ...opt,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }).catch(() => undefined);
    loadUsers();
  };

  const startEnrollCam = async () => {
    setEnrollMsg('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false,
      });
      enrollStreamRef.current = stream;
      setEnrollCamOn(true);
      // video ter-render setelah state -> pasang stream di microtask berikutnya
      setTimeout(() => {
        if (enrollVideoRef.current) {
          enrollVideoRef.current.srcObject = stream;
          void enrollVideoRef.current.play().catch(() => undefined);
        }
      }, 50);
    } catch {
      setEnrollMsg('Kamera tidak bisa diakses (izin ditolak?).');
    }
  };

  const stopEnrollCam = useCallback(() => {
    enrollStreamRef.current?.getTracks().forEach((t) => t.stop());
    enrollStreamRef.current = null;
    setEnrollCamOn(false);
  }, []);

  useEffect(() => {
    if (tab !== 'examiners') stopEnrollCam();
    return () => stopEnrollCam();
  }, [tab, stopEnrollCam]);

  const captureShot = (pose: 'front' | 'left' | 'right') => {
    const v = enrollVideoRef.current;
    if (!v || v.readyState < 2 || !v.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = Math.round((v.videoHeight / v.videoWidth) * 480) || 360;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    setEnrollShots((prev) => ({ ...prev, [pose]: canvas.toDataURL('image/jpeg', 0.75) }));
  };

  const submitEnroll = async () => {
    setEnrollMsg('');
    const { front, left, right } = enrollShots;
    if (!enrollName.trim()) {
      setEnrollMsg('Nama penguji wajib.');
      return;
    }
    if (!front || !left || !right) {
      setEnrollMsg('Ambil ketiga sudut dulu: depan, kiri, kanan.');
      return;
    }
    setEnrollBusy(true);
    const r = await fetch(`${API}/examiners`, {
      ...opt,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: enrollName.trim(), images: [front, left, right] }),
    });
    const d = await r.json().catch(() => ({}));
    setEnrollBusy(false);
    if (r.ok && d.ok) {
      setEnrollMsg(`Wajah "${enrollName}" terdaftar (${d.count ?? 3} sudut).`);
      setEnrollName('');
      setEnrollShots({});
      stopEnrollCam();
      loadExaminers();
    } else if (d.reason === 'pose_incomplete') {
      const map: Record<string, string> = { front: 'depan', left: 'kiri', right: 'kanan' };
      const miss = (d.missing ?? []).map((k: string) => map[k] ?? k).join(', ');
      setEnrollMsg(
        miss
          ? `Sudut belum terdeteksi: ${miss}. Menoleh lebih jelas & wajah harus sendiri di frame.`
          : 'Pose belum lengkap — pastikan depan, kiri, dan kanan jelas.',
      );
    } else {
      setEnrollMsg(
        d.reason === 'service_unavailable'
          ? 'Service GPU tidak aktif.'
          : d.reason === 'need_3_angles'
            ? 'Butuh 3 sudut (depan/kiri/kanan).'
            : 'Gagal mendaftar. Coba ulangi pengambilan.',
      );
    }
  };

  const removeExaminer = async (name: string) => {
    await fetch(`${API}/examiners/${encodeURIComponent(name)}`, {
      ...opt,
      method: 'DELETE',
    }).catch(() => undefined);
    loadExaminers();
  };

  const openCourseDetail = async (id: string) => {
    const r = await fetch(`${API}/courses/${id}`, opt);
    if (r.ok) setOpenCourse(await r.json());
    loadMaterials(id);
    loadExams(id);
  };

  const loadExams = async (courseId: string) => {
    const r = await fetch(`${API}/exams?courseId=${courseId}`, opt);
    if (r.ok) setExams(await r.json());
    else setExams([]);
  };

  const toLocalInput = (iso: string) => {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const newExam = (courseId: string) => {
    setExamMsg('');
    setExam({
      id: null,
      courseId,
      title: '',
      description: '',
      durationMin: 90,
      startAt: '',
      endAt: '',
      published: false,
      problemIds: [],
    });
  };

  const editExam = async (id: string, courseId: string) => {
    setExamMsg('');
    const r = await fetch(`${API}/exams/${id}`, opt);
    if (!r.ok) {
      setExamMsg('Gagal memuat ujian.');
      return;
    }
    const d = await r.json();
    setExam({
      id: d.id,
      courseId: d.courseId ?? courseId,
      title: d.title ?? '',
      description: d.description ?? '',
      durationMin: d.durationMin ?? 90,
      startAt: d.startAt ? toLocalInput(d.startAt) : '',
      endAt: d.endAt ? toLocalInput(d.endAt) : '',
      published: !!d.published,
      problemIds: (d.problems ?? []).map((p: { problemId: string }) => p.problemId),
    });
  };

  const toggleExamProblem = (pid: string) => {
    if (!exam) return;
    const has = exam.problemIds.includes(pid);
    setExam({
      ...exam,
      problemIds: has
        ? exam.problemIds.filter((x) => x !== pid)
        : [...exam.problemIds, pid],
    });
  };

  const saveExam = async () => {
    if (!exam) return;
    if (!exam.title.trim()) {
      setExamMsg('Judul wajib.');
      return;
    }
    if (!exam.startAt || !exam.endAt) {
      setExamMsg('Jadwal mulai & selesai wajib.');
      return;
    }
    if (Number(exam.durationMin) <= 0) {
      setExamMsg('Durasi harus > 0.');
      return;
    }
    setExamBusy(true);
    setExamMsg('');
    const payload = {
      courseId: exam.courseId,
      title: exam.title.trim(),
      description: exam.description,
      durationMin: Number(exam.durationMin),
      startAt: new Date(exam.startAt).toISOString(),
      endAt: new Date(exam.endAt).toISOString(),
      published: exam.published,
      problemIds: exam.problemIds,
    };
    const url = exam.id ? `${API}/exams/${exam.id}` : `${API}/exams`;
    const method = exam.id ? 'PUT' : 'POST';
    const r = await fetch(url, {
      ...opt,
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setExamBusy(false);
    if (r.ok) {
      setExam(null);
      loadExams(exam.courseId);
    } else {
      const d = await r.json().catch(() => ({}));
      setExamMsg(d.message || 'Gagal menyimpan ujian.');
    }
  };

  const deleteExam = async (id: string, courseId: string) => {
    if (!confirm('Hapus paket ujian ini?')) return;
    await fetch(`${API}/exams/${id}`, { ...opt, method: 'DELETE' }).catch(() => undefined);
    loadExams(courseId);
  };

  const openGen = () => {
    setGenMsg('');
    setGenDrafts([]);
    setGenMaterialIds([]);
    setGenCount(2);
    setGenLang('python');
    setGenDiff('sedang');
    setShowGen(true);
  };

  const toggleGenMaterial = (id: string) => {
    setGenMaterialIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const generateSoal = async () => {
    if (!openCourse) return;
    if (!genMaterialIds.length) {
      setGenMsg('Pilih minimal 1 materi.');
      return;
    }
    setGenBusy(true);
    setGenMsg('');
    setGenDrafts([]);
    try {
      const r = await fetch(`${API}/courses/${openCourse.id}/generate-soal`, {
        ...opt,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          materialIds: genMaterialIds,
          count: genCount,
          language: genLang,
          difficulty: genDiff,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setGenMsg(d.message || 'Gagal generate.');
      } else {
        const drafts: SoalForm[] = (d.drafts ?? []).map(
          (s: {
            title: string;
            description: string;
            language: string;
            difficulty: string;
            starterCode: string;
            testCases: CaseForm[];
          }) => ({
            id: null,
            courseId: openCourse.id,
            title: s.title,
            language: s.language,
            difficulty: s.difficulty,
            description: s.description,
            starterCode: s.starterCode,
            setupSql: '',
            testCases: s.testCases.map((t) => ({
              stdin: t.stdin ?? '',
              expected: t.expected ?? '',
              points: Number(t.points) || 10,
              hidden: !!t.hidden,
            })),
          }),
        );
        setGenDrafts(drafts);
        if (!drafts.length) setGenMsg('Tidak ada soal dihasilkan. Coba lagi.');
      }
    } finally {
      setGenBusy(false);
    }
  };

  const reviewDraft = (draft: SoalForm) => {
    setShowGen(false);
    setSoalMsg('');
    setSoal(draft);
  };

  const loadMaterials = async (courseId: string) => {
    setMatMsg('');
    const r = await fetch(`${API}/courses/${courseId}/materials`, opt);
    if (r.ok) setMaterials(await r.json());
    else setMaterials([]);
  };

  const uploadMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!openCourse) return;
    const form = e.currentTarget as HTMLFormElement;
    const fileInput = form.elements.namedItem('file') as HTMLInputElement;
    const titleInput = form.elements.namedItem('title') as HTMLInputElement;
    const file = fileInput?.files?.[0];
    if (!file) {
      setMatMsg('Pilih file dulu.');
      return;
    }
    setMatBusy(true);
    setMatMsg('');
    const fd = new FormData();
    fd.append('file', file);
    if (titleInput?.value.trim()) fd.append('title', titleInput.value.trim());
    const r = await fetch(`${API}/courses/${openCourse.id}/materials`, {
      ...opt,
      method: 'POST',
      body: fd,
    });
    setMatBusy(false);
    if (r.ok) {
      form.reset();
      setMatMsg('Materi diunggah.');
      loadMaterials(openCourse.id);
    } else {
      const d = await r.json().catch(() => ({}));
      setMatMsg(d.message || 'Gagal mengunggah.');
    }
  };

  const downloadMaterial = async (m: Material) => {
    const r = await fetch(`${API}/materials/${m.id}/download`, opt);
    if (!r.ok) {
      setMatMsg('Gagal mengunduh.');
      return;
    }
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = m.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const deleteMaterial = async (id: string) => {
    if (!openCourse) return;
    if (!confirm('Hapus materi ini?')) return;
    await fetch(`${API}/materials/${id}`, { ...opt, method: 'DELETE' }).catch(() => undefined);
    loadMaterials(openCourse.id);
  };

  const emptyCase = (): CaseForm => ({ stdin: '', expected: '', points: 1, hidden: true });

  const newSoal = (courseId: string) => {
    setSoalMsg('');
    setSoal({
      id: null,
      courseId,
      title: '',
      language: 'python',
      difficulty: 'mudah',
      description: '',
      starterCode: '',
      setupSql: '',
      testCases: [{ stdin: '', expected: '', points: 1, hidden: false }],
    });
  };

  const editSoal = async (id: string, courseId: string) => {
    setSoalMsg('');
    const r = await fetch(`${API}/problems/${id}/full`, opt);
    if (!r.ok) {
      setSoalMsg('Gagal memuat soal.');
      return;
    }
    const d = await r.json();
    setSoal({
      id: d.id,
      courseId: d.courseId ?? courseId,
      title: d.title ?? '',
      language: d.language ?? 'python',
      difficulty: d.difficulty ?? 'mudah',
      description: d.description ?? '',
      starterCode: d.starterCode ?? '',
      setupSql: d.setupSql ?? '',
      testCases: (d.testCases ?? []).map((t: CaseForm) => ({
        stdin: t.stdin ?? '',
        expected: t.expected ?? '',
        points: Number(t.points) || 1,
        hidden: !!t.hidden,
      })),
    });
  };

  const saveSoal = async () => {
    if (!soal) return;
    if (!soal.title.trim()) {
      setSoalMsg('Judul wajib.');
      return;
    }
    if (!soal.testCases.length) {
      setSoalMsg('Minimal 1 test case.');
      return;
    }
    setSoalBusy(true);
    setSoalMsg('');
    const payload = {
      title: soal.title.trim(),
      language: soal.language,
      difficulty: soal.difficulty,
      description: soal.description,
      starterCode: soal.starterCode,
      setupSql: soal.language === 'sql' ? soal.setupSql : '',
      courseId: soal.courseId,
      testCases: soal.testCases.map((t, i) => ({
        stdin: t.stdin,
        expected: t.expected,
        points: Number(t.points) || 1,
        hidden: t.hidden,
        order: i + 1,
      })),
    };
    const url = soal.id ? `${API}/problems/${soal.id}` : `${API}/problems`;
    const method = soal.id ? 'PUT' : 'POST';
    const r = await fetch(url, {
      ...opt,
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setSoalBusy(false);
    if (r.ok) {
      setSoal(null);
      loadCourses();
      openCourseDetail(soal.courseId);
      fetch(`${API}/problems`, opt).then((res) => res.json()).then(setProblems).catch(() => undefined);
    } else {
      const d = await r.json().catch(() => ({}));
      setSoalMsg(d.message || 'Gagal menyimpan soal.');
    }
  };

  const deleteSoal = async (id: string, courseId: string) => {
    if (!confirm('Hapus soal ini?')) return;
    await fetch(`${API}/problems/${id}`, { ...opt, method: 'DELETE' }).catch(() => undefined);
    loadCourses();
    openCourseDetail(courseId);
    fetch(`${API}/problems`, opt).then((res) => res.json()).then(setProblems).catch(() => undefined);
  };

  const createCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setCourseMsg('');
    if (!ncName.trim()) {
      setCourseMsg('Nama MK wajib.');
      return;
    }
    const r = await fetch(`${API}/courses`, {
      ...opt,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: ncName.trim(), semester: ncSem ? Number(ncSem) : undefined }),
    });
    if (r.ok) {
      setNcName('');
      setNcSem('');
      setCourseMsg('MK ditambahkan.');
      loadCourses();
    } else {
      setCourseMsg('Gagal menambah MK.');
    }
  };

  const syncNow = async () => {
    setImpMsg('');
    setImpBusy(true);
    try {
      await fetch(`${API}/courses/sync-now`, { ...opt, method: 'POST' }).catch(() => undefined);
      loadCourses();
    } finally {
      setImpBusy(false);
    }
  };

  const importSicekcok = async () => {
    setImpMsg('');
    if (!impPeriode.trim()) {
      setImpMsg('Periode wajib (mis. 20251).');
      return;
    }
    setImpBusy(true);
    try {
      const r = await fetch(`${API}/courses/import-sicekcok`, {
        ...opt,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periode: impPeriode.trim(), kodeProdi: impProdi.trim() || undefined }),
      });
      const d = await r.json().catch(() => ({}));
      if (d.ok) {
        setImpMsg(`Berhasil: ${d.imported} MK diimpor, ${d.skipped} dilewati (total ${d.total}).`);
        loadCourses();
      } else if (d.reason === 'not_configured') {
        setImpMsg('Integrasi SICEKCOK belum dikonfigurasi (isi kredensial di api/.env).');
      } else if (d.reason === 'unreachable') {
        setImpMsg('Server SICEKCOK tak bisa dihubungi.');
      } else if (d.reason === 'api_error') {
        setImpMsg(`Ditolak API: ${d.message || 'error'}. Minta KAPRODI aktifkan akses "jadwal" untuk key ini.`);
      } else {
        setImpMsg(d.message || 'Gagal mengimpor.');
      }
    } finally {
      setImpBusy(false);
    }
  };

  const logout = async () => {
    await fetch(`${API}/auth/logout`, { ...opt, method: 'POST' }).catch(() => undefined);
    router.replace('/welcome');
  };

  if (me === undefined) {
    return <div className="flex min-h-screen items-center justify-center bg-[#0d1117] text-slate-500">Memeriksa akses…</div>;
  }
  if (!me) return null;

  // Monitoring Live HANYA yang sedang ujian; sisanya (kicked/selesai/terputus) masuk Arsip.
  const liveAttempts = attempts.filter((a) => a.live && a.status === 'active');
  const archivedAttempts = attempts.filter((a) => !(a.live && a.status === 'active'));
  const liveCount = liveAttempts.length;
  const monitorRows = tab === 'arsip' ? archivedAttempts : liveAttempts;
  const simColor = (v: number) => (v >= 90 ? 'text-rose-400' : v >= 75 ? 'text-amber-400' : 'text-slate-300');
  const tabs: [Tab, string][] = [
    ['monitor', 'Monitoring Live'],
    ['arsip', 'Arsip Attempt'],
    ['subs', 'Submission & Nilai'],
    ['sim', 'Kemiripan Kode'],
    ['courses', 'Mata Kuliah'],
    ['examiners', 'Wajah Penguji'],
  ];
  if (me.role === 'superadmin') tabs.push(['users', 'Kelola Akun']);

  return (
    <div className="term term-dash min-h-screen bg-[#0a0f0d] text-slate-200">
      <header className="dash-header">
        <div className="dash-winbar">
          <span className="term-dot" style={{ background: '#ff5f56' }} />
          <span className="term-dot" style={{ background: '#ffbd2e' }} />
          <span className="term-dot" style={{ background: '#27c93f' }} />
          <span className="dash-winpath">
            dashboard@codeunical: <span className="text-emerald-400/80">~/{tab}</span>
          </span>
          <span className="dash-clock">
            <Clock />
          </span>
        </div>

        <div className="dash-idrow">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-emblem.png" alt="" className="dash-logo" />
            <div>
              <h1 className="dash-title">
                <span className="text-emerald-400">~/dashboard</span>
                <span className="term-caret">▋</span>
                <span className="text-slate-600">—</span>
                <span>UNISMUH CodeUnical</span>
              </h1>
              <span className="dash-chip">
                {me.code && <span className="code">{me.code}</span>}
                <span>{me.name}</span>
                <span className="text-slate-600">·</span>
                <span className="role">{me.role}</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className={`dash-live ${liveCount > 0 ? 'on' : ''}`}>
              <span className="dot" /> <b>{liveCount}</b> live
            </span>
            <button onClick={logout} className="dash-logout">
              $ logout
            </button>
          </div>
        </div>
      </header>

      <nav className="dash-tabs">
        {tabs.map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`dash-tab ${tab === k ? 'dash-tab-active' : ''}`}
          >
            {TAB_ICON[k]}
            <span>{label}</span>
            {k === 'monitor' && (
              <span className={`dash-badge ${liveCount === 0 ? 'zero' : ''}`}>{liveCount}</span>
            )}
          </button>
        ))}
      </nav>

      <main className="p-6">
        {(tab === 'monitor' || tab === 'arsip') && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <label className="text-slate-500">Filter ujian:</label>
              <select
                value={examFilter}
                onChange={(e) => setExamFilter(e.target.value)}
                className="rounded border border-slate-700 bg-[#0b0e14] px-2 py-1 text-slate-200"
              >
                <option value="">Semua ujian</option>
                {examOptions.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.title} ({e.count})
                  </option>
                ))}
              </select>
              {examFilter && (
                <button
                  onClick={() => setExamFilter('')}
                  className="text-xs text-slate-500 hover:text-slate-300"
                >
                  ✕ reset
                </button>
              )}
            </div>
            <div className="overflow-hidden rounded-lg border border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#0b0e14] font-mono text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-2">Peserta</th>
                  <th className="px-4 py-2">Ujian</th>
                  <th className="px-4 py-2">Mulai</th>
                  <th className="px-4 py-2">Attempt</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Strike</th>
                  <th className="px-4 py-2">Pelanggaran</th>
                  <th className="px-4 py-2">Ketikan</th>
                  <th className="px-4 py-2">Live</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {monitorRows.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-6 text-center text-slate-600">
                      {tab === 'arsip' ? 'Belum ada arsip attempt.' : 'Belum ada peserta yang sedang ujian.'}
                    </td>
                  </tr>
                )}
                {monitorRows.map((a) => (
                  <tr key={a.id} className="border-t border-slate-800 font-mono">
                    <td className="px-4 py-2">
                      {a.peserta ? (
                        <span>
                          <span className="text-slate-200">{a.peserta.name}</span>
                          {a.peserta.code && (
                            <span className="ml-1 text-[10px] text-slate-500">{a.peserta.code}</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-600">Anonim</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-slate-300">{a.examTitle ?? <span className="text-slate-600">—</span>}</td>
                    <td className="px-4 py-2 text-slate-500">
                      {new Date(a.startedAt).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="px-4 py-2 text-slate-400">{a.id.slice(-6)}</td>
                    <td className="px-4 py-2">
                      <span className={a.status === 'kicked' ? 'text-rose-400' : a.status === 'active' ? 'text-emerald-400' : 'text-slate-400'}>
                        {a.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-rose-400">{a.strikes}/3</td>
                    <td className="px-4 py-2 text-amber-400">{a.events}</td>
                    <td className="px-4 py-2 text-slate-400">{a.keystrokes}</td>
                    <td className="px-4 py-2">{a.live ? <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" /> : <span className="text-slate-700">·</span>}</td>
                    <td className="px-4 py-2">
                      <button onClick={() => setReplayId(a.id)} className="rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800">
                        🎬 Replay
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}

        {tab === 'subs' && (
          <div className="overflow-hidden rounded-lg border border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#0b0e14] font-mono text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-2">Peserta</th>
                  <th className="px-4 py-2">Submission</th>
                  <th className="px-4 py-2">Lolos</th>
                  <th className="px-4 py-2">Skor</th>
                  <th className="px-4 py-2">Waktu</th>
                </tr>
              </thead>
              <tbody>
                {subs.map((s) => (
                  <tr key={s.id} className="border-t border-slate-800 font-mono">
                    <td className="px-4 py-2">
                      {s.peserta ? (
                        <span>
                          <span className="text-slate-200">{s.peserta.name}</span>
                          {s.peserta.code && (
                            <span className="ml-1 text-[10px] text-slate-500">{s.peserta.code}</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-600">Anonim</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-slate-400">{s.id.slice(-6)}</td>
                    <td className={`px-4 py-2 ${s.passed === s.total ? 'text-emerald-400' : 'text-amber-400'}`}>{s.passed}/{s.total}</td>
                    <td className="px-4 py-2 text-slate-300">{s.score}/{s.maxScore}</td>
                    <td className="px-4 py-2 text-slate-500">{new Date(s.createdAt).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'medium' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'sim' && (
          <div>
            <select value={simProblem} onChange={(e) => loadSim(e.target.value)} className="mb-4 rounded border border-slate-700 bg-[#0b0e14] px-3 py-2 text-sm">
              <option value="">— pilih soal —</option>
              {problems.map((p) => (
                <option key={p.id} value={p.id}>{p.title} ({p.difficulty})</option>
              ))}
            </select>
            {sim && (
              <div className="rounded-lg border border-slate-800 p-4">
                <p className="mb-3 text-sm text-slate-400">
                  {sim.total} submission
                  {sim.exam && (
                    <>
                      {' '}· ujian: <span className="text-slate-200">{sim.exam}</span>
                    </>
                  )}{' '}
                  · {sim.pairs.length} pasangan mirip (≥60%)
                </p>
                {sim.pairs.length === 0 ? (
                  <p className="text-slate-600">Tak ada kemiripan mencurigakan.</p>
                ) : (
                  <div className="space-y-1.5 font-mono text-sm">
                    {sim.pairs.map((p, i) => (
                      <div key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className={`w-12 shrink-0 font-bold ${simColor(p.similarity)}`}>{p.similarity}%</span>
                        <span className="flex items-center gap-2">
                          <SimName p={p.a} /> <span className="text-slate-600">↔</span> <SimName p={p.b} />
                        </span>
                        {p.similarity >= 90 && <span className="text-rose-500">⚠ nyaris identik</span>}
                        <button
                          onClick={() => setSimPair({ a: p.a, b: p.b })}
                          className="ml-auto shrink-0 rounded border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300 hover:bg-slate-800"
                        >
                          🔍 detail
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {tab === 'users' && me.role === 'superadmin' && (
          <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
            <div className="space-y-6">
            <form onSubmit={createPenguji} className="space-y-3 rounded-lg border border-slate-800 p-4">
              <h3 className="font-semibold text-white">Tambah Akun</h3>
              <p className="text-xs text-slate-500">
                Hanya super admin yang boleh membuat akun (tanpa self-register). Untuk mahasiswa, pakai email NIM
                (mis. <span className="text-slate-400">105841103223@student.unismuh.ac.id</span>) → ID otomatis CU&lt;NIM&gt;.
                Saat ini peserta <b className="text-slate-400">khusus prodi Informatika</b> (NIM diawali 10584); prodi lain menyusul.
              </p>
              <select
                value={pForm.role}
                onChange={(e) => setPForm({ ...pForm, role: e.target.value })}
                className="w-full rounded border border-slate-700 bg-[#0b0e14] px-3 py-2 text-sm text-slate-100"
              >
                <option value="penguji">Penguji (Dosen/Staff)</option>
                <option value="peserta">Peserta (Mahasiswa)</option>
              </select>
              <input placeholder="Email" value={pForm.email} onChange={(e) => setPForm({ ...pForm, email: e.target.value })} className="w-full rounded border border-slate-700 bg-[#0b0e14] px-3 py-2 text-sm" />
              <input placeholder="Nama" value={pForm.name} onChange={(e) => setPForm({ ...pForm, name: e.target.value })} className="w-full rounded border border-slate-700 bg-[#0b0e14] px-3 py-2 text-sm" />
              <input placeholder="Sandi (min 8)" value={pForm.password} onChange={(e) => setPForm({ ...pForm, password: e.target.value })} className="w-full rounded border border-slate-700 bg-[#0b0e14] px-3 py-2 text-sm" />
              {pMsg && <p className="text-xs text-emerald-400">{pMsg}</p>}
              <button type="submit" className="w-full rounded bg-violet-600 px-4 py-2 text-sm text-white hover:bg-violet-500">Buat Akun</button>
            </form>

            <div className="rounded-lg border border-slate-800 p-4">
              <div className="mb-1 flex items-center justify-between">
                <h3 className="font-semibold text-white">Prodi Diizinkan</h3>
                <span className={`rounded px-2 py-0.5 text-[10px] ${prodiInfo?.synced ? 'bg-emerald-950 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>
                  {prodiInfo?.synced ? 'dari SICEKCOK' : 'label bawaan'}
                </span>
              </div>
              <p className="mb-3 text-xs text-slate-500">Aktifkan prodi yang boleh mendaftar sebagai peserta. Perubahan tersimpan otomatis.</p>
              <ul className="space-y-1">
                {(prodiInfo?.prodi ?? []).map((p) => (
                  <li key={p.code} className="flex items-center justify-between rounded border border-slate-800 px-2 py-1.5 text-sm">
                    <span className="min-w-0 truncate">
                      <span className="text-slate-200">{p.name}</span>
                      <span className="ml-1 font-mono text-[10px] text-slate-500">({p.code})</span>
                    </span>
                    <button
                      onClick={() => toggleProdi(p.code, !p.allowed)}
                      className={`shrink-0 rounded px-2 py-0.5 text-[11px] ${
                        p.allowed
                          ? 'bg-emerald-700 text-white hover:bg-emerald-600'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      {p.allowed ? 'Aktif' : 'Nonaktif'}
                    </button>
                  </li>
                ))}
                {(prodiInfo?.prodi ?? []).length === 0 && (
                  <li className="text-xs text-slate-600">Belum ada data prodi.</li>
                )}
              </ul>
              {prodiInfo && !prodiInfo.synced && prodiInfo.lastError && (
                <p className="mt-2 text-[10px] text-slate-600">SICEKCOK: {prodiInfo.lastError} — pakai label bawaan sampai key aktif.</p>
              )}
            </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#0b0e14] font-mono text-xs text-slate-500">
                  <tr>
                    <th className="px-4 py-2">ID</th>
                    <th className="px-4 py-2">Nama</th>
                    <th className="px-4 py-2">Email</th>
                    <th className="px-4 py-2">Peran</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-t border-slate-800">
                      <td className="px-4 py-2 font-mono text-slate-300">{u.code ?? '—'}</td>
                      <td className="px-4 py-2">{u.name}</td>
                      <td className="px-4 py-2 font-mono text-slate-400">{u.email}</td>
                      <td className="px-4 py-2 text-violet-400">{u.role}</td>
                      <td className="px-4 py-2">
                        <span
                          className={
                            u.status === 'active'
                              ? 'text-emerald-400'
                              : u.status === 'suspended'
                                ? 'text-rose-400'
                                : 'text-amber-400'
                          }
                        >
                          {u.status}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        {u.role === 'superadmin' ? (
                          <span className="text-xs text-slate-600">—</span>
                        ) : u.status === 'active' ? (
                          <button
                            onClick={() => setUserStatus(u.id, 'suspended')}
                            className="rounded border border-slate-700 px-2 py-1 text-xs text-rose-400 hover:bg-slate-800"
                          >
                            Suspend
                          </button>
                        ) : (
                          <button
                            onClick={() => setUserStatus(u.id, 'active')}
                            className="rounded border border-slate-700 px-2 py-1 text-xs text-emerald-400 hover:bg-slate-800"
                          >
                            ACC (Aktifkan)
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'courses' && (
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <div className="space-y-5">
              {[1, 2, 3, 4, 5, 6, 7, 8, null].map((sem) => {
                const list = courses.filter((c) => c.semester === sem);
                if (!list.length) return null;
                return (
                  <div key={String(sem)}>
                    <h3 className="mb-2 font-mono text-xs text-slate-500">
                      {sem ? `SEMESTER ${sem}` : 'TAMBAHAN DOSEN'}
                    </h3>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {list.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => openCourseDetail(c.id)}
                          className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition ${
                            openCourse?.id === c.id
                              ? 'border-violet-500 bg-violet-950/30'
                              : 'border-slate-800 bg-[#0b0e14] hover:border-violet-600'
                          }`}
                        >
                          <span className="text-slate-200">{c.name}</span>
                          <span className="ml-2 shrink-0 rounded bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-400">
                            {c._count.problems} soal
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <aside className="space-y-5">
              <div className="overflow-hidden rounded-lg border border-slate-800 bg-[#0b0e14]">
                <button
                  type="button"
                  onClick={() => setShowAddCourse((v) => !v)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-white transition hover:bg-white/5"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-emerald-400">+</span> Tambah Mata Kuliah
                  </span>
                  <span className={`text-slate-500 transition-transform ${showAddCourse ? 'rotate-90' : ''}`}>
                    ▸
                  </span>
                </button>
                {showAddCourse && (
                  <form onSubmit={createCourse} className="border-t border-slate-800 p-4">
                    <input
                      value={ncName}
                      onChange={(e) => setNcName(e.target.value)}
                      placeholder="Nama MK"
                      className="mb-2 w-full rounded border border-slate-700 bg-[#0d1117] px-3 py-2 text-sm outline-none focus:border-violet-500"
                    />
                    <input
                      value={ncSem}
                      onChange={(e) => setNcSem(e.target.value)}
                      type="number"
                      min={1}
                      max={8}
                      placeholder="Semester (opsional)"
                      className="mb-2 w-full rounded border border-slate-700 bg-[#0d1117] px-3 py-2 text-sm outline-none focus:border-violet-500"
                    />
                    {courseMsg && <p className="mb-2 text-sm text-amber-400">{courseMsg}</p>}
                    <button type="submit" className="w-full rounded bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500">
                      Tambah
                    </button>
                  </form>
                )}
              </div>

              <div className="rounded-lg border border-slate-800 bg-[#0b0e14] p-4">
                <div className="mb-1 flex items-center justify-between">
                  <h3 className="font-semibold text-white">Sinkronisasi Otomatis</h3>
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] ${
                      syncStatus?.configured && syncStatus?.enabled
                        ? 'bg-emerald-950 text-emerald-300'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {syncStatus?.configured && syncStatus?.enabled ? 'aktif' : 'nonaktif'}
                  </span>
                </div>
                <p className="mb-2 text-xs text-slate-500">
                  MK ditarik otomatis dari SICEKCOK (saat start &amp; tiap 12 jam). Tak perlu aksi manual.
                </p>
                {syncStatus?.last ? (
                  <p className={`mb-2 text-xs ${syncStatus.last.ok ? 'text-emerald-400' : 'text-amber-400'}`}>
                    Terakhir {new Date(syncStatus.last.at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })} ·{' '}
                    {syncStatus.last.ok
                      ? `${syncStatus.last.imported} MK baru, ${syncStatus.last.skipped} dilewati (periode ${syncStatus.last.periode})`
                      : `belum aktif (${syncStatus.last.message || syncStatus.last.reason})`}
                  </p>
                ) : (
                  <p className="mb-2 text-xs text-slate-600">Belum ada sinkronisasi.</p>
                )}
                <button
                  onClick={syncNow}
                  disabled={impBusy}
                  className="w-full rounded bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
                >
                  {impBusy ? 'Menyinkron…' : 'Sync Sekarang'}
                </button>
              </div>

              <div className="overflow-hidden rounded-lg border border-slate-800 bg-[#0b0e14]">
                <button
                  type="button"
                  onClick={() => setShowImport((v) => !v)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-white transition hover:bg-white/5"
                >
                  <span className="flex items-center gap-2">
                    Impor Manual <span className="text-[10px] font-normal text-slate-500">(cadangan)</span>
                  </span>
                  <span className={`text-slate-500 transition-transform ${showImport ? 'rotate-90' : ''}`}>
                    ▸
                  </span>
                </button>
                {showImport && (
                  <div className="border-t border-slate-800 p-4">
                    <p className="mb-3 text-xs text-slate-500">
                      Nanti mata kuliah <b className="text-slate-400">otomatis</b> tersinkron dari SICEKCOK.
                      Impor manual ini hanya cadangan bila di SICEKCOK belum ada/belum lengkap.
                    </p>
                    <input
                      value={impPeriode}
                      onChange={(e) => setImpPeriode(e.target.value)}
                      placeholder="Periode (mis. 20251)"
                      className="mb-2 w-full rounded border border-slate-700 bg-[#0d1117] px-3 py-2 text-sm outline-none focus:border-violet-500"
                    />
                    <input
                      value={impProdi}
                      onChange={(e) => setImpProdi(e.target.value)}
                      placeholder="Kode Prodi (opsional)"
                      className="mb-2 w-full rounded border border-slate-700 bg-[#0d1117] px-3 py-2 text-sm outline-none focus:border-violet-500"
                    />
                    {impMsg && <p className="mb-2 text-sm text-amber-400">{impMsg}</p>}
                    <button
                      onClick={importSicekcok}
                      disabled={impBusy}
                      className="w-full rounded border border-violet-600 px-4 py-2 text-sm font-medium text-violet-300 hover:bg-violet-950/40 disabled:opacity-50"
                    >
                      {impBusy ? 'Mengimpor…' : 'Impor Mata Kuliah'}
                    </button>
                  </div>
                )}
              </div>
              {openCourse && (
                <div className="rounded-lg border border-slate-800 bg-[#0b0e14] p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="font-semibold text-white">{openCourse.name}</h3>
                    <button onClick={() => setOpenCourse(null)} className="text-xs text-slate-500 hover:text-slate-300">
                      tutup
                    </button>
                  </div>
                  <p className="mb-3 font-mono text-[11px] text-slate-500">{openCourse.problems.length} soal</p>
                  <div className="mb-3 flex gap-2">
                    <button
                      onClick={() => newSoal(openCourse.id)}
                      className="flex-1 rounded bg-violet-600 px-3 py-2 text-xs font-medium text-white hover:bg-violet-500"
                    >
                      + Buat Soal
                    </button>
                    <button
                      onClick={openGen}
                      className="flex-1 rounded border border-violet-600 px-3 py-2 text-xs font-medium text-violet-300 hover:bg-violet-950/40"
                    >
                      ✨ Generate AI
                    </button>
                  </div>
                  <ul className="space-y-1">
                    {openCourse.problems.map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-2 rounded border border-slate-800 px-2 py-1 text-xs">
                        <span className="min-w-0 flex-1 truncate text-slate-300">{p.title}</span>
                        <span className="shrink-0 font-mono text-slate-500">{p.language}</span>
                        <button
                          onClick={() => editSoal(p.id, openCourse.id)}
                          className="shrink-0 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-slate-700"
                        >
                          edit
                        </button>
                        <button
                          onClick={() => deleteSoal(p.id, openCourse.id)}
                          className="shrink-0 rounded bg-rose-950 px-1.5 py-0.5 text-[10px] text-rose-300 hover:bg-rose-900"
                        >
                          hapus
                        </button>
                      </li>
                    ))}
                    {openCourse.problems.length === 0 && (
                      <li className="text-xs text-slate-600">Belum ada soal. Klik &ldquo;+ Buat Soal&rdquo;.</li>
                    )}
                  </ul>

                  <div className="mt-4 border-t border-slate-800 pt-3">
                    <h4 className="mb-2 text-sm font-medium text-white">Materi ({materials.length})</h4>
                    <form onSubmit={uploadMaterial} className="mb-3 space-y-2">
                      <input
                        name="title"
                        placeholder="Judul materi (opsional)"
                        className="w-full rounded border border-slate-700 bg-[#0d1117] px-2 py-1 text-xs text-slate-100 outline-none focus:border-violet-500"
                      />
                      <input
                        name="file"
                        type="file"
                        accept=".pdf,.ppt,.pptx,.doc,.docx,.txt,.md"
                        className="block w-full text-xs text-slate-400 file:mr-2 file:rounded file:border-0 file:bg-slate-800 file:px-2 file:py-1 file:text-slate-200"
                      />
                      {matMsg && <p className="text-xs text-amber-400">{matMsg}</p>}
                      <button
                        type="submit"
                        disabled={matBusy}
                        className="w-full rounded bg-slate-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-600 disabled:opacity-50"
                      >
                        {matBusy ? 'Mengunggah…' : 'Unggah Materi'}
                      </button>
                    </form>
                    <ul className="space-y-1">
                      {materials.map((m) => (
                        <li key={m.id} className="flex items-center justify-between gap-2 rounded border border-slate-800 px-2 py-1 text-xs">
                          <button
                            onClick={() => downloadMaterial(m)}
                            className="min-w-0 flex-1 truncate text-left text-violet-300 hover:underline"
                            title={m.filename}
                          >
                            {m.title}
                          </button>
                          <span className="shrink-0 font-mono text-[10px] text-slate-500">
                            {(m.size / 1024).toFixed(0)}KB
                          </span>
                          <button
                            onClick={() => deleteMaterial(m.id)}
                            className="shrink-0 rounded bg-rose-950 px-1.5 py-0.5 text-[10px] text-rose-300 hover:bg-rose-900"
                          >
                            hapus
                          </button>
                        </li>
                      ))}
                      {materials.length === 0 && (
                        <li className="text-xs text-slate-600">Belum ada materi.</li>
                      )}
                    </ul>
                  </div>

                  <div className="mt-4 border-t border-slate-800 pt-3">
                    <div className="mb-2 flex items-center justify-between">
                      <h4 className="text-sm font-medium text-white">Ujian ({exams.length})</h4>
                      <button
                        onClick={() => newExam(openCourse.id)}
                        className="rounded bg-violet-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-violet-500"
                      >
                        + Buat Ujian
                      </button>
                    </div>
                    <ul className="space-y-1">
                      {exams.map((ex) => (
                        <li key={ex.id} className="rounded border border-slate-800 px-2 py-1.5 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="min-w-0 flex-1 truncate text-slate-200">{ex.title}</span>
                            {ex.published ? (
                              <span className="shrink-0 rounded bg-emerald-950 px-1.5 py-0.5 text-[10px] text-emerald-300">tayang</span>
                            ) : (
                              <span className="shrink-0 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">draf</span>
                            )}
                            <button
                              onClick={() => editExam(ex.id, openCourse.id)}
                              className="shrink-0 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-slate-700"
                            >
                              edit
                            </button>
                            <button
                              onClick={() => {
                                navigator.clipboard
                                  ?.writeText(`${window.location.origin}/exam?exam=${ex.id}`)
                                  .catch(() => undefined);
                              }}
                              title="Salin link peserta"
                              className="shrink-0 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-violet-300 hover:bg-slate-700"
                            >
                              🔗 link
                            </button>
                            <button
                              onClick={() => deleteExam(ex.id, openCourse.id)}
                              className="shrink-0 rounded bg-rose-950 px-1.5 py-0.5 text-[10px] text-rose-300 hover:bg-rose-900"
                            >
                              hapus
                            </button>
                          </div>
                          <div className="mt-1 font-mono text-[10px] text-slate-500">
                            {ex._count.problems} soal · {ex.durationMin} mnt ·{' '}
                            {new Date(ex.startAt).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                          </div>
                        </li>
                      ))}
                      {exams.length === 0 && (
                        <li className="text-xs text-slate-600">Belum ada ujian.</li>
                      )}
                    </ul>
                  </div>
                </div>
              )}
            </aside>
          </div>
        )}

        {tab === 'examiners' && (
          <div className="max-w-2xl space-y-6">
            <div className="rounded-lg border border-slate-800 bg-[#0b0e14] p-5">
              <h2 className="mb-1 font-semibold text-white">Daftarkan wajah penguji</h2>
              <p className="mb-4 text-xs text-slate-500">
                Perekaman <b className="text-slate-300">live 3 sudut</b> (depan, kiri, kanan) — bukan unggah foto.
                Foto diam ditolak karena tak bisa menoleh. Disimpan sebagai embedding (bukan foto). Butuh service GPU.
              </p>

              <input
                value={enrollName}
                onChange={(e) => setEnrollName(e.target.value)}
                placeholder="Nama penguji"
                className="mb-3 w-full rounded border border-slate-700 bg-[#0d1117] px-3 py-2 text-sm outline-none focus:border-violet-500"
              />

              {!enrollCamOn ? (
                <button
                  onClick={startEnrollCam}
                  className="rounded bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
                >
                  📷 Mulai Kamera
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="overflow-hidden rounded-lg border border-slate-700 bg-black">
                    <video
                      ref={enrollVideoRef}
                      muted
                      playsInline
                      className="h-56 w-full -scale-x-100 object-cover"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      ['front', 'Depan', 'Hadap lurus ke kamera'],
                      ['left', 'Kiri', 'Menoleh ke kiri'],
                      ['right', 'Kanan', 'Menoleh ke kanan'],
                    ] as const).map(([key, label, hint]) => (
                      <div key={key} className="rounded border border-slate-800 p-2 text-center">
                        <div className="mb-1 flex h-20 items-center justify-center overflow-hidden rounded bg-[#0d1117]">
                          {enrollShots[key] ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={enrollShots[key]} alt={label} className="h-full w-full -scale-x-100 object-cover" />
                          ) : (
                            <span className="text-[10px] text-slate-600">belum</span>
                          )}
                        </div>
                        <p className="text-xs font-medium text-slate-200">{label}</p>
                        <p className="mb-1 text-[10px] text-slate-500">{hint}</p>
                        <button
                          onClick={() => captureShot(key)}
                          className={`w-full rounded px-2 py-1 text-[11px] ${
                            enrollShots[key]
                              ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                              : 'bg-violet-600 text-white hover:bg-violet-500'
                          }`}
                        >
                          {enrollShots[key] ? 'Ulangi' : 'Ambil'}
                        </button>
                      </div>
                    ))}
                  </div>
                  {enrollMsg && <p className="text-sm text-amber-400">{enrollMsg}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={submitEnroll}
                      disabled={enrollBusy}
                      className="rounded bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
                    >
                      {enrollBusy ? 'Mendaftar…' : 'Daftarkan'}
                    </button>
                    <button
                      onClick={stopEnrollCam}
                      className="rounded border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
                    >
                      Matikan kamera
                    </button>
                  </div>
                </div>
              )}
              {!enrollCamOn && enrollMsg && <p className="mt-2 text-sm text-amber-400">{enrollMsg}</p>}
            </div>
            {me.role === 'superadmin' ? (
              <div className="rounded-lg border border-slate-800">
                <div className="border-b border-slate-800 px-4 py-2 font-mono text-xs text-slate-500">
                  TERDAFTAR ({examiners.length})
                </div>
                {examiners.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-slate-600">Belum ada wajah penguji terdaftar.</p>
                ) : (
                  <ul className="divide-y divide-slate-800">
                    {examiners.map((n) => (
                      <li key={n} className="flex items-center justify-between px-4 py-2 text-sm">
                        <span className="text-slate-200">🎓 {n}</span>
                        <button onClick={() => removeExaminer(n)} className="rounded border border-slate-700 px-2 py-1 text-xs text-rose-400 hover:bg-slate-800">
                          Hapus
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <p className="rounded-lg border border-slate-800 bg-[#0b0e14] px-4 py-3 text-xs text-slate-500">
                Cukup daftarkan wajahmu <b className="text-slate-300">sekali</b>. Daftar semua penguji hanya bisa dilihat super-admin.
              </p>
            )}
          </div>
        )}
      </main>

      {soal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4">
          <div className="my-4 w-full max-w-3xl rounded-xl border border-slate-700 bg-[#0b0e14] p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">
                {soal.id ? 'Edit Soal' : 'Buat Soal'}
              </h3>
              <button onClick={() => setSoal(null)} className="text-sm text-slate-500 hover:text-slate-300">
                tutup
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="sm:col-span-2 text-xs text-slate-400">
                Judul
                <input
                  value={soal.title}
                  onChange={(e) => setSoal({ ...soal, title: e.target.value })}
                  className="mt-1 w-full rounded border border-slate-700 bg-[#0d1117] px-3 py-2 text-sm text-slate-100 outline-none focus:border-violet-500"
                />
              </label>
              <label className="text-xs text-slate-400">
                Bahasa
                <select
                  value={soal.language}
                  onChange={(e) => setSoal({ ...soal, language: e.target.value })}
                  className="mt-1 w-full rounded border border-slate-700 bg-[#0d1117] px-3 py-2 text-sm text-slate-100 outline-none focus:border-violet-500"
                >
                  {SOAL_LANGS.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-slate-400">
                Kesulitan
                <select
                  value={soal.difficulty}
                  onChange={(e) => setSoal({ ...soal, difficulty: e.target.value })}
                  className="mt-1 w-full rounded border border-slate-700 bg-[#0d1117] px-3 py-2 text-sm text-slate-100 outline-none focus:border-violet-500"
                >
                  <option value="mudah">mudah</option>
                  <option value="sedang">sedang</option>
                  <option value="sulit">sulit</option>
                </select>
              </label>
              <label className="sm:col-span-2 text-xs text-slate-400">
                Deskripsi / Soal
                <textarea
                  value={soal.description}
                  onChange={(e) => setSoal({ ...soal, description: e.target.value })}
                  rows={4}
                  className="mt-1 w-full rounded border border-slate-700 bg-[#0d1117] px-3 py-2 font-mono text-xs text-slate-100 outline-none focus:border-violet-500"
                />
              </label>
              <label className="sm:col-span-2 text-xs text-slate-400">
                Kode awal (starter)
                <textarea
                  value={soal.starterCode}
                  onChange={(e) => setSoal({ ...soal, starterCode: e.target.value })}
                  rows={4}
                  className="mt-1 w-full rounded border border-slate-700 bg-[#0d1117] px-3 py-2 font-mono text-xs text-slate-100 outline-none focus:border-violet-500"
                />
              </label>
              {soal.language === 'sql' && (
                <label className="sm:col-span-2 text-xs text-slate-400">
                  Setup SQL (skema + data awal)
                  <textarea
                    value={soal.setupSql}
                    onChange={(e) => setSoal({ ...soal, setupSql: e.target.value })}
                    rows={4}
                    className="mt-1 w-full rounded border border-slate-700 bg-[#0d1117] px-3 py-2 font-mono text-xs text-slate-100 outline-none focus:border-violet-500"
                  />
                </label>
              )}
            </div>

            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-sm font-medium text-white">Test Case ({soal.testCases.length})</h4>
                <button
                  onClick={() => setSoal({ ...soal, testCases: [...soal.testCases, emptyCase()] })}
                  className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700"
                >
                  + Tambah case
                </button>
              </div>
              <div className="space-y-2">
                {soal.testCases.map((tc, i) => (
                  <div key={i} className="rounded border border-slate-800 bg-[#0d1117] p-2">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-mono text-[10px] text-slate-500">case #{i + 1}</span>
                      <button
                        onClick={() =>
                          setSoal({ ...soal, testCases: soal.testCases.filter((_, k) => k !== i) })
                        }
                        className="rounded bg-rose-950 px-1.5 py-0.5 text-[10px] text-rose-300 hover:bg-rose-900"
                      >
                        hapus
                      </button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <textarea
                        value={tc.stdin}
                        onChange={(e) => {
                          const next = [...soal.testCases];
                          next[i] = { ...tc, stdin: e.target.value };
                          setSoal({ ...soal, testCases: next });
                        }}
                        rows={2}
                        placeholder="stdin (input)"
                        className="w-full rounded border border-slate-700 bg-[#0b0e14] px-2 py-1 font-mono text-xs text-slate-100 outline-none focus:border-violet-500"
                      />
                      <textarea
                        value={tc.expected}
                        onChange={(e) => {
                          const next = [...soal.testCases];
                          next[i] = { ...tc, expected: e.target.value };
                          setSoal({ ...soal, testCases: next });
                        }}
                        rows={2}
                        placeholder="expected (output)"
                        className="w-full rounded border border-slate-700 bg-[#0b0e14] px-2 py-1 font-mono text-xs text-slate-100 outline-none focus:border-violet-500"
                      />
                    </div>
                    <div className="mt-2 flex items-center gap-4">
                      <label className="flex items-center gap-1 text-xs text-slate-400">
                        poin
                        <input
                          type="number"
                          min={1}
                          value={tc.points}
                          onChange={(e) => {
                            const next = [...soal.testCases];
                            next[i] = { ...tc, points: Number(e.target.value) || 1 };
                            setSoal({ ...soal, testCases: next });
                          }}
                          className="w-16 rounded border border-slate-700 bg-[#0b0e14] px-2 py-1 text-xs text-slate-100 outline-none focus:border-violet-500"
                        />
                      </label>
                      <label className="flex items-center gap-1 text-xs text-slate-400">
                        <input
                          type="checkbox"
                          checked={tc.hidden}
                          onChange={(e) => {
                            const next = [...soal.testCases];
                            next[i] = { ...tc, hidden: e.target.checked };
                            setSoal({ ...soal, testCases: next });
                          }}
                        />
                        hidden (tak terlihat peserta)
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {soalMsg && <p className="mt-3 text-sm text-amber-400">{soalMsg}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setSoal(null)}
                className="rounded border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
              >
                Batal
              </button>
              <button
                onClick={saveSoal}
                disabled={soalBusy}
                className="rounded bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
              >
                {soalBusy ? 'Menyimpan…' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {exam && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4">
          <div className="my-4 w-full max-w-2xl rounded-xl border border-slate-700 bg-[#0b0e14] p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">
                {exam.id ? 'Edit Ujian' : 'Buat Ujian'}
              </h3>
              <button onClick={() => setExam(null)} className="text-sm text-slate-500 hover:text-slate-300">
                tutup
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="sm:col-span-2 text-xs text-slate-400">
                Judul ujian
                <input
                  value={exam.title}
                  onChange={(e) => setExam({ ...exam, title: e.target.value })}
                  className="mt-1 w-full rounded border border-slate-700 bg-[#0d1117] px-3 py-2 text-sm text-slate-100 outline-none focus:border-violet-500"
                />
              </label>
              <label className="sm:col-span-2 text-xs text-slate-400">
                Deskripsi (opsional)
                <textarea
                  value={exam.description}
                  onChange={(e) => setExam({ ...exam, description: e.target.value })}
                  rows={2}
                  className="mt-1 w-full rounded border border-slate-700 bg-[#0d1117] px-3 py-2 text-xs text-slate-100 outline-none focus:border-violet-500"
                />
              </label>
              <label className="text-xs text-slate-400">
                Durasi (menit)
                <input
                  type="number"
                  min={1}
                  value={exam.durationMin}
                  onChange={(e) => setExam({ ...exam, durationMin: Number(e.target.value) })}
                  className="mt-1 w-full rounded border border-slate-700 bg-[#0d1117] px-3 py-2 text-sm text-slate-100 outline-none focus:border-violet-500"
                />
              </label>
              <label className="flex items-end gap-2 text-xs text-slate-400">
                <input
                  type="checkbox"
                  checked={exam.published}
                  onChange={(e) => setExam({ ...exam, published: e.target.checked })}
                  className="mb-2"
                />
                <span className="mb-1.5">Tayangkan (published)</span>
              </label>
              <label className="text-xs text-slate-400">
                Jadwal mulai
                <input
                  type="datetime-local"
                  value={exam.startAt}
                  onChange={(e) => setExam({ ...exam, startAt: e.target.value })}
                  className="mt-1 w-full rounded border border-slate-700 bg-[#0d1117] px-3 py-2 text-sm text-slate-100 outline-none focus:border-violet-500"
                />
              </label>
              <label className="text-xs text-slate-400">
                Jadwal selesai
                <input
                  type="datetime-local"
                  value={exam.endAt}
                  onChange={(e) => setExam({ ...exam, endAt: e.target.value })}
                  className="mt-1 w-full rounded border border-slate-700 bg-[#0d1117] px-3 py-2 text-sm text-slate-100 outline-none focus:border-violet-500"
                />
              </label>
            </div>

            <div className="mt-4">
              <h4 className="mb-2 text-sm font-medium text-white">
                Pilih soal ({exam.problemIds.length} dipilih)
              </h4>
              <div className="max-h-52 space-y-1 overflow-y-auto rounded border border-slate-800 p-2">
                {(openCourse?.problems ?? []).map((p) => (
                  <label
                    key={p.id}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs hover:bg-slate-800/50"
                  >
                    <input
                      type="checkbox"
                      checked={exam.problemIds.includes(p.id)}
                      onChange={() => toggleExamProblem(p.id)}
                    />
                    <span className="min-w-0 flex-1 truncate text-slate-200">{p.title}</span>
                    <span className="shrink-0 font-mono text-[10px] text-slate-500">{p.language}</span>
                  </label>
                ))}
                {(openCourse?.problems ?? []).length === 0 && (
                  <p className="px-2 py-1 text-xs text-slate-600">
                    Belum ada soal di MK ini. Buat soal dulu.
                  </p>
                )}
              </div>
            </div>

            {examMsg && <p className="mt-3 text-sm text-amber-400">{examMsg}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setExam(null)}
                className="rounded border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
              >
                Batal
              </button>
              <button
                onClick={saveExam}
                disabled={examBusy}
                className="rounded bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
              >
                {examBusy ? 'Menyimpan…' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showGen && openCourse && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4">
          <div className="my-4 w-full max-w-2xl rounded-xl border border-slate-700 bg-[#0b0e14] p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">✨ Generate Soal dari Materi (AI)</h3>
              <button onClick={() => setShowGen(false)} className="text-sm text-slate-500 hover:text-slate-300">
                tutup
              </button>
            </div>
            <p className="mb-3 text-xs text-slate-500">
              AI (Ollama gemma4-16k) membuat draf soal dari materi terpilih. Tinjau &amp; simpan tiap soal.
            </p>

            <div className="mb-3">
              <h4 className="mb-1 text-xs font-medium text-slate-300">Materi ({genMaterialIds.length} dipilih)</h4>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded border border-slate-800 p-2">
                {materials.map((m) => (
                  <label key={m.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs hover:bg-slate-800/50">
                    <input
                      type="checkbox"
                      checked={genMaterialIds.includes(m.id)}
                      onChange={() => toggleGenMaterial(m.id)}
                    />
                    <span className="min-w-0 flex-1 truncate text-slate-200">{m.title}</span>
                  </label>
                ))}
                {materials.length === 0 && (
                  <p className="px-2 py-1 text-xs text-slate-600">Belum ada materi. Unggah materi dulu.</p>
                )}
              </div>
            </div>

            <div className="mb-3 grid grid-cols-3 gap-2">
              <label className="text-xs text-slate-400">
                Jumlah soal
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={genCount}
                  onChange={(e) => setGenCount(Math.min(Math.max(Number(e.target.value) || 1, 1), 5))}
                  className="mt-1 w-full rounded border border-slate-700 bg-[#0d1117] px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-violet-500"
                />
              </label>
              <label className="text-xs text-slate-400">
                Bahasa
                <select
                  value={genLang}
                  onChange={(e) => setGenLang(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-700 bg-[#0d1117] px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-violet-500"
                >
                  {SOAL_LANGS.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-slate-400">
                Kesulitan
                <select
                  value={genDiff}
                  onChange={(e) => setGenDiff(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-700 bg-[#0d1117] px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-violet-500"
                >
                  <option value="mudah">mudah</option>
                  <option value="sedang">sedang</option>
                  <option value="sulit">sulit</option>
                </select>
              </label>
            </div>

            {genMsg && <p className="mb-2 text-sm text-amber-400">{genMsg}</p>}
            <button
              onClick={generateSoal}
              disabled={genBusy}
              className="mb-4 w-full rounded bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-60"
            >
              {genBusy ? 'Menghasilkan… (bisa ~1 menit)' : 'Generate'}
            </button>

            {genDrafts.length > 0 && (
              <div className="border-t border-slate-800 pt-3">
                <h4 className="mb-2 text-sm font-medium text-white">Draf Soal ({genDrafts.length})</h4>
                <ul className="space-y-2">
                  {genDrafts.map((d, i) => (
                    <li key={i} className="rounded border border-slate-800 bg-[#0d1117] p-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 flex-1 truncate text-sm text-slate-200">{d.title}</span>
                        <button
                          onClick={() => reviewDraft(d)}
                          className="shrink-0 rounded bg-violet-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-violet-500"
                        >
                          Tinjau &amp; Simpan
                        </button>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-500">{d.description}</p>
                      <p className="mt-1 font-mono text-[10px] text-slate-600">
                        {d.language} · {d.difficulty} · {d.testCases.length} test case
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {replayId && (
        <ReplayModal
          attemptId={replayId}
          peserta={attempts.find((a) => a.id === replayId)?.peserta ?? null}
          onClose={() => setReplayId(null)}
        />
      )}

      {simPair && (
        <SimPairModal
          problemId={simProblem}
          a={simPair.a}
          b={simPair.b}
          onClose={() => setSimPair(null)}
        />
      )}
    </div>
  );
}
