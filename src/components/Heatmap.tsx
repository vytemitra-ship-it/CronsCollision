import { useMemo, useState } from 'react';
import { Clock, Eye } from 'lucide-react';
import type { CollisionStats, CronJob } from '@/utils/cronEngine';
import { minuteToTime } from '@/utils/cronEngine';

interface HeatmapProps {
  stats: CollisionStats;
  jobs: CronJob[];
}

type ViewMode = 'full' | 'collisions' | 'hour';

const LOAD_COLOR = (n: number): string => {
  if (n === 0) return 'bg-slate-800/60';
  if (n === 1) return 'bg-emerald-500';
  if (n === 2) return 'bg-sky-500';
  if (n === 3) return 'bg-amber-500';
  return 'bg-rose-500';
};

const LOAD_GLOW = (n: number): string => {
  if (n >= 4) return 'shadow-[0_0_6px_rgba(244,63,94,0.7)] animate-pulse';
  if (n === 3) return 'shadow-[0_0_4px_rgba(245,158,11,0.5)]';
  return '';
};

export default function Heatmap({ stats, jobs }: HeatmapProps) {
  const [view, setView] = useState<ViewMode>('full');
  const [hoverMinute, setHoverMinute] = useState<number | null>(null);
  const [selectedMinute, setSelectedMinute] = useState<number | null>(stats.peakMinute);
  const [zoomHour, setZoomHour] = useState(0);

  const activeMinute = hoverMinute ?? selectedMinute ?? stats.peakMinute;
  const inspection = stats.inspections[activeMinute];

  const hourCounts = useMemo(() => {
    const arr = new Array(24).fill(0);
    for (let i = 0; i < 1440; i++) arr[Math.floor(i / 60)] = Math.max(arr[Math.floor(i / 60)], stats.loadByMinute[i]);
    return arr;
  }, [stats]);

  const visibleMinutes = useMemo(() => {
    if (view === 'hour') {
      return Array.from({ length: 60 }, (_, i) => zoomHour * 60 + i);
    }
    if (view === 'collisions') {
      return Array.from({ length: 1440 }, (_, i) => i).filter((m) => stats.loadByMinute[m] >= 2);
    }
    return Array.from({ length: 1440 }, (_, i) => i);
  }, [view, zoomHour, stats]);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-indigo-400" />
          <h2 className="text-sm font-semibold text-slate-100">24-Hour Collision Heatmap</h2>
        </div>
        <div className="flex items-center gap-1.5 bg-slate-800/60 rounded-lg p-1 border border-slate-700/60">
          {(['full', 'collisions', 'hour'] as ViewMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setView(m)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                view === m ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {m === 'full' ? 'Full 24h' : m === 'collisions' ? 'Collisions Only' : 'Zoom to Hour'}
            </button>
          ))}
        </div>
      </div>

      {view === 'hour' && (
        <div className="flex items-center gap-1.5 mb-3 flex-wrap">
          <span className="text-xs text-slate-400 mr-1">Hour:</span>
          {Array.from({ length: 24 }, (_, i) => (
            <button
              key={i}
              onClick={() => setZoomHour(i)}
              className={`w-8 h-7 rounded text-[10px] font-mono transition-colors ${
                zoomHour === i ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {i.toString().padStart(2, '0')}
            </button>
          ))}
        </div>
      )}

      {/* Hour overview bar */}
      <div className="mb-3">
        <div className="flex gap-[2px]">
          {hourCounts.map((c, h) => (
            <button
              key={h}
              onClick={() => { setView('hour'); setZoomHour(h); }}
              className={`flex-1 h-8 rounded-sm ${LOAD_COLOR(c)} ${LOAD_GLOW(c)} hover:ring-2 hover:ring-indigo-400 transition-all relative group`}
              title={`${h.toString().padStart(2, '0')}:00 — peak ${c} jobs`}
            >
              <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[8px] text-slate-500 font-mono opacity-0 group-hover:opacity-100">
                {h.toString().padStart(2, '0')}
              </span>
            </button>
          ))}
        </div>
        <div className="flex justify-between mt-1.5 text-[9px] text-slate-500 font-mono px-0.5">
          <span>00</span><span>06</span><span>12</span><span>18</span><span>23</span>
        </div>
      </div>

      {/* Minute heatmap bar */}
      <div className="mb-4">
        <div className="flex flex-wrap gap-[1px] leading-none">
          {visibleMinutes.map((m) => {
            const load = stats.loadByMinute[m];
            const isActive = m === activeMinute;
            return (
              <div
                key={m}
                onMouseEnter={() => setHoverMinute(m)}
                onClick={() => setSelectedMinute(m)}
                className={`w-[6px] h-3.5 rounded-[1px] cursor-pointer transition-all ${LOAD_COLOR(load)} ${LOAD_GLOW(load)} ${
                  isActive ? 'ring-2 ring-white/80 scale-y-125' : 'hover:scale-y-110'
                }`}
                title={`${minuteToTime(m)} — ${load} jobs`}
              />
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-4">
        {[
          { c: 'bg-slate-800/60', l: '0 jobs' },
          { c: 'bg-emerald-500', l: '1 job' },
          { c: 'bg-sky-500', l: '2 jobs' },
          { c: 'bg-amber-500', l: '3 jobs' },
          { c: 'bg-rose-500', l: '4+ jobs' },
        ].map((x) => (
          <div key={x.l} className="flex items-center gap-1.5">
            <span className={`w-3 h-3 rounded-sm ${x.c}`} />
            <span className="text-[11px] text-slate-400">{x.l}</span>
          </div>
        ))}
      </div>

      {/* Inspection panel */}
      {inspection && (
        <div className="rounded-xl border border-slate-700/70 bg-slate-950/60 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Eye className="w-4 h-4 text-indigo-400" />
            <span className="text-sm font-mono font-semibold text-slate-100">{minuteToTime(inspection.minute)}</span>
            <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${
              inspection.count >= 4 ? 'bg-rose-500/20 text-rose-300'
              : inspection.count === 3 ? 'bg-amber-500/20 text-amber-300'
              : inspection.count === 2 ? 'bg-sky-500/20 text-sky-300'
              : inspection.count === 1 ? 'bg-emerald-500/20 text-emerald-300'
              : 'bg-slate-700/40 text-slate-400'
            }`}>
              {inspection.count} concurrent {inspection.count === 1 ? 'job' : 'jobs'}
            </span>
          </div>
          {inspection.jobs.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {inspection.jobs.map((j) => {
                const job = jobs.find((x) => x.id === j.id);
                return (
                  <span
                    key={j.id}
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-800/70 border border-slate-700/60 text-xs text-slate-200"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                    {j.label}
                    {job && job.durationMin > 1 && (
                      <span className="text-slate-500 text-[10px]">{job.durationMin}m</span>
                    )}
                  </span>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-500">No jobs running at this minute.</p>
          )}
        </div>
      )}
    </div>
  );
}
