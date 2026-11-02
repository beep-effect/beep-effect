# Independent synthetic review and replay

Reviewer role: separate Codex gpt-6.1-sol medium session, read-only source review
and separately executed synthetic replay. This is G2 mechanical review, not
human production approval. Original protocol and fixture hashes remain frozen.

Round 1 found two P2 implementation defects: the runner hashed but did not enforce
the registered split/candidate design, and typed evaluation failures could discard
attempt history. Both were fixed and independently re-reviewed. No new blocking
implementation issue was found within the review scope.

Round 2 executed the exact-input CLI independently with Bun 1.4.4. Its 742,821-byte
output matched results/calibration-v1.json byte for byte. Source and artifact hashes
are retained in execution-v1.json. The independent process took 0.255184089 seconds.
An injected typed evaluation failure exited 1 after 0.242850896 seconds and wrote
results/typed-failure-control.json first: 44 failed evaluations and 20 schema-invalid
attempts, mechanicalPassed false. It modified no repository source.

Independent calculations verified every row of all 44 evaluations: inclusive
tiers, rational decay (maximum absolute error zero), payload/budget ratios and all
11 canonical policy digests. Every stratum has 26 distinct rows and 27,212 selected
canonical fact-payload UTF-8 bytes. Four strata total 104 independent identities;
repeated candidate queries do not increase the independent sample count.

Nearest-integer rounding clarifies the originally frozen candidate construction:
nominal budget changes of +/-10% from 256 are 230 and 282. No candidate, protocol,
fixture, metric or objective was changed after viewing held-out results. The
held-out fixture repeats the tuning age distribution deliberately; it tests
mechanics and cannot establish product generalization.

Remaining G2 work at this review: full offline approval/preflight negative controls,
final evidence reconciliation and package verification. Temporal correction,
disposition/tie, empty and bounded slices are separate existing regression controls;
the migrated database full-directory rebuild proof passed in this execution.
These controls are never added to the 104 independent calibration sample count.
G3 is not-requested. G4 and activation remain excluded.

## Final G2 disposition

Independent final review accepted G2 with an insufficient-evidence verdict. No
remaining G2 blocker was identified. The complete schema-valid untrusted receipt
submission test closes the final requested gap. Production values remain unresolved.
Final runner SHA-256: `90c21fa85661f0ad40e1f7d11d4e892a31be362adc2a6ced79454f5b1b991191`.
Final independent replay exited 0 in 0.28101078599866014 seconds and matched the
retained bundle byte-for-byte. All local G2 report references resolved.
P3/P4 delivery remains open; this review creates no G3/G4 authority.
