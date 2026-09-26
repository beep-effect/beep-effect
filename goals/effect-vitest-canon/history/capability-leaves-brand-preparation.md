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
are sequential, and React tests use synchronous queries after render. Final ledger reconciliation remains pending.

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
not establish a controlled speedup. Ledger and baseline closure are pending.
