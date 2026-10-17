import { Layers, Clock3, Repeat, Gauge } from 'lucide-react';
import type { CronJob, CollisionStats } from '@/utils/cronEngine';
import { humanSummary } from '@/utils/cronEngine';

interface JobSwimlanesProps {
  jobs: CronJob[];
  stats: CollisionStats;
  onDurationChange: (jobId: string, duration: number) => void;
}

export default function JobSwimlanes({ jobs, stats, onDurationChange }: JobSwimlanesProps) {
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
          <JobRow key={job.id} job={job} stats={stats} onDurationChange={onDurationChange} />
        ))}
      </div>
    </div>
  );
}

function JobRow({
  job, stats, onDurationChange,
}: {
  job: CronJob; stats: CollisionStats; onDurationChange: (id: string, d: number) => void;
}) {
  // build per-job active minutes (with duration wrap)
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
      </div>

      {/* Swimlane strip */}
      <div className="relative h-5 rounded-md bg-slate-950/60 border border-slate-800/60 overflow-hidden mb-2.5">
        {Array.from(active).map((m) => {
          const isCollide = colliding.has(m);
          return (
            <div
              key={m}
              className={`absolute top-0 bottom-0 ${isCollide ? 'bg-rose-500' : 'bg-emerald-500/80'} ${
                isCollide ? 'shadow-[0_0_3px_rgba(244,63,94,0.6)]' : ''
              }`}
              style={{ left: `${(m / 1440) * 100}%`, width: `${100 / 1440 * 1.4}%` }}
            />
          );
        })}
        {/* hour tick marks */}
        {[6, 12, 18].map((h) => (
          <div key={h} className="absolute top-0 bottom-0 w-px bg-slate-700/40" style={{ left: `${(h / 24) * 100}%` }} />
        ))}
      </div>

      {/* Duration slider */}
      <div className="flex items-center gap-3">
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
    </div>
  );
}
