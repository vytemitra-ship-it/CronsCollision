import { Activity, TrendingUp, AlertTriangle, Flame } from 'lucide-react';
import type { CollisionStats } from '@/utils/cronEngine';
import { minuteToTime } from '@/utils/cronEngine';

interface KpiBarProps {
  stats: CollisionStats;
  jobCount: number;
}

export default function KpiBar({ stats, jobCount }: KpiBarProps) {
  const peakColor =
    stats.peakLoad >= 4 ? 'text-rose-400' : stats.peakLoad >= 2 ? 'text-amber-400' : 'text-emerald-400';
  const peakBg =
    stats.peakLoad >= 4 ? 'from-rose-500/20 to-rose-500/5 border-rose-500/30'
    : stats.peakLoad >= 2 ? 'from-amber-500/20 to-amber-500/5 border-amber-500/30'
    : 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/30';

  const peakJobsLabel = stats.jobsAtPeak.length > 3
    ? `${stats.jobsAtPeak.slice(0, 3).map((j) => j.label).join(', ')} +${stats.jobsAtPeak.length - 3} more`
    : stats.jobsAtPeak.map((j) => j.label).join(', ') || '—';

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <KpiCard
        icon={<Activity className="w-5 h-5" />}
        label="Total Active Jobs"
        value={jobCount.toString()}
        sub="valid cron jobs loaded"
        accent="from-sky-500/20 to-sky-500/5 border-sky-500/30 text-sky-400"
      />
      <KpiCard
        icon={<Flame className="w-5 h-5" />}
        label="Peak Concurrent Load"
        value={`${stats.peakLoad}`}
        sub={`jobs at ${minuteToTime(stats.peakMinute)}`}
        accent={peakBg}
        valueClass={peakColor}
      />
      <KpiCard
        icon={<AlertTriangle className="w-5 h-5" />}
        label="Collision Minutes / Day"
        value={stats.collisionMinutes.toString()}
        sub={`${stats.collisionPct.toFixed(1)}% of 1440 min`}
        accent={
          stats.collisionMinutes > 0
            ? 'from-rose-500/20 to-rose-500/5 border-rose-500/30 text-rose-400'
            : 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/30 text-emerald-400'
        }
      />
      <KpiCard
        icon={<TrendingUp className="w-5 h-5" />}
        label="Busiest Time Window"
        value={minuteToTime(stats.peakMinute)}
        sub={peakJobsLabel}
        accent="from-indigo-500/20 to-indigo-500/5 border-indigo-500/30 text-indigo-400"
        truncate
      />
    </div>
  );
}

function KpiCard({
  icon, label, value, sub, accent, valueClass, truncate,
}: {
  icon: React.ReactNode; label: string; value: string; sub: string;
  accent: string; valueClass?: string; truncate?: boolean;
}) {
  return (
    <div className={`relative overflow-hidden rounded-xl border bg-gradient-to-br ${accent} p-4`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">{label}</p>
          <p className={`text-2xl font-bold mt-1 ${valueClass || 'text-slate-100'}`}>{value}</p>
          <p className={`text-xs text-slate-400 mt-1 ${truncate ? 'truncate' : ''}`}>{sub}</p>
        </div>
        <div className="shrink-0 opacity-80">{icon}</div>
      </div>
    </div>
  );
}
