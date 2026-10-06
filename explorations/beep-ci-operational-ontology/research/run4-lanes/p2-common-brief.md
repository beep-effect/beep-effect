<!-- Lane brief as issued 2026-10-06 for goal phase P2; the survey notes it names live in the lane scratch, not in the repo. -->
# P2 common brief — projection on live data (W6 seam + body, W5 live replay)

Checkout: `~/YeeBois/projects/beep-effect8-s5`, branch `feat/ciops-p2-projection` (draft PR #1459), a
linked worktree of `~/YeeBois/projects/beep-effect8`. Never touch `~/YeeBois/projects/beep-effect5`.
Abbreviations: `LAB` = `apps/labs/ciops`; `CT` = `explorations/beep-ci-operational-ontology/ontology/docs/s7-projection-contract.md`;
`GD` = `goals/ciops-ontology-pipeline/research/decisions.md`; `HO` = `goals/time-to-certainty/research/gate-order-handoff.json`
(sha256 `705f3e754a51c6750529ccec1021293c82fce0994709a18906b863609a0a2198`, 33 lanes); `PIN` =
`explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/corpus/run4-fleet`.

Binding, in this order: GD "2026-10-06 — P2 design sitting" Rulings 1–10 (read them first; they decide every
open design point), SPEC.md Constraints and Stop Conditions, graduation Rulings 9 and 11, CT. The survey
notes in this directory (`01-s7-seam.md`, `02-handoff.md`, `03-replay.md`, `04-effect-graph.md`,
`05-cq-and-gates.md`, `06-critic.md`) are line-cited facts and designs; where a note and a GD ruling
differ, the ruling wins (the notes predate it).

## Hard rules for every lane

1. Edit only the files your brief names. Never edit `goals/time-to-certainty/**` (reading `HO` is fine),
   anything under `explorations/beep-ci-operational-ontology/ontology/extraction/**`, the frozen
   `explorations/beep-ci-operational-ontology/research/s7-replay-evidence.md`, `CT` sections other than
   those your brief names, or any file another concurrent lane owns. No git state changes (read-only git is
   fine); the orchestrator commits. Never `/tmp`. Never print secrets.
2. Code law: design order schema → `Context.Service` contract → implementation. Effect v4 only: validate every
   API against the installed `node_modules/effect` (4.0.0) and the reference checkout
   (`~/YeeBois/references/effect/effect`), never training-data priors (`Option.fromNullable`, v3 `filterMap`
   over Result and `collectSentinels` are known traps). `effect/HashMap`, `HashSet`, `MutableHashMap` only;
   never native `Map`/`Set`. Functions returning generators use `Effect.fn` (traced service members) or
   `Effect.fnUntraced` (helpers). Schemas are `S.Class`, `S.TaggedError` with `$I.annote`/`$I.annoteError`
   as the lab already does, and `LiteralKit` from `@beep/schema` for literal domains (no `as const`); recursive
   or encoded-side needs follow the lab's existing patterns. Prefer effect helper modules (`Array`, `String`,
   `Order`, `Match`) over native helpers. The lab never imports repo-cli, `@beep/utils` or anything outside
   its declared dependencies (`@beep/identity`, `@beep/schema`, `@effect/platform-bun`, `effect`).
3. JSDoc on every new export follows `.patterns/jsdoc-documentation.md`: a titled `**Example** (Title)`
   section with a compilable example, `**Details**`/`**Gotchas**` prose where useful, `@category` and
   `@since 0.0.0`; never `@example`/`@remarks`. The lab has no docgen, so compile-check your examples by eye
   against the real signatures.
4. Tests use `@effect/vitest` as `LAB/test/projection.test.ts` does (`it.layer(...)((it) => it.effect(...))`,
   `it.effect.prop` with `Arbitrary.schema`, byte-equal goldens with `toBe`); typed failures are asserted
   through `Effect.flip` / `assertInstanceOf` from `@effect/vitest/utils`, never `expect(Exit.isFailure(x))`.
   New test files are NEW files (`LAB/test/lane-plan.test.ts`, `LAB/test/live-replay.test.ts`); edit
   `LAB/test/projection.test.ts` only where its existing assertions must change, and never move its line 4
   (`BunFileSystem` import: the effect-vitest inventory id is line-keyed).
5. Fallow: cognitive complexity ≤ 8 and unit size ≤ 60 lines per function. Keep the planner, the decoder and
   the fold helpers small.
6. Shell is zsh; `bun` needs `zsh -ic '...'`. Lane gates you run yourself after the last edit, from the lab:
   `zsh -ic 'cd ~/YeeBois/projects/beep-effect8-s5 && bun run --filter @beep/ciops check && bun run --filter @beep/ciops test && bun run --filter @beep/ciops lint'`,
   then `zsh -ic 'cd ~/YeeBois/projects/beep-effect8-s5 && bun run beep quality test-tsgo'`,
   `zsh -ic 'cd ~/YeeBois/projects/beep-effect8-s5 && bun run beep lint laws --package apps/labs/ciops'` (or the
   lab's `lint:laws` script), `zsh -ic 'cd ~/YeeBois/projects/beep-effect8-s5 && bun run beep lint effect-vitest --rows <your scratch dir>'`
   (read `<dir>/beep_ciops.jsonl`; fix EV006/EV003/EV014 with the canon primitives; for an EV010 row on a new
   file, splice only that file's rows into `standards/effect-vitest.inventory.jsonc` next to the existing
   `apps/labs/ciops` rows, never a whole-file `--write`). Report every command and its last lines.
7. Package scripts are generated: if you add a script to `LAB/package.json`, run
   `zsh -ic 'cd ~/YeeBois/projects/beep-effect8-s5 && bun run beep lint package-scripts --write'` and keep only the
   diff that touches the lab.
8. The repo is public: no host paths, hostnames, uids or session ids in any committed byte; render
   evidence with `~`-relative or repo-relative paths only.
