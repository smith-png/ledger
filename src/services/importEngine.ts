import {
  FullDatabaseSnapshot,
  PaymentMode,
  StatementColumnMapping,
  StatementImportPreview,
  StatementImportRecord,
  StatementImportRowCandidate,
  TransactionDirection,
  TransactionRecord,
  TransactionType,
} from '../types/finance';
import {
  parseBankNarration,
  parsePdfStatementWithMeta,
  normalizeBankDate,
} from '../utils/statementParser';
import { formatINRPaise, fromPaise, toPaise } from './financeEngine';

function normalizeDate(raw: string): string | null {
  return normalizeBankDate(raw);
}

function parseIndianAmount(val: string | number | undefined | null): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const str = String(val).trim();
  if (!str || str === '-' || str === '--') return 0;
  const isNegative = /^\(.*\)$/.test(str) || str.startsWith('-');
  const cleaned = str.replace(/[^0-9.]/g, '');
  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) return 0;
  return isNegative ? -parsed : parsed;
}

function splitCsvLine(line: string, delimiter = ','): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

export interface ImportInputSource {
  fileName: string;
  fileSizeBytes: number;
  fileBuffer?: Uint8Array;
  rawText?: string;
}

export function computeFileSignature(fileName: string, size: number, sampleText: string): string {
  let hash = 2166136261;
  const combined = `${fileName}|${size}|${sampleText.slice(0, 2000)}|${sampleText.slice(-2000)}`;
  for (let i = 0; i < combined.length; i++) {
    hash ^= combined.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `sig-${(hash >>> 0).toString(16)}-${size}`;
}

function mapLegacyModeToPaymentMode(mode?: string, desc?: string): PaymentMode {
  const m = (mode || '').toUpperCase();
  const d = (desc || '').toUpperCase();
  if (m === 'UPI' || d.includes('UPI/')) return 'UPI';
  if (m === 'IMPS' || d.includes('IMPS')) return 'IMPS';
  if (m === 'NEFT' || d.includes('NEFT')) return 'NEFT';
  if (m === 'RTGS' || d.includes('RTGS')) return 'RTGS';
  if (m === 'ATM' || d.includes('ATM') || d.includes('CASH WDL')) return 'ATM';
  if (m === 'POS' || d.includes('POS')) return 'POS';
  if (m === 'NACH' || d.includes('NACH') || d.includes('ECS') || d.includes('MANDATE')) return 'NACH';
  if (d.includes('CHQ') || d.includes('CHEQUE')) return 'CHEQUE';
  if (d.includes('INT.PD') || d.includes('INTEREST')) return 'INTEREST';
  if (d.includes('CHG') || d.includes('AMC') || d.includes('MAB') || d.includes('SMS')) return 'CHARGE';
  if (m === 'BANK_FEE') return 'CHARGE';
  return 'OTHER';
}

function mapCategoryAndType(
  direction: TransactionDirection,
  legacyCategory: string,
  description: string,
  isSelfTransfer: boolean
): { type: TransactionType; category: string; subCategory: string } {
  const upper = description.toUpperCase();
  if (isSelfTransfer || upper.includes('SELF TRANSFER') || upper.includes('OWN ACCOUNT')) {
    return { type: 'INTERNAL_TRANSFER', category: 'Self Transfer', subCategory: 'Internal Account Transfer' };
  }
  if (
    upper.includes('REFUND') ||
    upper.includes('REVERSAL') ||
    upper.includes('REV/') ||
    legacyCategory === 'Refund / Reversal'
  ) {
    return { type: 'REFUND', category: 'Refund / Reversal', subCategory: 'Merchant / Banking Refund' };
  }
  if (upper.includes('LOAN') || upper.includes('BORROW') || upper.includes('SETTLE')) {
    return {
      type: 'LOAN_SETTLEMENT',
      category: 'Personal Transfers',
      subCategory: direction === 'CREDIT' ? 'Loan / Split Received' : 'Loan / Split Paid',
    };
  }

  if (direction === 'CREDIT') {
    if (
      upper.includes('SALARY') ||
      upper.includes('PAYROLL') ||
      upper.includes('STIPEND') ||
      legacyCategory === 'Salary & Income'
    ) {
      return { type: 'INCOME', category: 'Salary', subCategory: 'Payroll Credit' };
    }
    if (
      upper.includes('INT.PD') ||
      upper.includes('INTEREST') ||
      legacyCategory === 'Savings Interest'
    ) {
      return { type: 'INCOME', category: 'Interest', subCategory: 'Savings Interest' };
    }
    if (legacyCategory === 'Friends & P2P' || legacyCategory === 'People & Transfers') {
      return { type: 'INCOME', category: 'Personal Transfers', subCategory: 'Received from Contact' };
    }
    return { type: 'INCOME', category: 'Personal Transfers', subCategory: 'General Credit' };
  }

  // DEBIT
    const categoryMap: Record<string, { cat: string; sub: string }> = {
      'Food & Dining': { cat: 'Food & Dining', sub: 'Restaurants, Bakery & Delivery' },
      Groceries: { cat: 'Groceries', sub: 'Supermarket, Dairy & Daily Needs' },
      'Travel & Commute': { cat: 'Travel & Transport', sub: 'Fuel, Metro, Cab & Rail' },
      'Fuel & Transport': { cat: 'Travel & Transport', sub: 'Fuel, Metro, Cab & Rail' },
      'Bills & Utilities': { cat: 'Bills & Utilities', sub: 'Mobile, Broadband, Electricity' },
      Shopping: { cat: 'Shopping', sub: 'Retail & Online Shopping' },
      'Health & Fitness': { cat: 'Health & Medical', sub: 'Pharmacy, Clinic & Wellness' },
      'Medical & Health': { cat: 'Health & Medical', sub: 'Pharmacy, Clinic & Wellness' },
      Subscriptions: { cat: 'Entertainment', sub: 'OTT & Recurring Subscriptions' },
      'Rent & Housing': { cat: 'Housing & Rent', sub: 'Rent & Maintenance' },
      Investments: { cat: 'Investments', sub: 'SIP, Mutual Fund & EMI' },
      'EMI & Investments': { cat: 'Investments', sub: 'SIP, Mutual Fund & EMI' },
      'People & Transfers': { cat: 'Personal Transfers', sub: 'Sent to Contact' },
      'Friends & P2P': { cat: 'Personal Transfers', sub: 'Sent to Contact' },
      'ATM & Cash': { cat: 'Bills & Utilities', sub: 'ATM Cash Withdrawal' },
      'Bank Charges & Fees': { cat: 'Bank Charges', sub: 'AMC, SMS, MAB & Penalties' },
      'Bank Charges': { cat: 'Bank Charges', sub: 'AMC, SMS, MAB & Penalties' },
      'Self & Internal Transfer': { cat: 'Self Transfer', sub: 'Internal Account Transfer' },
    };

  const mapped = categoryMap[legacyCategory];
  if (mapped) {
    return { type: 'EXPENSE', category: mapped.cat, subCategory: mapped.sub };
  }
  return { type: 'EXPENSE', category: 'Uncategorized', subCategory: 'General Expense' };
}

/**
 * Minimal 100% client-side XLSX (ZIP + XML) reader using browser DecompressionStream('deflate-raw').
 * Extracts rows from the first worksheet and sharedStrings table.
 */
async function extractRowsFromXlsxBuffer(buffer: Uint8Array): Promise<string[][]> {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const files: Record<string, string> = {};
  let offset = 0;

  while (offset + 30 <= buffer.length) {
    const sig = view.getUint32(offset, true);
    if (sig !== 0x04034b50) break; // Local file header signature
    const compression = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const fileNameLen = view.getUint16(offset + 26, true);
    const extraLen = view.getUint16(offset + 28, true);
    const fileNameBytes = buffer.subarray(offset + 30, offset + 30 + fileNameLen);
    const entryName = new TextDecoder().decode(fileNameBytes);
    const dataStart = offset + 30 + fileNameLen + extraLen;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > buffer.length) break;

    if (
      entryName === 'xl/sharedStrings.xml' ||
      entryName === 'xl/worksheets/sheet1.xml' ||
      entryName.startsWith('xl/worksheets/sheet')
    ) {
      const slice = buffer.subarray(dataStart, dataEnd);
      try {
        if (compression === 0) {
          files[entryName] = new TextDecoder().decode(slice);
        } else if (compression === 8 && typeof DecompressionStream !== 'undefined') {
          const ds = new DecompressionStream('deflate-raw');
          const writer = ds.writable.getWriter();
          writer.write(slice).catch(() => {});
          writer.close().catch(() => {});
          const outBuffer = await new Response(ds.readable).arrayBuffer();
          files[entryName] = new TextDecoder().decode(outBuffer);
        }
      } catch {
        // Ignore individual corrupt entry
      }
    }
    offset = dataEnd;
  }

  const sharedStrings: string[] = [];
  if (files['xl/sharedStrings.xml']) {
    const siMatches = files['xl/sharedStrings.xml'].match(/<si[\s\S]*?<\/si>/g) || [];
    for (const si of siMatches) {
      const tMatches = Array.from(si.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)).map((m) => m[1]);
      sharedStrings.push(
        tMatches
          .join('')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
      );
    }
  }

  const sheetXml =
    files['xl/worksheets/sheet1.xml'] ||
    Object.entries(files).find(([k]) => k.startsWith('xl/worksheets/sheet'))?.[1];

  if (!sheetXml) return [];

  const rows: string[][] = [];
  const rowMatches = sheetXml.match(/<row[\s\S]*?<\/row>/g) || [];
  for (const rowXml of rowMatches) {
    const cells: string[] = [];
    const cellMatches = rowXml.match(/<c[\s\S]*?(?:<\/c>|\/>)/g) || [];
    for (const cellXml of cellMatches) {
      const typeMatch = cellXml.match(/\bt="([^"]+)"/);
      const cellType = typeMatch ? typeMatch[1] : '';
      const vMatch = cellXml.match(/<v>([\s\S]*?)<\/v>/);
      const inlineMatch = cellXml.match(/<t[^>]*>([\s\S]*?)<\/t>/);
      let val = '';
      if (cellType === 's' && vMatch) {
        const idx = parseInt(vMatch[1], 10);
        val = sharedStrings[idx] ?? vMatch[1];
      } else if (inlineMatch) {
        val = inlineMatch[1];
      } else if (vMatch) {
        val = vMatch[1];
      }
      cells.push(
        val
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .trim()
      );
    }
    if (cells.some((c) => c.length > 0)) {
      rows.push(cells);
    }
  }

  return rows;
}

