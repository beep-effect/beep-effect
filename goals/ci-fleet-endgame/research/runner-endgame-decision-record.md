# Runner endgame — decision record (2026-08-08)

Synthesis of the runner-endgame research workflow (5 agents: philips-lineage
deep-read, alternatives survey, our-stack gap audit, cache/AMI design, and
decision synthesis) plus the post-research grill (operator signatures below).
The raw investigator outputs remained session-local and were not committed, so
they are not durable evidence; this record, its in-repo citations, and the
signed grill decisions are the retained basis for execution. This file is the
charter input for `goals/ci-fleet-endgame`; the speed-loop closeout PR graduates
it into that packet.

## Charter (operator-worded, co-primary)

1. **On-demand worker-per-job**: a system that spins up one worker per job on
   demand — "the single biggest win even if we struggle to get under
   20 minute jobs."
2. **No 20-minute jobs**: "Endgame should just mean we don't wait 20 minutes
   for any job."

Neither deliverable is subordinate to the other.

## Decision: ADOPT-THEN-WRAP

Adopt **github-aws-runners/terraform-aws-github-runner** (the live,
community-maintained successor of the archived philips-labs repo — archived
2025-01-16; the fork has ~3.1k stars and released within days of this
research) as the controller core, pinned at v7.10.x with provenance-verified
module + lambda release artifacts, in **ephemeral one-job-one-VM mode with
JIT registration**. Flow: workflow_job webhook → API Gateway → SQS →
scale-up Lambda → CreateFleet (diversified spot) → ephemeral runner →
scale-down/orphan reconciliation.

The deployed `CiRunners.ts` Pulumi stack **remains the foundation**: VPC and
egress geometry, IAM guardrails, flow logs, the reaper as second-line TTL
authority (via `beep-ci=runner` extra-tag propagation to instances AND
volumes), AMI-pinning discipline, and the launch-template worker-shape
doctrine re-expressed as module inputs. All ops flow through `beep runners`
porcelain. The asymmetric turbo cache and lockfile-keyed baked AMI are built
by us regardless of controller (no surveyed option ships them safely for a
public repo).

**Velocity correction (operator, from prior-job experience):** this module
deploys with a single apply in under an hour — the phased ceremony below is
for the *wrapping* (porcelain, cache, AMI, observability), not the module.
Do not let ceremony inflate the deploy. The operator has run this exact
module in production before.

## Signed grill decisions (2026-08-08)

1. **Invariant amendment — THE adoption decision (signed).** "Workers carry
   no AWS credentials" is amended to: *workers carry a scoped,
   permissions-boundaried, deny-by-default, self-referential runner role;
   the single-use JIT registration token is deleted at registration.* The
   module's SSM-pull JIT delivery requires this; the account's
   launch-with-profile IAM Deny is lifted for the runner role only.
   Refusal of this amendment was the void-adoption tripwire; it is now moot.
2. **Deployment vehicle — Pulumi preferred (signed).** "Ideally we use
   pulumi instead of add terraform as a dep if we can." Spike Pulumi's
   `terraform-module` bridge first (module consumed as a Pulumi resource in
   the existing `infra/` program, same S3 state backend + passphrase); a
   minimal Terraform root is the fallback only if the bridge chokes on the
   module's lambda-release artifacts or provider surface.
3. **GitHub App: repo-scoped, KMS, 1Password (signed).** App installed on
   beep-effect only. Private key + webhook secret in SSM SecureString under
   KMS; source-of-truth copy in the 1Password `BEEP_CI` vault
   named `BEEP_CI`, with each secret addressed by a complete
   `op://BEEP_CI/<item>/<field>` reference. A future repo re-runs the install
   step rather than widening blast radius now.
4. **Cost gates: $100/mo projection, $200/mo absolute ceiling (signed).**
   The standing 20%-over-projection rule stops expansion; ceiling breach is
   a hard stop + re-decision. (~1/7th of the Blacksmith run-rate.)
5. **Spot posture: spot everywhere + on-demand failover on capacity errors
   (signed).** Diversified types, price-capacity-optimized. Standing
   tripwire: >2 interruption-caused re-runs/week → move Coverage and Test
   Integration to on-demand.
6. **RunsOn fallback licensing: free non-commercial tier (signed).** The
   defensibility rests on the repo being a public personal learning
   substrate — that is the load-bearing fact, not which email registers the
   account (a personal email is fine and cleaner, but presentation only).
   Nothing is registered unless a tripwire actually fires; the adopted
   module is Apache-2.0 with no licensing question.
7. **Fork-PR trust: resolved by prior hardening (verified live).**
   Approval-required is set for ALL outside collaborators; default workflow
   token is read-only; workflow-approval of PRs is off. The research's
   "weaker than assumed" premise described the pre-campaign state.

Defaults accepted without signature (revisit on evidence, not on schedule):
container/IMDS boundary — block IMDS from containers via host iptables,
final call when the shadow deployment shows whether testcontainers needs
IMDS; RO cache token is public-equivalent by construction — accepted,
because cache contents are artifacts of reviewed merged code only;
maintenance budget 4h/month sustained a quarter → RunsOn tripwire;
break-glass `beep runners launch|teardown` manual path kept (audited,
flag-gated); reaper TTL stays 90 min until measured p99 job duration
justifies tightening; single m7i.2xlarge-class runner config until per-lane
peak-RSS data justifies multi-runner right-sizing splits.

