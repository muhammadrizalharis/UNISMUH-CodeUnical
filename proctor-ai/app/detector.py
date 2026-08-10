"""Deteksi gabungan: HP (YOLO/ultralytics) + wajah & face-rec (facenet-pytorch: MTCNN +
InceptionResnetV1/VGGFace2, embedding gaya ArcFace). Semua di torch/GPU (reuse torch py310).
Model dimuat sekali ke GPU dan tetap resident (standby)."""
import os

import cv2
import numpy as np
import torch
from facenet_pytorch import (
    MTCNN,
    InceptionResnetV1,
    extract_face,
    fixed_image_standardization,
)
from ultralytics import YOLO

MODELS_DIR = os.environ.get(
    "MODELS_DIR", os.path.join(os.path.dirname(__file__), "..", "models")
)
YOLO_WEIGHTS = os.environ.get("YOLO_WEIGHTS", os.path.join(MODELS_DIR, "yolo11n.pt"))
DEVICE = os.environ.get("DEVICE", "cuda:0")
PHONE_CONF = float(os.environ.get("PHONE_CONF", "0.35"))
FACE_DET_PROB = float(os.environ.get("FACE_DET_PROB", "0.90"))
FACE_MATCH_THRESHOLD = float(os.environ.get("FACE_MATCH_THRESHOLD", "0.55"))
# Ambang pose (offset horizontal hidung thd garis mata, dinormalkan jarak antar-mata).
POSE_FRONT_MAX = float(os.environ.get("POSE_FRONT_MAX", "0.15"))
POSE_SIDE_MIN = float(os.environ.get("POSE_SIDE_MIN", "0.15"))
COCO_CELL_PHONE = 67
WHITELIST_PATH = os.environ.get(
    "WHITELIST_PATH", os.path.join(MODELS_DIR, "whitelist.npz")
)


