import { useState } from 'react';

const scenarios = {
  sales: {
    label: 'Territory sales',
    question: 'Which territory has the best lead-to-sale conversion rate? Report the denominator.',
    fields: ['lead_id', 'month', 'territory', 'converted', 'revenue'],
  },
  payments: {
    label: 'Merchant payments',
    question: 'Which territory has the highest share of active merchants? Compare transaction totals separately.',
    fields: ['merchant_id', 'month', 'territory', 'active', 'transactions'],
  },
  marketing: {
    label: 'Marketing campaigns',
    question: 'Which territory has the highest overall ROAS? Use total revenue divided by total spend.',
    fields: ['campaign_id', 'month', 'territory', 'spend', 'revenue'],
  },
};

type Scenario = keyof typeof scenarios;
type Cell = string | number | null;
const territories = ['Coastal', 'Central', 'North', 'South'];

export function generateSyntheticRows(scenario: Scenario, count: number, seed: number, dirty: boolean) {
  if (!Number.isInteger(count) || count < 20 || count > 1000) throw new Error('Choose 20–1,000 rows.');
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const fields = scenarios[scenario].fields;
  const rows: Record<string, Cell>[] = [];
  for (let index = 0; index < count; index++) {
    const region = Math.floor(random() * territories.length);
    const month = (index % 12) + 1;
    const seasonalBoost = month >= 9 ? 1.3 : 1;
    const converted = random() < (0.32 + region * 0.07) * seasonalBoost ? 1 : 0;
    const volume = Math.round((100 + random() * 900) * seasonalBoost);
    const [first, second] = scenario === 'marketing'
      ? [volume, Math.round(volume * (0.6 + random() * 3))]
      : [converted, converted * volume * (scenario === 'sales' ? 10 : 1)];
    const row: Record<string, Cell> = {
      [fields[0]]: index + 1, month, territory: territories[region], [fields[3]]: first, [fields[4]]: second,
    };
    if (dirty && index % 17 === 5) row.territory = null;
    if (dirty && index % 19 === 9) row[fields[4]] = 999_999;
    if (dirty && index % 23 === 12) row.month = 'unknown';
    rows.push(dirty && index % 29 === 18 ? { ...rows[index - 1] } : row);
  }
  return rows;
}

export function SyntheticDatasetGenerator() {
  const [scenario, setScenario] = useState<Scenario>('sales');
  const [count, setCount] = useState(120);
  const [seed, setSeed] = useState(2026);
  const [dirty, setDirty] = useState(false);

  return <details className="rounded-lg border border-slate-300 dark:border-slate-800 p-4">
    <summary className="cursor-pointer font-semibold text-sm">Generate a synthetic dataset</summary>
    <form className="mt-3 space-y-3 text-sm" onSubmit={event => {
      event.preventDefault();
      const data = generateSyntheticRows(scenario, count, seed, dirty);
      const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `synthetic_${scenario}_${seed}${dirty ? '_dirty' : ''}.json`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }}>
      <div className="flex flex-wrap items-center gap-3">
        <label>Scenario <select className="p-1 border rounded bg-transparent" value={scenario} onChange={event => setScenario(event.target.value as Scenario)}>
          {Object.entries(scenarios).map(([id, entry]) => <option key={id} value={id}>{entry.label}</option>)}
        </select></label>
        <label>Rows <input className="w-20 p-1 border rounded bg-transparent" type="number" min={20} max={1000} required value={count || ''} onChange={event => setCount(event.target.valueAsNumber || 0)} /></label>
        <label>Seed <input className="w-24 p-1 border rounded bg-transparent" type="number" min={0} max={4294967295} required value={Number.isNaN(seed) ? '' : seed} onChange={event => setSeed(event.target.valueAsNumber)} /></label>
        <label><input type="checkbox" checked={dirty} onChange={event => setDirty(event.target.checked)} /> Add data quality issues</label>
      </div>
      <p>{scenarios[scenario].question}</p>
      <p className="text-slate-500">The file is generated in your browser. Upload it above to practice across studios.</p>
      <button className="px-3 py-2 rounded-md bg-blue-600 text-white" type="submit">Download synthetic JSON</button>
    </form>
  </details>;
}
