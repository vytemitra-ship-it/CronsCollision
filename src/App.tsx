import { useState, useMemo, useCallback, useEffect } from 'react';
import Header from '@/components/Header';
import KpiBar from '@/components/KpiBar';
import Heatmap from '@/components/Heatmap';
import CrontabEditor from '@/components/CrontabEditor';
import JobSwimlanes from '@/components/JobSwimlanes';
import DiffModal from '@/components/DiffModal';
import ExportModal from '@/components/ExportModal';
import { PRESETS, DEFAULT_PRESET_INDEX } from '@/utils/presets';
import {
  parseCrontab, computeCollisionStats, autoBalance, jobsToCrontab,
  type CronJob, type BalancedResult,
} from '@/utils/cronEngine';
import { encodeCrontabToHash, getCrontabFromUrl } from '@/utils/share';

function App() {
  const [presetIndex, setPresetIndex] = useState(DEFAULT_PRESET_INDEX);
  const [crontabText, setCrontabText] = useState(() => {
    const fromUrl = getCrontabFromUrl();
    return fromUrl ?? PRESETS[DEFAULT_PRESET_INDEX].crontab;
  });
  const [diffResult, setDiffResult] = useState<BalancedResult | null>(null);
  const [diffOpen, setDiffOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [shared, setShared] = useState(false);

  const parsed = useMemo(() => parseCrontab(crontabText), [crontabText]);
  const stats = useMemo(() => computeCollisionStats(parsed.jobs), [parsed.jobs]);

  const loadPreset = (i: number) => {
    setPresetIndex(i);
    setCrontabText(PRESETS[i].crontab);
    setDiffResult(null);
    if (window.location.hash) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  };

  const handleDurationChange = useCallback((jobId: string, duration: number) => {
    setCrontabText((prev) => {
      const lines = prev.split('\n');
      const job = parsed.jobs.find((j) => j.id === jobId);
      if (!job) return prev;
      const lineIdx = lines.findIndex((l) => l.trim() === job.raw || (l.includes(job.command) && l.includes(job.expression)));
      if (lineIdx < 0) return prev;
      const line = lines[lineIdx];
      const hashIdx = line.indexOf('#');
      const codePart = hashIdx >= 0 ? line.slice(0, hashIdx) : line;
      const comment = hashIdx >= 0 ? line.slice(hashIdx + 1) : '';
      const newComment = comment.replace(/duration:\s*\d+\s*m?/i, `duration:${duration}m`);
      const finalComment = /duration:/i.test(newComment) ? newComment : `${newComment} duration:${duration}m`;
      lines[lineIdx] = `${codePart} # ${finalComment}`;
      return lines.join('\n');
    });
  }, [parsed.jobs]);

  const handleAutoBalance = () => {
    const result = autoBalance(parsed.jobs);
    setDiffResult(result);
    setDiffOpen(true);
  };

  const handleApplyOptimized = () => {
    if (!diffResult) return;
    const newText = jobsToCrontab(diffResult.optimized);
    setCrontabText(newText);
    setDiffOpen(false);
  };

  const handleShare = () => {
    const hash = encodeCrontabToHash(crontabText);
    const url = `${window.location.origin}${window.location.pathname}${hash}`;
    navigator.clipboard?.writeText(url);
    history.replaceState(null, '', hash);
    setShared(true);
    setTimeout(() => setShared(false), 2500);
  };

  useEffect(() => {
    const onHashChange = () => {
      const fromUrl = getCrontabFromUrl();
      if (fromUrl) setCrontabText(fromUrl);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* ambient gradient */}
      <div className="fixed inset-0 pointer-events-none opacity-40">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-rose-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative">
        <Header
          presets={PRESETS}
          selectedPreset={presetIndex}
          onSelectPreset={loadPreset}
          onAutoBalance={handleAutoBalance}
          onCompare={() => diffResult ? setDiffOpen(true) : handleAutoBalance()}
          onExport={() => setExportOpen(true)}
          onShare={handleShare}
          shared={shared}
        />

        <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-5 space-y-5">
          <KpiBar stats={stats} jobCount={parsed.jobs.length} />
          <Heatmap stats={stats} jobs={parsed.jobs} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 min-h-[420px]">
            <CrontabEditor
              text={crontabText}
              onChange={setCrontabText}
              errors={parsed.errors}
              validCount={parsed.jobs.length}
            />
            <JobSwimlanes
              jobs={parsed.jobs}
              stats={stats}
              onDurationChange={handleDurationChange}
            />
          </div>

          <footer className="text-center text-xs text-slate-600 py-4">
            CronsCollision — 100% client-side cron overlap visualizer. No data leaves your browser.
          </footer>
        </main>
      </div>

      {diffOpen && diffResult && (
        <DiffModal
          result={diffResult}
          onClose={() => setDiffOpen(false)}
          onApply={handleApplyOptimized}
        />
      )}

      {exportOpen && (
        <ExportModal
          jobs={parsed.jobs}
          stats={stats}
          onClose={() => setExportOpen(false)}
        />
      )}
    </div>
  );
}

export default App;
