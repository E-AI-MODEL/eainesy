/**
 * Production Z3 boundary: each certificate runs in a separate OS process.
 * Crash, hang or malformed output => skipped; the mandatory chat gate abstains.
 * This protects the Node server event loop from the z3-solver WASM pthreads.
 *
 * Fixed worker path, bounded parallelism, bounded message size, 5s kill deadline.
 * Not a semantic safety guarantee and not a general-purpose job queue.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Z3Certificate } from './z3cert';

export const Z3_WORKER_TIMEOUT_MS = 5000;
export const Z3_MAX_CONCURRENT_WORKERS = 4;
/** Small, in-memory FIFO queue. Per process; there is deliberately no unbounded backlog. */
export const Z3_MAX_QUEUED_REQUESTS = 8;
export const Z3_QUEUE_WAIT_MS = 2000;
const MAX_REPLY_BYTES = 16 * 1024;
const MAX_ERROR_BYTES = 2048;
let runningWorkers = 0;

type QueuedJob = {
  input: Z3DecisionInput;
  started: number;
  resolve: (certificate: Z3Certificate) => void;
  timer?: ReturnType<typeof setTimeout>;
};
const waitingJobs: QueuedJob[] = [];
let maxObservedWorkers = 0;

export function z3WorkerStatus(): {
  running: number; limit: number; queued: number; queueLimit: number; peak: number;
} {
  return {
    running: runningWorkers, limit: Z3_MAX_CONCURRENT_WORKERS,
    queued: waitingJobs.length, queueLimit: Z3_MAX_QUEUED_REQUESTS,
    peak: maxObservedWorkers,
  };
}

export type Z3DecisionInput = {
  riskScore: number;
  claimedLevel: 'NONE' | 'ELEVATED' | 'HIGH' | 'CRISIS';
  neuralLevel: 'NONE' | 'ELEVATED' | 'HIGH' | 'CRISIS';
  lexicalLevel: 'NONE' | 'ELEVATED' | 'HIGH' | 'CRISIS';
  fusedLevel: 'NONE' | 'ELEVATED' | 'HIGH' | 'CRISIS';
  confidence: number;
  numericBand: 'LOW' | 'MEDIUM' | 'HIGH';
  policyBand?: 'LOW' | 'MEDIUM' | 'HIGH';
};

function skip(start: number, reason: string): Z3Certificate {
  return { available: false, result: 'skipped', ms: performance.now() - start,
    detail: 'Isolated Z3 verification unavailable: ' + reason + '; automatic answer withheld.' };
}

function workerPath(): string | null {
  const base = process.cwd();
  const candidates = [
    join(base, '.next', 'standalone', 'z3-cert-worker.mjs'),
    join(base, 'z3-cert-worker.mjs'),
  ];
  return candidates.find(existsSync) ?? null;
}

function validCertificate(value: unknown): value is Z3Certificate {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<Z3Certificate>;
  if (!['sat','unsat','unknown','skipped'].includes(String(v.result))) return false;
  if (typeof v.available !== 'boolean' || typeof v.ms !== 'number' || !Number.isFinite(v.ms)) return false;
  if (typeof v.detail !== 'string' || v.detail.length > 8192) return false;
  if (v.result === 'sat' && !v.available) return false;
  return true;
}

/**
 * A bounded FIFO queue absorbs short bursts. Each queued request gets at most
 * Z3_QUEUE_WAIT_MS to start; each child then has Z3_WORKER_TIMEOUT_MS to exit.
 * We reserve a worker slot until 'close', even when the reply was already
 * rejected on timeout, so a hung process cannot create oversubscription.
 */
function pumpQueue(): void {
  while (runningWorkers < Z3_MAX_CONCURRENT_WORKERS && waitingJobs.length > 0) {
    const job = waitingJobs.shift()!;
    if (job.timer !== undefined) clearTimeout(job.timer);
    startWorker(job);
  }
}

