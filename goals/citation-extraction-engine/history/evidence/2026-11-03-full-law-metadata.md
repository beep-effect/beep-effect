# Full-law metadata and superclass edition selection

The original FullLawCitation.add_metadata at eyecite 2.7.6 commit
04d82c032ad5fd0f9ab72a61c87110c46ee8f52e calls add_law_metadata, then
ResourceCitation.add_metadata, which calls guess_edition. The helper's resulting
year drives selection even when a raw year was invalid; prior years remain when
the helper does not assign one. Source helper field updates and edition guesses
are returned together only after both stages succeed.

The private makeCitationFullLawMetadata reuses the existing law configuration,
worker, context, string/year stages, invocation budget and authenticated edition
owner. One operation admission and captured deadline enclose both stages. The
shared installation helper avoids nested admission. Each native stage retains
its fresh Scope and independently acknowledged retirement; the captured Context
does not retain the installation Scope. Shared candidate preflight occurs before
law words are decoded or any child starts. No new transport, scheduler, clock
implementation, public request mode or client API is introduced.

## Source corpus

probe-full-law-metadata.py authenticates a clean pinned oracle tree and Python
3.11.15, then executes the original full method across all 128 authenticated law
helper vectors and six candidate configurations, yielding 768 observations and
752 original includes_year calls. Controlled candidate lists use five actual
canonical editions with distinct date bounds across the built-in catalog;
FullLawCitation does not restrict the source family of its edition sequences.
These are controlled model-state vectors, not a claim that the default tokenizer
assigns cross-family editions to law citations. All payload lookups in the port
use the existing authenticated frozen owner.

The existing law corpus is authenticated at SHA-256
098ed3007ff63ca34b63310f822b037fea3ee5fb3c1874351bbeb67c373b6dea;
the producer asserts every resulting helper patch equals that corpus. Inputs and
patches are referenced by row id rather than copied into a second oracle.
None/retained guesses, exact priority, singleton bypass, ambiguous occurrences,
duplicates, variation sequences and no fallback after filtering participate.
The source highest helper year is frozen at 2027 while live includes_year sees
2026. These distinct source policies remain distinct.

Producer SHA-256:
4f30a3e06b0c513671628b115a0b0342ee89dc39840bccae351e79975a743d27.
Formatted full-law-metadata.json SHA-256:
e899dae1c175c26a70fc15baa916596b7f63ed5967ef79a028a62083f64d9784.
Regeneration under PYTHONHASHSEED=91 compares byte-identical after formatting.

## Proof boundary

Focused tests compare complete patches, guesses and ordered payload reads across
both actual runtimes. Their eleven-case smoke requires fourteen independently
confirmed child exits per runtime. Candidate-limit refusal starts no child; an
injected edition-owner failure after one acknowledged helper child returns only
the closed error, releases operation/native admission and publishes no patch.
The existing law helper and edition-inference regressions run alongside these
new composition tests. Full hosted replay requires 936 confirmed child exits per
runtime across all 768 observations; it remains pending until a hosted receipt
is available. These vectors do not finish custom protocols, other citation
families, corrected citation rendering, document mapping, public engine/Layer,
safety-family qualification or exhaustive goal acceptance.

Ten focused tests in three files pass after extracting shared retirement and
admission assertions; scoped package lint/type verification and Oxlint pass.
Both policy checks pass with no introduced finding, and final new-only Fallow
reports zero introduced findings in every category. No policy exception, floor
reduction or semantic waiver was added. The broad local publish pass and
head-install preflight are deferred under the operator's hosted-CI instruction;
normal commit/push hooks still run. Full hosted proof remains pending.
