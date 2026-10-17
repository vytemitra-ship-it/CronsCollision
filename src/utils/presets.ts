export interface Preset {
  name: string;
  description: string;
  crontab: string;
}

export const PRESETS: Preset[] = [
  {
    name: 'The Midnight Stampede',
    description: '10 realistic DevOps jobs where 6 collide at midnight or top-of-hour, creating severe red spikes.',
    crontab: `# --- The Midnight Stampede ---
0 0 * * * /usr/bin/backup-full.sh # duration:12m
0 0 * * * /usr/bin/logrotate.sh # duration:3m
0 0 * * * /usr/bin/db-vacuum.sh # duration:8m
0 0 * * * /usr/bin/cert-renew.sh # duration:2m
0 0 * * * /usr/bin/snapshot-vm.sh # duration:6m
0 0 * * * /usr/bin/report-daily.sh # duration:5m
0 * * * * /usr/bin/cache-warm.sh # duration:4m
0 * * * * /usr/bin/metrics-flush.sh # duration:2m
30 6 * * * /usr/bin/email-summary.sh # duration:3m
*/15 * * * * /usr/bin/health-check.sh # duration:1m`,
  },
  {
    name: 'Microservice Chaos',
    description: 'High-frequency */5, */10, and */15 jobs with 3-6m durations creating periodic overlaps.',
    crontab: `# --- Microservice Chaos ---
*/5 * * * * /usr/bin/sync-orders.sh # duration:3m
*/5 * * * * /usr/bin/push-events.sh # duration:2m
*/10 * * * * /usr/bin/aggregate-logs.sh # duration:6m
*/10 * * * * /usr/bin/retry-deadletter.sh # duration:4m
*/15 * * * * /usr/bin/reconcile-payments.sh # duration:5m
*/15 * * * * /usr/bin/refresh-config.sh # duration:3m
0 * * * * /usr/bin/restart-workers.sh # duration:4m`,
  },
  {
    name: 'Well-Balanced Production',
    description: 'Staggered schedules showing a healthy green/blue load distribution.',
    crontab: `# --- Well-Balanced Production ---
7 0 * * * /usr/bin/backup-full.sh # duration:12m
22 0 * * * /usr/bin/db-vacuum.sh # duration:8m
41 0 * * * /usr/bin/snapshot-vm.sh # duration:6m
13 0 * * * /usr/bin/report-daily.sh # duration:5m
3 * * * * /usr/bin/cache-warm.sh # duration:4m
27 * * * * /usr/bin/metrics-flush.sh # duration:2m
9 */4 * * * /usr/bin/logrotate.sh # duration:3m
*/15 * * * * /usr/bin/health-check.sh # duration:1m`,
  },
];

export const DEFAULT_PRESET_INDEX = 0;
