# Research friction receipts

## 2026-08-27: provider smoke proof stalled behind conflicting 1Password state

- Work: inject the existing `op://` references for the required live Anthropic
  extraction without reading or writing secret values.
- Evidence: the 1Password MCP authentication call returned `1Password desktop
  app is not running` while the desktop process was present. `op whoami` had no
  signed-in session. The single `op run --env-file=.env` fallback waited without
  terminal output, then returned `authorization prompt dismissed`.
- Impact: the MCP/initial CLI path delayed the provider proof. The operator later
  authorized the same secret-reference injection through `op run`; the sanitized
  Anthropic recording succeeded at `2026-08-27T12:25:18.044Z` without exposing
  secret values, as recorded in the golden-bundle evidence.
- Prevention: add an agent preflight that distinguishes desktop process state,
  MCP bridge availability, CLI sign-in, and a pending authorization prompt
  before a provider proof begins. It should report only state labels and never
  secret values.

## 2026-08-27: bundle output roots were relative to the package command

- Work: build two ignored offline publications and compare all five JSON contracts byte for byte.
- Evidence: both builds succeeded, but the first comparison returned
  `cmp: .beep/lejeune-demo-publication-v5/bundle/bundle.json: No such file or directory`.
  `bun run --cwd apps/labs/lejeune-bolt-workbench bundle:build` resolved the relative output roots
  from the lab directory, while the comparison ran from the repository root.
- Impact: no publication data was lost. The path mismatch caused one false comparison failure and
  required a targeted ignored-file inventory before the real comparison could run.
- Prevention: print the resolved publication root in the successful builder log, or document that
  `LEJEUNE_BUNDLE_ROOT` and `LEJEUNE_MUTABLE_ROOT` are relative to the package command's working
  directory.

## 2026-08-27: lab creation left the generated Fallow boundary inventory stale

- Work: run the authoritative Yeet pre-push proof after publishing the coherent LeJeune lab PR.
- Evidence: `repo-sanity:fallow-boundaries-config` reported
  `standards/fallow.boundaries.generated.jsonc is stale` and named
  `bun run fallow:boundaries:write` as the repair command.
- Impact: all 12 cheap gates passed, but the full proof stopped before its heavyweight wave and
  required a follow-up generated-config commit.
- Prevention: have lab creation or its post-create verification regenerate and check the Fallow
  boundary inventory before the first publication attempt.

## 2026-08-27: XLSX archive bytes depended on the runner time zone

- Work: close the published LeJeune PR through its dedicated hosted Labs check.
- Evidence: the GitHub runner produced XLSX digest `4bb7423602f926d07ce3697f749d26cb989a4781f2ae69fb986f22b9c079a48d`
  instead of the frozen `09c038e5118283ff15382a632ca6c6e9c811ef4e7235128623956f6043b1d4c5`.
  `fflate` encodes ZIP timestamps from local `Date` fields, so the same UTC instant wrote different
  archive metadata in UTC and America/Chicago.
- Impact: six Labs tests failed because the source digest no longer matched the frozen manifest and
  closed bundle references. The extracted spreadsheet text was unchanged.
- Prevention: pass `fflate` a zone-less fixed local timestamp and run the pinned digest test under
  UTC plus at least one non-UTC time zone before publication.
