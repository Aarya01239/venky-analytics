export interface SeedDatasetSpec {
  id: string;
  name: string;
  tableName: string;
  description: string;
  rows: Record<string, any>[];
}

// Deterministic pseudo-random generator for reproducible realistic enterprise datasets
function createRng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function generateSeedDatasets(): SeedDatasetSpec[] {
  const rng = createRng(42019);

  // 1. Retail Sales
  const regions = ['North', 'South', 'East', 'West'];
  const categories = [
    { cat: 'Electronics', sub: ['Laptops', 'Audio', 'Monitors'], basePrice: 480, margin: 0.24 },
    { cat: 'Furniture', sub: ['Desks', 'Chairs', 'Storage'], basePrice: 320, margin: 0.31 },
    { cat: 'Office Supplies', sub: ['Paper', 'Binders', 'Accessories'], basePrice: 45, margin: 0.42 },
    { cat: 'Appliances', sub: ['Coffee Makers', 'Air Purifiers', 'Printers'], basePrice: 210, margin: 0.28 },
  ];
  const segments = ['Consumer', 'Corporate', 'Home Office'];
  const storeTypes = ['Flagship', 'Express', 'Online Direct'];

  const retailRows: Record<string, any>[] = [];
  for (let i = 1; i <= 140; i++) {
    const month = ((i - 1) % 12) + 1;
    const day = ((i * 7) % 28) + 1;
    const year = i <= 70 ? 2025 : 2026;
    const c = pick(rng, categories);
    const sub = pick(rng, c.sub);
    const region = pick(rng, regions);
    const seg = pick(rng, segments);
    const store = pick(rng, storeTypes);
    const seasonal = month === 11 || month === 12 ? 1.35 : month <= 2 ? 0.85 : 1.0;
    const units = Math.max(1, Math.round((1 + rng() * 14) * seasonal));
    const unitPrice = round2(c.basePrice * (0.75 + rng() * 0.6));
    const discountPct = pick(rng, [0, 0, 5, 10, 15, 20]);
    const revenue = round2(units * unitPrice * (1 - discountPct / 100));
    const cost = round2(units * unitPrice * (1 - c.margin) * (0.94 + rng() * 0.12));
    const profit = round2(revenue - cost);
    retailRows.push({
      order_id: `RET-${1000 + i}`,
      order_date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      region,
      store_type: store,
      category: c.cat,
      sub_category: sub,
      customer_segment: seg,
      units_sold: units,
      unit_price: unitPrice,
      discount_pct: discountPct,
      revenue,
      cost,
      profit,
    });
  }

  // 2. E-commerce Orders
  const channels = ['Organic Search', 'Paid Search', 'Social Ads', 'Email', 'Referral'];
  const devices = ['Desktop', 'Mobile Web', 'iOS App', 'Android App'];
  const ecomRows: Record<string, any>[] = [];
  for (let i = 1; i <= 110; i++) {
    const month = ((i - 1) % 12) + 1;
    const day = ((i * 5) % 27) + 1;
    const cat = pick(rng, ['Apparel', 'Electronics', 'Home & Kitchen', 'Beauty', 'Sports']);
    const orderVal = round2(35 + rng() * 440);
    const returned = rng() < (cat === 'Apparel' ? 0.22 : 0.08) ? 1 : 0;
    ecomRows.push({
      order_id: `EC-${5000 + i}`,
      order_date: `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      customer_id: `CUST-${100 + (i % 48)}`,
      channel: pick(rng, channels),
      device: pick(rng, devices),
      category: cat,
      order_value: orderVal,
      shipping_cost: round2(orderVal > 120 ? 0 : 7.99 + rng() * 6),
      returned,
      rating: returned ? Math.max(1, Math.round(1 + rng() * 2)) : Math.min(5, Math.round(3.3 + rng() * 1.7)),
    });
  }

  // 3. Banking Customers & Churn
  const bankingRows: Record<string, any>[] = [];
  for (let i = 1; i <= 90; i++) {
    const age = Math.round(22 + rng() * 48);
    const creditScore = Math.round(520 + rng() * 320);
    const tenure = Math.round(3 + rng() * 108);
    const balance = round2(rng() < 0.2 ? 0 : 1200 + rng() * 145000);
    const numProducts = pick(rng, [1, 1, 2, 2, 3, 4]);
    const isActive = rng() < 0.68 ? 1 : 0;
    const churnProb = (isActive === 0 ? 0.32 : 0.09) + (age > 48 ? 0.16 : 0) + (numProducts === 1 ? 0.12 : 0);
    const churned = rng() < churnProb ? 1 : 0;
    bankingRows.push({
      customer_id: `BNK-${2000 + i}`,
      age,
      region: pick(rng, ['Mumbai', 'Bengaluru', 'Hyderabad', 'Delhi NCR', 'Chennai']),
      account_type: pick(rng, ['Savings', 'Salary', 'Wealth', 'Business']),
      credit_score: creditScore,
      tenure_months: tenure,
      balance,
      num_products: numProducts,
      is_active: isActive,
      churned,
    });
  }

  // 4. HR Employee Attrition
  const hrDepts = ['Engineering', 'Sales', 'Operations', 'Finance', 'Marketing', 'Support'];
  const hrRows: Record<string, any>[] = [];
  for (let i = 1; i <= 85; i++) {
    const dept = pick(rng, hrDepts);
    const tenure = round2(0.5 + rng() * 11);
    const overtime = rng() < 0.35 ? 'Yes' : 'No';
    const sat = Math.ceil(rng() * 5);
    const income = Math.round(
      (dept === 'Engineering' ? 8800 : dept === 'Finance' ? 7600 : dept === 'Sales' ? 6800 : 5400) *
        (0.75 + rng() * 0.65)
    );
    const attrProb = (overtime === 'Yes' ? 0.28 : 0.07) + (sat <= 2 ? 0.24 : 0) + (tenure < 2 ? 0.14 : 0);
    hrRows.push({
      emp_id: `EMP-${300 + i}`,
      department: dept,
      role: dept === 'Engineering' ? 'Analyst / Engineer' : dept === 'Sales' ? 'Account Exec' : 'Specialist',
      age: Math.round(23 + rng() * 34),
      tenure_years: tenure,
      monthly_income: income,
      overtime,
      job_satisfaction: sat,
      performance_rating: pick(rng, [2, 3, 3, 4, 4, 5]),
      attrition: rng() < attrProb ? 'Yes' : 'No',
    });
  }

  // 5. Marketing Campaigns
  const mktChannels = ['Google Ads', 'Meta Ads', 'LinkedIn Ads', 'Email Drip', 'SEO Content', 'Affiliate'];
  const mktRows: Record<string, any>[] = [];
  for (let i = 1; i <= 60; i++) {
    const month = ((i - 1) % 12) + 1;
    const ch = mktChannels[(i - 1) % mktChannels.length];
    const spend = round2(1200 + rng() * 14500);
    const cpm = ch === 'LinkedIn Ads' ? 32 : ch === 'Google Ads' ? 18 : ch === 'Email Drip' ? 4 : 12;
    const impressions = Math.round((spend / cpm) * 1000 * (0.85 + rng() * 0.35));
    const ctr = ch === 'Email Drip' ? 0.048 : ch === 'Google Ads' ? 0.036 : 0.019;
    const clicks = Math.max(25, Math.round(impressions * ctr * (0.7 + rng() * 0.6)));
    const leads = Math.max(5, Math.round(clicks * (0.08 + rng() * 0.14)));
    const conversions = Math.max(1, Math.round(leads * (0.12 + rng() * 0.24)));
    const avgDeal = ch === 'LinkedIn Ads' ? 1450 : ch === 'Google Ads' ? 520 : 310;
    const revenue = round2(conversions * avgDeal * (0.8 + rng() * 0.5));
    mktRows.push({
      campaign_id: `CMP-${400 + i}`,
      launch_date: `2026-${String(month).padStart(2, '0')}-05`,
      channel: ch,
      campaign_name: `${ch.split(' ')[0]} Q${Math.ceil(month / 3)} Push #${i}`,
      spend,
      impressions,
      clicks,
      leads,
      conversions,
      revenue,
    });
  }

  // 6. Product Analytics Funnel & Cohorts
  const prodRows: Record<string, any>[] = [];
  const tiers = ['Free', 'Pro', 'Enterprise'];
  const stages = ['Visited', 'Signed Up', 'Activated', 'Retained 30d', 'Paid Upgrade'];
  for (let m = 1; m <= 10; m++) {
    const cohort = `2026-${String(m).padStart(2, '0')}`;
    for (const tier of tiers) {
      let baseUsers = Math.round((tier === 'Free' ? 2400 : tier === 'Pro' ? 850 : 210) * (0.9 + rng() * 0.25));
      for (let sIdx = 0; sIdx < stages.length; sIdx++) {
        const drop = sIdx === 0 ? 1 : sIdx === 1 ? 0.44 : sIdx === 2 ? 0.62 : sIdx === 3 ? 0.58 : 0.36;
        const converted = Math.max(8, Math.round(baseUsers * drop * (0.88 + rng() * 0.22)));
        prodRows.push({
          cohort_month: cohort,
          plan_tier: tier,
          stage: stages[sIdx],
          stage_order: sIdx + 1,
          users_entered: baseUsers,
          users_converted: converted,
          avg_session_min: round2(4.2 + rng() * 14.5),
          feature_adoption_pct: round2(28 + rng() * 64),
          month1_retention_pct: round2(tier === 'Enterprise' ? 78 + rng() * 14 : tier === 'Pro' ? 58 + rng() * 16 : 31 + rng() * 15),
          month3_retention_pct: round2(tier === 'Enterprise' ? 66 + rng() * 15 : tier === 'Pro' ? 42 + rng() * 16 : 16 + rng() * 12),
          ltv: round2(tier === 'Enterprise' ? 4200 + rng() * 2400 : tier === 'Pro' ? 680 + rng() * 420 : 45 + rng() * 65),
        });
        baseUsers = converted;
      }
    }
  }

  // 7. Inventory SKU Optimization
  const invRows: Record<string, any>[] = [];
  const warehouses = ['WH-West', 'WH-Central', 'WH-South', 'WH-East'];
  for (let i = 1; i <= 60; i++) {
    const monthlyDemand = Math.round(30 + rng() * 420);
    const leadDays = Math.round(4 + rng() * 24);
    const reorderPoint = Math.round((monthlyDemand / 30) * leadDays * 1.25);
    const stockOnHand = Math.round(reorderPoint * (0.35 + rng() * 1.9));
    invRows.push({
      sku_id: `SKU-${7000 + i}`,
      warehouse: pick(rng, warehouses),
      category: pick(rng, ['Fast-Moving', 'Electronics', 'Industrial', 'Consumables']),
      unit_cost: round2(8 + rng() * 195),
      stock_on_hand: stockOnHand,
      reorder_point: reorderPoint,
      monthly_demand: monthlyDemand,
      lead_time_days: leadDays,
      stockout_events: stockOnHand < reorderPoint ? Math.ceil(rng() * 4) : 0,
    });
  }

  // 8. Financial Ledger (Budget vs Actual)
  const finDepts = ['Retail Ops', 'Enterprise SaaS', 'Marketplace', 'Cloud Services'];
  const finRows: Record<string, any>[] = [];
  for (let m = 1; m <= 12; m++) {
    for (const dept of finDepts) {
      const baseRev = dept === 'Enterprise SaaS' ? 240000 : dept === 'Retail Ops' ? 310000 : 175000;
      const growth = 1 + m * 0.022;
      const budgetRev = round2(baseRev * growth);
      const actualRev = round2(budgetRev * (0.91 + rng() * 0.21));
      const budgetExp = round2(budgetRev * (dept === 'Enterprise SaaS' ? 0.62 : 0.74));
      const actualExp = round2(budgetExp * (0.93 + rng() * 0.16));
      finRows.push({
        fiscal_month: `2026-${String(m).padStart(2, '0')}`,
        department: dept,
        cost_center: `CC-${finDepts.indexOf(dept) + 1}00`,
        budget_revenue: budgetRev,
        actual_revenue: actualRev,
        budget_expense: budgetExp,
        actual_expense: actualExp,
        operating_cashflow: round2((actualRev - actualExp) * (0.85 + rng() * 0.25)),
      });
    }
  }

  // 9. Operations SLA & Quality
  const opsTeams = ['Fulfillment', 'Logistics', 'Customer Support', 'Quality Assurance'];
  const opsRows: Record<string, any>[] = [];
  for (let i = 1; i <= 72; i++) {
    const priority = pick(rng, ['Critical', 'High', 'Medium', 'Low']);
    const target = priority === 'Critical' ? 4 : priority === 'High' ? 12 : priority === 'Medium' ? 24 : 48;
    const resHrs = round2(target * (0.4 + rng() * 1.05));
    const month = ((i - 1) % 12) + 1;
    opsRows.push({
      ticket_id: `OPS-${8000 + i}`,
      created_date: `2026-${String(month).padStart(2, '0')}-${String(((i * 3) % 27) + 1).padStart(2, '0')}`,
      team: pick(rng, opsTeams),
      priority,
      sla_target_hrs: target,
      resolution_hrs: resHrs,
      sla_met: resHrs <= target ? 1 : 0,
      defect_flag: rng() < 0.09 ? 1 : 0,
      capacity_util_pct: round2(62 + rng() * 34),
    });
  }

  // 10. Agricultural Equipment Sales Analysis
  const agriStates = ['Telangana', 'Andhra Pradesh', 'Punjab', 'Maharashtra', 'Madhya Pradesh', 'Karnataka'];
  const agriEquip = [
    { type: 'Tractor 45HP', hp: '40-50 HP', price: 780000 },
    { type: 'Tractor 55HP 4WD', hp: '50-60 HP', price: 960000 },
    { type: 'Combine Harvester', hp: '75+ HP', price: 2450000 },
    { type: 'Rotavator 6ft', hp: 'Implement', price: 115000 },
    { type: 'Seed Drill', hp: 'Implement', price: 92000 },
  ];
  const agriRows: Record<string, any>[] = [];
  for (let i = 1; i <= 60; i++) {
    const eq = pick(rng, agriEquip);
    const units = eq.hp === 'Implement' ? Math.ceil(rng() * 6) : Math.ceil(rng() * 3);
    const discount = round2(eq.price * units * pick(rng, [0, 0.03, 0.05, 0.08]));
    const month = ((i - 1) % 12) + 1;
    agriRows.push({
      sale_id: `AGR-${600 + i}`,
      sale_date: `2026-${String(month).padStart(2, '0')}-${String(((i * 4) % 27) + 1).padStart(2, '0')}`,
      state: pick(rng, agriStates),
      dealer_name: `AgriHub Dealer ${1 + (i % 12)}`,
      equipment_type: eq.type,
      hp_class: eq.hp,
      units,
      list_price: eq.price,
      discount,
      net_sales: round2(eq.price * units - discount),
      financing_used: rng() < 0.64 ? 'Loan' : 'Cash',
    });
  }

  // 11. Lead Conversion Analysis
  const leadSources = ['Inbound Web', 'LinkedIn', 'Partner Referral', 'Webinar', 'Outbound SDR'];
  const leadStages = ['MQL', 'SQL', 'Proposal', 'Closed Won', 'Closed Lost'];
  const leadRows: Record<string, any>[] = [];
  for (let i = 1; i <= 70; i++) {
    const stage = pick(rng, leadStages);
    leadRows.push({
      lead_id: `LD-${900 + i}`,
      created_date: `2026-${String(((i - 1) % 10) + 1).padStart(2, '0')}-${String(((i * 3) % 26) + 1).padStart(2, '0')}`,
      source: pick(rng, leadSources),
      industry: pick(rng, ['FinTech', 'Retail', 'Healthcare', 'Manufacturing', 'Logistics']),
      company_size: pick(rng, ['1-50', '51-200', '201-1000', '1000+']),
      stage,
      deal_value: round2(2500 + rng() * 48000),
      days_in_funnel: Math.round(5 + rng() * 82),
      converted: stage === 'Closed Won' ? 1 : 0,
    });
  }

  // 12. Raw Dirty Sales Dataset (specifically for Data Cleaning Lab exercises!)
  const dirtyRows: Record<string, any>[] = [];
  for (let i = 1; i <= 40; i++) {
    const reg = pick(rng, ['  North ', 'north', 'SOUTH', 'South', 'East ', 'west']);
    const prod = pick(rng, ['Laptop Pro', 'laptop pro ', 'Ergonomic Chair', 'USB-C Dock', null]);
    const qty = i === 12 ? 999 : i === 27 ? -5 : Math.ceil(rng() * 10);
    const price = i % 7 === 0 ? null : i === 19 ? 89500 : round2(45 + rng() * 650);
    const dateVal =
      i % 5 === 0
        ? `0${(i % 9) + 1}/15/2026`
        : i % 6 === 0
        ? `2026/0${(i % 9) + 1}/18`
        : `2026-0${(i % 9) + 1}-${String((i % 25) + 1).padStart(2, '0')}`;
    dirtyRows.push({
      tx_id: `TX-${100 + i}`,
      tx_date: dateVal,
      region: reg,
      product_name: prod,
      quantity: qty,
      unit_price: price,
      customer_email: i % 8 === 0 ? '' : `Buyer${i}@Example.COM `,
    });
  }
  // Intentional duplicate rows for duplicate detection practice
  dirtyRows.push({ ...dirtyRows[2] });
  dirtyRows.push({ ...dirtyRows[7] });
  dirtyRows.push({ ...dirtyRows[14] });

  return [
    {
      id: 'ds_retail_sales',
      name: 'Retail Sales 2025-2026 (Sample)',
      tableName: 'retail_sales',
      description: 'Sample multi-region retail transactions with units, discounts, revenue, cost, and profit.',
      rows: retailRows,
    },
    {
      id: 'ds_ecommerce_orders',
      name: 'E-Commerce Orders (Sample)',
      tableName: 'ecommerce_orders',
      description: 'Sample online order performance across channels, devices, returns, and customer ratings.',
      rows: ecomRows,
    },
    {
      id: 'ds_banking_customers',
      name: 'Banking Customer Churn (Sample)',
      tableName: 'banking_customers',
      description: 'Sample retail banking profiles with credit score, balances, product count, and churn flags.',
      rows: bankingRows,
    },
    {
      id: 'ds_hr_attrition',
      name: 'HR Employee Attrition (Sample)',
      tableName: 'hr_attrition',
      description: 'Sample workforce tenure, compensation, overtime, satisfaction, and attrition indicators.',
      rows: hrRows,
    },
    {
      id: 'ds_marketing_campaigns',
      name: 'Marketing Campaign Performance (Sample)',
      tableName: 'marketing_campaigns',
      description: 'Sample paid and organic channel spend, impressions, clicks, leads, conversions, and revenue.',
      rows: mktRows,
    },
    {
      id: 'ds_product_events',
      name: 'Product Funnel & Cohorts (Sample)',
      tableName: 'product_events',
      description: 'Sample SaaS cohort funnel conversion, session duration, feature adoption, retention, and LTV.',
      rows: prodRows,
    },
    {
      id: 'ds_inventory_sku',
      name: 'Inventory Optimization SKUs (Sample)',
      tableName: 'inventory_sku',
      description: 'Sample warehouse SKU stock levels, reorder points, lead times, monthly demand, and stockouts.',
      rows: invRows,
    },
    {
      id: 'ds_financial_ledger',
      name: 'Financial Budget vs Actual (Sample)',
      tableName: 'financial_ledger',
      description: 'Sample monthly departmental revenue, expense budgets vs actuals, and operating cashflow.',
      rows: finRows,
    },
    {
      id: 'ds_operations_sla',
      name: 'Operations SLA & Quality (Sample)',
      tableName: 'operations_sla',
      description: 'Sample operational ticket resolution times, SLA targets, defect flags, and capacity utilization.',
      rows: opsRows,
    },
    {
      id: 'ds_agri_equipment',
      name: 'Agricultural Equipment Sales (Sample)',
      tableName: 'agri_equipment_sales',
      description: 'Sample regional tractor and farm implement sales with dealer, HP class, and financing mix.',
      rows: agriRows,
    },
    {
      id: 'ds_lead_funnel',
      name: 'B2B Lead Conversion Funnel (Sample)',
      tableName: 'lead_funnel',
      description: 'Sample CRM pipeline stages, lead sources, deal values, sales cycle days, and win indicators.',
      rows: leadRows,
    },
    {
      id: 'ds_raw_dirty_sales',
      name: 'Raw Dirty Sales (Cleaning Practice)',
      tableName: 'raw_dirty_sales',
      description: 'Intentionally messy dataset with duplicates, nulls, mixed case, whitespace, inconsistent dates, and outliers.',
      rows: dirtyRows,
    },
  ];
}
