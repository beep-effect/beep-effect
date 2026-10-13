### sol-2-1
- file: scratchpad/effected/workspaces/ConfigDependencyHooks.ts:697
- class: bug   severity: required
- standard: D9 and §14 permit a verified upstream-bug fix; `ConfigDependencyHooks.ts:649–652` promises equivalent catalog threading between subprocess and in-process replay.   evidence: A read-only Node probe executed the exact `REPLAY_SCRIPT` extracted from commit `60fcfb5`, supplying an identity hook and the seed `{"__proto__":{"effect":"^4.0.0"},"named":{"foo":"^1"}}`. The returned payload contained only `config.catalogs.named`; the own `__proto__` catalog disappeared. Executing the pinned oracle’s script reproduced the loss. A read-only call through the lab’s `layerFrom` preserved both catalogs. This subprocess defect is separate from the recorded `fromBunBlocks` repair.
- failure: Assigning `catalogs["__proto__"]` on `{}` invokes the inherited prototype setter instead of creating an own catalog entry. Subprocess replay silently removes a valid seeded catalog, so switching replay layers changes catalog resolution even when the hook preserves its input.
- fix: Construct the child’s named-catalog record with an own-key-safe operation such as `Object.fromEntries`, retaining the existing per-catalog copies and declaration order. Add a regression that passes an own `__proto__` catalog through the actual child script, and record the verified upstream-bug deviation under D9/§14.

### sol-2-2
- file: scratchpad/effected/workspaces/DuplicateCheck.ts:413
- class: perf   severity: required
- standard: D11 permits required performance findings with an algorithmic-class improvement.   evidence: The provenance pass iterates every importer over every entry in `importerRoots`, then searches each entry’s path array. For a schema-valid normalized lockfile with \(I\) importers, each resolving one distinct non-workspace root through its dependency entry, this performs \(I^2\) membership checks although there are only \(I\) importer-to-root relationships. A read-only probe counted **10,000**, **40,000**, and **160,000** calls to the relevant `paths.includes` for **100**, **200**, and **400** importers respectively. The defect is inherited from upstream; the evidence is the quadratic algorithm and a linear replacement, rather than a claimed timing regression. Round-1 b12 concerns queue shifting, which is a different operation.
- failure: Importer provenance construction performs quadratic work on a sparse input whose relationship count and required provenance output are linear. This cost is incurred even when the final duplicate report is empty.
- fix: Record each importer-to-instance relationship during the existing root-resolution pass, or retain an importer-keyed list and iterate only that importer’s roots afterward. Preserve importer order and the existing `record` deduplication. This reduces the provenance pass to \(O(I + R)\), where \(R\) is the number of importer-to-root relationships.

### sol-2-3
- file: scratchpad/effected/workspaces/ConfigDependencyHooks.ts:760
- class: schema   severity: required
- standard: `scratchpad/EFFECTED_PORT_GOAL.md`, operator revision step 4, requires IdentityComposer identity and field/schema annotations on **every schema**; `standards/effect-first-development.md` EF-12 requires meaningful canonical annotation metadata.   evidence: `ReplayPayload` defines the named subprocess wire protocol without an `$I` annotation, and its protocol fields have no annotation metadata. A read-only probe evaluated this exact schema expression and returned `protocolAnnotations: null`; `S.toJsonSchemaDocument` produced an anonymous `anyOf`, no title or description, and `definitions: {}`. The green compiler, lint, coverage, and docgen gates therefore did not establish this metadata requirement. Round-1 r02 covers the hook configuration/result models, rather than this replay envelope.
- failure: The named replay boundary lacks the required canonical identity and explanatory metadata. Its generated schema exposes anonymous success/failure shapes without the protocol identity or field meanings required by the identity migration.
- fix: Annotate `ReplayPayload` with `$I.annoteSchema("ReplayPayload", …)` and annotate its `ok`, `config`, `name`, `message`, and `stack` fields. Preserve the existing wire representation, optionality, and decoding behavior.

REQUIRED: 3
BACKLOG: 0