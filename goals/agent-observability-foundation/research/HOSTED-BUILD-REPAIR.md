# Hosted build repair and refreshed route evidence

The first hosted PR2364 wave exposed ten Effect production-build diagnostics:
three OTLP attribute constructors lacked pipeable overloads, three direct codec
exports exposed an optional-options signature without the required calling form,
and four type queries could use existing model aliases. The new `dual(2)` forms
preserve the existing data-first attribute bodies. Internal generator wrappers
preserve the hoisted codec schemas, optional parse options, strict page default and
caller error boundaries. No payload, event ID, metadata allowlist or wire schema
changed. Independent source review found no actionable regression.

The production build and 37 export/intake/reclamation tests passed, followed by the
full package audit (134.3 seconds) and docgen (11.2 seconds). The package guard exited
zero with no protective stop, task-limit event or orphan. Repo Sanity separately
found that adding protobufjs to the catalog made its pre-existing literal override
inconsistent. Changing that override to `catalog:` leaves protobufjs 7.6.6 and its
lockfile integrity untouched; syncpack lint now passes. The entire lockfile delta
is that override reference. Evidence: `../ops/hosted-build-repair-verification.json`.

The prior v2 root and route evidence remain unchanged and qualify their original
source bytes. The preparation tool created an explicitly new v3 synthetic root for
this repair; its 82 source hashes and positive Git identities were independently
verified. Both disposable and live installed-service stages passed with that same
v3 declaration, independently precomputed event IDs, matching local/backend/visibility
sets, unchanged source hashes during execution and owned rollback. The private
archive contains snapshots and digests; current qualification must never be inferred
by relabeling the earlier v2 receipts.

Separately, PR2364's base-pinned secret scan flagged 15 historical source-file SHA-256
values in proof receipts. All values were independently recomputed at their source
commit and current checkout. PR2366 adds only their exact commit/path/rule/line
fingerprints to the reviewed base ignore file; the pinned scanner reports 15 before
and zero with those entries. No broad rule/directory allowance was added. It remains
a separate merge dependency, not a passing scan claim for the foundation branch.

The first final-check and Claude final-panel attempts were stopped under host memory
pressure. Neither is a passing final delivery proof; the panel produced no report.
Final current-head repository gates, remaining panel seats, hosted checks, merge and
reflection remain open. The historical forwarder recovery hold is unchanged.
