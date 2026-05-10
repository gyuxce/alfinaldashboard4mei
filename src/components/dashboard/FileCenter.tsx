import React from 'react';
import Papa from 'papaparse';
import { useStore, AppState } from '../../store';
import { UploadCloud, CheckCircle2, FileText, DownloadCloud, Loader2, DatabaseBackup, AlertTriangle, AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/utils';
import { 
  validateCsidFile, 
  validateProductivityFile, 
  validateCsatScFile, 
  validateSlaFile, 
  validateScheduleFile, 
  validateQaFile 
} from '../../lib/csvValidator';

function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'baru saja';
  if (diffMin < 60) return `${diffMin} menit lalu`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} jam lalu`;
  return date.toLocaleDateString('id-ID');
}

const validators: Record<string, (data: any[][]) => any> = {
  csidFile: validateCsidFile,
  productivityFile: validateProductivityFile,
  csatScFile: validateCsatScFile,
  slaFile: validateSlaFile,
  scheduleFile: validateScheduleFile,
  qaFile: validateQaFile,
};

const UploadCard = ({ title, fileKey }: { title: string, fileKey: keyof AppState }) => {
  const store = useStore() as any;
  const file = store[fileKey] as File | null;
  const setFile = store.setFile;
  const persistedKeys = store.persistedKeys || [];
  const fileValidations = store.fileValidations || {};
  const validation = fileValidations[fileKey];
  
  const isPersisted = persistedKeys.includes(fileKey as string);
  const isPersisting = store.isPersisting;
  const fileName = store.fileNames?.[fileKey] || (file ? file.name : null);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    Papa.parse(selectedFile, {
      complete: (results) => {
        const validator = validators[fileKey];
        const valResult = validator ? validator(results.data as any[][]) : { isValid: true, severity: 'ok' };
        if (valResult && valResult.severity !== 'ok') {
           console.warn(`Validation warning for ${fileKey}:`, valResult);
        }
        setFile(fileKey, selectedFile, results.data, valResult);
      },
      error: (error) => {
        console.error('Error parsing CSV: ' + error.message);
        setFile(fileKey, selectedFile, [], { 
          isValid: false, 
          errorType: 'PARSE_ERROR', 
          message: 'Error membaca file: ' + error.message,
          severity: 'error'
        });
      }
    });
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col items-center text-center shadow-[0_1px_3px_rgba(0,0,0,0.04)] relative overflow-hidden group">
      {/* Saved Indicator */}
      {isPersisted && (
        <div className="absolute top-2 right-2 flex items-center gap-1 text-[9px] font-bold text-success  px-1.5 py-0.5 rounded uppercase tracking-wider backdrop-blur-sm mt-0.5">
           <DatabaseBackup className="w-3 h-3" />
           Saved
        </div>
      )}
      
      <div className={cn(
        "w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors",
        file ? "text-success" : "bg-primary-soft text-primary group-hover:bg-primary-soft-hover"
      )}>
        {file ? <CheckCircle2 className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
      </div>
      <h3 className="text-13px font-bold text-text-primary mb-1">{title}</h3>
      <p className="text-[11px] text-text-muted mb-4 h-8 flex flex-col items-center justify-center" title={fileName || ''}>
        {fileName ? (
          <span className="line-clamp-2">{fileName}</span>
        ) : (
          'Pilih file CSV yang sesuai.'
        )}
      </p>
      
      {/* Validation Badge */}
      {validation && validation.severity !== 'ok' && (
        <div className={cn(
          "mb-3 px-2 py-1 rounded text-left flex items-start gap-1.5 w-full",
          validation.severity === 'warning' ? "text-warning" : "text-danger"
        )}>
          <div className="mt-0.5 shrink-0">
            {validation.severity === 'warning' ? <AlertTriangle className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
          </div>
          <div className="text-[10px] leading-tight">
            <strong>{validation.errorType}:</strong> {validation.message}
          </div>
        </div>
      )}
      
      <label className={cn(
        "relative cursor-pointer border text-text-primary px-3 py-1.5 rounded-lg w-full font-bold text-[11px] transition-colors flex justify-center",
        file ? "bg-surface border-border hover:bg-border/50" : "bg-card border-border hover:bg-surface hover:text-primary"
      )}>
        <input type="file" accept=".csv" className="sr-only" onChange={handleUpload} />
        <span className="flex items-center gap-2">
          {isPersisting && file ? (
             <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
             <DownloadCloud className="w-3.5 h-3.5" />
          )}
          {file ? 'Replace File' : 'Browse File'}
        </span>
      </label>
    </div>
  );
};

export const FileCenter = () => {
  const { clearFiles, fetchFromSheets, isFetchingSheets, sheetsFetchError, lastSyncTime } = useStore();

  const [isConfirming, setIsConfirming] = React.useState(false);

  const handleClear = () => {
    if (isConfirming) {
       clearFiles();
       setIsConfirming(false);
    } else {
       setIsConfirming(true);
       setTimeout(() => setIsConfirming(false), 3000);
    }
  };

  const isSheetMode = !!import.meta.env.VITE_SHEETS_API_KEY;

  const sheetNames = [
    { label: 'Master CSID', tabName: import.meta.env.VITE_SHEET_CSID || 'CSID' },
    { label: 'Productivity, CSAT, WHU', tabName: import.meta.env.VITE_SHEET_PRODUCTIVITY || 'Productivity CSAT WHU' },
    { label: 'CSAT SC Raw Data', tabName: import.meta.env.VITE_SHEET_CSAT_SC || 'CSAT SC' },
    { label: 'SLA Responses', tabName: import.meta.env.VITE_SHEET_SLA || 'SLA' },
    { label: 'Agent Scheduling', tabName: import.meta.env.VITE_SHEET_SCHEDULE || 'Schedule' },
    { label: 'QA Score', tabName: import.meta.env.VITE_SHEET_QA || 'QA' },
  ];

  if (isSheetMode) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-text-primary">
              Data Integration Center
            </h2>
            <p className="text-text-muted text-sm mt-1">
              Data otomatis diambil dari Google Sheets
            </p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={handleClear}
              className="px-3 py-1.5 border-danger/20 border text-danger text-xs hover:bg-danger-soft transition-colors rounded-lg font-bold"
            >
               {isConfirming ? 'Click Again to Confirm Reset' : 'Reset Data'}
            </button>
            <button 
              onClick={fetchFromSheets} 
              disabled={isFetchingSheets}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors
                ${isFetchingSheets ? 'bg-primary/70 cursor-not-allowed' : 'bg-primary hover:bg-primary/90'}`}
            >
              <RefreshCw className={`w-4 h-4 ${isFetchingSheets ? 'animate-spin' : ''}`} />
              {isFetchingSheets ? 'Syncing...' : 'Sync Now'}
            </button>
          </div>
        </div>
        
        {/* Error state */}
        {sheetsFetchError && (
          <div className="bg-danger-soft border border-danger/50 rounded-xl p-4 text-danger text-sm flex gap-3 items-center">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p>{sheetsFetchError}</p>
          </div>
        )}
        
        {/* Loading state */}
        {isFetchingSheets && (
          <div className="flex flex-col items-center justify-center py-12 text-text-muted bg-card/50 rounded-xl border border-border mt-4">
            <Loader2 className="w-8 h-8 animate-spin mb-3 text-primary"/>
            <p className="font-medium text-text-primary">Mengambil data dari Google Sheets...</p>
            <p className="text-xs mt-1">Mohon tunggu sebentar</p>
          </div>
        )}

        {!isFetchingSheets && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sheetNames.map((sheet, idx) => (
              <div key={idx} className="bg-card border border-border rounded-xl p-5 flex flex-col relative overflow-hidden group hover:border-primary/30 transition-colors shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded bg-primary-soft flex items-center justify-center shrink-0">
                    <CheckCircle2 size={18} className="text-primary"/>
                  </div>
                  <div>
                    <h3 className="font-semibold text-text-primary text-sm">{sheet.label}</h3>
                  </div>
                </div>
                <div className="space-y-1.5 mt-auto border-t border-border/50 pt-3">
                  <p className="text-[11px] text-text-muted flex justify-between">
                    <span>Google Sheet Tab:</span>
                    <span className="font-medium text-text-primary">"{sheet.tabName}"</span>
                  </p>
                  <p className="text-[11px] text-text-muted flex justify-between">
                    <span>Status:</span>
                    <span className="font-medium text-success">
                      {lastSyncTime ? `Synced ${formatRelativeTime(lastSyncTime)}` : 'Belum di-sync'}
                    </span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-lg font-bold text-text-primary">Data Integration Center</h1>
          <p className="text-xs text-text-muted mt-1">Upload CSV files across modules to power the 360-degree dashboard.</p>
        </div>
        <button 
          onClick={handleClear}
          className="text-danger font-bold text-[11px] px-3 py-1.5 bg-danger-soft hover:bg-danger-soft/80 border border-danger/20 rounded-lg transition-colors flex items-center gap-1.5 relative z-20 cursor-pointer pointer-events-auto"
        >
          {isConfirming ? 'Click Again to Confirm' : 'Reset All Data'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <UploadCard title="Master CSID" fileKey="csidFile" />
        <UploadCard title="Productivity, CSAT, WHU" fileKey="productivityFile" />
        <UploadCard title="CSAT SC Raw Data" fileKey="csatScFile" />
        <UploadCard title="SLA Responses" fileKey="slaFile" />
        <UploadCard title="Agent Scheduling" fileKey="scheduleFile" />
        <UploadCard title="QA Score" fileKey="qaFile" />
      </div>
    </div>
  );
};
