import type { CareerTrackId, NavModuleId } from '../types/os';

export interface SqlChallenge {
  id: string;
  title: string;
  topic: string;
  level: string;
  prompt: string;
  hint?: string;
  starterSql: string;
  solutionSql: string;
}

export const sqlChallengeTopicId = (id: string) => 'sql-challenge:' + id;

export const SQL_CHALLENGES: SqlChallenge[] = [
  {
    id: 'retail-revenue-by-region',
    title: 'Regional retail revenue',
    topic: 'GROUP BY',
    level: 'Beginner',
    prompt: 'Return region and total revenue as total_revenue, ordered by total revenue descending and region ascending.',
    starterSql: 'SELECT region\nFROM retail_sales;',
    solutionSql: 'SELECT region, SUM(revenue) AS total_revenue FROM retail_sales GROUP BY region ORDER BY total_revenue DESC, region;',
  },
  {
    id: 'retail-order-rank',
    title: 'Rank transactions within regions',
    topic: 'Window functions',
    level: 'Advanced',
    prompt: 'Return region, order_id and revenue_rank using DENSE_RANK by descending revenue within each region. Sort by region, rank and order_id.',
    starterSql: 'SELECT region, order_id, revenue\nFROM retail_sales;',
    solutionSql: 'SELECT region, order_id, DENSE_RANK() OVER (PARTITION BY region ORDER BY revenue DESC) AS revenue_rank FROM retail_sales ORDER BY region, revenue_rank, order_id;',
  },
  {
    id: 'ecommerce-q1-returns',
    title: 'Find returned orders in Q1',
    topic: 'Date range and WHERE',
    level: 'Beginner',
    prompt: 'Return order_id, order_date, and order_value for returned e-commerce orders dated January through March 2026. Sort by date, then order ID.',
    hint: 'Use January 1 as the inclusive start and April 1 as the exclusive end. The returned flag is 1 for a return.',
    starterSql: 'SELECT order_id, order_date, order_value FROM ecommerce_orders;',
    solutionSql: "SELECT order_id, order_date, order_value FROM ecommerce_orders WHERE returned = 1 AND order_date >= '2026-01-01' AND order_date < '2026-04-01' ORDER BY order_date, order_id;",
  },
  {
    id: 'ecommerce-channel-return-rate',
    title: 'Compare returns by acquisition channel',
    topic: 'Conditional aggregation',
    level: 'Intermediate',
    prompt: 'Return channel, total order count, returned order count, and return percentage rounded to two decimals. Sort by return percentage descending, then channel.',
    hint: 'Group by channel. A CASE expression can count returned orders. Use 100.0 to avoid integer division.',
    starterSql: 'SELECT channel, returned FROM ecommerce_orders;',
    solutionSql: `SELECT channel, COUNT(*) AS order_count,
  SUM(CASE WHEN returned = 1 THEN 1 ELSE 0 END) AS return_count,
  ROUND(100.0 * SUM(CASE WHEN returned = 1 THEN 1 ELSE 0 END) / COUNT(*), 2) AS return_pct
FROM ecommerce_orders GROUP BY channel ORDER BY return_pct DESC, channel;`,
  },
  {
    id: 'ecommerce-customer-left-join',
    title: 'Keep customers with no returns',
    topic: 'CTE and LEFT JOIN',
    level: 'Intermediate',
    prompt: 'Return one row per customer with customer_id, total orders, and returned orders. Include customers with and without returns. Sort by customer ID.',
    hint: 'Aggregate all orders and returned orders separately by customer. Left join the aggregates and use COALESCE for null return counts.',
    starterSql: 'SELECT customer_id, COUNT(*) AS orders FROM ecommerce_orders GROUP BY customer_id;',
    solutionSql: `WITH totals AS (
  SELECT customer_id, COUNT(*) AS orders FROM ecommerce_orders GROUP BY customer_id
), returned_orders AS (
  SELECT customer_id, COUNT(*) AS returns FROM ecommerce_orders WHERE returned = 1 GROUP BY customer_id
)
SELECT totals.customer_id, orders, COALESCE(returns, 0) AS returns
FROM totals LEFT JOIN returned_orders ON returned_orders.customer_id = totals.customer_id
ORDER BY totals.customer_id;`,
  },
  {
    id: 'ecommerce-monthly-running-value',
    title: 'Build a running monthly sales report',
    topic: 'CTE and window aggregation',
    level: 'Advanced',
    prompt: 'Return month (YYYY-MM), kept order value, and the running kept order value through that month for 2026. Exclude returned orders from amounts, keep months with only returned orders as zero, round amounts to two decimals, and sort by month.',
    hint: 'Build one row per month with conditional aggregation. Then apply a window SUM ordered by month.',
    starterSql: "SELECT SUBSTR(order_date, 1, 7) AS month, order_value, returned FROM ecommerce_orders;",
    solutionSql: `WITH monthly AS (
  SELECT SUBSTR(order_date, 1, 7) AS month,
    SUM(CASE WHEN returned = 0 THEN order_value ELSE 0 END) AS kept_value
  FROM ecommerce_orders
  WHERE order_date >= '2026-01-01' AND order_date < '2027-01-01'
  GROUP BY SUBSTR(order_date, 1, 7)
)
SELECT month, ROUND(kept_value, 2) AS kept_value,
  ROUND(SUM(kept_value) OVER (ORDER BY month ROWS UNBOUNDED PRECEDING), 2) AS running_kept_value
FROM monthly ORDER BY month;`,
  },
];

