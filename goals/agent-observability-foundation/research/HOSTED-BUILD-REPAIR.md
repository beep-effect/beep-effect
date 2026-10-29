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
commit and current checkout. Review correctly found that commit fingerprints would
fail after squash. PR2366 now adds nine reviewed-base config allowances, each limited
to the generic-api-key detector AND an exact receipt path AND a fully anchored exact
source-key/digest line. Its ignore file is unchanged from base. The pinned scanner
reports15 before/zero after on both actual history and a fresh synthetic commit;
all60 changed-value/key/field/path controls retain identical findings. Independent
Astra review accepted config SHA256
`22e1b88b8910ce96693c34a9621c8aa46b4fa4dd367187b47cec03e8e8e3dc95`.
Archive: `scanner-squash-final-6buxkzmd`. This remains a separate merge dependency,
not a passing scan claim for the foundation branch.

The first final-check and Claude final-panel attempts were stopped under host memory
pressure. Neither is a passing final delivery proof; the panel produced no report.
Final current-head repository gates, remaining panel seats, hosted checks, merge and
reflection remain open. The historical forwarder recovery hold is unchanged.
