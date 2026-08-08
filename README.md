<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:6366F1,50:8B5CF6,100:EC4899&height=230&section=header&text=CodeUnical&fontSize=78&fontColor=ffffff&fontAlignY=38&desc=UNISMUH%20%E2%80%A2%20Ujian%20Koding%20Anti-Nyontek&descSize=20&descAlignY=60&animation=fadeIn" width="100%" />

<img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=600&size=22&pause=800&duration=2800&color=8B5CF6&center=true&vCenter=true&width=820&lines=Ketik+manual+-+tanpa+copy+paste;Jalankan+langsung+-+dinilai+otomatis;Proctoring+berlapis+-+kamera+%26+anti-macro;Integritas+ujian%2C+dijaga+berlapis" alt="Typing SVG" />

<br/><br/>

![status](https://img.shields.io/badge/status-in%20development-F59E0B?style=for-the-badge)
![mode](https://img.shields.io/badge/mode-Lab%20%26%20Remote-6366F1?style=for-the-badge)
![license](https://img.shields.io/badge/license-Proprietary-EF4444?style=for-the-badge)
![for](https://img.shields.io/badge/for-UNISMUH-8B5CF6?style=for-the-badge)

<h3>🛡️ <em>Ketik sendiri, atau ketahuan.</em></h3>

</div>

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" width="100%" />

## ✨ Apa itu CodeUnical?

<img align="right" width="180" src="https://capsule-render.vercel.app/api?type=soft&color=0:8B5CF6,100:EC4899&height=120&section=header&text=%3C%2F%3E&fontSize=60&fontColor=ffffff&fontAlignY=52" />

**CodeUnical** ( **Code** + **Uni** + **ICAL** ) adalah platform ujian & praktikum pemrograman berbasis web untuk kampus.

Mahasiswa **wajib mengetik kode secara manual** (tanpa copy-paste), kode **dijalankan langsung** di server, dinilai **otomatis** lewat *test case*, dan seluruh sesi **diawasi berlapis** demi menjaga integritas akademik.

> Mendukung banyak bahasa (**Python · SQL · C++ · HTML · …**) secara *pluggable* — tinggal pasang runner bahasa baru tanpa mengubah inti.

<br clear="right"/>

## 🎯 Kenapa dibangun?

<table>
<tr>
<td width="50%">

**Masalah**
- 🕳️ Ujian koding mudah dicurangi (paste, buka tab, contek teman)
- ⏳ Dosen menghabiskan berjam-jam koreksi kode manual
- ❓ Tidak ada bukti kepemilikan ("ini beneran kamu yang ngetik?")
- 💸 Tool asing mahal & tak terintegrasi kampus

</td>
<td width="50%">

**Solusi CodeUnical**
- ⌨️ Ketik manual + anti-macro + replay ketikan
- 🤖 Penilaian otomatis via test case
- 🎥 Proctoring berlapis (jendela + kamera)
- 🏛️ Mandiri di server kampus, data tak ke cloud

</td>
</tr>
</table>

## 🚀 Fitur Unggulan

| | Fitur | Deskripsi |
|:--:|---|---|
| ⌨️ | **Ketik Manual** | Blokir semua paste (Ctrl+V, klik-kanan, drag) + deteksi ritme ketikan (anti-macro) |
| 🎬 | **Replay Ketikan** | Dosen memutar ulang cara kode diketik dari nol — bukti kepemilikan |
| 🖥️ | **Fullscreen Terkunci** | Deteksi keluar tab, split-screen, monitor kedua |
| ⚡ | **Eksekusi Real-time** | Kode dijalankan di sandbox terisolasi, output instan |
| 🎯 | **Auto-Grade** | Uji lawan test case tersembunyi + nilai parsial |
| 📷 | **Proctoring Kamera** | Deteksi wajah hilang / wajah asing / HP (event-based recording) |
| 🔍 | **Deteksi Kemiripan** | Bandingkan struktur kode (AST + fingerprint), bukan sekadar teks |
| 📊 | **Dashboard Live** | Dosen pantau semua mahasiswa realtime + drill-down per individu |

## 🛡️ Sistem Anti-Nyontek Berlapis

```mermaid
flowchart LR
    A["⌨️ Blokir Paste"] --> B["🎵 Deteksi Ritme"]
    B --> C["🎬 Replay Ketikan"]
    C --> D["🖥️ Fullscreen + Tab/Monitor"]
    D --> E["⚠️ Sistem 3-Strike"]
    E --> F["📷 Kamera (wajah/HP)"]
    F --> G["🔍 Kemiripan Kode"]
    G --> H["✅ Integritas Terjaga"]
    style H fill:#8B5CF6,color:#fff
    style A fill:#6366F1,color:#fff
```

> **Filosofi:** menang bukan di *memblokir input*, tapi di **kombinasi lapisan**. Walau cara memasukkan kode tak terdeteksi, **hasil identik tetap ketahuan** lewat cek kemiripan.

## 🎓 Mode Ujian

<table>
<tr>
<td width="50%" align="center">

### 🏫 Mode Lab
Berpengawas, HP dikumpulkan, dosen keliling

`Proctoring ringan` · `Face-recognition penguji` · `Paling andal (LAN langsung)`

</td>
<td width="50%" align="center">

### 🌐 Mode Remote
Dari rumah, tanpa pengawas fisik

`Kamera + Face + HP wajib` · `Semua lapisan aktif` · `Butuh domain kampus`

</td>
</tr>
</table>

## 🧩 Arsitektur

```mermaid
flowchart TB
    subgraph Klien
        M["🎓 Mahasiswa<br/>Editor terkunci + kamera"]
        D["🧑‍🏫 Dosen<br/>Dashboard live (bebas)"]
    end
    subgraph Stack["🛡️ CodeUnical — Stack Mandiri"]
        WEB["⚡ Next.js<br/>:47300"]
        API["🔌 NestJS + WebSocket<br/>:47080"]
        DB[("🐘 PostgreSQL<br/>:47432")]
        REDIS[("🧠 Redis<br/>:47379")]
        MINIO[("📦 MinIO<br/>:47900")]
        SANDBOX["🧪 Sandbox<br/>Docker terisolasi"]
        ML["👁️ Proctor/ML<br/>GPU L40S"]
    end
    M <-->|WSS| API
    D <-->|WSS| API
    WEB --> API
    API --> DB
    API --> REDIS
    API --> MINIO
    API --> SANDBOX
    API --> ML
    style Stack fill:#1e1b4b,color:#fff
```

## 🔄 Alur Ujian

```mermaid
flowchart LR
    A["🔐 Login"] --> B["📋 Pilih ujian"]
    B --> C["📷 Izin kamera<br/>+ persetujuan"]
    C --> D["🖥️ Fullscreen"]
    D --> E["🎲 Soal acak"]
    E --> F["⌨️ Ketik manual"]
    F --> G["▶️ Jalankan"]
    G --> F
    F --> H["📤 Submit"]
    H --> I["🎯 Auto-grade"]
    I --> J["✅ Nilai"]
    style J fill:#22C55E,color:#fff
    style A fill:#6366F1,color:#fff
```

## 🛠️ Tech Stack

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

## 📁 Struktur

```
CodeUnical/
├── README.md            ← dokumen ini
├── docker-compose.yml   ← stack mandiri (postgres · redis · minio · api · web · sandbox)
├── .env.example
├── web/                 ← Next.js (editor mahasiswa + dashboard dosen)
├── api/                 ← NestJS (REST + WebSocket + auth + orkestrasi)
├── sandbox/             ← executor eksekusi kode (Docker per bahasa)
├── proctor/             ← layanan Python (YOLO · face recognition · kemiripan kode)
├── prisma/              ← skema & migrasi database
└── docs/                ← dokumentasi tambahan
```

## 🗺️ Roadmap

- [x] 📐 Cetak biru & arsitektur
- [ ] 🧱 **MVP** — editor + ketik-manual + run Python + auto-save + timer
- [ ] 🎯 Auto-grade + bank soal + randomisasi
- [ ] 🛡️ Proctoring jendela + 3-strike + replay ketikan
- [ ] 🔍 Kemiripan kode + dashboard dosen live
- [ ] 📷 Kamera + face recognition penguji
- [ ] 🌐 Multi-bahasa (SQL · C++ · HTML)

## ⚖️ Batasan Jujur

> Agar ekspektasi lurus — CodeUnical membuat kecurangan **praktis sangat sulit**, bukan mustahil secara matematis.

- Blokir paste menahan mayoritas; macro yang "mengetik" bisa lolos → ditutup **deteksi ritme + replay + kemiripan kode**.
- Kamera = penekan kuat, bukan tembok → mode Lab **kumpulkan HP** secara fisik.
- 100% anti-nyontek hanya tercapai dengan **ujian lab terkontrol / proctoring**.

## 🔒 Keamanan & Privasi

- 🏛️ **Isolasi penuh** — Docker/DB/sandbox/port sendiri, tidak menumpang proyek lain.
- 🔐 **Data biometrik & rekaman** — persetujuan eksplisit, penyimpanan aman, **retensi terbatas + auto-hapus**.
- 🖥️ **Sandbox** — jaringan internal, batas CPU/RAM/waktu, non-root, cap-drop.
- ✅ Enforcement nilai/strike **di sisi server** (client tak dipercaya).

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" width="100%" />

<div align="center">

**Dibuat dengan 🛡️ untuk integritas akademik — UNISMUH CodeUnical**

<em>© 2026 · Proprietary & Confidential</em>

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:EC4899,50:8B5CF6,100:6366F1&height=120&section=footer" width="100%" />

</div>
