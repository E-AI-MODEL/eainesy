/**
 * In-memory stand-in for the Prisma client — TEST USE ONLY.
 *
 * Why: the sandbox that builds and verifies EAInesy cannot download Prisma's
 * native engines, and the pipeline tests must not depend on a live SQLite
 * file anyway (tests would pollute the real review queue — the exact bug
 * fixed in this release). This fake implements only the small Prisma surface
 * the app uses (create / findMany / findFirst / findUnique / update /
 * updateMany / count / deleteMany) with Prisma's semantics for the operators
 * actually used (equality, not, in, startsWith, gte/lte/gt/lt, AND/OR).
 *
 * The knowledge graph is seeded from the shipped db/custom.db (read-only via
 * bun:sqlite) so grounding behaves exactly as in production.
 */
import { Database } from 'bun:sqlite';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

type Row = Record<string, unknown>;
type Where = Record<string, unknown>;

let idCounter = 0;
function cuid(): string {
  idCounter += 1;
  return `t${Date.now().toString(36)}${idCounter.toString(36).padStart(5, '0')}`;
}

const MODEL_DEFAULTS: Record<string, () => Row> = {
  session: () => ({ label: 'Kwast session', kind: 'live' }),
  turn: () => ({ latencyMs: 0, frame: '{}', plan: '{}', certificate: '{}', trace: '[]' }),
  auditEntry: () => ({ payload: '{}', turnId: null }),
  kGNode: () => ({ data: '{}' }),
  kGEdge: () => ({ weight: 1 }),
  seedCandidate: () => ({
    frame: '{}', status: 'pending', feedback: null, decidedAt: null, turnId: null, origin: 'live',
    weight: 0, recurrence: 1, contradictions: 0, sessionsSeen: '[]', intent: null, lastSeenAt: new Date(),
  }),
  evalRun: () => ({ mode: 'full', results: '[]', suite: 'probes' }),
};

function matchValue(value: unknown, cond: unknown): boolean {
  if (cond !== null && typeof cond === 'object' && !(cond instanceof Date) && !Array.isArray(cond)) {
    const c = cond as Record<string, unknown>;
    for (const [op, arg] of Object.entries(c)) {
      switch (op) {
        case 'not': if (matchValue(value, arg)) return false; break;
        case 'in': if (!(arg as unknown[]).includes(value)) return false; break;
        case 'notIn': if ((arg as unknown[]).includes(value)) return false; break;
        case 'startsWith': if (typeof value !== 'string' || !value.startsWith(arg as string)) return false; break;
        case 'contains': if (typeof value !== 'string' || !value.includes(arg as string)) return false; break;
        case 'gte': if (!((value as number) >= (arg as number))) return false; break;
        case 'gt': if (!((value as number) > (arg as number))) return false; break;
        case 'lte': if (!((value as number) <= (arg as number))) return false; break;
        case 'lt': if (!((value as number) < (arg as number))) return false; break;
        case 'equals': if (value !== arg) return false; break;
        default: throw new Error(`fake-db: unsupported operator ${op}`);
      }
    }
    return true;
  }
  if (cond instanceof Date && value instanceof Date) return cond.getTime() === value.getTime();
  return value === cond;
}

function matches(row: Row, where?: Where): boolean {
  if (!where) return true;
  for (const [k, cond] of Object.entries(where)) {
    if (k === 'AND') { if (!(cond as Where[]).every((w) => matches(row, w))) return false; continue; }
    if (k === 'OR') { if (!(cond as Where[]).some((w) => matches(row, w))) return false; continue; }
    if (k === 'NOT') { if (matches(row, cond as Where)) return false; continue; }
    if (!matchValue(row[k], cond)) return false;
  }
  return true;
}

function cmp(a: unknown, b: unknown): number {
  const av = a instanceof Date ? a.getTime() : a;
  const bv = b instanceof Date ? b.getTime() : b;
  if (av === bv) return 0;
  if (av === null || av === undefined) return -1;
  if (bv === null || bv === undefined) return 1;
  return (av as number) < (bv as number) ? -1 : 1;
}

function pick(row: Row, select?: Record<string, boolean>): Row {
  const copy = { ...row };
  if (!select) return copy;
  const out: Row = {};
  for (const [k, on] of Object.entries(select)) if (on) out[k] = copy[k];
  return out;
}

class FakeModel {
  rows: Row[] = [];
  private seq = 0;
  constructor(private name: string) {}

  async create({ data }: { data: Row }) {
    this.seq += 1;
    const row: Row = {
      id: cuid(),
      ...(MODEL_DEFAULTS[this.name]?.() ?? {}),
      createdAt: new Date(Date.now() + this.seq), // strictly increasing for stable ordering
      ...data,
    };
    if ('updatedAt' in row || this.name === 'seedCandidate') row.updatedAt = new Date();
    this.rows.push(row);
    return { ...row };
  }

