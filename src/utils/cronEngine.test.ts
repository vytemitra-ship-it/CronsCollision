import { describe, it, expect } from 'vitest';
import {
  parseCrontab, computeCollisionStats, autoBalance, jobsToCrontab,
  jobsToGitHubActionsYaml, deriveLabel,
} from './cronEngine';

describe('parseCrontab — standard 5-part syntax', () => {
  it('parses wildcard `* * * * *` as every minute', () => {
    const { jobs, errors } = parseCrontab('* * * * * /run.sh');
    expect(errors).toHaveLength(0);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].minute).toHaveLength(60);
    expect(jobs[0].hour).toHaveLength(24);
    expect(jobs[0].dailyRuns).toBe(1440);
  });

  it('parses `*/15 * * * *` as 4 runs per hour', () => {
    const { jobs, errors } = parseCrontab('*/15 * * * * /check.sh');
    expect(errors).toHaveLength(0);
    expect(jobs[0].minute).toEqual([0, 15, 30, 45]);
    expect(jobs[0].dailyRuns).toBe(96);
  });

  it('parses `0 0 * * *` as daily at midnight', () => {
    const { jobs, errors } = parseCrontab('0 0 * * * /backup.sh');
    expect(errors).toHaveLength(0);
    expect(jobs[0].minute).toEqual([0]);
    expect(jobs[0].hour).toEqual([0]);
    expect(jobs[0].dailyRuns).toBe(1);
  });

  it('parses list `0,15,30,45 * * * *`', () => {
    const { jobs } = parseCrontab('0,15,30,45 * * * * /poll.sh');
    expect(jobs[0].minute).toEqual([0, 15, 30, 45]);
  });

  it('parses range `0 1-5 * * *` as hours 1 through 5', () => {
    const { jobs } = parseCrontab('0 1-5 * * * /night.sh');
    expect(jobs[0].hour).toEqual([1, 2, 3, 4, 5]);
    expect(jobs[0].dailyRuns).toBe(5);
  });

  it('parses step with range `2-59/10 * * * *`', () => {
    const { jobs } = parseCrontab('2-59/10 * * * * /step.sh');
    expect(jobs[0].minute).toEqual([2, 12, 22, 32, 42, 52]);
  });
});

describe('parseCrontab — macros', () => {
  it('expands @hourly to 0 * * * *', () => {
    const { jobs, errors } = parseCrontab('@hourly /hour.sh');
    expect(errors).toHaveLength(0);
    expect(jobs[0].expression).toBe('0 * * * *');
    expect(jobs[0].dailyRuns).toBe(24);
  });

  it('expands @daily and @midnight to 0 0 * * *', () => {
    const a = parseCrontab('@daily /a.sh');
    const b = parseCrontab('@midnight /b.sh');
    expect(a.jobs[0].expression).toBe('0 0 * * *');
    expect(b.jobs[0].expression).toBe('0 0 * * *');
  });

  it('expands @weekly to 0 0 * * 0', () => {
    const { jobs } = parseCrontab('@weekly /w.sh');
    expect(jobs[0].expression).toBe('0 0 * * 0');
  });
});

describe('parseCrontab — duration from comments', () => {
  it('reads `# duration:8m`', () => {
    const { jobs } = parseCrontab('0 0 * * * /backup.sh # duration:8m');
    expect(jobs[0].durationMin).toBe(8);
  });

  it('defaults to 1 minute when no duration comment', () => {
    const { jobs } = parseCrontab('0 0 * * * /backup.sh');
    expect(jobs[0].durationMin).toBe(1);
  });

  it('clamps duration to 1–60', () => {
    const { jobs } = parseCrontab('0 0 * * * /x.sh # duration:0m');
    expect(jobs[0].durationMin).toBe(1);
  });
});

