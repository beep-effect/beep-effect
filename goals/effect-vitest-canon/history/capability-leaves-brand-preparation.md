# Brand preparation and scope phase

All three existing Brand files were read in full. Brand belongs to ui-system;
the capability backlog branch groups independent packages outside modeling and
tooling/tool. The existing property was already migrated on main and retains
BrandIdentity, schema equivalence and its five-case floor. The other two files
are unchanged from the frozen inventory.

Fresh configured Node and Bun baselines passed with stable source hashes;
whole-command times were 5.572100 and 5.504547 seconds. Source manifests include
TypeScript and TSX files. Runtime, resource limits, load and pressure are saved.
These are measured runs on a shared workstation, not controlled comparisons.

The asset tests retain real tracked golden files. Both per-test BunServices
builds are replaced by one it.layer suite with an explicit five-second budget.
The provided layer is unchanged; both Effect bodies are unchanged after
whitespace normalization. No memory filesystem is substituted for the oracle.
Full package verification passed: audit 9.8 seconds and docgen 4.6 seconds.

Assertions now use public Result helpers for four invalid text inputs and two
valid strings. PrintableText is a nonempty-string check with no transform, so
the valid decoded payloads are the original inputs. Inputs and rejection
polarity are preserved. Full assertion-phase package verification passed: audit 11.4 seconds,
docgen 2.9 seconds.

## Property oracle and flake review

The golden test independently asserts the five expected paths, including
multiplicity and the documented stable order, before the existing exact-content
loop. The loop, bridge custom-property checks and favicon assertions remain.
The production renderBrandAssets contract grounds the literal path list; its
output is not used to construct the expected list. Full package verification
passed after this change; no production code or assets were regenerated.

The existing BrandIdentity property and five-case floor remain unchanged.
PR #1200 performed that migration; its historical diff is saved for correct
ledger attribution. Flake review adds no timing or retry changes: golden reads
are sequential, and React tests use synchronous queries after render. Ledger reconciliation is recorded below.

## Instrumented runner

All three files now import it from @beep/test-runner. The React test retains
its jsdom directive. The workspace development dependency, two generated
TypeScript reference files and Fallow boundaries include the runner.
The scoped cache receipt adds eight Brand dependency lists, retaining the
nine Chalk lists. Computation identities and cache policy are unchanged.
Cache audit reports zero blocking findings and 1251 unassessed computations;
this does not qualify those computations for caching.

Import ordering initially failed package verification and was repaired with
Biome. Full package verification then passed: audit 7.4 seconds, docgen 3.1
seconds. Configured Node and Bun runs both passed all 17 tests with stable
source hashes, taking 5.070854 and 1.684376 seconds respectively. Resource
pressure and load were captured; these shared-workstation measurements do
not establish a controlled speedup. Ledger and baseline reconciliation are recorded below.

## Inventory reconciliation

Source commit 50a96f57fcaf6573a956b35112146038fbaef936 contains the local
scope, assertion, asset-oracle and runner changes. Both final timing source
manifests still match the committed source. The pre-existing BrandIdentity
property migration is credited to b1aa7e320cde926e7e80a98073ba8b0d517d7c8c.

The ledger retains the union of historical and current candidates: 14 detector
rows and 12 human lens rows. The two EV010 identities represent the same native
asset provenance judgment at different recorded lines; both retain an explicit
exception reason. No unresolved actionable row remains in this scoped ledger.
Eight resolved baseline rows were removed, one native-filesystem exception was
retained, and all 8024 unrelated baseline records were preserved byte-for-byte.
The root ratchet reports zero introduced and zero resolved entries.

Canonical discovery still identifies the three existing Brand files. The scoped
strict validator reports valid, complete and zero missing lens coverage. This
is local package evidence; the wave has not yet passed hosted PR gates, and
the global goal inventory and exception closeout remain outstanding.
