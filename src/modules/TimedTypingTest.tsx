import { useEffect, useRef, useState } from 'react';
import { insertedRange } from './typingInput';

const passages = [
  'The sales team reviewed the monthly report and compared performance across each region.',
  'Before sharing the dashboard, verify the totals and explain any gaps in the source data.',
  'A useful analysis identifies a business question and supports the answer with evidence.',
  'Summarize your recommendation clearly and include the assumptions behind your estimate.',
];
const practiceText = Array.from({ length: 12 }, () => passages.join(' ')).join(' ');
const historyKey = 'vos.typing.timed.v1';
const goalKey = 'vos.typing.dailyGoal.v1';
const dailyKey = 'vos.typing.dailyCount.v1';
const goalOptions = [1, 2, 3, 4, 5];

function practiceDay(date: Date) {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()].join('-');
}

function readGoal() {
  try {
    const saved = Number(localStorage.getItem(goalKey));
    if (goalOptions.includes(saved)) return saved;
  } catch { /* The default goal is available without storage. */ }
  return 3;
}

function readDailyCount(history: Result[], day: string) {
  const recentCount = history.filter(result => practiceDay(new Date(result.date)) === day).length;
  try {
    const saved = JSON.parse(localStorage.getItem(dailyKey) ?? 'null');
    if (saved?.day === day && Number.isSafeInteger(saved.count) && saved.count >= 0) return Math.max(saved.count, recentCount);
  } catch { /* Recover from recent results if available. */ }
  return recentCount;
}
const durations = [30, 60] as const;
type Duration = typeof durations[number];
type Result = { date: string; duration: Duration; wpm: number; accuracy: number };

function readHistory(): Result[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(historyKey) ?? '[]');
    if (Array.isArray(stored)) return stored.filter(result => result &&
      typeof result.date === 'string' && Number.isFinite(Date.parse(result.date)) &&
      durations.includes(result.duration) && Number.isFinite(result.wpm) && result.wpm >= 0 &&
      Number.isFinite(result.accuracy) && result.accuracy >= 0 && result.accuracy <= 100).slice(0, 12);
  } catch { /* Local storage may be unavailable. */ }
  return [];
}

