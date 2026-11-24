import type { AiLanguage } from '../types/os';

const exercises: Record<string, [string, string]> = {
  sql: ['Identify the output grain, then check join keys for duplicates before aggregating. Try counting rows before and after each join.', 'Munduga output lo okko row denini suchistundo nirnayinchandi. Join mundu, tarvata row counts polchandi.'],
  excel: ['Test the formula on one row. Check whether references should move when copied, then test a blank cell and an error case.', 'Munduga oka row lo formula test cheyyandi. Copy chesinappudu references maaralo chudandi. Khali cell tho kuda test cheyyandi.'],
  python: ['Inspect shape, data types and missing values before transforming the data. Verify each step on a small sample.', 'Data marchadaniki mundu shape, data types, missing values chudandi. Chinna sample meeda prati step test cheyyandi.'],
  statistics: ['Write the question, outcome variable and sampling assumptions. Check effect size and uncertainty before making a recommendation.', 'Research question, outcome variable, sampling assumptions rayandi. Recommendation mundu effect size, uncertainty chudandi.'],
  ba: ['Write one measurable acceptance criterion, then test it with a normal case and an edge case.', 'Kolavagalige oka acceptance criterion rayandi. Normal case mariyu edge case tho test cheyyandi.'],
};

const teluguScript: Record<string, string> = {
  sql: 'ముందుగా ఫలితంలో ఒక్కో వరుస దేనిని సూచిస్తుందో నిర్ణయించండి. డేటాను కలపడానికి ముందు, తర్వాత వరుసల సంఖ్యను పోల్చండి.',
  excel: 'ముందుగా ఒక వరుసలో ఫార్ములాను పరీక్షించండి. కాపీ చేసినప్పుడు సెల్ రిఫరెన్సులు మారాలో చూడండి. ఖాళీ సెల్‌తో కూడా పరీక్షించండి.',
  python: 'డేటాను మార్చడానికి ముందు వరుసల సంఖ్య, డేటా రకాలు, ఖాళీ విలువలను చూడండి. చిన్న నమూనాతో ప్రతి దశను పరీక్షించండి.',
  statistics: 'పరిశోధన ప్రశ్న, ఫలితాన్ని కొలిచే విలువ, నమూనా అంచనాలను రాయండి. సిఫారసు చేసే ముందు ప్రభావం ఎంత ఉందో, అంచనాలో అనిశ్చితి ఎంత ఉందో చూడండి.',
  ba: 'పరీక్షించగల ఒక అంగీకార ప్రమాణాన్ని రాయండి. సాధారణ పరిస్థితితో పాటు అసాధారణ పరిస్థితిలో కూడా దానిని పరీక్షించండి.',
};

export function offlinePractice(module: string, language: AiLanguage): string {
  const [english, telugu] = exercises[module] ?? [
    'State the business question, choose a measurable metric, and identify the data you need to validate your conclusion.',
    'Business question rayandi. Kolavagalige metric enchukoni, conclusion verify cheyyadaniki kavalsina data gurthinchatam practice cheyyandi.',
  ];
  if (language === 'english') return english;
  const script = teluguScript[module] ?? 'వ్యాపార ప్రశ్నను రాయండి. దాన్ని కొలిచే ప్రమాణాన్ని ఎంచుకోండి. మీ నిర్ణయాన్ని పరీక్షించడానికి కావలసిన డేటాను గుర్తించండి.';
  const localized = script + '\n\n' + telugu;
  return language === 'bilingual' ? english + '\n\n' + localized : localized;
}