## Alternatives (ranked by the survey)

1. **Adopt-then-wrap the fork** — chosen; best invariant-fit per
   maintenance-hour; the module is also the gap-list oracle regardless of
   pick.
2. **RunsOn** — fallback. Caveats that cost it first place: Magic Cache must
   stay OFF on a public repo (shared-bucket full-write violates
   PR-never-writes-cache; isolation "coming"), runners carry an instance
   role anyway, per-launch telemetry needs an egress exception, and since we
   hand-roll cache asymmetry regardless, its differential shrinks.
3. **Build-own Effect-native controller** — ranked down on operational
   grounds only; stays live as the flip target if the operator ever promotes
   the controller to a first-class learning/product artifact (explicit
   tripwire).
4. ARC (Kubernetes) — wrong weight class for a solo operator; EKS standing
   cost defeats scale-to-zero.
5. Per-workflow ephemeral actions (start/stop EC2 inside the workflow) —
   trust-inverted: PR-editable YAML would control launches; rejected on the
   o6 §2 structural finding.

## Gap audit — what adoption buys (our stack today vs controller needs)

Absent/deferred in our stack, supplied by the module: webhook intake;
**out-of-repo trust verification before any VM launch** (load-bearing since
#620 put `runs-on: beep-ec2-heavy` in PR-editable YAML); JIT registration;
per-job dispatch with subnet/type diversification; spot-interruption
consumer; orphan/health reconciliation beyond the blunt 90-min reaper;
operational metrics (pickup latency, per-job cost, infra-success rate);
capacity policy (scale-to-zero, max fleet, budget alarms).

Keeps (re-asserted as module inputs or kept beside it): IAM launch
guardrails; egress-only VPC + zero-ingress SG; the reaper as second-line
authority; the launch-template worker-shape contract; workflow-side
hardening (#600, #620); the red-team acceptance suite (all must FAIL from a
guest: IMDS credential reachability, S3 cache write, east-west/LAN/tailnet
reach).

## Performance layer (deliverable 2 — ours to build regardless)

Baseline (measured, burst receipts): heavy lane 18–20+ min = ~2.2 min setup
floor + 15–18 min turbo compute at **0 cache hits**; test lanes carry
~9.3 min of type-graph import inside vitest.

- **Asymmetric turbo cache** on the provisioned
  `beep-turbo-cache-832907639880` bucket: trusted (merged) code writes; PR
  code gets read-only via short-lived pre-signed GETs from an Effect-native
  mint Lambda (`effect/unstable/http`, sibling of CiRunners.ts). Projected:
  leaf/mid-slice PR Check/Build/Docgen 18–20 → ~6–9 min; core-package PR
  ~11–14 min; Test Integration ~19 → ~13–15; Coverage 20+ → ~15–17. Bonus:
  the same pull porcelain serves free ubuntu-24.04 lanes — a cached Check
  lane may re-fit free-runner memory, attacking fleet NECESSITY, not just
  speed.
- **Lockfile-keyed baked AMI** (`beep runners bake` through the existing
  launch-template rails; Image Builder and Packer rejected): deletes the
  setup floor and the cross-runner cache-poisoning classes; makes ephemeral
  one-job-one-VM affordable.
- **Honest cannot-fix**: the ~9 min type-graph import is compute inside
  vitest/tsgo, re-paid by every lane that actually RUNS a heavy-import
  suite (Coverage and Test Integration always; core-package PRs broadly).
  Global-input PRs (tsconfig.base/turbo.json edits) hit 0% cache —
  correct, not fixable. The lever on this class is per-slice sharding
  (ledger #3 lineage), not caching.

## Tripwires (standing, from the research — abbreviated)

Container-IMDS boundary fails → decide iptables vs build-own flip; reaper
tag-propagation to instances AND volumes fails → adoption BLOCKED until
fixed; upstream >90 days silent / unpatched advisory / unfundable major →
RunsOn or freeze-and-fork; maintenance >4h/mo for a quarter → RunsOn; first
invoice >20% over $100 projection → stop + re-decide; ceiling $200 → hard
stop; cache+sharding re-fit lanes onto free runners leaving ≤2 EC2 lanes →
controller payload shrinks, revisit scope; Terraform/Pulumi dual-writer
fight over shared resources → stop and consolidate ownership; >2
interruption re-runs/week → longest lanes to on-demand; operator promotes
controller to product → build-own flip.

## Execution order (resequenced for the velocity correction)

Deliverable 1 is hours, not weeks — it goes first; the performance layer
follows on its own track.

1. **Ratify + docs** (this record into the packet; CiRunners.ts doc-block
   amended for the signed invariant; zero controller code).
2. **Bridge spike + deploy** (GitHub App mint → Pulumi terraform-module
   bridge spike → module deployed on a non-serving shadow label; fallback:
   minimal Terraform root).
3. **Cutover**: `beep-ec2-heavy` served by the module; manual burst scripts
   demoted to break-glass; red-team suite re-run against a live ephemeral
   worker.
4. **Cache** (asymmetric turbo cache; biggest measured minutes).
5. **Baked AMI** (`beep runners bake`, lockfile-keyed).
6. **Ops hardening**: pickup-latency/cost/RSS dashboard feeding the
   right-sizing and sharding decisions.
