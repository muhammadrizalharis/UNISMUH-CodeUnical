"""Deteksi gabungan: HP (YOLO, kelas COCO 'cell phone') + wajah/face-rec (InsightFace).
Model dimuat sekali ke GPU dan tetap resident (standby)."""
import os

import numpy as np
from insightface.app import FaceAnalysis
from ultralytics import YOLO

MODELS_DIR = os.environ.get("MODELS_DIR", "/models")
YOLO_WEIGHTS = os.environ.get("YOLO_WEIGHTS", os.path.join(MODELS_DIR, "yolo11n.pt"))
DEVICE = os.environ.get("DEVICE", "cuda:0")  # di dalam container, GPU ter-reserve = index 0
PHONE_CONF = float(os.environ.get("PHONE_CONF", "0.35"))
FACE_MATCH_THRESHOLD = float(os.environ.get("FACE_MATCH_THRESHOLD", "0.35"))
COCO_CELL_PHONE = 67

# ctx_id InsightFace: >=0 pakai GPU, -1 pakai CPU.
_CTX = 0 if DEVICE.startswith("cuda") else -1


class Detector:
    def __init__(self) -> None:
        self.yolo = YOLO(YOLO_WEIGHTS)
        self.yolo.to(DEVICE)
        providers = (
            ["CUDAExecutionProvider", "CPUExecutionProvider"]
            if DEVICE.startswith("cuda")
            else ["CPUExecutionProvider"]
        )
        self.face = FaceAnalysis(
            name="buffalo_l",
            root=os.path.join(MODELS_DIR, "insightface"),
            providers=providers,
        )
        self.face.prepare(ctx_id=_CTX, det_size=(640, 640))
        # Whitelist embedding penguji: {nama: vektor ternormalisasi}. In-memory (MVP).
        self.whitelist: dict[str, np.ndarray] = {}
        # Warm-up agar inferensi pertama tak lambat.
        self._warmup()

    def _warmup(self) -> None:
        dummy = np.zeros((640, 640, 3), dtype=np.uint8)
        self.yolo.predict(dummy, verbose=False, device=DEVICE, conf=PHONE_CONF)
        self.face.get(dummy)

    def detect(self, img_bgr: np.ndarray) -> dict:
        phones = []
        res = self.yolo.predict(
            img_bgr, verbose=False, device=DEVICE, conf=PHONE_CONF, classes=[COCO_CELL_PHONE]
        )[0]
        for b in res.boxes:
            phones.append(
                {"conf": float(b.conf[0]), "box": [int(x) for x in b.xyxy[0].tolist()]}
            )

        faces = []
        for f in self.face.get(img_bgr):
            name, score = self._match(f.normed_embedding)
            faces.append(
                {
                    "box": [int(x) for x in f.bbox.tolist()],
                    "det_score": float(f.det_score),
                    "examiner": name,  # nama penguji ter-whitelist, atau None
                    "match_score": round(score, 4),
                }
            )

        # Ringkasan flag proctoring
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
            s = float(np.dot(emb, ref))  # cosine (vektor sudah ternormalisasi)
            if s > best_s:
                best, best_s = name, s
        if best is not None and best_s >= FACE_MATCH_THRESHOLD:
            return best, best_s
        return None, best_s

    def enroll(self, name: str, img_bgr: np.ndarray) -> bool:
        faces = self.face.get(img_bgr)
        if not faces:
            return False
        # Ambil wajah terbesar sebagai referensi.
        f = max(faces, key=lambda x: (x.bbox[2] - x.bbox[0]) * (x.bbox[3] - x.bbox[1]))
        self.whitelist[name] = f.normed_embedding
        return True
