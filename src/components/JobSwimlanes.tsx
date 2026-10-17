import { Layers, Clock3, Repeat, Gauge, ChevronLeft, ChevronRight, Cpu } from 'lucide-react';
import type { CronJob, CollisionStats, ResourceWeight } from '@/utils/cronEngine';
import { humanSummary, WEIGHT_CPU } from '@/utils/cronEngine';

interface JobSwimlanesProps {
  jobs: CronJob[];
  stats: CollisionStats;
  onDurationChange: (jobId: string, duration: number) => void;
  onWeightChange: (jobId: string, weight: ResourceWeight) => void;
  onNudge: (jobId: string, deltaMinutes: number) => void;
}

const WEIGHT_STYLES: Record<ResourceWeight, { bg: string; text: string; label: string }> = {
  light: { bg: 'bg-emerald-500/15 border-emerald-500/30', text: 'text-emerald-300', label: 'Light' },
  medium: { bg: 'bg-amber-500/15 border-amber-500/30', text: 'text-amber-300', label: 'Medium' },
  heavy: { bg: 'bg-rose-500/15 border-rose-500/30', text: 'text-rose-300', label: 'Heavy' },
};

export default function JobSwimlanes({ jobs, stats, onDurationChange, onWeightChange, onNudge }: JobSwimlanesProps) {
  return (
    <div className="flex flex-col h-full rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
      <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-2 border-b border-slate-800 bg-slate-900/95 backdrop-blur">
        <Layers className="w-4 h-4 text-indigo-400" />
        <h3 className="text-sm font-semibold text-slate-100">Job Swimlanes</h3>
        <span className="ml-auto text-xs text-slate-500">{jobs.length} jobs</span>
      </div>

      <div className="flex-1 overflow-y-auto cc-scroll divide-y divide-slate-800/60">
        {jobs.length === 0 && (
          <div className="p-8 text-center text-sm text-slate-500">No valid jobs. Add cron lines to the editor.</div>
        )}
        {jobs.map((job) => (
          <JobRow
            key={job.id}
            job={job}
            stats={stats}
            onDurationChange={onDurationChange}
            onWeightChange={onWeightChange}
            onNudge={onNudge}
          />
        ))}
      </div>
    </div>
  );
}

