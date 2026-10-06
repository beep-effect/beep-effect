# Graduation portfolio: divergent challenge and convergence

Five isolated concurrent GPT-6.1-Sol medium sessions generated six ideas each. No branch saw another output. Three separate focus sessions deepened the chosen mechanisms. The prompts, outputs and exit receipts remain in the external library. These are design ideas, not new empirical evidence.

The decision is to reuse current owners, prove a consumer boundary, and retain uncertain mechanisms as bounded child explorations. Scores are editorial judgments (N novelty, V viability, F fit); weighted score is .35N+.40V+.25F.

## External effects and uncertain outcomes

- [regulator-1] Give the workflow spike an “outcome unknown” state when a Graph draft disappears. [N4 V10 F10; 7.9]
- [regulator-2] Make interrupted legal workflows reconcile surviving side effects before offering a retry. [N4 V9 F10; 7.5]
- [logistics-2] Require a last-mile delivery receipt before an agent records a Graph message as sent. [N5 V4 F8; 5.35] **Trap:** Do not require recipient delivery proof to label a provider-confirmed send; keep accepted/sent/delivered separate.
- [logistics-3] Route interrupted Effect workflows through a reverse-logistics manifest listing completed effects and available compensations. [N6 V8 F9; 7.55]
- [inversion-2] Explore a vanished-draft case that forces the workflow to say “delivery unknown.” [N5 V9 F10; 7.85]
- [inversion-3] Add an interruption aftermath exercise that inventories what already happened before offering recovery. [N5 V9 F9; 7.6]
- [oncall-2] Add a Graph send-reconciliation exploration owned by the workflow-spike maintainer. [N5 V9 F10; 7.85]
- [oncall-3] Amend the Effect workflow goal with a cancellation-after-commit drill owned by the existing durability maintainer. [N5 V9 F9; 7.6]
- [biology-2] Use cellular quorum sensing to explore send confirmation from independent positive receipts. [N7 V4 F7; 5.8] **Trap:** Multiple correlated receipts are not independent quorum evidence; no new distributed confirmation protocol.
- [biology-3] Use programmed cell death to retire interrupted workflow branches while preserving their external effects. [N6 V7 F8; 6.9]

## Remote origin across storage and sessions

- [regulator-3] Test whether a cached remote skill can disguise itself as trusted local guidance. [N7 V9 F10; 8.55]
- [logistics-4] Keep remote cached skills in a bonded warehouse that preserves their origin through retrieval and execution. [N8 V8 F9; 8.25]
- [inversion-4] Explore a cached skill that survives remote deletion while continuing to disclose its remote origin. [N8 V8 F9; 8.25]
- [oncall-4] Add an offline remote-skill provenance drill owned by the typed skill-kernel maintainer. [N7 V9 F9; 8.3]
- [biology-4] Use genomic imprinting to keep remote skill ancestry attached through caching, copying, and host loading. [N8 V9 F10; 8.9]

## Task utility and honest evaluation

- [regulator-4] Give the effectiveness loop a skill-abstention trial with a fixed subscription budget. [N7 V9 F9; 8.3]
- [regulator-5] Build a claim-transfer refusal test for security results crossing agent harnesses. [N6 V8 F8; 7.3]
- [logistics-5] Give retrieved skills a delivery window: they must arrive before the coding decision they are meant to improve. [N7 V8 F8; 7.65]
- [logistics-6] Ship each security-paper finding with a freight manifest of its harness, attack budget and delivery conditions. [N6 V8 F8; 7.3]
- [inversion-5] Give the coding-agent loop a child exploration where retrieving more relevant skills makes the task worse. [N7 V9 F9; 8.3]
- [inversion-6] Explore how much of one security paper’s attack rate disappears when only the harness changes. [N7 V6 F7; 6.6]
- [oncall-5] Add a skill-retrieval bypass experiment under the active coding-agent effectiveness loop. [N7 V9 F9; 8.3]
- [oncall-6] Add an unattended harness quarantine drill owned by the agent-harness maintainer. [N6 V7 F8; 6.9]
- [biology-5] Use synaptic competition to explore whether retrieved skills earn their place through task completion. [N7 V9 F9; 8.3]
- [biology-6] Use biological reaction norms to amend security-paper synthesis with a harness-specific susceptibility profile. [N6 V8 F8; 7.3]

