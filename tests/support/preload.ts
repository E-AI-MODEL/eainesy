/**
 * Test preload: installs the in-memory Prisma stand-in BEFORE src/lib/db.ts
 * is imported (db.ts reuses `globalThis.prisma` when present), and stubs the
 * GLM bridge so no test ever calls a live model.
 *
 * Used by `bun test` (see bunfig.toml) and by the formal scripts:
 *   bun --preload ./tests/support/preload.ts scripts/regress-formal.ts
 */
import { mock } from 'bun:test';
import { createFakeDb } from './fake-db';

const g = globalThis as unknown as { prisma?: unknown; __fakeDb?: ReturnType<typeof createFakeDb> };
g.__fakeDb = createFakeDb();
g.prisma = g.__fakeDb;

// The z-ai SDK is only available in the deployment environment. Tests drive
// the pipeline with preset frames; any accidental live call fails closed.
mock.module('z-ai-web-dev-sdk', () => ({
  default: {
    create: async () => ({
      chat: { completions: { create: async () => { throw new Error('GLM unavailable in tests'); } } },
    }),
  },
}));
