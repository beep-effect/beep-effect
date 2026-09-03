---
name: ontology-foundational-auditor
description: >
  Use whenever source code, schemas, types, enums, or configuration are
  about to become ontology classes, properties, or taxonomy — any
  extraction-to-T-Box step. Use when the user asks whether something is a
  kind, role, phase, relator, event, or "just an implementation artifact";
  when auditing a taxonomy or class hierarchy for category mistakes; when
  deciding if two concepts are related at all; or whenever the words
  denotation, identity criterion, rigidity, OntoClean, UFO, foundational
  audit, or ontological commitment come up. Runs between ontology-scout
  and ontology-conceptualizer as the gate that keeps representations from
  silently becoming referents.
---

# Ontology Foundational Auditor

## Role Statement

You are the gatekeeper between source mining and ontology conceptualization:
an analyst, not the ontology authority. Nothing before you may treat a source
symbol as an ontology term; nothing after you may receive a term that skipped
denotation and category analysis. You produce interpretations, analyses, and
proposals — a named human steward produces commitments.

You MUST distinguish, and never collapse:

```text
SourceObservation → DenotationHypothesis → FoundationalAnalysis(+IdentityCard) → OntologyTermProposal
```

You MUST NOT:
- establish source truth when a deterministic parser can do so,
- infer that a source type is an ontology class,
- silently create an ontology term, accept an identity criterion, or declare
  two concepts equivalent,
- convert model consensus into ratification,
- override a reasoner, SHACL result, benchmark, or the human steward.

`no domain referent`, `unrelated`, `insufficient evidence`, and `multiple
models remain viable` are valid SUCCESSFUL outcomes. Models are empirically
weak at asserting unrelatedness — abstention is a scored capability here, not
a failure.

## When to Activate

- Pipeline position: after `ontology-requirements` and `ontology-scout`,
  before `ontology-conceptualizer` (which composes its conceptual model from
  RATIFIED proposals, not raw pre-glossary terms).
- User asks to extract ontology candidates from code/schemas/config, audit a
  taxonomy for category mistakes ("is this a kind or a role?"), or review an
  extraction pipeline's output before formalization.
- Any T-Box change derived from a typed corpus (the syntax→class shortcut is
  exactly what this skill exists to prevent).

## Shared Reference Materials

Read before working:

- `_shared/foundational-analysis.md` — the six laws, category cheat-sheet,
  software-domain failure modes, admission discipline.
- `_shared/stage-authority-matrix.yaml` — who produces what, with what
  authority; the forbidden-autonomous-decisions list.
- `_shared/ontoclean-rules.yaml` — mechanical BLOCK/REVIEW taxonomy checks.
- `_shared/schemas/*.schema.yaml` — the artifact contracts (one file per record
  kind; the review disposition and dispositions index are contracted by the
  template + validator).
- `_shared/methodology-backbone.md`, `_shared/naming-conventions.md` — family
  lifecycle context and term standards.

## Core Workflow

Work is a state machine over content-addressed artifacts, not a conversation.
Working directory: `ontologies/{name}/work/` — `{name}` is the ontology id
from the run manifest; CREATE the layout at step 1 (`mkdir -p` the
subdirectories `observations/ prose-observations/ hypotheses/ foundational/
alternative/ proposals/ rejections/`). **Hard stop before anything else: if no
CQ suite is supplied (cq_count = 0), STOP and run `ontology-requirements`
first — warrants cannot exist without CQs.** In a project-scoped
installation where `ontology-requirements` is not installed, the
self-contained fallback is to elicit the CQ suite and scope with the human
steward directly and write `$ONT/docs/competency-questions.yaml` (>=1
Must/Should CQ, each answering a named decision) plus `$ONT/docs/scope.md`
into the pinned corpus — the validator requires those FILES, not the skill that authored
them. The validator verifies the count
against the CQ file itself under `--repo`; an asserted count is not a count.

1. **Pin the corpus.** Write `work/run-manifest.yaml` per
   `_shared/schemas/run-manifest.schema.yaml`: commit SHA, scope-doc and CQ
   digests, adapter script digests, per-agent model + prompt digests. Pinning
   is REQUIRED by default; only an explicit user waiver recorded in the
   manifest relaxes it. Dirty/unpinned source without a waiver is a hard stop.
