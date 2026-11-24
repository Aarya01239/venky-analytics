import React, { useEffect, useState } from 'react';
import { Clock, Eye, Sparkles, Play, RotateCcw } from 'lucide-react';
import { INTERVIEW_QUESTIONS, InterviewQuestion } from '../data/curriculum';
import { useWorkspace } from '../context/WorkspaceContext';

export const InterviewPrepModule: React.FC = () => {
  const { askGeminiWithPrompt } = useWorkspace();

  const [category, setCategory] = useState<string>('All');
  const [activeQ, setActiveQ] = useState<InterviewQuestion>(INTERVIEW_QUESTIONS[0]);
  const [userAnswer, setUserAnswer] = useState('');
  const [showSolution, setShowSolution] = useState(false);

  // Timed Mock Assessment Countdown (15 min)
  const [timerActive, setTimerActive] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(900);

  useEffect(() => {
    if (!timerActive || secondsLeft <= 0) return;
    const id = window.setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(id);
  }, [timerActive, secondsLeft]);

  const categories = ['All', 'SQL', 'Excel', 'Statistics', 'Power BI & DAX', 'Python', 'Business Case', 'BA Scenarios', 'Product & Marketing'];
  const filtered = INTERVIEW_QUESTIONS.filter((q) => category === 'All' || q.category === category);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;

  return (
    <div className="p-6 max-w-[1440px] mx-auto space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-display font-bold text-slate-900 dark:text-slate-100">
            Analyst Interview Preparation &amp; Timed Mock Lab
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            SQL, Excel, Statistics, DAX, Python, Business Cases, BA Scenarios, and Gemini AI Hiring Manager answer evaluation.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <div className="px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] font-mono tabular-nums flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-blue-500" />
            <span>{String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}</span>
          </div>
          <button
            onClick={() => setTimerActive((v) => !v)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium"
          >
            <Play className="w-3.5 h-3.5" />
            <span>{timerActive ? 'Pause Mock Timer' : 'Start 15m Mock'}</span>
          </button>
          <button
            onClick={() => {
              setTimerActive(false);
              setSecondsLeft(900);
            }}
            className="p-1.5 rounded-md border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Reset timer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Category Filters */}
      <div className="flex items-center gap-1.5 flex-wrap text-xs">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`px-3 py-1.5 rounded-md border font-medium ${
              category === cat
                ? 'border-blue-600 bg-blue-600/10 text-blue-600 dark:text-blue-400'
                : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] p-3 space-y-1.5 max-h-[600px] overflow-y-auto">
          {filtered.map((q) => (
            <button
              key={q.id}
              onClick={() => {
                setActiveQ(q);
                setShowSolution(false);
                setUserAnswer('');
              }}
              className={`w-full text-left p-3 rounded-md border text-xs transition-colors ${
                activeQ.id === q.id
                  ? 'border-blue-600 bg-blue-600/10'
                  : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
              }`}
            >
              <div className="text-[11px] text-slate-500">
                {q.category} · {q.role} · {q.difficulty}
              </div>
              <div className="font-medium text-slate-900 dark:text-slate-100 mt-1 line-clamp-2">{q.question}</div>
            </button>
          ))}
        </div>

        <div className="lg:col-span-8 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] p-6 space-y-4 text-xs">
          <div>
            <div className="text-[11px] text-slate-500">
              {activeQ.role} · {activeQ.category} · {activeQ.difficulty}
            </div>
            <h2 className="text-base font-display font-bold text-slate-900 dark:text-slate-100 mt-1 leading-snug">
              {activeQ.question}
            </h2>
          </div>

          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700 dark:text-slate-300">Your Structured Interview Response</label>
            <textarea
              rows={7}
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              placeholder="Write your SQL, formulas, statistical reasoning, or STAR business case response here..."
              className="w-full p-3 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0B111A] text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() =>
                askGeminiWithPrompt(
                  `Evaluate my interview answer as a Senior Analytics Hiring Manager.\nQuestion (${activeQ.role} - ${activeQ.category}): ${activeQ.question}\nCandidate Answer:\n${
                    userAnswer || '(No draft yet — coach me on how to structure a top 1% answer)'
                  }\nGrade across: Technical Accuracy, Business Framing, Edge Cases, and Communication clarity.`,
                  'interview'
                )
              }
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Evaluate My Answer with Gemini</span>
            </button>
            <button
              onClick={() => setShowSolution((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{showSolution ? 'Hide Model Answer' : 'Reveal Key Points & Model Answer'}</span>
            </button>
          </div>

          {showSolution && (
            <div className="p-4 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B111A] space-y-3">
              <div>
                <div className="font-semibold text-slate-900 dark:text-slate-100 mb-1">Interviewer Key Checkpoints</div>
                <ul className="space-y-1 text-slate-600 dark:text-slate-400">
                  {activeQ.keyPoints.map((kp) => <li key={kp}>· {kp}</li>)}
                </ul>
              </div>
              <div>
                <div className="font-semibold text-slate-900 dark:text-slate-100 mb-1">Senior-Level Model Answer</div>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{activeQ.modelAnswer}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
