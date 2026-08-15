'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Alamat API same-origin: /api diproksi Next ke backend (tanpa isu lintas-origin/cookie).
const API = process.env.NEXT_PUBLIC_API_URL || '/api';

export function useProctor() {
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [strikes, setStrikes] = useState(0);
  const [kicked, setKicked] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [active, setActive] = useState(false);

  const attemptRef = useRef<string | null>(null);
  const startAtRef = useRef(0);
  const keyBufRef = useRef<{ t: number; p: number; d: number; value: string }[]>([]);
  const pendingRef = useRef(''); // nilai editor terkini
  const committedRef = useRef(''); // nilai terakhir yang sudah dicatat sebagai delta

  const sendEvent = useCallback(async (kind: string) => {
    const id = attemptRef.current;
    if (!id) return;
    try {
      const res = await fetch(`${API}/attempts/${id}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: [{ kind }] }),
      });
      const d = await res.json();
      setStrikes(d.strikes ?? 0);
      if (d.kicked) {
        setKicked(true);
      } else if (d.strikes === 1) {
        setWarning('Kamu keluar dari layar ujian. Pelanggaran ke-1 — kembali ke ujian.');
      } else if (d.strikes === 2) {
        setWarning('Pelanggaran ke-2 — nilai dikurangi. Sekali lagi = didiskualifikasi & mengulang.');
      }
    } catch {
      // best-effort
    }
  }, []);

  const start = useCallback(async (problemId?: string, examId?: string) => {
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      // fullscreen ditolak — tetap lanjut, exit-fullscreen tak akan ke-trigger
    }
    try {
      const res = await fetch(`${API}/attempts`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problemId, examId }),
      });
      const d = await res.json();
      attemptRef.current = d.attemptId;
      setAttemptId(d.attemptId);
    } catch {
      // tetap jalan lokal
    }
    startAtRef.current = Date.now();
    pendingRef.current = '';
    committedRef.current = '';
    keyBufRef.current = [];
    setActive(true);
    const screenApi = window.screen as unknown as { isExtended?: boolean };
    if (screenApi.isExtended) void sendEvent('multimonitor');
  }, [sendEvent]);

  // Cukup catat nilai editor terkini; delta (posisi/hapus/sisip) dihitung sampler berkala di bawah.
  const recordKeystroke = useCallback((value: string) => {
    pendingRef.current = value;
  }, []);

  const logPaste = useCallback(() => void sendEvent('paste'), [sendEvent]);
  const dismissWarning = useCallback(() => setWarning(null), []);

  // detektor pelanggaran
  useEffect(() => {
    if (!active) return;
    const onVis = () => {
      if (document.hidden) void sendEvent('tabhidden');
    };
    const onBlur = () => void sendEvent('blur');
    const onFs = () => {
      if (!document.fullscreenElement) void sendEvent('fullscreen_exit');
    };
    const onResize = () => {
      const full =
        Math.abs(window.innerWidth - screen.width) < 4 &&
        Math.abs(window.innerHeight - screen.height) < 140;
      if (!document.fullscreenElement && !full) void sendEvent('split');
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', onBlur);
    document.addEventListener('fullscreenchange', onFs);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('fullscreenchange', onFs);
      window.removeEventListener('resize', onResize);
    };
  }, [active, sendEvent]);

  // sampler delta + flush keystroke + heartbeat
  useEffect(() => {
    if (!active) return;
    // Tiap 250ms: bila editor berubah, catat 1 delta (prefix/suffix diff) -> hemat disk + replay presisi.
    const sample = setInterval(() => {
      const cur = pendingRef.current;
      const prev = committedRef.current;
      if (cur === prev) return;
      const t = Date.now() - startAtRef.current;
      const min = Math.min(prev.length, cur.length);
      let p = 0;
      while (p < min && prev[p] === cur[p]) p++;
      let s = 0;
      while (s < min - p && prev[prev.length - 1 - s] === cur[cur.length - 1 - s]) s++;
      keyBufRef.current.push({ t, p, d: prev.length - p - s, value: cur.slice(p, cur.length - s) });
      committedRef.current = cur;
    }, 250);
    const flush = setInterval(() => {
      const id = attemptRef.current;
      if (!id || keyBufRef.current.length === 0) return;
      const keys = keyBufRef.current.splice(0, keyBufRef.current.length);
      fetch(`${API}/attempts/${id}/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys }),
      }).catch(() => undefined);
    }, 2000);
    const hb = setInterval(() => {
      const id = attemptRef.current;
      if (id) fetch(`${API}/attempts/${id}/heartbeat`, { method: 'POST' }).catch(() => undefined);
    }, 15000);
    return () => {
      clearInterval(sample);
      clearInterval(flush);
      clearInterval(hb);
    };
  }, [active]);

  return {
    attemptId,
    strikes,
    kicked,
    warning,
    active,
    start,
    recordKeystroke,
    logPaste,
    dismissWarning,
  };
}
