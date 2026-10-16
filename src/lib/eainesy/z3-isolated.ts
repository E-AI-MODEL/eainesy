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
const MAX_REPLY_BYTES = 16 * 1024;
const MAX_ERROR_BYTES = 2048;
let runningWorkers = 0;

export function z3WorkerStatus(): { running: number; limit: number } {
  return { running: runningWorkers, limit: Z3_MAX_CONCURRENT_WORKERS };
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

/** No caller-supplied worker executable or shell. Only the built, fixed worker. */
export function certifyDecisionIsolated(input: Z3DecisionInput): Promise<Z3Certificate> {
  const started = performance.now();
  if (runningWorkers >= Z3_MAX_CONCURRENT_WORKERS) {
    return Promise.resolve(skip(started, 'all verification processes busy'));
  }
  const executable = workerPath();
  if (!executable) return Promise.resolve(skip(started, 'worker file missing from standalone build'));

  runningWorkers += 1;
  return new Promise<Z3Certificate>((resolve) => {
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(process.execPath, [executable], {
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      });
    } catch (err) {
      runningWorkers -= 1;
      resolve(skip(started, 'spawn failed: ' + String(err)));
      return;
    }
    let settled = false;
    let output = '';
    let stderr = '';
    let expired = false;
    const finish = (result: Z3Certificate) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    const deadline = setTimeout(() => {
      expired = true;
      finish(skip(started, 'worker exceeded 5000ms deadline and was killed'));
      child.kill('SIGKILL');
    }, Z3_WORKER_TIMEOUT_MS);
    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', (chunk: string) => {
      output += chunk;
      if (Buffer.byteLength(output) > MAX_REPLY_BYTES) {
        finish(skip(started, 'worker output exceeded protocol size'));
        child.kill('SIGKILL');
      }
    });
    child.stderr?.on('data', (chunk: string) => {
      stderr = (stderr + chunk).slice(-MAX_ERROR_BYTES);
    });
    child.once('error', (err) => {
      finish(skip(started, 'worker process error: ' + err.message));
    });
    child.once('close', (code, signal) => {
      clearTimeout(deadline);
      runningWorkers = Math.max(0, runningWorkers - 1);
      if (settled) return;
      if (expired || code !== 0) {
        finish(skip(started, 'worker terminated (code=' + code + ', signal=' + signal + '): ' + stderr.slice(-250)));
        return;
      }
      try {
        const cert: unknown = JSON.parse(output.trim());
        if (!validCertificate(cert)) {
          finish(skip(started, 'worker returned an invalid certificate'));
          return;
        }
        // Wall time includes process startup/IPC, not only solver time.
        finish({ ...cert, ms: performance.now() - started });
      } catch {
        finish(skip(started, 'worker returned malformed JSON'));
      }
    });
    child.stdin?.on('error', () => { /* handled via process close */ });
    child.stdin?.end(JSON.stringify(input) + '\n');
  });
}
