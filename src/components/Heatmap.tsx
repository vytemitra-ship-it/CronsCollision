import { useMemo, useState } from 'react';
import { Clock, Eye, Cpu, Layers, Zap } from 'lucide-react';
import type { CollisionStats, CronJob, CpuStats } from '@/utils/cronEngine';
import { minuteToTime } from '@/utils/cronEngine';

interface HeatmapProps {
  stats: CollisionStats;
  cpuStats: CpuStats;
  jobs: CronJob[];
}

type ViewMode = 'full' | 'collisions' | 'hour';
type LoadMode = 'jobs' | 'cpu';

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

const CPU_COLOR = (cpu: number): string => {
  if (cpu === 0) return 'bg-slate-800/60';
  if (cpu <= 30) return 'bg-emerald-500';
  if (cpu <= 60) return 'bg-sky-500';
  if (cpu <= 85) return 'bg-amber-500';
  return 'bg-rose-500';
};

const CPU_GLOW = (cpu: number): string => {
  if (cpu > 100) return 'shadow-[0_0_8px_rgba(244,63,94,0.9)] animate-pulse';
  if (cpu > 85) return 'shadow-[0_0_5px_rgba(245,158,11,0.6)]';
  return '';
};

export default function Heatmap({ stats, cpuStats, jobs }: HeatmapProps) {
  const [view, setView] = useState<ViewMode>('full');
  const [loadMode, setLoadMode] = useState<LoadMode>('jobs');
  const [hoverMinute, setHoverMinute] = useState<number | null>(null);
  const [selectedMinute, setSelectedMinute] = useState<number | null>(stats.peakMinute);
  const [zoomHour, setZoomHour] = useState(0);

  const activeMinute = hoverMinute ?? selectedMinute ?? stats.peakMinute;
  const inspection = stats.inspections[activeMinute];

  const valueByMinute = loadMode === 'cpu' ? cpuStats.cpuByMinute : stats.loadByMinute;
  const peakValue = loadMode === 'cpu' ? cpuStats.peakCpu : stats.peakLoad;

  // SVG sparkline path — smooth area curve
  const sparklinePath = useMemo(() => {
    const W = 1000;
    const H = 80;
    const maxVal = Math.max(peakValue, 1);
    const points: string[] = [];
    for (let i = 0; i < 1440; i++) {
      const x = (i / 1439) * W;
      const v = loadMode === 'cpu' ? cpuStats.cpuByMinute[i] : stats.loadByMinute[i];
      const y = H - (v / maxVal) * H * 0.85;
      points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    const linePath = `M ${points.join(' L ')}`;
    const areaPath = `${linePath} L ${W},${H} L 0,${H} Z`;
    return { linePath, areaPath, W, H };
  }, [stats, cpuStats, loadMode, peakValue]);

  const hourCounts = useMemo(() => {
    const arr = new Array(24).fill(0);
    for (let i = 0; i < 1440; i++) arr[Math.floor(i / 60)] = Math.max(arr[Math.floor(i / 60)], valueByMinute[i]);
    return arr;
  }, [valueByMinute]);

  const visibleMinutes = useMemo(() => {
    if (view === 'hour') return Array.from({ length: 60 }, (_, i) => zoomHour * 60 + i);
    if (view === 'collisions') return Array.from({ length: 1440 }, (_, i) => i).filter((m) => valueByMinute[m] >= (loadMode === 'cpu' ? 60 : 2));
    return Array.from({ length: 1440 }, (_, i) => i);
  }, [view, zoomHour, valueByMinute, loadMode]);

  const cellColor = loadMode === 'cpu' ? CPU_COLOR : LOAD_COLOR;
  const cellGlow = loadMode === 'cpu' ? CPU_GLOW : LOAD_GLOW;
  const cellValue = (m: number) => valueByMinute[m];
  const cellLabel = (m: number) => loadMode === 'cpu'
    ? `${minuteToTime(m)} — ${Math.round(cellValue(m))}% CPU`
    : `${minuteToTime(m)} — ${cellValue(m)} jobs`;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3.5 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2.5 mb-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-indigo-400" />
          <h2 className="text-sm font-semibold text-slate-100">24-Hour Collision Heatmap</h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Load mode toggle */}
          <div className="flex items-center gap-1 bg-slate-800/60 rounded-lg p-1 border border-slate-700/60">
            <button
              onClick={() => setLoadMode('jobs')}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                loadMode === 'jobs' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3 h-3" />
              Job Count
            </button>
            <button
              onClick={() => setLoadMode('cpu')}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                loadMode === 'cpu' ? 'bg-rose-500 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Cpu className="w-3 h-3" />
              CPU %
            </button>
          </div>
          {/* View mode toggle */}
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
      </div>

      {/* CPU overload warning */}
      {loadMode === 'cpu' && cpuStats.overloadMinutes > 0 && (
        <div className="flex items-center gap-2 mb-2.5 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 animate-pulse">
          <Zap className="w-3.5 h-3.5 text-rose-400" />
          <span className="text-xs text-rose-300 font-medium">
            Server Overload Risk: {cpuStats.overloadMinutes} min ({cpuStats.overloadPct.toFixed(1)}% of day) exceed 100% CPU — OOM/throttling likely
          </span>
        </div>
      )}

      {/* SVG Sparkline area chart */}
      <div className="mb-2.5 rounded-lg border border-slate-800/60 bg-slate-950/40 overflow-hidden">
        <svg
          viewBox={`0 0 ${sparklinePath.W} ${sparklinePath.H}`}
          preserveAspectRatio="none"
          className="w-full h-14"
        >
          <defs>
            <linearGradient id="loadGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={loadMode === 'cpu' ? '#f43f5e' : '#6366f1'} stopOpacity="0.5" />
              <stop offset="100%" stopColor={loadMode === 'cpu' ? '#f43f5e' : '#6366f1'} stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="overloadLine" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.3" />
            </linearGradient>
          </defs>
          {/* 100% CPU reference line */}
          {loadMode === 'cpu' && (
            <line
              x1="0" y1={80 - (100 / Math.max(peakValue, 100)) * 80 * 0.85}
              x2={sparklinePath.W}
              y2={80 - (100 / Math.max(peakValue, 100)) * 80 * 0.85}
              stroke="#ef4444"
              strokeWidth="1"
              strokeDasharray="4 3"
              opacity="0.5"
            />
          )}
          <path d={sparklinePath.areaPath} fill="url(#loadGradient)" className="transition-all duration-500" />
          <path
            d={sparklinePath.linePath}
            fill="none"
            stroke={loadMode === 'cpu' ? '#f43f5e' : '#818cf8'}
            strokeWidth="1.5"
            className="transition-all duration-500"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <div className="flex justify-between px-2 -mt-1 text-[9px] text-slate-500 font-mono">
          <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>23:59</span>
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
      <div className="mb-2.5">
        <div className="flex gap-[2px]">
          {hourCounts.map((c, h) => (
            <button
              key={h}
              onClick={() => { setView('hour'); setZoomHour(h); }}
              className={`flex-1 h-6 rounded-sm ${cellColor(c)} ${cellGlow(c)} hover:ring-2 hover:ring-indigo-400 transition-all relative group`}
              title={`${h.toString().padStart(2, '0')}:00 — peak ${loadMode === 'cpu' ? Math.round(c) + '% CPU' : c + ' jobs'}`}
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
      <div className="mb-3">
        <div className="flex flex-wrap gap-[1px] leading-none">
          {visibleMinutes.map((m) => {
            const val = cellValue(m);
            const isActive = m === activeMinute;
            return (
              <div
                key={m}
                onMouseEnter={() => setHoverMinute(m)}
                onClick={() => setSelectedMinute(m)}
                className={`w-[6px] h-3 rounded-[1px] cursor-pointer transition-all duration-200 ${cellColor(val)} ${cellGlow(val)} ${
                  isActive ? 'ring-2 ring-white/80 scale-y-125' : 'hover:scale-y-110'
                }`}
                title={cellLabel(m)}
              />
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-3">
        {loadMode === 'jobs' ? (
          [
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
          ))
        ) : (
          [
            { c: 'bg-slate-800/60', l: '0%' },
            { c: 'bg-emerald-500', l: '<30%' },
            { c: 'bg-sky-500', l: '30-60%' },
            { c: 'bg-amber-500', l: '60-85%' },
            { c: 'bg-rose-500', l: '>85%' },
            { c: 'bg-rose-500 animate-pulse', l: '>100% OOM' },
          ].map((x) => (
            <div key={x.l} className="flex items-center gap-1.5">
              <span className={`w-3 h-3 rounded-sm ${x.c}`} />
              <span className="text-[11px] text-slate-400">{x.l}</span>
            </div>
          ))
        )}
      </div>

      {/* Inspection panel */}
      {inspection && (
        <div className="rounded-xl border border-slate-700/70 bg-slate-950/60 p-3 transition-all">
          <div className="flex items-center gap-2 mb-1.5">
            <Eye className="w-4 h-4 text-indigo-400" />
            <span className="text-sm font-mono font-semibold text-slate-100">{minuteToTime(inspection.minute)}</span>
            <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${
              loadMode === 'cpu'
                ? (cellValue(activeMinute) > 100 ? 'bg-rose-500/20 text-rose-300'
                  : cellValue(activeMinute) > 85 ? 'bg-amber-500/20 text-amber-300'
                  : cellValue(activeMinute) > 60 ? 'bg-sky-500/20 text-sky-300'
                  : cellValue(activeMinute) > 0 ? 'bg-emerald-500/20 text-emerald-300'
                  : 'bg-slate-700/40 text-slate-400')
                : (inspection.count >= 4 ? 'bg-rose-500/20 text-rose-300'
                  : inspection.count === 3 ? 'bg-amber-500/20 text-amber-300'
                  : inspection.count === 2 ? 'bg-sky-500/20 text-sky-300'
                  : inspection.count === 1 ? 'bg-emerald-500/20 text-emerald-300'
                  : 'bg-slate-700/40 text-slate-400')
            }`}>
              {loadMode === 'cpu'
                ? `${Math.round(cellValue(activeMinute))}% CPU${cellValue(activeMinute) > 100 ? ' — OVERLOAD' : ''}`
                : `${inspection.count} concurrent ${inspection.count === 1 ? 'job' : 'jobs'}`}
            </span>
          </div>
          {inspection.jobs.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {inspection.jobs.map((j) => {
                const job = jobs.find((x) => x.id === j.id);
                return (
                  <span
                    key={j.id}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-800/70 border border-slate-700/60 text-[11px] text-slate-200"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                    {j.label}
                    {job && (
                      <span className="text-slate-500 text-[10px]">
                        {job.durationMin > 1 ? `${job.durationMin}m ` : ''}{job.weight === 'heavy' ? 'heavy' : job.weight === 'medium' ? 'med' : 'light'}
                      </span>
                    )}
                  </span>
                );
              })}
            </div>
          ) : (
            <p className="text-[11px] text-slate-500">No jobs running at this minute.</p>
          )}
        </div>
      )}
    </div>
  );
}
