// Cron Engine — zero-dependency parser, collision detector, and auto-balance optimizer.
// Supports standard 5-part cron syntax plus macros, wildcards, steps, ranges, and lists.

export type ResourceWeight = 'light' | 'medium' | 'heavy';

export const WEIGHT_CPU: Record<ResourceWeight, number> = {
  light: 15,
  medium: 35,
  heavy: 65,
};

export interface CronJob {
  id: string;
  raw: string;
  label: string;
  command: string;
  expression: string;
  durationMin: number;
  minute: number[]; // allowed minutes 0-59
  hour: number[]; // allowed hours 0-23
  dom: number[]; // allowed days of month 1-31
  month: number[]; // allowed months 1-12
  dow: number[]; // allowed days of week 0-6 (0=Sun)
  error?: string;
  dailyRuns: number;
  weight: ResourceWeight;
}

export interface ParsedCrontab {
  jobs: CronJob[];
  errors: { line: number; raw: string; message: string }[];
}

export interface MinuteInspection {
  minute: number; // 0-1439
  count: number;
  jobs: { id: string; label: string }[];
}

export interface CollisionStats {
  loadByMinute: number[]; // length 1440
  peakLoad: number;
  peakMinute: number;
  collisionMinutes: number; // minutes where load >= 3
  collisionPct: number;
  jobsAtPeak: { id: string; label: string }[];
  inspections: MinuteInspection[];
}

const MACROS: Record<string, string> = {
  '@hourly': '0 * * * *',
  '@daily': '0 0 * * *',
  '@midnight': '0 0 * * *',
  '@weekly': '0 0 * * 0',
  '@monthly': '0 0 1 * *',
  '@yearly': '0 0 1 1 *',
  '@annually': '0 0 1 1 *',
};

const DOW_NAMES: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

const MONTH_NAMES: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

let idCounter = 0;
const nextId = () => `job-${++idCounter}`;

function parseField(
  field: string,
  min: number,
  max: number,
  names?: Record<string, number>,
  fieldName?: string
): number[] | { error: string } {
  const result = new Set<number>();
  const lowerField = field.toLowerCase();

  for (const part of lowerField.split(',')) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // step: A-B/S or */S or N/S
    const stepMatch = trimmed.match(/^(.+?)\/(\d+)$/);
    let rangePart = trimmed;
    let step = 1;
    if (stepMatch) {
      rangePart = stepMatch[1];
      step = parseInt(stepMatch[2], 10);
      if (!step || step < 1) return { error: `${fieldName}: invalid step "${stepMatch[2]}"` };
    }

    let start: number;
    let end: number;

    if (rangePart === '*') {
      start = min;
      end = max;
    } else if (rangePart.includes('-')) {
      const [a, b] = rangePart.split('-');
      const ra = resolveToken(a, names);
      const rb = resolveToken(b, names);
      if (ra == null || rb == null) return { error: `${fieldName}: invalid range "${rangePart}"` };
      start = ra;
      end = rb;
      if (start > end) {
        // wrap-around range (e.g. 22-2 for hours)
        for (let v = start; v <= max; v += step) result.add(v);
        for (let v = min; v <= end; v += step) result.add(v);
        continue;
      }
    } else {
      const v = resolveToken(rangePart, names);
      if (v == null) return { error: `${fieldName}: invalid value "${rangePart}"` };
      if (step > 1) {
        // N/S means every S starting at N up to max
        start = v;
        end = max;
      } else {
        start = v;
        end = v;
      }
    }

    if (start < min || start > max) return { error: `${fieldName}: value ${start} out of range [${min}-${max}]` };
    if (end < min || end > max) return { error: `${fieldName}: value ${end} out of range [${min}-${max}]` };

    for (let v = start; v <= end; v += step) result.add(v);
  }

  if (result.size === 0) return { error: `${fieldName}: empty field` };
  return [...result].sort((a, b) => a - b);
}

function resolveToken(token: string, names?: Record<string, number>): number | null {
  const t = token.trim().toLowerCase();
  if (names && names[t] != null) return names[t];
  if (/^\d+$/.test(t)) return parseInt(t, 10);
  return null;
}

function parseDurationFromComment(comment: string): number {
  const match = comment.match(/duration:\s*(\d+)\s*m?/i);
  if (match) return Math.max(1, Math.min(60, parseInt(match[1], 10)));
  return 1;
}

