# Final Claude review — source95711cb9df

Read-only named panel seat, claude-fable-5-1 xhigh; terminal completed, process exit0. Full launch/output retained in `foundation-final-panel-95711cb9df`. Source acceptance is distinct from delivery gates.

I have what I need to adjudicate. No further reads are required; the remaining boundaries are things this seat cannot verify without hashing or execution, and I will state them as such.

## Verdict

**Bounded source acceptance; delivery gates still open.** Every prior P1 and P2 finding from my two earlier seat reports is repaired in the committed source I read, with tests that exercise the repaired behavior. I found no new P1 or P2 defect. All thirteen SPEC criteria are supported at their declared synthetic, metadata-only, two-record scope. Full-goal acceptance stays on hold for repository delivery, not for runtime defects. I read source, tests, templates and receipts only. I ran nothing, hashed nothing, and did not open the proof archives under the home state directory.

## Prior findings adjudicated

| Finding | Status | Evidence |
| --- | --- | --- |
| P1 worker unit pinned journal to 1 MiB | Fixed | `ObservationDeployment.ts:157` derives the ceiling from the page budget; request bounds at `:56-58`; worker gate `ObservationWorker.ts:152-156`; test `ai-metrics-observation-deployment.test.ts:107-129` covers 1024 and 8192 and refuses 255 and 8193. |
| P1 unresolved events stuck after Missing | Fixed, opt-in | Replay requires target match `native-schedule.ts:244-245`, fresh Missing plus minimum delay `:416-419`, latest-Rejected hold `:445-447`, attempt cap and backoff `:456-464`. Tests `native-schedule.test.ts:185-280` lock Mismatch no-replay and attempt limits. |
| P1 un-enrollable pages block seal | Fixed at declared scope | Expiry tolerates ledger capacity `payload-reclamation.ts:171-178`, counts never-enrolled references `:279-287`; digest conflict still refuses at `delivery-ledger.ts:301-303`, which is correct. |
| P1 installed worker had no maintenance path | Fixed | `POST /maintenance` on the private socket `observation-maintenance-http.ts:141-191`, dispatched before intake at `ObservationWorker.ts:325`; the Caddy frontend forwards only trace posts `ObservationDeployment.ts:207-240`. |
| P2 collector transport unqualified | Partially fixed, acknowledged | Legacy receiver is the default `otel-config.yaml.j2:1,52-60,148-155`; metadata port is mode-gated loopback `compose.yaml.j2:87-90`; defaults off at `all.yml:909,937`. Cross-host transport remains a stated deployment prerequisite, not a repaired item. |
| P2 desktop marker lost | Fixed | Finite labels `native-trace.ts:54-56,85-87,389-391`; names and attributes `native-export.ts:144-147,197-199`; read-back requests the three fixture keys `native-readback.ts:89-126`; collector guard `otel-config.yaml.j2:44-51`. |
| P2 worker health had no external path | Fixed | Root probe `observation-health-snapshot.py`, alert group `prometheus-alerts.yml.j2:205-290`. My later P3 about a silent paused worker is also fixed: `:237-243`, tested at `test_observation_health.py:109-113`. |
| P2 shared environment inheritance | Fixed | `LoadCredential` and `env --ignore-environment` at `ObservationDeployment.ts:163-166`; the worker never falls back once a credential directory exists `ObservationWorker.ts:170-219`. |
| P3 pause not atomic with scanner suspension | Fixed | `observation-control.ts:135-149` holds one permit through drain and the after-drain action; used at `observation-worker.ts:118`. |
| P3 persistent Missing had no backoff | Fixed | Checksummed per-event reservation with capped exponential delay `native-schedule.ts:340-376`; cleared at seal `evidence-retention.ts:317`. |
| P3 held forwarder gained a cursor table | Still present, qualified | `forwarder.ts:1327`; the compatibility receipt and `FORWARDER-RECOVERY-HOLD.md` state the limited boundary. Hold intact per receipts. |
| P3 repository gate red | Still open | `.gitleaksignore` on this branch has zero foundation entries, so the base-pinned scan depends on PR2366. Whole-CLI has no passing run: the 06:35 abort was SIGABRT without kernel OOM, and the 20:17 v2 run reached docgen with 288 observed tasks before a host-pressure stop. The process-limit attribution is plausible, not proven by a completed run. |

## New findings, unverified boundaries

New findings are all P3. None blocks the bounded acceptance.

- **Current head is not hash-bound by any committed receipt.** Both route receipts record a parent commit with dirty proof files: `hosted-build-repair-verification.json:5-6` and `declared-route-stages-verification.json:5-6`. Hosted CI at the current head is the only binding available. Treat current-head gates as pending until it reports.
- **No v3 preparation receipt is committed.** `declared-canary-root-preparation-verification.json` describes the v2 root only. The v3 root exists only as prose plus the embedded hashes in `declared_canary_support.py:15-16`. Add a v3 preparation receipt with its archive path and source-hash count, mirroring the v2 artifact.
- **Backend-side host association is transitive.** The stage asserts route, event, surface and source time on stored rows at `live_canary_support.py:187-202` and host identity only in the journal at `:206-209`. The link to the declared host rides on the per-stage unique route ID. If the Phoenix REST response exposes resource attributes, also assert the stored host and namespace attributes.
- **Backup slots can be consumed by a timed-out operation.** The 30-second bound at `observation-maintenance-http.ts:184` cannot interrupt a synchronous VACUUM, and a partial generation occupies one of four fixed slots forever by design. Document the slot-exhaustion recovery path for operators.
- **Plan renderer still cannot cross-check the launch config.** The comment at `ObservationDeployment.ts:100-101` requires matching page budgets, but mismatch surfaces only as a content-free refusal at startup. Unchanged from my delivery review.
- **A symlinked declared root reports `changed`.** The helper's realpath check at `transcript-directory-helper.ts:20` makes a root reached through a symlinked parent permanently `changed` rather than a configuration refusal. Safe, but misleading in health output.
- **Documentation drift.** `manifest.json:87` still says Dankserver PR3 is a draft and Beep is pre-push. `verification-source-freshness.json` is undated and omits the three newest receipts.
- **Design disclosure.** Repository identity is an unsalted digest of the normalized remote at `git-root-evidence.ts:174-177`, so anyone with a candidate remote list can confirm which repository a row belongs to. Deliberate for cross-host joins, but it should be stated in the storage ownership document, which does not mention it.

Unverified by this seat: every `sourceSha256` in every receipt, test execution, the live masked state of the historical forwarder, Phoenix backend state, PR2364 and PR2366 hosted status, and the proof archives. The hosted-build repair itself checks out in source: the three attribute constructors use arity-based `dual(2)` at `native-trace-wire.ts:30-45`, the codec wrappers preserve the strict page boundary at `observation-metadata-codecs.ts:11-13`, and the Python helper's salted hash matches `privacy.ts:541-549` byte for byte.
