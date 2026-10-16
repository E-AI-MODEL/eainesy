/**
 * Entrypoint copied into the Next.js standalone output during build.
 * Receives ONE certificate request on stdin, writes ONE certificate on stdout.
 * Z3 and its pthread worker exist only inside this expendable child process.
 */
import { certifyDecision } from './z3-cert-core.mjs';

const MAX_INPUT = 16 * 1024;
let input = '';
for await (const piece of process.stdin) {
  input += piece.toString('utf8');
  if (Buffer.byteLength(input) > MAX_INPUT) {
    process.stderr.write('Certificate request too large\n');
    process.exit(2);
  }
}
try {
  const params = JSON.parse(input);
  const cert = await certifyDecision(params);
  process.stdout.write(JSON.stringify(cert) + '\n', () => process.exit(0));
} catch (error) {
  process.stderr.write('Z3 child failed: ' + String(error) + '\n');
  process.exit(1);
}
