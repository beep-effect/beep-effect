# Portable citation command integration

The package now owns `citation:parity-check`. Its default completion mode
rejects the present evidence. Explicit `--audit` validates the seven available
components and prints that completion proof remains open. Audit success is
not semantic parity, production safety, repository quality or hosted delivery.

## Command contract

Run from the repository root:

```sh
bun run --cwd packages/law-practice/use-cases citation:parity-check --audit
bun run --cwd packages/law-practice/use-cases citation:parity-check
```

The fixed composition runs discovery, operations, assertions, compatible
ledgers, donor accounting, vocabulary mapping and the safety contract. Default
mode passes `--complete` to the ledger and donor validators. Audit mode retains
their source/provenance/hash/projection checks but permits unfinished workflow
rows. Each component's corruption suite remains independently required.

The command uses the Effect child-process service with at most two component
processes at once. Each receives a two-minute timeout. Standard input is ignored;
child output is discarded and only fixed component labels and pass/fail states
are printed. A process failure or timeout fails that component. Fixed argv
arrays use the running Bun executable without a shell. Evidence cannot provide
executable commands. These maintainer deadlines are separate from engine limits.

`--fixtures path` and `--evidence path` allow isolated evidence copies. Unknown
options, duplicate options and missing path values fail before running checks.
The normal defaults resolve from the command file, independently of the caller's
working directory. The package-scripts generator preserves this custom script;
its check found 189 manifests with zero script drift and wrote none.

## Completion proof still missing

Four fixed final verifier entrypoints are required in completion mode:

- `check-divergences.ts`: normalized differences and focused target regressions.
- `check-regex-benchmarks.ts`: complete family compatibility and adversarial proof.
- `check-supplemental.ts`: additional oracle probes and their coverage ledger.
- `check-target-parity.ts`: target execution against the full canonical corpus.

These entrypoints do not yet exist. Their fixed location is this packet's
`ops/` directory; their future interface accepts `--fixtures` and `--evidence`.
Each must validate its actual proof, rather than treating file presence as
completion. Audit mode reports absent verifiers as pending and skips final
verification even if an entrypoint is present. Default mode requires all four
to exist and succeed, in addition to all seven component checks. They run
serially and use the same process deadline. Their schemas, exhaustive checks
and rejection controls remain implementation work.

The current completion run fails ledger and donor checks and reports all four
pending final verifiers. The command cannot establish a completion verdict for
the current corpus. No target engine execution, regex-family approval, donor
disposition, divergence waiver or goal completion is asserted here.

## Verification

`ops/verify-parity-controls.py` invokes the actual package script. It first
requires the committed audit baseline and a relocated copy to pass. It then
proves twelve rejection controls: the actual incomplete default run; unknown,
duplicate and missing-value options; an option supplied as a path; and one
corrupt input for each of the seven components. Corruptions remove the required
schema version in temporary copies. Original fixture bytes are restored within
the scratch tree between runs, and committed evidence is never mutated.

The package audit and docgen passed in 12.3 and 18.0 seconds. The command also
has a separate strict TypeScript/Effect diagnostic check because packet scripts
are outside the package compiler's source roots. Formatting, Markdown checks
and `git diff --check` cover the new authored files. This is a local integration
checkpoint; full goal and repository completion remain open.

Local execution logs are retained under
`/home/elpresidank/.cache/beep/citation-extraction-engine/`:
`parity-controls.log`, `parity-audit.log`, `parity-typecheck.log`,
`parity-package-scripts.log`, `parity-package-verify.log` and
`parity-markdown.log`. Cache logs are supporting observations, not portable
completion artifacts.