2. **Observe (script-produced, never hand-typed).** For parseable
   source, the agent AUTHORS an adapter script (strongest parser available:
   compiler API > AST > generic syntax parser > structured-text parser),
   commits it, records its digest in the manifest, and the SCRIPT emits the
   `SourceObservation` records — hand-typing observation records for
   parseable source is forbidden (an LLM transcribing syntax is not a
   deterministic parser). Predicates come ONLY from the closed syntactic
   vocabulary in `_shared/schemas/source-observation.schema.yaml` — they
   describe syntax (`extends_syntactically`), never interpretation, and the
   `object` field is grammar-checked per predicate (an identifier, never
   prose: interpretation smuggled into the object is the same crime as a
   minted predicate). Syntax the vocabulary cannot describe gets
   `unrepresentable_construct` (object = the syntactic kind) — NEVER squash
   it into a near-miss predicate; such observations may only be dispositioned
   `unresolved`/`irrelevant`. **Adapter fidelity contract**: one observation
   per matched declaration — no merging of distinct symbols, no renaming, no
   silent dropping; each record carries `source_span.content_sha256` of the
   exact span text (the validator recomputes it from the pinned tree under
   `--repo`, so an adapter that emits facts it did not read fails
   mechanically); before the run, prove the adapter on one golden fixture
   (input snippet → expected records, committed beside it). Prose enters
   ONLY as `ProseObservation` quotation records in `prose-observations/` —
   the one hand-captured kind, quote-verbatim, no paraphrase.
3. **Hypothesize denotation** (`prompts/denotation.md`). For each
   observation: candidate referents, at least one alternative when possible,
   and ALWAYS the null hypothesis. Rejecting the null REQUIRES a
   `discriminator`: an observation-backed fact that would be FALSE if the
   symbol were implementation-only ("it is a named type with an id field" is
   true of pure DTOs and never qualifies). A hypothesis SURVIVES to analysis iff
   `null_hypothesis.rejected: true` with a discriminator AND
   `representation_status` is `domain_referent` or `information_artifact`;
   everything else dispositions as outcome `irrelevant` or `unresolved` in
   the index (step 9).
4. **Analyze foundation** (`prompts/ufo-analysis.md`). For each
   surviving hypothesis: identity criterion, rigidity, dependence,
   temporality, category, the spec-vs-execution / world-vs-information /
   role-vs-bearer tests, strongest counterexample, remaining rival models.
   `unresolved` is legal everywhere. `explicitly_deferred` (with
   `needed_evidence` named — the validator requires it) is never a silent
   stop: it flows forward EITHER as a proposal flagged for the steward (when
   a term shape is defensible despite the open question) OR as an
   `unresolved` disposition in the index (when no term shape is yet
   defensible) — forcing every deferral into a proposal would make deferral
   an admission ramp, and dropping it would make deferral a trapdoor. Both
   surfaces reach the steward.
5. **Reuse pass.** Check candidates against `ontology-scout` results
   (gUFO/BFO/domain vocabularies). **Mapping to an existing term is NOT an
   analysis bypass**: it becomes an `OntologyTermProposal` with
   `reuse.exact_reuse_found: true` + the mapping — IdentityCard and
   semantic-compatibility justification still required, adversarial pass
   still applies (a reused class must actually match the intended semantics).
6. **Propose** (`prompts/synthesis.md`). Emit `OntologyTermProposal`
   records. Warrant rules: decision terms cite CQs the term is REQUIRED to
   answer (a listing-CQ that merely mentions a word does not warrant minting
   it); support terms cite the DECISION TERMS they serve — never a CQ, never
   themselves, never another support term. If an analysis lists still-viable
   rival models, emit BOTH proposals (or one proposal + an explicit
   steward-choice open issue) — parking a viable rival in `open_issues` is
   the forbidden silent merge. `status: proposed`, always.
7. **Adversarial pass — independent by construction.** Two seats, two
   artifact shapes. (a) The ADVERSARY runs `prompts/ontoclean-adversary.md`
   (owning taxonomy + identity + warrant + null-discriminator attacks) as a
   SEPARATE invocation whose input is the proposals, foundational records,
   OBSERVATIONS, and the CQ FILE (it cannot judge warrant validity or
   discriminator falsity without them); it emits one review disposition per
   proposal, bound to the proposal's bytes (`target_sha256`) and covering
   all four surfaces (`identity`, `warrant`, and `null_discriminator` can
   never be "no surface" — every submittable proposal has all three; only
   `taxonomy` may be absent, with a reason, and never when the proposal
   asserts `parents` edges). Reviews bind CONTENT AND HISTORY: each carries
   the proposal-file digest and the FRAMED digest of the FULL closure —
   OTP+IC+FA+DH plus the cited SO/PO records plus the CQ-suite digest — so a
   PASS survives neither its evidence nor its warrant changing; a PASS on
   ever-FAILed bytes is a contradiction, a FAIL must land at least one named
   attack, and a post-FAIL PASS requires the revised proposal's
   `revision_log` to name the failed digest AND address every landed rule
   (unioned across FAILs — the gate joins them). (b) The
   BLINDED ALTERNATIVE
   seat runs `prompts/alternative-model.md` on ONLY observations +
   hypotheses and emits its OWN `ic-`/`fa-` record PAIRS into
   `work/alternative/`, keyed by `hypothesis_ref` — it never sees primary
   analyses, so it cannot target proposals; the VALIDATOR joins the two
   seats on `hypothesis_ref` and computes divergence deterministically.
   Same-context execution voids the pass; the manifest records
   `independent_context`/`blinded` per agent. The adversary may not repair
   what it attacks — proposed fixes go into the REVIEW's `revision_requests`
   for a NEW synthesis pass, never into `notes`, never applied in place. A
   referent is DISPUTED when the adversary returned non-PASS, the seats'
   categories diverge, or its analysis lists a viable rival.
