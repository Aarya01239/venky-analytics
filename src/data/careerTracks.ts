import type { CareerTrackId, NavModuleId } from '../types/os';

interface CareerTrack {
  id: CareerTrackId;
  title: string;
  shortTitle: string;
  summary: string;
  coreSkills: string[];
  keyDeliverables: string[];
  recommendedDatasetIds: string[];
  starterExercise: { title: string; brief: string; module: NavModuleId };
}

const tracks: [CareerTrackId, string, string, NavModuleId, string, string[], string][] = [
  ['data-analyst', 'Data Analyst', 'Data', 'sql', 'ds_retail_sales', ['SQL', 'Data validation'], 'Summarize revenue and order count by region.'],
  ['business-analyst', 'Business Analyst', 'Business', 'ba', 'ds_lead_funnel', ['Requirements', 'UAT'], 'Write acceptance criteria for a lead status report.'],
  ['bi-analyst', 'Business Intelligence Analyst', 'BI', 'powerbi', 'ds_retail_sales', ['Star schema', 'Measures'], 'Define order and revenue measures at the correct grain.'],
  ['product-analyst', 'Product Analyst', 'Product', 'product', 'ds_product_events', ['Funnels', 'Retention'], 'Find the largest drop-off between funnel stages.'],
  ['marketing-analyst', 'Marketing Analyst', 'Marketing', 'marketing', 'ds_marketing_campaigns', ['Attribution', 'ROAS'], 'Compare campaign ROAS using a consistent conversion window.'],
  ['operations-analyst', 'Operations Analyst', 'Operations', 'operations', 'ds_operations_sla', ['SLA', 'Capacity'], 'Measure the share of tickets that miss SLA.'],
  ['reporting-mis-analyst', 'Reporting and MIS Analyst', 'Reporting', 'reporting', 'ds_retail_sales', ['Reconciliation', 'Reporting'], 'Reconcile a monthly rollup against the source totals.'],
  ['research-analyst', 'Research Analyst', 'Research', 'research', 'ds_banking_customers', ['Sampling', 'Research design'], 'Describe limits of generalizing customer findings.'],
  ['financial-analyst', 'Financial Analyst', 'Financial', 'financial', 'ds_financial_ledger', ['Budget variance', 'Cashflow'], 'Identify which departments drive budget variance.'],
  ['process-analyst', 'Process Analyst', 'Process', 'ba', 'ds_operations_sla', ['Process mapping', 'Root cause'], 'Map the current ticket resolution workflow and its bottlenecks.'],
  ['customer-insights-analyst', 'Customer Insights Analyst', 'Customer', 'statistics', 'ds_banking_customers', ['Segmentation', 'Churn'], 'Compare churn rates across customer segments.'],
  ['ai-automation-analyst', 'AI and Automation Analyst', 'Automation', 'automation', 'ds_raw_dirty_sales', ['Workflow design', 'Verification'], 'Design a validation step for automated data cleaning.'],
  ['sales-analyst', 'Sales Analyst', 'Sales', 'sql', 'ds_agri_equipment', ['Territory KPIs', 'Sales performance'], 'Compare net sales across equipment territories.'],
  ['strategy-analyst', 'Strategy Analyst', 'Strategy', 'research', 'ds_ecommerce_orders', ['Scenario analysis', 'Decision framing'], 'Define evidence needed to prioritize a customer channel.'],
];

export const CAREER_TRACKS: CareerTrack[] = tracks.map(([id, title, shortTitle, module, datasetId, coreSkills, brief]) => ({
  id, title, shortTitle, summary: brief, coreSkills,
  keyDeliverables: ['Analysis with assumptions', 'Evidence-backed business recommendation'],
  recommendedDatasetIds: [datasetId],
  starterExercise: { title: 'Starter exercise', brief, module },
}));
