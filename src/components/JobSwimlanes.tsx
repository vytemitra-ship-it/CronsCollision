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

const NUDGE_VALUES = [-15, -5, -1, 1, 5, 15];

export default function JobSwimlanes({ jobs, stats, onDurationChange, onWeightChange, onNudge }: JobSwimlanesProps) {
  return (
    <div className="flex flex-col h-full rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-800 bg-slate-900/80">
        <Layers className="w-4 h-4 text-indigo-400" />
        <h3 className="text-sm font-semibold text-slate-100">Job Swimlanes</h3>
        <span className="ml-auto text-xs text-slate-500">{jobs.length} jobs</span>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
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
    <div className="px-4 py-3 hover:bg-slate-800/30 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-slate-100 truncate">{job.label}</span>
            <code className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/20">
              {job.expression}
            </code>
          </div>
          <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-400">
            <span className="flex items-center gap-1"><Clock3 className="w-3 h-3" />{humanSummary(job)}</span>
            <span className="flex items-center gap-1"><Repeat className="w-3 h-3" />{job.dailyRuns}×/day</span>
          </div>
        </div>
        <button
          onClick={() => onWeightChange(job.id, nextWeight)}
          className={`shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] font-medium transition-colors hover:scale-105 ${ws.bg} ${ws.text}`}
          title={`CPU impact: ${WEIGHT_CPU[job.weight]}% — click to change`}
        >
          <Cpu className="w-3 h-3" />
          {ws.label} {WEIGHT_CPU[job.weight]}%
        </button>
      </div>

      {/* Swimlane strip */}
      <div className="relative h-5 rounded-md bg-slate-950/60 border border-slate-800/60 overflow-hidden mb-2.5 transition-all">
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

      {/* Duration slider + nudge controls */}
      <div className="flex items-center gap-3 mb-2">
        <Gauge className="w-3.5 h-3.5 text-slate-500 shrink-0" />
        <input
          type="range"
          min={1}
          max={60}
          value={job.durationMin}
          onChange={(e) => onDurationChange(job.id, parseInt(e.target.value, 10))}
          className="flex-1 accent-indigo-500 h-1.5"
        />
        <span className="text-xs font-mono text-slate-300 w-12 text-right">{job.durationMin}m</span>
      </div>

      {/* Nudge buttons */}
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-slate-500 mr-1 shrink-0">Offset:</span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => onNudge(job.id, -15)}
            className="flex items-center gap-0.5 px-1.5 py-1 rounded bg-slate-800 hover:bg-indigo-500/20 hover:text-indigo-300 text-slate-400 text-[10px] font-mono transition-colors"
            title="Shift -15 minutes"
          >
            <ChevronLeft className="w-3 h-3" />15m
          </button>
          <button
            onClick={() => onNudge(job.id, -5)}
            className="px-1.5 py-1 rounded bg-slate-800 hover:bg-indigo-500/20 hover:text-indigo-300 text-slate-400 text-[10px] font-mono transition-colors"
            title="Shift -5 minutes"
          >
            -5m
          </button>
          <button
            onClick={() => onNudge(job.id, -1)}
            className="px-1.5 py-1 rounded bg-slate-800 hover:bg-indigo-500/20 hover:text-indigo-300 text-slate-400 text-[10px] font-mono transition-colors"
            title="Shift -1 minute"
          >
            -1m
          </button>
          <button
            onClick={() => onNudge(job.id, 1)}
            className="px-1.5 py-1 rounded bg-slate-800 hover:bg-indigo-500/20 hover:text-indigo-300 text-slate-400 text-[10px] font-mono transition-colors"
            title="Shift +1 minute"
          >
            +1m
          </button>
          <button
            onClick={() => onNudge(job.id, 5)}
            className="px-1.5 py-1 rounded bg-slate-800 hover:bg-indigo-500/20 hover:text-indigo-300 text-slate-400 text-[10px] font-mono transition-colors"
            title="Shift +5 minutes"
          >
            +5m
          </button>
          <button
            onClick={() => onNudge(job.id, 15)}
            className="flex items-center gap-0.5 px-1.5 py-1 rounded bg-slate-800 hover:bg-indigo-500/20 hover:text-indigo-300 text-slate-400 text-[10px] font-mono transition-colors"
            title="Shift +15 minutes"
          >
            15m<ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
