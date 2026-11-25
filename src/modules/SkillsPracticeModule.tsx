import React, { useEffect, useRef, useState } from 'react';
import { TimedTypingTest } from './TimedTypingTest';
import { insertedRange } from './typingInput';

const drills = [
  'asdf jkl; asdf jkl;',
  '1025 4080 9621 7530',
  'Hi team, please review the attached sales report by Friday.',
  'The quick brown fox jumps over the lazy dog.',
  'SELECT region, SUM(revenue) FROM sales GROUP BY region;',
  'df.groupby("region")["revenue"].sum()',
  '=SUMIFS(C2:C100,A2:A100,"North")',
  'The monthly revenue increased by 12 percent.',
];
type KeyCount = { attempts: number; mistakes: number; timedCorrect?: number; totalResponseMs?: number };
type KeyHistory = Record<string, KeyCount>;
const keyHistoryStorage = 'vos.typing.keys.v1';
const shortcutHistoryStorage = 'vos.shortcuts.history.v1';

function readCounts(storageKey: string, acceptKey: (key: string) => boolean): KeyHistory {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '{}');
    if (!saved || typeof saved !== 'object') return {};
    return Object.fromEntries(Object.entries(saved).filter(([key, count]) =>
      acceptKey(key) && count && Number.isSafeInteger(count.attempts) &&
      Number.isSafeInteger(count.mistakes) && count.attempts > 0 &&
      count.mistakes >= 0 && count.mistakes <= count.attempts));
  } catch { return {}; }
}

function keyLabel(key: string) {
  return key === ' ' ? 'Space' : key;
}

function focusedDrill(key: string) {
  const neighbors = key === ' ' ? ['as', 'df', 'jk', 'l;'] : ['a', 's', 'j', 'l'];
  return neighbors.map(neighbor => neighbor + key + neighbor).join(' ');
}

const shortcuts = [
  {app:'Excel', task:'Toggle filters', key:'l', ctrl:true, shift:true},
  {app:'Excel', task:'Format cells', key:'1', ctrl:true, shift:false},
  {app:'Excel', task:'Insert table', key:'t', ctrl:true, shift:false, reserved:true},
  {app:'VS Code', task:'Find in files', key:'f', ctrl:true, shift:true},
  {app:'Jupyter', task:'Run cell and advance', key:'enter', ctrl:false, shift:true},
  {app:'SQL Studio', task:'Run selected query', key:'enter', ctrl:true, shift:false},
  {app:'Windows 11', task:'Show the desktop', key:'d', ctrl:false, shift:false, meta:true, reserved:true},
  {app:'Chrome', task:'Reopen closed tab', key:'t', ctrl:true, shift:true, reserved:true},
  {app:'Power BI', task:'Save report', key:'s', ctrl:true, shift:false, reserved:true},
  {app:'PowerPoint', task:'Start slide show', key:'f5', ctrl:false, shift:false, reserved:true},
  {app:'Google Sheets', task:'Find and replace (Windows)', key:'h', ctrl:true, shift:false, reserved:true},
  {app:'Google Docs', task:'Italicize selection', key:'i', ctrl:true, shift:false},
  {app:'Word', task:'Bold selected text', key:'b', ctrl:true, shift:false},
];
function shortcutChord(shortcut: typeof shortcuts[number]) {
  return [shortcut.meta ? 'Windows' : '', shortcut.ctrl ? 'Ctrl' : '', shortcut.shift ? 'Shift' : '', shortcut.key.toUpperCase()].filter(Boolean);
}

function searchWords(value: string) {
  return value.toLowerCase().replace(/[+\s]+/g, ' ').trim();
}

