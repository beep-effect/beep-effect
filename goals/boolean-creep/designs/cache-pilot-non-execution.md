# cache-pilot-non-execution

P2 at f97a89bdfdc5bc71b69aab09b8d425591698d42a. September25 owner ruling in
DECISIONS.md resolves the former public-grammar hold. Prior private null row and
hold audit remain historical. This is not implementation or independent P3.

## Current shape

Cache.pilot.schemas.ts254-268 exports a class with eight required fields: id
NonEmptyString, four-reason LiteralKit, exitCode Int, stdoutSha256 and stderrSha256
Sha256Hex, and summaryPresent/selectedExecutionObserved/passed Booleans. No
constructor defaults or cross-field checks exist. CachePilotReceipt319 nests
an array of these in the persisted receipt. Cache/index.ts111 exports the model.

The full owner includes reason and exit-zero/nonzero, not just three Booleans.
observeSelectedExecution1250-1265 returns false unless exactly one summary exists;
otherwise it requires the selected task, nonempty/non-NONEXISTENT command and
execution payload. passed1292-1296 applies reason-specific conditions and an
unstored diagnostic predicate for refusal controls. Original schema allowed
contradictory records; the ruling explicitly authorizes rejecting them now.

## Cardinality gap

reason4 * zero/nonzero exit2 * three booleans8 =64 representable /27 legal.
selectedExecutionObserved implies summaryPresent. Encode observation as three
payload-free cases: no-summary, summary-no-execution, selected-execution.
Each exit category combines with every observation: six visible observations.

For absent-script, passed is derived exactly from exit=0 AND
observation=summary-no-execution. All six observation/exit states have one legal
passed value, hence six supported strata.

For each configuration refusal reason, six observation/exit states permit
passed=false; only no-summary/nonzero also permits passed=true. This is seven
strata per reason, giving6+3*7=27. Failed refusal with those visible prerequisites
is required: the stderr hash does not reveal whether the diagnostic matched.
Do not make refusal prerequisites sufficient for passed. Do not restrict id to
reason, exit values to0/1, or hashes to relationships beyond existing Sha256Hex.

## Target schema

Keep ownership in Cache.pilot.schemas.ts. Define named annotated schema blocks:

- CachePilotNonExecutionReason: LiteralKit of the existing four reasons in their
  current order. Export this kit because callers previously obtain the reason
  domain from the public class fields and the control runner needs .Options.
- Observation: private LiteralKit of no-summary, summary-no-execution,
  selected-execution. It replaces summary/execution's invalid product.
- NonZeroExitCode: S.Union of S.Int.check(S.isLessThan(0)) and
  S.Int.check(S.isGreaterThan(0)), retaining
  all negative and positive integer values accepted previously.
- AbsentScriptEvidence class: kind tag absent-script, exitCode:Int,
  observation:Observation. No passed flag; outcome follows the exact rule.
- RefusalPassed class: status tag passed, exitCode:NonZeroExitCode; observation
  is implicitly no-summary. No diagnostic witness is stored or inferred.
- RefusalFailed class: status tag failed, exitCode:Int, observation:Observation.
- ConfigurationRefusalEvidence class: kind tag configuration-refusal,
  reason: the three-reason kit subset, outcome: RefusalPassed|RefusalFailed.
- CachePilotNonExecutionValue canonical class: id:NonEmptyString, both existing hashes,
  evidence: AbsentScriptEvidence|ConfigurationRefusalEvidence.

Use LiteralKit-defined case domains and annotated class schemas, then derived
S.toTaggedUnion helpers for payload-bearing evidence/outcome; no manual literal
union or independent flags/getters in the canonical model. The reason-specific
representation has exactly27 finite strata and preserves every payload. Use
namespace-first concept imports and module-local $RepoCliId identity. The raw
boundary schema stays private. Export CachePilotNonExecution as the compatibility schema value with same-name
schema-derived Type and Encoded namespace alias. Export CachePilotNonExecutionValue
as the explicit canonical .make constructor, plus the evidence/outcome classes
needed for callers to build valid values. Migrate .make call sites to that class;
do not claim the codec itself retains old class statics or patch them with casts.
Keep the public codec original annotation identity; new canonical/raw models get
distinct module-local identities. Verify real constructor/codec composition.
No default is added to any formerly required input.

## Encoded-side impact

Preserve all eight encoded fields, flat shape, reason strings and receipt
schemaVersion. Use an exact legal raw-schema union before transforming so
contradictory input cannot be normalized into a passing record or silently lose
information. Define named shared id/hash fields and wire observation shapes:
no-summary=(false,false), summary-no-execution=(true,false),
selected-execution=(true,true). Wire literal Booleans are required constants.

For absent-script, create the six (exit-zero/nonzero,observation) raw alternatives
with required passed literal true only in zero+summary-no-execution. For each
configuration reason subset, create six passed=false alternatives plus one
passed=true with nonzero/no-summary. Group the three reasons with the reason
subset schema; this yields thirteen schema alternatives representing27 strata,
not twenty-seven hand-copied models. Zero uses S.Literal(0); nonzero uses the
named full-integer refinement. The union retains exact id/hash fields throughout.

Connect validated raw schema to the type-side canonical class using
S.decodeTo(S.toType(Canonical), { decode: SchemaGetter.transform(...),
encode: SchemaGetter.transform(...) }). The actual local API takes Getter
values: decode consumes source Type and returns target Encoded; encode consumes
target Encoded and returns source Type. S.toType makes canonical constructed
values appropriate target values. These transforms are total after source/target
schema validation; no untyped throw, silent coercion or invented diagnostic data.
Use schema-derived case matchers for reconstruction.