function parseWeightFromComment(comment: string, duration: number): ResourceWeight {
  const match = comment.match(/weight:\s*(light|medium|heavy)/i);
  if (match) return match[1].toLowerCase() as ResourceWeight;
  if (duration >= 8) return 'heavy';
  if (duration >= 4) return 'medium';
  return 'light';
}

function deriveLabel(command: string, expression: string): string {
  if (!command) {
    return expression;
  }
  const base = command.split(/\s+/).pop() || command;
  return base.replace(/^\//, '');
}

export function parseCrontab(text: string): ParsedCrontab {
  idCounter = 0;
  const jobs: CronJob[] = [];
  const errors: { line: number; raw: string; message: string }[] = [];

  const lines = text.split('\n');

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') && !trimmed.match(/^\s*#/)) {
      // pure comment line (no command) — skip
      if (trimmed.startsWith('#')) return;
      return;
    }

    // split command from comment
    let comment = '';
    let codePart = trimmed;
    const hashIdx = trimmed.indexOf('#');
    if (hashIdx >= 0) {
      codePart = trimmed.slice(0, hashIdx).trim();
      comment = trimmed.slice(hashIdx + 1);
    }
    if (!codePart) return;

    // expand macro
    const macroMatch = codePart.match(/^@(\w+)\s*(.*)$/);
    let exprPart = codePart;
    let cmdPart = '';
    if (macroMatch && MACROS[`@${macroMatch[1]}`]) {
      exprPart = MACROS[`@${macroMatch[1]}`];
      cmdPart = macroMatch[2];
    } else {
      const tokens = codePart.split(/\s+/);
      if (tokens.length < 6) {
        errors.push({ line: idx + 1, raw: line, message: 'Expected 5 cron fields + command' });
        return;
      }
      exprPart = tokens.slice(0, 5).join(' ');
      cmdPart = tokens.slice(5).join(' ');
    }

    const fields = exprPart.split(/\s+/);
    if (fields.length !== 5) {
      errors.push({ line: idx + 1, raw: line, message: `Expected 5 fields, got ${fields.length}` });
      return;
    }

    const minute = parseField(fields[0], 0, 59, undefined, 'minute');
    const hour = parseField(fields[1], 0, 23, undefined, 'hour');
    const dom = parseField(fields[2], 1, 31, undefined, 'dom');
    const month = parseField(fields[3], 1, 12, MONTH_NAMES, 'month');
    const dow = parseField(fields[4], 0, 6, DOW_NAMES, 'dow');

    for (const r of [minute, hour, dom, month, dow]) {
      if (r instanceof Object && 'error' in r) {
        errors.push({ line: idx + 1, raw: line, message: r.error });
        return;
      }
    }

    // For daily analysis we assume every day fires (dom/month/dow all match "every day").
    // We treat dom/month/dow as full ranges unless restricted; restricted values reduce dailyRuns estimate.
    const minuteArr = minute as number[];
    const hourArr = hour as number[];
    const domArr = dom as number[];
    const monthArr = month as number[];
    const dowArr = dow as number[];

    // Approximate daily runs: if dow/dom are unrestricted, count minute*hour combos.
    // If dow restricted, still show per-day runs as combos (we visualize a single representative day).
    const dailyRuns = minuteArr.length * hourArr.length;

    const duration = parseDurationFromComment(comment);
    const weight = parseWeightFromComment(comment, duration);

    jobs.push({
      id: nextId(),
      raw: line,
      label: deriveLabel(cmdPart, exprPart),
      command: cmdPart,
      expression: exprPart,
      durationMin: duration,
      minute: minuteArr,
      hour: hourArr,
      dom: domArr,
      month: monthArr,
      dow: dowArr,
      dailyRuns,
      weight,
    });
  });

  return { jobs, errors };
}

