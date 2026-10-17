import { Zap, X, ArrowRight, Copy, Check, TrendingDown } from 'lucide-react';
import { useState } from 'react';
import type { BalancedResult } from '@/utils/cronEngine';
import { minuteToTime } from '@/utils/cronEngine';

interface DiffModalProps {
  result: BalancedResult;
  onClose: () => void;
  onApply: () => void;
}

export default function DiffModal({ result, onClose, onApply }: DiffModalProps) {
  const [copied, setCopied] = useState(false);
  const { beforeStats, afterStats, changes } = result;
  const drop = beforeStats.peakLoad > 0
    ? Math.round(((beforeStats.peakLoad - afterStats.peakLoad) / beforeStats.peakLoad) * 100)
    : 0;

  const optimizedCrontab = changes.map((c) => {
    const job = result.optimized.find((j) => j.id === c.id)!;
    return `${job.expression} ${job.command || '/usr/bin/run.sh'} # duration:${job.durationMin}m`;
  }).join('\n');

  const copyOptimized = () => {
    navigator.clipboard?.writeText(optimizedCrontab);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-3xl max-h-[88vh] rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-800 bg-gradient-to-r from-amber-500/10 to-transparent">
          <Zap className="w-5 h-5 text-amber-400" />
          <h2 className="text-sm font-semibold text-slate-100">Auto-Balance Results — Before vs After</h2>
          <button onClick={onClose} className="ml-auto p-1 rounded-lg hover:bg-slate-800 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-5">
          {/* Banner */}
          <div className="grid grid-cols-3 gap-3">
            <StatBlock label="Peak Load" before={`${beforeStats.peakLoad}`} after={`${afterStats.peakLoad}`} drop={drop} highlight />
            <StatBlock
              label="Collision Minutes"
              before={`${beforeStats.collisionMinutes}`}
              after={`${afterStats.collisionMinutes}`}
              drop={beforeStats.collisionMinutes > 0
                ? Math.round(((beforeStats.collisionMinutes - afterStats.collisionMinutes) / beforeStats.collisionMinutes) * 100)
                : 0}
            />
            <StatBlock
              label="Peak Time"
              before={minuteToTime(beforeStats.peakMinute)}
              after={minuteToTime(afterStats.peakMinute)}
              drop={0}
              isTime
            />
          </div>

          {changes.length === 0 ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300 text-center">
              Already well-balanced — no changes needed.
            </div>
          ) : (
            <>
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500 font-medium mb-2">
                  Cron Expression Changes ({changes.length})
                </p>
                <div className="space-y-2">
                  {changes.map((c) => (
                    <div key={c.id} className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                      <div className="text-sm text-slate-200 mb-1.5">{c.label}</div>
                      <div className="flex items-center gap-2 flex-wrap font-mono text-xs">
                        <code className="px-2 py-1 rounded bg-rose-500/15 text-rose-300 border border-rose-500/20 line-through opacity-70">
                          {c.before}
                        </code>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                        <code className="px-2 py-1 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/20">
                          {c.after}
                        </code>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={copyOptimized}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm text-slate-200 transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied to clipboard!' : 'Copy Optimized Crontab'}
              </button>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-800 bg-slate-900/80">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800 transition-colors">
            Close
          </button>
          {changes.length > 0 && (
            <button
              onClick={onApply}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 text-sm font-semibold hover:from-amber-400 hover:to-orange-400 transition-all"
            >
              <TrendingDown className="w-4 h-4" />
              Apply Optimized Schedule
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StatBlock({
  label, before, after, drop, highlight, isTime,
}: {
  label: string; before: string; after: string; drop: number; highlight?: boolean; isTime?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-3 ${highlight ? 'border-amber-500/30 bg-amber-500/5' : 'border-slate-800 bg-slate-950/40'}`}>
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <div className="flex items-center gap-2 mt-1.5">
        <span className="text-lg font-bold text-rose-400 line-through opacity-70">{before}</span>
        <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
        <span className={`text-lg font-bold ${isTime ? 'text-indigo-300' : 'text-emerald-400'}`}>{after}</span>
      </div>
      {drop > 0 && (
        <p className="text-[11px] text-emerald-400 mt-0.5 flex items-center gap-1">
          <TrendingDown className="w-3 h-3" />-{drop}%
        </p>
      )}
    </div>
  );
}