  private query(args: { where?: Where; orderBy?: unknown; take?: number; skip?: number } = {}) {
    let out = this.rows.filter((r) => matches(r, args.where));
    const orders = args.orderBy ? (Array.isArray(args.orderBy) ? args.orderBy : [args.orderBy]) : [];
    if (orders.length) {
      out = [...out].sort((x, y) => {
        for (const o of orders as Record<string, 'asc' | 'desc'>[]) {
          const [field, dir] = Object.entries(o)[0];
          const c = cmp(x[field], y[field]);
          if (c !== 0) return dir === 'desc' ? -c : c;
        }
        return 0;
      });
    }
    if (args.skip) out = out.slice(args.skip);
    if (args.take !== undefined) out = out.slice(0, args.take);
    return out;
  }

  async findMany(args: { where?: Where; orderBy?: unknown; take?: number; skip?: number; select?: Record<string, boolean> } = {}) {
    return this.query(args).map((r) => pick(r, args.select));
  }

  async findFirst(args: { where?: Where; orderBy?: unknown; select?: Record<string, boolean> } = {}) {
    const r = this.query({ ...args, take: 1 })[0];
    return r ? pick(r, args.select) : null;
  }

  async findUnique(args: { where: Where; select?: Record<string, boolean> }) {
    const r = this.rows.find((row) => matches(row, args.where));
    return r ? pick(r, args.select) : null;
  }

  async update({ where, data }: { where: Where; data: Row }) {
    const r = this.rows.find((row) => matches(row, where));
    if (!r) throw new Error(`fake-db: ${this.name}.update — record not found`);
    applyUpdate(r, data);
    return { ...r };
  }

  async updateMany({ where, data }: { where?: Where; data: Row }) {
    const hits = this.rows.filter((row) => matches(row, where));
    for (const r of hits) applyUpdate(r, data);
    return { count: hits.length };
  }

  async deleteMany({ where }: { where?: Where } = {}) {
    const before = this.rows.length;
    this.rows = this.rows.filter((row) => !matches(row, where));
    return { count: before - this.rows.length };
  }

  async count(args: { where?: Where } = {}) {
    return this.rows.filter((r) => matches(r, args.where)).length;
  }
}

function applyUpdate(r: Row, data: Row) {
  for (const [k, v] of Object.entries(data)) {
    if (v !== null && typeof v === 'object' && !(v instanceof Date) && !Array.isArray(v)) {
      const op = v as Record<string, number>;
      if ('increment' in op) { r[k] = ((r[k] as number) ?? 0) + op.increment; continue; }
      if ('decrement' in op) { r[k] = ((r[k] as number) ?? 0) - op.decrement; continue; }
    }
    r[k] = v;
  }
  r.updatedAt = new Date();
}

export interface FakeDb {
  session: FakeModel;
  turn: FakeModel;
  auditEntry: FakeModel;
  kGNode: FakeModel;
  kGEdge: FakeModel;
  seedCandidate: FakeModel;
  evalRun: FakeModel;
  $transaction<T>(fn: (tx: FakeDb) => Promise<T>): Promise<T>;
  __reset(): void;
}

export function createFakeDb(): FakeDb {
  const models = {
    session: new FakeModel('session'),
    turn: new FakeModel('turn'),
    auditEntry: new FakeModel('auditEntry'),
    kGNode: new FakeModel('kGNode'),
    kGEdge: new FakeModel('kGEdge'),
    seedCandidate: new FakeModel('seedCandidate'),
    evalRun: new FakeModel('evalRun'),
  };
  // Seed the knowledge graph from the shipped database (read-only).
  const file = join(import.meta.dir, '..', '..', 'db', 'custom.db');
  if (existsSync(file)) {
    const sqlite = new Database(file, { readonly: true });
    for (const n of sqlite.query('select key, type, labelNl, labelEn, data from KGNode').all() as Row[]) {
      models.kGNode.rows.push({ id: cuid(), createdAt: new Date(), ...n });
    }
    for (const e of sqlite.query('select fromKey, toKey, rel, weight from KGEdge').all() as Row[]) {
      models.kGEdge.rows.push({ id: cuid(), ...e });
    }
    sqlite.close();
  }
  const db: FakeDb = {
    ...models,
    async $transaction<T>(fn: (tx: FakeDb) => Promise<T>) { return fn(db); },
    __reset() {
      for (const m of ['session', 'turn', 'auditEntry', 'seedCandidate', 'evalRun'] as const) models[m].rows = [];
    },
  };
  return db;
}