// Compute minute-by-minute load across a 1440-minute day.
export function computeCollisionStats(jobs: CronJob[]): CollisionStats {
  const load = new Array(1440).fill(0);
  const jobsByMinute: string[][] = Array.from({ length: 1440 }, () => []);

  for (const job of jobs) {
    if (job.error) continue;
    for (const h of job.hour) {
      for (const m of job.minute) {
        const start = h * 60 + m;
        for (let d = 0; d < job.durationMin; d++) {
          const idx = (start + d) % 1440;
          load[idx] += 1;
          jobsByMinute[idx].push(job.id);
        }
      }
    }
  }

  let peakLoad = 0;
  let peakMinute = 0;
  for (let i = 0; i < 1440; i++) {
    if (load[i] > peakLoad) {
      peakLoad = load[i];
      peakMinute = i;
    }
  }

  let collisionMinutes = 0;
  for (let i = 0; i < 1440; i++) {
    if (load[i] >= 3) collisionMinutes++;
  }

  const peakJobIds = [...new Set(jobsByMinute[peakMinute])];
  const jobsAtPeak = peakJobIds.map((jid) => {
    const j = jobs.find((x) => x.id === jid)!;
    return { id: j.id, label: j.label };
  });

  const inspections: MinuteInspection[] = jobsByMinute.map((ids, i) => ({
    minute: i,
    count: load[i],
    jobs: [...new Set(ids)].map((jid) => {
      const j = jobs.find((x) => x.id === jid)!;
      return { id: j.id, label: j.label };
    }),
  }));

  return {
    loadByMinute: load,
    peakLoad,
    peakMinute,
    collisionMinutes,
    collisionPct: (collisionMinutes / 1440) * 100,
    jobsAtPeak,
    inspections,
  };
}

// Human-readable summary.
export function humanSummary(job: CronJob): string {
  const { minute, hour, dom, month, dow } = job;

  // Common patterns
  if (hour.length === 24 && minute.length === 1) {
    return `Every hour at minute ${minute[0]}`;
  }
  if (hour.length === 24 && minute.length === 60) {
    return 'Every minute';
  }
  if (hour.length === 1 && minute.length === 1) {
    const time = `${pad(hour[0])}:${pad(minute[0])}`;
    if (dow.length === 7 && dom.length === 31 && month.length === 12) return `Daily at ${time}`;
    if (dow.length === 1) return `Weekly on ${dowName(dow[0])} at ${time}`;
    if (dom.length === 1) return `Monthly on day ${dom[0]} at ${time}`;
    return `At ${time}`;
  }
  if (minute.length === 60 && hour.length === 1) {
    return `Every minute during hour ${pad(hour[0])}`;
  }
  // stepped minutes
  if (minute.length > 1) {
    const step = minute[1] - minute[0];
    if (step > 1 && minute.every((v, i) => i === 0 || v - minute[i - 1] === step)) {
      if (hour.length === 24) return `Every ${step} minutes`;
      if (hour.length === 1) return `Every ${step} min during hour ${pad(hour[0])}`;
    }
  }
  if (hour.length > 1) {
    const hstep = hour[1] - hour[0];
    if (hstep > 1 && hour.every((v, i) => i === 0 || v - hour[i - 1] === hstep) && minute.length === 1) {
      return `Every ${hstep} hours at minute ${minute[0]}`;
    }
  }
  return `${job.expression}`;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function dowName(n: number): string {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][n] || `Day ${n}`;
}

export function minuteToTime(m: number): string {
  const h = Math.floor(m / 60) % 24;
  const mm = m % 60;
  return `${pad(h)}:${pad(mm)}`;
}

// ---------- Auto-Balance Engine ----------

export interface BalancedResult {
  optimized: CronJob[];
  beforeStats: CollisionStats;
  afterStats: CollisionStats;
  changes: { id: string; label: string; before: string; after: string }[];
}

