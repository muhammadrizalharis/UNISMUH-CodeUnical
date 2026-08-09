'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:47080';

export type CamStatus = 'off' | 'starting' | 'on' | 'denied' | 'error';

/**
 * Proctoring kamera on-device (ringan untuk laptop kentang):
 * - deteksi wajah pakai MediaPipe FaceDetector (WASM lokal, ~1.5 dtk/frame)
 * - wajah hilang > 5 dtk atau > 1 wajah => kirim event + snapshot bukti
 * - kalau model gagal / perangkat lemah => fallback snapshot berkala saja
 * Event kamera DICATAT tapi TIDAK menambah strike (deteksi bisa noisy; dosen yang menilai).
 */
export function useCamera(attemptId: string | null, enabled: boolean) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const detectorRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const loopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const absentSinceRef = useRef<number | null>(null);
  const lastSnapRef = useRef<Record<string, number>>({});

  const [status, setStatus] = useState<CamStatus>('off');
  const [faces, setFaces] = useState(1);
  const [detReady, setDetReady] = useState(false);
  const [vision, setVision] = useState<{
    violations: string[];
    faceCount: number;
    phone: boolean;
  } | null>(null);

  const logCamEvent = useCallback(
    (kind: string) => {
      if (!attemptId) return;
      fetch(`${API}/attempts/${attemptId}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: [{ kind }] }),
      }).catch(() => undefined);
    },
    [attemptId],
  );

  const grabFrame = useCallback((w = 320): string | null => {
    const v = videoRef.current;
    if (!v || v.readyState < 2 || !v.videoWidth) return null;
    let canvas = canvasRef.current;
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvasRef.current = canvas;
    }
    const h = Math.round((v.videoHeight / v.videoWidth) * w) || 240;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(v, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', 0.6);
  }, []);

  const snapshot = useCallback(
    async (kind: string, minGapMs = 8000) => {
      if (!attemptId) return;
      const now = Date.now();
      if (now - (lastSnapRef.current[kind] ?? 0) < minGapMs) return;
      lastSnapRef.current[kind] = now;
      const image = grabFrame(320);
      if (!image) return;
      try {
        await fetch(`${API}/attempts/${attemptId}/snapshot`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind, image }),
        });
      } catch {
        // best-effort
      }
    },
    [attemptId, grabFrame],
  );

  // Kirim 1 frame ke service GPU (deteksi HP + wajah asing/penguji). Opsional & best-effort.
  const sendVision = useCallback(async () => {
    if (!attemptId) return;
    const image = grabFrame(480);
    if (!image) return;
    try {
      const res = await fetch(`${API}/attempts/${attemptId}/vision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image }),
      });
      if (!res.ok) return;
      const d = await res.json();
      if (d?.ok) {
        setVision({
          violations: d.violations ?? [],
          faceCount: d.detected?.face_count ?? 0,
          phone: !!d.detected?.phone_detected,
        });
      }
    } catch {
      // service GPU opsional
    }
  }, [attemptId, grabFrame]);

  // start kamera + inisialisasi detektor (sekali saat enabled)
  useEffect(() => {
    if (!enabled || !attemptId) return;
    let cancelled = false;

    (async () => {
      setStatus('starting');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240, facingMode: 'user' },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        setStatus('on');
      } catch (e) {
        const name = (e as { name?: string })?.name;
        setStatus(name === 'NotAllowedError' ? 'denied' : 'error');
        logCamEvent(name === 'NotAllowedError' ? 'camera_denied' : 'camera_error');
        return;
      }

      // detektor wajah (best-effort; kalau gagal pakai fallback berkala)
      try {
        const vision = await import('@mediapipe/tasks-vision');
        const fileset = await vision.FilesetResolver.forVisionTasks(
          `${location.origin}/mediapipe/wasm`,
        );
        const det = await vision.FaceDetector.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath: `${location.origin}/mediapipe/blaze_face_short_range.tflite`,
          },
          runningMode: 'VIDEO',
          minDetectionConfidence: 0.5,
        });
        if (cancelled) {
          det.close();
          return;
        }
        detectorRef.current = det;
        setDetReady(true);
      } catch {
        setDetReady(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, attemptId, logCamEvent]);

  // loop deteksi + snapshot
  useEffect(() => {
    if (status !== 'on' || !attemptId) return;
    let stopped = false;

    const tick = () => {
      if (stopped) return;
      const v = videoRef.current;
      const det = detectorRef.current;
      if (v && v.readyState >= 2 && v.videoWidth) {
        if (det) {
          try {
            const res = det.detectForVideo(v, performance.now());
            const n = res?.detections?.length ?? 0;
            setFaces(n);
            if (n === 0) {
              if (absentSinceRef.current == null) {
                absentSinceRef.current = Date.now();
              } else if (Date.now() - absentSinceRef.current > 5000) {
                logCamEvent('camera_face_absent');
                void snapshot('face_absent');
                absentSinceRef.current = Date.now(); // re-arm 5 dtk
              }
            } else {
              absentSinceRef.current = null;
              if (n > 1) {
                logCamEvent('camera_multiple_faces');
                void snapshot('multiple_faces');
              }
            }
          } catch {
            // frame gagal — abaikan
          }
        } else {
          // fallback tanpa deteksi: snapshot berkala sebagai bukti
          void snapshot('periodic', 20000);
        }
      }
      loopRef.current = setTimeout(tick, 1500);
    };

    tick();
    return () => {
      stopped = true;
      if (loopRef.current) clearTimeout(loopRef.current);
    };
  }, [status, attemptId, snapshot, logCamEvent]);

  // Kirim frame ke GPU /vision berkala (deteksi HP + face-rec penguji).
  useEffect(() => {
    if (status !== 'on' || !attemptId) return;
    const interval = Number(process.env.NEXT_PUBLIC_VISION_INTERVAL_MS ?? 6000);
    void sendVision();
    const t = setInterval(() => void sendVision(), interval);
    return () => clearInterval(t);
  }, [status, attemptId, sendVision]);

  // bersih-bersih saat unmount
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      detectorRef.current?.close?.();
    };
  }, []);

  return { videoRef, status, faces, detReady, vision };
}