/**
 * Extracts rows from HTML-based XLS or CSV/TSV text.
 */
function extractRowsFromTextOrHtml(rawText: string): string[][] {
  const trimmed = rawText.trim();
  if (trimmed.includes('<table') || trimmed.includes('<tr')) {
    const rows: string[][] = [];
    const trMatches = trimmed.match(/<tr[\s\S]*?<\/tr>/gi) || [];
    for (const tr of trMatches) {
      const tdMatches = Array.from(tr.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)).map((m) =>
        m[1]
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/\s+/g, ' ')
          .trim()
      );
      if (tdMatches.some((c) => c.length > 0)) {
        rows.push(tdMatches);
      }
    }
    if (rows.length > 0) return rows;
  }

  const lines = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const sample = lines.slice(0, 10).join('\n');
  const delimiter = sample.includes('\t')
    ? '\t'
    : sample.split(';').length > sample.split(',').length
    ? ';'
    : ',';

  return lines.map((line) => splitCsvLine(line, delimiter));
}

export function detectColumnsFromHeaders(headers: string[]): StatementColumnMapping {
  const lower = headers.map((h) => h.toLowerCase().trim());
  const dateIdx = lower.findIndex(
    (h) => h.includes('txn date') || h.includes('transaction date') || h === 'date' || h.includes('value date')
  );
  const valueDateIdx = lower.findIndex((h) => h.includes('value date'));
  const descIdx = lower.findIndex(
    (h) =>
      h.includes('description') ||
      h.includes('narration') ||
      h.includes('particulars') ||
      h.includes('remarks') ||
      h.includes('details')
  );
  const refIdx = lower.findIndex(
    (h) => h.includes('chq') || h.includes('ref') || h.includes('utr') || h.includes('cheque')
  );
  const debitIdx = lower.findIndex(
    (h) => h.includes('withdrawal') || h.includes('debit') || h === 'dr' || h.includes('dr amount')
  );
  const creditIdx = lower.findIndex(
    (h) => h.includes('deposit') || h.includes('credit') || h === 'cr' || h.includes('cr amount')
  );
  const amountIdx = lower.findIndex(
    (h) =>
      (h === 'amount' || h.includes('transaction amount') || h.includes('txn amount')) &&
      debitIdx === -1 &&
      creditIdx === -1
  );
  const dirIdx = lower.findIndex(
    (h) => h === 'type' || h === 'dr/cr' || h.includes('credit/debit') || h.includes('direction')
  );
  const balIdx = lower.findIndex((h) => h.includes('balance') || h.includes('closing'));

  return {
    dateColumnIndex: dateIdx >= 0 ? dateIdx : 0,
    valueDateColumnIndex: valueDateIdx >= 0 ? valueDateIdx : undefined,
    descriptionColumnIndex: descIdx >= 0 ? descIdx : 1,
    referenceColumnIndex: refIdx >= 0 ? refIdx : undefined,
    debitColumnIndex: debitIdx >= 0 ? debitIdx : amountIdx === -1 ? 2 : undefined,
    creditColumnIndex: creditIdx >= 0 ? creditIdx : amountIdx === -1 ? 3 : undefined,
    amountColumnIndex: amountIdx >= 0 ? amountIdx : undefined,
    directionColumnIndex: dirIdx >= 0 ? dirIdx : undefined,
    balanceColumnIndex: balIdx >= 0 ? balIdx : 4,
  };
}