// Deterministic optimizer: shift colliding jobs' minute/hour offsets while preserving frequency.
export function autoBalance(jobs: CronJob[]): BalancedResult {
  const beforeStats = computeCollisionStats(jobs);
  // Deep clone
  const optimized = jobs.map((j) => ({ ...j, minute: [...j.minute], hour: [...j.hour] }));

  // Strategy: sort jobs by peak contribution. For each job, try shifting its base offset
  // to a minute/hour that minimizes total collision load, while preserving its frequency shape.
  // Frequency preservation: keep the same set sizes and step pattern, only change the base offset.

  for (const job of optimized) {
    if (job.error) continue;
    const originalMinute = [...job.minute];
    const originalHour = [...job.hour];

    let bestScore = scoreJobOverlap(job, optimized);
    let bestMinute = [...originalMinute];
    let bestHour = [...originalHour];

    // For hourly jobs (hour=24, single minute): shift the minute 0-59.
    // For daily jobs (single hour, single minute): try all hour*minute combos (1440) — pick lowest.
    // For stepped-minute jobs (*/N): shift base offset within the step.

    if (job.hour.length === 24) {
      // hourly or frequent — shift minute base
      const step = originalMinute.length > 1 ? originalMinute[1] - originalMinute[0] : 60;
      for (let base = 0; base < step; base++) {
        const shifted = buildSteppedRange(base, step, 60);
        job.minute = shifted;
        const s = scoreJobOverlap(job, optimized);
        if (s < bestScore) {
          bestScore = s;
          bestMinute = shifted;
        }
      }
      job.minute = bestMinute;
    } else if (job.hour.length === 1 && job.minute.length === 1) {
      // daily — try hour shifts primarily (minute stays or also shifts)
      for (let h = 0; h < 24; h++) {
        for (let m = 0; m < 60; m++) {
          job.hour = [h];
          job.minute = [m];
          const s = scoreJobOverlap(job, optimized);
          if (s < bestScore) {
            bestScore = s;
            bestHour = [h];
            bestMinute = [m];
          }
        }
      }
      job.hour = bestHour;
      job.minute = bestMinute;
    } else if (job.minute.length > 1) {
      // stepped-minute, restricted hours — shift base
      const step = originalMinute[1] - originalMinute[0];
      for (let base = 0; base < step; base++) {
        const shifted = buildSteppedRange(base, step, 60);
        job.minute = shifted;
        const s = scoreJobOverlap(job, optimized);
        if (s < bestScore) {
          bestScore = s;
          bestMinute = shifted;
        }
      }
      job.minute = bestMinute;
    }

    // restore expression string
    job.expression = rebuildExpression(job);
  }

  const afterStats = computeCollisionStats(optimized);

  const changes = optimized.map((j, i) => {
    const orig = jobs[i];
    if (orig.expression !== j.expression) {
      return { id: j.id, label: j.label, before: orig.expression, after: j.expression };
    }
    return null;
  }).filter(Boolean) as { id: string; label: string; before: string; after: string }[];

  return { optimized, beforeStats, afterStats, changes };
}

function buildSteppedRange(base: number, step: number, max: number): number[] {
  const out: number[] = [];
  for (let v = base; v < max; v += step) out.push(v);
  return out;
}

// Score: sum of (load^2) over minutes this job is active — penalizes collisions heavily.
function scoreJobOverlap(job: CronJob, all: CronJob[]): number {
  const tempStats = computeCollisionStats(all);
  let score = 0;
  for (const h of job.hour) {
    for (const m of job.minute) {
      const start = h * 60 + m;
      for (let d = 0; d < job.durationMin; d++) {
        const idx = (start + d) % 1440;
        score += tempStats.loadByMinute[idx] * tempStats.loadByMinute[idx];
      }
    }
  }
  return score;
}

function rebuildExpression(job: CronJob): string {
  const m = formatField(job.minute, 60, 0);
  const h = formatField(job.hour, 24, 0);
  return `${m} ${h} ${job.dom.length === 31 ? '*' : job.dom.join(',')} ${
    job.month.length === 12 ? '*' : job.month.join(',')
  } ${job.dow.length === 7 ? '*' : job.dow.join(',')}`;
}

function formatField(vals: number[], mod: number, min: number): string {
  if (vals.length === mod) return '*';
  if (vals.length > 2) {
    const step = vals[1] - vals[0];
    if (step > 1 && vals.every((v, i) => i === 0 || v - vals[i - 1] === step)) {
      return `${vals[0]}/${step}`;
    }
  }
  return vals.join(',');
}

export function jobsToCrontab(jobs: CronJob[]): string {
  return jobs
    .filter((j) => !j.error)
    .map((j) => `${j.expression} ${j.command || '/usr/bin/run.sh'} # duration:${j.durationMin}m`)
    .join('\n');
}

export function jobsToGitHubActionsYaml(jobs: CronJob[]): string {
  const valid = jobs.filter((j) => !j.error);
  const cronEntries = valid.map((j) => `      - cron: '${j.expression}'`).join('\n');
  const names = valid.map((j) => j.label).join(', ');
  return `name: Scheduled Jobs
# Generated by CronsCollision — ${valid.length} job(s): ${names}
on:
  schedule:
${cronEntries}

jobs:
${valid.map((j) => `  ${sanitizeYamlKey(j.label)}:
    runs-on: ubuntu-latest
    steps:
      - run: ${j.command || 'echo "placeholder"'}`).join('\n')}
`;
}

