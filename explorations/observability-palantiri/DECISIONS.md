# Decisions

<!-- Align-stage grilling log. Dated Question / Answer / Rationale entries,
rejected options included. -->

## 2026-10-14 — Inherited operator decisions (D1–D9)

The operator locked these in the pre-research session that drafted the launch
prompt ([`CAPTURE.md`](./CAPTURE.md) §2). They are recorded here as inherited
and are not re-litigated in align.

### D1 — Backend/store choice is deferred behind a MAP gate

- **Answer:** The logs/traces/metrics store bake-off (Grafana LGTM pieces vs
  VictoriaLogs/VictoriaTraces vs ClickStack/SigNoz/OpenObserve vs hosted)
  does not close until `beep-worker` and the incoming Linux box are fully
  enrolled (tags, disks, systemd). Either may host the hub; `dankserver`
  stays the live truth until the gate fires.
- **Rationale:** every candidate ingests OTLP and most ship an MCP server, so
  the choice is a capacity/operations question that blocks nothing upstream
  ([`research/handoff/backend_landscape.md`](./research/handoff/backend_landscape.md)).

### D2 — Strictest tier is shape-only, enforced in the SDK

- **Answer:** On the attorney's PC only tool id, latency bucket, error
  class/`_tag`, version, counts, and coarsened process CPU/RSS leave the
  machine. Enforcement is a per-tier Effect Schema allowlist at the exporter
  boundary (decode-or-drop over every serialized OTLP record), not collector
  redaction. Correlation ids are HMAC'd with a salt that never leaves the PC.
- **Rationale:** the in-process fence is the only layer a misconfigured
  collector cannot undo; the collector `redaction` processor is beta/alpha
  and only scrubs data already off-box
  ([`research/handoff/privacy_tiered_telemetry.md`](./research/handoff/privacy_tiered_telemetry.md)).

### D3 — Tier authority is Tailscale node identity + ACL tag

- **Answer:** The hub ingress resolves the peer with `whois`;
  `tag:privileged` hosts reach only the strict-tier ingress; a batch that
  does not decode under the host's tier is refused with a 4xx and counted.
  No per-host signing keys.

### D4 — Every harness emits and consumes

- **Answer:** All providers land attributed spans/metrics in one pipeline and
  read the Palantiri through a repo-owned observability MCP server plus an
  equivalent `beep …` CLI with JSON output.

### D5 — Quota is telemetry

- **Answer:** `beep accounts` polling becomes a pipeline signal and a parcel.

### D6 — Dev tooling scope

- **Answer:** Local dev loop + repo tooling emitting telemetry + CI/Turborepo
  telemetry + WebStorm integration (lowest priority; research only unless
  cheap).

### D7 — Packet lineage

- **Answer:** Umbrella exploration. Inherits the `beep.*` attribute contract
  from
  [`goals/harness-otel-adoption/research/p0-attribute-contract.md`](../../goals/harness-otel-adoption/research/p0-attribute-contract.md)
  as the join key; cites `goals/ai-metrics-stack`,
  `goals/ai-metrics-raw-retention`, `goals/turborepo-cache-trust-observability`,
  `explorations/context-rent-telemetry`, `explorations/ci-hang-observability`
  as lineage. Spawned goals may depend on those packets and never rewrite
  them.

### D8 — Deliverable

- **Answer:** This exploration graduated into 3–6 goal packets with a
  `MAP.md` — not a mega goal, not a report.

### D9 — Money escalates, nothing else

- **Answer:** Vercel drains (Pro-only, metered), Grafana Cloud above the free
  tier, Tailscale paid tiers, any SaaS backend: surfaced as questions, never
  bought.

## 2026-10-14 — Fleet scope: `tbk-ubuntu` gated, not enrolled

**Question:** Is `tbk-ubuntu` (an operator-owned, untagged Linux node seen in
`tailscale status`) part of the Palantiri fleet or a hub candidate?

**Answer:** Not now. `tbk-ubuntu` is out of every current goal: not an
emitter, not a hub candidate, not the "incoming box". It is a **gated future
host**: the operator is building an isolated, security-sensitive VM on it,
and the box (with its spare compute) joins the fleet only after that
isolation work is finished and the operator says so.