/**
 * Prepares a complete, truthful StatementImportPreview (valid, invalid, and duplicate rows)
 * without writing anything to the database until the user confirms.
 */
export async function prepareStatementImportPreview(
  source: ImportInputSource,
  existingTransactions: TransactionRecord[],
  existingStatements: StatementImportRecord[],
  defaultAccountName = 'Primary Savings Account',
  columnMapOverride?: StatementColumnMapping
): Promise<StatementImportPreview> {
  const lowerName = source.fileName.toLowerCase();
  const hasPdfMagic =
    (source.fileBuffer &&
      source.fileBuffer.length >= 4 &&
      source.fileBuffer[0] === 0x25 && // %
      source.fileBuffer[1] === 0x50 && // P
      source.fileBuffer[2] === 0x44 && // D
      source.fileBuffer[3] === 0x46) || // F
    (source.rawText && source.rawText.startsWith('%PDF-'));

  const format: StatementImportPreview['format'] =
    hasPdfMagic || lowerName.endsWith('.pdf') || lowerName.includes('.pdf')
      ? 'PDF'
      : lowerName.endsWith('.xlsx')
      ? 'XLSX'
      : lowerName.endsWith('.xls')
      ? 'XLS'
      : 'CSV';

  const existingKeys = new Map<string, string>();
  for (const tx of existingTransactions) {
    const key = `${tx.date}|${tx.direction}|${tx.amountPaise}|${tx.rawDescription
      .slice(0, 32)
      .toUpperCase()}`;
    existingKeys.set(key, tx.id);
  }

  let sampleForSig = source.rawText || '';
  if (!sampleForSig && source.fileBuffer) {
    sampleForSig = new TextDecoder('latin1').decode(
      source.fileBuffer.subarray(0, Math.min(4096, source.fileBuffer.length))
    );
  }
  const fileSignature = computeFileSignature(source.fileName, source.fileSizeBytes, sampleForSig);
  const duplicateFileStatement = existingStatements.find((s) => s.fileSignature === fileSignature);

  // Handle PDF Format
  if (format === 'PDF') {
    let rawLatin1 = source.rawText || '';
    if (source.fileBuffer) {
      let s = '';
      const chunk = 0x8000;
      for (let i = 0; i < source.fileBuffer.length; i += chunk) {
        s += String.fromCharCode.apply(null, Array.from(source.fileBuffer.subarray(i, i + chunk)));
      }
      rawLatin1 = s;
    }

    if (rawLatin1.includes('/Encrypt')) {
      return {
        fileName: source.fileName,
        fileSizeBytes: source.fileSizeBytes,
        format: 'PDF',
        fileSignature,
        bankName: 'Bank Statement (PDF)',
        accountNumberMasked: 'Locked PDF',
        accountHolderName: '',
        statementPeriodStart: '',
        statementPeriodEnd: '',
        openingBalancePaise: 0,
        closingBalancePaise: 0,
        debitTotalPaise: 0,
        creditTotalPaise: 0,
        reconciliationDiffPaise: 0,
        requiresColumnMapping: false,
        detectedHeaders: [],
        sampleRawRows: [],
        columnMapping: { dateColumnIndex: 0, descriptionColumnIndex: 1 },
        candidates: [],
        isPasswordProtected: true,
        isScannedPdfWithoutText: false,
        errorMessage:
          'This PDF statement is password-protected (/Encrypt detected). Please unlock the PDF or export a CSV/Excel statement before importing.',
      };
    }

    const pdfBuffer = source.fileBuffer
      ? source.fileBuffer.buffer.slice(
          source.fileBuffer.byteOffset,
          source.fileBuffer.byteOffset + source.fileBuffer.byteLength
        )
      : new TextEncoder().encode(rawLatin1).buffer;
    const pdfMeta = await parsePdfStatementWithMeta(pdfBuffer as ArrayBuffer);
    if (pdfMeta.transactions.length === 0) {
      return {
        fileName: source.fileName,
        fileSizeBytes: source.fileSizeBytes,
        format: 'PDF',
        fileSignature,
        bankName: 'Bank of India',
        accountNumberMasked: pdfMeta.meta.accountNumber || 'Unknown',
        accountHolderName: pdfMeta.meta.accountHolder || '',
        statementPeriodStart: '',
        statementPeriodEnd: '',
        openingBalancePaise: 0,
        closingBalancePaise: 0,
        debitTotalPaise: 0,
        creditTotalPaise: 0,
        reconciliationDiffPaise: 0,
        requiresColumnMapping: false,
        detectedHeaders: [],
        sampleRawRows: [],
        columnMapping: { dateColumnIndex: 0, descriptionColumnIndex: 1 },
        candidates: [],
        isPasswordProtected: false,
        isScannedPdfWithoutText: true,
        errorMessage:
          'No machine-readable transaction rows were found in this PDF. It appears to be a scanned image-only PDF or uses an unsupported layout. Please upload a text-based PDF or use CSV/XLSX.',
      };
    }

    const seenInFile = new Set<string>();
    const candidates: StatementImportRowCandidate[] = pdfMeta.transactions.map((t, idx) => {
      const narration = t.rawNarration || '';
      const amountPaise = toPaise(t.amount);
      const balancePaise = t.balance !== null && t.balance !== undefined ? toPaise(t.balance) : null;
      const direction: TransactionDirection = t.type === 'CREDIT' ? 'CREDIT' : 'DEBIT';
      const mappedType = mapCategoryAndType(direction, t.category, narration, Boolean(t.isSelfTransfer));
      const paymentMode = mapLegacyModeToPaymentMode(t.channel, narration);
      const dedupeKey = `${t.date}|${direction}|${amountPaise}|${narration.slice(0, 32).toUpperCase()}`;
      const matchedTxId = existingKeys.get(dedupeKey);
      const isDupInFile = seenInFile.has(dedupeKey);
      seenInFile.add(dedupeKey);

      const isDuplicate = Boolean(matchedTxId || isDupInFile || duplicateFileStatement);
      const validationErrors: string[] = [];
      if (!t.date) validationErrors.push('Missing transaction date');
      if (amountPaise <= 0) validationErrors.push('Amount must be greater than zero');

      return {
        rowIndex: idx + 1,
        rawCells: [
          t.date,
          narration,
          direction === 'DEBIT' ? String(t.amount) : '',
          direction === 'CREDIT' ? String(t.amount) : '',
          t.balance !== null && t.balance !== undefined ? String(t.balance) : '',
        ],
        isValid: validationErrors.length === 0,
        validationErrors,
        isDuplicate,
        duplicateReason: duplicateFileStatement
          ? `Statement file "${duplicateFileStatement.fileName}" was already imported`
          : matchedTxId
          ? 'Matches an existing transaction on date, amount, and description'
          : isDupInFile
          ? 'Identical row repeated in the same statement file'
          : undefined,
        duplicateOfTransactionId: matchedTxId,
        selectedForImport: validationErrors.length === 0 && !isDuplicate,
        date: t.date,
        amountPaise,
        direction,
        transactionType: mappedType.type,
        category: mappedType.category,
        subCategory: mappedType.subCategory,
        counterpartyName: t.counterparty || 'Unknown Counterparty',
        upiId: t.upiId || '',
        referenceNumber: t.referenceNo || '',
        paymentMode,
        rawDescription: narration,
        runningBalancePaise: balancePaise,
        confidenceScore: 95,
      };
    });

    const validCandidates = candidates.filter((c) => c.isValid);
    const debitTotalPaise = validCandidates
      .filter((c) => c.direction === 'DEBIT')
      .reduce((acc, c) => acc + c.amountPaise, 0);
    const creditTotalPaise = validCandidates
      .filter((c) => c.direction === 'CREDIT')
      .reduce((acc, c) => acc + c.amountPaise, 0);

    const sortedByDate = [...validCandidates].sort((a, b) => a.date.localeCompare(b.date));
    const firstRow = validCandidates[0];
    const lastRow = validCandidates[validCandidates.length - 1];

    let openingBalancePaise = 0;
    let closingBalancePaise = 0;
    if (firstRow && firstRow.runningBalancePaise !== null) {
      openingBalancePaise =
        firstRow.direction === 'DEBIT'
          ? firstRow.runningBalancePaise + firstRow.amountPaise
          : firstRow.runningBalancePaise - firstRow.amountPaise;
    }
    if (lastRow && lastRow.runningBalancePaise !== null) {
      closingBalancePaise = lastRow.runningBalancePaise;
    }
    const expectedClosing = openingBalancePaise + creditTotalPaise - debitTotalPaise;
    const reconciliationDiffPaise =
      lastRow && lastRow.runningBalancePaise !== null ? closingBalancePaise - expectedClosing : 0;

    return {
      fileName: source.fileName,
      fileSizeBytes: source.fileSizeBytes,
      format: 'PDF',
      fileSignature,
      bankName: 'Bank of India',
      accountNumberMasked: pdfMeta.meta.accountNumber || 'XXXX8696',
      accountHolderName: pdfMeta.meta.accountHolder || '',
      ifscCode: pdfMeta.meta.ifsc,
      branchName: pdfMeta.meta.branchName,
      statementPeriodStart: sortedByDate[0]?.date || '',
      statementPeriodEnd: sortedByDate[sortedByDate.length - 1]?.date || '',
      openingBalancePaise,
      closingBalancePaise,
      debitTotalPaise,
      creditTotalPaise,
      reconciliationDiffPaise,
      requiresColumnMapping: false,
      detectedHeaders: ['Date', 'Particulars / Narration', 'Debit', 'Credit', 'Balance'],
      sampleRawRows: candidates.slice(0, 6).map((c) => c.rawCells),
      columnMapping: {
        dateColumnIndex: 0,
        descriptionColumnIndex: 1,
        debitColumnIndex: 2,
        creditColumnIndex: 3,
        balanceColumnIndex: 4,
      },
      candidates,
      isPasswordProtected: false,
      isScannedPdfWithoutText: false,
    };
  }

  // Handle CSV / XLS / XLSX
  let rawRows: string[][] = [];
  if (format === 'XLSX' && source.fileBuffer) {
    rawRows = await extractRowsFromXlsxBuffer(source.fileBuffer);
  }
  if (rawRows.length === 0) {
    const text =
      source.rawText ||
      (source.fileBuffer ? new TextDecoder('utf-8').decode(source.fileBuffer) : '');
    rawRows = extractRowsFromTextOrHtml(text);
  }

  if (rawRows.length === 0) {
    return {
      fileName: source.fileName,
      fileSizeBytes: source.fileSizeBytes,
      format,
      fileSignature,
      bankName: 'Bank Statement',
      accountNumberMasked: 'Unknown',
      accountHolderName: '',
      statementPeriodStart: '',
      statementPeriodEnd: '',
      openingBalancePaise: 0,
      closingBalancePaise: 0,
      debitTotalPaise: 0,
      creditTotalPaise: 0,
      reconciliationDiffPaise: 0,
      requiresColumnMapping: false,
      detectedHeaders: [],
      sampleRawRows: [],
      columnMapping: { dateColumnIndex: 0, descriptionColumnIndex: 1 },
      candidates: [],
      isPasswordProtected: false,
      isScannedPdfWithoutText: false,
      errorMessage: 'The uploaded file appears to be empty or corrupted.',
    };
  }

  // Locate header row
  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(rawRows.length, 25); i++) {
    const joined = rawRows[i].join(' ').toLowerCase();
    if (
      joined.includes('date') &&
      (joined.includes('narration') ||
        joined.includes('particulars') ||
        joined.includes('description') ||
        joined.includes('remarks') ||
        joined.includes('amount') ||
        joined.includes('debit') ||
        joined.includes('withdrawal'))
    ) {
      headerRowIdx = i;
      break;
    }
  }

  const detectedHeaders = rawRows[headerRowIdx] || [];
  const mapping = columnMapOverride || detectColumnsFromHeaders(detectedHeaders);
  const dataRows = rawRows.slice(headerRowIdx + 1);

  const seenInFile = new Set<string>();
  const candidates: StatementImportRowCandidate[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const cells = dataRows[i];
    if (!cells || cells.every((c) => !c || !c.trim())) continue;

    const rawDate = cells[mapping.dateColumnIndex] || '';
    const rawDesc = cells[mapping.descriptionColumnIndex] || '';
    const rawRef =
      mapping.referenceColumnIndex !== undefined ? cells[mapping.referenceColumnIndex] || '' : '';
    const rawBal =
      mapping.balanceColumnIndex !== undefined ? cells[mapping.balanceColumnIndex] || '' : '';

    // Skip obvious footer summary lines if both date and amount are missing
    const normalizedDate = normalizeDate(rawDate);
    let debitVal = 0;
    let creditVal = 0;

    if (mapping.amountColumnIndex !== undefined) {
      const amt = parseIndianAmount(cells[mapping.amountColumnIndex] || '');
      const dirCell =
        mapping.directionColumnIndex !== undefined
          ? (cells[mapping.directionColumnIndex] || '').toUpperCase()
          : '';
      if (dirCell.includes('CR') || dirCell.includes('CREDIT') || dirCell === 'C') {
        creditVal = Math.abs(amt);
      } else if (dirCell.includes('DR') || dirCell.includes('DEBIT') || dirCell === 'D') {
        debitVal = Math.abs(amt);
      } else if (amt < 0) {
        debitVal = Math.abs(amt);
      } else {
        // Check narration hints
        if (/\/CR\/|\bCREDIT\b|\bSAL\b|\bREFUND\b/i.test(rawDesc)) {
          creditVal = Math.abs(amt);
        } else {
          debitVal = Math.abs(amt);
        }
      }
    } else {
      debitVal =
        mapping.debitColumnIndex !== undefined
          ? Math.abs(parseIndianAmount(cells[mapping.debitColumnIndex] || ''))
          : 0;
      creditVal =
        mapping.creditColumnIndex !== undefined
          ? Math.abs(parseIndianAmount(cells[mapping.creditColumnIndex] || ''))
          : 0;
    }

    const validationErrors: string[] = [];
    if (!normalizedDate) {
      validationErrors.push(`Invalid or unparsed date "${rawDate || 'empty'}"`);
    }
    const amountVal = creditVal > 0 ? creditVal : debitVal;
    const amountPaise = toPaise(amountVal);
    if (amountPaise <= 0) {
      validationErrors.push('Missing or zero transaction amount');
    }
    if (!rawDesc.trim()) {
      validationErrors.push('Missing transaction description/narration');
    }

    const direction: TransactionDirection = creditVal > 0 && debitVal === 0 ? 'CREDIT' : 'DEBIT';
    const parsedNarration = parseBankNarration(
      rawDesc || 'Unlabeled Transaction',
      direction
    );
    const mappedType = mapCategoryAndType(
      direction,
      parsedNarration.category,
      rawDesc,
      parsedNarration.isSelfTransfer
    );
    const paymentMode = mapLegacyModeToPaymentMode(parsedNarration.channel, rawDesc);

    const balanceNum = rawBal ? parseIndianAmount(rawBal) : null;
    const runningBalancePaise =
      balanceNum !== null && rawBal.trim() !== '' ? toPaise(balanceNum) : null;

    const dedupeKey = `${normalizedDate || 'INVALID'}|${direction}|${amountPaise}|${rawDesc
      .slice(0, 32)
      .toUpperCase()}`;
    const matchedTxId = existingKeys.get(dedupeKey);
    const isDupInFile = seenInFile.has(dedupeKey);
    if (validationErrors.length === 0) {
      seenInFile.add(dedupeKey);
    }

    const isDuplicate = Boolean(matchedTxId || isDupInFile || duplicateFileStatement);

    candidates.push({
      rowIndex: headerRowIdx + i + 2,
      rawCells: cells,
      isValid: validationErrors.length === 0,
      validationErrors,
      isDuplicate,
      duplicateReason: duplicateFileStatement
        ? `File "${duplicateFileStatement.fileName}" was already imported`
        : matchedTxId
        ? 'Matches an existing transaction in your ledger'
        : isDupInFile
        ? 'Repeated identical row within this file'
        : undefined,
      duplicateOfTransactionId: matchedTxId,
      selectedForImport: validationErrors.length === 0 && !isDuplicate,
      date: normalizedDate || new Date().toISOString().slice(0, 10),
      amountPaise,
      direction,
      transactionType: mappedType.type,
      category: mappedType.category,
      subCategory: mappedType.subCategory,
      counterpartyName: parsedNarration.counterparty || 'Unknown Counterparty',
      upiId: parsedNarration.upiId || '',
      referenceNumber: rawRef || parsedNarration.referenceNo || '',
      paymentMode,
      rawDescription: rawDesc,
      runningBalancePaise,
      confidenceScore: 95,
    });
  }

  const validCandidates = candidates.filter((c) => c.isValid);
  const debitTotalPaise = validCandidates
    .filter((c) => c.direction === 'DEBIT')
    .reduce((acc, c) => acc + c.amountPaise, 0);
  const creditTotalPaise = validCandidates
    .filter((c) => c.direction === 'CREDIT')
    .reduce((acc, c) => acc + c.amountPaise, 0);

  const sortedByDate = [...validCandidates].sort((a, b) => a.date.localeCompare(b.date));
  const firstRow = validCandidates[0];
  const lastRow = validCandidates[validCandidates.length - 1];

  let openingBalancePaise = 0;
  let closingBalancePaise = 0;
  if (firstRow && firstRow.runningBalancePaise !== null) {
    openingBalancePaise =
      firstRow.direction === 'DEBIT'
        ? firstRow.runningBalancePaise + firstRow.amountPaise
        : firstRow.runningBalancePaise - firstRow.amountPaise;
  }
  if (lastRow && lastRow.runningBalancePaise !== null) {
    closingBalancePaise = lastRow.runningBalancePaise;
  }
  const expectedClosing = openingBalancePaise + creditTotalPaise - debitTotalPaise;
  const reconciliationDiffPaise =
    lastRow && lastRow.runningBalancePaise !== null ? closingBalancePaise - expectedClosing : 0;

  return {
    fileName: source.fileName,
    fileSizeBytes: source.fileSizeBytes,
    format,
    fileSignature,
    bankName: 'Bank of India / CSV Statement',
    accountNumberMasked: 'XXXX8696',
    accountHolderName: '',
    statementPeriodStart: sortedByDate[0]?.date || '',
    statementPeriodEnd: sortedByDate[sortedByDate.length - 1]?.date || '',
    openingBalancePaise,
    closingBalancePaise,
    debitTotalPaise,
    creditTotalPaise,
    reconciliationDiffPaise,
    requiresColumnMapping: validCandidates.length === 0 && candidates.length > 0,
    detectedHeaders,
    sampleRawRows: rawRows.slice(headerRowIdx, headerRowIdx + 6),
    columnMapping: mapping,
    candidates,
    isPasswordProtected: false,
    isScannedPdfWithoutText: false,
  };
}

