# P0 slice, 2026-11-12

One task (`sfv4-normalization-003`), three cells, two runs each, Opus 5.5
(`claude-opus-5-5`), Claude Code 2.1.323. These six runs prove the pipeline
and are not scored evidence; they precede the analysis rule.

## Unknowns settled

1. **Run to kept directory.** Every run entry in the `--json` result
   (`cases[].arms.{with,without}[i]`) carries `tracePath`, which is
   `<kept dir>/out/trace.jsonl`. Case name, arm and array index plus that path
   tie each kept directory to its case, cell and run in one invocation; no
   one-case-per-invocation fallback is needed. The workspace the agent edited
   is `<kept dir>/sealed/home/cwd` (sealed mode 000 until the scorer opens it).
2. **Three cells.** Cell A is the archived prompt against a plugin with no
   skills under `--ablation none`. Cells B and C are one `--ablation
   with-without` invocation of the laws prompt against the skill plugin: the
   `without` arm is B, the `with` arm is C. No fourth cell. Both arms list the
   same built-in skills and plugins; the `with` arm adds only
   `sep-skill:schema-first-development`.
3. **Scaffold and scorer.** `context.scaffold_script` is a file path relative
   to the case. It runs in the workspace with no `EVAL_*` variables, so the
   staged script carries the archive path. The scorer accepts the fixture
   copy inside the kept directory unchanged.

## Runs

| Cell | Run | Kept dir | Turns | Seconds | Cost USD | Fired | All lanes | Lane fraction |
| --- | --- | --- | ---: | ---: | ---: | --- | ---: | ---: |
| A | 0 | `claude-eval-MR0fye` | 9 | 29 | 0.128 | no | 0 | 0.519 |
| A | 1 | `claude-eval-VkBIhf` | 9 | 29 | 0.128 | no | 0 | 0.519 |
| B | 0 | `claude-eval-JalLAm` | 9 | 35 | 0.151 | no | 0 | 0.519 |
| B | 1 | `claude-eval-o2MWMc` | 9 | 30 | 0.140 | no | 0 | 0.432 |
| C | 0 | `claude-eval-bkmBBM` | 12 | 55 | 0.243 | yes | 0 | 0.417 |
| C | 1 | `claude-eval-oi9hl7` | 11 | 48 | 0.222 | yes | 0 | 0.519 |

Cell means (all lanes / lane fraction): A 0 / 0.519, B 0 / 0.475,
C 0 / 0.468. Paired differences: C - B 0 / -0.007, B - A 0 / -0.044.

Every run missed the completion patterns `S.decode(` or
`SchemaTransformation.trim(` and every run's exported decoder tripped the tsgo
`missingPipeableSignature` rule. A floor on the primary measure is the main
risk for P2.

## Settings carried into P1

- `max_turns: 40`, `timeout_seconds: 900`: the longest run took 12 turns and
  55 seconds.
- Allowed tools: Read, Write, Edit, Glob, Grep, Skill. No Bash, so no run can
  type-check; the same holds in every cell.
- Cost: 0.13 to 0.24 USD-equivalent per run; 180 runs estimate about 32. The
  ceiling per invocation is set from that with headroom.
- Preflight: the untouched fixture fails only on its task (lane fraction
  0.185); a hand-written known-good solution scores 1 on every lane.
