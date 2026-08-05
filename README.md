# Live Chat KPI Dashboard

Dashboard React/Vite untuk memantau KPI live chat: productivity, CSAT, SLA, WHU, QA, attendance, schedule, dan leaderboard.

## Prerequisites

- Node.js
- npm

## Run Locally

```bash
npm install
npm run dev
```

Default dev server berjalan di `http://localhost:3000`.

## Data Source

Aplikasi bisa dipakai dengan upload CSV manual melalui File Center tanpa konfigurasi environment.

Untuk mode Google Sheets, buat file `.env.local`:

```env
VITE_SHEETS_API_KEY=your_google_sheets_api_key
VITE_SPREADSHEET_ID=your_spreadsheet_id
# Optional: override the Spreadsheet ID for the Aug-Oct 2026 archive
VITE_SPREADSHEET_ID_AUG_OCT_2026=your_aug_oct_2026_spreadsheet_id
```

Nama tab default yang dibaca:

- `CSID`
- `Productivity CSAT WHU`
- `CSAT SC`
- `SLA`
- `Schedule`
- `QA`

Jika nama tab berbeda, override dengan env berikut:

```env
VITE_SHEET_CSID=CSID
VITE_SHEET_PRODUCTIVITY=Productivity CSAT WHU
VITE_SHEET_CSAT_SC=CSAT SC
VITE_SHEET_SLA=SLA
VITE_SHEET_SCHEDULE=Schedule
VITE_SHEET_QA=QA
```

Untuk data bulanan, biarkan tab Mei tetap memakai env di atas. Mulai Juni 2026, File Center bisa memilih bulan dan membaca tab dengan format:

- `CSID_JUN_2026`
- `PRODUCTIVITY_JUN_2026`
- `CSAT_SC_JUN_2026`
- `SLA_JUN_2026`
- `SCHEDULE_JUN_2026`
- `QA_JUN_2026`

Ganti suffix bulan untuk bulan berikutnya, misalnya `JUL_2026`, `AUG_2026`, dan seterusnya. Pilihan bulan di File Center dibuat otomatis sampai beberapa tahun ke depan, jadi tidak perlu update code hanya untuk menambah tahun baru.

Untuk periode Agustus-Oktober 2026, aplikasi membaca `AUG_2026`, `SEP_2026`, dan `OCT_2026` dari Spreadsheet terpisah. Jika `VITE_SPREADSHEET_ID_AUG_OCT_2026` tidak diisi, aplikasi memakai Spreadsheet ID bawaan untuk link periode tersebut.

## Scripts

```bash
npm run dev
npm run lint
npm run build
npm run preview
```
