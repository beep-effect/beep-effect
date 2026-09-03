# Running opportunities ledger: practice-box-provisioning

Friction receipts captured while shipping, per the repository friction law.

## P1 implementation

1. **Package verification did not build a changed project reference.** `unowned`

   The first
   `bun run beep quality package-verify @beep/box-provisioning` run failed in
   `tsc -p tsconfig.json` because the new `$BoxProvisioningId` existed in
   `@beep/identity` source but not in its previously built declarations. The
   missing export caused a cascade of `never` errors in every annotated schema.
   `bun run beep quality package-verify @beep/identity`, followed by the same
   reconciler verification command, passed.

   **What would have prevented it:** package verification could build changed
   TypeScript project references before auditing the target package, or
   `create-package` could print the required dependency verification order when
   it registers a new package identity.

## P2 verification

1. **The full unit sweep observed transient repo-cli state.** `unowned`

   `bun run beep yeet repair` completed cheap gates, docgen, build, check,
   lint, and both touched-package test suites, then reported two failures in
   untouched `@beep/repo-cli` tests: one goals-index projection mismatch and
   one root-concurrency assertion. The implicated source and tests were
   byte-identical to `origin/main`; an immediate isolated Vitest rerun passed
   both files and all 195 tests.

   **What would have prevented it:** state-sensitive repo-cli tests could use
   immutable fixtures for goal projections and scheduler defaults, or the
   quality receipt could distinguish a failure that disappears on an isolated
   exact-tree rerun from a deterministic source failure.

2. **The default Box current-user response omitted the tenant guard.** `owned`

   The private read-only identity bootstrap authenticated successfully but
   failed closed at `extract-identity-guards`: `users.getUserMe` returned the
   service subject while omitting the optional enterprise object. Requesting
   the exact `id` and `enterprise` fields made the same live bootstrap pass,
   without logging either identifier.

   **What would have prevented it:** the inventory boundary should have carried
   an explicit current-user field projection from the start, with a regression
   test asserting the SDK query required by both identity guards.

3. **Package verification missed a touched-file Effect law.** `unowned`

   Canonical `package-verify` passed audit and docgen, but the root
   `laws effect-fn --check` still found four unnamed reusable Effect generators
   in the same new package. Naming the two inventory helpers, the no-op applier,
   and the sequential per-action callback cleared the root law without changing
   behavior.

   **What would have prevented it:** package verification could run the
   touched-file Effect governance checks scoped to the target package, so a
   green package handoff implies the root policy lanes will accept that package.

4. **Planner digests preserved incidental provider ordering.** `owned`

   PR review found that reordering equal-depth desired resources, observed
   resources, or webhook trigger sets could change state and plan digests even
   when their semantics were unchanged. The planner now canonicalizes logical
   resources, provider resources, and trigger sets before producing actions or
   digests; regression proof covers both desired and observed reorderings.

   **What would have prevented it:** the planner's initial determinism tests
   should have included permutation invariance, not only repeated execution of
   one fixed input ordering.

5. **Syncing the goal branch to main left stale dependency declarations.** `unowned`

   After merging `origin/main` (which landed the codec-statics refactor in
   `@beep/schema` after this packet's first PR merged),
   `bun run beep quality package-verify @beep/box` failed in
   `tsc -p tsconfig.json` with every schema helper collapsing to `never` in
   `Box.errors.ts` and `Box.streaming.ts`. The reconciler package verified
   green first because it consumes `@beep/box` declarations that were still
   consistent. `bun run beep quality package-verify @beep/schema` rebuilt the
   dependency; the box verify then hit one locationless native TS2589 and
   passed on an unchanged rerun (audit 26.1s, docgen 9.0s), which auto-acked
   the armed P0 inbox row at the same commit.

   **What would have prevented it:** package verification could detect built
   declarations older than their source across project references and rebuild
   them before auditing, or the packet playbook's merge step could say to
   verify changed dependency packages first.

6. **The 1Password desktop-app CLI integration blocked every live step for weeks.** `unowned`

   From agent sessions, `op whoami` reported "account is not signed in" and
   `op read` reported "connecting to desktop app: connection reset" while the
   desktop app was open and unlocked. The integration is a per-terminal,
   PolKit-approved session that idles out, is revoked by device lock, rejects
   parent binaries under the home directory, and is unsupported for headless
   launches. Replaced on 2026-09-03 by a PATH shim that loads a scoped service
   account (or the local Connect server) and fails loud instead of prompting.

   **What would have prevented it:** the packet's P0 credential-path gate
   could have required an automation credential from the start instead of
   treating the desktop integration as a viable agent path.

7. **A Box Sign listing 403 failed the whole live dry-run.** `owned`

   The first live dry-run stopped with a bare `BoxError` from
   `signRequests.getSignRequests` (HTTP 403) although nothing in the desired
   state depends on Sign. Metadata and retention listings already classified
   403 as permission-blocked discovery; Sign did not. Fixed in #959 with a
   regression test.

   **What would have prevented it:** one shared permission-tolerant discovery
   helper for every observation-only listing from the first implementation.

8. **The private runner passed a decoded intent to `applyReviewedPlan`.** `owned`

   The first attended apply stopped before any mutation with
   `BoxProvisioningSchemaError`: the runner decoded the intent for its own use
   and then handed the decoded instance to a service that decodes again; the
   dry-run path passed the raw JSON and worked. Fixed in the private runner.

   **What would have prevented it:** keeping the runner's apply path under a
   tracked test, or documenting the raw-input contract on `applyReviewedPlan`.