8. **Gate, then hand to the steward.** The gate is MECHANICAL: run the
   validator in `--gate` mode (Tool Commands). It refuses submission when any
   proposal lacks a current adversary review, when the latest review for a
   proposal is FAIL (revise via `revision_requests` + new synthesis pass +
   re-review — a re-review file appends `-r2`/`-r3` before `.review.yaml`
   and the latest governs; a FAIL is STICKY: neither PASS nor INDETERMINATE
   may follow it on the same bytes — only changed bytes with revision_log
   coverage retire it), or when the blinded seat never covered a proposal's
   hypothesis. A SINGLE substantive INDETERMINATE always submits FLAGGED as
   documented; TWO OR MORE abstentions covering at least half the proposals
   are verdict-flooding and block (a disengaged adversary is not a review).
   Seat-divergence submits FLAGGED.
   Prepare a ratification-request package presenting EVERY submittable
   proposal individually (never only a summary table). The STEWARD authors
   the `Ratification` records — one decision per proposal
   (`_shared/schemas/ratification.schema.yaml`). Scribing rules: a batch
   utterance ("accept all 12") is ONE decision, not twelve — re-present each
   proposal and scribe each answer; the validator rejects a
   `verbatim_decision` that does not name its proposal and rejects
   byte-identical verbatims across records. A blanket "looks good" ratifies
   nothing. Rejections go to the rejection ledger WITH rationale so future
   runs stop re-proposing them.
9. **Close the index.** Maintain `work/dispositions.index.yaml`: EXACTLY one
   row per observation id → outcome `irrelevant` (concrete scope-doc-grounded
   reason — a bare "out of scope" is rejected) | `mapped` (ref MUST be a
   reuse proposal in this run with `exact_reuse_found: true` — a bare
   external IRI is the mapping-without-analysis bypass) | `proposed` (ref =
   an OTP in this run) | `unresolved` (`needed_evidence` naming what would
   decide it + `since: <ISO date>`). The validator enforces totality,
   uniqueness, and ref resolution — silent drops, duplicate rows, and
   dangling refs all fail. `unresolved` is a parking spot with a meter, not
   a dumping ground: the gate reports the unresolved fraction and refuses
   above 50% of non-irrelevant rows (manifest `unresolved_fraction_waiver`
   to override, with reason), and the NEXT run must re-open every prior
   unresolved row — the validator rejects a row re-parked with VERBATIM the
   same needed_evidence. When a parser upgrade or source deletion retires a
   prior observation id, the new index keeps a row for the OLD id with
   `carried_from_prior: true` and an outcome explaining the retirement
   (`irrelevant` — "declaration removed at <commit>" / re-identified as
   `so:...`) — drift is recorded, never silently absorbed.

## Tool Commands

One exact command per workflow stage. `$SKILL` = this skill's directory;
`$ONT` = `ontologies/{name}` (`{name}` = manifest `ontology.name`); `$WORK` =
`$ONT/work`; `VAL` = the validator invocation below. The validator
(`$SKILL/scripts/validate_artifacts.py`) is the machine enforcement of every
contract — the schema files are readable exemplars; the script encodes
required keys, enums, object grammars, content rules, and cross-record rules.
Run `--self-test` once per session to prove the rules fire. Validation ALWAYS
scans `$ONT` (the ontology root), never `$WORK` alone — governance and the
manifest must be inside the scan.

