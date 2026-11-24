import React, { useEffect, useMemo, useState } from 'react';
import * as ss from 'simple-statistics';
import jStat from 'jstat';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ComposedChart,
} from 'recharts';
import { Sparkles, Sigma, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';

function round4(n: number): number {
  return Number.isFinite(n) ? Math.round(n * 10000) / 10000 : 0;
}

export const StatisticsLabModule: React.FC = () => {
  const {
    datasets,
    activeDatasetId,
    setActiveDatasetId,
    activeDatasetRows,
    askGeminiWithPrompt,
    updateAiContext,
  } = useWorkspace();

  const [tab, setTab] = useState<'descriptive' | 'distributions' | 'hypothesis' | 'regression' | 'abtest'>('descriptive');

  const numericCols = useMemo(() => {
    if (!activeDatasetRows.length) return [];
    return Object.keys(activeDatasetRows[0]).filter((c) => {
      const sample = activeDatasetRows.slice(0, 30).map((r) => r[c]).filter((v) => v !== null && v !== '');
      return sample.length > 0 && sample.every((v) => typeof v === 'number' || !Number.isNaN(Number(v)));
    });
  }, [activeDatasetRows]);

  const categoricalCols = useMemo(() => {
    if (!activeDatasetRows.length) return [];
    return Object.keys(activeDatasetRows[0]).filter((c) => !numericCols.includes(c));
  }, [activeDatasetRows, numericCols]);

  const [selectedCol, setSelectedCol] = useState('');
  const [regX, setRegX] = useState('');
  const [regY, setRegY] = useState('');
  const [tGroupCol, setTGroupCol] = useState('');
  const [tMetricCol, setTMetricCol] = useState('');

  useEffect(() => {
    if (numericCols.length > 0) {
      setSelectedCol((prev) => (numericCols.includes(prev) ? prev : numericCols[numericCols.length - 1]));
      setRegX((prev) => (numericCols.includes(prev) ? prev : numericCols[0]));
      setRegY((prev) => (numericCols.includes(prev) ? prev : numericCols[Math.min(1, numericCols.length - 1)]));
      setTMetricCol((prev) => (numericCols.includes(prev) ? prev : numericCols[numericCols.length - 1]));
    }
    if (categoricalCols.length > 0) {
      setTGroupCol((prev) => (categoricalCols.includes(prev) ? prev : categoricalCols[0]));
    }
  }, [numericCols, categoricalCols]);

  // Descriptive Stats Computation
  const descriptive = useMemo(() => {
    const vals = activeDatasetRows
      .map((r) => Number(r[selectedCol]))
      .filter((v) => Number.isFinite(v));
    if (vals.length < 2) return null;
    const sorted = [...vals].sort((a, b) => a - b);
    const mean = ss.mean(vals);
    const median = ss.medianSorted(sorted);
    const mode = ss.modeSorted(sorted);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const range = max - min;
    const sampleVar = ss.sampleVariance(vals);
    const popVar = ss.variance(vals);
    const sampleSd = ss.sampleStandardDeviation(vals);
    const popSd = ss.standardDeviation(vals);
    const q1 = ss.quantileSorted(sorted, 0.25);
    const q3 = ss.quantileSorted(sorted, 0.75);
    const iqr = q3 - q1;
    const lowerFence = q1 - 1.5 * iqr;
    const upperFence = q3 + 1.5 * iqr;
    const outliers = vals.filter((v) => v < lowerFence || v > upperFence);
    const se = sampleSd / Math.sqrt(vals.length);
    const tCrit = jStat.studentt.inv(0.975, Math.max(1, vals.length - 1));
    const ci95Low = mean - tCrit * se;
    const ci95High = mean + tCrit * se;

    // 10-bin histogram
    const bins = 10;
    const step = (max - min) / bins || 1;
    const hist = Array.from({ length: bins }, (_, i) => {
      const lo = min + i * step;
      const hi = i === bins - 1 ? max + 0.0001 : min + (i + 1) * step;
      const count = vals.filter((v) => v >= lo && v < hi).length;
      return { bin: `${Math.round(lo)}`, count };
    });

    return {
      n: vals.length,
      mean,
      median,
      mode,
      min,
      max,
      range,
      sampleVar,
      popVar,
      sampleSd,
      popSd,
      q1,
      q3,
      iqr,
      outliersCount: outliers.length,
      ci95Low,
      ci95High,
      hist,
    };
  }, [activeDatasetRows, selectedCol]);

  // Distributions State
  const [distType, setDistType] = useState<'normal' | 'binomial' | 'poisson'>('normal');
  const [normMean, setNormMean] = useState(0);
  const [normSd, setNormSd] = useState(1);
  const [binomN, setBinomN] = useState(20);
  const [binomP, setBinomP] = useState(0.35);
  const [poisLambda, setPoisLambda] = useState(5);

  // Bayes Calculator
  const [priorA, setPriorA] = useState(0.05);
  const [likBA, setLikBA] = useState(0.92);
  const [falsePos, setFalsePos] = useState(0.08);
  const bayesPosterior = useMemo(() => {
    const num = likBA * priorA;
    const den = num + falsePos * (1 - priorA);
    return den > 0 ? num / den : 0;
  }, [priorA, likBA, falsePos]);

  const distChartData = useMemo(() => {
    if (distType === 'normal') {
      const sd = Math.max(0.1, normSd);
      const pts = [];
      for (let i = -35; i <= 35; i += 2) {
        const x = normMean + (i / 10) * sd;
        pts.push({
          x: Number(x.toFixed(2)),
          pdf: round4(jStat.normal.pdf(x, normMean, sd)),
          cdf: round4(jStat.normal.cdf(x, normMean, sd)),
        });
      }
      return pts;
    }
    if (distType === 'binomial') {
      const n = Math.max(1, Math.min(60, Math.round(binomN)));
      const p = Math.max(0.01, Math.min(0.99, binomP));
      return Array.from({ length: n + 1 }, (_, k) => ({
        x: k,
        pdf: round4(jStat.binomial.pdf(k, n, p)),
        cdf: round4(jStat.binomial.cdf(k, n, p)),
      }));
    }
    const lam = Math.max(0.5, Math.min(30, poisLambda));
    const maxK = Math.ceil(lam * 2.6) + 4;
    return Array.from({ length: maxK }, (_, k) => ({
      x: k,
      pdf: round4(jStat.poisson.pdf(k, lam)),
      cdf: round4(jStat.poisson.cdf(k, lam)),
    }));
  }, [distType, normMean, normSd, binomN, binomP, poisLambda]);

  // Hypothesis Testing State
  const [testKind, setTestKind] = useState<'ztest' | 'ttest2' | 'chisquare' | 'anova'>('ttest2');
  const [alpha, setAlpha] = useState(0.05);
  // Z-Test inputs
  const [zSampleMean, setZSampleMean] = useState(528);
  const [zPopMean, setZPopMean] = useState(500);
  const [zPopSd, setZPopSd] = useState(95);
  const [zN, setZN] = useState(64);
  // 2-Sample T-Test inputs
  const [tMean1, setTMean1] = useState(1420);
  const [tSd1, setTSd1] = useState(310);
  const [tN1, setTN1] = useState(45);
  const [tMean2, setTMean2] = useState(1240);
  const [tSd2, setTSd2] = useState(280);
  const [tN2, setTN2] = useState(50);
  const [tGroupLabels, setTGroupLabels] = useState<[string, string]>(['Group 1', 'Group 2']);

  const loadTTestFromDataset = () => {
    if (!tGroupCol || !tMetricCol || !activeDatasetRows.length) return;
    const grouped: Record<string, number[]> = {};
    for (const r of activeDatasetRows) {
      const g = String(r[tGroupCol] ?? '').trim();
      const v = Number(r[tMetricCol]);
      if (g && Number.isFinite(v)) {
        if (!grouped[g]) grouped[g] = [];
        grouped[g].push(v);
      }
    }
    const topTwo = Object.entries(grouped)
      .filter(([, vals]) => vals.length >= 2)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 2);
    if (topTwo.length === 2) {
      const [[g1, v1], [g2, v2]] = topTwo;
      setTGroupLabels([g1, g2]);
      setTMean1(round4(ss.mean(v1)));
      setTSd1(round4(ss.sampleStandardDeviation(v1)));
      setTN1(v1.length);
      setTMean2(round4(ss.mean(v2)));
      setTSd2(round4(ss.sampleStandardDeviation(v2)));
      setTN2(v2.length);
    }
  };
  // Chi-Square 2x2 Contingency
  const [chiA, setChiA] = useState(48);
  const [chiB, setChiB] = useState(152);
  const [chiC, setChiC] = useState(29);
  const [chiD, setChiD] = useState(171);
  // One-Way ANOVA (3 group comma lists)
  const [anovaG1, setAnovaG1] = useState('210, 225, 198, 240, 230, 215');
  const [anovaG2, setAnovaG2] = useState('260, 275, 255, 290, 268, 272');
  const [anovaG3, setAnovaG3] = useState('190, 205, 185, 210, 195, 202');

  const hypResult = useMemo(() => {
    if (testKind === 'ztest') {
      const se = zPopSd / Math.sqrt(Math.max(1, zN));
      const z = (zSampleMean - zPopMean) / (se || 1);
      const pVal = 2 * (1 - jStat.normal.cdf(Math.abs(z), 0, 1));
      return {
        statName: 'Z-Statistic',
        stat: round4(z),
        pValue: round4(pVal),
        reject: pVal < alpha,
        assumptions: 'Requires known population standard deviation (σ), independent observations, and n ≥ 30 (CLT) or normal population.',
      };
    }
    if (testKind === 'ttest2') {
      const v1 = (tSd1 * tSd1) / Math.max(2, tN1);
      const v2 = (tSd2 * tSd2) / Math.max(2, tN2);
      const se = Math.sqrt(v1 + v2);
      const t = (tMean1 - tMean2) / (se || 1);
      const df = Math.pow(v1 + v2, 2) / (Math.pow(v1, 2) / (tN1 - 1) + Math.pow(v2, 2) / (tN2 - 1));
      const pVal = 2 * (1 - jStat.studentt.cdf(Math.abs(t), Math.max(1, df)));
      return {
        statName: `Welch t-Statistic (df=${df.toFixed(1)})`,
        stat: round4(t),
        pValue: round4(pVal),
        reject: pVal < alpha,
        assumptions: 'Welch Two-Sample T-Test assumes independent samples and approximate normality of group means; does NOT require equal variances.',
      };
    }
    if (testKind === 'chisquare') {
      const r1 = chiA + chiB;
      const r2 = chiC + chiD;
      const c1 = chiA + chiC;
      const c2 = chiB + chiD;
      const total = r1 + r2 || 1;
      const obs = [chiA, chiB, chiC, chiD];
      const exp = [(r1 * c1) / total, (r1 * c2) / total, (r2 * c1) / total, (r2 * c2) / total];
      const chi2 = obs.reduce((acc, o, i) => acc + Math.pow(o - exp[i], 2) / (exp[i] || 1), 0);
      const pVal = 1 - jStat.chisquare.cdf(chi2, 1);
      return {
        statName: 'Chi-Square (df=1)',
        stat: round4(chi2),
        pValue: round4(pVal),
        reject: pVal < alpha,
        assumptions: 'Assumes categorical independent observations and expected cell frequency ≥ 5 in every cell.',
      };
    }
    const parseNums = (s: string) =>
      s
        .split(',')
        .map((x) => Number(x.trim()))
        .filter((x) => Number.isFinite(x));
    const groups = [parseNums(anovaG1), parseNums(anovaG2), parseNums(anovaG3)].filter((g) => g.length >= 2);
    if (groups.length < 2) {
      return { statName: 'F-Statistic', stat: 0, pValue: 1, reject: false, assumptions: 'Provide at least 2 numeric groups.' };
    }
    const fStat = jStat.anovafscore(...groups);
    const df1 = groups.length - 1;
    const df2 = groups.reduce((acc, g) => acc + g.length, 0) - groups.length;
    const pVal = jStat.anovaftest(...groups);
    return {
      statName: `One-Way ANOVA F(${df1}, ${df2})`,
      stat: round4(fStat),
      pValue: round4(pVal),
      reject: pVal < alpha,
      assumptions: 'Assumes independent observations, normally distributed residuals within groups, and homogeneity of variances (Levene test).',
    };
  }, [testKind, alpha, zSampleMean, zPopMean, zPopSd, zN, tMean1, tSd1, tN1, tMean2, tSd2, tN2, chiA, chiB, chiC, chiD, anovaG1, anovaG2, anovaG3]);

  // OLS Regression & Correlation on Active Dataset
  const regression = useMemo(() => {
    const pairs: [number, number][] = [];
    for (const r of activeDatasetRows) {
      const x = Number(r[regX]);
      const y = Number(r[regY]);
      if (Number.isFinite(x) && Number.isFinite(y)) pairs.push([x, y]);
    }
    if (pairs.length < 3) return null;
    const xs = pairs.map((p) => p[0]);
    const ys = pairs.map((p) => p[1]);
    const corr = ss.sampleCorrelation(xs, ys);
    const cov = ss.sampleCovariance(xs, ys);
    const lr = ss.linearRegression(pairs);
    const lineFn = ss.linearRegressionLine(lr);
    const r2 = ss.rSquared(pairs, lineFn);
    const chartData = pairs.slice(0, 120).map(([x, y]) => ({
      x: round4(x),
      y: round4(y),
      pred: round4(lineFn(x)),
    })).sort((a, b) => a.x - b.x);
    return { n: pairs.length, corr, cov, slope: lr.m, intercept: lr.b, r2, chartData };
  }, [activeDatasetRows, regX, regY]);

  // A/B Test Conversion Calculator
  const [abVisA, setAbVisA] = useState(2500);
  const [abConvA, setAbConvA] = useState(145);
  const [abVisB, setAbVisB] = useState(2500);
  const [abConvB, setAbConvB] = useState(182);
  const abResult = useMemo(() => {
    const pA = abConvA / Math.max(1, abVisA);
    const pB = abConvB / Math.max(1, abVisB);
    const pPool = (abConvA + abConvB) / Math.max(1, abVisA + abVisB);
    const se = Math.sqrt(pPool * (1 - pPool) * (1 / Math.max(1, abVisA) + 1 / Math.max(1, abVisB)));
    const z = (pB - pA) / (se || 1);
    const pVal = 2 * (1 - jStat.normal.cdf(Math.abs(z), 0, 1));
    const liftPct = pA > 0 ? ((pB - pA) / pA) * 100 : 0;
    return { pA: pA * 100, pB: pB * 100, liftPct, z: round4(z), pVal: round4(pVal), significant: pVal < 0.05 };
  }, [abVisA, abConvA, abVisB, abConvB]);

  useEffect(() => {
    if (descriptive) {
      updateAiContext({
        sampleSummary: `Column ${selectedCol} (n=${descriptive.n}): Mean=${round4(descriptive.mean)}, Median=${round4(descriptive.median)}, Sample SD=${round4(descriptive.sampleSd)}, Pop SD=${round4(descriptive.popSd)}, IQR=${round4(descriptive.iqr)}, Outliers=${descriptive.outliersCount}`,
      });
    }
  }, [descriptive, selectedCol, updateAiContext]);

  return (
    <div className="p-6 max-w-[1440px] mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-display font-bold text-slate-900 dark:text-slate-100">
            Statistics Lab & Gemini Tutor
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Exact mathematical computation via simple-statistics & jStat · Sample vs Population clarity · Bilingual English & Telugu AI tutoring.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={activeDatasetId}
            onChange={(e) => setActiveDatasetId(e.target.value)}
            className="px-2.5 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F1722] text-xs"
          >
            {datasets.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <button
            onClick={() =>
              askGeminiWithPrompt(
                `Act as my personal Statistics Tutor. Interpret my current Statistics Lab metrics on column "${selectedCol}" (${
                  descriptive ? `Mean=${round4(descriptive.mean)}, Median=${round4(descriptive.median)}, Sample SD=${round4(descriptive.sampleSd)}, Pop SD=${round4(descriptive.popSd)}, Outliers=${descriptive.outliersCount}` : 'current analysis'
                }), explain the mathematical intuition, and give a clear Telugu explanation too.`,
                'learn'
              )
            }
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Ask Statistics Tutor (EN / తెలుగు)</span>
          </button>
        </div>
      </div>

      {/* Sub-navigation */}
      <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#0F1722] border border-slate-200 dark:border-slate-800 w-fit text-xs flex-wrap">
        {[
          { id: 'descriptive', label: 'Descriptive & Outliers' },
          { id: 'distributions', label: 'Probability & Distributions' },
          { id: 'hypothesis', label: 'Hypothesis Testing (Z / T / χ² / ANOVA)' },
          { id: 'regression', label: 'Correlation & Regression' },
          { id: 'abtest', label: 'A/B Test Significance' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              tab === t.id
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 1. DESCRIPTIVE STATISTICS */}
      {tab === 'descriptive' && (
        <div className="space-y-5">
          <div className="flex items-center gap-3 text-xs">
            <span className="text-slate-500">Numeric Column:</span>
            <select
              value={selectedCol}
              onChange={(e) => setSelectedCol(e.target.value)}
              className="px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F1722] font-mono"
            >
              {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {descriptive ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {[
                  { label: 'Observations (n)', value: descriptive.n.toLocaleString() },
                  { label: 'Mean (x̄)', value: round4(descriptive.mean).toLocaleString() },
                  { label: 'Median (Q2)', value: round4(descriptive.median).toLocaleString() },
                  { label: 'Mode', value: round4(descriptive.mode).toLocaleString() },
                  { label: 'Sample SD (s, n-1)', value: round4(descriptive.sampleSd).toLocaleString() },
                  { label: 'Population SD (σ, N)', value: round4(descriptive.popSd).toLocaleString() },
                  { label: 'Sample Variance (s²)', value: round4(descriptive.sampleVar).toLocaleString() },
                  { label: 'Pop Variance (σ²)', value: round4(descriptive.popVar).toLocaleString() },
                  { label: 'Q1 (25th) / Q3 (75th)', value: `${round4(descriptive.q1)} / ${round4(descriptive.q3)}` },
                  { label: 'IQR (Q3 - Q1)', value: round4(descriptive.iqr).toLocaleString() },
                  { label: 'Range (Max - Min)', value: round4(descriptive.range).toLocaleString() },
                  { label: '1.5×IQR Outliers', value: `${descriptive.outliersCount} rows` },
                ].map((m) => (
                  <div key={m.label} className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722]">
                    <div className="text-[11px] text-slate-500">{m.label}</div>
                    <div className="text-base font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100 mt-1">
                      {m.value}
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <div className="lg:col-span-8 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] p-5">
                  <h2 className="text-sm font-display font-semibold mb-3">
                    Empirical Frequency Distribution: {selectedCol}
                  </h2>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={descriptive.hist}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                        <XAxis dataKey="bin" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#2563EB" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="lg:col-span-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] p-5 space-y-3 text-xs">
                  <div className="flex items-center gap-2 font-display font-semibold text-sm">
                    <Sigma className="w-4 h-4 text-blue-500" />
                    <span>Statistical Rigor Notes</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                    <strong>95% Confidence Interval for Population Mean:</strong>{' '}
                    <span className="font-mono text-slate-900 dark:text-slate-100">
                      [{round4(descriptive.ci95Low)}, {round4(descriptive.ci95High)}]
                    </span>
                  </p>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                    <strong>Sample vs Population:</strong> Sample Variance divides by <span className="font-mono">(n - 1)</span> (Bessel&apos;s correction) to avoid downward bias when inferring population parameters from sample data.
                  </p>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                    <strong>Skewness Diagnostic:</strong> Mean ({round4(descriptive.mean)}) {descriptive.mean > descriptive.median ? '>' : '<'} Median ({round4(descriptive.median)}) suggests{' '}
                    {Math.abs(descriptive.mean - descriptive.median) < descriptive.sampleSd * 0.1
                      ? 'roughly symmetric distribution.'
                      : descriptive.mean > descriptive.median
                      ? 'right-skewed distribution; prefer Median & IQR over Mean & SD.'
                      : 'left-skewed distribution.'}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="p-6 text-xs text-slate-500">Select a dataset containing numeric columns to compute descriptive statistics.</div>
          )}
        </div>
      )}

      {/* 2. PROBABILITY & DISTRIBUTIONS */}
      {tab === 'distributions' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-8 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs">
                {(['normal', 'binomial', 'poisson'] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDistType(d)}
                    className={`px-3 py-1.5 rounded border font-medium capitalize ${
                      distType === d ? 'border-blue-600 bg-blue-600/10 text-blue-600 dark:text-blue-400' : 'border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3 text-xs font-mono">
                {distType === 'normal' && (
                  <>
                    <label>μ: <input type="number" value={normMean} onChange={(e) => setNormMean(Number(e.target.value))} className="w-16 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-transparent" /></label>
                    <label>σ: <input type="number" step="0.5" min="0.1" value={normSd} onChange={(e) => setNormSd(Number(e.target.value))} className="w-16 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-transparent" /></label>
                  </>
                )}
                {distType === 'binomial' && (
                  <>
                    <label>n: <input type="number" min="1" max="60" value={binomN} onChange={(e) => setBinomN(Number(e.target.value))} className="w-16 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-transparent" /></label>
                    <label>p: <input type="number" step="0.05" min="0.01" max="0.99" value={binomP} onChange={(e) => setBinomP(Number(e.target.value))} className="w-16 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-transparent" /></label>
                  </>
                )}
                {distType === 'poisson' && (
                  <label>λ: <input type="number" step="0.5" min="0.5" max="30" value={poisLambda} onChange={(e) => setPoisLambda(Number(e.target.value))} className="w-16 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-transparent" /></label>
                )}
              </div>
            </div>

            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                {distType === 'normal' ? (
                  <LineChart data={distChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                    <XAxis dataKey="x" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="pdf" stroke="#2563EB" strokeWidth={2} dot={false} name="PDF" />
                    <Line type="monotone" dataKey="cdf" stroke="#10B981" strokeWidth={1.5} dot={false} name="CDF" />
                  </LineChart>
                ) : (
                  <BarChart data={distChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                    <XAxis dataKey="x" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="pdf" fill="#2563EB" radius={[3, 3, 0, 0]} name="PMF P(X=k)" />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bayes Theorem Calculator */}
          <div className="lg:col-span-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] p-5 space-y-3 text-xs">
            <h2 className="text-sm font-display font-semibold">Bayes&apos; Theorem Calculator</h2>
            <p className="text-slate-500">P(A|B) = [P(B|A) · P(A)] / P(B)</p>
            <div className="space-y-2.5">
              <label className="block">
                <span className="text-slate-500">Prior Probability P(A) (e.g., Fraud / Defect Rate)</span>
                <input type="number" step="0.01" min="0" max="1" value={priorA} onChange={(e) => setPriorA(Number(e.target.value))} className="mt-1 w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-transparent font-mono" />
              </label>
              <label className="block">
                <span className="text-slate-500">True Positive Rate P(B|A) (Sensitivity)</span>
                <input type="number" step="0.01" min="0" max="1" value={likBA} onChange={(e) => setLikBA(Number(e.target.value))} className="mt-1 w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-transparent font-mono" />
              </label>
              <label className="block">
                <span className="text-slate-500">False Positive Rate P(B|¬A)</span>
                <input type="number" step="0.01" min="0" max="1" value={falsePos} onChange={(e) => setFalsePos(Number(e.target.value))} className="mt-1 w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-transparent font-mono" />
              </label>
            </div>
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
              <div className="text-slate-500">Posterior Probability P(A|B)</div>
              <div className="text-2xl font-mono font-bold tabular-nums text-blue-600 dark:text-blue-400 mt-1">
                {(bayesPosterior * 100).toFixed(2)}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. HYPOTHESIS TESTING */}
      {tab === 'hypothesis' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 text-xs">
          <div className="lg:col-span-7 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { id: 'ttest2', label: 'Two-Sample T-Test' },
                  { id: 'ztest', label: 'One-Sample Z-Test' },
                  { id: 'chisquare', label: 'Chi-Square (2×2)' },
                  { id: 'anova', label: 'One-Way ANOVA' },
                ].map((k) => (
                  <button
                    key={k.id}
                    onClick={() => setTestKind(k.id as any)}
                    className={`px-3 py-1.5 rounded border font-medium ${
                      testKind === k.id ? 'border-blue-600 bg-blue-600/10 text-blue-600 dark:text-blue-400' : 'border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    {k.label}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-1.5 font-mono">
                α:
                <select value={alpha} onChange={(e) => setAlpha(Number(e.target.value))} className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-transparent">
                  <option value={0.01}>0.01</option>
                  <option value={0.05}>0.05</option>
                  <option value={0.1}>0.10</option>
                </select>
              </label>
            </div>

            {testKind === 'ztest' && (
              <div className="grid grid-cols-2 gap-3 font-mono">
                <label>Sample Mean (x̄)<input type="number" value={zSampleMean} onChange={(e) => setZSampleMean(Number(e.target.value))} className="mt-1 w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-transparent" /></label>
                <label>Hypothesized μ₀<input type="number" value={zPopMean} onChange={(e) => setZPopMean(Number(e.target.value))} className="mt-1 w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-transparent" /></label>
                <label>Known Pop SD (σ)<input type="number" value={zPopSd} onChange={(e) => setZPopSd(Number(e.target.value))} className="mt-1 w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-transparent" /></label>
                <label>Sample Size (n)<input type="number" value={zN} onChange={(e) => setZN(Number(e.target.value))} className="mt-1 w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-transparent" /></label>
              </div>
            )}

            {testKind === 'ttest2' && (
              <div className="space-y-3">
                {categoricalCols.length > 0 && numericCols.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 p-2.5 rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B111A]">
                    <span className="text-slate-500">Populate from dataset:</span>
                    <select value={tGroupCol} onChange={(e) => setTGroupCol(e.target.value)} className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F1722] font-mono">
                      {categoricalCols.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select value={tMetricCol} onChange={(e) => setTMetricCol(e.target.value)} className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F1722] font-mono">
                      {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <button
                      type="button"
                      onClick={loadTTestFromDataset}
                      className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-medium"
                    >
                      Load Top 2 Groups
                    </button>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-3 font-mono">
                  <label>{tGroupLabels[0]} Mean<input type="number" value={tMean1} onChange={(e) => setTMean1(Number(e.target.value))} className="mt-1 w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-transparent" /></label>
                  <label>{tGroupLabels[0]} SD (s₁)<input type="number" value={tSd1} onChange={(e) => setTSd1(Number(e.target.value))} className="mt-1 w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-transparent" /></label>
                  <label>{tGroupLabels[0]} Size (n₁)<input type="number" value={tN1} onChange={(e) => setTN1(Number(e.target.value))} className="mt-1 w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-transparent" /></label>
                  <label>{tGroupLabels[1]} Mean<input type="number" value={tMean2} onChange={(e) => setTMean2(Number(e.target.value))} className="mt-1 w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-transparent" /></label>
                  <label>{tGroupLabels[1]} SD (s₂)<input type="number" value={tSd2} onChange={(e) => setTSd2(Number(e.target.value))} className="mt-1 w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-transparent" /></label>
                  <label>{tGroupLabels[1]} Size (n₂)<input type="number" value={tN2} onChange={(e) => setTN2(Number(e.target.value))} className="mt-1 w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-transparent" /></label>
                </div>
              </div>
            )}

            {testKind === 'chisquare' && (
              <div className="grid grid-cols-2 gap-3 font-mono">
                <label>Row 1 / Col 1 Observed<input type="number" value={chiA} onChange={(e) => setChiA(Number(e.target.value))} className="mt-1 w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-transparent" /></label>
                <label>Row 1 / Col 2 Observed<input type="number" value={chiB} onChange={(e) => setChiB(Number(e.target.value))} className="mt-1 w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-transparent" /></label>
                <label>Row 2 / Col 1 Observed<input type="number" value={chiC} onChange={(e) => setChiC(Number(e.target.value))} className="mt-1 w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-transparent" /></label>
                <label>Row 2 / Col 2 Observed<input type="number" value={chiD} onChange={(e) => setChiD(Number(e.target.value))} className="mt-1 w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-transparent" /></label>
              </div>
            )}

            {testKind === 'anova' && (
              <div className="space-y-2.5 font-mono">
                <label className="block">Group A Values (comma-separated)<input type="text" value={anovaG1} onChange={(e) => setAnovaG1(e.target.value)} className="mt-1 w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-transparent" /></label>
                <label className="block">Group B Values<input type="text" value={anovaG2} onChange={(e) => setAnovaG2(e.target.value)} className="mt-1 w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-transparent" /></label>
                <label className="block">Group C Values<input type="text" value={anovaG3} onChange={(e) => setAnovaG3(e.target.value)} className="mt-1 w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-transparent" /></label>
              </div>
            )}
          </div>

          <div className="lg:col-span-5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] p-5 space-y-4">
            <h2 className="text-sm font-display font-semibold">Computed Test Decision</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded border border-slate-200 dark:border-slate-800">
                <div className="text-[11px] text-slate-500">{hypResult.statName}</div>
                <div className="text-xl font-mono font-bold tabular-nums mt-1">{hypResult.stat}</div>
              </div>
              <div className="p-3 rounded border border-slate-200 dark:border-slate-800">
                <div className="text-[11px] text-slate-500">Exact Two-Tailed p-value</div>
                <div className="text-xl font-mono font-bold tabular-nums mt-1">{hypResult.pValue}</div>
              </div>
            </div>

            <div
              className={`p-3 rounded-md border flex items-start gap-2 ${
                hypResult.reject
                  ? 'border-emerald-300 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200'
                  : 'border-amber-300 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200'
              }`}
            >
              {hypResult.reject ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />}
              <div>
                <div className="font-semibold">
                  {hypResult.reject ? `Reject Null Hypothesis H₀ (p < ${alpha})` : `Fail to Reject Null Hypothesis H₀ (p ≥ ${alpha})`}
                </div>
                <p className="mt-1 opacity-90">{hypResult.assumptions}</p>
              </div>
            </div>

            <button
              onClick={() =>
                askGeminiWithPrompt(
                  `Explain this ${hypResult.statName} result (${hypResult.stat}, p=${hypResult.pValue} at alpha=${alpha}) in plain business language and also provide a short Telugu summary.`,
                  'learn'
                )
              }
              className="w-full py-2 rounded-md border border-blue-500/50 text-blue-600 dark:text-blue-400 font-medium hover:bg-blue-500/10"
            >
              Interpret with Gemini Tutor
            </button>
          </div>
        </div>
      )}

      {/* 4. CORRELATION & REGRESSION */}
      {tab === 'regression' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <label className="flex items-center gap-1.5">
              <span>X (Predictor):</span>
              <select value={regX} onChange={(e) => setRegX(e.target.value)} className="px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F1722] font-mono">
                {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-1.5">
              <span>Y (Response):</span>
              <select value={regY} onChange={(e) => setRegY(e.target.value)} className="px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F1722] font-mono">
                {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          </div>

          {regression && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                {[
                  { label: 'Pearson Correlation (r)', value: round4(regression.corr) },
                  { label: 'Coefficient of Det. (R²)', value: `${(regression.r2 * 100).toFixed(2)}%` },
                  { label: 'OLS Slope (β₁)', value: round4(regression.slope) },
                  { label: 'OLS Intercept (β₀)', value: round4(regression.intercept) },
                  { label: 'Sample Covariance', value: round4(regression.cov).toLocaleString() },
                ].map((k) => (
                  <div key={k.label} className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722]">
                    <div className="text-[11px] text-slate-500">{k.label}</div>
                    <div className="text-lg font-mono font-bold tabular-nums mt-1">{k.value}</div>
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] p-5">
                <div className="flex items-center justify-between mb-3 text-xs">
                  <span className="font-display font-semibold text-sm">
                    OLS Regression: {regY} = {round4(regression.slope)}·({regX}) + {round4(regression.intercept)}
                  </span>
                  <span className="font-mono text-slate-500">n = {regression.n}</span>
                </div>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={regression.chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                      <XAxis dataKey="x" type="number" name={regX} tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Scatter dataKey="y" fill="#2563EB" name={regY} />
                      <Line type="linear" dataKey="pred" stroke="#EF4444" strokeWidth={2} dot={false} name="OLS Fit" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* 5. A/B TESTING CALCULATOR */}
      {tab === 'abtest' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 text-xs">
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] p-5 space-y-4">
            <h2 className="text-sm font-display font-semibold">Two-Proportion A/B Experiment Inputs</h2>
            <div className="grid grid-cols-2 gap-3 font-mono">
              <label>Control (A) Visitors<input type="number" value={abVisA} onChange={(e) => setAbVisA(Number(e.target.value))} className="mt-1 w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-transparent" /></label>
              <label>Control (A) Conversions<input type="number" value={abConvA} onChange={(e) => setAbConvA(Number(e.target.value))} className="mt-1 w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-transparent" /></label>
              <label>Treatment (B) Visitors<input type="number" value={abVisB} onChange={(e) => setAbVisB(Number(e.target.value))} className="mt-1 w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-transparent" /></label>
              <label>Treatment (B) Conversions<input type="number" value={abConvB} onChange={(e) => setAbConvB(Number(e.target.value))} className="mt-1 w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-transparent" /></label>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] p-5 space-y-3">
            <h2 className="text-sm font-display font-semibold">Experiment Readout</h2>
            <div className="grid grid-cols-2 gap-3 font-mono tabular-nums">
              <div>Control Rate (A): <strong>{abResult.pA.toFixed(2)}%</strong></div>
              <div>Treatment Rate (B): <strong>{abResult.pB.toFixed(2)}%</strong></div>
              <div>Relative Lift: <strong className={abResult.liftPct >= 0 ? 'text-emerald-500' : 'text-red-500'}>{abResult.liftPct >= 0 ? '+' : ''}{abResult.liftPct.toFixed(2)}%</strong></div>
              <div>Z-Score / p-value: <strong>{abResult.z} / {abResult.pVal}</strong></div>
            </div>
            <div className={`p-3 rounded border ${abResult.significant ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'}`}>
              {abResult.significant
                ? 'Statistically Significant at α = 0.05. Verify guardrail metrics and full-week runtime before full rollout.'
                : 'Not Statistically Significant at α = 0.05. Continue running test until pre-calculated sample size is reached.'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
