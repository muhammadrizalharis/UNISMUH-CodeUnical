<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:0f172a,50:4f46e5,100:7c3aed&height=200&section=header&text=CodeUnical&fontSize=72&fontColor=ffffff&fontAlignY=38&desc=UNISMUH%20%C2%B7%20Secure%20Coding%20Exam%20Platform&descSize=16&descAlignY=58&animation=fadeIn" width="100%" />

<img src="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=500&size=18&pause=1000&duration=2800&color=22C55E&center=true&vCenter=true&width=720&lines=%3E+ketik+manual+(no+paste);%3E+run+-%3E+auto-graded;%3E+proctored+-%3E+camera+%2B+anti-macro;%3E+integrity+enforced+by+design" alt="terminal" />

<br/><br/>

![status](https://img.shields.io/badge/status-in__development-F59E0B?style=flat-square&labelColor=0f172a)
![mode](https://img.shields.io/badge/mode-Lab_%26_Remote-4f46e5?style=flat-square&labelColor=0f172a)
![license](https://img.shields.io/badge/license-Proprietary-EF4444?style=flat-square&labelColor=0f172a)
![unismuh](https://img.shields.io/badge/UNISMUH-Informatika-7c3aed?style=flat-square&labelColor=0f172a)

</div>

---

<div align="center">

```console
$ codeunical exam:start --lang python --mode lab
  ✓ editor locked        ✓ paste blocked        ✓ camera armed
  ✓ fullscreen forced    ✓ keystrokes logged    ✓ similarity check
→ Ketik kodemu. Setiap ketukan direkam. Good luck.
```

<kbd>Ctrl</kbd> + <kbd>V</kbd> ❌ &nbsp;&nbsp; <kbd>Ctrl</kbd> + <kbd>C</kbd> ❌ &nbsp;&nbsp; <kbd>Manual&nbsp;Typing</kbd> ✅

</div>

---

## `~/` Apa itu CodeUnical?

**`CodeUnical`** = `Code` + `Uni` + `ICAL` — platform ujian & praktikum pemrograman berbasis web untuk kampus.

Mahasiswa **wajib mengetik kode secara manual** (tanpa copy-paste), kode **dijalankan langsung** di sandbox terisolasi, dinilai **otomatis** lewat *test case*, dan seluruh sesi **diawasi berlapis**.

> Multi-bahasa *pluggable* — `Python` · `SQL` · `C++` · `HTML` · … — tambah runner tanpa mengubah inti.

---

## `>` Fitur Unggulan

| | Fitur | Deskripsi |
|:--:|---|---|
| `⌨️` | **Manual Typing** | Blokir semua paste + deteksi ritme ketikan (anti-macro) |
| `🎬` | **Keystroke Replay** | Putar ulang cara kode diketik dari nol — bukti kepemilikan |
| `🖥️` | **Locked Fullscreen** | Deteksi keluar tab, split-screen, monitor kedua |
| `⚡` | **Live Execution** | Sandbox terisolasi, output instan |
| `🎯` | **Auto-Grade** | Uji lawan *hidden test case* + nilai parsial |
| `📷` | **Camera Proctor** | Deteksi wajah hilang / wajah asing / HP |
| `🔍` | **Code Similarity** | Bandingkan AST + *fingerprint*, bukan sekadar teks |
| `📊` | **Live Dashboard** | Pantau semua mahasiswa realtime + drill-down per individu |

---

## `#` Anti-Cheat Berlapis

```mermaid
flowchart LR
    A["paste&nbsp;block"] --> B["rhythm&nbsp;detect"]
    B --> C["keystroke&nbsp;replay"]
    C --> D["fullscreen&nbsp;+&nbsp;tab/monitor"]
    D --> E["3-strike"]
    E --> F["camera&nbsp;(face/phone)"]
    F --> G["code&nbsp;similarity"]
    G --> H["integrity ✓"]
    style H fill:#22c55e,color:#0f172a,stroke:#16a34a
    style A fill:#4f46e5,color:#fff,stroke:#4338ca
```

> **Filosofi:** menang bukan di *memblokir input*, tapi di **kombinasi lapisan**. Walau cara memasukkan kode tak terdeteksi, **hasil identik tetap ketahuan** lewat cek kemiripan.

---

## `⌥` Mode Ujian

<table>
<tr>
<td width="50%" valign="top">

### `🏫` Lab
Berpengawas · HP dikumpulkan · dosen keliling

```diff
+ proctoring ringan
+ face-recognition penguji
+ paling andal (LAN langsung)
```

</td>
<td width="50%" valign="top">

### `🌐` Remote
Dari rumah · tanpa pengawas fisik

```diff
! kamera + face + HP wajib
! semua lapisan aktif
- butuh domain kampus
```

</td>
</tr>
</table>

---

## `⌘` Arsitektur

```mermaid
flowchart TB
    subgraph client["client"]
        M["mahasiswa · editor terkunci"]
        D["dosen · dashboard live"]
    end
    subgraph stack["CodeUnical · stack mandiri"]
        WEB["next.js :47300"]
        API["nestjs + ws :47080"]
        DB[("postgres :47432")]
        REDIS[("redis :47379")]
        MINIO[("minio :47900")]
        SBX["sandbox · docker"]
        ML["proctor/ml · gpu"]
    end
    M <-->|wss| API
    D <-->|wss| API
    WEB --> API
    API --> DB
    API --> REDIS
    API --> MINIO
    API --> SBX
    API --> ML
    style stack fill:#0f172a,color:#e2e8f0,stroke:#4f46e5
    style client fill:#1e1b4b,color:#e2e8f0,stroke:#7c3aed
```

---

## `↻` Alur Ujian

```mermaid
flowchart LR
    A["login"] --> B["pilih ujian"]
    B --> C["izin kamera"]
    C --> D["fullscreen"]
    D --> E["soal acak"]
    E --> F["ketik manual"]
    F --> G["run"]
    G --> F
    F --> H["submit"]
    H --> I["auto-grade"]
    I --> J["nilai ✓"]
    style J fill:#22c55e,color:#0f172a,stroke:#16a34a
    style A fill:#4f46e5,color:#fff,stroke:#4338ca
```

---

## `⚙` Tech Stack

<div align="center">

![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)
![MinIO](https://img.shields.io/badge/MinIO-C72E49?style=for-the-badge&logo=minio&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![Prometheus](https://img.shields.io/badge/Prometheus-E6522C?style=for-the-badge&logo=prometheus&logoColor=white)

</div>

---

## `⛁` Struktur

```text
CodeUnical/
├── web/          next.js — editor mahasiswa + dashboard dosen
├── api/          nestjs — rest + websocket + auth + orkestrasi
├── sandbox/      executor eksekusi kode (docker per bahasa)
├── proctor/      python — yolo · face recognition · code similarity
├── prisma/       skema & migrasi database
├── docs/         BLUEPRINT.md (cetak biru detail)
└── docker-compose.yml
```

---

## `☑` Roadmap

```text
[x] cetak biru & arsitektur
[ ] MVP — editor + manual-typing + run python + autosave + timer
[ ] auto-grade + bank soal + randomisasi
[ ] proctoring jendela + 3-strike + keystroke replay
[ ] code similarity + dashboard dosen live
[ ] camera + face recognition penguji
[ ] multi-bahasa (sql · c++ · html)
```

---

## `!` Batasan Jujur

> CodeUnical membuat kecurangan **praktis sangat sulit**, bukan mustahil secara matematis.

- Blokir paste menahan mayoritas; *macro* bisa lolos → ditutup **ritme + replay + similarity**.
- Kamera = penekan kuat, bukan tembok → mode Lab **kumpulkan HP** fisik.
- 100% anti-nyontek hanya via **ujian lab terkontrol / proctoring**.

---

## `🔒` Keamanan & Privasi

- **Isolasi penuh** — docker/db/sandbox/port sendiri, tak menumpang proyek lain.
- **Data biometrik & rekaman** — persetujuan eksplisit, penyimpanan aman, retensi terbatas + auto-hapus.
- **Sandbox** — jaringan internal, batas cpu/ram/waktu, non-root, cap-drop.
- **Enforcement** nilai/strike di sisi server (client tak dipercaya).

<br/>

<div align="center">

`built for academic integrity`

**Pengembang** — Muhammad Rizal Haris

<sub>© 2026 Muhammad Rizal Haris · Proprietary & Confidential</sub>

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:7c3aed,50:4f46e5,100:0f172a&height=120&section=footer" width="100%" />

</div>
