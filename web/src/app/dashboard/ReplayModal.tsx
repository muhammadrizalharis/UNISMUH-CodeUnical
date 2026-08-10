'use client';

import { useEffect, useRef, useState } from 'react';

// Alamat API: ikut host halaman (LAN 10.33.33.11 / localhost) bila env kosong.
const API =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:47080`
    : 'http://localhost:47080');

interface Key {
  t: number;
  value: string;
}
interface Ev {
  kind: string;
  at: string;
}
interface Replay {
  status: string;
  strikes: number;
  startedAt: string;
  keystrokes: Key[];
  events: Ev[];
}
interface Snap {
  id: string;
  kind: string;
  mime: string;
  at: string;
}

export function ReplayModal({
  attemptId,
  peserta,
  onClose,
}: {
  attemptId: string;
  peserta?: { name: string; code: string | null } | null;
  onClose: () => void;
}) {
  const [data, setData] = useState<Replay | null>(null);
  const [snaps, setSnaps] = useState<Snap[]>([]);
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const lastRef = useRef(0);

  useEffect(() => {
    fetch(`${API}/attempts/${attemptId}/replay`, { credentials: 'include' })
      .then((r) => r.json())
      .then(setData)
      .catch(() => undefined);
    fetch(`${API}/attempts/${attemptId}/snapshots`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : []))
      .then(setSnaps)
      .catch(() => undefined);
  }, [attemptId]);

  const maxT = data?.keystrokes.length ? data.keystrokes[data.keystrokes.length - 1].t : 0;

  useEffect(() => {
    if (!playing) return;
    lastRef.current = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const dt = now - lastRef.current;
      lastRef.current = now;
      setPlayhead((p) => Math.min(maxT, p + dt));
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, maxT]);

  useEffect(() => {
    if (playing && maxT > 0 && playhead >= maxT) setPlaying(false);
  }, [playhead, playing, maxT]);

  let current = '';
  if (data) {
    for (const k of data.keystrokes) {
      if (k.t <= playhead) current = k.value;
      else break;
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-xl border border-slate-700 bg-[#0d1117]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2">
          <span className="font-mono text-sm text-slate-400">
            🎬 {peserta ? `${peserta.name}${peserta.code ? ' · ' + peserta.code : ''}` : 'Anonim'} · {attemptId.slice(-6)}
          </span>
          <button onClick={onClose} className="text-slate-500 hover:text-white">
            ✕
          </button>
        </div>
        {!data ? (
          <div className="p-8 text-center text-slate-500">Memuat…</div>
        ) : (
          <>
            <pre className="min-h-[200px] flex-1 overflow-auto bg-[#0b0e14] p-4 font-mono text-sm text-slate-200">
              {current || '(belum ada ketikan)'}
            </pre>
            <div className="flex items-center gap-3 border-t border-slate-800 px-4 py-3">
              <button
                onClick={() => {
                  if (playhead >= maxT) setPlayhead(0);
                  setPlaying((p) => !p);
                }}
                className="rounded bg-violet-600 px-3 py-1 text-white hover:bg-violet-500"
              >
                {playing ? '⏸' : '▶'}
              </button>
              <input
                type="range"
                min={0}
                max={maxT}
                value={playhead}
                onChange={(e) => {
                  setPlaying(false);
                  setPlayhead(Number(e.target.value));
                }}
                className="flex-1"
              />
              <span className="font-mono text-xs text-slate-500">
                {(playhead / 1000).toFixed(1)}s / {(maxT / 1000).toFixed(1)}s
              </span>
            </div>
            {snaps.length > 0 && (
              <div className="border-t border-slate-800 px-4 py-3">
                <p className="mb-2 font-mono text-xs text-slate-500">
                  📷 Bukti kamera ({snaps.length})
                </p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {snaps.map((s) => (
                    <a
                      key={s.id}
                      href={`${API}/snapshots/${s.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0"
                      title={`${s.kind} · ${new Date(s.at).toLocaleTimeString()}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`${API}/snapshots/${s.id}`}
                        alt={s.kind}
                        className="h-20 w-28 rounded border border-slate-700 object-cover"
                      />
                      <span
                        className={`mt-0.5 block text-center text-[9px] ${
                          s.kind === 'multiple_faces'
                            ? 'text-rose-400'
                            : s.kind === 'face_absent'
                              ? 'text-amber-400'
                              : 'text-slate-500'
                        }`}
                      >
                        {s.kind}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            )}
            <div className="max-h-28 overflow-auto border-t border-slate-800 px-4 py-2 font-mono text-xs">
              <span className="text-slate-500">
                status {data.status} · {data.strikes}/3 strike · {data.keystrokes.length} snapshot
              </span>
              {data.events.map((e, i) => (
                <div key={i} className="text-rose-400">
                  ⚠ {e.kind}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