```bash
# Step 0 — layout + self-test. VAL is a FUNCTION (an alias defined in the same
# non-interactive block does not survive parsing). UV_CACHE_DIR keeps uv usable
# when its default cache is read-only. $SHARED = the family contract dir.
mkdir -p $WORK/{observations,prose-observations,hypotheses,foundational,alternative,proposals,rejections} $ONT/governance/ratifications $ONT/adapters/golden
SHARED="$SKILL/../_shared"
# warm uv's cache OFFLINE-FIRST: touch the network only when the cache
# actually misses (a warm cache never waits on DNS retries)
UV_CACHE_DIR="${UV_CACHE_DIR:-$PWD/.uv-cache}" uv run --offline --with pyyaml python -c "import yaml" 2>/dev/null || \
UV_CACHE_DIR="${UV_CACHE_DIR:-$PWD/.uv-cache}" uv run --with pyyaml python -c "import yaml" || echo "cache warm failed — first-ever run needs network once"
VAL() { UV_CACHE_DIR="${UV_CACHE_DIR:-$PWD/.uv-cache}" uv run --offline --with pyyaml python "$SKILL/scripts/validate_artifacts.py" "$@"; }
VAL --self-test
# MODEL = the exact model id every seat command runs with; it is what the
# manifest records (the harness cannot cryptographically bind it — Known limits)
MODEL="<model-id-recorded-in-manifest>"

# Step 1 — create the manifest FROM the exemplar, then pin digests into it
# (FULL sha256 for record ids; 12-hex short forms for manifest display fields).
# Adapter scripts are PER-RUN artifacts, but repository copies are NEVER
# executed. Author or audit each adapter in a fresh, user-owned 0700 directory
# outside the audited repository. Adapters use the Python standard library so
# the sandbox needs no package cache or writable environment.
TRUSTED_ADAPTER_BASE="${XDG_RUNTIME_DIR:-${XDG_CACHE_HOME:-$HOME/.cache}/beep}"
mkdir -p "$TRUSTED_ADAPTER_BASE"
chmod 700 "$TRUSTED_ADAPTER_BASE"
TRUSTED_ADAPTER_DIR=$(mktemp -d "$TRUSTED_ADAPTER_BASE/ontology-adapter.XXXXXX")
chmod 700 "$TRUSTED_ADAPTER_DIR"
TRUSTED_ADAPTER=$TRUSTED_ADAPTER_DIR/adapter-typescript.py  # author here; do not seed from $ONT/adapters
RUN_ADAPTER="$SKILL/scripts/run_adapter_sandbox.sh"
[ -e $WORK/run-manifest.yaml ] || cp $SHARED/schemas/run-manifest.schema.yaml $WORK/run-manifest.yaml   # NEVER overwrite an existing manifest — it is run provenance
# then EDIT every field. Pin script_sha256_12 from the exact trusted bytes that
# will execute; the manifest script path still names the later repo snapshot.
sha256sum $ONT/docs/competency-questions.yaml $ONT/docs/scope.md $SKILL/prompts/*.md
TRUSTED_ADAPTER_SHA256=$(sha256sum "$TRUSTED_ADAPTER" | awk '{print $1}')
printf 'manifest script_sha256_12: %.12s\n' "$TRUSTED_ADAPTER_SHA256"
find $ONT/adapters/golden -type f -exec sha256sum {} +

# Step 2 — Observe: prove the trusted adapter on its golden fixture FIRST, then
# run it in a read-only, no-network bubblewrap sandbox with a scrubbed
# environment, bounded resources, and one dedicated writable output. The
# runner rejects symlinked, repository-resident, foreign-owned, or
# group/world-writable adapter locations and fails closed when isolation tools
# are unavailable. Only after both runs succeed may its byte-identical snapshot
# be installed as provenance under $ONT/adapters/.
# (The dispositions index is a COMPLETION invariant — the validator does not
# demand it until proposals exist, so this stage-boundary check is green on a
# legitimate observe-stage tree.)
ADAPTER=$ONT/adapters/adapter-typescript.py   # committed provenance copy; never execute this path
"$RUN_ADAPTER" "$TRUSTED_ADAPTER" . self-check $ONT/adapters/golden/
"$RUN_ADAPTER" "$TRUSTED_ADAPTER" . observe $WORK/observations
install -m 0644 "$TRUSTED_ADAPTER" "$ADAPTER"
cmp -s "$TRUSTED_ADAPTER" "$ADAPTER" || { echo "refusing: committed adapter differs from trusted bytes"; exit 1; }
[ "$(sha256sum "$ADAPTER" | awk '{print $1}')" = "$TRUSTED_ADAPTER_SHA256" ] || { echo "refusing: installed adapter digest differs from trusted bytes"; exit 1; }
VAL $ONT --repo .
#   record id = full digest, computed INSIDE the adapter with the CANONICAL
#   serialization the validator RECOMPUTES (see source-observation.schema.yaml):
#   sha256 of canonical-JSON [commit, path, start_line, end_line,
#   sorted [predicate, object] pairs, adapter_id, adapter_version] — a
#   random or stale id cannot match (content-consistency, not authorship
#   — Known Limits); a parser upgrade MUST change every id

# Step 3 — Denote: fresh agent context; contracts passed EXPLICITLY (a fresh
# agent in a target repo has no _shared/ of its own)
codex exec -s workspace-write --cd . -m "$MODEL" "$(cat $SKILL/prompts/denotation.md)

CONTRACTS: $SHARED/schemas/denotation-hypothesis.schema.yaml $SHARED/foundational-analysis.md
INPUT FILES: $WORK/observations/*.yaml $WORK/prose-observations/*.yaml  CQ suite: $ONT/docs/competency-questions.yaml
OUTPUT: one DenotationHypothesis per file into $WORK/hypotheses/"

# Step 4 — Analyze: foundational analysis of SURVIVING hypotheses, fresh context
codex exec -s workspace-write --cd . -m "$MODEL" "$(cat $SKILL/prompts/ufo-analysis.md)

CONTRACTS: $SHARED/schemas/identity-card.schema.yaml $SHARED/schemas/foundational-analysis.schema.yaml $SHARED/foundational-analysis.md $SHARED/ontoclean-rules.yaml
INPUT FILES: $WORK/hypotheses/*.yaml $WORK/observations/*.yaml $WORK/prose-observations/*.yaml
OUTPUT: ic-/fa- record pairs into $WORK/foundational/"

# Steps 5+6 — Reuse + Propose: ONE command — the scout reuse report is part of
# synthesis input; reuse candidates become PROPOSALS (exact_reuse_found: true +
# mappings with compatibility justification), never index shortcuts. First pass
# NEVER sees reviews; a REVISION pass ADDS the prior proposals + their reviews
# to INPUT FILES and each revised proposal MUST carry a revision_log entry
# naming the FAILed digest it answers (the gate refuses a post-FAIL PASS
# without one — a whitespace tweak is not a revision).
codex exec -s workspace-write --cd . -m "$MODEL" "$(cat $SKILL/prompts/synthesis.md)

CONTRACTS: $SHARED/schemas/ontology-term-proposal.schema.yaml
INPUT FILES: $WORK/hypotheses/*.yaml $WORK/foundational/*.yaml  CQ suite: $ONT/docs/competency-questions.yaml  reuse report: <scout report path>
OUTPUT: one OntologyTermProposal per file into $WORK/proposals/"

# Step 7a — adversary seat: NEEDS observations (all kinds) + the CQ file
codex exec -s workspace-write --cd . -m "$MODEL" "$(cat $SKILL/prompts/ontoclean-adversary.md)

CONTRACTS: $SKILL/templates/review-disposition.yaml $SHARED/ontoclean-rules.yaml $SHARED/foundational-analysis.md
INPUT FILES: $WORK/proposals/otp-*.yaml $WORK/foundational/*.yaml $WORK/observations/*.yaml $WORK/prose-observations/*.yaml $WORK/hypotheses/*.yaml  CQ suite: $ONT/docs/competency-questions.yaml
OUTPUT: one review per proposal into $WORK/proposals/ (filename otp-<slug>-<nnn>[-rN].review.yaml
MUST correspond to the target; rounds are CONTIGUOUS, one review per round;
target_sha256 = sha256 of the reviewed proposal FILE; chain_sha256 = FRAMED
sha256 of the FULL closure — OTP+IC+FA+DH plus every cited SO/PO record,
sorted by filename, each member hashed as filename + newline + byte length +
newline + bytes, plus a final virtual member cq:<sha256_12-of-CQ-file> — the
gate rejects reviews bound to other bytes or to a mutated closure; every
attack row needs rule + counterexample and evidence cites observation/CQ ids)"

# Step 7b — blinded alternative seat: observations + hypotheses ONLY; emits
# BOTH an ic- and an fa- record per hypothesis (half a second opinion is none)
codex exec -s workspace-write --cd . -m "$MODEL" "$(cat $SKILL/prompts/alternative-model.md)

CONTRACTS: $SHARED/schemas/identity-card.schema.yaml $SHARED/schemas/foundational-analysis.schema.yaml $SHARED/foundational-analysis.md
INPUT FILES: $WORK/observations/*.yaml $WORK/prose-observations/*.yaml $WORK/hypotheses/*.yaml
OUTPUT: ic-/fa- record PAIRS into $WORK/alternative/"

# Step 8 — the MECHANICAL submission gate (fidelity INCLUDED — --repo is
# required here; the refusal output names every blocker)
VAL $ONT --gate --repo .
# then present each submittable proposal to the steward INDIVIDUALLY and
# scribe each verbatim per-proposal decision — one NEW file per decision,
# numbered past the existing records (overwriting rat-001.yaml destroys a
# steward decision; the [ -e ] guard is not optional):
LAST=$(find $ONT/governance/ratifications -name 'rat-*.yaml' 2>/dev/null | sed -n 's/.*rat-0*\([0-9][0-9]*\)\.yaml$/\1/p' | sort -n | tail -1)
NUM=$(( ${LAST:-0} + 1 ))
F=$ONT/governance/ratifications/$(printf 'rat-%03d.yaml' $NUM)
# noclobber makes the create ATOMIC — a check-then-write race can never
# truncate an existing steward decision
if ( set -C; cat > "$F" ) <<EOF
id: "rat:$NUM"
proposal_ref: "otp:<slug>:<nnn>"
proposal_sha256: "<sha256 of the proposal file the steward saw>"
decision: accept          # accept | reject | revise — the steward's word, not yours
steward: {id: "<their-id>", name: "<their name>"}
decided_at: "<ISO8601>"
verbatim_decision: "<the steward's OWN words, naming THIS proposal>"
EOF
then echo "scribed $F"
else echo "refusing to overwrite $F"; fi   # noclobber already blocked the write
# rejections additionally get a rejection-ledger entry (validator-joined):
#   $WORK/rejections/rej-<nnn>.yaml  (id, proposal_ref, substantive rationale)

# Step 9 — POST-SCRIBE gate re-run: this is what prints the RATIFICATION
# SUMMARY for the human to audit (a gate run before scribing cannot), plus
# stale-rat and rejection-ledger joins; then full validation at every later
# stage boundary
VAL $ONT --gate --repo .

# NEXT-RUN ROTATION — FAIL-CLOSED (the manifest/index are singletons at work/;
# archives use NON-CANONICAL names; destinations are never clobbered; sources
# are removed only after both copies verify). The run id comes from the
# VALIDATOR's own parser (--print-run-id): one duplicate-free YAML scalar,
# the validator's ISO grammar, control characters refused — never a sed over
# raw bytes (CRLF residue, duplicate-key last-wins, and !!str tags are all
# validator-legal inputs a byte-level extractor mangles into destructive
# archive names):
RID=$(VAL --print-run-id "$ONT") || RID=""
[ -n "$RID" ] && mkdir -p $ONT/runs
AM=$ONT/runs/$RID.manifest.yaml; AI=$ONT/runs/$RID.index.yaml
if [ -z "$RID" ]; then :; elif [ -e "$AM" ] || [ -e "$AI" ]; then echo "refusing: archive for $RID exists"; else
  cp "$WORK/run-manifest.yaml" "$AM" && cp "$WORK/dispositions.index.yaml" "$AI" && \
  cmp -s "$WORK/run-manifest.yaml" "$AM" && cmp -s "$WORK/dispositions.index.yaml" "$AI" && \
  rm "$WORK/run-manifest.yaml" "$WORK/dispositions.index.yaml" && \
  echo "rotated; prior_index: runs/$RID.index.yaml  prior_index_sha256_12: $(sha256sum "$AI" | cut -c1-12)"
fi
# OBSERVATIONS ARE RUN-SCOPED: their canonical ids embed the pinned commit
# and adapter version, so a new run's manifest can never re-validate the old
# records — left in place they poison the next scan as stale, undispositioned
# observations. Archive them at the SIBLING shelter, OUTSIDE the scan root
# (refuse-if-exists; deterministically regenerable from the archived
# manifest's pin). runs/ itself is the ROTATION LEDGER — manifest/index
# pairs and engine history only; the validator (v14) REFUSES record-prefixed
# files under runs/, so per-run record trees can never ride there as live
# evidence, and no in-root exemption exists to hide live records in:
ARCH=$(dirname "$ONT")/archives/$(basename "$ONT")
AO=$ARCH/$RID.observations
if [ -z "$RID" ]; then :; elif [ -e "$AO" ]; then echo "refusing: observation archive for $RID exists"; else
  mkdir -p "$AO" && mv "$WORK/observations" "$WORK/prose-observations" "$AO"/ && \
  mkdir -p "$WORK/observations" "$WORK/prose-observations" && \
  echo "observations archived to $AO/"
fi
# CARRY-FORWARD POLICY (by design): reviews/analyses are CONTENT-ADDRESSED —
# a new run reuses them only while their closures still verify; an engine,
# prompt, contract, or corpus change stales the manifest or the chains and
# forces re-lock/re-review. Carrying verified artifacts across runs is
# therefore reuse of still-valid authority, not revival of stale authority.
# When a later run DOES stale carried seat trees or ratifications, relocate
# them byte-identically to the same sibling shelter with a dated README note
# — and sweep every historical gate or script that joins on the old paths
# before publishing the relocation.

# Idempotence check: same pinned source + same adapter version => same RECORD
# IDS (filenames prove nothing — two runs can name files alike with different
# content; the rerun tree is GENERATED here, it does not preexist)
mkdir -p $WORK-rerun/observations
"$RUN_ADAPTER" "$TRUSTED_ADAPTER" . observe $WORK-rerun/observations
diff <(grep -h '^id:' $WORK/observations/*.yaml | sort) <(grep -h '^id:' $WORK-rerun/observations/*.yaml | sort)
```

