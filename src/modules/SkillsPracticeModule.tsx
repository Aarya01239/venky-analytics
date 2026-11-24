import React, { useEffect, useRef, useState } from 'react';

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
const button = 'px-3 py-2 rounded border border-slate-400 hover:bg-blue-600 hover:text-white';
export function SkillsPracticeModule() {
  const [mode,setMode]=useState<'typing'|'shortcuts'>('typing');
  const [index,setIndex]=useState(0);
  const [input,setInput]=useState('');
  const [start,setStart]=useState(0);
  const [elapsed,setElapsed]=useState(0);
  const [keystrokes, setKeystrokes] = useState({ total: 0, errors: 0 });
  const [attempts,setAttempts]=useState(0);
  const [correct,setCorrect]=useState(0);
  const [feedback,setFeedback]=useState('');
  const [history,setHistory]=useState<number[]>(()=>{try {
    const saved: unknown = JSON.parse(localStorage.getItem('vos.typing.history') || '[]');
    return Array.isArray(saved) ? saved.filter((score): score is number => typeof score === 'number' && Number.isFinite(score) && score >= 0).slice(0, 30) : [];
  } catch { return []; }});
  const area=useRef<HTMLTextAreaElement>(null);
  const target=drills[index%drills.length];
  const done=input===target;
  const matches=[...input].filter((c,i)=>c===target[i]).length;
  const wpm=elapsed>0?Math.round(matches/5*60/elapsed):0;
  useEffect(()=>{if(!start||done||mode!=='typing')return;const id=window.setInterval(()=>setElapsed((Date.now()-start)/1000),200);return()=>clearInterval(id)},[start,done,mode]);
  function reset(next:number){setIndex(next);setInput('');setStart(0);setElapsed(0);setFeedback('');setKeystrokes({total:0,errors:0})}
  const shortcut=shortcuts[index%shortcuts.length];
  const accuracy = keystrokes.total ? Math.round(100 * (keystrokes.total - keystrokes.errors) / keystrokes.total) : 100;
  const chord = [shortcut.meta ? 'Windows' : '', shortcut.ctrl ? 'Ctrl' : '', shortcut.shift ? 'Shift' : '', shortcut.key.toUpperCase()].filter(Boolean);
  const [simulation, setSimulation] = useState<string[]>([]);
  useEffect(() => setSimulation([]), [index, mode]);

  function scoreShortcut(ok: boolean) {
    setAttempts(value => value + 1);
    if (ok) setCorrect(value => value + 1);
    setFeedback(ok ? 'Correct!' : 'Try again.');
  }

  function updateTyping(value: string) {
    const now = Date.now();
    const began = start || now;
    let firstChange = 0;
    while (firstChange < input.length && input[firstChange] === value[firstChange]) firstChange++;
    let oldEnd = input.length;
    let newEnd = value.length;
    while (oldEnd > firstChange && newEnd > firstChange && input[oldEnd - 1] === value[newEnd - 1]) {
      oldEnd--;
      newEnd--;
    }
    const typed = value.slice(firstChange, newEnd);
    const errors = [...typed].filter((character, offset) => character !== target[firstChange + offset]).length;
    setKeystrokes(previous => ({ total: previous.total + typed.length, errors: previous.errors + errors }));
    setStart(began);
    setInput(value);
    const seconds = Math.max((now - began) / 1000, 1);
    setElapsed(seconds);
    if (value === target) {
      const score = Math.round(target.length * 12 / seconds);
      const next = [score, ...history].slice(0, 30);
      setHistory(next);
      try { localStorage.setItem('vos.typing.history', JSON.stringify(next)); } catch { /* Storage is optional. */ }
    }
  }

  return <section className="p-6 space-y-5 max-w-4xl mx-auto">
    <h1 className="text-2xl font-bold">Keyboard Skills Lab</h1>
    <div className="flex gap-2"><button className={button} onClick={()=>{setMode('typing');reset(0)}}>Typing Studio</button><button className={button} onClick={()=>{setMode('shortcuts');reset(0)}}>Shortcut Trainer</button></div>
    {mode==='typing'?<>
      <p>Type the sample exactly. Practice English, SQL, Python and Excel.</p>
      <div className="font-mono text-xl whitespace-pre-wrap break-all p-4 border rounded">{[...target].map((c,i)=><span key={i} className={i>=input.length?'opacity-60':input[i]===c?'text-green-500':'text-red-500 underline'}>{c}</span>)}</div>
      <textarea ref={area} aria-label="Typing exercise" className="w-full border rounded p-3 bg-transparent font-mono" value={input} disabled={done} onPaste={e => e.preventDefault()} onDrop={e => e.preventDefault()} autoComplete="off" autoCorrect="off" spellCheck={false} onChange={e => updateTyping(e.target.value)}/>
      <div className="flex flex-wrap gap-5"><span>WPM: {wpm}</span><span>Accuracy: {accuracy}%</span><span>Raw WPM: {elapsed ? Math.round(keystrokes.total * 12 / elapsed) : 0}</span><span>Time: {elapsed.toFixed(1)}s</span><span>Best completed WPM: {Math.max(0,...history)}</span></div>
      {done&&<p role="status">Exercise complete!</p>}
      <button className={button} onClick={()=>{reset(index+1);window.setTimeout(()=>area.current?.focus(),0)}}>Next exercise</button>
      <button className={button} onClick={()=>reset(index)}>Retry</button>
    </>:<>
      <p>{shortcut.app}: {shortcut.task}</p>
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
        <div tabIndex={0} aria-label="Shortcut practice area" className="border rounded p-8 focus:ring-2 focus:ring-blue-500" onKeyDown={event => {
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
      <p>Correct attempts: {correct}/{attempts}</p>
      <button className={button} onClick={()=>setFeedback(chord.join(' + '))}>Reveal</button>
      <button className={button} onClick={()=>reset(index+1)}>Next shortcut</button>
    </>}
  </section>;
}