function JobRow({
  job, stats, onDurationChange, onWeightChange, onNudge,
}: {
  job: CronJob;
  stats: CollisionStats;
  onDurationChange: (id: string, d: number) => void;
  onWeightChange: (id: string, w: ResourceWeight) => void;
  onNudge: (id: string, delta: number) => void;
}) {
  const active = new Set<number>();
  const colliding = new Set<number>();
  for (const h of job.hour) {
    for (const m of job.minute) {
      const start = h * 60 + m;
      for (let d = 0; d < job.durationMin; d++) {
        const idx = (start + d) % 1440;
        active.add(idx);
        if (stats.loadByMinute[idx] >= 2) colliding.add(idx);
      }
    }
  }

  const ws = WEIGHT_STYLES[job.weight];
  const weightCycle: ResourceWeight[] = ['light', 'medium', 'heavy'];
  const nextWeight = weightCycle[(weightCycle.indexOf(job.weight) + 1) % 3];

  return (
    <div className="px-3 py-2.5 hover:bg-slate-800/30 transition-colors">
      {/* Row 1: name, cron badge, summary, runs, weight badge */}
      <div className="flex items-center gap-2 flex-wrap mb-1.5">
        <span className="text-xs font-medium text-slate-100 truncate max-w-[160px]">{job.label}</span>
        <code className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/20 shrink-0">
          {job.expression}
        </code>
        <span className="flex items-center gap-0.5 text-[10px] text-slate-500 shrink-0">
          <Clock3 className="w-2.5 h-2.5" />{humanSummary(job)}
        </span>
        <span className="flex items-center gap-0.5 text-[10px] text-slate-500 shrink-0">
          <Repeat className="w-2.5 h-2.5" />{job.dailyRuns}×/day
        </span>
        <button
          onClick={() => onWeightChange(job.id, nextWeight)}
          className={`shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-[9px] font-medium transition-colors hover:scale-105 ${ws.bg} ${ws.text}`}
          title={`CPU impact: ${WEIGHT_CPU[job.weight]}% — click to change`}
        >
          <Cpu className="w-2.5 h-2.5" />
          {ws.label} {WEIGHT_CPU[job.weight]}%
        </button>
      </div>

      {/* Row 2: swimlane strip */}
      <div className="relative h-3.5 rounded bg-slate-950/60 border border-slate-800/60 overflow-hidden mb-2 transition-all">
        {Array.from(active).map((m) => {
          const isCollide = colliding.has(m);
          return (
            <div
              key={m}
              className={`absolute top-0 bottom-0 transition-all duration-300 ${isCollide ? 'bg-rose-500' : 'bg-emerald-500/80'} ${
                isCollide ? 'shadow-[0_0_3px_rgba(244,63,94,0.6)]' : ''
              }`}
              style={{ left: `${(m / 1440) * 100}%`, width: `${100 / 1440 * 1.4}%` }}
            />
          );
        })}
        {[6, 12, 18].map((h) => (
          <div key={h} className="absolute top-0 bottom-0 w-px bg-slate-700/40" style={{ left: `${(h / 24) * 100}%` }} />
        ))}
      </div>

      {/* Row 3: duration slider + nudge buttons on same horizontal row */}
      <div className="flex items-center gap-2">
        <Gauge className="w-3 h-3 text-slate-500 shrink-0" />
        <input
          type="range"
          min={1}
          max={60}
          value={job.durationMin}
          onChange={(e) => onDurationChange(job.id, parseInt(e.target.value, 10))}
          className="w-20 accent-indigo-500 h-1 shrink-0"
        />
        <span className="text-[10px] font-mono text-slate-400 w-7 text-right shrink-0">{job.durationMin}m</span>
        <div className="w-px h-4 bg-slate-700/50 shrink-0" />
        <button onClick={() => onNudge(job.id, -15)} className="flex items-center px-1 py-0.5 rounded bg-slate-800 hover:bg-indigo-500/20 hover:text-indigo-300 text-slate-400 text-[9px] font-mono transition-colors shrink-0" title="Shift -15m">
          <ChevronLeft className="w-2.5 h-2.5" />15
        </button>
        <button onClick={() => onNudge(job.id, -5)} className="px-1 py-0.5 rounded bg-slate-800 hover:bg-indigo-500/20 hover:text-indigo-300 text-slate-400 text-[9px] font-mono transition-colors shrink-0" title="Shift -5m">-5</button>
        <button onClick={() => onNudge(job.id, -1)} className="px-1 py-0.5 rounded bg-slate-800 hover:bg-indigo-500/20 hover:text-indigo-300 text-slate-400 text-[9px] font-mono transition-colors shrink-0" title="Shift -1m">-1</button>
        <button onClick={() => onNudge(job.id, 1)} className="px-1 py-0.5 rounded bg-slate-800 hover:bg-indigo-500/20 hover:text-indigo-300 text-slate-400 text-[9px] font-mono transition-colors shrink-0" title="Shift +1m">+1</button>
        <button onClick={() => onNudge(job.id, 5)} className="px-1 py-0.5 rounded bg-slate-800 hover:bg-indigo-500/20 hover:text-indigo-300 text-slate-400 text-[9px] font-mono transition-colors shrink-0" title="Shift +5m">+5</button>
        <button onClick={() => onNudge(job.id, 15)} className="flex items-center px-1 py-0.5 rounded bg-slate-800 hover:bg-indigo-500/20 hover:text-indigo-300 text-slate-400 text-[9px] font-mono transition-colors shrink-0" title="Shift +15m">
          15<ChevronRight className="w-2.5 h-2.5" />
        </button>
      </div>
    </div>
  );
}
