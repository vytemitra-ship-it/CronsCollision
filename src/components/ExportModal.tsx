import { useState } from 'react';
import { X, Copy, Check, Download, FileCode2, FileJson, Braces } from 'lucide-react';
import type { CronJob, CollisionStats } from '@/utils/cronEngine';
import { jobsToCrontab, jobsToGitHubActionsYaml, jobsToJsonReport } from '@/utils/cronEngine';

interface ExportModalProps {
  jobs: CronJob[];
  stats: CollisionStats;
  onClose: () => void;
}

type Tab = 'crontab' | 'yaml' | 'json';

export default function ExportModal({ jobs, stats, onClose }: ExportModalProps) {
  const [tab, setTab] = useState<Tab>('crontab');
  const [copied, setCopied] = useState(false);

  const outputs: Record<Tab, { content: string; filename: string; label: string; icon: React.ReactNode }> = {
    crontab: {
      content: jobsToCrontab(jobs),
      filename: 'crontab.txt',
      label: 'Linux Crontab',
      icon: <FileCode2 className="w-4 h-4" />,
    },
    yaml: {
      content: jobsToGitHubActionsYaml(jobs),
      filename: 'scheduled-jobs.yml',
      label: 'GitHub Actions YAML',
      icon: <Braces className="w-4 h-4" />,
    },
    json: {
      content: jobsToJsonReport(jobs, stats),
      filename: 'collision-report.json',
      label: 'JSON Audit Report',
      icon: <FileJson className="w-4 h-4" />,
    },
  };

  const current = outputs[tab];

  const handleCopy = () => {
    navigator.clipboard?.writeText(current.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([current.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = current.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[88vh] rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-800">
          <Download className="w-5 h-5 text-indigo-400" />
          <h2 className="text-sm font-semibold text-slate-100">Export Schedule</h2>
          <button onClick={onClose} className="ml-auto p-1 rounded-lg hover:bg-slate-800 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1 px-5 pt-3 border-b border-slate-800/50">
          {(Object.keys(outputs) as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setCopied(false); }}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === t
                  ? 'text-indigo-400 border-indigo-400'
                  : 'text-slate-400 border-transparent hover:text-slate-200'
              }`}
            >
              {outputs[t].icon}
              {outputs[t].label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <pre className="text-xs font-mono text-slate-300 bg-slate-950/60 rounded-xl border border-slate-800 p-4 overflow-x-auto whitespace-pre-wrap leading-5">
            {current.content}
          </pre>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-800 bg-slate-900/80">
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm transition-colors border border-slate-700"
          >
            <Download className="w-4 h-4" />
            Download {current.filename}
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-medium transition-colors"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Copy to Clipboard'}
          </button>
        </div>
      </div>
    </div>
  );
}
