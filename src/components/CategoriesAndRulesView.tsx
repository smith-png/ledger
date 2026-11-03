import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  FolderKanban,
  GitMerge,
  Play,
  Plus,
  Sparkles,
  Tag,
  Trash2,
  Wand2,
} from 'lucide-react';
import {
  CategoryDefinition,
  ClassificationRule,
  FullDatabaseSnapshot,
  ReportingPeriod,
  TransactionRecord,
  TransactionType,
} from '../types/finance';
import { formatINRPaise, previewClassificationRule, toPaise } from '../services/financeEngine';

interface CategoriesAndRulesViewProps {
  snapshot: FullDatabaseSnapshot;
  period: ReportingPeriod;
  periodTransactions: TransactionRecord[];
  onAddCategory: (cat: Omit<CategoryDefinition, 'id'>) => void;
  onMergeOrDeleteCategory: (sourceCategoryName: string, targetCategoryName: string) => void;
  onSaveRuleAndApply: (rule: ClassificationRule, applyToExisting: boolean) => void;
  onDeleteRule: (ruleId: string) => void;
  onSelectCategoryFilter: (category: string) => void;
}

export const CategoriesAndRulesView: React.FC<CategoriesAndRulesViewProps> = ({
  snapshot,
  period,
  periodTransactions,
  onAddCategory,
  onMergeOrDeleteCategory,
  onSaveRuleAndApply,
  onDeleteRule,
  onSelectCategoryFilter,
}) => {
  // New Category form state
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState<'EXPENSE' | 'INCOME' | 'TRANSFER' | 'BOTH'>('EXPENSE');
  const [newCatColor, setNewCatColor] = useState('#2563eb');
  const [newCatSubs, setNewCatSubs] = useState('');

  // Merge Category state
  const [mergeSourceCat, setMergeSourceCat] = useState('');
  const [mergeTargetCat, setMergeTargetCat] = useState('Uncategorized');

  // Rule Builder state (Section 12)
  const [ruleName, setRuleName] = useState('');
  const [condField, setCondField] = useState<'DESCRIPTION' | 'COUNTERPARTY' | 'UPI_ID'>('DESCRIPTION');
  const [condOp, setCondOp] = useState<'CONTAINS' | 'EQUALS' | 'STARTS_WITH'>('CONTAINS');
  const [condValue, setCondValue] = useState('');
  const [actionCategory, setActionCategory] = useState('Food & Dining');
  const [actionSubCategory, setActionSubCategory] = useState('');
  const [actionCounterparty, setActionCounterparty] = useState('');
  const [actionTags, setActionTags] = useState('');

  const draftRule: ClassificationRule = useMemo(
    () => ({
      id: 'draft-preview',
      name: ruleName || 'Live Preview Rule',
      isActive: true,
      priority: snapshot.rules.length + 1,
      conditions: condValue.trim()
        ? [
            {
              field: condField,
              operator: condOp,
              value: condValue.trim(),
            },
          ]
        : [],
      actions: {
        setCategory: actionCategory || undefined,
        setSubCategory: actionSubCategory.trim() || undefined,
        normalizeCounterparty: actionCounterparty.trim() || undefined,
        addTags: actionTags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      },
      createdAt: new Date().toISOString(),
    }),
    [
      ruleName,
      snapshot.rules.length,
      condField,
      condOp,
      condValue,
      actionCategory,
      actionSubCategory,
      actionCounterparty,
      actionTags,
    ]
  );

  // Live Rule Preview (Section 12)
  const matchingTransactionsForDraft = useMemo(() => {
    if (!condValue.trim()) return [];
    return previewClassificationRule(draftRule, snapshot.transactions);
  }, [draftRule, condValue, snapshot.transactions]);

  // Category metrics in active period
  const categoryStats = useMemo(() => {
    const statsMap = new Map<
      string,
      { debitPaise: number; creditPaise: number; count: number }
    >();
    for (const tx of periodTransactions) {
      const curr = statsMap.get(tx.category) || { debitPaise: 0, creditPaise: 0, count: 0 };
      if (tx.direction === 'DEBIT') curr.debitPaise += tx.amountPaise;
      else curr.creditPaise += tx.amountPaise;
      curr.count += 1;
      statsMap.set(tx.category, curr);
    }

    return snapshot.categories.map((cat) => {
      const st = statsMap.get(cat.name) || { debitPaise: 0, creditPaise: 0, count: 0 };
      return {
        ...cat,
        ...st,
      };
    });
  }, [snapshot.categories, periodTransactions]);

  // Tag Summary (#GoaTrip, #Diwali, #TaxDeductible, etc.)
  const tagSummary = useMemo(() => {
    const map = new Map<string, { debitPaise: number; creditPaise: number; count: number }>();
    for (const tx of snapshot.transactions) {
      for (const tag of tx.tags) {
        const clean = tag.startsWith('#') ? tag : `#${tag}`;
        const curr = map.get(clean) || { debitPaise: 0, creditPaise: 0, count: 0 };
        if (tx.direction === 'DEBIT') curr.debitPaise += tx.amountPaise;
        else curr.creditPaise += tx.amountPaise;
        curr.count += 1;
        map.set(clean, curr);
      }
    }
    return Array.from(map.entries()).map(([tag, vals]) => ({ tag, ...vals }));
  }, [snapshot.transactions]);

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    onAddCategory({
      name: newCatName.trim(),
      type: newCatType,
      color: newCatColor,
      iconName: 'Tag',
      subCategories: newCatSubs
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      isSystemDefault: false,
    });
    setNewCatName('');
    setNewCatSubs('');
  };

  const handleSaveRule = (applyExisting: boolean) => {
    if (!condValue.trim()) return;
    const finalRule: ClassificationRule = {
      ...draftRule,
      id: `rule-${Date.now()}`,
      name: ruleName.trim() || `${condField} contains "${condValue.trim()}" → ${actionCategory}`,
    };
    onSaveRuleAndApply(finalRule, applyExisting);
    setRuleName('');
    setCondValue('');
    setActionSubCategory('');
    setActionCounterparty('');
    setActionTags('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FolderKanban className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span>Categories & Rules</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Categories, tags and auto-categorisation rules
          </p>
        </div>
      </div>

      {/* Category Cards Grid */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Active Categories ({categoryStats.length}) — Period: {period.label}
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {categoryStats.map((cat) => (
            <div
              key={cat.id}
              onClick={() => onSelectCategoryFilter(cat.name)}
              className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-500 bg-slate-50/50 dark:bg-slate-800/40 transition cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {cat.name}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                    {cat.count} txns
                  </span>
                </div>
                {cat.subCategories.length > 0 && (
                  <div className="text-[11px] text-slate-400 truncate mt-1">
                    {cat.subCategories.join(' • ')}
                  </div>
                )}
              </div>

              <div className="mt-3 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs font-mono">
                <span className="text-rose-600 dark:text-rose-400">
                  Out: {formatINRPaise(cat.debitPaise)}
                </span>
                {cat.creditPaise > 0 && (
                  <span className="text-emerald-600 dark:text-emerald-400">
                    In: {formatINRPaise(cat.creditPaise)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Add Custom Category & Merge Categories Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <form onSubmit={handleCreateCategory} className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Create Custom Category
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <input
                type="text"
                required
                placeholder="Category Name"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
              />
              <select
                value={newCatType}
                onChange={(e) => setNewCatType(e.target.value as typeof newCatType)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
              >
                <option value="EXPENSE">Expense</option>
                <option value="INCOME">Income</option>
                <option value="TRANSFER">Transfer</option>
                <option value="BOTH">Both</option>
              </select>
              <input
                type="text"
                placeholder="Subcategories (comma-sep)"
                value={newCatSubs}
                onChange={(e) => setNewCatSubs(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Category
              </button>
            </div>
          </form>

          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Merge / Reassign Category
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <select
                value={mergeSourceCat}
                onChange={(e) => setMergeSourceCat(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
              >
                <option value="">Select Source Category...</option>
                {snapshot.categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                value={mergeTargetCat}
                onChange={(e) => setMergeTargetCat(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
              >
                {snapshot.categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    Into: {c.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!mergeSourceCat || mergeSourceCat === mergeTargetCat}
                onClick={() => {
                  if (mergeSourceCat && mergeSourceCat !== mergeTargetCat) {
                    onMergeOrDeleteCategory(mergeSourceCat, mergeTargetCat);
                    setMergeSourceCat('');
                  }
                }}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 text-xs font-semibold disabled:opacity-40 cursor-pointer"
              >
                <GitMerge className="w-3.5 h-3.5" />
                Merge & Reassign
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Section 12: Local Classification Rule Engine with Live Rule Preview */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-blue-600" />
            <span>Local Classification Rule Builder (with Live Match Preview)</span>
          </h3>
          <p className="text-xs text-slate-500">
            Create deterministic IF/THEN rules that automatically categorize transactions, normalize merchant names, and attach tags
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
          {/* Condition */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
              1. IF Transaction Matches:
            </div>
            <select
              value={condField}
              onChange={(e) => setCondField(e.target.value as typeof condField)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
            >
              <option value="DESCRIPTION">Raw Bank Narration / Description</option>
              <option value="COUNTERPARTY">Counterparty / Payee Name</option>
              <option value="UPI_ID">UPI ID (VPA)</option>
            </select>
            <select
              value={condOp}
              onChange={(e) => setCondOp(e.target.value as typeof condOp)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
            >
              <option value="CONTAINS">Contains keyword (case-insensitive)</option>
              <option value="STARTS_WITH">Starts with</option>
              <option value="EQUALS">Exactly equals</option>
            </select>
            <input
              type="text"
              placeholder="e.g., SWIGGY or ZOMATO or JIO"
              value={condValue}
              onChange={(e) => setCondValue(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
            />
          </div>

          {/* Action */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
              2. THEN Apply Classification:
            </div>
            <select
              value={actionCategory}
              onChange={(e) => setActionCategory(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
            >
              {snapshot.categories.map((c) => (
                <option key={c.id} value={c.name}>
                  Set Category: {c.name}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Optional: Normalize Counterparty Name"
              value={actionCounterparty}
              onChange={(e) => setActionCounterparty(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
            />
            <input
              type="text"
              placeholder="Optional Tags (e.g., #FoodDelivery, #Weekend)"
              value={actionTags}
              onChange={(e) => setActionTags(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
            />
          </div>

          {/* Live Rule Preview & Save */}
          <div className="flex flex-col justify-between space-y-2">
            <div>
              <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
                3. Live Rule Preview:
              </div>
              <div className="mt-1 p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs">
                {condValue.trim() ? (
                  <div>
                    <span className="font-bold text-blue-600 dark:text-blue-400">
                      {matchingTransactionsForDraft.length} existing transactions
                    </span>{' '}
                    match <code className="font-mono">"{condValue}"</code>.
                    {matchingTransactionsForDraft.slice(0, 2).map((m) => (
                      <div key={m.id} className="text-[11px] text-slate-500 truncate mt-1">
                        • {m.date}: {m.counterpartyName} ({formatINRPaise(m.amountPaise)})
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-slate-400">
                    Type a keyword in step 1 to preview matching transactions in real time.
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!condValue.trim()}
                onClick={() => handleSaveRule(true)}
                className="flex-1 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-semibold cursor-pointer"
              >
                Save & Apply to {matchingTransactionsForDraft.length} Txns
              </button>
            </div>
          </div>
        </div>

        {/* Saved Rules List */}
        {snapshot.rules.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase text-slate-500">
              Saved Active Rules ({snapshot.rules.length})
            </h4>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {snapshot.rules.map((r) => (
                <div key={r.id} className="py-2 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-white">{r.name}</span>
                    <span className="text-slate-400 ml-2">
                      → Category: <strong>{r.actions.setCategory}</strong>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteRule(r.id)}
                    className="text-slate-400 hover:text-rose-600 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tag Summary Section */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
          <Tag className="w-4 h-4 text-blue-600" />
          <span>Custom Event & Project Tag Summary (#GoaTrip, #Diwali, #Reimbursable)</span>
        </h3>
        {tagSummary.length === 0 ? (
          <p className="text-xs text-slate-400">
            No tags assigned yet. Add tags when editing any transaction or via a classification rule above.
          </p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {tagSummary.map((t) => (
              <div
                key={t.tag}
                className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs"
              >
                <div className="font-bold text-blue-600 dark:text-blue-400">{t.tag}</div>
                <div className="font-mono text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                  {t.count} txns • Out: {formatINRPaise(t.debitPaise)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
