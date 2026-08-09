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
COCO_CELL_PHONE = 67


class Detector:
    def __init__(self) -> None:
        self.device = torch.device(DEVICE if torch.cuda.is_available() else "cpu")
        self.yolo = YOLO(YOLO_WEIGHTS)
        self.yolo.to(self.device)
        self.mtcnn = MTCNN(keep_all=True, device=self.device)
        self.resnet = InceptionResnetV1(pretrained="vggface2").eval().to(self.device)
        # Whitelist embedding penguji: {nama: vektor ternormalisasi}. In-memory (MVP).
        self.whitelist: dict[str, np.ndarray] = {}
        self._warmup()

    def _warmup(self) -> None:
        dummy = np.zeros((640, 640, 3), dtype=np.uint8)
        self.yolo.predict(dummy, verbose=False, device=self.device, conf=PHONE_CONF)

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
            s = float(np.dot(emb, ref))  # cosine (vektor sudah ternormalisasi)
            if s > best_s:
                best, best_s = name, s
        if best is not None and best_s >= FACE_MATCH_THRESHOLD:
            return best, best_s
        return None, best_s

    def enroll(self, name: str, img_bgr: np.ndarray) -> bool:
        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
        boxes, probs = self.mtcnn.detect(img_rgb)
        if boxes is None:
            return False
        # Ambil wajah terbesar sebagai referensi.
        idx = max(
            range(len(boxes)),
            key=lambda i: (boxes[i][2] - boxes[i][0]) * (boxes[i][3] - boxes[i][1]),
        )
        kept, embs = self._embed(img_rgb, [boxes[idx]], [probs[idx]])
        if len(embs) == 0:
            return False
        self.whitelist[name] = embs[0]
        return True