const button = 'px-3 py-2 rounded border border-slate-400 hover:bg-blue-600 hover:text-white';
export function SkillsPracticeModule() {
  const [mode,setMode]=useState<'typing'|'shortcuts'|'timed'>('typing');
  const [index,setIndex]=useState(0);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [keyHistory, setKeyHistory] = useState(() => readCounts(keyHistoryStorage, key => /^[ -~]$/.test(key)));
  const [shortcutHistory, setShortcutHistory] = useState(() => readCounts(
    shortcutHistoryStorage,
    key => shortcuts.some(shortcut => shortcut.app + ' · ' + shortcut.task === key),
  ));
  const drillKeys = useRef<KeyHistory>({});
  const [input,setInput]=useState('');
  const [start,setStart]=useState(0);
  const [elapsed,setElapsed]=useState(0);
  const [keystrokes, setKeystrokes] = useState({ total: 0, errors: 0 });
  const [shortcutApp, setShortcutApp] = useState('All apps');
  const [shortcutSearch, setShortcutSearch] = useState('');
  const [timedStart, setTimedStart] = useState(0);
  const [shortcutSeconds, setShortcutSeconds] = useState(10);
  const shortcutArea = useRef<HTMLDivElement>(null);
  const shortcutTask = useRef<HTMLParagraphElement>(null);
  const [attempts,setAttempts]=useState(0);
  const [correct,setCorrect]=useState(0);
  const [feedback,setFeedback]=useState('');
  const [history,setHistory]=useState<number[]>(()=>{try {
    const saved: unknown = JSON.parse(localStorage.getItem('vos.typing.history') || '[]');
    return Array.isArray(saved) ? saved.filter((score): score is number => typeof score === 'number' && Number.isFinite(score) && score >= 0).slice(0, 30) : [];
  } catch { return []; }});
  const area=useRef<HTMLTextAreaElement>(null);
  const target = focusKey === null ? drills[index % drills.length] : focusedDrill(focusKey);
  const weakKeys = Object.entries(keyHistory)
    .filter(([, counts]) => counts.mistakes > 0)
    .sort(([, a], [, b]) => b.mistakes / b.attempts - a.mistakes / a.attempts || b.mistakes - a.mistakes)
    .slice(0, 8);
  const done=input===target;
  const matches=[...input].filter((c,i)=>c===target[i]).length;
  const wpm=elapsed>0?Math.round(matches/5*60/elapsed):0;
  useEffect(()=>{if(!start||done||mode!=='typing')return;const id=window.setInterval(()=>setElapsed((Date.now()-start)/1000),200);return()=>clearInterval(id)},[start,done,mode]);
  function reset(next: number, nextFocus: string | null = null) {
    setIndex(next);
    setFocusKey(nextFocus);
    setInput('');
    setStart(0);
    setElapsed(0);
    setFeedback('');
    setTimedStart(0);
    setShortcutSeconds(10);
    setSimulation([]);
    setKeystrokes({ total: 0, errors: 0 });
    drillKeys.current = {};
  }
  const filteredShortcuts = shortcutApp === 'All apps' ? shortcuts : shortcuts.filter(item => item.app === shortcutApp);
  const shortcut = filteredShortcuts[index % filteredShortcuts.length];
  const shortcutId = shortcut.app + ' · ' + shortcut.task;
  const shortcutStats = shortcutHistory[shortcutId];
  const weakShortcut = filteredShortcuts
    .map((item, position) => ({ position, stats: shortcutHistory[item.app + ' · ' + item.task] }))
    .filter(({ stats }) => stats?.mistakes)
    .sort((a, b) => b.stats.mistakes / b.stats.attempts - a.stats.mistakes / a.stats.attempts)[0];
  const accuracy = keystrokes.total ? Math.round(100 * (keystrokes.total - keystrokes.errors) / keystrokes.total) : 100;
  const chord = shortcutChord(shortcut);
  const terms = searchWords(shortcutSearch).split(' ').filter(Boolean);
  const combination = shortcutSearch.includes('+') ? [...terms].sort().join(' ') : '';
  const matchingShortcuts = filteredShortcuts.filter(item => {
    if (combination) return shortcutChord(item).map(key => key.toLowerCase()).sort().join(' ') === combination;
    const text = searchWords([item.app, item.task, ...shortcutChord(item)].join(' '));
    return terms.every(term => text.includes(term));
  });
  const [simulation, setSimulation] = useState<string[]>([]);
  useEffect(() => setSimulation([]), [index, mode]);

  function scoreShortcut(ok: boolean, expired = false) {
    const responseMs = timedStart ? Math.max(0, performance.now() - timedStart) : 0;
    const timedOut = expired || responseMs >= 10_000;
    const passed = ok && !timedOut;
    const measured = passed && timedStart > 0;
    setAttempts(value => value + 1);
    if (passed) setCorrect(value => value + 1);
    setFeedback(timedOut ? 'Time is up. Try again.' : measured ? `Correct in ${(responseMs / 1000).toFixed(2)}s` : passed ? 'Correct!' : 'Try again.');
    setTimedStart(0);
    if (timedOut) {
      setShortcutSeconds(0);
      setSimulation([]);
    }
    const next = {
      ...shortcutHistory,
      [shortcutId]: {
        attempts: (shortcutStats?.attempts ?? 0) + 1,
        mistakes: (shortcutStats?.mistakes ?? 0) + Number(!passed),
        timedCorrect: (Number.isSafeInteger(shortcutStats?.timedCorrect) ? shortcutStats.timedCorrect! : 0) + Number(measured),
        totalResponseMs: (Number.isFinite(shortcutStats?.totalResponseMs) ? shortcutStats.totalResponseMs! : 0) + (measured ? responseMs : 0),
      },
    };
    setShortcutHistory(next);
    try { localStorage.setItem(shortcutHistoryStorage, JSON.stringify(next)); } catch { /* Storage is optional. */ }
  }

  useEffect(() => {
    if (!timedStart) return;
    const timer = window.setInterval(() => {
      const seconds = Math.max(0, Math.ceil((10_000 - performance.now() + timedStart) / 1000));
      setShortcutSeconds(seconds);
      if (!seconds) {
        window.clearInterval(timer);
        scoreShortcut(false, true);
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, [timedStart]);

  function updateTyping(value: string) {
    const now = Date.now();
    const began = start || now;
    const { start: firstChange, end } = insertedRange(input, value);
    const typed = value.slice(firstChange, end);
    let errors = 0;
    for (let offset = 0; offset < typed.length; offset++) {
      const expected = target[firstChange + offset];
      const missed = typed[offset] !== expected;
      if (missed) errors++;
      if (expected === undefined) continue;
      const count = drillKeys.current[expected] ?? { attempts: 0, mistakes: 0 };
      drillKeys.current[expected] = {
        attempts: count.attempts + 1,
        mistakes: count.mistakes + Number(missed),
      };
    }
    setKeystrokes(previous => ({ total: previous.total + typed.length, errors: previous.errors + errors }));
    setStart(began);
    setInput(value);
    const seconds = Math.max((now - began) / 1000, 1);
    setElapsed(seconds);
    if (value === target) {
      const updatedKeys = { ...keyHistory };
      for (const [key, count] of Object.entries(drillKeys.current)) {
        const prior = updatedKeys[key] ?? { attempts: 0, mistakes: 0 };
        updatedKeys[key] = {
          attempts: prior.attempts + count.attempts,
          mistakes: prior.mistakes + count.mistakes,
        };
      }
      setKeyHistory(updatedKeys);
      try { localStorage.setItem(keyHistoryStorage, JSON.stringify(updatedKeys)); } catch { /* Storage is optional. */ }
      if (focusKey === null) {
        const next = [Math.round(target.length * 12 / seconds), ...history].slice(0, 30);
        setHistory(next);
        try { localStorage.setItem('vos.typing.history', JSON.stringify(next)); } catch { /* Storage is optional. */ }
      }
    }
  }

  return <section className="p-6 space-y-5 max-w-4xl mx-auto">
    <h1 className="text-2xl font-bold">Keyboard Skills Lab</h1>
    <div className="flex flex-wrap gap-2"><button className={button} onClick={()=>{setMode('typing');reset(0)}}>Typing Studio</button><button className={button} onClick={() => { setMode('timed'); reset(0); }}>Timed Test</button><button className={button} onClick={()=>{setMode('shortcuts');reset(0)}}>Shortcut Trainer</button></div>
    {mode === 'timed' ? <TimedTypingTest /> : mode==='typing'?<>
      <p>{focusKey === null ? 'Type the sample exactly. Practice English, SQL, Python and Excel.' : `Focused drill for ${keyLabel(focusKey)}. Type the sample exactly.`}</p>
      <div className="font-mono text-xl whitespace-pre-wrap break-all p-4 border rounded">{[...target].map((c,i)=><span key={i} className={i>=input.length?'opacity-60':input[i]===c?'text-green-500':'text-red-500 underline'}>{c}</span>)}</div>
      <textarea ref={area} aria-label="Typing exercise" className="w-full border rounded p-3 bg-transparent font-mono" value={input} disabled={done} onPaste={e => e.preventDefault()} onDrop={e => e.preventDefault()} autoComplete="off" autoCorrect="off" spellCheck={false} onChange={e => updateTyping(e.target.value)}/>
      <div className="flex flex-wrap gap-5"><span>WPM: {wpm}</span><span>Accuracy: {accuracy}%</span><span>Raw WPM: {elapsed ? Math.round(keystrokes.total * 12 / elapsed) : 0}</span><span>Time: {elapsed.toFixed(1)}s</span><span>Best completed WPM: {Math.max(0,...history)}</span></div>
      {done&&<p role="status">Exercise complete!</p>}
      <button className={button} onClick={()=>{reset(index+1);window.setTimeout(()=>area.current?.focus(),0)}}>Next exercise</button>
      <button className={button} onClick={() => reset(index, focusKey)}>Retry</button>
      <section className="space-y-2">
        <h2 className="font-semibold">Keys to practice</h2>
        {weakKeys.length ? <>
          <p className="text-sm">Mistakes are counted against the expected key in completed drills. Select a key to practice it.</p>
          <ul className="flex flex-wrap gap-2">
            {weakKeys.map(([key, count]) => <li key={key}>
              <button className={button} onClick={() => {
                reset(index, key);
                window.setTimeout(() => area.current?.focus(), 0);
              }} aria-pressed={focusKey === key}>
                <span className="font-mono">{keyLabel(key)}</span> · {count.mistakes}/{count.attempts} missed
              </button>
            </li>)}
          </ul>
        </> : <p className="text-sm">Keys with mistakes will appear here after you finish a drill.</p>}
      </section>
    </>:<>
      <div className="flex flex-wrap items-center gap-3">
        <label>Practice app <select aria-label="Practice app" className="rounded border bg-transparent p-1" value={shortcutApp} onChange={event => {
          setShortcutApp(event.target.value);
          reset(0);
        }}>
          <option>All apps</option>
          {[...new Set(shortcuts.map(item => item.app))].map(app => <option key={app}>{app}</option>)}
        </select></label>
        <button className={button} onClick={() => {
          if (timedStart) {
            setTimedStart(0);
            setShortcutSeconds(10);
            setSimulation([]);
            setFeedback('Timed attempt cancelled.');
            return;
          }
          setTimedStart(performance.now());
          setShortcutSeconds(10);
          setSimulation([]);
          setFeedback('');
          shortcutArea.current?.focus();
        }}>{timedStart ? 'Cancel timed attempt' : 'Start 10-second attempt'}</button>
        {timedStart > 0 && <span aria-label="Shortcut time remaining">{shortcutSeconds}s</span>}
      </div>
      <p ref={shortcutTask} tabIndex={-1}>{shortcut.app}: {shortcut.task}</p>
      {shortcut.reserved ? <>
        <p className="text-sm">Your browser or operating system may handle this shortcut. Select the keys in order to simulate it.</p>
        <div className="flex flex-wrap gap-2">
          {[...new Set(['Ctrl', 'Shift', 'Alt', 'Windows', chord.at(-1)!])].map(key => <button key={key} className={button} onClick={() => {
            const next = [...simulation, key];
            if (next.at(-1) === chord.at(-1)) {
              scoreShortcut(next.join('+') === chord.join('+'));
              setSimulation([]);
            } else setSimulation(simulation.includes(key) ? simulation.filter(value => value !== key) : next);
          }}>{key}</button>)}
        </div>
        <p>Selected: {simulation.join(' + ') || 'None'}</p>
      </> : <>
        <p className="text-sm">Focus the practice area and press the shortcut. Tab moves focus normally.</p>
        <div ref={shortcutArea} tabIndex={0} aria-label="Shortcut practice area" className="border rounded p-8 focus:ring-2 focus:ring-blue-500" onKeyDown={event => {
          if (event.repeat || ['Control', 'Shift', 'Alt', 'Meta', 'Tab', 'Escape'].includes(event.key)) return;
          const key = event.key.toLowerCase();
          if (key !== shortcut.key) {
            if (!event.ctrlKey && !event.altKey && !event.metaKey) scoreShortcut(false);
            return;
          }
          const matches = event.ctrlKey === shortcut.ctrl && event.shiftKey === shortcut.shift && !event.altKey && !event.metaKey;
          if (matches) {
            event.preventDefault();
            event.stopPropagation();
          }
          scoreShortcut(matches);
        }}>Focus here to capture keys</div>
      </>}
      <p role="status">{feedback}</p>
      <p>Correct attempts this visit: {correct}/{attempts}</p>
      {shortcutStats && <p>Saved attempts for this shortcut: {shortcutStats.attempts - shortcutStats.mistakes}/{shortcutStats.attempts} correct</p>}
      {Boolean(shortcutStats?.timedCorrect && Number.isFinite(shortcutStats.totalResponseMs)) && <p>
        Average successful timed response: {(shortcutStats.totalResponseMs! / shortcutStats.timedCorrect! / 1000).toFixed(2)}s
      </p>}
      {weakShortcut && <button className={button} onClick={() => {
        reset(weakShortcut.position);
        setSimulation([]);
      }}>Review lowest-accuracy shortcut</button>}
      <button className={button} disabled={timedStart > 0} onClick={()=>setFeedback(chord.join(' + '))}>Reveal</button>
      <button className={button} onClick={()=>reset(index+1)}>Next shortcut</button>
      <details className="space-y-3 rounded border p-4">
        <summary className="cursor-pointer font-semibold">Shortcut reference</summary>
        <label className="block text-sm">Search shortcuts
          <input className="mt-1 block w-full rounded border bg-transparent p-2" type="search" value={shortcutSearch}
            onChange={event => setShortcutSearch(event.target.value)} placeholder="App, action or key combination" />
        </label>
        {matchingShortcuts.length ? <ul className="divide-y" aria-label="Matching shortcuts">
          {matchingShortcuts.map(item => (
            <li key={item.app + item.task} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div>
                <p className="text-sm font-medium">{item.app} · {item.task}</p>
                <p className="text-sm">{shortcutChord(item).join(' + ')}{item.reserved ? ' · On-screen simulation' : ''}</p>
              </div>
              <button className={button} aria-label={`Practice ${item.app} ${item.task}`} onClick={() => {
                reset(filteredShortcuts.indexOf(item));
                requestAnimationFrame(() => shortcutTask.current?.focus());
              }}>Practice</button>
            </li>
          ))}
        </ul> : <p className="text-sm">No matching shortcuts. Try another search or choose All apps.</p>}
      </details>
    </>}
  </section>;
}
