import { CheckCircle2, AlertCircle, FileCode2 } from 'lucide-react';

interface CrontabEditorProps {
  text: string;
  onChange: (t: string) => void;
  errors: { line: number; raw: string; message: string }[];
  validCount: number;
}

export default function CrontabEditor({ text, onChange, errors, validCount }: CrontabEditorProps) {
  const lineCount = text.split('\n').length;

  return (
    <div className="flex flex-col h-full rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800 bg-slate-900/80">
        <div className="flex items-center gap-2">
          <FileCode2 className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm font-semibold text-slate-100">Crontab Editor</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-xs text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {validCount} valid
          </span>
          {errors.length > 0 && (
            <span className="flex items-center gap-1 text-xs text-rose-400">
              <AlertCircle className="w-3.5 h-3.5" />
              {errors.length} error{errors.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      <div className="relative flex-1 min-h-0 flex">
        {/* line numbers */}
        <div className="select-none text-right py-3 px-2 text-[11px] font-mono text-slate-600 bg-slate-950/40 border-r border-slate-800/60 overflow-hidden">
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i} className={`leading-5 ${errors.some((e) => e.line === i + 1) ? 'text-rose-500' : ''}`}>
              {i + 1}
            </div>
          ))}
        </div>
        <textarea
          value={text}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          className="flex-1 bg-transparent text-[12px] font-mono text-slate-200 leading-5 py-3 px-3 resize-none outline-none w-full placeholder:text-slate-600"
          placeholder="# paste your crontab here&#10;0 0 * * * /usr/bin/backup.sh # duration:8m"
        />
      </div>

      {errors.length > 0 && (
        <div className="border-t border-slate-800 bg-rose-950/20 px-4 py-2 max-h-32 overflow-y-auto">
          {errors.map((e, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-rose-300 py-0.5">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>
                <span className="font-mono text-rose-400">L{e.line}:</span> {e.message}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
