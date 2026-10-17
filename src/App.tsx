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
  parseCrontab, computeCollisionStats, computeCpuStats, autoBalance, jobsToCrontab, nudgeJob,
  type BalancedResult, type ResourceWeight,
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
  const cpuStats = useMemo(() => computeCpuStats(parsed.jobs), [parsed.jobs]);

  const loadPreset = (i: number) => {
    setPresetIndex(i);
    setCrontabText(PRESETS[i].crontab);
    setDiffResult(null);
    if (window.location.hash) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  };

  const updateLineForJob = useCallback((jobId: string, lineUpdater: (codePart: string, comment: string) => string) => {
    setCrontabText((prev) => {
      const lines = prev.split('\n');
      const job = parseCrontab(prev).jobs.find((j) => j.id === jobId);
      if (!job) return prev;
      const lineIdx = lines.findIndex((l) => l.trim() === job.raw || (l.includes(job.command) && l.includes(job.expression)));
      if (lineIdx < 0) return prev;
      const line = lines[lineIdx];
      const hashIdx = line.indexOf('#');
      const codePart = hashIdx >= 0 ? line.slice(0, hashIdx).trim() : line.trim();
      const comment = hashIdx >= 0 ? line.slice(hashIdx + 1) : '';
      lines[lineIdx] = lineUpdater(codePart, comment);
      return lines.join('\n');
    });
  }, []);

  const handleDurationChange = useCallback((jobId: string, duration: number) => {
    updateLineForJob(jobId, (codePart, comment) => {
      // Remove existing duration, keep remaining comment text
      const cleaned = comment.replace(/duration:\s*\d+\s*m?/gi, '').replace(/\s+/g, ' ').trim();
      const newComment = cleaned ? `${cleaned} duration:${duration}m` : `duration:${duration}m`;
      return `${codePart} # ${newComment}`;
    });
  }, [updateLineForJob]);

  const handleWeightChange = useCallback((jobId: string, weight: ResourceWeight) => {
    updateLineForJob(jobId, (codePart, comment) => {
      // Remove existing weight and duration, then re-append cleanly
      const cleaned = comment
        .replace(/weight:\s*\w+/gi, '')
        .replace(/duration:\s*\d+\s*m?/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
      const durMatch = comment.match(/duration:\s*(\d+)\s*m?/i);
      const dur = durMatch ? `duration:${durMatch[1]}m ` : '';
      const newComment = cleaned ? `${cleaned} ${dur}weight:${weight}` : `${dur}weight:${weight}`;
      return `${codePart} # ${newComment.replace(/\s+/g, ' ').trim()}`;
    });
  }, [updateLineForJob]);

  const handleNudge = useCallback((jobId: string, deltaMinutes: number) => {
    setCrontabText((prev) => {
      const parsedPrev = parseCrontab(prev);
      const job = parsedPrev.jobs.find((j) => j.id === jobId);
      if (!job) return prev;
      const nudged = nudgeJob(job, deltaMinutes);
      const lines = prev.split('\n');
      const lineIdx = lines.findIndex((l) => l.trim() === job.raw || (l.includes(job.command) && l.includes(job.expression)));
      if (lineIdx < 0) return prev;
      const hashIdx = lines[lineIdx].indexOf('#');
      const comment = hashIdx >= 0 ? ` # ${lines[lineIdx].slice(hashIdx + 1).trim()}` : '';
      lines[lineIdx] = `${nudged.expression} ${job.command || '/usr/bin/run.sh'}${comment}`;
      return lines.join('\n');
    });
  }, []);

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.altKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        handleAutoBalance();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

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

        <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 space-y-4">
          <KpiBar stats={stats} jobCount={parsed.jobs.length} />
          <Heatmap stats={stats} cpuStats={cpuStats} jobs={parsed.jobs} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-[460px]">
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
              onWeightChange={handleWeightChange}
              onNudge={handleNudge}
            />
          </div>

          <footer className="text-center text-xs text-slate-600 py-2">
            CronsCollision — 100% client-side cron overlap visualizer. No data leaves your browser.{' '}
            <span className="text-slate-500">Press <kbd className="px-1 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-mono">Alt+B</kbd> to auto-balance.</span>
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
