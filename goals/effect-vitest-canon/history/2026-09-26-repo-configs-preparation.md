# Repository configuration test wave preparation

This isolated lane starts at main 9cb79ddda2b72c426b322045fee9f5131b92a13c.
The existing inventory contains 119 rows over eleven admitted test files; all
eleven remain present. Six files changed since frozen census commit
662823dd960367046ba7d73dd8fd25d15782865a. Exact frozen/current snapshots and hashes
were captured privately before editing. This preparation does not create a
global remainder inventory.

Configured Node and Bun baselines each passed all 77 tests with no failures or
skips. Whole-command times were 4.721 and 2.518 seconds, with stable source,
manifest and lockfile hashes and recorded workstation load/pressure/runtime
context. Unchanged full package verification passed: audit 9.6 seconds and
docgen 4.1 seconds. These observations do not establish performance causality.

The admitted tests run three real local compiler commands across two cases.
Their scoped native temporary project and node_modules symlink must remain
visible to those subprocesses. Governance cases read actual checkout source,
allowlist/generated-snapshot data and the canonical skill file. Those inputs
must not be replaced by expected text in a memory filesystem. No remote cache,
provider, Next build or secret operation is part of these tests.

The bounded review covers all eleven paths and all 119 rows. D12 begins with
scope and runtime ownership, then assertion helpers, sixteen existing property
domains, flake review and diagnostics. Preserve the 25/40 run floors, native
compiler outputs/deadlines, reference-identity checks, all invalid inputs, and
policy-fixture strings. Public synchronous decoder/config APIs remain subjects.
No production defect or independently reproduced flake was established.
