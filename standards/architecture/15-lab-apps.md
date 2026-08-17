# 15 — Lab Apps

Lab apps are law-abiding experimental applications under `apps/labs/*`. They
exist to make an uncertain product or integration idea cheap to prove without
making the proof structurally unlike production code.

A lab app is durable while it is useful and disposable when it is not. It is a
real private workspace app, not a scratch file, package family, slice role, or
feature flag. Its path carries the lifecycle class so tooling can apply the
same policy to every lab without accumulating package-name lists.

## Law Posture

Lab apps obey the full code law:

- schema-first and Effect-first modeling
- typecheck and test typecheck
- Biome, Effect language-service, and native-runtime rules
- import boundaries, circular-dependency checks, dead-code analysis, and
  identity registration
- secret scanning, SAST, and dependency security
- portless dev-server naming

Labs are exempt only from package ceremony, by path construction. They do not
publish docgen surfaces, enter JSDoc or coverage ratchets, require changesets,
or register Storybook stories. These are not waivers for code quality. A new or
changed lab must pass its lab lane on its own PR; the lane remains non-required
for unrelated product work.

The Scratchpad Lane remains the home for throwaway, law-relaxed exploration. A
lab is the next step: production-shaped enough to test architecture and
integration claims honestly, with deletion cheap enough that compliance does
not turn an experiment into permanent topology.

## Registration Without Per-Lab Root Churn

The repository carries one workspace glob and one set of path-scoped gate
rules for the labs root. Creating or deleting a lab MUST NOT add or remove a
lab-specific row in root workspace, changeset, coverage, docgen, Storybook, or
CI configuration.

Registration is declared as geometry shared by create-package,
delete-package, and doctor:

- create interprets each declared surface forward;
- delete interprets the same surface inversely;
- doctor compares the declaration with the live tree and reports missing,
  stale, or residual state.

Derived configuration is rebuilt by its owning writer. A lab is not added to
the root TypeScript solution reference list; its package-local check and the
labs lane own typechecking. Identity composers remain real package composers
and live in a mechanically generated labs segment of the identity registry.
Changeset status excludes lab-owned diffs by resolved workspace path, not by a
growing ignore-name list.

No lab publishes a public `@beep/*` API. Framework-local imports use the app's
local alias. A component that earns reusable consumers must promote into its
lawful package or slice home before other workspaces import it.

## Manifest And Disposition

Every lab owns a schema-decoded manifest below its workspace root. The manifest
records:

- purpose
- creation date
- disposition: `active`, `promote`, or `expired`
- optional manifest-owned local data resources

`active` means the lab is still a proving ground. `promote` means its result has
earned a durable non-lab home and must follow the promotion runbook. `expired`
means the proof no longer justifies its footprint and should be deleted. These
states are inventory and operator intent, not a TTL or CI nag.

## Lifecycle

### Create

Create through the repo package factory's lab mode. The selected app variant
must produce a private, portless, testable workspace with a decoded manifest,
real identity composer, and no public exports or ceremony surfaces. The
one-time labs registration must make creation free of per-lab shared-config
edits.

### Promote

Promotion is a reviewed runbook, not a rename command:

1. Choose the smallest lawful durable home: an app, owning slice, shared-kernel
   promotion, driver, foundation package, tooling package, or ecosystem
   package.
2. Move the code and apply that home's full registration and ceremony.
3. Migrate consumers in the same change; product code never imports the lab
   path.
4. Preserve the package identity when the promoted package keeps the same
   semantic ownership. Record an explicit identity transition when it does
   not.
5. Delete the lab through delete-package and finish with doctor clean.

The operational command sequence is the promotion runbook in
`docs/runbooks/lab-promotion.md`.

A promotion that creates or changes a shared export follows the owning
doctrine's admission and decision-record requirements. Lab status alone never
waives a promotion gate.

### Delete And Retire

Delete through `beep delete-package`. The command refuses live dependents,
inverts every declared registration surface, rebuilds writer-owned derived
state, removes ignored artifacts, and runs doctor. `--force` never overrides a
dependent.

Labs use the pre-v1 retirement class: consumer migration and removal happen in
the same PR, with no sunset window. This is the narrow D14 waiver to the general
evolution procedure in [11-evolution-and-deprecation.md](11-evolution-and-deprecation.md).
A DECISIONS entry is required only when the lab had promoted a shared export or
when deletion changes an architecture-wide promise. Historical research and
shipped records remain intact.

Manifest-owned Postgres state is namespaced to the lab. Delete may drop it only
with explicit destructive consent, after proving the schema name is uniquely
derived from and owned by the target lab. Non-local connections require a
second explicit override. Without consent, deletion reports the manual cleanup
step and leaves data intact.

## Labs Must Never

A lab MUST NOT:

- publish a reusable `@beep/*` TypeScript API, root public index, package
  exports, or docgen surface;
- add tables or migrations to `packages/*/tables`;
- be imported by a product slice, shared kernel, foundation package, driver,
  tooling package, ecosystem package, or production app;
- add per-lab rows to root registration or ceremony configuration;
- use raw numeric localhost dev-server URLs instead of its portless labs
  hostname;
- rely on a path waiver to escape schema-first, Effect-first, security, import,
  or testing laws;
- cascade deletion into non-lab packages;
- rewrite historical evidence merely to erase a retired lab name.

If an experiment needs any of these, it has outgrown the lab lifecycle or has
chosen the wrong home. Promote it, split out the durable capability, or delete
it.
