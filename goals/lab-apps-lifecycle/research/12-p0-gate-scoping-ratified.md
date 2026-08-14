# P0 Gate-Scoping Ratification

Date: 2026-08-13

Basis: research/04 section 2, verified against the current config and CLI source

## Outcome

The one-time labs-scoping change is a bounded set of fourteen edits. Eight are
mechanical, two are trivial, and four need design. The design choices for root
TypeScript references, identity, changeset status, and required/non-required CI
shape are resolved or bounded in report 11.

The list below is the P2 glob PR scope. Per-lab creation and deletion must not
grow it.

## Exact one-time edit list

| # | Live surface and evidence | P2 edit | Class | Design reference |
| --- | --- | --- | --- | --- |
| 1 | Root workspaces are explicit at `package.json:433-535`; apps are at `:450-452,500-501`. | Add one `apps/labs/*` workspace member. The existing equal-depth matcher then treats each lab as covered. | **trivial** | D5; report 11 root-reference section distinguishes workspace glob membership from TS solution membership. |
| 2 | `planRootReferenceSync` reconstructs all project-tsconfig workspaces at `TsconfigSync.plan.ts:447-474`; current app refs are enumerated at `tsconfig.packages.json:10-22`. | Exclude workspaces under the labs glob from the root solution reference expected set, while retaining them in workspace discovery and package-local checks. Do not hand-edit generated references. | **needs-design** | Report 11, “Zero-root-churn holdout A.” Recommendation is path exclusion, not generated-only churn. |
| 3 | The identity registry is one flat compose call at `packages.ts:48-191`; create registration is add-only at `IdentityRegistration.ts:144-164`; lint is missing-only. | Add a deterministic labs composer/export group derived from live lab workspace manifests; extend registration sync and identity lint/doctor to compare expected and actual labs entries in both directions. | **needs-design** | Report 11, “Zero-root-churn holdout C.” |
| 4 | Deprecated-API shards explicitly name three apps at `Lint.command.ts:50-75`. | Add the labs root as one shard. Do not enumerate lab names. | **mechanical** | Report 11 authored-reference semantics. |
| 5 | Docgen scans `apps/**/docgen.json` and its ignore array at `Docgen/internal/Workspace.ts:24-38`. | Add the labs glob to `DOCGEN_CONFIG_SCAN_IGNORES`; lab templates also omit docgen config. | **trivial** | Report 11 generated-inventory semantics. |
| 6 | JSDoc inventory filters only ecosystem workspaces at `JSDocDocumentationInventory.ts:1478-1487`; output remains the JSONC/Markdown pair at `:199-200`. | Extend the workspace-universe predicate to exclude lab paths before analysis. Keep both outputs on the existing writer. | **mechanical** | Report 11 generated-inventory semantics. |
| 7 | Coverage discovery currently filters only by a `coverage` script at `CoverageRegression.ts:287-288,383-395`; replacement semantics are documented at `:509-525`. | Exclude lab paths from coverage-package discovery and coverage disposition-gap policy, and omit coverage scripts from lab templates. This prevents a later replacement write from admitting labs. | **mechanical** | Report 11 generated-inventory semantics. |
| 8 | Changeset status is still direct stock invocation from `package.json:365-366`, Repo Sanity at `CiLane.ts:936`, and GitHub preflight at `GithubChecks.ts:257-277`; ignore remains a name list at `.changeset/config.json:13`. | Add one path-aware repo-CLI status wrapper and route all three call sites through it. Never add per-lab names to the changesets ignore list. Keep changeset-graph unscoped. | **needs-design** | Report 11, “Zero-root-churn holdout B.” |
| 9 | Required turbo lanes are built in `CiLane.ts:590-683,806-944`; Check/Lint/Test/Coverage descriptors are required at `:341-405`. | Add the negative labs filter to required Check, Lint, Test Unit, Test Integration, and Coverage command shapes for PR and push/full replay. Add focused plan-contract tests. | **mechanical** | Report 11 service/plan invariants; research/04 section 5. |
| 10 | There is no labs descriptor in `CI_LANE_DESCRIPTORS` at `CiLane.ts:330-535`; the workflow verify matrix is `.github/workflows/check.yml:56-117`. | Add one visible labs lane that selects the labs glob and is explicitly `required: false`; add its workflow job/matrix entry without changing the frozen required-context set. Decide its exact task bundle and lab-touch path gate. | **needs-design** | Report 11 module/service contract; locked D2 and research/04 section 5. Recommendation: check, lint, and test, path-gated for direct lab changes and reusable for manual/full runs. |
| 11 | Lint Policy is a single unscoped step list at `Quality/Tasks.ts:1655-1700`; ceremony steps are docgen at `:1660`, JSDoc ESLint at `:1666`, and JSDoc module tags at `:1693`. | Keep every law step on labs. Make the three ceremony steps consume a lab-excluding scope or a lab-filtered workspace universe. Do not filter schema-first, Effect laws, identity, circular, test typecheck, oxlint, typos, or deprecated APIs. | **mechanical** | Report 11 per-kind semantics; D2. The underlying inventories are scoped by rows 5-7. |
| 12 | `portlessUrlForApp` always produces one-segment app hosts at `Qa.session.ts:65-81`. | Make the helper accept a decoded app namespace/target or add a labs-specific resolver so labs produce `<name>.labs.beep.localhost`; update focused QA session tests. | **mechanical** | Report 11 authored-reference/owned-tree split. |
| 13 | Fallow entry points use one-level app globs at `.fallowrc.jsonc:11-30`; labs must not enter `ignorePatterns` at `:71-73`. | Add equivalent two-level lab app entry globs for Vite main files and Next app-router entry files. Keep Fallow audit and boundary analysis enabled. | **mechanical** | Census delta from report 10; D2. |
| 14 | Root Vitest projects include only `apps/*/vitest.config.ts` at `vitest.config.ts:10-14`. | Add one labs-depth project glob so the configured root Vitest runner can discover lab configs as well as Turbo/package-local runners. | **mechanical** | Census delta from report 10; D2. |

