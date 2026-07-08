# Fixer lane — knip ({{WAVE_ID}} / {{SCOPE_LABEL}})

You are the single writer for the packages/paths listed in your slice. Read
`goals/standards-remediation/SPEC.md` FIRST (fences 10–14, RC-KNIP, report
contract).

## Assigned findings (pasted by the driver)

{{ENTRY_SLICE}}

## Procedure

Per finding kind:
- `files` (unused file) → verify nothing references it (`rg` the basename AND
  the module path across the repo, including configs/scripts/docs), then
  delete. If referenced dynamically, fix the reference story and report it.
- `exports` / `types` → delete the export (keep the implementation if used
  internally) or wire the real consumer that should exist.
- `unresolved` → repair the import/path/alias.
- `dependencies` / `devDependencies` → confirm no usage (source, configs,
  scripts, docgen, CLI invocations), then remove from that package's
  package.json. Do NOT run `bun install` — report manifest edits; the driver
  batches the lockfile update.
- `binaries` → correct the script or add the missing dependency.

A finding you believe must stay requires evidence (`disposition: must-keep` +
the exact usage reference) — the driver will challenge it. Deleting a file
that is actually a public entrypoint is a stop condition; check barrel exports
first.

## Verify (scoped — fence 12)

`turbo run build check test --filter=<each touched package>`. Never edit
`standards/*.jsonc` or `knip.jsonc` baselines (driver-owned).

## Report

`goals/standards-remediation/ops/reports/{{WAVE_ID}}/{{SANITIZED_LANE}}.md`:
per-finding dispositions, deletions listed explicitly, manifest edits listed
for the driver's lockfile pass. Do NOT commit. End with a ≤10-line summary.
