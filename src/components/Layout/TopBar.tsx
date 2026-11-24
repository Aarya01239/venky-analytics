import React, { useState } from 'react';
import { Bell, Moon, Search, Sparkles, Sun, Database } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { NAV_ITEMS } from './Sidebar';
import { CAREER_TRACKS } from '../../data/careerTracks';

export const TopBar: React.FC = () => {
  const {
    activeModule,
    activeCareerTrack,
    datasets,
    activeDatasetId,
    setActiveDatasetId,
    theme,
    toggleTheme,
    setSearchOpen,
    aiOpen,
    setAiOpen,
    notifications,
    markNotificationsRead,
  } = useWorkspace();

  const [notifOpen, setNotifOpen] = useState(false);

  const currentNav = NAV_ITEMS.find((i) => i.id === activeModule);
  const currentTrack = CAREER_TRACKS.find((c) => c.id === activeCareerTrack);
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <header className="h-14 shrink-0 px-5 flex items-center justify-between gap-6 border-b border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0F1722]">
      {/* Zone 1: Contextual Breadcrumb & Active Dataset */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2 text-sm min-w-0">
          <span className="text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0">
            {currentTrack?.shortTitle || 'Analytics'}
          </span>
          <span className="text-slate-300 dark:text-slate-700">/</span>
          <span className="font-display font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap truncate">
            {currentNav?.label || 'Dashboard'}
          </span>
        </div>

        <div className="hidden lg:flex items-center gap-1.5 pl-3 border-l border-slate-200 dark:border-slate-800">
          <Database className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <select
            aria-label="Active workspace dataset"
            value={activeDatasetId}
            onChange={(e) => setActiveDatasetId(e.target.value)}
            className="text-xs font-medium bg-transparent text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer max-w-[230px] truncate"
          >
            {datasets.map((ds) => (
              <option key={ds.id} value={ds.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                {ds.name} ({ds.row_count} rows)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Zone 2: Global Search Trigger */}
      <div className="flex-1 max-w-md hidden md:block">
        <button
          onClick={() => setSearchOpen(true)}
          className="w-full flex items-center justify-between gap-3 px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B111A] text-xs text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
        >
          <span className="flex items-center gap-2 truncate">
            <Search className="w-3.5 h-3.5 shrink-0" />
            <span>Search modules, datasets, SQL scripts, careers...</span>
          </span>
          <kbd className="font-mono text-[11px] text-slate-400 dark:text-slate-500 shrink-0">Ctrl K</kbd>
        </button>
      </div>

      {/* Zone 3: Utilities & Primary Gemini Action */}
      <div className="flex items-center gap-2 shrink-0 relative">
        <button
          onClick={() => setSearchOpen(true)}
          aria-label="Global search"
          className="md:hidden p-2 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <Search className="w-4 h-4" />
        </button>

        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          aria-label="Toggle theme"
          className="p-2 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <div className="relative">
          <button
            onClick={() => {
              setNotifOpen((v) => !v);
              markNotificationsRead();
            }}
            aria-label="Notifications"
            className="p-2 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors relative"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 text-[9px] font-mono font-bold text-blue-600 dark:text-blue-400">
                {unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 mt-2 w-80 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111926] shadow-lg z-50 overflow-hidden">
              <div className="px-3.5 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">Notifications</span>
                <button
                  onClick={() => setNotifOpen(false)}
                  className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                >
                  Close
                </button>
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
                {notifications.length === 0 ? (
                  <div className="p-4 text-xs text-slate-500 text-center">No notifications yet.</div>
                ) : (
                  notifications.map((n) => (
                    <div key={n.id} className="px-3.5 py-2.5 text-xs">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{n.title}</div>
                      <div className="text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">{n.message}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => setAiOpen(!aiOpen)}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
            aiOpen
              ? 'bg-blue-700 text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Gemini AI</span>
        </button>
      </div>
    </header>
  );
};