class Detector:
    def __init__(self) -> None:
        self.device = torch.device(DEVICE if torch.cuda.is_available() else "cpu")
        self.yolo = YOLO(YOLO_WEIGHTS)
        self.yolo.to(self.device)
        self.mtcnn = MTCNN(keep_all=True, device=self.device)
        self.resnet = InceptionResnetV1(pretrained="vggface2").eval().to(self.device)
        # Whitelist embedding penguji: {nama: vektor ternormalisasi}. Persist ke disk.
        self.whitelist: dict[str, np.ndarray] = {}
        self._load_whitelist()
        self._warmup()

    def _warmup(self) -> None:
        dummy = np.zeros((640, 640, 3), dtype=np.uint8)
        self.yolo.predict(dummy, verbose=False, device=self.device, conf=PHONE_CONF)

    def _load_whitelist(self) -> None:
        if os.path.exists(WHITELIST_PATH):
            try:
                data = np.load(WHITELIST_PATH)
                wl: dict[str, np.ndarray] = {}
                for k in data.files:
                    v = np.asarray(data[k], dtype=np.float32)
                    # Kompat lama: 1 embedding (512,) -> (1, 512).
                    wl[k] = v.reshape(1, -1) if v.ndim == 1 else v
                self.whitelist = wl
            except Exception:
                self.whitelist = {}

    def _save_whitelist(self) -> None:
        try:
            os.makedirs(os.path.dirname(WHITELIST_PATH) or ".", exist_ok=True)
            np.savez(WHITELIST_PATH, **self.whitelist)
        except Exception:
            pass

    def remove(self, name: str) -> bool:
        if name in self.whitelist:
            del self.whitelist[name]
            self._save_whitelist()
            return True
        return False

    def _embed(self, img_rgb: np.ndarray, boxes, probs):
        """Ekstrak wajah -> embedding ternormalisasi (batch, di GPU)."""
        crops, kept = [], []
        for box, prob in zip(boxes, probs):
            if prob is None or float(prob) < FACE_DET_PROB:
                continue
            # Standardisasi (x-127.5)/128 seperti pipeline facenet -> embedding diskriminatif.
            crops.append(fixed_image_standardization(extract_face(img_rgb, box)))
            kept.append((box, float(prob)))
        if not crops:
            return [], np.empty((0, 512))
        batch = torch.stack(crops).to(self.device)
        with torch.no_grad():
            embs = self.resnet(batch).cpu().numpy()
        embs = embs / (np.linalg.norm(embs, axis=1, keepdims=True) + 1e-9)
        return kept, embs

    def detect(self, img_bgr: np.ndarray) -> dict:
        # HP (YOLO 'cell phone')
        phones = []
        res = self.yolo.predict(
            img_bgr, verbose=False, device=self.device, conf=PHONE_CONF, classes=[COCO_CELL_PHONE]
        )[0]
        for b in res.boxes:
            phones.append(
                {"conf": float(b.conf[0]), "box": [int(x) for x in b.xyxy[0].tolist()]}
            )

        # Wajah + face-rec (MTCNN deteksi -> ResNet embedding)
        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
        boxes, probs = self.mtcnn.detect(img_rgb)
        faces = []
        if boxes is not None:
            kept, embs = self._embed(img_rgb, boxes, probs)
            for (box, prob), emb in zip(kept, embs):
                name, score = self._match(emb)
                faces.append(
                    {
                        "box": [int(x) for x in np.asarray(box).tolist()],
                        "det_score": round(prob, 4),
                        "examiner": name,  # nama penguji ter-whitelist, atau None
                        "match_score": round(score, 4),
                    }
                )

        unknown_faces = sum(1 for f in faces if f["examiner"] is None)
        return {
            "phones": phones,
            "phone_detected": len(phones) > 0,
            "faces": faces,
            "face_count": len(faces),
            "unknown_face_count": unknown_faces,
        }

    def _match(self, emb: np.ndarray) -> tuple[str | None, float]:
        best, best_s = None, 0.0
        for name, ref in self.whitelist.items():
            R = ref if ref.ndim == 2 else ref.reshape(1, -1)
            s = float(np.max(R @ emb))  # cosine maksimum lintas sudut tersimpan
            if s > best_s:
                best, best_s = name, s
        if best is not None and best_s >= FACE_MATCH_THRESHOLD:
            return best, best_s
        return None, best_s

    @staticmethod
    def _pose_offset(lm: np.ndarray) -> float:
        """Offset horizontal hidung thd titik tengah mata, dinormalkan jarak antar-mata.
        ~0 = hadap depan; negatif/positif = menoleh ke salah satu sisi."""
        lm = np.asarray(lm, dtype=np.float32)
        eye_mid = (lm[0] + lm[1]) / 2.0
        inter = float(np.linalg.norm(lm[1] - lm[0])) + 1e-6
        return float((lm[2][0] - eye_mid[0]) / inter)

    def _largest_face(self, img_bgr: np.ndarray):
        """Wajah terbesar -> (embedding, pose_offset, jumlah_wajah) atau None."""
        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
        boxes, probs, lms = self.mtcnn.detect(img_rgb, landmarks=True)
        if boxes is None:
            return None
        idx = max(
            range(len(boxes)),
            key=lambda i: (boxes[i][2] - boxes[i][0]) * (boxes[i][3] - boxes[i][1]),
        )
        if probs[idx] is None or float(probs[idx]) < FACE_DET_PROB:
            return None
        _, embs = self._embed(img_rgb, [boxes[idx]], [probs[idx]])
        if len(embs) == 0:
            return None
        return embs[0], self._pose_offset(lms[idx]), len(boxes)

    def enroll(self, name: str, img_bgr: np.ndarray) -> bool:
        r = self._largest_face(img_bgr)
        if r is None:
            return False
        self.whitelist[name] = r[0].reshape(1, -1).astype(np.float32)
        self._save_whitelist()
        return True

    def enroll_multi(self, name: str, images: list[np.ndarray]) -> dict:
        """Enroll live multi-sudut: wajib ada wajah DEPAN + KIRI + KANAN (foto diam tak bisa),
        dan tiap frame harus berisi TEPAT 1 wajah (penguji sendiri)."""
        embs: list[np.ndarray] = []
        got = {"front": 0, "left": 0, "right": 0}
        for img in images:
            r = self._largest_face(img)
            if r is None:
                continue
            emb, off, nfaces = r
            if nfaces != 1:
                continue  # harus sendiri saat enroll
            if abs(off) < POSE_FRONT_MAX:
                bucket = "front"
            elif off <= -POSE_SIDE_MIN:
                bucket = "left"
            elif off >= POSE_SIDE_MIN:
                bucket = "right"
            else:
                continue  # antara depan & samping -> tak dihitung
            got[bucket] += 1
            embs.append(emb)
        missing = [k for k in ("front", "left", "right") if got[k] == 0]
        if missing or len(embs) < 3:
            return {
                "ok": False,
                "reason": "pose_incomplete",
                "missing": missing,
                "got": got,
                "count": len(embs),
            }
        self.whitelist[name] = np.stack(embs).astype(np.float32)
        self._save_whitelist()
        return {"ok": True, "count": len(embs), "got": got}

