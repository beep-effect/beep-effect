# Synthetic runner v2 verification

The local runner now separates absent-script observations from task executions
in `cache-synthetic-local/v2`. Existing v1 receipts remain historical evidence
for their earlier implementation; they do not establish the new cases.

This increment adds two more independent fresh/fresh pairs, giving three in
total, and a fresh execution with the orchestration-only variable changed.
Previously that variable was checked only through a local hit. A fresh run now
requires the expected manifest command and task execution metadata whose
success/failure status agrees with the enclosing process. Missing execution
metadata cannot silently receive a fresh-origin label.

The absent-script fixture retains a configured Turbo task but removes the
workspace script. Its separate receipt records summary/selected-node counts,
execution-metadata count, commands, output/log existence, bounded-capture
violations and hashes. It is excluded from the `runs` array. The runtime check
requires no execution record, output tree or replay log; matching graph node
counts alone cannot pass an execution comparison.

Formatting and schema-first validation pass. The full CLI package gate passed
audit in 381.7 seconds and docgen in 19.8 seconds on this source increment.
Exact stable and canary runtime experiments have now passed under existing
admission. Each records 21 executions, one separate absent-script observation
and 16 passing checks. The absent-script summaries contain zero task and
execution records and no output tree or replay log. All three fresh/fresh
pairs and the additional fresh orchestration comparison pass for each client.

The [stable receipt](./synthetic-local-v2-stable.json),
[canary receipt](./synthetic-local-v2-canary.json) and
[checkpoint](./synthetic-local-v2-checkpoint.json) preserve separate versions
and results. The checkpoint's source hashes identify the launch-time runner;
later census integration changes the public barrel and has its own package
verification. Local hits do not count as verified signed remote replay.

Lockfile/runtime/package-manager perturbations, synthetic signed replay and
shadow evidence, the real pilot's complete matrix, accepted sibling receipts
and final Yeet acceptance remain required. Identity lint remains excluded and
cache-disabled. No qualification transition occurs in this increment.
