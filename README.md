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

## Scripts

```bash
npm run dev
npm run lint
npm run build
npm run preview
```
