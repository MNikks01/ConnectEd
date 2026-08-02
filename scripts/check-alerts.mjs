/**
 * Checks the two things `promtool` cannot.
 *
 * `promtool check rules` proves the YAML is valid PromQL. It says nothing about whether an alert
 * carries the label the routing keys on, or whether the runbook it points at is a file that
 * exists. Both have been wrong here before: every rule pointed at the runbooks *folder* rather
 * than a page, and none of them carried a `service` label to group or inhibit by.
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rules = readFileSync(join(root, 'infrastructure/prometheus/alerts.yml'), 'utf8');

const SEVERITIES = new Set(['page', 'ticket']);
const problems = [];

// Deliberately not a YAML parser: this file is the contract's last line of defence, and adding a
// dependency to it is how a check stops being run.
const blocks = rules.split(/^\s{6}- alert: /m).slice(1);

for (const block of blocks) {
  const name = block.split('\n')[0].trim();
  const severity = /severity:\s*(\S+)/.exec(block)?.[1];
  const service = /service:\s*(\S+)/.exec(block)?.[1];
  const runbook = /runbook:\s*'([^']+)'/.exec(block)?.[1];

  if (!severity || !SEVERITIES.has(severity)) {
    problems.push(`${name}: severity must be one of ${[...SEVERITIES].join(', ')} — routing keys on it`);
  }

  if (!service) {
    problems.push(`${name}: no service label, so it cannot be grouped or inhibited`);
  }

  if (!runbook) {
    problems.push(`${name}: no runbook annotation`);
  } else if (!existsSync(join(root, runbook))) {
    problems.push(`${name}: runbook ${runbook} does not exist`);
  } else if (runbook.endsWith('/')) {
    problems.push(`${name}: runbook ${runbook} is a folder — link the page that helps`);
  }
}

if (problems.length > 0) {
  console.error('Alert rules are incomplete:\n' + problems.map((p) => `  - ${p}`).join('\n'));
  process.exit(1);
}

console.log(`${blocks.length} alert rules: severity, service, and a runbook that exists.`);