export function TimedTypingTest() {
  const [duration, setDuration] = useState<Duration>(30);
  const [remaining, setRemaining] = useState(30);
  const [running, setRunning] = useState(false);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState(readHistory);
  const [dailyGoal, setDailyGoal] = useState(readGoal);
  const [daily, setDaily] = useState(() => {
    const day = practiceDay(new Date());
    return { day, count: readDailyCount(history, day) };
  });
  const [result, setResult] = useState<Result | null>(null);
  const [notice, setNotice] = useState('');
  const editor = useRef<HTMLTextAreaElement>(null);
  const attempt = useRef({ endsAt: 0, duration: 30 as Duration, value: '', typed: 0, mistakes: 0 });

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      const current = attempt.current;
      const seconds = Math.max(0, Math.ceil((current.endsAt - performance.now()) / 1000));
      setRemaining(seconds);
      if (seconds || !current.endsAt) return;

      current.endsAt = 0;
      const correct = [...current.value].filter((character, index) => character === practiceText[index]).length;
      const completed = {
        date: new Date().toISOString(),
        duration: current.duration,
        wpm: Math.round(correct * 12 / current.duration),
        accuracy: current.typed ? Math.round((current.typed - current.mistakes) * 100 / current.typed) : 0,
      };
      setRunning(false);
      if (!current.typed) {
        setNotice('Time is up. Type at least one character to record a result.');
        return;
      }
      setResult(completed);
      const next = [completed, ...history].slice(0, 12);
      setHistory(next);
      const day = practiceDay(new Date(completed.date));
      const count = Math.max(daily.day === day ? daily.count : 0, readDailyCount(history, day)) + 1;
      const summary = { day, count };
      setDaily(summary);
      try {
        localStorage.setItem(historyKey, JSON.stringify(next));
        localStorage.setItem(dailyKey, JSON.stringify(summary));
      } catch { setNotice('This browser could not save the result after reload.'); }
    }, 100);
    return () => window.clearInterval(timer);
  }, [running, history, daily]);

  useEffect(() => {
    if (running) editor.current?.focus();
  }, [running]);

  useEffect(() => {
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    const timer = window.setTimeout(() => {
      const day = practiceDay(new Date());
      setDaily({ day, count: readDailyCount(history, day) });
    }, Math.max(1, midnight.getTime() - Date.now()));
    return () => window.clearTimeout(timer);
  }, [daily.day, history]);

  function start() {
    attempt.current = { endsAt: performance.now() + duration * 1000, duration, value: '', typed: 0, mistakes: 0 };
    setInput('');
    setRemaining(duration);
    setNotice('');
    setResult(null);
    setRunning(true);
  }

  function updateInput(value: string) {
    const current = attempt.current;
    if (!current.endsAt || performance.now() >= current.endsAt) return;
    const { start, end } = insertedRange(current.value, value);
    for (let index = start; index < end; index++) {
      current.typed++;
      if (value[index] !== practiceText[index]) current.mistakes++;
    }
    current.value = value;
    setInput(value);
  }

  const visibleFrom = Math.max(0, Math.floor(input.length / 80) * 80 - 40);
  const completedToday = daily.day === practiceDay(new Date()) ? daily.count : 0;
  const comparable = history.filter(entry => entry.duration === duration);
  const bestRecent = Math.max(0, ...comparable.map(entry => entry.wpm));
  const action = 'px-3 py-2 rounded border border-slate-400 hover:bg-blue-600 hover:text-white';

  return <section className="space-y-4">
    <h2 className="text-xl font-semibold">Timed typing test</h2>
    <p className="text-sm">Type the passage until the timer ends. Accuracy counts corrected mistakes. WPM uses the correct characters remaining at the end.</p>
    <div className="flex flex-wrap items-center gap-3">
      <label>Duration <select aria-label="Test duration" className="rounded border bg-transparent p-1" value={duration} disabled={running} onChange={event => {
        const selected = Number(event.target.value) as Duration;
        setDuration(selected);
        setRemaining(selected);
      }}>
        {durations.map(seconds => <option key={seconds} value={seconds}>{seconds} seconds</option>)}
      </select></label>
      {running ? <button className={action} onClick={() => {
        attempt.current.endsAt = 0;
        setRunning(false);
        setRemaining(duration);
        setNotice('Test cancelled.');
      }}>Cancel test</button> : <button className={action} onClick={start}>Start timed test</button>}
      <output aria-label="Typing test time remaining">{remaining}s</output>
    </div>
    <p className="rounded border p-4 font-mono whitespace-pre-wrap" aria-label="Timed passage">
      {[...practiceText.slice(visibleFrom, visibleFrom + 200)].map((character, offset) => {
        const index = visibleFrom + offset;
        return <span key={index} className={index >= input.length ? '' : input[index] === character ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400 underline'}>{character}</span>;
      })}
    </p>
    <textarea ref={editor} aria-label="Timed typing input" className="w-full rounded border bg-transparent p-3 font-mono" value={input}
      disabled={!running} maxLength={practiceText.length} autoComplete="off" autoCorrect="off" spellCheck={false}
      onPaste={event => event.preventDefault()} onDrop={event => event.preventDefault()}
      onChange={event => updateInput(event.target.value)} />
    <div role="status">{result && <p>Test complete · {result.wpm} WPM · {result.accuracy}% accuracy</p>}{notice && <p>{notice}</p>}</div>
    <section className="space-y-2 rounded border p-4">
      <h3 className="font-semibold">Daily practice goal</h3>
      <label>Tests per day <select aria-label="Tests per day" className="rounded border bg-transparent p-1" value={dailyGoal} onChange={event => {
        const next = Number(event.target.value);
        setDailyGoal(next);
        try { localStorage.setItem(goalKey, String(next)); }
        catch { setNotice('This browser could not save the goal after reload.'); }
      }}>
        {goalOptions.map(goal => <option key={goal} value={goal}>{goal}</option>)}
      </select></label>
      <p>{completedToday} of {dailyGoal} timed tests completed today{completedToday >= dailyGoal ? ' · Goal reached' : ''}</p>
      <progress className="w-full" aria-label="Daily practice progress" max={dailyGoal} value={Math.min(dailyGoal, completedToday)} />
    </section>
    <section className="space-y-2">
      <h3 className="font-semibold">Recent timed results · {duration}s</h3>
      {comparable.length ? <>
        <p className="text-sm">Best recent result: {bestRecent} WPM</p>
        <ul className="divide-y">
          {comparable.map((entry, index) => <li key={entry.date + index} className="space-y-1 py-2 text-sm">
            <p>{entry.duration}s · {entry.wpm} WPM · {entry.accuracy}% accuracy · <time dateTime={entry.date}>{new Date(entry.date).toLocaleDateString()}</time></p>
            <div className="h-2 overflow-hidden rounded bg-slate-200 dark:bg-slate-800" aria-hidden="true">
              <div className="h-full bg-blue-600 dark:bg-blue-400" style={{ width: `${bestRecent ? entry.wpm / bestRecent * 100 : 0}%` }} />
            </div>
          </li>)}
        </ul>
      </> : <p className="text-sm">Complete a {duration}-second test to see progress for this duration.</p>}
    </section>
  </section>;
}
