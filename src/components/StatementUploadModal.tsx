import React, { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, X, FileSpreadsheet } from 'lucide-react';
import {
  Transaction,
  parseStatementText,
  parsePdfStatementWithMeta,
  parseBankNarration,
  formatINR,
} from '../utils/statementParser';
import { SAMPLE_STATEMENTS, StatementDataset } from '../utils/sampleStatements';

export interface UploadedDatasetMeta {
  label: string;
  accountHolder?: string;
  accountMasked?: string;
  ifsc?: string;
  branchName?: string;
  fileName: string;
  fileFormat: 'PDF' | 'CSV' | 'XLS';
  periodLabel: string;
}

interface StatementUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeDatasetId: string;
  onApplyTransactions: (
    transactions: Transaction[],
    datasetMeta: UploadedDatasetMeta,
    mode: 'replace' | 'merge'
  ) => void;
}

export const StatementUploadModal: React.FC<StatementUploadModalProps> = ({
  isOpen,
  onClose,
  activeDatasetId,
  onApplyTransactions,
}) => {
  const [activeTab, setActiveTab] = useState<'file' | 'paste' | 'samples'>('file');
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('replace');
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pasteContent, setPasteContent] = useState(
    `15-10-2026,UPI/110920995972/DR/Swapni/SBIN/swapnilkh/na,35.00,0.00,3812.39
13-10-2026,UPI/665226280290/DR/KASTUR/SBIN/899965410/UPI,1650.00,0.00,3847.39
11-10-2026,UPI/225107040528/CR/Karan/SBIN/957967665/NO REM,0.00,79.00,5497.39`
  );
  const [liveNarrationTest, setLiveNarrationTest] = useState(
    'UPI/110920995972/DR/Swapni/SBIN/swapnilkh/na'
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = async (file: File) => {
    setErrorMsg(null);
    setIsProcessing(true);

    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      let parsedTxns: Transaction[] = [];
      let detectedFormat: 'PDF' | 'CSV' | 'XLS' = 'CSV';
      let accountHolder: string | undefined;
      let accountMasked: string | undefined;
      let ifsc: string | undefined;
      let branchName: string | undefined;
      let extractedPeriod: string | undefined;

      if (ext === 'pdf' || file.type === 'application/pdf') {
        detectedFormat = 'PDF';
        const buffer = await file.arrayBuffer();
        const result = await parsePdfStatementWithMeta(buffer);
        parsedTxns = result.transactions;
        accountHolder = result.meta.accountHolder;
        if (result.meta.accountNumber) {
          accountMasked = `BOI A/c ${result.meta.accountNumber}`;
        }
        ifsc = result.meta.ifsc;
        branchName = result.meta.branchName;
        extractedPeriod = result.meta.periodLabel;
      } else {
        if (ext === 'xls' || ext === 'xlsx') {
          detectedFormat = 'XLS';
        }
        const text = await file.text();
        parsedTxns = parseStatementText(text);
      }

      if (parsedTxns.length === 0) {
        setErrorMsg(
          `Could not detect valid Bank of India transaction rows in "${file.name}". Please ensure the file contains Date, Narration/Description, and Debit/Credit columns, or use the Paste Statement Rows tab.`
        );
        setIsProcessing(false);
        return;
      }

      const sortedDates = [...parsedTxns].map((t) => t.date).sort();
      const periodLabel =
        extractedPeriod || `${sortedDates[0]} to ${sortedDates[sortedDates.length - 1]}`;

      onApplyTransactions(
        parsedTxns,
        {
          label: accountHolder ? `${accountHolder} — ${file.name}` : `Uploaded — ${file.name}`,
          accountHolder,
          accountMasked,
          ifsc,
          branchName,
          fileName: file.name,
          fileFormat: detectedFormat,
          periodLabel,
        },
        importMode
      );
      setIsProcessing(false);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to parse statement file.');
      setIsProcessing(false);
    }
  };

  const handlePasteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const parsed = parseStatementText(pasteContent);
    if (parsed.length === 0) {
      setErrorMsg(
        'No valid transactions found. Format each line with Date, Narration (e.g. UPI/DR/...), Debit, and Credit.'
      );
      return;
    }

    const sortedDates = [...parsed].map((t) => t.date).sort();
    onApplyTransactions(
      parsed,
      {
        label: 'Custom Pasted BOI Statement',
        fileName: 'Pasted_BOI_Transactions.csv',
        fileFormat: 'CSV',
        periodLabel: `${sortedDates[0]} to ${sortedDates[sortedDates.length - 1]}`,
      },
      importMode
    );
    onClose();
  };

  const handleSelectSample = (sample: StatementDataset) => {
    const parsed = parseStatementText(sample.rawCsv);
    onApplyTransactions(
      parsed,
      {
        label: sample.label,
        accountHolder: sample.accountHolder,
        accountMasked: sample.accountMasked,
        ifsc: sample.ifsc,
        branchName: sample.branchName,
        fileName: sample.fileName,
        fileFormat: sample.fileFormat,
        periodLabel: sample.periodLabel,
      },
      importMode
    );
    onClose();
  };

  const handleMergeAllSamples = () => {
    const combined = SAMPLE_STATEMENTS.flatMap((s, idx) =>
      parseStatementText(s.rawCsv).map((t) => ({ ...t, id: `${s.id}-${t.id}-${idx}` }))
    );
    onApplyTransactions(
      combined,
      {
        label: 'Combined Sep & Oct 2026 — BOI Savings',
        fileName: 'BOI_Combined_Sep_Oct_2026.pdf',
        fileFormat: 'PDF',
        periodLabel: '15 Sep 2026 – 24 Oct 2026',
      },
      'replace'
    );
    onClose();
  };

  const livePreview = parseBankNarration(liveNarrationTest, 'DEBIT');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-modal-title"
    >
      <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 id="upload-modal-title" className="text-lg font-semibold text-slate-900">
              Import Bank of India Statement
            </h2>
            <p className="text-xs text-slate-500">
              Supports BOI PDF e-Statements, CSV exports, and StarConnect Excel (.xls) passbook files
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close statement upload modal"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Mode Selector Tabs + Replace vs RRN Deduplicate Merge */}
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-2.5 flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex items-center gap-1 rounded-lg bg-slate-200/70 p-1">
            <button
              type="button"
              onClick={() => {
                setActiveTab('file');
                setErrorMsg(null);
              }}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'file'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Upload PDF / CSV / Excel
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('paste');
                setErrorMsg(null);
              }}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'paste'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Paste Statement Rows
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('samples');
                setErrorMsg(null);
              }}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'samples'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sample BOI Statements
            </button>
          </div>

          <div className="inline-flex items-center gap-1 rounded-lg bg-slate-200/70 p-1">
            <button
              type="button"
              onClick={() => setImportMode('replace')}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                importMode === 'replace'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Replace Active
            </button>
            <button
              type="button"
              onClick={() => setImportMode('merge')}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                importMode === 'merge'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Merge & Deduplicate (RRN)
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {errorMsg && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50/70 p-3.5 text-xs text-red-800"
            >
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {activeTab === 'file' && (
            <div className="space-y-5">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleFileUpload(file);
                }}
                className={`flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center transition-colors ${
                  isDragging
                    ? 'border-blue-600 bg-blue-50/40'
                    : 'border-slate-300 bg-slate-50/60 hover:border-slate-400'
                }`}
              >
                <Upload className="h-8 w-8 text-slate-500 mb-3" />
                <p className="text-sm font-medium text-slate-900">
                  Drag and drop your Bank of India statement here
                </p>
                <p className="mt-1 text-xs text-slate-500 max-w-md">
                  Automatically extracts UPI sender/receiver names, VPA handles, NEFT/IMPS counterparties, and closing balances.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.csv,.tsv,.xls,.xlsx,.txt"
                  aria-label="Choose bank statement file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                />
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                >
                  {isProcessing ? 'Parsing Statement...' : 'Select Statement File'}
                </button>
                <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                  <span>Supported formats: PDF</span>
                  <span aria-hidden="true">·</span>
                  <span>CSV</span>
                  <span aria-hidden="true">·</span>
                  <span>StarConnect XLS</span>
                </div>
              </div>

              {/* Interactive BOI UPI Narration Decoder Tester */}
              <div className="rounded-lg border border-slate-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label htmlFor="narration-tester" className="text-xs font-semibold text-slate-800">
                    Live BOI UPI Narration Parser Preview
                  </label>
                  <span className="text-xs text-slate-500">NPCI / BOI Format</span>
                </div>
                <input
                  id="narration-tester"
                  type="text"
                  value={liveNarrationTest}
                  onChange={(e) => setLiveNarrationTest(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-800 focus:border-slate-900 focus:bg-white focus:outline-none"
                />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 text-xs">
                  <div>
                    <span className="text-slate-500 block">Extracted Name</span>
                    <span className="font-semibold text-slate-900">{livePreview.counterparty}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">UPI Handle</span>
                    <span className="font-mono text-slate-800">{livePreview.upiId || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Auto-Category</span>
                    <span className="font-medium text-slate-900">{livePreview.category}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Ledger Type</span>
                    <span className="font-medium text-slate-900">
                      {livePreview.isPerson ? 'Person (P2P)' : 'Merchant / Bill'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'paste' && (
            <form onSubmit={handlePasteSubmit} className="space-y-4">
              <div>
                <label htmlFor="paste-csv-textarea" className="block text-xs font-medium text-slate-700 mb-1.5">
                  Paste CSV or Passbook Rows (Date, Narration, Debit, Credit, Balance)
                </label>
                <textarea
                  id="paste-csv-textarea"
                  rows={6}
                  value={pasteContent}
                  onChange={(e) => setPasteContent(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-800 focus:border-slate-900 focus:bg-white focus:outline-none"
                  placeholder="14-10-2026,UPI/DR/628914502918/RAHUL SHARMA/SBIN/rahul@oksbi/Dinner,850.00,0.00,42150.00"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Detected {parseStatementText(pasteContent).length} valid transaction rows
                </span>
                <button
                  type="submit"
                  className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                >
                  Parse & Load Rows
                </button>
              </div>
            </form>
          )}

          {activeTab === 'samples' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-600">
                Load pre-configured Bank of India statements to inspect multi-month P2P settlements, budget alerts, and recurring mandates:
              </p>
              <div className="divide-y divide-slate-200 rounded-lg border border-slate-200">
                {SAMPLE_STATEMENTS.map((sample) => {
                  const txns = parseStatementText(sample.rawCsv);
                  const isCurrent = activeDatasetId === sample.id;
                  return (
                    <div
                      key={sample.id}
                      className="flex items-center justify-between gap-4 p-4 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        {sample.fileFormat === 'PDF' ? (
                          <FileText className="h-5 w-5 text-slate-600 mt-0.5 shrink-0" />
                        ) : (
                          <FileSpreadsheet className="h-5 w-5 text-slate-600 mt-0.5 shrink-0" />
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-900">{sample.label}</span>
                            {isCurrent && (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                                <CheckCircle2 className="h-3.5 w-3.5" /> Active
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                            <span className="font-mono">{sample.fileName}</span>
                            <span aria-hidden="true">·</span>
                            <span>{txns.length} transactions</span>
                            <span aria-hidden="true">·</span>
                            <span>{sample.periodLabel}</span>
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSelectSample(sample)}
                        className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
                      >
                        Load Statement
                      </button>
                    </div>
                  );
                })}

                <div className="flex items-center justify-between gap-4 p-4 bg-slate-50/60">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      Combined 2-Statement Ledger (Deduplicated by 12-Digit RRN)
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                      <span>80 transactions</span>
                      <span aria-hidden="true">·</span>
                      <span>Multi-statement RRN merge</span>
                      <span aria-hidden="true">·</span>
                      <span>Total Volume {formatINR(265000)}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleMergeAllSamples}
                    className="rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                  >
                    Load Combined
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