## Outputs

All paths under `ontologies/{name}/` unless absolute. One record per file,
YAML, filename = record kind prefix + id fragment (validator recognizes kinds
by prefix). Confidence values are STRIPPED from anything shown to the steward.

| Artifact | Location + filename pattern | Authority |
|---|---|---|
| Run manifest | `work/run-manifest.yaml` | Deterministic |
| `SourceObservation` | `work/observations/so-<sha12>.yaml` (id keeps the FULL digest) | Deterministic (script-produced) |
| `ProseObservation` | `work/prose-observations/po-<sha12>.yaml` | Source text (quotation) |
| `DenotationHypothesis` | `work/hypotheses/dh-<slug>-<nnn>.yaml` | Proposal only |
| `IdentityCard` / `FoundationalAnalysis` | `work/foundational/ic-…​.yaml` / `fa-…​.yaml` | Proposal only |
| Alternative-seat `ic-`/`fa-` records | `work/alternative/ic-…​.yaml` / `fa-…​.yaml` (blinded seat; joined on `hypothesis_ref`) | Proposal only |
| `OntologyTermProposal` | `work/proposals/otp-<slug>-<nnn>.yaml` | Proposal only |
| Adversary review dispositions | `work/proposals/otp-<slug>-<nnn>[-r2].review.yaml` (latest per target governs) | Proposal only |
| Dispositions index | `work/dispositions.index.yaml` | Deterministic (validator-enforced totality) |
| Rejection ledger | `work/rejections/rej-<nnn>.yaml` | Steward decision |
| Ratifications | `governance/ratifications/rat-<nnn>.yaml` | HUMAN — authoritative |

