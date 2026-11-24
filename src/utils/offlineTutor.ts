import type { AiLanguage } from '../types/os';

const exercises: Record<string, [string, string]> = {
  sql: ['Identify the output grain, then check join keys for duplicates before aggregating. Try counting rows before and after each join.', 'Munduga output lo okko row denini suchistundo nirnayinchandi. Join mundu, tarvata row counts polchandi.'],
  excel: ['Test the formula on one row. Check whether references should move when copied, then test a blank cell and an error case.', 'Munduga oka row lo formula test cheyyandi. Copy chesinappudu references maaralo chudandi. Khali cell tho kuda test cheyyandi.'],
  python: ['Inspect shape, data types and missing values before transforming the data. Verify each step on a small sample.', 'Data marchadaniki mundu shape, data types, missing values chudandi. Chinna sample meeda prati step test cheyyandi.'],
  statistics: ['Write the question, outcome variable and sampling assumptions. Check effect size and uncertainty before making a recommendation.', 'Research question, outcome variable, sampling assumptions rayandi. Recommendation mundu effect size, uncertainty chudandi.'],
  ba: ['Write one measurable acceptance criterion, then test it with a normal case and an edge case.', 'Kolavagalige oka acceptance criterion rayandi. Normal case mariyu edge case tho test cheyyandi.'],
};

export function offlinePractice(module: string, language: AiLanguage): string {
  const [english, telugu] = exercises[module] ?? [
    'State the business question, choose a measurable metric, and identify the data you need to validate your conclusion.',
    'Business question rayandi. Kolavagalige metric enchukoni, conclusion verify cheyyadaniki kavalsina data gurthinchatam practice cheyyandi.',
  ];
  if (language === 'telugu') return telugu;
  return language === 'bilingual' ? english + '\n\n' + telugu : english;
}