**Rationale:** Operator ruling during the research round. Constraints the
re-entry inherits: the sensitive VM is never instrumented, scraped, or
reachable from the Palantiri; only the host (or a separate compute VM)
enrolls; enrollment follows the same "fully enrolled" gate as any hub host
plus an operator-run isolation review. The incoming-box question narrows to
`ai` (still UNVERIFIED) and is carried to align.

## 2026-10-14 — Align round 1: the attorney's PC

**Question:** Which Windows node is the attorney's working PC (the strict
shape-only tier)? Research saw `tom-pc` (second tailnet user) and `tom-pc-1`
(operator-owned).

**Answer:** `tom-pc-1` is the attorney's workstation and carries the strict
tier. `tom-pc` was a stale node; the operator removed it from the tailnet on
2026-10-14.

**Rationale:** Operator ruling, confirmed from the Tailscale admin console.
Follow-ups this surfaces:
- The console shows `tom-pc-1` with **Funnel** status. A public Funnel on the
  strict-tier machine contradicts D2/D3's posture; the fleet goal must
  inventory what it exposes and propose disabling it (proposal only — no
  host or ACL mutation during the exploration).
- `tom-pc-1` is operator-owned and untagged, so under any tag model its tier
  must be set deliberately (see the tier-tag question).
- With `tom-pc` gone, the "lenient family PC" in CAPTURE §1 has no current
  node; the lenient Windows tier stays defined but unpopulated until one
  enrolls.

## 2026-10-14 — Align round 1 (continued)

### Q: Is `tom-pc` removal correct?

- **Answer:** Yes. `tom-pc` was the attorney's old Windows 10 workstation;
  that hardware has since been repurposed as `beep-worker`, so the old node
  entry was stale. `tom-pc-1` (Windows 11) is the current workstation.
- **Rationale:** Operator recollection plus the console (OS Windows 10 vs
  Windows 11). Side fact for the hub gate: `beep-worker` is the former
  attorney desktop, so its specs come from that box; still UNVERIFIED until
  read on the host.

### Q: What does shape-only mean on `tom-pc-1`?

- **Answer:** Spans are allowed but scrubbed. The gate emits shape-only
  spans (tool id from a closed enum, duration bucket, error `_tag`, version,
  counts) alongside metrics. Everything else on a span is rebuilt from
  constants, not filtered from input.
- **Rationale:** Operator chose trace views over the smallest surface. The
  research recommendation (metrics-only, spans folded into histograms) was
  rejected. Constraints this leaves the strict-tier goal: span names come only
  from the tool enum, never from code paths; timestamps are rounded to the
  export window; trace/span ids are regenerated per export batch or HMAC'd
  with the on-PC salt so they cannot link across batches; span events,
  links, status messages and log bodies are always dropped; `telemetry_refused_total`
  counts every drop.

### Q: Tier tags — keep `tag:privileged` or invert?

- **Answer:** Invert D3. The looser tiers carry tags; an untagged node or
  any failure to read the tag means shape-only, on the PC and at the hub.
- **Rationale:** Tailscale omits the tag field on untagged nodes, so the
  original model failed open when a tag was missing. The inversion fails
  closed. It refines D3's mechanism, not its authority (still Tailscale node
  identity, resolved with `whois` at the hub).

### Q: Where do the Palantiri MCP server and CLI live?

- **Answer:** Parcel schemas in `packages/tooling/library/palantiri/**`; the MCP
  host in `packages/tooling/tool/palantiri-mcp/**` on the `@beep/mcp-kit`
  pattern; a `beep palantiri` CLI command group. `@beep/observability`
  splits its kernel (signal schemas, `TelemetryTier`, the tier gate) from its
  `/server` wiring. Backend query adapters (Prometheus, Tempo, Loki, Phoenix)
  go in `packages/drivers/*`.
- **Rationale:** Follows `07-non-slice-families.md` routing (repo ops →
  tooling, external engines → drivers, runtime substrate → capability) and
  keeps developer-AI semantics out of `@beep/observability`. Rejected:
  an `apps/palantiri/**` runnable (labs cannot publish reusable APIs) and folding
  everything into `@beep/observability` (mixes repo-ops parcels into runtime
  substrate).

### Q: The Funnel on `tom-pc-1`