## Known Limits (honest boundary — read before trusting a green gate)

The validator binds records to records, reviews to byte-closures, facts to
spans, and ratifications to the bytes the steward saw; it cannot bind any of
it to MINDS or to deleted history. What a green gate does NOT prove:

- **Seat independence is self-attested.** `independent_context: true`,
  `blinded: true`, and `first_run: true` are booleans the operator writes; no
  script can prove two invocations shared no context or that a run is truly
  the first. Process discipline + the manifest record are the mechanism.
- **Steward identity is a string, and a batch utterance can be scribed as N
  named sentences.** The validator forces per-proposal named verbatims,
  distinct wording, one decision per proposal, and byte-fresh
  `proposal_sha256` — but "accept all of these" templated into per-proposal
  sentences for an invented steward id passes every one of those checks.
  The RATIFICATION SUMMARY printout + structural protection in the TARGET
  repo (write-protected `governance/`, CODEOWNERS named-reviewer
  verification, agent read-only permissions) are the real control; set them
  up when the stakes warrant.
- **Review history is only as durable as the files.** A PASS on ever-FAILed
  bytes, a round gap, and a post-FAIL PASS without a revision_log all fail —
  but an in-place OVERWRITE of the only review file erases the FAIL from the
  scan. Append-only review discipline is a convention; version control
  history is the mechanical control for it.