describe('parseCrontab — validation', () => {
  it('reports error for too few fields', () => {
    const { jobs, errors } = parseCrontab('0 0 * * *');
    expect(jobs).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('Expected 5 cron fields + command');
  });

  it('reports error for out-of-range minute', () => {
    const { errors } = parseCrontab('99 * * * * /run.sh');
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('out of range');
  });

  it('skips blank and comment-only lines', () => {
    const { jobs, errors } = parseCrontab('# this is a comment\n\n0 0 * * * /run.sh');
    expect(errors).toHaveLength(0);
    expect(jobs).toHaveLength(1);
  });

  it('rejects invalid wrap-around range `99-5` in minutes', () => {
    const { errors } = parseCrontab('99-5 * * * * /bad.sh');
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('out of range');
  });
});

describe('parseCrontab — DOW 7 maps to Sunday (0)', () => {
  it('accepts DOW 7 and maps it to 0', () => {
    const { jobs, errors } = parseCrontab('0 0 * * 7 /weekly.sh');
    expect(errors).toHaveLength(0);
    expect(jobs[0].dow).toContain(0);
    expect(jobs[0].dow).not.toContain(7);
  });
});

describe('computeCollisionStats — midnight wrap-around', () => {
  it('job at 23:55 with 10m duration marks 00:00–00:04 as active', () => {
    const { jobs } = parseCrontab('55 23 * * * /late.sh # duration:10m');
    const stats = computeCollisionStats(jobs);
    // minutes 23:55–00:04 = minutes 1435–1439, 0–4
    for (let m = 1435; m <= 1439; m++) expect(stats.loadByMinute[m]).toBe(1);
    for (let m = 0; m <= 4; m++) expect(stats.loadByMinute[m]).toBe(1);
    // minute 23:54 and 00:05 should be 0
    expect(stats.loadByMinute[1434]).toBe(0);
    expect(stats.loadByMinute[5]).toBe(0);
  });
});

describe('computeCollisionStats — collision detection', () => {
  it('detects 3 overlapping jobs at midnight as collision', () => {
    const { jobs } = parseCrontab([
      '0 0 * * * /a.sh # duration:5m',
      '0 0 * * * /b.sh # duration:3m',
      '0 0 * * * /c.sh # duration:2m',
    ].join('\n'));
    const stats = computeCollisionStats(jobs);
    expect(stats.peakLoad).toBe(3);
    expect(stats.peakMinute).toBe(0);
    expect(stats.collisionMinutes).toBeGreaterThanOrEqual(2); // minutes 0 and 1 have 3 jobs
    expect(stats.jobsAtPeak).toHaveLength(3);
  });

  it('reports peak load and peak time correctly', () => {
    const { jobs } = parseCrontab('0 12 * * * /noon.sh # duration:1m');
    const stats = computeCollisionStats(jobs);
    expect(stats.peakLoad).toBe(1);
    expect(stats.peakMinute).toBe(720); // 12:00
  });

  it('no collisions when jobs are staggered', () => {
    const { jobs } = parseCrontab([
      '0 0 * * * /a.sh # duration:5m',
      '10 0 * * * /b.sh # duration:5m',
      '20 0 * * * /c.sh # duration:5m',
    ].join('\n'));
    const stats = computeCollisionStats(jobs);
    expect(stats.peakLoad).toBe(1);
    expect(stats.collisionMinutes).toBe(0);
  });

  it('counts load >= 2 as collision minutes (unified threshold)', () => {
    const { jobs } = parseCrontab([
      '0 0 * * * /a.sh # duration:3m',
      '0 0 * * * /b.sh # duration:3m',
    ].join('\n'));
    const stats = computeCollisionStats(jobs);
    expect(stats.peakLoad).toBe(2);
    expect(stats.collisionMinutes).toBeGreaterThanOrEqual(3); // 3 minutes with 2 concurrent jobs
  });
});