## Source support and human approval

- [regulator-6] Test whether legally supported passages can still produce an unusable client deliverable. [N7 V7 F9; 7.5]
- [logistics-1] Create a returns desk for law-practice claims whose cited spans exist but fail to support the claim. [N6 V7 F8; 6.9]
- [inversion-1] Amend the law-practice goal with an attorney-veto drill in which a perfectly cited recommendation must still be withheld. [N6 V9 F10; 8.2]
- [oncall-1] Amend the law-practice goal with an attorney-approval expiry drill owned by the authority-ledger maintainer. [N8 V9 F10; 8.9]
- [biology-1] Use immune tolerance to amend the authority goal: recognize source-backed claims without granting attorney approval. [N6 V8 F9; 7.55]

## Shortlist and focus

The highest-scoring distinct mechanisms are approval expiry/current-content binding, remote origin retention (the less obvious viable choice), and paired task outcomes with abstention. Similar variants are clustered before selecting the top three, avoiding three copies of the same idea. Correcting the known Graph ambiguity is required regardless of its lower novelty score.

### approval-expiry

Build one public composition fixture that demonstrates how VerifiedSpan, CandorPolicy, and OfficeActionReview answer three separate questions: does the source exist, does it support the claim, and has a human approved promotion of the current content?

Create a small synthetic office-action example with public source text, a proposed response, and review events, then compose the existing VerifiedSpan, CandorPolicy, and OfficeActionReview interfaces in a fixture harness. The baseline case should pass each existing substrate’s checks and show a human promotion tied to the reviewed version of the response. A second case should contain a valid span from an existing source that is irrelevant to the proposed claim, demonstrating that successful source verification does not establish semantic support. A third case should start with supported content and a human approval, then change the response in a material way so the earlier approval no longer establishes permission to promote the current version. Expose the three outcomes separately in the fixture’s expected results, using the existing contracts to represent evidence, support, and review state. Keep the completed substrates complete: add only composition code, synthetic fixture data, and focused assertions, without introducing a new legal truth model or using production client data.

Risk: The composition may accidentally treat a verified citation or a historical approval as sufficient for promotion; the fixture succeeds only if semantic support is evaluated independently and approval is bound to the exact content reviewed.

First step: Inspect the exported contracts and existing tests for VerifiedSpan, CandorPolicy, and OfficeActionReview, then create a single composition test containing the baseline, valid-but-irrelevant span, and content-changed-after-approval cases using their existing constructors and result types.

- Outcome matrix: Render each fixture case as three explicit outcomes—source existence, semantic support, and current human promotion—so a passing result in one column cannot obscure a failure in another.
- Approval invalidation trace: Show the sequence of reviewed content, approval, content mutation, and attempted promotion, identifying the point where approval becomes stale.
- Citation substitution variant: Replace a supporting span with an authentic but irrelevant span while retaining the proposed claim, proving that source authenticity alone cannot preserve semantic support.
- Human re-review recovery: Extend the stale-approval case with review of the changed content and a new approval, demonstrating how promotion becomes current again through the existing review workflow.

### remote-ancestry

Persist remote skill approval as a provenance-bound receipt, so cached or copied skill bytes retain their remote origin without inheriting local filesystem trust.