/**
 * Commits the user-approved StatementImportPreview rows into a FullDatabaseSnapshot.
 */
export function commitImportPreviewToSnapshot(
  snapshot: FullDatabaseSnapshot,
  preview: StatementImportPreview,
  targetAccountId: string
): {
  updatedSnapshot: FullDatabaseSnapshot;
  importedStatement: StatementImportRecord;
  importedTransactions: TransactionRecord[];
} {
  const nowIso = new Date().toISOString();
  const statementId = `stmt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const selectedRows = preview.candidates.filter((c) => c.selectedForImport && c.isValid);
  const invalidRows = preview.candidates.filter((c) => !c.isValid);
  const duplicateRows = preview.candidates.filter((c) => c.isDuplicate && !c.selectedForImport);

  const importedTransactions: TransactionRecord[] = selectedRows.map((row, idx) => ({
    id: `tx-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
    date: row.date,
    amountPaise: row.amountPaise,
    direction: row.direction,
    transactionType: row.transactionType,
    category: row.category,
    subCategory: row.subCategory,
    counterpartyName: row.counterpartyName,
    upiId: row.upiId,
    referenceNumber: row.referenceNumber,
    paymentMode: row.paymentMode,
    accountId: targetAccountId,
    statementId,
    rawDescription: row.rawDescription,
    userNotes: '',
    tags: [],
    runningBalancePaise: row.runningBalancePaise,
    confidenceScore: row.confidenceScore,
    isEdited: false,
    isSplitParent: false,
    isFlaggedAnomaly: false,
    createdAt: nowIso,
    updatedAt: nowIso,
  }));

  const importedStatement: StatementImportRecord = {
    id: statementId,
    fileName: preview.fileName,
    fileFormat: preview.format,
    fileSizeBytes: preview.fileSizeBytes,
    fileSignature: preview.fileSignature,
    accountId: targetAccountId,
    bankName: preview.bankName,
    accountNumberMasked: preview.accountNumberMasked,
    accountHolderName: preview.accountHolderName,
    ifscCode: preview.ifscCode,
    branchName: preview.branchName,
    statementPeriodStart: preview.statementPeriodStart,
    statementPeriodEnd: preview.statementPeriodEnd,
    importedAt: nowIso,
    totalRowsParsed: preview.candidates.length,
    validRowsImported: importedTransactions.length,
    duplicateRowsSkipped: duplicateRows.length,
    invalidRowsRejected: invalidRows.length,
    openingBalancePaise: preview.openingBalancePaise,
    closingBalancePaise: preview.closingBalancePaise,
    debitTotalPaise: preview.debitTotalPaise,
    creditTotalPaise: preview.creditTotalPaise,
    reconciliationStatus:
      Math.abs(preview.reconciliationDiffPaise) <= 100
        ? 'RECONCILED'
        : preview.closingBalancePaise === 0 && preview.openingBalancePaise === 0
        ? 'UNVERIFIED'
        : 'MISMATCH',
    reconciliationDifferencePaise: preview.reconciliationDiffPaise,
    transactionIds: importedTransactions.map((t) => t.id),
  };

  // Update target account metadata if this is the first statement or provides richer BOI details
  const updatedAccounts = snapshot.accounts.map((acc) => {
    if (acc.id !== targetAccountId) return acc;
    const isFirstStatementForAccount = !snapshot.statements.some((s) => s.accountId === targetAccountId);
    return {
      ...acc,
      bankName: preview.bankName || acc.bankName,
      accountNumberMasked:
        preview.accountNumberMasked && preview.accountNumberMasked !== 'Unknown'
          ? preview.accountNumberMasked
          : acc.accountNumberMasked,
      ifscCode: preview.ifscCode || acc.ifscCode,
      branchName: preview.branchName || acc.branchName,
      openingBalancePaise: isFirstStatementForAccount
        ? preview.openingBalancePaise
        : acc.openingBalancePaise,
      openingBalanceDate:
        isFirstStatementForAccount && preview.statementPeriodStart
          ? preview.statementPeriodStart
          : acc.openingBalanceDate,
      lastStatementClosingBalancePaise:
        preview.closingBalancePaise !== 0
          ? preview.closingBalancePaise
          : acc.lastStatementClosingBalancePaise,
      lastStatementClosingDate: preview.statementPeriodEnd || acc.lastStatementClosingDate,
    };
  });

  // Auto-apply active classification rules to newly imported transactions
  const activeRules = [...snapshot.rules]
    .filter((r) => r.isActive)
    .sort((a, b) => a.priority - b.priority);

  const ruleProcessedTransactions = importedTransactions.map((tx) => {
    let updated = { ...tx };
    for (const rule of activeRules) {
      let allMatch = true;
      for (const cond of rule.conditions) {
        const val = cond.value.toLowerCase();
        if (cond.field === 'DESCRIPTION') {
          const d = updated.rawDescription.toLowerCase();
          if (cond.operator === 'CONTAINS' && !d.includes(val)) allMatch = false;
          if (cond.operator === 'EQUALS' && d !== val) allMatch = false;
          if (cond.operator === 'STARTS_WITH' && !d.startsWith(val)) allMatch = false;
        } else if (cond.field === 'COUNTERPARTY') {
          const c = updated.counterpartyName.toLowerCase();
          if (cond.operator === 'CONTAINS' && !c.includes(val)) allMatch = false;
          if (cond.operator === 'EQUALS' && c !== val) allMatch = false;
        }
      }
      if (allMatch) {
        if (rule.actions.setCategory) updated.category = rule.actions.setCategory;
        if (rule.actions.setSubCategory) updated.subCategory = rule.actions.setSubCategory;
        if (rule.actions.setTransactionType) updated.transactionType = rule.actions.setTransactionType;
        if (rule.actions.normalizeCounterparty)
          updated.counterpartyName = rule.actions.normalizeCounterparty;
        if (rule.actions.addTags && rule.actions.addTags.length > 0) {
          updated.tags = Array.from(new Set([...updated.tags, ...rule.actions.addTags]));
        }
      }
    }
    return updated;
  });

  const auditEntry = {
    id: `audit-${Date.now()}`,
    timestamp: nowIso,
    actionType: 'STATEMENT_IMPORT' as const,
    summary: `Imported ${ruleProcessedTransactions.length} transactions from "${preview.fileName}"`,
    UndoPayloadJson: JSON.stringify({
      statementId,
      transactionIds: ruleProcessedTransactions.map((t) => t.id),
    }),
  };

  return {
    importedStatement,
    importedTransactions: ruleProcessedTransactions,
    updatedSnapshot: {
      ...snapshot,
      accounts: updatedAccounts,
      statements: [importedStatement, ...snapshot.statements],
      transactions: [...ruleProcessedTransactions, ...snapshot.transactions],
      auditTrail: [auditEntry, ...snapshot.auditTrail].slice(0, 200),
    },
  };
}

