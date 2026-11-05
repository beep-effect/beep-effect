# Regex operation modes and source engine boundaries

Review the exact clean oracle commit/tree before extending the evaluator. The
110 indexed family rows comprise 50 module calls, 28 declarations, 10 builders,
nine method calls, seven extractor constructors and six escapes. Those forms
are obligations, not interchangeable matching engines or automatic approvals.

The pinned helpers.py imports `regex as re`, while clean.py, find.py, models.py,
resolve.py, tokenizers.py and utils.py import standard-library re. The recorded
operation corpus pins third-party regex 2023.12.25. Its behavior must not be
inferred from CPython's standard re or the Python Unicode 14 character tables.
Hyperscan load/save/scratch/database calls in the index are also distinct from
native matching and from the compiled-pattern refinement pass.

Source engine references (whole-file SHA-256 at the oracle pin):

- models.py: 2297f2f3a036a5674346e952fd6b03c8d4906c1130ef43157b7e2d79d5bdf38a.
  TokenExtractor.get_matches at line 832 uses finditer; compiled_regex at
  lines 844-848 uses standard re.compile.
- SHA-256 `de2d345fe0211aa4f48d633035567ec941f113e48c41990b0b036db63d984a01` (`tokenizers.py`).
  HyperscanTokenizer.extract_tokens at line 522 refines a sliced candidate
  using compiled_regex.match, which requires a prefix match.
- helpers.py: 3d3431db232be2f3d7320125528975d57797372a9c4c21d524927fc1ccf0a297.
  match_on_tokens at line 1037 calls third-party regex.search. Several helpers
  also require split/substitution and VERBOSE behavior, still unsupported by
  the current private source-profile evaluator.
- find.py: 64415ffe6a5fc39713a1ad1d6585ae673fb175b32c53820185237a174416dd3d.
- utils.py: 8e27eb1207f6c0fdb695530e3677a3e9f039986b2baf68461ba680ee2bff902e.

Add a closed LiteralKit mode (`finditer`, `search`, `match`) to the private
worker job. The native regex protocol is now v2, with a required mode in every
job and v2 readiness/control messages. Parent preparation may explicitly default
to iteration, but every encoded job contains that choice. V1, missing and
unknown wire modes fail closed. Result envelopes retain result/v1.

Exact request preflight includes each mode's actual header length before
payload/base64 allocation or reservation. Prefix mode uses the native RegExp
sticky flag at position zero, with the existing source-point alphabet and
indices. Search and prefix modes return at most one native match; iteration
retains the complete non-overlapping collector. Quota zero still requires a
complete no-match result. Effect RegExp, RPC, Stream/Sink, Scope, Clock and
process ownership remain the execution machinery. No alternative regex engine
or custom scanner is introduced for these operations.

The independent CPython 3.11.15 / Unicode 14 producer records five synthetic
native-word inputs across all three operations. Source scalar and literal
surrogate words remain distinct. The fixture binds producer SHA-256
5d22a03ce21756269d96660e4e219e84d02b89b9cb5d42e858d913ab4d13898f
and formatted artifact SHA-256
6176aed02afda7ca709db880b438b2a8174e689ef97048a3ee018ccc487ba506.
Repeat production followed by the repository formatter is byte-identical.

Verification: 28 focused HTML/regex/protocol tests pass, including fifteen real
children compared to the independent mode/capture matrices, all independently
confirmed exited. The functional result tests use a controllable Clock; the functional regex
window is distinct from the real cleanup window. This does not claim cold-start performance within the one-second ceiling. Repeats with
real cold-start timing hit regexDeadline under load and are retained as failed
receipts. Separate entered-native-child tests continue to qualify deadline,
cancellation and cleanup behavior without changing any production limit.
Removing the sticky prefix flag makes the independent test fail with
patternMatches when a later search hit is incorrectly treated as a prefix hit;
restoring it passes. All mode frame ceilings, malformed/missing modes and stale
protocol versions have negative controls. Server test compilation, package
laws, scoped lint, targeted test-policy review and zero-finding new-only Fallow
pass. The existing production-evaluator witness smoke still passes 3/6/3.

This does not approve any family, third-party regex behavior, empty-width
iteration, repeated-capture profiles, VERBOSE/DOTALL semantics, split/substitute,
adversarial scaling, routing or the public engine Layer. Those remain explicit
full-goal obligations. No family ledger or completion row advances here.

Hosted Integration job 125795643246 in Check run 41599524173 passed on prior
head 369c98b458. It includes the complete 13,610 positive source witnesses,
27,216 exact capture matches and 13,610 empty-input controls. The mode changes
require their own exact-head hosted run; this receipt does not approve families.
