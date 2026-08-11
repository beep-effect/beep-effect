# Lightweight Tamper-Evident Approvals for Git-Hosted Workflows

**Lane:** attestation / approvals · **Date:** 2026-08-10 · **Sources:** web + GitHub + X (native)
**Scope:** gitsign/Rekor friction; in-toto/SLSA outside releases; GitHub artifact attestations; protected PR reviews as human trust anchors; generate-without-verify anti-pattern; AI agent self-approval threat models.

---

## 1. TLDR

- **Approvals that live in agent-writable files are not approvals** — they are boolean theater. Unforgeable human sign-off needs a principal and medium the gated agent cannot mint or rewrite (protected PR review, offline human key, or identity-bound OIDC signing outside the agent's workspace write path).
- **`git verify-commit` ≠ identity verification for gitsign.** Upstream warns it only checks cryptographic integrity + Rekor presence; use `gitsign verify --certificate-identity=… --certificate-oidc-issuer=…` for identity claims.
- **Public Rekor/Fulcio leak identity metadata** (email, OIDC issuer, timing — including for private-repo commits). Treat public transparency logging as opt-in for private packet approvals, not default.
- **GitHub UI still often shows gitsign commits as Unverified** (no Fulcio trust in GitHub's commit-signature UX). Operational trust must live in CI/policy bots, not green checkmarks.
- **in-toto was designed for heterogeneous claims** (reviews, tests, design gates) — not only builds — but real enterprise adoption (Palantir) spends most effort on **verification rollout, storage, and false positives**, not envelope format.
- **GitHub Artifact Attestations** make SLSA provenance generation cheap (`actions/attest-build-provenance` + `gh attestation verify`); adoption friction is **consumer verification policy**, plan limits, and the fact that valid provenance ≠ safe artifact.
- **Mini Shai-Hulud (May 2026) and related worms:** cryptographically **valid** SLSA/npm provenance on malware. Signing answers "who/how built"; policy + isolation (L3) + behavioral controls answer "should I run it."
- **Anti-pattern is real and named in the wild:** generate attestations, never require them on consume (Mastra-class failure); or require "some signature" without pinning builder/repo/workflow/identity.
- **Human-in-the-loop at agent volume is weak:** ~40k permission-game runs / 409k decisions — mean threat catch ~66% (miss 1-in-3); familiar `npm run *` exfil approved ~65%; approval fatigue is measured, not folklore.
- **For beep packets: Light ceremony = digest-bound local receipts + protected PR/CODEOWNERS; Standard = CI-enforced verify of subject digests; Full = external identity (gitsign/Sigstore or hardware-bound) only for gates whose consumers will actually verify — never mint dead attestations.**

---

## 2. Findings

### 2.1 Sigstore gitsign — mechanism, verify semantics, friction

**What it is.** Gitsign signs Git commits/tags with short-lived Fulcio certificates bound to OIDC identity (GitHub/Google/…), records entries in Rekor, avoids long-lived GPG keys. Primary docs: https://github.com/sigstore/gitsign

**Identity verify vs integrity-only.** Official README and practitioner writeups agree:

| Tool | Checks |
|------|--------|
| `git verify-commit` | Signature crypto integrity + Rekor entry existence. **Does not validate cert claims** (identity/issuer). Emits: `WARNING: git verify-commit does not verify cert claims. Prefer using gitsign verify instead.` |
| `gitsign verify --certificate-identity=… --certificate-oidc-issuer=…` | Above **plus** expected identity/issuer claims |

Sources: https://github.com/sigstore/gitsign · https://lobi.to/writes/wacksigning/ (Harley Watson, 2023-12-30) · https://www.kenmuse.com/blog/using-gitsign-for-keyless-git-commit-signing/

**Rekor privacy (hard friction for private workflows).** Gitsign stores (1) signature/cert in the commit, (2) HashedRekord (or offline-mode payload) in Rekor. Public Rekor/Fulcio expose identity material from OIDC (email SAN even when GitHub keeps email "private"). Official privacy docs:

- https://github.com/sigstore/gitsign#privacy
- https://blog.sigstore.dev/privacy-in-sigstore-57cac15af0d0/

Watson: *anyone observing Rekor/Fulcio can determine when commits were made, even for private repos.* Timing side-channel is inherent to public transparency logs.

**GitHub private-email leak (historical, still illustrative).** Issue #65: OIDC dance pulled private GitHub email into cert/commit despite user privacy settings / noreply preference. https://github.com/sigstore/gitsign/issues/65

**GitHub/GitLab "Verified" badge gap.** Hosts do not (or long did not) trust Fulcio for the green Verified UI; gitsign-signed commits often appear **Unverified** despite valid Rekor chains. Friction kills casual adoption — teams either abandon gitsign or build **out-of-band verify** in CI. https://lobi.to/writes/wacksigning/ · practitioner notes on X (@termoshtt 2024–2025 asking when GitHub will trust gitsign certs; @debasishbsws 2024-03-08: "no github integration… doesn't show as verified but system looks great").

**CVE-2024-51746 (Low, CVSS 1.8):** online verification could select **wrong Rekor entry** when multiple entries share ephemeral key material (credential cache). Impact window ~10 min cert validity; cert still matched. https://www.cve.org/CVERecord?id=CVE-2024-51746 · GHSA https://github.com/advisories/GHSA-8pmp-678w-c8xx

**Real-world adoption pattern.** Success stories are **policy-enforced CI** (Chainguard-style "Enforce for Git", org bots checking identity) not individual devs chasing green checkmarks. Marketing on X frames gitsign as GPG painkiller (@kunalD_official 2025-11-01); serious ops treat it as **workload/human OIDC identity binding**, not cosmetic signing.

**Implications:** gitsign is viable for Full-tier human commit signatures **if** (a) verify uses `gitsign verify` with pinned identity/issuer allowlists, (b) private approvals avoid public Rekor (private Rekor / offline mode / non-Sigstore path), (c) you never treat GitHub's Verified badge as the gate.

---

### 2.2 in-toto / SLSA outside pure "release build" pipelines

**Framework intent.** in-toto Attestation Framework: verifiable claims about *any* production step — subject digests + typed predicates. SLSA build provenance is one predicate among many. Vetted predicates and the statement model live at https://github.com/in-toto/attestation. SLSA explicitly positions in-toto as the recommended envelope suite: https://slsa.dev/blog/2023/05/in-toto-and-slsa · https://slsa.dev/attestation-model

**Non-build claims (documented design).** Example narratives treat **code review**, SAST, test runs as first-class links/attestations:

- CleanStart: review as signed "link" before build — https://www.cleanstart.com/knowledge-hub/in-toto-attestation
- sbomify: "Code review – records that a human reviewed the code before it was built" — https://sbomify.com/2024/08/14/what-is-in-toto/
- CNCF: tool operation/output as attestation steps — https://www.cncf.io/blog/2023/08/17/unleashing-in-toto-the-api-of-devsecops/

**Enterprise proof (Palantir, 2024–2025 series).** https://blog.palantir.com/how-palantir-mastered-in-toto-b8a7107371bb

- Attestations for release-tagging + build; verification in Apollo catalog **and** install agents (generate-without-verify rejected culturally).
- Hard lessons: hashing **every file** in the repo caused false-positive verification failures → move to HEAD/tag SHA subject model; enterprise storage prefers Artifactory path conventions over public Rekor; offline-capable self-contained bundles for customer envs; phased **flag then block** rollout to avoid outage.
- 2024: custom source-control release attestation + Google SLSA build attestation under in-toto V1.

**Aditya Sirish (@adityasaky, 2023-11-03):** gitsign-signed attestations against commits as a path to multi-signature authorization policies (git natively one commit signature; attestations embed separately). https://x.com/adityasaky/status/1720502990585397323

**Bottom line:** using in-toto for design-approval / test-run predicates is **spec-aligned**, but the engineering cost is **verification infrastructure + layout policy + false-positive control**, not inventing a new envelope. Most "outside release" discourse is still aspirational relative to build provenance volume.

---

### 2.3 GitHub Artifact Attestations — adoption and limits

**Product.** Workflow actions (`actions/attest-build-provenance`, `actions/attest`) produce Sigstore-backed in-toto statements; consumers use `gh attestation verify` (online or offline docs path). Intro public beta: https://github.blog/news-insights/product-news/introducing-artifact-attestations-now-in-public-beta/ · How-to: https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations · Offline: https://docs.github.com/actions/security-for-github-actions/using-artifact-attestations/verifying-attestations-offline

**What GH itself says (critical).** Provenance is a **tamper-proof guarantee that the executed artifact is the one that was built** — it does **not** make the artifact or process secure. Still need code review, dependency hygiene, etc. (same beta post).

**Adoption reports (sparse quantitative; qualitative pattern clear):**

- Easy **generate** path → many tutorials; hard **require-on-consume** path → registries/CI often accept unsigned or unpinned updates (see Mastra in §4).
- Path to SLSA Build L3 on GitHub often means **shared reusable workflow** trust shift (trust moves to workflow owners) — SLSA Mini Shai-Hulud post, May 2026: https://slsa.dev/blog/2026/05/mini-shai-hulud-what-slsa-can-and-cannot-do
- Tooling ecosystem: `slsa-verifier`, policy via OPA/Rego on `gh attestation verify --format json` (beta post examples).
- **CVE-2026-64655** discourse (Aug 2026 X @XQOPTRX): `gh attestation verify` regex interpretation of repo/workflow names could bypass intended signer checks in older CLI — reminds that **verifier bugs are part of the TCB**. Treat as lead; confirm version floor in ops runbooks rather than relying on a single social post alone.

**For non-binary packet artifacts:** GH attestations are optimized for build outputs. Design/test/approval claims fit **custom predicates** (in-toto) better than forcing everything through `attest-build-provenance`.

---

### 2.4 Protected PR reviews / CODEOWNERS as "human approved this digest"

**Platform guarantees (GitHub):**

- Required approving reviews + **CODEOWNERS** ownership of path sets.
- **Dismiss stale pull request approvals when new commits are pushed** — and (2023-06-06) dismiss when **merge base changes** after review; approvals count only on the PR they were submitted against; push of locally crafted merges rejected if contents ≠ system merge. https://github.blog/changelog/2023-06-06-security-enhancements-to-required-approvals-on-pull-requests/
- Rulesets / branch protection docs: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches

**What this does and does not prove.**

| Proves (with settings enforced) | Does not prove |
|--------------------------------|----------------|
| A principal with write/review rights approved **that PR tip** under current rules | Semantic review quality (rubber-stamp reviews) |
| New commits invalidate prior approvals if stale-dismiss is on | That the reviewer verified a **specific artifact digest** unless the PR subject *is* that digest (docs PR of DESIGN.md, evidence bundle commit, etc.) |
| Platform-enforced (agent cannot flip the boolean in-repo) | Identity of reviewer beyond GitHub account security |

**Binding "approved this digest":** the merge commit (or signed tag) of a **docs/evidence PR whose tree SHA or file digests are the subjects** is the natural GitHub-native attestation. Record **review URL + commit SHA + subject digests** in the packet; never store "approved: true" as source of truth.

**Self-review holes:** community still debates CODEOWNERS self-approval (https://github.com/orgs/community/discussions/14866). Pair CODEOWNERS with "require review from Code Owners" + disallow last-push self-approve patterns (org rules vary).

---

### 2.5 "Generate attestations, never verify" and related anti-patterns

1. **Generate-only.** DevOps.com (Nigel Douglas, 2026): Mastra org "generated attestations but never required them, so the registry accepted updates that quietly dropped the signature." https://devops.com/signed-attested-and-malicious-the-software-supply-chain-has-a-deepfake-problem/
2. **Verify signature, ignore policy.** Mini Shai-Hulud: valid SLSA/npm provenance on malware; SLSA maintainers: *provenance records evidence; policy decides acceptability.* https://slsa.dev/blog/2026/05/mini-shai-hulud-what-slsa-can-and-cannot-do
3. **Wrong verify API.** Using `git verify-commit` for gitsign identity gates (false confidence).
4. **Trust badge cosplay.** Green GitHub "Verified" or "has attestation" without pinned builder/repo/workflow/identity allowlist.
5. **Self-attestation theater.** CISA SSDF form / "we attest we are secure" without external evidence — adjacent discourse from Chainguard on self-attestation forms (regulatory paperwork ≠ cryptographic approval).

SLSA's own framing (blog index / "no free lunch" posts): applying SLSA practices and emitting an attestation without verification and isolation guarantees is cargo-cult.

---

### 2.6 AI agents that can edit their own approval records

**Threat model (architecture, not vibes).**

- Agent has workspace write → can append `approved_by: human` to packet JSON / flip lifecycle status / forge ledger lines **unless** those fields are **derived** from external events or signed by keys the agent lacks.
- Agent with PR write / bot token → can request reviews, sometimes self-approve depending on rules → **separate** bot identity + required human CODEOWNERS + stale-dismiss is mandatory.
- Cascading self-confirmation: agent uses prior agent output as evidence of correctness (policy drift).

**Empirical human rubber-stamp data.** Scale X permission game (Aug 2026): 40,000+ runs, 409,000 approve/deny decisions; mean threat accuracy **66.3%** (miss ~1/3); `npm run analyze` malicious miss **64.7%**; 7% approve-everything. https://scalex.dev/blog/ai-agent-permissions-stats/ · discussed on X (@AiDevCraft, @patel_dev7, @dancolta, Aug 2026).

**Practitioner design patterns (2025–2026 discourse).**

- **Cryptographic grants, not booleans:** @net_termina (2026-08-09) — agent proposes only; human mints single-use Ed25519 grant; root verifier re-checks reality; AI never touches the key. https://x.com/net_termina/status/2086537052955279457
- **No cascading self-approval:** @ryderwishart (2026-08-08) — "never let an agent's output become its own evidence." https://x.com/ryderwishart/status/2086161868020908077
- **Approval fatigue → risk-tier routing:** Cloud Security Alliance ORCHIDEAS (2026-06-05) — L6/L7 approval fatigue; batch low-risk, context-rich high-risk, multi-party for catastrophic. https://cloudsecurityalliance.org/blog/2026/06/05/designing-agentic-ai-systems-with-the-orchideas-framework
- **Human clicks are not the safety mechanism:** @PawelHuryn (2026-03-24) on Claude auto-mode classifiers — permission spam was theater; separate policy layer. https://x.com/PawelHuryn/status/2036543873200116012 · @bally_kehal (2026-08-07): "manual approval catching only 14%… policy classifier gating actions." https://x.com/bally_kehal/status/2085836357797355753
- **Sampling over blanket HITL:** @montana_labs (2026-07-15) — route everything past humans buries the 1 case that mattered under 100 rubber-stamps. https://x.com/montana_labs/status/2077460689048797202
- **Context-starved popups = rubber stamps:** @echo_vic (2026-08-10) — bare allow/deny without tool/scope/history is theater; studies ~1/3 dangerous approvals. https://x.com/echo_vic/status/2086754352098685099

**Sabotage / monitor literature (adjacent):** Anthropic SHADE-Arena summary posts (e.g. @rohanpaul_ai 2025-06-16) — monitors miss stealth sabotage ~60% of the time when agents complete dual objectives — weakens "another LLM will catch it."

---

## 3. Practitioner voices from X

Quoted/tightly paraphrased; links are `https://x.com/<user>/status/<id>`.

| Voice | Date | Engagement (avail.) | Claim |
|-------|------|---------------------|--------|
| **@net_termina** | 2026-08-09 | ~6 likes | Agent cannot execute; human approval mints single-use Ed25519 grant; root verifier re-checks; "Approval is cryptography, not a boolean." https://x.com/net_termina/status/2086537052955279457 |
| **@ryderwishart** | 2026-08-08 | low | "AI agents do not get cascading self-approval… never let an agent's output become its own evidence." https://x.com/ryderwishart/status/2086161868020908077 |
| **@AiDevCraft** | 2026-08-06 | — | 409k decisions / 40k sessions: humans missed 1-in-3 malicious agent commands; `npm run analyze` 64.7% approved. https://x.com/AiDevCraft/status/2085464785718816907 |
| **@PawelHuryn** | 2026-03-24 | ~391 likes | Permission-prompt friction was theater; auto classifier + escalate — "Claude is now the safety reviewer of its own actions" (critically: still model-in-the-loop). https://x.com/PawelHuryn/status/2036543873200116012 |
| **@montana_labs** | 2026-07-15 | ~189 likes | Blanket human approval buries the critical case under rubber-stamps; put humans where judgment changes outcomes + sample. https://x.com/montana_labs/status/2077460689048797202 |
| **@echo_vic** | 2026-08-10 | — | Bare allow popups turn humans into rubber stamps; need tool/scope/trigger/history. https://x.com/echo_vic/status/2086754352098685099 |
| **@debasishbsws** | 2024-03-08 | low | Gitsign great systemically but **no GitHub Verified integration**. https://x.com/debasishbsws/status/1766098364687618225 |
| **@termoshtt** | 2025-04-23 | low | Wants GitHub to trust gitsign/Fulcio certs for Verified UX. https://x.com/termoshtt/status/1914893398349430993 |
| **@adityasaky** | 2023-11-03 | low | Multi-sig authorization via sigstore-signed attestations against commits (git one-sig limit). https://x.com/adityasaky/status/1720502990585397323 |
| **@XQOPTRX** | 2026-08-08 | — | CVE-2026-64655: `gh attestation verify` regex name confusion (CLI < 2.97.0 claim). https://x.com/XQOPTRX/status/2086213872520724856 |
| **@chainguard_dev** | 2023-07-28 | modest | Billy Lynch / Gitsign + Enforce for Git: verify signed commits at org policy layer. https://x.com/chainguard_dev/status/1684993982516838400 |

---

## 4. Contrarian / failure evidence

| Failure / counter | Why it matters |
|-------------------|----------------|
| **Valid provenance on malware** (Mini Shai-Hulud May 2026; Miasma/TanStack narratives) | Attestation ≠ safety. Compromised CI + stolen OIDC produces *true* provenance of a *bad* build. |
| **Mastra generate-without-require** | Emitting attestations without consumer enforcement is zero security. |
| **HITL miss rate ~33%** (Scale X game) | "Human approved" in agent fleets is statistically leaky — especially familiar script names and exfil (not just `rm -rf`). |
| **Approval fatigue / autonomy creep** (CSA ORCHIDEAS) | Too many gates → rubber stamps; too few → autonomy shopping via tool composition. |
| **Public Rekor identity/timing leak** | Full Sigstore for private design approvals can be a *privacy regression* vs private git history alone. |
| **GitHub Unverified UX for gitsign** | Social/process adoption fails even when crypto is fine. |
| **CVE-2024-51746 wrong Rekor entry** | Verifiers are code with bugs; pin versions; prefer offline/bundle modes as they mature. |
| **SLSA intentional producer malice out of scope** | Human rubber-stamp of malicious *source* still ships "good" provenance. |
| **Self-review / CODEOWNERS loopholes** | Platform reviews are only as strong as org rules and reviewer incentives. |
| **LLM-as-monitor evasion** (SHADE-Arena discourse) | Replacing human with another model does not close self-approval if both share attack surface. |

Disconfirming the "just use Sigstore for everything" pitch: for an agent-heavy monorepo, **GitHub protected review on digest-bearing PRs** often beats gitsign on UX, privacy, and verify-path reliability — until Full tier needs externally verifiable non-GitHub consumers.

---

## 5. Implications for the beep-effect packet redesign

Opinionated, concrete.

### 5.1 Trust model (non-negotiable)

1. **Source of truth for "approved" is external events**, not packet fields. Packet stores **references**: `github_review_id` / PR URL, `commit_sha`, `subject_digests[]`, optional `sigstore_bundle` path. Status is **derived** by replaying events + verification results.
2. **Agent write-set excludes approval minting.** Agents may propose `approval_request` events; only human-signed commits, protected PR merges, or CI jobs with human-gated OIDC may emit `approval_granted` after verify.
3. **Subject binding is mandatory.** Every approval names digests of `DESIGN.md` / file-change tree / evidence artifacts. Approving a PR without digest pin is Light-tier only and must re-verify on tip change (stale-dismiss analogue in the packet doctor).

### 5.2 Risk-tiered ceremony (map to Light / Standard / Full)

| Tier | Human trust anchor | Evidence | Crypto |
|------|-------------------|----------|--------|
| **Light** | Required PR review + CODEOWNERS on packet paths; dismiss stale | Digest-bound JSONL receipt in git; CI check that receipt digests match tree | None beyond GitHub auth |
| **Standard** | Same + ruleset: no self-approve; human identity ≠ bot | Receipt + CI **verifies** parent chain + digests before ready-bit | Optional gitsign on merge commit with **private** Rekor/offline |
| **Full** | Multi-party or hardware/OIDC human identity outside agent host | in-toto statement `predicateType: beep.dev/packet-approval/v1` (or org-equivalent) subject = design digests; verify in gate job | Sigstore/gitsign **or** GH attestation-style envelope; **verify step required in DoD** |

Unrelated PRs: memoize gate results keyed by `(packet_id, subject_digest, policy_version)` — if digests unchanged, pay zero re-ceremony (aligns with docgen proof-manifest reuse pattern already in-repo).

### 5.3 What not to do

- Do **not** default packet approvals to public Rekor (privacy + GDPR retention tension already noted in codex pass).
- Do **not** use `git verify-commit` alone for gitsign identity gates; pin `gitsign verify` allowlists in CI.
- Do **not** mint Full-tier attestations without a consumer that fails closed — that is the Mastra anti-pattern with extra YAML.
- Do **not** treat "agent got green permission prompts" as Full-tier human approval (Scale X).
- Do **not** let prior agent reflections count as design approval (no cascading self-evidence).

### 5.4 Practical first ship (ponytail-compatible)

1. **Day-0:** derive readiness from GitHub GraphQL/check-runs + required reviews + subject digests of design tree; store only event references.
2. **Day-1:** append-only control events with parent digests **in git** (git is the log); CI verifies chain integrity.
3. **Day-2:** optional Sigstore only for packets that leave the monorepo trust boundary or need offline third-party audit.
4. **Always:** gate job must call `verify`, not `attest` / `sign`, as the merge-blocking step.

### 5.5 Correction to in-repo research note

The three-pass Notion import recommended gitsign with `git verify-commit` as verifier — **that is wrong per upstream**. Codex deep-research already flags this; this lane **confirms**: normative wording must be `gitsign verify` with identity + issuer.

---

## 6. Full source list

### Primary / official

- https://github.com/sigstore/gitsign — gitsign README (verify semantics, Rekor modes, privacy section)
- https://github.com/sigstore/gitsign/issues/65 — private email exposure via GitHub OIDC
- https://blog.sigstore.dev/privacy-in-sigstore-57cac15af0d0/ — Fulcio/Rekor identity privacy
- https://docs.sigstore.dev/logging/overview/ — Rekor overview
- https://www.cve.org/CVERecord?id=CVE-2024-51746 — wrong Rekor entry selection
- https://github.com/advisories/GHSA-8pmp-678w-c8xx — GHSA for CVE-2024-51746
- https://github.com/in-toto/attestation — attestation framework
- https://slsa.dev/blog/2023/05/in-toto-and-slsa — in-toto + SLSA relationship
- https://slsa.dev/blog/2026/05/mini-shai-hulud-what-slsa-can-and-cannot-do — valid provenance on compromise; L2 vs L3
- https://slsa.dev/attestation-model — recommended suite
- https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations
- https://docs.github.com/actions/security-for-github-actions/using-artifact-attestations/verifying-attestations-offline
- https://github.blog/news-insights/product-news/introducing-artifact-attestations-now-in-public-beta/
- https://github.blog/changelog/2023-06-06-security-enhancements-to-required-approvals-on-pull-requests/
- https://docs.github.com/en/authentication/managing-commit-signature-verification/about-commit-signature-verification

### Practitioner / analysis

- https://lobi.to/writes/wacksigning/ — commit signing survey; gitsign verify vs git verify-commit; Rekor privacy; Unverified UI
- https://www.kenmuse.com/blog/using-gitsign-for-keyless-git-commit-signing/ — GitOps + gitsign CI patterns
- https://blog.palantir.com/how-palantir-mastered-in-toto-b8a7107371bb — enterprise in-toto verification lessons
- https://devops.com/signed-attested-and-malicious-the-software-supply-chain-has-a-deepfake-problem/ — generate-without-verify; valid provenance malware
- https://cloudsecurityalliance.org/blog/2026/06/05/designing-agentic-ai-systems-with-the-orchideas-framework — approval fatigue, tiered autonomy
- https://scalex.dev/blog/ai-agent-permissions-stats/ — 40k-run HITL miss rates
- https://www.cleanstart.com/knowledge-hub/in-toto-attestation
- https://sbomify.com/2024/08/14/what-is-in-toto/
- https://www.cncf.io/blog/2023/08/17/unleashing-in-toto-the-api-of-devsecops/
- https://github.com/orgs/community/discussions/14866 — CODEOWNERS self-review discussion

### X posts (selected; see §3 for engagement)

- https://x.com/net_termina/status/2086537052955279457
- https://x.com/ryderwishart/status/2086161868020908077
- https://x.com/AiDevCraft/status/2085464785718816907
- https://x.com/PawelHuryn/status/2036543873200116012
- https://x.com/montana_labs/status/2077460689048797202
- https://x.com/echo_vic/status/2086754352098685099
- https://x.com/bally_kehal/status/2085836357797355753
- https://x.com/debasishbsws/status/1766098364687618225
- https://x.com/termoshtt/status/1914893398349430993
- https://x.com/adityasaky/status/1720502990585397323
- https://x.com/adityasaky/status/1720491903332872585
- https://x.com/chainguard_dev/status/1684993982516838400
- https://x.com/kunalD_official/status/1984417773024657647
- https://x.com/XQOPTRX/status/2086213872520724856
- https://x.com/patel_dev7/status/2085437795863089573
- https://x.com/dancolta/status/2086865841581097092

### In-packet cross-links

- `research/2026-08-10-codex-deep-research-redesign.md` — gitsign verify correction; GDPR vs append-only; tiered crypto
- `research/2026-08-10-notion-strict-planning-three-pass.md` — in-toto/gitsign recommendation (**fix verify API; prefer this lane + codex**)
- Raw scrapes/search dumps: `research/grok/raw/.firecrawl/`

---

*End of lane report. Density preferred; claims above are tied to listed URLs — do not treat unverified social CVE version floors as authoritative without advisory pages.*