export function jobsToJsonReport(jobs: CronJob[], stats: CollisionStats): string {
  const valid = jobs.filter((j) => !j.error);
  const collisionWindows: { start: string; end: string; load: number }[] = [];
  let i = 0;
  while (i < 1440) {
    if (stats.loadByMinute[i] >= 3) {
      const start = i;
      while (i < 1440 && stats.loadByMinute[i] >= 3) i++;
      collisionWindows.push({
        start: minuteToTime(start),
        end: minuteToTime(Math.min(i - 1, 1439)),
        load: Math.max(...stats.loadByMinute.slice(start, i)),
      });
    } else {
      i++;
    }
  }

  const report = {
    generatedBy: 'CronsCollision',
    timestamp: new Date().toISOString(),
    summary: {
      totalJobs: valid.length,
      peakConcurrentLoad: stats.peakLoad,
      peakTime: minuteToTime(stats.peakMinute),
      collisionMinutes: stats.collisionMinutes,
      collisionPct: Number(stats.collisionPct.toFixed(2)),
      collisionWindows,
    },
    jobs: valid.map((j) => ({
      name: j.label,
      expression: j.expression,
      command: j.command,
      durationMinutes: j.durationMin,
      dailyRuns: j.dailyRuns,
    })),
  };
  return JSON.stringify(report, null, 2);
}

function sanitizeYamlKey(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/^-+|-+$/g, '') || 'job';
}

// ---------- CPU Load Simulation ----------

export interface CpuStats {
  cpuByMinute: number[]; // 0-100+ percent
  peakCpu: number;
  peakCpuMinute: number;
  overloadMinutes: number; // minutes where CPU > 100
  overloadPct: number;
}

export function computeCpuStats(jobs: CronJob[]): CpuStats {
  const cpu = new Array(1440).fill(0);

  for (const job of jobs) {
    if (job.error) continue;
    const cpuCost = WEIGHT_CPU[job.weight];
    for (const h of job.hour) {
      for (const m of job.minute) {
        const start = h * 60 + m;
        for (let d = 0; d < job.durationMin; d++) {
          const idx = (start + d) % 1440;
          cpu[idx] += cpuCost;
        }
      }
    }
  }

  let peakCpu = 0;
  let peakCpuMinute = 0;
  let overloadMinutes = 0;
  for (let i = 0; i < 1440; i++) {
    if (cpu[i] > peakCpu) {
      peakCpu = cpu[i];
      peakCpuMinute = i;
    }
    if (cpu[i] > 100) overloadMinutes++;
  }

  return {
    cpuByMinute: cpu,
    peakCpu,
    peakCpuMinute,
    overloadMinutes,
    overloadPct: (overloadMinutes / 1440) * 100,
  };
}

// ---------- Job Nudge (time offset shift) ----------

// Shifts a job's schedule by deltaMinutes while preserving its frequency.
// For hourly jobs (* * * * * with single minute): shifts the minute, wrapping 0-59.
// For daily jobs (single hour + single minute): shifts across hour boundary.
// For stepped jobs (*/N): shifts the base offset within the step.
export function nudgeJob(job: CronJob, deltaMinutes: number): CronJob {
  const newMinute = [...job.minute];
  const newHour = [...job.hour];

  if (job.hour.length === 24) {
    // hourly or sub-hourly — shift minute base
    if (newMinute.length === 1) {
      newMinute[0] = ((newMinute[0] + deltaMinutes) % 60 + 60) % 60;
    } else {
      // stepped: shift base
      const step = newMinute[1] - newMinute[0];
      const newBase = ((newMinute[0] + deltaMinutes) % step + step) % step;
      for (let i = 0; i < newMinute.length; i++) {
        newMinute[i] = (newBase + i * step) % 60;
      }
    }
  } else if (job.hour.length === 1 && newMinute.length === 1) {
    // daily — shift across hour:minute boundary
    const totalMin = job.hour[0] * 60 + newMinute[0] + deltaMinutes;
    const wrapped = ((totalMin % 1440) + 1440) % 1440;
    newHour[0] = Math.floor(wrapped / 60) % 24;
    newMinute[0] = wrapped % 60;
  } else if (newMinute.length > 1) {
    // stepped minute with restricted hours
    const step = newMinute[1] - newMinute[0];
    const newBase = ((newMinute[0] + deltaMinutes) % step + step) % step;
    for (let i = 0; i < newMinute.length; i++) {
      newMinute[i] = (newBase + i * step) % 60;
    }
  }

  const expression = rebuildExpression({
    ...job,
    minute: newMinute,
    hour: newHour,
  });

  return {
    ...job,
    minute: newMinute,
    hour: newHour,
    expression,
  };
}