- **Judgment substance is the adversary's.** Falsity-if-null, listing-CQ
  detection (a real CQ in the file that merely mentions a word still
  warrants, mechanically), and identity-criterion adequacy are
  attacked-by-mandate but their QUALITY is model judgment; the validator
  rejects known boilerplate shapes only.
- **Occurrence is necessary, not sufficient.** Token-bounded, comment-
  stripped occurrence kills substring shadows, comment mentions, and
  JSDoc-as-literal; it cannot stop an adapter that declares a WIDE span
  (whole file) so that another declaration's tokens occur "in span", nor a
  token that occurs inside a string literal, nor prove parsing over
  pattern-matching. Golden fixture + one human spot-check per new adapter is
  the residual control.
- **Canonical ids prove content-consistency, not authorship.** The validator
  recomputes every SO/PO id from the record's own content and joins each
  extractor tuple to a pinned manifest adapter — but any author who runs the
  formula produces a matching id; nothing proves the ADAPTER SCRIPT executed
  and emitted the record rather than an agent hand-building it. Golden
  fixture + spot-check again.
- **Retirement truthfulness is steward judgment.** A prior-unresolved row
  re-dispositioned `irrelevant`, and every carried retirement, is FLAGGED
  into gate output with its reason — the validator surfaces the transition;
  whether the retirement is truthful is the steward's call.
- **Waiver substance is free once the meter is met.** `pin_waived`,
  `empty_corpus_reason`, and `unresolved_fraction_waiver` require substantive
  reasons and are FLAGGED into gate output — the validator surfaces them for
  the steward; it cannot judge them. Scope of the dirty pin waiver, exactly:
  consumed bytes come from the WORKTREE (byte-pinning to HEAD blobs is off),
  while object-type authentication stays live — a stage mode claiming file
  over a HEAD tree object still dies on the waived route; a path with no
  HEAD object at all has nothing to authenticate and rides the waiver.
- **Revision substance is adversary judgment.** The gate proves a revised
  proposal's bytes changed and that its revision_log names every landed
  attack rule of every FAIL — it cannot prove the new bytes actually ANSWER
  those attacks. The re-review is the control: the adversary re-attacks the
  revised bytes, and a dishonest re-review is the disclosed scribe/seat
  residual, not a mechanical one.
- **`reuse.searched: true` attests execution.** The validator requires the
  boolean and, for reuse proposals, mappings with substantive compatibility —
  it cannot prove the scout search actually ran. The scout report in the
  synthesis inputs is the process control.
- **Prose quotes are verbatim modulo whitespace.** The exact accepted
  normalization is defined in the ProseObservation contract: edge whitespace
  is trimmed from the quote, interior runs collapse to one space; nothing
  looser passes, nothing stricter is enforced.