export interface LearningLesson {
  id: string;
  title: string;
  track: string;
  level: string;
  durationMin: number;
  targetModule: NavModuleId;
  explanation: string;
  exampleCode?: string;
  guidedExercise: string;
  independentAssignment: string;
  realWorldApp: string;
  interviewRelevance: string;
  quiz: { question: string; options: string[]; correctIndex: number; rationale: string };
}

export const LEARNING_CURRICULUM: LearningLesson[] = [
  {
    id: 'sql-retail-aggregation', title: 'Aggregate sales by region', track: 'SQL', level: 'Beginner',
    durationMin: 15, targetModule: 'sql',
    explanation: 'A grouping query returns one row per group. Confirm the grain of the source and decide how to handle missing revenue before reporting a total.',
    exampleCode: SQL_CHALLENGES[0].solutionSql,
    guidedExercise: 'Run the example in SQL Studio, then compare the sum of the regional totals against the grand total.',
    independentAssignment: 'Group by category and region. Report order count alongside total revenue.',
    realWorldApp: 'Territory managers use comparable totals to prioritize regions.',
    interviewRelevance: 'Be prepared to explain GROUP BY and why JOIN can inflate counts.',
    quiz: { question: 'What is the output grain if you group only by region?', options: ['One row per order', 'One row per region', 'One row per product'], correctIndex: 1, rationale: 'Every distinct grouping value produces one aggregate row.' },
  },
  {
    id: 'ba-testable-criteria', title: 'Write testable acceptance criteria', track: 'Business Analysis', level: 'Intermediate',
    durationMin: 20, targetModule: 'ba',
    explanation: 'An acceptance criterion describes an observable behavior and a passing condition in a specific context.',
    guidedExercise: 'Write Given, When, Then criteria for an analyst who filters a dashboard by region.',
    independentAssignment: 'Add cases for an empty region and a user who lacks permission to view the data.',
    realWorldApp: 'Testable criteria give stakeholders and testers a common definition of done.',
    interviewRelevance: 'Give an example of turning an ambiguous request into an observable outcome.',
    quiz: { question: 'Which acceptance criterion is directly testable?', options: ['Filtering should feel intuitive', 'With North selected, only North rows appear', 'Users should like the dashboard'], correctIndex: 1, rationale: 'The condition and expected result are both observable.' },
  },
];

export interface InterviewQuestion {
  id: string;
  category: string;
  difficulty: string;
  role: string;
  question: string;
  keyPoints: string[];
  modelAnswer: string;
}

export const INTERVIEW_QUESTIONS: InterviewQuestion[] = [
  {
    id: 'sales-analytics-transition', category: 'HR', difficulty: 'Beginner', role: 'Data Analyst',
    question: 'How has field sales prepared you for an analytics role?',
    keyPoints: ['Use a verified work example', 'Describe the decisions behind the reporting', 'Explain what you are learning now'],
    modelAnswer: 'In field sales I tracked lead stages and territory performance. That helped me prioritize follow-ups. I am building on that business experience with SQL and dashboard projects so I can validate patterns and communicate decisions with data.',
  },
  {
    id: 'sql-join-fanout', category: 'SQL', difficulty: 'Intermediate', role: 'Data Analyst',
    question: 'Why can joining tables inflate total sales?',
    keyPoints: ['Identify table grain', 'Check key cardinality', 'Reconcile before and after aggregation'],
    modelAnswer: 'A one-to-many join can repeat the sales value for each matching row. I check key uniqueness and aggregate or deduplicate at the business grain before reconciling totals.',
  },
];

export interface RealWorldProjectBlueprint {
  id: string;
  title: string;
  careerTrack: CareerTrackId;
  domain: string;
  datasetId: string;
  tableName: string;
  businessProblem: string;
  objectives: string[];
  questions: string[];
  tasks: Record<'cleaning' | 'sql' | 'excel' | 'python' | 'statistics' | 'visualization', string>;
  evaluationCriteria: string[];
}

export const REAL_WORLD_PROJECTS: RealWorldProjectBlueprint[] = [{
  id: 'retail-territory-review',
  title: 'Retail territory performance review',
  careerTrack: 'data-analyst',
  domain: 'Retail',
  datasetId: 'ds_retail_sales',
  tableName: 'retail_sales',
  businessProblem: 'A sales manager needs to decide which region to investigate after seeing uneven revenue and margins.',
  objectives: ['Reconcile sales and profit by region', 'Recommend one follow-up with supporting evidence'],
  questions: ['Which regions contribute the most profit?', 'Does the result change when you compare within categories?'],
  tasks: {
    cleaning: 'Check order IDs, missing values and unexpected negative amounts.',
    sql: 'Summarize order count, revenue and profit by region and category.',
    excel: 'Build a pivot-style summary and reconcile its totals.',
    python: 'Reproduce the SQL totals with Pandas and investigate discrepancies.',
    statistics: 'Compare distributions and flag segments with few observations.',
    visualization: 'Present regional revenue and margin with an actionable recommendation.',
  },
  evaluationCriteria: ['Correct aggregation grain', 'Reconciled totals', 'Evidence and limitations reported'],
}];
