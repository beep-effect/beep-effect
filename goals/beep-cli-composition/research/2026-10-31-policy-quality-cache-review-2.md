# Cache baseline review: current-main policy closure refresh

Reviewer: Codex, GPT-6.1-Sol medium, `fix/policy-closure-quality`.

This supplements the retained policy-quality cache review after merging main
`3fbb6e614b`, which retires the graft tooling. Both generated-inventory parents
were preserved before resolving their merge conflicts and running the writers.

The canonical fingerprint writer changes only six root seal input arrays:

- The goals-doctor, goals-index, knowledge, lint-deprecated-apis and
  lint-roadmap-refs seals each remove the retired `src/internal/GlobPattern.ts`.
- The quality seal adds `commands/Docgen/internal/JsDocNodes.ts` and removes
  `src/internal/GlobPattern.ts`, the retired `commands/Graft/Graft.schemas.ts`
  and its now-unreached `packages/foundation/modeling/schema/src/UnitInterval.ts`.

All paths above are under the CLI source directory unless fully qualified.
Review of the full Turbo task diff confirms commands, cache flags, outputs,
environment selection and dependency scheduling match the merged main.
The graph refactor's generated fingerprints match the pre-refactor output;
its module parser also matches main's parser on 942 current CLI TypeScript
files. No complexity suppression or threshold change is included.

Re-record only the root (`//`) legacy cache posture against the incoming main
baseline; preserve every other subject review. This grants no qualification.
Reverse this review and its associated generated-input/baseline changes
together; partial reversal remains detectable by the cache-policy check.
