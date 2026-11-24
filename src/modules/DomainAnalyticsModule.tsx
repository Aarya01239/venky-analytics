import React, { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { Sparkles, Info, Download } from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { exportRowsToCsv } from '../utils/exporters';

interface DomainProps {
  domain: 'product' | 'marketing' | 'operations' | 'financial' | 'research';
}

const DOMAIN_META = {
  product: {
    title: 'Product Analytics Workspace',
    subtitle: 'Conversion funnels, cohort retention, feature adoption, churn, and Customer LTV computed from live product events.',
    table: 'product_events',
  },
  marketing: {
    title: 'Marketing Analytics Workspace',
    subtitle: 'Channel ROAS, CAC, CPL, CTR, conversion funnel efficiency, and campaign attribution computed from live campaign records.',
    table: 'marketing_campaigns',
  },
  operations: {
    title: 'Operations & Inventory Analytics',
    subtitle: 'SLA compliance %, ticket resolution velocity, defect rates, capacity utilization, and warehouse SKU reorder risk.',
    table: 'operations_sla',
  },
  financial: {
    title: 'Financial Performance & Variance Studio',
    subtitle: 'Departmental Budget vs Actual revenue/expense variance ($ and %), operating cash flow, and trend forecasting.',
    table: 'financial_ledger',
  },
  research: {
    title: 'Research & Market Intelligence Studio',
    subtitle: 'TAM/SAM/SOM market sizing, competitor benchmarking, deterministic feedback sentiment analysis, and sourced research briefs.',
    table: 'ecommerce_orders',
  },
};

export const DomainAnalyticsModule: React.FC<DomainProps> = ({ domain }) => {
  const { askGeminiWithPrompt } = useWorkspace();
  const meta = DOMAIN_META[domain];

  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [invRows, setInvRows] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(true);

  // Research Market Sizing & Sentiment Interactive Inputs
  const [tamUsers, setTamUsers] = useState(1200000);
  const [arpu, setArpu] = useState(180);
  const [samPct, setSamPct] = useState(28);
  const [somPct, setSomPct] = useState(6);
  const [feedbackText, setFeedbackText] = useState(
    'Fast delivery and great packaging, love the laptop quality.\nDelayed shipping and poor customer support response.\nGood value for money, easy checkout experience.\nReturned item because sizing was inaccurate and refund took too long.\nReliable product, smooth app performance and accurate tracking.'
  );
  const [competitors, setCompetitors] = useState([
    { name: 'Our Product', price: '$49/mo', strength: 'Unified SQL + BI + AI', gap: 'Offline desktop app' },
    { name: 'Competitor A', price: '$85/mo', strength: 'Enterprise brand trust', gap: 'Steep learning curve' },
    { name: 'Competitor B', price: '$35/mo', strength: 'Simple charting', gap: 'No real SQL or Python sandbox' },
  ]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/datasets/${meta.table}/rows?limit=2000`);
        if (res.ok) {
          const data = await res.json();
          if (active) setRows(data.rows || []);
        }
        if (domain === 'operations') {
          const invRes = await fetch('/api/datasets/inventory_sku/rows?limit=500');
          if (invRes.ok) {
            const invData = await invRes.json();
            if (active) setInvRows(invData.rows || []);
          }
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [domain, meta.table]);

  // PRODUCT COMPUTATIONS
  const productStats = useMemo(() => {
    if (domain !== 'product' || !rows.length) return null;
    const stageMap: Record<string, { order: number; entered: number; converted: number }> = {};
    const tierMap: Record<string, { m1: number[]; m3: number[]; ltv: number[]; adopt: number[] }> = {};
    for (const r of rows) {
      const st = String(r.stage);
      if (!stageMap[st]) stageMap[st] = { order: Number(r.stage_order) || 0, entered: 0, converted: 0 };
      stageMap[st].entered += Number(r.users_entered) || 0;
      stageMap[st].converted += Number(r.users_converted) || 0;

      const tier = String(r.plan_tier);
      if (!tierMap[tier]) tierMap[tier] = { m1: [], m3: [], ltv: [], adopt: [] };
      tierMap[tier].m1.push(Number(r.month1_retention_pct) || 0);
      tierMap[tier].m3.push(Number(r.month3_retention_pct) || 0);
      tierMap[tier].ltv.push(Number(r.ltv) || 0);
      tierMap[tier].adopt.push(Number(r.feature_adoption_pct) || 0);
    }
    const funnel = Object.entries(stageMap)
      .map(([stage, v]) => ({
        stage,
        order: v.order,
        users: v.converted,
        conversionPct: v.entered > 0 ? Math.round((v.converted / v.entered) * 1000) / 10 : 0,
      }))
      .sort((a, b) => a.order - b.order);

    const avg = (a: number[]) => (a.length ? Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 10) / 10 : 0);
    const tiers = Object.entries(tierMap).map(([tier, v]) => ({
      tier,
      m1Retention: avg(v.m1),
      m3Retention: avg(v.m3),
      avgLtv: avg(v.ltv),
      adoption: avg(v.adopt),
    }));
    return { funnel, tiers };
  }, [domain, rows]);

  // MARKETING COMPUTATIONS
  const marketingStats = useMemo(() => {
    if (domain !== 'marketing' || !rows.length) return null;
    const chMap: Record<string, { spend: number; impr: number; clicks: number; leads: number; conv: number; rev: number }> = {};
    let totalSpend = 0, totalRev = 0, totalConv = 0, totalLeads = 0;
    for (const r of rows) {
      const ch = String(r.channel);
      if (!chMap[ch]) chMap[ch] = { spend: 0, impr: 0, clicks: 0, leads: 0, conv: 0, rev: 0 };
      const sp = Number(r.spend) || 0;
      const rv = Number(r.revenue) || 0;
      const cv = Number(r.conversions) || 0;
      const ld = Number(r.leads) || 0;
      chMap[ch].spend += sp;
      chMap[ch].impr += Number(r.impressions) || 0;
      chMap[ch].clicks += Number(r.clicks) || 0;
      chMap[ch].leads += ld;
      chMap[ch].conv += cv;
      chMap[ch].rev += rv;
      totalSpend += sp;
      totalRev += rv;
      totalConv += cv;
      totalLeads += ld;
    }
    const channels = Object.entries(chMap)
      .map(([channel, v]) => ({
        channel,
        spend: Math.round(v.spend),
        revenue: Math.round(v.rev),
        roas: v.spend > 0 ? Math.round((v.rev / v.spend) * 100) / 100 : 0,
        cac: v.conv > 0 ? Math.round((v.spend / v.conv) * 100) / 100 : 0,
        cpl: v.leads > 0 ? Math.round((v.spend / v.leads) * 100) / 100 : 0,
        ctr: v.impr > 0 ? Math.round((v.clicks / v.impr) * 10000) / 100 : 0,
        conversions: v.conv,
      }))
      .sort((a, b) => b.roas - a.roas);
    return {
      totalSpend,
      totalRev,
      blendedRoas: totalSpend > 0 ? totalRev / totalSpend : 0,
      blendedCac: totalConv > 0 ? totalSpend / totalConv : 0,
      totalLeads,
      channels,
    };
  }, [domain, rows]);

  // OPERATIONS COMPUTATIONS
  const opsStats = useMemo(() => {
    if (domain !== 'operations' || !rows.length) return null;
    const teamMap: Record<string, { total: number; met: number; defects: number; hrs: number; cap: number }> = {};
    let metAll = 0, defectAll = 0, capSum = 0;
    for (const r of rows) {
      const t = String(r.team);
      if (!teamMap[t]) teamMap[t] = { total: 0, met: 0, defects: 0, hrs: 0, cap: 0 };
      teamMap[t].total++;
      teamMap[t].met += Number(r.sla_met) || 0;
      teamMap[t].defects += Number(r.defect_flag) || 0;
      teamMap[t].hrs += Number(r.resolution_hrs) || 0;
      teamMap[t].cap += Number(r.capacity_util_pct) || 0;
      metAll += Number(r.sla_met) || 0;
      defectAll += Number(r.defect_flag) || 0;
      capSum += Number(r.capacity_util_pct) || 0;
    }
    const teams = Object.entries(teamMap).map(([team, v]) => ({
      team,
      tickets: v.total,
      slaPct: Math.round((v.met / v.total) * 1000) / 10,
      avgResHrs: Math.round((v.hrs / v.total) * 10) / 10,
      defectPct: Math.round((v.defects / v.total) * 1000) / 10,
      avgCapPct: Math.round((v.cap / v.total) * 10) / 10,
    }));
    const atRiskSkus = invRows.filter((s) => Number(s.stock_on_hand) < Number(s.reorder_point));
    return {
      slaOverall: (metAll / rows.length) * 100,
      defectRate: (defectAll / rows.length) * 100,
      avgCapacity: capSum / rows.length,
      teams,
      atRiskSkus,
    };
  }, [domain, rows, invRows]);

  // FINANCIAL COMPUTATIONS
  const finStats = useMemo(() => {
    if (domain !== 'financial' || !rows.length) return null;
    const monthMap: Record<string, { bRev: number; aRev: number; bExp: number; aExp: number; cf: number }> = {};
    const deptMap: Record<string, { bRev: number; aRev: number; bExp: number; aExp: number }> = {};
    let totBRev = 0, totARev = 0, totBExp = 0, totAExp = 0, totCf = 0;

    for (const r of rows) {
      const m = String(r.fiscal_month);
      const d = String(r.department);
      if (!monthMap[m]) monthMap[m] = { bRev: 0, aRev: 0, bExp: 0, aExp: 0, cf: 0 };
      if (!deptMap[d]) deptMap[d] = { bRev: 0, aRev: 0, bExp: 0, aExp: 0 };
      const br = Number(r.budget_revenue) || 0;
      const ar = Number(r.actual_revenue) || 0;
      const be = Number(r.budget_expense) || 0;
      const ae = Number(r.actual_expense) || 0;
      const cf = Number(r.operating_cashflow) || 0;
      monthMap[m].bRev += br;
      monthMap[m].aRev += ar;
      monthMap[m].bExp += be;
      monthMap[m].aExp += ae;
      monthMap[m].cf += cf;
      deptMap[d].bRev += br;
      deptMap[d].aRev += ar;
      deptMap[d].bExp += be;
      deptMap[d].aExp += ae;
      totBRev += br;
      totARev += ar;
      totBExp += be;
      totAExp += ae;
      totCf += cf;
    }

    const monthly = Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({
        month,
        budgetRevenue: Math.round(v.bRev),
        actualRevenue: Math.round(v.aRev),
        operatingProfit: Math.round(v.aRev - v.aExp),
        cashflow: Math.round(v.cf),
      }));

    const depts = Object.entries(deptMap).map(([department, v]) => ({
      department,
      budgetRev: Math.round(v.bRev),
      actualRev: Math.round(v.aRev),
      revVarPct: v.bRev > 0 ? Math.round(((v.aRev - v.bRev) / v.bRev) * 1000) / 10 : 0,
      budgetExp: Math.round(v.bExp),
      actualExp: Math.round(v.aExp),
      marginPct: v.aRev > 0 ? Math.round(((v.aRev - v.aExp) / v.aRev) * 1000) / 10 : 0,
    }));

    return {
      totBRev,
      totARev,
      totAExp,
      totProfit: totARev - totAExp,
      totCf,
      revVariancePct: totBRev > 0 ? ((totARev - totBRev) / totBRev) * 100 : 0,
      monthly,
      depts,
    };
  }, [domain, rows]);

  // RESEARCH DETERMINISTIC SENTIMENT COMPUTATION
  const sentimentAnalysis = useMemo(() => {
    const posWords = ['fast', 'great', 'love', 'good', 'easy', 'reliable', 'smooth', 'accurate', 'excellent', 'best'];
    const negWords = ['delayed', 'poor', 'returned', 'inaccurate', 'long', 'bad', 'broken', 'slow', 'terrible', 'refund'];
    const lines = feedbackText.split('\n').map((l) => l.trim()).filter(Boolean);
    const items = lines.map((text) => {
      const words = text.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/);
      let score = 0;
      for (const w of words) {
        if (posWords.includes(w)) score++;
        if (negWords.includes(w)) score--;
      }
      return { text, score, label: score > 0 ? 'Positive' : score < 0 ? 'Negative' : 'Neutral' };
    });
    const pos = items.filter((i) => i.label === 'Positive').length;
    const neg = items.filter((i) => i.label === 'Negative').length;
    return { items, pos, neg, neu: items.length - pos - neg };
  }, [feedbackText]);

  const tamValue = tamUsers * arpu;
  const samValue = tamValue * (samPct / 100);
  const somValue = samValue * (somPct / 100);

  return (
    <div className="p-6 max-w-[1440px] mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-display font-bold text-slate-900 dark:text-slate-100">{meta.title}</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{meta.subtitle}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => exportRowsToCsv(rows, `${meta.table}_export.csv`)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Underlying Data</span>
          </button>
          <button
            onClick={() =>
              askGeminiWithPrompt(
                `Provide executive recommendations for ${meta.title} based on the computed sample metrics in table "${meta.table}". Distinguish sample observations from production advice.`,
                'analyst'
              )
            }
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Domain Brief</span>
          </button>
        </div>
      </div>

      {/* Sample Dataset Transparency Banner */}
      <div className="rounded-md border border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-[#0F1722] px-4 py-2 text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2">
        <Info className="w-4 h-4 text-blue-500 shrink-0" />
        <span>
          <strong>Data Source Label:</strong> Metrics below are live calculations over the seeded sample dataset <code className="font-mono">{meta.table}</code> ({rows.length} rows) for training &amp; analytical modeling — not live external company telemetry.
        </span>
      </div>

      {loading ? (
        <div className="p-10 text-center text-xs text-slate-500">Computing domain metrics...</div>
      ) : (
        <>
          {/* PRODUCT ANALYTICS */}
          {domain === 'product' && productStats && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <div className="lg:col-span-7 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] p-5">
                  <h2 className="text-sm font-display font-semibold mb-4">5-Stage User Conversion Funnel</h2>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={productStats.funnel} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis dataKey="stage" type="category" width={100} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="users" fill="#2563EB" radius={[0, 4, 4, 0]} name="Users Converted" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="lg:col-span-5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] p-5">
                  <h2 className="text-sm font-display font-semibold mb-3">Tier Retention, Adoption &amp; LTV</h2>
                  <table className="w-full text-xs text-left">
                    <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                      <tr>
                        <th className="py-2">Plan Tier</th>
                        <th className="py-2 text-right">M1 Ret %</th>
                        <th className="py-2 text-right">M3 Ret %</th>
                        <th className="py-2 text-right">Avg LTV</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {productStats.tiers.map((t) => (
                        <tr key={t.tier}>
                          <td className="py-2.5 font-medium">{t.tier}</td>
                          <td className="py-2.5 text-right font-mono tabular-nums">{t.m1Retention}%</td>
                          <td className="py-2.5 text-right font-mono tabular-nums">{t.m3Retention}%</td>
                          <td className="py-2.5 text-right font-mono tabular-nums">${t.avgLtv.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* MARKETING ANALYTICS */}
          {domain === 'marketing' && marketingStats && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Total Campaign Spend', value: `$${Math.round(marketingStats.totalSpend).toLocaleString()}` },
                  { label: 'Attributed Revenue', value: `$${Math.round(marketingStats.totalRev).toLocaleString()}` },
                  { label: 'Blended ROAS', value: `${marketingStats.blendedRoas.toFixed(2)}x` },
                  { label: 'Blended CAC', value: `$${marketingStats.blendedCac.toFixed(2)}` },
                ].map((k) => (
                  <div key={k.label} className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722]">
                    <div className="text-xs text-slate-500">{k.label}</div>
                    <div className="text-xl font-mono font-bold tabular-nums mt-1">{k.value}</div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <div className="lg:col-span-6 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] p-5">
                  <h2 className="text-sm font-display font-semibold mb-4">ROAS by Marketing Channel</h2>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={marketingStats.channels}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                        <XAxis dataKey="channel" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="roas" fill="#2563EB" name="ROAS (x)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="lg:col-span-6 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] p-5 overflow-x-auto">
                  <h2 className="text-sm font-display font-semibold mb-3">Channel Efficiency Scorecard</h2>
                  <table className="w-full text-xs text-left">
                    <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                      <tr>
                        <th className="py-2">Channel</th>
                        <th className="py-2 text-right">Spend</th>
                        <th className="py-2 text-right">CTR</th>
                        <th className="py-2 text-right">CPL</th>
                        <th className="py-2 text-right">CAC</th>
                        <th className="py-2 text-right">ROAS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {marketingStats.channels.map((c) => (
                        <tr key={c.channel}>
                          <td className="py-2 font-medium">{c.channel}</td>
                          <td className="py-2 text-right font-mono tabular-nums">${c.spend.toLocaleString()}</td>
                          <td className="py-2 text-right font-mono tabular-nums">{c.ctr}%</td>
                          <td className="py-2 text-right font-mono tabular-nums">${c.cpl}</td>
                          <td className="py-2 text-right font-mono tabular-nums">${c.cac}</td>
                          <td className="py-2 text-right font-mono tabular-nums font-semibold text-blue-600 dark:text-blue-400">
                            {c.roas}x
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* OPERATIONS ANALYTICS */}
          {domain === 'operations' && opsStats && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Overall SLA Compliance', value: `${opsStats.slaOverall.toFixed(1)}%` },
                  { label: 'Quality Defect Rate', value: `${opsStats.defectRate.toFixed(1)}%` },
                  { label: 'Avg Capacity Utilization', value: `${opsStats.avgCapacity.toFixed(1)}%` },
                  { label: 'SKUs Below Reorder Point', value: `${opsStats.atRiskSkus.length} SKUs` },
                ].map((k) => (
                  <div key={k.label} className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722]">
                    <div className="text-xs text-slate-500">{k.label}</div>
                    <div className="text-xl font-mono font-bold tabular-nums mt-1">{k.value}</div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <div className="lg:col-span-6 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] p-5">
                  <h2 className="text-sm font-display font-semibold mb-3">Team SLA &amp; Resolution Scorecard</h2>
                  <table className="w-full text-xs text-left">
                    <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                      <tr>
                        <th className="py-2">Team</th>
                        <th className="py-2 text-right">Tickets</th>
                        <th className="py-2 text-right">SLA Met %</th>
                        <th className="py-2 text-right">Avg Hrs</th>
                        <th className="py-2 text-right">Cap Util %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {opsStats.teams.map((t) => (
                        <tr key={t.team}>
                          <td className="py-2 font-medium">{t.team}</td>
                          <td className="py-2 text-right font-mono tabular-nums">{t.tickets}</td>
                          <td className="py-2 text-right font-mono tabular-nums">{t.slaPct}%</td>
                          <td className="py-2 text-right font-mono tabular-nums">{t.avgResHrs}h</td>
                          <td className="py-2 text-right font-mono tabular-nums">{t.avgCapPct}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="lg:col-span-6 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] p-5 max-h-80 overflow-y-auto">
                  <h2 className="text-sm font-display font-semibold mb-3">Inventory Reorder Alerts (Stock &lt; Reorder Point)</h2>
                  <table className="w-full text-xs text-left">
                    <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                      <tr>
                        <th className="py-2">SKU</th>
                        <th className="py-2">Warehouse</th>
                        <th className="py-2 text-right">On Hand</th>
                        <th className="py-2 text-right">Reorder Pt</th>
                        <th className="py-2 text-right">Lead Days</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {opsStats.atRiskSkus.slice(0, 12).map((s) => (
                        <tr key={s.sku_id}>
                          <td className="py-2 font-mono">{s.sku_id}</td>
                          <td className="py-2">{s.warehouse}</td>
                          <td className="py-2 text-right font-mono tabular-nums text-red-500 font-semibold">{s.stock_on_hand}</td>
                          <td className="py-2 text-right font-mono tabular-nums">{s.reorder_point}</td>
                          <td className="py-2 text-right font-mono tabular-nums">{s.lead_time_days}d</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* FINANCIAL ANALYTICS */}
          {domain === 'financial' && finStats && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Actual Revenue YTD', value: `$${Math.round(finStats.totARev).toLocaleString()}` },
                  { label: 'Revenue Budget Variance', value: `${finStats.revVariancePct >= 0 ? '+' : ''}${finStats.revVariancePct.toFixed(2)}%` },
                  { label: 'Operating Profit YTD', value: `$${Math.round(finStats.totProfit).toLocaleString()}` },
                  { label: 'Operating Cash Flow YTD', value: `$${Math.round(finStats.totCf).toLocaleString()}` },
                ].map((k) => (
                  <div key={k.label} className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722]">
                    <div className="text-xs text-slate-500">{k.label}</div>
                    <div className="text-xl font-mono font-bold tabular-nums mt-1">{k.value}</div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <div className="lg:col-span-7 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] p-5">
                  <h2 className="text-sm font-display font-semibold mb-4">Monthly Budget vs Actual Revenue &amp; Cash Flow</h2>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={finStats.monthly}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                        <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="budgetRevenue" stroke="#94A3B8" strokeDasharray="4 4" name="Budget Rev" />
                        <Line type="monotone" dataKey="actualRevenue" stroke="#2563EB" strokeWidth={2} name="Actual Rev" />
                        <Line type="monotone" dataKey="cashflow" stroke="#10B981" strokeWidth={2} name="Operating Cashflow" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="lg:col-span-5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] p-5">
                  <h2 className="text-sm font-display font-semibold mb-3">Departmental Variance Schedule</h2>
                  <table className="w-full text-xs text-left">
                    <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                      <tr>
                        <th className="py-2">Department</th>
                        <th className="py-2 text-right">Actual Rev</th>
                        <th className="py-2 text-right">Rev Var %</th>
                        <th className="py-2 text-right">Op Margin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {finStats.depts.map((d) => (
                        <tr key={d.department}>
                          <td className="py-2 font-medium">{d.department}</td>
                          <td className="py-2 text-right font-mono tabular-nums">${d.actualRev.toLocaleString()}</td>
                          <td className={`py-2 text-right font-mono tabular-nums ${d.revVarPct >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            {d.revVarPct >= 0 ? '+' : ''}{d.revVarPct}%
                          </td>
                          <td className="py-2 text-right font-mono tabular-nums">{d.marginPct}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* RESEARCH & MARKET INTELLIGENCE */}
          {domain === 'research' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 text-xs">
              <div className="lg:col-span-5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] p-5 space-y-4">
                <h2 className="text-sm font-display font-semibold">Bottom-Up TAM / SAM / SOM Market Sizing</h2>
                <div className="grid grid-cols-2 gap-3 font-mono">
                  <label>Total Target Accounts<input type="number" value={tamUsers} onChange={(e) => setTamUsers(Number(e.target.value))} className="mt-1 w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-transparent" /></label>
                  <label>Annual ARPU ($)<input type="number" value={arpu} onChange={(e) => setArpu(Number(e.target.value))} className="mt-1 w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-transparent" /></label>
                  <label>Serviceable Share (SAM %)<input type="number" value={samPct} onChange={(e) => setSamPct(Number(e.target.value))} className="mt-1 w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-transparent" /></label>
                  <label>Obtainable Share (SOM %)<input type="number" value={somPct} onChange={(e) => setSomPct(Number(e.target.value))} className="mt-1 w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-transparent" /></label>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200 dark:border-slate-800 font-mono tabular-nums">
                  <div><div className="text-[11px] text-slate-500">TAM</div><div className="font-bold text-sm">${(tamValue / 1e6).toFixed(2)}M</div></div>
                  <div><div className="text-[11px] text-slate-500">SAM</div><div className="font-bold text-sm text-blue-500">${(samValue / 1e6).toFixed(2)}M</div></div>
                  <div><div className="text-[11px] text-slate-500">SOM</div><div className="font-bold text-sm text-emerald-500">${(somValue / 1e6).toFixed(2)}M</div></div>
                </div>
              </div>

              <div className="lg:col-span-7 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] p-5 space-y-3">
                <h2 className="text-sm font-display font-semibold">Deterministic Feedback Sentiment Analyzer</h2>
                <textarea
                  rows={5}
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="Paste survey or customer feedback lines (one per line)..."
                  className="w-full p-2.5 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0B111A]"
                />
                <div className="flex items-center gap-4 font-mono">
                  <span className="text-emerald-500">Positive: {sentimentAnalysis.pos}</span>
                  <span className="text-slate-400">Neutral: {sentimentAnalysis.neu}</span>
                  <span className="text-red-500">Negative: {sentimentAnalysis.neg}</span>
                </div>
                <div className="space-y-1 max-h-36 overflow-y-auto">
                  {sentimentAnalysis.items.map((it, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-2 py-1 border-b border-slate-100 dark:border-slate-800/70">
                      <span className="truncate">{it.text}</span>
                      <span className={`font-mono shrink-0 ${it.label === 'Positive' ? 'text-emerald-500' : it.label === 'Negative' ? 'text-red-500' : 'text-slate-400'}`}>
                        {it.label} ({it.score >= 0 ? `+${it.score}` : it.score})
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-12 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] p-5">
                <h2 className="text-sm font-display font-semibold mb-3">Competitor Comparison Matrix (Editable)</h2>
                <table className="w-full text-xs text-left">
                  <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                    <tr>
                      <th className="py-2">Competitor</th>
                      <th className="py-2">Pricing</th>
                      <th className="py-2">Core Strength</th>
                      <th className="py-2">Observed Gap</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {competitors.map((c, idx) => (
                      <tr key={idx}>
                        <td className="py-2 font-medium">{c.name}</td>
                        <td className="py-2 font-mono">{c.price}</td>
                        <td className="py-2">{c.strength}</td>
                        <td className="py-2">
                          <input
                            type="text"
                            value={c.gap}
                            onChange={(e) =>
                              setCompetitors((prev) =>
                                prev.map((item, i) => (i === idx ? { ...item, gap: e.target.value } : item))
                              )
                            }
                            className="w-full bg-transparent border-b border-transparent focus:border-blue-500 focus:outline-none"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