- **Answer:** Not an active exposure as far as can be seen; a **policy
  grant**. The console's "Funnel" badge marks nodes the tailnet policy allows
  to use Funnel (the `funnel` node attribute, which Tailscale's default
  policy grants to every member device), not nodes currently publishing.
  `dankstation` carries the same grant (`funnel` plus
  `funnel-ports=443,8443,10000` in its own capability map), yet
  `tailscale funnel status` there lists only "tailnet only" (Serve) routes and
  no public ones. Funnel publishes a local service to the public internet at
  the node's `*.ts.net` name; Serve is the tailnet-only form.
- **Rationale / follow-up:** What `tom-pc-1` itself serves is still
  unchecked (it was offline). The fleet goal carries two items, proposal-only:
  narrow the `funnel` node attribute in the tailnet policy to the hosts that
  need it (none of the strict tier), and add "no Funnel grant on a
  strict-tier host" to the enrollment gate. The public ingress Vercel needs
  (D9 money question) is decided separately and lands on a hub host, never on
  the attorney's PC.

## 2026-10-14 — Align round 2

### Q: Which hosts are hub candidates for the D1 gate?

- **Answer:** `beep-worker` (the former attorney Windows desktop, now
  Ubuntu) and a further Linux box that is incoming but not on the tailnet
  yet. The store decision stays deferred. `ai` is not named as the incoming
  box and stays unexplained (not a candidate until the operator says so).
- **Rationale:** Operator ruling. The D1 MAP gate fires when `beep-worker`
  and the incoming box both pass the "fully enrolled" checklist
  ([`research/fleet-and-hub.md`](./research/fleet-and-hub.md) §3); the
  incoming box is named TBD until it joins.

### Q: How does web-app telemetry get home? (D9 money question)

- **Answer:** Wait. No spend now: `@vercel/otel` owns the provider and
  exports in-function to a free target or nowhere; Vercel drains and the
  public ingress are a later, gated goal.
- **Rationale:** Operator ruling. Rejected for now: Grafana Cloud free tier
  (second store), a paid public relay, Vercel Pro drains.

### Q: Does the attorney review the shape-only field list before the first export?

- **Answer:** No review gate. `tom-pc-1` exports once the strict-tier tests
  pass.
- **Rationale:** Operator ruling; the shape-only gate, canary tests and
  golden allowlist are the proof. The research recommendation (review via
  the lawyer-facing surface, since no ethics opinion covers telemetry
  metadata) was rejected. The weekly privacy receipt stays in scope as an
  operator-facing artifact the attorney can read on request.

### Q: Span naming doctrine → instrumentation naming contract

- **Answer (revised the same day):** Not just "ratify `Concept.action`". The
  Palantiri gets a **schema-typed instrumentation catalog** in the kernel
  goal, covering six axes:
  1. *Span identity* = (owning package, span name). `Concept.action`
     stays the domain-span form; `beep.package` (and `beep.slice` where one
     exists) is a required attribute, because Effect's OTLP tracer hard-codes
     the instrumentation scope to `"effect"`
     (`~/YeeBois/references/effect/effect/packages/effect/src/observability/OtlpTracer.ts:70`);
     the kernel's custom serializer may also stamp the real scope.
  2. *Protocol spans* follow OTel semconv (`GET /route`, `gen_ai.*`,
     `mcp.method.name`), not `Concept.action`.
  3. *Metric names*: lowercase dotted `beep.<area>.<noun>`, a declared unit,
     suffixes added by the exporter, never hand-written.
  4. *Log/event names*: closed event names with structured fields; message
     text is never identity.
  5. *Attribute registry*: one Weaver-style registry (key, type, allowed
     signals, cardinality class, lowest tier allowed) from which the `beep.*`
     v2 contract, the metric-safe/span-only split and the shape-only
     allowlist are generated.
  6. *Static names*: names are compile-time literals, never interpolated;
     enforced by lint and by the tier gate (a name built from input is a
     leak path).
  `standards/architecture/12-observability.md` is regenerated from the
  catalog to match; no mass codemod of existing span names.
- **Rationale:** Operator challenged the first answer as too narrow and
  accepted the six-axis contract. `Concept.action` alone leaves identity
  ambiguous across packages and says nothing about metrics, events,
  attributes or protocol spans. Rejected: codemodding ~3,800 names to
  `<slice>.<concept>.<action>`; a separate naming goal (kept inside the
  kernel goal instead).

