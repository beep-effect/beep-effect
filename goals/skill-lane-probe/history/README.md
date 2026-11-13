# History

- [`preflight.json`](./preflight.json): preflight under scorer profile
  `skill-probe-scorer/v3`, rerun 2026-11-13 on a fresh stage of the archive
  at commit `94b8d15cd23bd07a95f6f1ab0680d24b94c5103b`. 12 of 12 tasks pass;
  none is dropped. The rows match the first probe's receipt. The stage
  hashes are skill `78e11cec…c61813d` and laws `0d1e86e4…ee680142`, the
  same as the first probe's runs.
- [`p1-first-slice/`](./p1-first-slice/README.md): the acceptance check of
  the report change on the first probe's pilot records. Pilot data; not a
  finding.

## P0 plan headroom, 2026-11-13

- `bun run beep accounts status`: the signed-in Claude account had 52% of
  its weekly limit left, resetting in 2 days 22 hours.
- One one-turn `claude -p --model claude-opus-5-5` call answered on Claude
  Code 2.1.323, the version the first probe's pilot ran on.
