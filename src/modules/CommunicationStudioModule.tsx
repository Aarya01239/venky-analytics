import { useEffect, useRef, useState } from 'react';
import { createRecognition, speak, stopSpeech, type BrowserRecognition } from '../utils/browserSpeech';

const scenarios = [
  ['Self-introduction', 'Introduce yourself in 60 seconds and explain why you are moving from sales to analytics.', 'Start with your current role, give one verified example, and explain what you want to do next.'],
  ['Stakeholder meeting', 'Merchant activation dropped this month. What would you ask the business manager before starting your analysis?', 'Clarify the definition of activation, the baseline, the period, and the decision your analysis should support.'],
  ['Dashboard presentation', 'Explain what you would tell a manager if transactions rose while active merchants fell.', 'Lead with the observation, separate possible explanations from verified findings, and suggest a next check.'],
  ['Behavioral interview', 'Tell me about a time you handled a customer concern under pressure.', 'Use Situation, Task, Action, and Result. Describe your own actions and give a measurable result if you have one.'],
  ['Client call', 'Confirm the scope and deadline for a merchant retention report with a client.', 'Restate the deliverable, confirm the date and owner, and summarize the next step.'],
];

interface PracticeSummary {
  scenario: string;
  date: string;
  seconds: number;
}

const historyKey = 'vos.communication.history.v1';

function readPracticeHistory(): PracticeSummary[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(historyKey) ?? '[]');
    if (Array.isArray(saved)) {
      return saved.filter(entry => entry && typeof entry.scenario === 'string' &&
        typeof entry.date === 'string' && Number.isFinite(Date.parse(entry.date)) &&
        Number.isInteger(entry.seconds) && entry.seconds > 0).slice(0, 20);
    }
  } catch { /* Practice can continue without local storage. */ }
  return [];
}

const button = 'px-3 py-2 rounded-md border border-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50';