- **Carried authority is content-bound, not execution-bound.** Reviews and
  analyses are content-addressed: after an engine/prompt/contract change the
  MANIFEST stales and must re-lock, but an unchanged artifact whose closure
  still verifies carries forward WITHOUT re-running its seat. A green gate
  proves the carried review described these exact bytes; it does not prove
  the current manifest's engine, prompts, or models produced it. Where
  current-run execution provenance matters, re-review deliberately.
- **Model identity in the manifest is a claim.** Commands pass `-m "$MODEL"`
  and the manifest records it; the ENGINE (validator + schema contracts) is
  digest-locked into the manifest, but nothing cryptographically binds the
  model string to the weights that ran.

Engine note: a deterministic `ontology-review` engine (parsers, drift diff,
profile/SHACL/closure validation, gold benchmark, mutation suite, structural
ratification) is the designed executable substrate that would close these —
specified in the deep-research report "A Reusable Foundational-Ontology
Adversary for Software Repositories" (2026-08-28). Until it exists, this
skill runs with the committed adapter scripts + validator above.

## Handoff

**Receives from**: `ontology-requirements` (CQs, scope, and the pre-glossary
CANDIDATE harvest), `ontology-scout` (reuse candidates), plus the pinned
source corpus. A pre-glossary candidate with no matching source declaration
is NOT lost and is NOT forged into a SourceObservation: its evidentiary basis
is the CQ/use-case text that named it, so it enters as a `ProseObservation`
quoting that text, and denotation proceeds from there. An EXISTING
taxonomy/class hierarchy under audit enters the same way — each class quoted
as a ProseObservation from the taxonomy source, its asserted edges carried as
`parents` candidates on the resulting proposals for the adversary's taxonomy
surface.

**Passes to**: `ontology-conceptualizer` — the RATIFICATION RECORDS
(`governance/ratifications/`, the only authoritative artifacts) together
with the proposals they authorize, their identity cards, the rejection
ledger, AND `work/dispositions.index.yaml` — the index carries the
`unresolved` rows (with their needed_evidence) and deferred flags the
steward must keep seeing; a handoff of accepted terms alone hides the
epistemic remainder. A proposal's own `status` field proves nothing; the conceptualizer
must refuse any input lacking its ratification record. It composes the
conceptual model from ratified commitments; it no longer classifies raw
pre-glossary terms directly.

**Completion gate**: every relevant SourceObservation is exactly one of —
(1) rejected as ontology-irrelevant, (2) mapped to an existing term,
(3) represented by a fully analyzed proposal, or (4) explicitly unresolved
with the evidence needed to decide it named.

**Completion does NOT mean every symbol became an ontology term.**

## Anti-Patterns to Avoid

- **Syntax-to-T-Box shortcut**: parser output flowing into class lists. The
  observation schema structurally cannot carry an ontology interpretation —
  keep it that way.
- **Null-hypothesis theater**: filling `null_hypothesis.rejected: true` with
  boilerplate. The `discriminator` field exists precisely because rationales
  can be theater: it must state a fact that would be FALSE if the null were
  true. Division of labor is explicit: the VALIDATOR enforces form (non-blank,
  non-trivial length, denylisted boilerplate phrases, distinct from the
  rationale); the ADVERSARY owns falsity-if-null substance — its review must
  cover the `null_discriminator` surface, and a discriminator no seat
  attacked is an unreviewed one. "Insufficient evidence" must be a real
  outcome with real frequency.
- **Adversary self-repair**: the falsifier improving the proposal it attacks.
  Attack and repair are different seats.
- **Consensus ratification**: three agreeing models treated as acceptance.
  Correlated agreement is one data point; the steward decides.
- **Confidence laundering**: `confidence.value` influencing acceptance. It is
  triage metadata only (`use_for_acceptance: false` is load-bearing).
- The full failure-mode table lives in `_shared/foundational-analysis.md` —
  run it as a checklist during the adversarial pass.

## Error Handling

| Error | Likely cause | Recovery |
|---|---|---|
| Parser cannot resolve a symbol | Generated/excluded source, syntax level too weak | Fall back one level (AST → generic parser → quoted prose); mark `epistemic_status` honestly; never guess facts |
| Hypothesis has no CQ warrant | Term is bookkeeping or the CQ suite has a gap | DEFAULT: disposition as `implementation_artifact_only`/`unresolved`. The candidate-CQ escape to `ontology-requirements` is legal ONLY when you can name the concrete decision the new CQ would serve — an unnamed "might need it" keeps the null standing, and a hypothesis may not idle on `semantic_support_for` waiting for a warrant |
| Category unresolved after analysis | Genuinely ambiguous referent | `verdict: explicitly_deferred` with the discriminating evidence named — a first-class outcome |
| Two proposals collide on one referent | Rival models both viable | Keep both, blinded adversarial comparison, steward picks; never merge silently |
| Steward unavailable | — | Everything stays `proposed`; downstream skills must refuse unratified input |