Reuse the completed SkillContract schema and the gated typed-agent-skill-contracts host work to carry remote provenance through skill resolution. Bind each approval receipt to the declared origin, manifest digest, content digest, and approved contract, rather than to the file path where a skill happens to reside. When a skill is cached, copied, or loaded after restart, the host reconstructs that identity and checks the receipt before treating the skill as approved. Identical bytes from two origins remain separate approval identities, while a changed manifest invalidates the previous approval even if the executable content is unchanged. Offline loading can reuse a matching receipt for verified cached bytes, but missing provenance or a mismatched receipt leaves the skill gated. Exercise this behavior with a synthetic canary across sessions, keeping the work inside the existing host gate with no production activation or new permission platform.

Risk: A resolution path may discard remote provenance and classify a cached or copied skill as locally trusted before receipt validation, silently bypassing the approval boundary.

First step: Locate the existing SkillContract validation and gated host resolution entry point, then add a failing synthetic test that approves one skill from origin A, copies its cached bytes to a local path, restarts the host, and verifies that approval is accepted only when the original provenance and matching receipt survive.

- One skill, two origins: Serve identical skill bytes from origins A and B, approve A, and verify that B remains gated despite matching content.
- Manifest mutation boundary: Change the manifest while preserving skill content and origin, then verify that the old receipt cannot approve the revised contract.
- Offline cache verification: Disable origin access and verify that cached bytes load only with intact provenance and a matching approval receipt; mutate the bytes and confirm rejection.
- Cross-session synthetic canary: Run approval and subsequent resolution in separate host sessions, covering cache reuse, filesystem copy, and missing provenance, and assert the expected gate decision for each.

### skill-abstention

Use the active coding-agent-effectiveness-evidence-loop to test whether selective skill retrieval improves coding outcomes over both no retrieval and a BM25 retrieval baseline.

Freeze a set of coding tasks, repository snapshots, available skills, and acceptance criteria before running the experiment. Run each task in three paired conditions: retrieval off, retrieval on using the highest-ranked BM25 skill, and selective retrieval using a frozen rule that can abstain when the BM25 match is weak or ambiguous. Keep the model, tool permissions, and total token and time budgets identical across conditions, count retrieval overhead against those budgets, and use isolated workspaces with randomized execution order. Score success only when a solution passes both functional checks and explicit task constraints, while retaining the two component scores to explain failures. Record negative transfer whenever retrieval causes a task that passed without a skill to fail, and compare those losses with the tasks that retrieval rescues. Feed task-level evidence into the existing loop for human review of retrieval decisions, using current subscriptions and the frozen skill collection without marketplace expansion or automatic skill edits.

Risk: BM25 measures lexical overlap, which can favor a convincing but irrelevant skill; tuning abstention after seeing task outcomes would hide that weakness and overstate general usefulness. Set the abstention rule on a separate calibration set, freeze it before evaluation, and report paired wins, losses, and abstentions on untouched tasks.

First step: Define a versioned experiment manifest and implement a runner for one task across all three conditions. The manifest should pin the repository snapshot, task prompt, skill collection, model, budgets, BM25 configuration, abstention rule, functional checks, and constraint checks; the runner should produce one comparable result record per condition from isolated workspaces.

- Mismatch diagnosis: For negative-transfer cases, record the retrieved skill and the instruction that redirected the agent, then have a reviewer distinguish retrieval mismatch from execution failure.
- Budget sensitivity: Repeat the paired experiment at a small number of fixed budget levels to identify whether skill-reading overhead outweighs its benefit on shorter tasks.
- Constraint-specific effects: Compare functional and constraint outcomes separately to detect skills that improve implementation correctness while increasing violations of scope, dependency, or workflow requirements.
- Abstention coverage: Report how often the selective condition retrieves a skill and how its paired outcomes change across match-strength bands, exposing whether better success rates come from useful selection or excessive abstention.

## Deferred provocation

A correctly cited, approved output may still be useless to the attorney because it answers the wrong procedural question. Keep a future attorney-facing usefulness test separate from source binding and current approval; do not pretend the fixture proves practice fitness.
