# @beep/practice-kg-mcp P1 digest

Root-reviewed P1 source inventory; all rows remain open and P2 remains gated.

Two complete test files, 123 lines, eight open judgment rows. There are two minor review items and six info coverage-only rows. Resource has one review/one coverage; property has one review/one coverage; flake and observability each have two coverage rows. Each assigned file has all four lenses.

Top files (the entire assignment):

- apps/practice-kg-mcp/test/Host.test.ts: four rows, two review items.
- apps/practice-kg-mcp/test/TaggedError.equivalence.test.ts: four rows, zero review items.

Review items:

- `apps/practice-kg-mcp/test/Host.test.ts:39` — L-RES-04: The asserted subject is manifest loading before databases open: Host.ts reads FileSystem/Path and decodes the manifest, while makePracticeKgHostLayer separately composes MCP, PgLite and DuckDB. Consider MemoryFileSystem for these loader cases only after preserving path joining, missing-file mapping, independent temporary roots and malformed input. Keep any native adapter conformance proof separate; do not claim or replace MCP/SQL startup coverage from these tests. Whole-body provider migration remains the existing EV002 candidate, not a second syntactic finding.
- `apps/practice-kg-mcp/test/Host.test.ts:73` — L-PROP-01: The only invalid manifest is not-json, which exercises parsing but not the production manifest's structural rejection. Add a parseable invalid JSON case such as {} through the same loader and require the existing typed invalid-manifest outcome; preserve missing-file and malformed-JSON cases and all current assertions. If generalized, generate from the actual manifest schema with an explicit fcRuns floor rather than a weaker test schema. This is a missing boundary proof, not a demonstrated decoder bug.

Host.test.ts provides BunFileSystem and BunPath for each test; each body owns a fresh scoped temporary directory. The missing-then-invalid sequence intentionally changes one manifest in the same body. The production loader only joins the path, reads text, validates JSON/schema and constructs context. Its separate makePracticeKgHostLayer function composes MCP, PgLite and DuckDB, but these tests never call it. Thus the loader's interface-only cases may be MemoryFileSystem candidates; this does not authorize replacing native database/server conformance. Do not infer database acquisition or Anthropic execution from imports or configured dependencies. No provider, container, database or server was started during this audit.

The equivalence file uses pure schema-derived Boolean comparisons on three tagged error classes. Distinct opaque causes are intentionally equivalent when messages match; changed messages are intentionally unequal. D5 permits these plain Boolean assertions. Preserve both polarities and avoid replacing the law with identity or structural equality of causes.

Retained first-attempt baseline: six passed registrations across both test files, zero failed, command 8.578631874 seconds, exit 0. Host file span is 7.949219 ms; equivalence file span is 1.4375 ms. These values are not per-layer acquisition measurements, and no rebuild speedup is inferred. Raw reporter SHA256: 98ff83d5059c9c2f6f13bc5c9e85a12fdb00ccbbcdf016fd1a56abe65a47c83a. Context records Node 22.22.3, Bun 1.4.2 and Vitest 4.1.11. Native Bun adapter source running in this configured Node cohort is not an independent Bun-native, compiled-host or MCP-transport proof. No timing was rerun or host-load normalization applied.

Hosted history has three coverage-ratchet observations across three August 13 jobs, each functions 4.16 < 4.22 for this package. They are neither three test failures nor unique flakes. The retained historical runtime is Node 24.19.0 with Vitest 4.1.10 observations; no causal current-source comparison is claimed. Exact job/head/log references are in the [hosted history summary](../hosted-history-summary.json). No mapped assertion failure does not establish no historical or rare failures.

Campaign scope remains 139 completed first attempts: 132 full-file-representation baselines, four configured subsets and three failed cohorts (CIops, Effect Drizzle, QA Capture). Hosted scope is 527 failed runs, with 21 unavailable logs and one unresolved cause. Passing registrations prove neither package/coverage completeness nor absence of races, and do not execute configured providers merely by existing. The 90 inherited ratchet additions are untouched.

Proposed P2 order is scope, assertions, property, flake, observability. Resolve actual loader lifetime/interface boundaries before assertion migration. Preserve typed errors, message substrings, both Result failure assertions and all matcher polarities; an Exit migration must not invent expected Causes. Add parseable structural-invalid input while retaining missing and malformed cases, and use real schema/fcRuns options if generalized. No retry, timeout, property floor or source edit is proposed merely to silence candidates. Full P1 completeness, Grok review and Benjamin’s acknowledgement remain required before P2; package proof is a separate gate.

Root accepted this inventory after source/artifact verification and combined strict validation. Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).
