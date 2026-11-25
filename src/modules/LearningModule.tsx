import React, { useState } from 'react';
import { CheckCircle2, Play, Sparkles, BookOpen } from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { LEARNING_CURRICULUM, LearningLesson } from '../data/curriculum';

export const LearningModule: React.FC = () => {
  const { learningProgress, refreshWorkspace, setActiveModule, pushNotification, askGeminiWithPrompt } = useWorkspace();

  const [levelFilter, setLevelFilter] = useState<'All' | 'Beginner' | 'Intermediate' | 'Advanced' | 'Professional'>('All');
  const [activeLesson, setActiveLesson] = useState<LearningLesson>(LEARNING_CURRICULUM[0]);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [quizChecked, setQuizChecked] = useState(false);

  const filtered = LEARNING_CURRICULUM.filter((l) => levelFilter === 'All' || l.level === levelFilter);

  const getRecord = (topicId: string) => learningProgress.find((p) => p.topic_id === topicId);

  const saveProgress = async (lesson: LearningLesson, status: 'in_progress' | 'completed', score: number) => {
    await fetch('/api/learning', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic_id: lesson.id,
        level: lesson.level,
        status,
        score,
        time_spent_min: lesson.durationMin,
      }),
    });
    await refreshWorkspace();
    if (status === 'completed') {
      pushNotification('Lesson Completed', `Marked "${lesson.title}" complete (${score}% accuracy).`, 'success');
    }
  };

  const handleCheckQuiz = async () => {
    if (selectedOption === null) return;
    setQuizChecked(true);
    const isCorrect = selectedOption === activeLesson.quiz.correctIndex;
    await saveProgress(activeLesson, isCorrect ? 'completed' : 'in_progress', isCorrect ? 100 : 50);
  };

  const completedCount = LEARNING_CURRICULUM.filter(lesson => learningProgress.some(record => record.topic_id === lesson.id && record.status === 'completed')).length;

  return (
    <div className="p-6 max-w-[1440px] mx-auto space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-display font-bold text-slate-900 dark:text-slate-100">
            Structured Learning Management System
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Beginner → Intermediate → Advanced → Professional · Persistent completion, quiz accuracy, and direct studio exercises.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono tabular-nums">
          <span>Completed: <strong>{completedCount} / {LEARNING_CURRICULUM.length}</strong></span>
          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#0F1722] border border-slate-200 dark:border-slate-800 font-sans">
            {(['All', 'Beginner', 'Intermediate', 'Advanced', 'Professional'] as const).map((lvl) => (
              <button
                key={lvl}
                onClick={() => setLevelFilter(lvl)}
                className={`px-2.5 py-1 rounded text-xs font-medium ${
                  levelFilter === lvl ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100' : 'text-slate-500'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Curriculum Tree */}
        <div className="lg:col-span-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] p-3 space-y-1.5">
          {filtered.map((lesson) => {
            const rec = getRecord(lesson.id);
            const active = lesson.id === activeLesson.id;
            return (
              <button
                key={lesson.id}
                onClick={() => {
                  setActiveLesson(lesson);
                  setSelectedOption(null);
                  setQuizChecked(false);
                }}
                className={`w-full text-left p-3 rounded-md border text-xs transition-colors ${
                  active
                    ? 'border-blue-600 bg-blue-600/10'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{lesson.title}</span>
                  {rec?.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {lesson.track} · {lesson.level} · {lesson.durationMin}m
                </div>
              </button>
            );
          })}
        </div>

        {/* Active Lesson Content */}
        <div className="lg:col-span-8 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] p-6 space-y-5 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div>
              <div className="text-[11px] text-slate-500">
                {activeLesson.track} · {activeLesson.level} · {activeLesson.durationMin} min
              </div>
              <h2 className="text-lg font-display font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                {activeLesson.title}
              </h2>
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <button
                onClick={() => setActiveModule(activeLesson.targetModule)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Practice in Studio</span>
              </button>
              <button
                onClick={() => saveProgress(activeLesson, 'completed', 100)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-emerald-500/50 text-emerald-600 dark:text-emerald-400 font-medium hover:bg-emerald-500/10"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Mark Complete</span>
              </button>
              <button
                onClick={() =>
                  askGeminiWithPrompt(
                    `Explain "${activeLesson.title}" with an extra real-world enterprise example and a short Telugu explanation.`,
                    'learn'
                  )
                }
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-blue-500/40 text-blue-600 dark:text-blue-400"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Tutor (EN / తెలుగు)</span>
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-blue-500" />
              <span>Concept Explanation</span>
            </div>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[13px]">{activeLesson.explanation}</p>
          </div>

          <div className="space-y-1.5">
            <div className="font-semibold text-slate-900 dark:text-slate-100">Production Example</div>
            <pre className="p-3.5 rounded-md bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto">
              {activeLesson.exampleCode}
            </pre>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3.5 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B111A]">
              <div className="font-semibold text-slate-900 dark:text-slate-100 mb-1">Guided Exercise</div>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{activeLesson.guidedExercise}</p>
            </div>
            <div className="p-3.5 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B111A]">
              <div className="font-semibold text-slate-900 dark:text-slate-100 mb-1">Independent Assignment</div>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{activeLesson.independentAssignment}</p>
            </div>
            <div className="p-3.5 rounded-md border border-slate-200 dark:border-slate-800">
              <div className="font-semibold text-slate-900 dark:text-slate-100 mb-1">Real-World Application</div>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{activeLesson.realWorldApp}</p>
            </div>
            <div className="p-3.5 rounded-md border border-slate-200 dark:border-slate-800">
              <div className="font-semibold text-slate-900 dark:text-slate-100 mb-1">Interview Relevance</div>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{activeLesson.interviewRelevance}</p>
            </div>
          </div>

          {/* Interactive Assessment */}
          <div className="p-4 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B111A] space-y-3">
            <div className="font-semibold text-slate-900 dark:text-slate-100">Quick Assessment</div>
            <div className="text-slate-800 dark:text-slate-200 font-medium">{activeLesson.quiz.question}</div>
            <div className="space-y-1.5">
              {activeLesson.quiz.options.map((opt, idx) => (
                <label key={idx} className="flex items-center gap-2 cursor-pointer py-1">
                  <input
                    type="radio"
                    name={`quiz_${activeLesson.id}`}
                    checked={selectedOption === idx}
                    onChange={() => {
                      setSelectedOption(idx);
                      setQuizChecked(false);
                    }}
                  />
                  <span className="text-slate-700 dark:text-slate-300">{opt}</span>
                </label>
              ))}
            </div>
            <button
              onClick={handleCheckQuiz}
              disabled={selectedOption === null}
              className="px-4 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-medium"
            >
              Submit Answer
            </button>

            {quizChecked && (
              <div
                className={`p-3 rounded text-xs ${
                  selectedOption === activeLesson.quiz.correctIndex
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                    : 'bg-red-500/10 text-red-700 dark:text-red-300 border border-red-500/30'
                }`}
              >
                <strong>
                  {selectedOption === activeLesson.quiz.correctIndex ? 'Correct! ' : 'Review needed: '}
                </strong>
                {activeLesson.quiz.rationale}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
