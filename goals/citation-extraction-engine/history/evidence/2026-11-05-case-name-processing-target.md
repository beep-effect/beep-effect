# Native candidate-name processing

The private CaseNameProcess adapter executes the built-in source processing
profile after backward scan. It uses the original case-sensitive single v split,
ASCII string.whitespace/comma/open-parenthesis plaintiff trim, original lowercase
word removal, shared stop-word cleanup and conditional defendant/antecedent
assignment. Short mode deliberately repeats defendant cleanup when the first
cleanup was nonempty, preserving source order and worker-call accounting.

Patch fields use Option: None leaves an attribute untouched, while Some(empty)
assigns the source empty string. This preserves attributes dynamically added by
the original helper, including plaintiff on a short citation. A successful name
sets the unverified full start using Python word slicing and native point lengths,
including negative starts, start None, literal surrogate pairs and explicit span
start zero. Length summation avoids materializing a joined string used only for
its length; all actually allocated native input/output buffers remain charged.

Pre-citation year conversion retains direct int behavior rather than date bounds.
PythonInteger uses the existing frozen Unicode decimal values, Python int parser
whitespace and the frozen 4300-digit ceiling. It retains sign, zero, underscores
and arbitrary-size exact BigInt values. Schema BigIntFromString decodes captured
source integers; Effect BigInt.toNumber is used only after bounded date filtering
in the existing get_year adapter. Its former saturating parser is removed, so the
two adapters share one source integer grammar without applying date bounds to
direct case years. Source errors are closed invalid-year/missing-candidate failures
without partial metadata. Original partial mutations remain in the source corpus.

## Shared ownership and worker composition

Literal replacement now uses one shared nonempty-match range operation in
MetadataComposition. StopWords and candidate lowercase removal reuse it, together
with the existing complete regex result owner, native concatenation, frame
preflight, process admission, typed RPC, retirement and quarantine. Nullable
replacement and replacement-template protocols are not qualified here.

The cleaner exposes an internal composition operation that does not reacquire
the enclosing metadata operation's permit. Each candidate call has one operation
admission, fresh native Scope and fresh or captured cumulative text budget across
all receiving words, splits, trims, substitutions and cleanup calls. The returned
apply method requires no caller services. Both processing patterns and cleaner
configuration are snapshotted/authenticated before retention. No default/absolute
policy is changed; fixtures explicitly use the existing 8192-unit pattern policy.

Hosted Check run 42139673004 / Fallow job 127636561042 reports zero complexity
findings after the prior group-header repair, but flags duplicated configuration
setup in scanner and cleaner. The shared runtime/configuration decoder now owns
that setup and is reused by scanner, cleaner and candidate processor. No policy,
baseline or suppression is weakened. Hosted confirmation of this repair remains
pending. Artifact 13468321125 retains the original failing report.

## Original evidence and target checks

The new producer requires clean source commit
04d82c032ad5fd0f9ab72a61c87110c46ee8f52e, tree
a35a58fac03400f71a93a93485b77f1d56f2b02f, CPython 3.11.15, regex
2023.12.25 V0 and int digit limit 4300. Both original parser trees have zero
capture groups: splitV minimum width 3 and lowercase removal minimum width 1.
Neither profile has repeated captures or nullable repeated bodies. Hash seeds
347/349 produce identical bytes. Repository formatting leaves the fixture seal
unchanged.

| Artifact | SHA-256 |
| --- | --- |
| Producer | 784ea110559da55a914004cb1841c9a95d8c2720501a41ef4f4a67c8f4029a9d |
| case-name-process-patterns.json | 3786b74826d9b3f3b88bf03d673da59f43abe4a54ee81f3615fe8871926d7a87 |
| Required processing corpus | 027c7f42d55d4fe9ee6f000c98c6427d4931f45bf82675277f60864762b51505 |

All 61 independently observed int cases pass, including 19 ValueErrors, 4300/4301
digit boundaries, leading zeros, underscores, non-ASCII decimal digits and all
Python whitespace scalars. Values beyond safe JavaScript integer precision remain
exact. The original processing corpus supplies all 328 before/after snapshots;
patch application compares complete metadata attribute dictionaries, numeric year
and full start, preserving absence as well as values.

Local smoke covers 114 processing cases per actual Bun/Node runtime: all 100
missing-candidate TypeErrors plus 14 selected assignment/year controls. All 115
launched child exits per runtime are independently acknowledged; rejected null
candidates launch no child. Full hosted replay is registered for all 328 cases,
requiring 1532 acknowledged exits per runtime. The 100 original failed regex call
attempts on None are closed before child creation; all other original call counts
remain exact. Full replay is not locally run.

The Foo control reserves exactly 54 UTF-16 units. Ceiling 54 succeeds; ceiling 53
refuses after three acknowledged children. An enclosing ceiling 54 primed with one
unit refuses at counter 52. Pattern-buffer mutation after installation leaves the
returned result unchanged. Closed lifetime and a captured 997-ms deadline refuse
before child creation, including when the caller's sleep Clock is disabled.

Eighteen focused tests across candidate processing, StopWords, MetadataYear and
CaseNameScan pass after the shared runtime-boundary extraction. Scoped lint/type
and Oxlint checks also pass. Both budget refusals confirm all three child exits.
Normal commit hooks and the representation-law audit apply. Raw
pattern scaling, custom object/dict protocols, externally mutated source state,
HTML name discovery, full citation composition, exhaustive public engine parity
and all unfinished accounting/proof duties remain open.
