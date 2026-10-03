/**
 * Pushes history to TeamOS.
 *
 * The live sync starts its cursor at *now*, so switching it on never drags
 * years of payments along behind it. This is how that history goes over
 * instead: deliberately, a month at a time, with a range you choose and a dry
 * run you read first.
 *
 *   # see what would go, without sending anything
 *   npx tsx src/scripts/teamos-backfill.ts --from 2026-01-01
 *
 *   # actually send it
 *   npx tsx src/scripts/teamos-backfill.ts --from 2026-01-01 --apply
 *
 *   # one month, to try it on something small first
 *   npx tsx src/scripts/teamos-backfill.ts --from 2026-09-01 --to 2026-10-01 --apply
 *
 * Options
 *   --from YYYY-MM-DD   where to start. Required.
 *   --to   YYYY-MM-DD   exclusive end. Defaults to tomorrow, so today is included.
 *   --apply             send it. Without this, nothing is written or sent.
 *   --chunk N           months per batch (default 1). Smaller is slower but
 *                       resumes more precisely if you stop it.
 *   --skip-clients      do not push the team and clients first. Only safe when
 *                       they are already over there.
 *
 * Safe to run twice. Every event is keyed on the row's own id and TeamOS
 * upserts on it, so a second run reports "unchanged" and changes nothing. If it
 * dies halfway, run the same command again.
 *
 * It does not touch the live sync's cursor. The two can run at the same time:
 * both upsert the same outbox rows, and the fingerprint makes the loser a
 * no-op.
 */
import prisma from '../config/database';
import { enqueue, syncConfig, stats } from '../modules/sync/sync.outbox';
import { projectClients, projectMembers, projectMoney } from '../modules/sync/sync.project';
import { deliverDue } from '../modules/sync/sync.worker';

// ─── arguments ─────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(`--${name}`);
const value = (name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};

const day = (s: string): Date => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error(`Expected a YYYY-MM-DD date, got "${s}"`);
  const d = new Date(`${s}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new Error(`"${s}" is not a real date`);
  return d;
};

const addMonths = (d: Date, n: number) => {
  const out = new Date(d);
  out.setUTCMonth(out.getUTCMonth() + n);
  return out;
};

const iso = (d: Date) => d.toISOString().slice(0, 10);
const inr = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

// ─── the run ───────────────────────────────────────────────────────────────

async function main() {
  const apply = flag('apply');
  const skipClients = flag('skip-clients');
  const chunkMonths = Math.max(1, Number(value('chunk') ?? 1));

  const fromArg = value('from');
  if (!fromArg) {
    console.error('--from YYYY-MM-DD is required. Run with no --apply first to see what would go.');
    process.exit(1);
  }
  const from = day(fromArg);
  // Tomorrow by default, because the window's end is exclusive and today's
  // money should be included.
  const to = value('to') ? day(value('to')!) : day(iso(new Date(Date.now() + 86_400_000)));
  if (to <= from) throw new Error('--to must be after --from');

  const config = syncConfig();
  if (!config) {
    console.error(
      'TEAMOS_SYNC_URL and TEAMOS_SYNC_SECRET must be set. Nothing can be sent without them.\n' +
        'See src/modules/sync/README.md.',
    );
    process.exit(1);
  }

  console.log(`\nTeamOS backfill  ${iso(from)} -> ${iso(to)}  (${chunkMonths} month${chunkMonths > 1 ? 's' : ''} at a time)`);
  console.log(`  target  ${config.url}`);
  console.log(`  clients ${config.scope === 'all' ? 'every organization' : 'onboarder-owned only'}`);
  console.log(apply ? '  MODE    applying\n' : '  MODE    dry run - nothing will be written or sent\n');

  let totalEvents = 0;
  let totalQueued = 0;
  let totalDelivered = 0;
  let totalFailed = 0;
  let totalMoney = 0;

  // ── the team and the clients first.
  //
  // Not optional in practice: a historical payment names its client, and TeamOS
  // holds any payment whose client it has never heard of. Pushing the money
  // first would just fill the queue with events waiting for rows that are one
  // step behind them.
  if (!skipClients) {
    const members = await projectMembers();
    const clients = await projectClients(config.scope);
    console.log(`team and clients: ${members.length} on the team, ${clients.length} client${clients.length === 1 ? '' : 's'}`);
    totalEvents += members.length + clients.length;

    if (apply) {
      const queued = await enqueue([...members, ...clients]);
      const sent = await deliverDue(config, 100);
      totalQueued += queued.queued;
      totalDelivered += sent.delivered;
      totalFailed += sent.failed + sent.dead;
      console.log(`  queued ${queued.queued}, unchanged ${queued.unchanged}, delivered ${sent.delivered}, failed ${sent.failed + sent.dead}`);
    }
    console.log('');
  }

  // ── money, a chunk at a time, oldest first
  for (let start = from; start < to; start = addMonths(start, chunkMonths)) {
    const end = new Date(Math.min(addMonths(start, chunkMonths).getTime(), to.getTime()));

    const money = await projectMoney({ since: start, until: end, by: 'received' });
    const received = money.reduce((sum, m) => sum + (m.type === 'in' ? m.amountPaise : -m.amountPaise), 0);
    totalEvents += money.length;
    totalMoney += received;

    const label = `${iso(start)} -> ${iso(end)}`;
    const count = `${money.length} entr${money.length === 1 ? 'y' : 'ies'}`;
    if (!money.length) {
      console.log(`${label}  nothing`);
      continue;
    }

    if (!apply) {
      console.log(`${label}  ${count}, net ${inr(received)}`);
      continue;
    }

    const queued = await enqueue(money);
    const sent = await deliverDue(config, 100);
    totalQueued += queued.queued;
    totalDelivered += sent.delivered;
    totalFailed += sent.failed + sent.dead;

    console.log(
      `${label}  ${count}, net ${inr(received)} | queued ${queued.queued}, unchanged ${queued.unchanged}, delivered ${sent.delivered}, failed ${sent.failed + sent.dead}`,
    );
  }

  // ── what happened
  console.log('');
  if (apply) {
    console.log(`projected ${totalEvents}, queued ${totalQueued}, delivered ${totalDelivered}, failed ${totalFailed}`);
    console.log(`net money in the range: ${inr(totalMoney)}`);

    const s = await stats();
    if (s.pending || s.dead) {
      console.log(`\nstill in the queue: ${s.pending} pending, ${s.dead} given up on`);
      if (s.recentErrors.length) {
        console.log('last errors:');
        for (const e of s.recentErrors.slice(0, 5)) {
          console.log(`  ${e.kind} ${e.externalId} (${e.attempts} attempts): ${e.lastError}`);
        }
      }
      // Pending is not a failure: the live sync keeps trying on its own timer.
      console.log('\nThe scheduled sync will keep retrying whatever is pending.');
    } else {
      console.log('\nnothing left in the queue.');
    }
  } else {
    console.log(`${totalEvents} event${totalEvents === 1 ? '' : 's'} would be sent, net ${inr(totalMoney)}.`);
    console.log('Run the same command with --apply to send them.');
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(`\n${err?.message ?? err}`);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