### Amendment: families and hosts (same day, after the survey)

The operator asked whether one convention fits drivers, labs, web apps and
hosts that differ. The survey
([`research/naming-and-identity-survey.md`](./research/naming-and-identity-survey.md))
splits the question into three. Each gets its own home:

- **What happened → the name. Context-free and family-agnostic.**
  - Domain spans in every family (slice, driver, tooling, lab, app) use
    `Concept(.Sub)*.action`.
  - Names are globally unique and enforced by the catalog lint. The 4 shared
    names get renamed; `db.query`-style adapter spans follow semconv instead.
  - Names are never interpolated. The 19 interpolated sites move their
    variable part into an enum attribute.
  - Drivers name the operation (`Box.listFolder`) and get semconv HTTP client
    spans underneath for free. Web apps get semconv HTTP spans from
    `@vercel/otel`, and server actions are `Concept.action`. Browser spans are
    semconv only.
- **Which code emitted it → enrichment, not call sites.** The catalog maps
  each name to its package. `beep.package` and `beep.family` are derived from
  that map, not stamped by hand.
  - `beep.family` is a LiteralKit: `slice | foundation | driver | tooling |
    ecosystem | app | lab`. It is stamped at export or at the gateway, so
    3,900 call sites need no change.
  - Labs keep the same law, but `beep.family = lab` keeps them out of fleet
    SLO views by default.
- **Where it ran, and who vouches → a resource union.** `EmitterContext` is
  a tagged union: `Workstation | Server | StrictDesktop | CiRunner | CloudVm |
  Serverless | Browser`. Each variant has its own required semconv fields
  (`host.name` only for tailnet hosts; `cicd.*` for CI; `cloud.*`/`faas.*` for
  serverless; `browser.*` for browsers). Each variant also has a tier ceiling.
  - `beep.identity_source = vouched | self_claimed` is part of the union.
  - For tailnet senders, the gateway overwrites `host.name` from `whois`.
    `StrictDesktop` sends no host identity at all.
- **Metrics:** one instrument per concept, with a bounded `outcome` attribute.
  The four `desktop_*_{started,completed,failed,interrupted}_total` families
  become one. Hand-written `_total` suffixes go.
- **Events:** catalog event names for the error and decision paths. The
  other `Effect.log*` sites (223 today) stay plain logs.
- **Gap kept open as a rabbit hole:** vendor cloud VMs cannot reach the
  tailnet. Their records are self-claimed and need a path home (spool + CI
  artifact, or nothing). Until then, parcels mark them `Unknown{unreachable}`.

## 2026-10-14 — Agent-decided under the autonomy charter

The operator reviews these asynchronously; each records how to reverse it.

### Logs store shortlist for the deferred bake-off

- **Decision:** Loki vs VictoriaLogs only, both Grafana-readable, so no
  dashboard rewrite whichever wins. ClickHouse shapes (SigNoz/ClickStack)
  are out unless the hub box has ≥ 8 GB spare.
- **Reverse:** reopen in the hub goal's bake-off plan.

### Parcel-gated yeet actions

- **Decision:** Later unlock, not in the first goals. The parcels goal ships
  read-only parcels first; gating yeet actions on a Fresh parcel receipt is a
  MAP re-entry point once agents have consumed parcels for two weeks.
- **Reverse:** promote the re-entry into the parcels goal's plan.

### WebStorm

- **Decision:** Research-only (D6 lowest priority): a short note in the
  dev-tooling goal, no integration code unless it proves to be a run-config
  file.
- **Reverse:** add a phase to the web/CI goal.

### `beep.*` v2 attribute-name collision

- **Decision:** The model-manifest role is `beep.model_role`; the privacy
  tier is `beep.privacy_tier` (`shape-only | standard | dev-verbose`, the
  `TelemetryTier` LiteralKit). No bare `beep.tier`.
- **Reverse:** rename in the contract-v2 schema before it ships.

### Open OTLP ingest on dankserver `:8448`

- **Decision:** The fleet goal proposes closing it before any strict-tier
  host can reach the hub: bring the Serve routes under Ansible, put the
  ingest behind the tier-aware gateway (D3 `whois` check), and grant OTLP
  ports by tag. Proposal only; the operator applies it.
- **Reverse:** none needed; it is a proposal.