## Explicit no-edit ratifications

These are part of the gate proof because adding an exemption would violate the
locked law posture.

| Surface | Live evidence | Ratified action |
| --- | --- | --- |
| Root path aliases | `planRootAliasSync` derives aliases from package exports at `TsconfigSync.plan.ts:606-661`; current real-app scaffolds have no exports or aliases. | No labs scoping edit. Lab templates MUST remain non-exporting, so the existing derivation stays quiet. |
| Biome | `biome.jsonc:17-47` includes the repo and excludes scratchpad only. | No labs exclusion. |
| Lefthook biome/typos | scratchpad exclusions at `lefthook.yml:6,17`. | No labs exclusion. |
| Schema-first | apps scan root in `Lint.schemas.ts:53`; blocking apps policy in `standards/schema-crispening.policy.jsonc`. | No labs family waiver or per-symbol ceremony exception. |
| Effect/native laws | law-source predicate at `Quality/Tasks.ts:1603-1605`. | No labs exclusion. |
| Package test typecheck | roots include apps in `PackageTestTypecheck.ts:59`; baseline path at `:54`. | Labs must wire a real test check and stay out of the baseline. |
| Knip | workspace discovery plus explicit app overrides at `knip.jsonc:6-63`; scratchpad ignore at `:73,185-186`. | Keep labs analyzed. Add no ignore unless a concrete false-positive is separately designed and ratified. |
| Fallow ignore | scratchpad is ignored at `.fallowrc.jsonc:73`. | Do not add labs. Row 13 adds entry depth, not an ignore. |
| Storybook | story globs are explicit at `apps/storybook/.storybook/main.ts:50-56`. | Do not auto-register labs or add a labs stories glob. |
| Commitlint, gitleaks, SAST, security, Nix | global/workflow gates; no lab registry. | No labs concept or path exemption. |
| Architecture command grammar | labs are apps, not a slice role or fifth non-slice family. | Do not add a labs role/family to architecture schemas. |
| Required ruleset | the code descriptor set marks the existing required contexts; labs must be non-required. | Do not add the labs context to the required set. |

## Scope grouping for the P2 glob PR

The one-time PR should group the edits by proof boundary:

1. **Membership and reconstruction:** rows 1-3.
2. **Ceremony scoping:** rows 5-8 and 11.
3. **Law visibility and aggregate discovery:** rows 4, 13, and 14.
4. **Required-lane isolation plus visible lab proof:** rows 9-10.
5. **Runtime naming:** row 12.

The PR is complete only when a synthetic labs workspace fixture changes no
per-lab config list, the required context-name set is unchanged, law scans still
see the fixture, ceremony inventories do not admit it, and the non-required lab
lane selects it.