/**
 * Rolls back a statement import and optionally removes transactions exclusive to that statement.
 */
export function rollbackStatementImport(
  snapshot: FullDatabaseSnapshot,
  statementId: string,
  removeTransactions = true
): FullDatabaseSnapshot {
  const targetStmt = snapshot.statements.find((s) => s.id === statementId);
  if (!targetStmt) return snapshot;

  const remainingStatements = snapshot.statements.filter((s) => s.id !== statementId);
  const remainingTransactions = removeTransactions
    ? snapshot.transactions.filter((t) => t.statementId !== statementId)
    : snapshot.transactions;

  const auditEntry = {
    id: `audit-${Date.now()}`,
    timestamp: new Date().toISOString(),
    actionType: 'STATEMENT_ROLLBACK' as const,
    summary: `Rolled back statement "${targetStmt.fileName}" (${targetStmt.validRowsImported} transactions removed)`,
  };

  return {
    ...snapshot,
    statements: remainingStatements,
    transactions: remainingTransactions,
    auditTrail: [auditEntry, ...snapshot.auditTrail].slice(0, 200),
  };
}

/**
 * Exports transactions to standard CSV format.
 */
export function exportTransactionsToCsv(transactions: TransactionRecord[]): string {
  const headers = [
    'Transaction ID',
    'Date',
    'Direction',
    'Transaction Type',
    'Amount (INR)',
    'Category',
    'Sub-Category',
    'Counterparty / Person / Merchant',
    'UPI ID',
    'Payment Mode',
    'Reference / UTR',
    'Running Balance (INR)',
    'Tags',
    'Raw Bank Narration',
    'User Notes',
  ];

  const escapeCsv = (val: string | number | null | undefined) => {
    const s = String(val ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const rows = transactions.map((tx) =>
    [
      tx.id,
      tx.date,
      tx.direction,
      tx.transactionType,
      fromPaise(tx.amountPaise).toFixed(2),
      tx.category,
      tx.subCategory,
      tx.counterpartyName,
      tx.upiId,
      tx.paymentMode,
      tx.referenceNumber,
      tx.runningBalancePaise !== null ? fromPaise(tx.runningBalancePaise).toFixed(2) : '',
      tx.tags.join('; '),
      tx.rawDescription,
      tx.userNotes,
    ]
      .map(escapeCsv)
      .join(',')
  );

  return [headers.map(escapeCsv).join(','), ...rows].join('\n');
}

/**
 * Exports a multi-worksheet SpreadsheetML (.xls compatible with Microsoft Excel, LibreOffice, Numbers)
 * containing Summary, Transactions, Categories, and People sheets.
 */
export function exportComprehensiveExcelWorkbook(snapshot: FullDatabaseSnapshot): string {
  const esc = (s: string | number) =>
    String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  const txRowsXml = snapshot.transactions
    .map(
      (t) => `<Row>
        <Cell><Data ss:Type="String">${esc(t.date)}</Data></Cell>
        <Cell><Data ss:Type="String">${esc(t.direction)}</Data></Cell>
        <Cell><Data ss:Type="String">${esc(t.transactionType)}</Data></Cell>
        <Cell><Data ss:Type="Number">${fromPaise(t.amountPaise).toFixed(2)}</Data></Cell>
        <Cell><Data ss:Type="String">${esc(t.category)}</Data></Cell>
        <Cell><Data ss:Type="String">${esc(t.counterpartyName)}</Data></Cell>
        <Cell><Data ss:Type="String">${esc(t.paymentMode)}</Data></Cell>
        <Cell><Data ss:Type="String">${esc(t.referenceNumber)}</Data></Cell>
        <Cell><Data ss:Type="String">${esc(t.rawDescription)}</Data></Cell>
      </Row>`
    )
    .join('\n');

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Transactions">
  <Table>
   <Row>
    <Cell><Data ss:Type="String">Date</Data></Cell>
    <Cell><Data ss:Type="String">Direction</Data></Cell>
    <Cell><Data ss:Type="String">Type</Data></Cell>
    <Cell><Data ss:Type="String">Amount (INR)</Data></Cell>
    <Cell><Data ss:Type="String">Category</Data></Cell>
    <Cell><Data ss:Type="String">Counterparty</Data></Cell>
    <Cell><Data ss:Type="String">Mode</Data></Cell>
    <Cell><Data ss:Type="String">Reference</Data></Cell>
    <Cell><Data ss:Type="String">Narration</Data></Cell>
   </Row>
   ${txRowsXml}
  </Table>
 </Worksheet>
</Workbook>`;
}

/**
 * Generates a clean HTML financial report string for print / PDF export.
 */
export function buildPrintableReportHtml(
  snapshot: FullDatabaseSnapshot,
  periodLabel: string,
  totalCreditPaise: number,
  totalDebitPaise: number,
  identifiedIncomePaise: number,
  identifiedExpensesPaise: number
): string {
  const rowsHtml = snapshot.transactions
    .slice(0, 250)
    .map(
      (tx) => `<tr>
        <td>${tx.date}</td>
        <td>${tx.counterpartyName}</td>
        <td>${tx.category}</td>
        <td>${tx.paymentMode}</td>
        <td style="text-align:right;color:${tx.direction === 'CREDIT' ? '#047857' : '#be123c'};font-weight:600;">
          ${tx.direction === 'CREDIT' ? '+' : '-'}${formatINRPaise(tx.amountPaise)}
        </td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>ArthaLedger — Financial Report (${periodLabel})</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; color: #0f172a; margin: 24px; }
    h1 { font-size: 20px; margin-bottom: 4px; }
    .meta { color: #475569; font-size: 12px; margin-bottom: 16px; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
    .card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; }
    .card-label { font-size: 11px; color: #64748b; text-transform: uppercase; }
    .card-val { font-size: 16px; font-weight: 700; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border-bottom: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; }
    th { background: #f8fafc; font-weight: 600; }
  </style>
</head>
<body>
  <h1>ArthaLedger — Financial Report</h1>
  <div class="meta">Reporting Period: ${periodLabel} • Generated Locally on ${new Date().toLocaleString('en-IN')}</div>
  <div class="grid">
    <div class="card"><div class="card-label">Total Credit</div><div class="card-val" style="color:#047857">${formatINRPaise(totalCreditPaise)}</div></div>
    <div class="card"><div class="card-label">Total Debit</div><div class="card-val" style="color:#be123c">${formatINRPaise(totalDebitPaise)}</div></div>
    <div class="card"><div class="card-label">Identified Income</div><div class="card-val">${formatINRPaise(identifiedIncomePaise)}</div></div>
    <div class="card"><div class="card-label">Identified Expenses</div><div class="card-val">${formatINRPaise(identifiedExpensesPaise)}</div></div>
  </div>
  <table>
    <thead>
      <tr><th>Date</th><th>Counterparty</th><th>Category</th><th>Mode</th><th style="text-align:right">Amount</th></tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
</body>
</html>`;
}
