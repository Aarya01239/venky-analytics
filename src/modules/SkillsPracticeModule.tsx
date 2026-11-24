import React, { useEffect, useRef, useState } from 'react';

const drills = [
  'The quick brown fox jumps over the lazy dog.',
  'SELECT region, SUM(revenue) FROM sales GROUP BY region;',
  'df.groupby("region")["revenue"].sum()',
  '=SUMIFS(C2:C100,A2:A100,"North")',
  'The monthly revenue increased by 12 percent.',
];
const shortcuts = [
  {app:'Excel', task:'Toggle filters', key:'l', ctrl:true, shift:true},
  {app:'Excel', task:'Format cells', key:'1', ctrl:true, shift:false},
  {app:'Excel', task:'Insert table', key:'t', ctrl:true, shift:false},
  {app:'VS Code', task:'Find in files', key:'f', ctrl:true, shift:true},
  {app:'Jupyter', task:'Run cell and advance', key:'enter', ctrl:false, shift:true},
  {app:'SQL Studio', task:'Run selected query', key:'enter', ctrl:true, shift:false},
  {app:'Word', task:'Bold selected text', key:'b', ctrl:true, shift:false},
];
const button = 'px-3 py-2 rounded border border-slate-400 hover:bg-blue-600 hover:text-white';
export function SkillsPracticeModule() {
  const [mode,setMode]=useState<'typing'|'shortcuts'>('typing');
  const [index,setIndex]=useState(0);
  const [input,setInput]=useState('');
  const [start,setStart]=useState(0);
  const [elapsed,setElapsed]=useState(0);
  const [attempts,setAttempts]=useState(0);
  const [correct,setCorrect]=useState(0);
  const [feedback,setFeedback]=useState('');
  const [history,setHistory]=useState<number[]>(()=>{try{return JSON.parse(localStorage.getItem('vos.typing.history')||'[]')}catch{return []}});
  const area=useRef<HTMLTextAreaElement>(null);
  const target=drills[index%drills.length];
  const done=input===target;
  const matches=[...input].filter((c,i)=>c===target[i]).length;
  const wpm=elapsed>0?Math.round(matches/5*60/elapsed):0;
  useEffect(()=>{if(!start||done||mode!=='typing')return;const id=window.setInterval(()=>setElapsed((Date.now()-start)/1000),200);return()=>clearInterval(id)},[start,done,mode]);
  function reset(next:number){setIndex(next);setInput('');setStart(0);setElapsed(0);setFeedback('')}
  const shortcut=shortcuts[index%shortcuts.length];
  return <section className="p-6 space-y-5 max-w-4xl mx-auto">
    <h1 className="text-2xl font-bold">Keyboard Skills Lab</h1>
    <div className="flex gap-2"><button className={button} onClick={()=>{setMode('typing');reset(0)}}>Typing Studio</button><button className={button} onClick={()=>{setMode('shortcuts');reset(0)}}>Shortcut Trainer</button></div>
    {mode==='typing'?<>
      <p>Type the sample exactly. Practice English, SQL, Python and Excel.</p>
      <div className="font-mono text-xl whitespace-pre-wrap break-all p-4 border rounded">{[...target].map((c,i)=><span key={i} className={i>=input.length?'opacity-60':input[i]===c?'text-green-500':'text-red-500 underline'}>{c}</span>)}</div>
      <textarea ref={area} aria-label="Typing exercise" className="w-full border rounded p-3 bg-transparent font-mono" value={input} disabled={done} onPaste={e=>e.preventDefault()} onChange={e=>{const v=e.target.value;const now=Date.now();const began=start||now;setStart(began);setInput(v);const seconds=Math.max((now-began)/1000,0.1);setElapsed(seconds);if(v===target){const score=Math.round(target.length/5*60/seconds);const next=[score,...history].slice(0,30);setHistory(next);try{localStorage.setItem('vos.typing.history',JSON.stringify(next))}catch{}}}}/>
      <div className="flex flex-wrap gap-5"><span>WPM: {wpm}</span><span>Current accuracy: {input.length?Math.round(matches/input.length*100):100}%</span><span>Time: {elapsed.toFixed(1)}s</span><span>Best completed WPM: {Math.max(0,...history)}</span></div>
      {done&&<p role="status">Exercise complete!</p>}
      <button className={button} onClick={()=>{reset(index+1);window.setTimeout(()=>area.current?.focus(),0)}}>Next exercise</button>
      <button className={button} onClick={()=>reset(index)}>Retry</button>
    </>:<>
      <p>{shortcut.app}: {shortcut.task}</p>
      <p className="text-sm opacity-75">Focus the practice area, then press the shortcut. Browser-reserved combinations may not reach this page; use Reveal and Next if necessary.</p>
      <div tabIndex={0} aria-label="Shortcut practice area" className="border rounded p-8 focus:ring-2 focus:ring-blue-500" onKeyDown={e=>{if(['Control','Shift','Alt','Meta'].includes(e.key)||e.repeat)return;e.preventDefault();e.stopPropagation();const ok=e.key.toLowerCase()===shortcut.key&&e.ctrlKey===shortcut.ctrl&&e.shiftKey===shortcut.shift&&!e.altKey&&!e.metaKey;setAttempts(a=>a+1);if(ok)setCorrect(c=>c+1);setFeedback(ok?'Correct!':'Try again.')}}>Click here to capture keys</div>
      <p role="status">{feedback}</p>
      <p>Correct attempts: {correct}/{attempts}</p>
      <button className={button} onClick={()=>setFeedback([shortcut.ctrl?'Ctrl':'',shortcut.shift?'Shift':'',shortcut.key.toUpperCase()].filter(Boolean).join(' + '))}>Reveal</button>
      <button className={button} onClick={()=>reset(index+1)}>Next shortcut</button>
    </>}
  </section>;
}