Encoding absent-script reconstructs reason, exit, observation flags and the
exact pass equivalence. Encoding refusal-passed reconstructs nonzero exit,
no-summary/no-execution and true. Encoding refusal-failed reconstructs its full
integer/observation values and false, even if visible prerequisites happen to
match successful refusal. Preserve arbitrary id and exact hashes independently.

Keep CachePilotReceipt.nonExecutions pointed at the PUBLIC compatibility codec,
not the private canonical schema. JsonStringCodec(CachePilotReceipt) must still
produce existing nested wire fields. New decoded API shape is intentional and
requires migration of constructors/readers; encoded shape is preserved only for
the27 supported strata. Explicitly document37 newly rejected strata under the
owner ruling; do not rewrite historical receipts or claim old schema rejected
those values. No automatic migration may manufacture a missing diagnostic proof.

## Migration inventory

1. Cache.pilot.schemas.ts254-268 and example247-248: replace flat decoded class
   with canonical model/compatibility codec and named reason kit. Update docs
   showing old .fields.selectedExecutionObserved. Receipt293-325, especially319,
   retains codec composition and all unrelated fields and defaults.
2. Cache.pilot.ts224-227,1226,1268: update reason parameter types to the named
   reason kit Type; retain actual diagnostic matching for all three refusal
   reasons. It is producer evidence, not removable redundant validation.
3. observeSelectedExecution1250-1265 and summary counting1289: replace returned
   Boolean pair construction with observation classification. With names.length
   !=1 produce no-summary without reading a summary; otherwise decode exactly
   the same summary and task predicate to choose selected-execution or
   summary-no-execution. Preserve read/decode errors, lexical task match, trimmed
   command condition and all native capture behavior; no extra filesystem reads.
4. runNonExecutionControl1292-1318: construct absent-script evidence directly.
   For configuration, choose passed ONLY with nonzero exit, no-summary and the
   current expectedDiagnostic; otherwise construct failed with unchanged
   observation and exit. Build one canonical observation record with existing
   hashes/id. Derive its Boolean verdict through the evidence schema match for
   the SEPARATE CacheSyntheticCheck and stop/warning policy. Do not keep duplicate
   stored passed in this model or repeat the old three-bit formula downstream.
5. Push the record before its synthetic check and before mismatch diagnostics
   as today1308-1317. Preserve first-failure break, return values, capture-bound
   error1285-1286, private stdout/stderr persistence, and all reason iteration
   order. Loop1319 uses named reason kit.Options in the original order.
6. Receipt assembly1347-1381 retains the complete array. Cache.command.ts802
   retains writeEncoded with JsonStringCodec(CachePilotReceipt). Cache/index.ts111
   and113 retain existing model/receipt exports and add named reason/schema
   construction exports through the same public package subpath; private raw
   schemas stay private. No other direct model writer or field consumer was
   found in the inherited exhaustive owner audit and current graft query.
7. cache-pilot-orchestration.test.ts367-376 mock native control behavior,557 array
   assertion,543-544 and561-565 receipt roundtrips: preserve and extend using the
   public compatibility codec and complete supported payloads, not just private
   leaf-schema tests. Recheck direct callers after main moves.

## Guard-deletion accounting

Remove three stored decoded Boolean slots and flat producer constructor inputs.
Represent selected⇒summary using the Observation literal rather than a pair.
Represent passed absence control as a derived verdict and configuration success
as a payload-bearing result branch. Replace the old record-construction Boolean
formula1292-1296 with reason-specific case construction and one derived verdict
for synthetic check/control flow. Retain diagnostic predicate, native summary
selection, capture errors and mismatch stopping: they establish evidence or
control effects and are not redundant invariant guards. Boundary union enforces
legacy grammar once; no repeated post-decode Boolean reconciliation remains.
No existing cross-field decoder guard is claimed deleted because none exists.

## Test impact

Private finite check covers all64 strata,27 accepted/37 rejected, and projection
roundtrips for every accepted case. It covers arbitrary independent id/hash
payload and negative nonzero representative without normalizing it. This is
mathematical design validation, not Effect runtime or schema-codec proof.

After GATE2, decode all64 through CachePilotNonExecution, then through nested
CachePilotReceipt and JsonStringCodec. Assert27 accepted and37 rejected. Compare
complete old/new supported encoded records with exit0,negative and positive
integers, IDs unequal to reasons, distinct valid hashes, and missing required
keys rejected. Include failed config no-summary/nonzero with unmatched diagnostic
and successful counterpart; absent-script successful and all five failure
strata; selected-execution present implies summary. Verify no diagnostic witness
or new tag appears on wire and every unrelated receipt field remains intact.

Use mocked orchestration to test failure record retention, synthetic verdict,
diagnostics and loop break, successful four-reason order, capture truncation,
zero/multiple summary files and selected-task conditions. Do not run the real
native pilot merely to validate this schema refactor. Run CLI package check,
focused tests, package-verify @beep/repo-cli, applicable schema-first lint and
docgen:local; schema-catalog --write if identities move. Tier2 separate PR with
encoded compatibility proof, then campaign/Yeet gates. Benjamin merges.

## Risk

Principal risks: treating config prerequisites as sufficient; collapsing failure
when diagnostic evidence is absent; narrowing exits or IDs accidentally; exporting
canonical nested encoding instead of flat compatibility codec; retaining the
obsolete .fields.reason.Options dependency. The ruled domain and whole-receipt
roundtrip tests directly cover these. No broad census/P3 credit follows.