describe('autoBalance — frequency preservation', () => {
  it('preserves daily run count after balancing an hourly job', () => {
    const { jobs } = parseCrontab([
      '0 * * * * /a.sh # duration:5m',
      '0 * * * * /b.sh # duration:4m',
      '0 * * * * /c.sh # duration:3m',
    ].join('\n'));
    const beforeRuns = jobs.map((j) => j.dailyRuns);
    const result = autoBalance(jobs);
    const afterRuns = result.optimized.map((j) => j.dailyRuns);
    expect(afterRuns).toEqual(beforeRuns);
  });

  it('preserves daily run count after balancing a daily job', () => {
    const { jobs } = parseCrontab([
      '0 0 * * * /a.sh # duration:8m',
      '0 0 * * * /b.sh # duration:6m',
      '0 0 * * * /c.sh # duration:4m',
    ].join('\n'));
    const beforeRuns = jobs.map((j) => j.dailyRuns);
    const result = autoBalance(jobs);
    const afterRuns = result.optimized.map((j) => j.dailyRuns);
    expect(afterRuns).toEqual(beforeRuns);
  });

  it('preserves frequency for stepped-minute jobs (*/5)', () => {
    const { jobs } = parseCrontab([
      '*/5 * * * * /a.sh # duration:3m',
      '*/5 * * * * /b.sh # duration:2m',
    ].join('\n'));
    const beforeRuns = jobs.map((j) => j.dailyRuns);
    const result = autoBalance(jobs);
    const afterRuns = result.optimized.map((j) => j.dailyRuns);
    expect(afterRuns).toEqual(beforeRuns);
  });

  it('reduces or maintains peak load after balancing', () => {
    const { jobs } = parseCrontab([
      '0 0 * * * /a.sh # duration:8m',
      '0 0 * * * /b.sh # duration:6m',
      '0 0 * * * /c.sh # duration:4m',
      '0 0 * * * /d.sh # duration:3m',
      '0 0 * * * /e.sh # duration:2m',
    ].join('\n'));
    const result = autoBalance(jobs);
    expect(result.afterStats.peakLoad).toBeLessThanOrEqual(result.beforeStats.peakLoad);
  });

  it('completes in < 100ms for 10 jobs (incremental scoring optimization)', () => {
    const { jobs } = parseCrontab([
      '0 0 * * * /a.sh # duration:8m',
      '0 0 * * * /b.sh # duration:6m',
      '0 0 * * * /c.sh # duration:4m',
      '0 0 * * * /d.sh # duration:3m',
      '0 0 * * * /e.sh # duration:2m',
      '0 * * * * /f.sh # duration:5m',
      '0 * * * * /g.sh # duration:4m',
      '*/5 * * * * /h.sh # duration:2m',
      '*/10 * * * * /i.sh # duration:3m',
      '0 6 * * * /j.sh # duration:4m',
    ].join('\n'));
    const start = performance.now();
    autoBalance(jobs);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(100);
  });
});

describe('jobsToCrontab — round-trip', () => {
  it('produces valid crontab from jobs', () => {
    const { jobs } = parseCrontab('0 0 * * * /backup.sh # duration:8m');
    const text = jobsToCrontab(jobs);
    expect(text).toContain('0 0 * * *');
    expect(text).toContain('duration:8m');
    // should re-parse cleanly
    const reparsed = parseCrontab(text);
    expect(reparsed.errors).toHaveLength(0);
    expect(reparsed.jobs).toHaveLength(1);
  });
});

describe('jobsToGitHubActionsYaml — key deduplication', () => {
  it('produces unique YAML keys for duplicate job names', () => {
    const { jobs } = parseCrontab([
      '0 0 * * * /usr/bin/backup.sh # duration:8m',
      '0 12 * * * /usr/bin/backup.sh # duration:4m',
    ].join('\n'));
    const yaml = jobsToGitHubActionsYaml(jobs);
    // Both produce label "backup.sh" -> keys should be "backup-sh" and "backup-sh-2"
    expect(yaml).toContain('backup-sh:');
    expect(yaml).toContain('backup-sh-2:');
  });
});

describe('deriveLabel — smart extraction', () => {
  it('extracts script basename ignoring CLI flags and values', () => {
    expect(deriveLabel('/usr/bin/python3 /app/backup.py --timeout 42', '')).toBe('backup.py');
  });

  it('extracts script basename ignoring interpreter prefix', () => {
    expect(deriveLabel('node /opt/worker.js --verbose', '')).toBe('worker.js');
  });

  it('falls back to basename when no flags or interpreters', () => {
    expect(deriveLabel('/usr/bin/backup.sh', '')).toBe('backup.sh');
  });

  it('returns expression when command is empty', () => {
    expect(deriveLabel('', '0 0 * * *')).toBe('0 0 * * *');
  });
});
