# Preserve actual resolution safety categories

Boundary review found that private resolution failures collapsed distinct engine
ceilings into the same limit-exceeded reason. A final public translator could
not safely infer which budget failed. Optional closed limit metadata now travels
with existing private resolution, callback, resource-object and table failures.
It reuses CitationSafetyBudget rather than adding another resource vocabulary.

Source/mention admission identifies sourceUtf16 or mentions before restoration.
The direct resolver and callback dictionary identify their actual authority,
edge, mention and iteration guards. The combined list-allocation guard is split
in its original short-circuit order so simultaneous failures retain priority.
Callback work, pair/list handles, runtime resource slots and descriptor work
preserve resolutionIterations where that is the actual configured ceiling.
Document projection identifies authority/list and candidate/membership ceilings.

Callback input translation, callback-return sanitization, resource comparison,
table sanitization, runtime mapping and descriptor projection preserve known
limit metadata. Effect Struct.pick selects only the declared limit field;
callback copying also preserves its closed reason and drops incidental payloads.
No scheduler, work ledger or error-routing framework is introduced. Existing
injected adapters can omit a category; missing metadata never fabricates one.

## Verification

Thirty-one tests across resolution-limit controls, callback sessions, original
default callback contexts and resource objects pass in 3.97 seconds. They retain
all source behavior and mutation/alias assertions while adding exact failure
category checks:

- Source and mention admission keep their categories through shared preparation,
  callback input adaptation and the direct resolver.
- One allowed callback-work step followed by refusal reports iterations.
- Retained/aliased list writes report edges without publishing rejected changes.
- Runtime-backed authority exhaustion is distinct from edge exhaustion, including
  propagation through comparison, table sanitization and callback mapping.
- Detached semantic count and full-pair allocation report mentions and iterations.
- Failure copying retains known metadata, strips injected source/cause properties
  and leaves legacy absent metadata absent.
- Existing registered default resolution replays all 76 source contexts and
  verifies receipt restoration; callback mutation and resource controls pass.

Two strengthened assertions initially assigned an edge category to guards that
correctly refused authority growth first; a broad assertion edit also assigned
iterations to a list write. The final checks use the actual existing guard order
and retain the original refusal/state-preservation assertions. A runtime-backed
edge test exposed metadata loss through the table adapter; preserving the closed
field repairs that loss rather than weakening the assertion.

Final lint/types, declaration emission and blocking laws pass. Scoped Fallow
reports zero introduced findings and nine inherited clone groups with unchanged
policy. There is no change to source expectations, prerequisite contracts,
public failure classes, budgets, thresholds or baselines.

```sh
bun run beep quality package-verify @beep/law-practice-server --quick
bun run --cwd packages/law-practice/server beep:build
bun run beep lint laws --package packages/law-practice/server
bunx fallow audit --config .fallowrc.jsonc --format json --quiet \
  --base origin/main --gate new-only
cd packages/law-practice/server
bunx --bun vitest run test/CitationResolutionLimit.test.ts \
  test/CitationCallbackSession.test.ts test/CitationDefaultCallbacks.test.ts \
  test/CitationResourceObjects.test.ts
```

This is diagnostic preservation, not completion of the public failure surface.
Generic table/set capacity refusals without an exact engine category still need
explicit owner attribution. Full extraction/cleaning/resolution translation,
public Engine/Layer, host protocols, whole-engine safety/scaling, lawful
transforms and exhaustive accounting remain required. All eleven laws, four
fidelity questions and fifteen unfinished proof rows remain open without waiver
or source/donor disposition promotion. Hosted proof remains separate.
