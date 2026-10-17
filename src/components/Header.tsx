import { Zap, GitCompareArrows, Download, Share2, CalendarClock, ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

interface HeaderProps {
  presets: { name: string; description: string }[];
  selectedPreset: number;
  onSelectPreset: (i: number) => void;
  onAutoBalance: () => void;
  onCompare: () => void;
  onExport: () => void;
  onShare: () => void;
  shared: boolean;
}

export default function Header({
  presets, selectedPreset, onSelectPreset, onAutoBalance, onCompare, onExport, onShare, shared,
}: HeaderProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <header className="border-b border-slate-800/80 bg-slate-950/90 backdrop-blur sticky top-0 z-30">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2.5 mr-auto">
          <div className="relative">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-sky-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <CalendarClock className="w-5 h-5 text-white" />
            </div>
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping opacity-75" />
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-rose-500" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-slate-100 leading-tight tracking-tight">
              CronsCollision
            </h1>
            <p className="text-[11px] text-slate-400 leading-tight hidden sm:block">
              Cron Overlap &amp; Server Load Visualizer
            </p>
          </div>
        </div>

        {/* Preset selector */}
        <div className="relative" ref={ref}>
          <button
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/70 hover:bg-slate-700/70 border border-slate-700 text-sm text-slate-200 transition-colors"
          >
            <span className="text-slate-400">Preset:</span>
            <span className="font-medium">{presets[selectedPreset]?.name}</span>
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
          {open && (
            <div className="absolute right-0 mt-2 w-80 rounded-xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/50 overflow-hidden z-50">
              {presets.map((p, i) => (
                <button
                  key={p.name}
                  onClick={() => { onSelectPreset(i); setOpen(false); }}
                  className={`w-full text-left px-4 py-3 hover:bg-slate-800 transition-colors border-b border-slate-800 last:border-0 ${
                    i === selectedPreset ? 'bg-indigo-500/10' : ''
                  }`}
                >
                  <div className="text-sm font-medium text-slate-100">{p.name}</div>
                  <div className="text-xs text-slate-400 mt-0.5 leading-snug">{p.description}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onAutoBalance}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-sm font-semibold transition-all shadow-lg shadow-amber-500/20"
          >
            <Zap className="w-4 h-4" />
            Auto-Balance
          </button>
          <button
            onClick={onCompare}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm transition-colors border border-slate-700"
          >
            <GitCompareArrows className="w-4 h-4" />
            Compare Diff
          </button>
          <button
            onClick={onShare}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm transition-colors border border-slate-700"
          >
            <Share2 className="w-4 h-4" />
            {shared ? 'Link Copied!' : 'Share Link'}
          </button>
          <button
            onClick={onExport}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm transition-colors border border-slate-700"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>
    </header>
  );
}