export function CommunicationStudioModule() {
  const [scenario, setScenario] = useState(0);
  const [minutes, setMinutes] = useState(40);
  const [endsAt, setEndsAt] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [history, setHistory] = useState(readPracticeHistory);
  const [remaining, setRemaining] = useState(0);
  const [rate, setRate] = useState(0.9);
  const [answer, setAnswer] = useState('');
  const [status, setStatus] = useState('');
  const [listening, setListening] = useState(false);
  const [feedback, setFeedback] = useState(false);
  const recognition = useRef<BrowserRecognition | null>(null);
  const [title, prompt, rubric] = scenarios[scenario];

  useEffect(() => () => {
    const active = recognition.current;
    recognition.current = null;
    active?.abort();
    stopSpeech();
  }, []);

  useEffect(() => {
    if (!endsAt) return;
    const timer = window.setInterval(() => {
      const seconds = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setRemaining(seconds);
      if (!seconds) setEndsAt(0);
    }, 250);
    return () => window.clearInterval(timer);
  }, [endsAt]);

  function finishSession() {
    if (!startedAt) return;
    const seconds = Math.max(0, Math.round((Math.min(Date.now(), startedAt + minutes * 60_000) - startedAt) / 1000));
    setEndsAt(0);
    setStartedAt(0);
    setRemaining(0);
    if (!seconds) return;
    const next = [{ scenario: title, date: new Date().toISOString(), seconds }, ...history].slice(0, 20);
    setHistory(next);
    try {
      localStorage.setItem(historyKey, JSON.stringify(next));
      setStatus('Practice time saved.');
    } catch {
      setStatus('Practice time is available until the page reloads. This browser blocked local storage.');
    }
  }

  function listen() {
    if (recognition.current) return;
    const active = createRecognition();
    if (!active) {
      setStatus('Microphone transcription is unavailable in this browser. Speak aloud and type your answer to keep practicing.');
      return;
    }
    stopSpeech();
    recognition.current = active;
    active.lang = 'en-IN';
    active.onresult = event => {
      if (recognition.current === active) {
        const transcript = event.results[0]?.[0]?.transcript;
        if (transcript) setAnswer(previous => [previous.trim(), transcript].filter(Boolean).join(' '));
      }
    };
    active.onerror = event => {
      if (recognition.current === active) setStatus('Microphone transcription failed (' + event.error + '). You can type your answer.');
    };
    active.onend = () => {
      if (recognition.current !== active) return;
      recognition.current = null;
      setListening(false);
    };
    try {
      setStatus('');
      active.start();
      setListening(true);
    } catch {
      recognition.current = null;
      setStatus('Could not start the microphone. Try typing your answer.');
    }
  }

  function play(text: string, language: 'en' | 'te' = 'en') {
    setStatus('');
    speak(text, language, rate, setStatus);
  }

  return <section className="p-4 sm:p-6 space-y-5 max-w-3xl mx-auto">
    <h1 className="text-2xl font-bold">Communication Studio</h1>
    <p className="text-sm">Listen to a prompt, speak your answer, then review the transcript against the practice rubric.</p>
    <div className="flex flex-wrap items-center gap-3">
      <label>Session minutes <input className="w-16 border rounded bg-transparent p-1" type="number" min="1" max="120" value={minutes} onChange={event => setMinutes(event.target.valueAsNumber || 0)} disabled={!!startedAt} /></label>
      <button className={button} disabled={minutes < 1 || minutes > 120 || !Number.isInteger(minutes)} onClick={() => {
        if (startedAt) finishSession();
        else {
          const now = Date.now();
          setStartedAt(now);
          setRemaining(minutes * 60);
          setEndsAt(now + minutes * 60_000);
        }
      }}>{startedAt ? 'Save and end session' : 'Start session'}</button>
      <output aria-label="Time remaining">{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</output>
    </div>
    <label className="block">Scenario <select className="border rounded bg-transparent p-1" disabled={listening || !!startedAt} value={scenario} onChange={event => {
      setScenario(Number(event.target.value));
      setAnswer('');
      setFeedback(false);
      stopSpeech();
    }}>{scenarios.map(([name], index) => <option key={name} value={index}>{name}</option>)}</select></label>
    <div className="p-4 border rounded-md space-y-3">
      <h2 className="font-semibold">{title}</h2>
      <p>{prompt}</p>
      <div className="flex flex-wrap gap-2">
        <button className={button} disabled={listening} onClick={() => play(prompt)}>Play prompt</button>
        <button className={button} disabled={listening} onClick={() => play('ముందుగా ప్రశ్న వినండి. మీ సమాధానాన్ని ఒక ఉదాహరణతో స్పష్టంగా చెప్పండి.', 'te')}>Telugu guidance</button>
        <button className={button} onClick={stopSpeech}>Stop playback</button>
      </div>
      <p lang="te" className="text-sm">ముందుగా ప్రశ్న వినండి. మీ సమాధానాన్ని ఒక ఉదాహరణతో స్పష్టంగా చెప్పండి.</p>
      <p className="text-sm">Munduga prashna vinandi. Mee samadhananni oka udaharanatho spashtanga cheppandi.</p>
      <label className="text-sm">Playback speed <input type="range" min="0.6" max="1.4" step="0.1" value={rate} onChange={event => setRate(Number(event.target.value))} /></label>
    </div>
    <div className="space-y-2">
      <p className="text-sm">Microphone practice uses turn-by-turn browser transcription, which may use your browser provider's speech service. This app keeps the transcript in this session and does not record audio.</p>
      <button className={button} onClick={() => listening ? recognition.current?.stop() : listen()}>{listening ? 'Stop microphone' : 'Start microphone'}</button>
      <p role="status">{status}</p>
      <label className="block">Your transcript <textarea className="block w-full rounded border bg-transparent p-3" rows={5} value={answer} onChange={event => setAnswer(event.target.value)} /></label>
      <div className="flex flex-wrap gap-2">
        <button className={button} disabled={!answer.trim() || listening} onClick={() => play(answer)}>Read transcript aloud</button>
        <button className={button} onClick={() => setFeedback(value => !value)}>{feedback ? 'Hide rubric' : 'Review rubric'}</button>
      </div>
      {feedback && <p className="p-3 border rounded">{rubric}</p>}
    </div>
    <section className="space-y-2">
      <h2 className="font-semibold">Recent practice</h2>
      <p className="text-sm">History records elapsed session time. Transcripts stay in the current session.</p>
      {history.length ? <ul className="divide-y">
        {history.map(({ scenario, date, seconds }) => <li key={date} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
          <span>{scenario} · {Math.floor(seconds / 60)}m {seconds % 60}s</span>
          <time dateTime={date}>{new Date(date).toLocaleDateString()}</time>
        </li>)}
      </ul> : <p className="text-sm">Start and save a session to build your practice history.</p>}
    </section>
  </section>;
}
