# 11 — Evolution and deprecation

Optionality without an exit plan is not optionality. Slices, shared exports, ports, and feature flags all need procedures for safe retirement. This doc provides them.

The architecture preserves optionality so that slices, exports, and adapters remain removable, replaceable, and forkable. That property is only real if the repo can actually exercise it. Every procedure below exists so a future maintainer can withdraw a previous decision without breaking the consumers that depended on it.

## Slice retirement procedure

A slice that did not pan out should be removable. Removal is a five-step procedure. A slice MUST NOT be removed without all five steps. Skipping the sunset window leaves dependents broken; skipping the DECISIONS entry erases the rationale trail.

1. **Mark the slice deprecated.** Add a `**Deprecated:** YYYY-MM-DD — <reason>` line to the slice's root README. List the planned removal date.
2. **Sunset window.** Default: 2 minor releases or 1 quarter, whichever is longer. The slice continues to function during this window. New features against the slice are forbidden; only bug fixes for active dependents are accepted.
3. **Dependent migration.** Any package depending on the slice's `shared/*` exports must migrate within the sunset window. The slice owner files migration PRs against dependents, or coordinates the work with their owners.
4. **Removal PR.** Delete the slice's packages. Remove the entries from `pnpm-workspace.yaml`, `tsconfig`, and `turbo.json`. Drop any future `shared/use-cases` exports the slice contributed; update each affected promotion record to `**Retired:** YYYY-MM-DD — <reason>` per `02-shared-kernel.md`.
5. **DECISIONS entry.** Add a new dated entry to `DECISIONS.md` recording the retirement with rationale. Mark the original adoption decision (if one exists) as `Superseded` with `Superseded-by:` pointing to the retirement entry.

The slice's tests, fixtures, and lint exemptions are removed alongside the packages. Cross-slice events the slice was the sole producer of are removed in the same PR; events with other producers stay.

## Future `shared/use-cases` versioning

There is no `shared/use-cases` package today; nothing has met the promotion bar
for that durable contract-only surface. When such a package exists, it is the
hardest case. A `shared/use-cases` export has multiple consumer slices, so a
breaking change breaks them all simultaneously. The discipline below preserves
the contract that consumers should never be forced to redeploy because a
producer made a non-additive change without coordination.

### Additive changes are free

- Adding optional fields to a command, query, or event schema
- Adding new error tags to a port's failure union, given consumers use exhaustive `Effect.catch` with a default branch and can ignore tags they do not handle
- Adding new commands, queries, or events alongside existing ones

Additive changes do not require a new promotion record, do not consume a deprecation window, and do not require coordination beyond normal review.

### Breaking changes require a new tagged variant

Breaking changes include:

- renaming a field
- changing a field's type
- removing a field
- changing the semantic meaning of a value (the schema may not have changed; the contract did)

The pattern: introduce `RevokeMembershipV2` alongside `RevokeMembership`. Both work during the deprecation window. At the end of the window, `RevokeMembership` is removed. The `V2` suffix may then be dropped, or kept — pick a convention and apply it consistently across the slice.

- **Deprecation window:** 2 minor releases or 1 quarter, whichever is longer.
- The promotion record for the original export gains a `**Deprecated:** YYYY-MM-DD — replaced by V2` line.
- `V2` gets its own promotion record per `02-shared-kernel.md`, including its own consumer list and review acceptors.
- The `Removal trigger` field of the original record is updated to point at `V2` adoption.

A breaking change without a `V2` variant is a contract violation, even if the producer's tests pass. Consumers depend on the published shape; the producer cannot unilaterally redefine it.

## Port deprecation

A port lives in `*.ports.ts`; its implementations live in `*.repo.ts` or similar. Removing a port follows four steps:

1. Mark the port deprecated with `/** @deprecated YYYY-MM-DD — replaced by <NewPort>; remove after <date> */`.
2. Server packages providing implementations announce removal in their `CHANGELOG`.
3. Use-case services consuming the port migrate to the new port within the deprecation window.
4. The old port and its implementations are removed in a single PR.

**Deprecation window:** same default as shared exports — 2 minor releases or 1 quarter, whichever is longer.

If the port is published from a future `shared/use-cases/*/ports.ts` (rare), the deprecation also updates the promotion record and follows the `V2` variant rule above. Slice-local ports skip the promotion record because there is no cross-slice contract to honor; they still observe the deprecation window so that consumers within the slice get a clean migration.

## Feature-flag-gated experiments

Feature flags exist to enable incremental rollouts. They must not become permanent forks of the codebase.

**Lifetime cap:** a feature flag must be removed within **6 weeks** of either:

- Full ramp — the flagged behavior is now default-on for all users.
- Rollback — the flagged behavior is reverted, never to ship.

The 6-week clock starts at the first 100%-on day or the first revert. After the cap, removing the flag is required. New feature flags should not be added to a slice while older flags in that slice are past their cap.

### How to remove a ramped flag

- Delete the old code path.
- Inline the flagged path so the flag check is gone.
- Remove the flag entry from config and from `*.config.ts` and slice config files.
- Update tests that asserted behavior under the flag; the flagged path becomes the only path.

### How to remove a rolled-back flag

- Delete the new code path.
- Leave the original path in place.
- Remove the flag entry from config.
- Remove tests that exercised the new path.

### Audit

Flags past their 6-week cap should be tracked. A repo-cli command or a PR-time lint can enumerate them. The architecture's optionality story depends on this discipline; flags that linger become invisible coupling between the shipped code and the historical rollout decision.

A feature flag that has lived past its cap and cannot be removed indicates an unresolved product decision, not a cleanup task. Resolve the product decision first, then remove the flag.

## In-repo deprecations without a release train

The windows above measure time in releases and quarters because they protect published or
cross-slice surfaces. A symbol that is deprecated inside this repository, has never shipped in a
release, and has zero remaining consumers has nothing left to protect. Remove it in the same
change that discovers it, together with its dependents, rather than letting the tag sit until a
window that never elapses. `@deprecated` stays reserved for surfaces with consumers that need a
migration path; the tag is the start of a removal, not a home.

## Coordinating retirements across slices

Slice retirements affecting future `shared/use-cases` exports require notice to the owners of every consuming slice. One PR per consumer migration is the minimum coordination — the retirement does not land until the migrations land.

- Track cross-slice deprecations in a single coordinating issue or PR, with checkboxes for each consumer migration.
- The DECISIONS entry for the retirement records who was notified, who migrated, and any consumers who could not migrate (with their reasons).
- A consumer that cannot migrate within the sunset window blocks the retirement. The producing slice may extend the window, narrow the change, or re-scope the retirement; it may not ship the removal over a consumer that has not migrated.

Cross-slice events have the same coordination requirement: removing an event a downstream slice subscribes to is a breaking change to that slice, even though no import path connects them.

## See also

- `02-shared-kernel.md` — promotion records and the `Retired:` field on retired exports
- `05-layer-composition.md` — slice-local Layer ownership is what makes slice retirement local
- `DECISIONS.md` — the decision log records every retirement and supersedes the original adoption entry