function startWorker(job: QueuedJob): void {
  const executable = workerPath();
  if (!executable) {
    job.resolve(skip(job.started, 'worker file missing from standalone build'));
    queueMicrotask(pumpQueue);
    return;
  }

  runningWorkers += 1;
  maxObservedWorkers = Math.max(maxObservedWorkers, runningWorkers);
  let child: ReturnType<typeof spawn>;
  try {
    child = spawn(process.execPath, [executable], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
  } catch (err) {
    runningWorkers = Math.max(0, runningWorkers - 1);
    job.resolve(skip(job.started, 'spawn failed: ' + String(err)));
    queueMicrotask(pumpQueue);
    return;
  }

  let settled = false;
  let output = '';
  let stderr = '';
  const finish = (result: Z3Certificate) => {
    if (settled) return;
    settled = true;
    job.resolve(result);
  };
  const deadline = setTimeout(() => {
    finish(skip(job.started, 'worker exceeded 5000ms deadline and was killed'));
    child.kill('SIGKILL');
  }, Z3_WORKER_TIMEOUT_MS);

  child.stdout?.setEncoding('utf8');
  child.stderr?.setEncoding('utf8');
  child.stdout?.on('data', (chunk: string) => {
    if (settled) return;
    output += chunk;
    if (Buffer.byteLength(output) > MAX_REPLY_BYTES) {
      finish(skip(job.started, 'worker output exceeded protocol size'));
      child.kill('SIGKILL');
    }
  });
  child.stderr?.on('data', (chunk: string) => {
    stderr = (stderr + chunk).slice(-MAX_ERROR_BYTES);
  });
  child.once('error', (err) => {
    finish(skip(job.started, 'worker process error: ' + err.message));
    child.kill('SIGKILL');
  });
  child.once('close', (code, signal) => {
    clearTimeout(deadline);
    runningWorkers = Math.max(0, runningWorkers - 1);
    if (!settled) {
      if (code !== 0) {
        finish(skip(job.started, 'worker terminated (code=' + code + ', signal=' + signal + '): ' + stderr.slice(-250)));
      } else {
        try {
          const cert: unknown = JSON.parse(output.trim());
          if (!validCertificate(cert)) {
            finish(skip(job.started, 'worker returned an invalid certificate'));
          } else {
            // End-to-end latency includes time spent waiting for a slot.
            finish({ ...cert, ms: performance.now() - job.started });
          }
        } catch {
          finish(skip(job.started, 'worker returned malformed JSON'));
        }
      }
    }
    pumpQueue();
  });
  child.stdin?.on('error', () => { /* handled through child close */ });
  child.stdin?.end(JSON.stringify(job.input) + '\n');
}

/** No caller-supplied worker executable or shell. Only the built, fixed worker. */
export function certifyDecisionIsolated(input: Z3DecisionInput): Promise<Z3Certificate> {
  const started = performance.now();
  if (!workerPath()) {
    return Promise.resolve(skip(started, 'worker file missing from standalone build'));
  }
  if (runningWorkers >= Z3_MAX_CONCURRENT_WORKERS &&
      waitingJobs.length >= Z3_MAX_QUEUED_REQUESTS) {
    return Promise.resolve(skip(started, 'verification queue at capacity'));
  }

  return new Promise<Z3Certificate>((resolve) => {
    const job: QueuedJob = { input, started, resolve };
    if (runningWorkers < Z3_MAX_CONCURRENT_WORKERS && waitingJobs.length === 0) {
      startWorker(job);
    } else {
      waitingJobs.push(job);
      job.timer = setTimeout(() => {
        const index = waitingJobs.indexOf(job);
        if (index < 0) return; // Already running: timer was cancelled by pumpQueue.
        waitingJobs.splice(index, 1);
        resolve(skip(started, 'verification queue wait deadline exceeded'));
      }, Z3_QUEUE_WAIT_MS);
      pumpQueue();
    }
  });
}
