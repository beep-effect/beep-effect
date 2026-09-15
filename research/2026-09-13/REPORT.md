# REPORT — 2026-09-13

Window 2026-09-12 08:14 → 2026-09-13 08:20 America/Chicago (~24h). Status: **partial** (X search `client-not-enrolled` on every axis, x=0; no Sol/Luna; local `gh` CLI token invalid — GitHub MCP used). 32 claims. Novel-URL collision rate 0.200 against exclusion digest (intentional refute URL re-cites excluded from that gate). selfReject false. Refutation quota: standing law HOLDs (ODP / iManage-TR / Harvey-Everlaw); effect tip still rc.115 / MCP unpublished / Jazz alpha.54 / Evolu 8.10.0 / drizzle / Instant HOLDs; **SEP-2640 Status=Final on PR head (BROKEN+MOVES vs Accepted≠Final) but still OPEN/unmerged**. **Sunday:** weekly consolidation + tombstone reaper (6 items from `research/2026-09-03` unactioned across 09-05/09-10/09-12).

The 2026-09-12 packet (#1123) merged 2026-09-12 ~6:27 PM CT. No open research PR at preflight. Stamp was 2026-09-12T08:14-05:00 / lastSuccessfulPr=1123.

## Delta

### New

- **SEP-2640 Final-on-branch, still unmerged.** Four commits landed on `sep/skills-extension` overnight (tip `582d814a`, ~Sep 12 10:47 PM–12:02 AM CT). Branch Status field reads **Final**; PR `draft=false`, labels `[SEP, final, extension]`, still OPEN/`mergeable_state=blocked`. Agent Skills backwards-compat MUST/SHOULD added; links retargeted `experimental-ext-skills`→`ext-skills`; declaring skills now requires `resources` capability. Tier-1 SDK/docs gates (go/python/csharp + docs#3353) remain OPEN — Final≠shipped.
- **Effect publish gap unchanged; changeset grew.** npm tip still `effect@4.0.0-rc.115`. `#8201` OPEN (updated Sep 12 19:55Z) stages unpublished rc.116 with `#7265` MCP adapter plus in-window `#8206` (multipart hang) and `#8212` ByteSize canonical integers (source-breaking, MERGED). Kits must not pin MCP until rc.116.
- **Local-first still staged-not-cut.** Jazz `#2748` OPEN (updated Sep 13) stages `jazz-tools@2.0.0-alpha.55` (npm tip alpha.54). Evolu `#708` OPEN; npm `@evolu/common@8.10.0`. Rocicorp Zero `@rocicorp/zero@1.10.0-canary.21` published in-window (canary only; latest 1.9.0).
- **SchemaJIT `#7908`** still draft/OPEN with in-window update Sep 13.
- **IP MCP rising edge on a quiet Sunday press day.** In-window GitHub creates: `patent-kb-connect` (hosted 727k US patent MCP, Sep 12) and `feature-separate-batch-eval-mcp` (cross-patent eval, Sep 13). Novel fabric/competitor captures: Patlytics MCP in Claude+ChatGPT; Otto HUB USPTO docket/IPMS MCP; MoFo firmwide Legora; LawToolBox + Everlaw first-party MCP surfaces reaffirmed.
- **Scanners-as-skills.** `awesome-llm-apps#1167` packages CI skill_scanner as installable `agent-security-auditor`; `awesome-skills-registry#23` ingests BackBond/agent-scan.
- **Standing law HOLDs.** ODP four-field, TR partnership MCP coming-soon, Harvey-Everlaw fall 2026 all still hold on live Sep 13 checks. Weekend arXiv gap (no new MCP/skills/harness listings after Fri Sep 11).

### Moved

- **w-skills-over-mcp / SEP-2640.** Accepted≠Final → **Status=Final on branch**; still not merged. Disk Agent Plugins vs wire SEP-2640 fork remains the packaging decision.
- **w-effect-rc116 / w-effect-mcp-adapter.** `#8201` body MOVES (absorbs `#8206`/`#8212`); tip and npm publish HOLDS.
- **w-jazz-wire-v1.** alpha.55 staged body MOVES (larger patch list Sep 13); tip HOLDS alpha.54.
- **w-schema-jit.** `#7908` updated Sep 13; still draft/experimental.

### Contradicted (broken standing claims)

- **SEP-2640 Accepted not Final — BROKEN (Status field).** PR head `seps/2640-skills-extension.md` reads `Status: Final`. Do **not** equate Final with merge or host GA.

### Settled (refutation quota HOLDS)

- USPTO ODP four-field gate — HOLDS (live Sep 13).
- iManage/TR partnership MCP — HOLDS (coming soon; not GA).
- Harvey-Everlaw MCP — HOLDS (fall 2026 expected; not GA).
- effect tip rc.115 / no npm rc.116 — HOLDS.
- Effect `#7265` MCP on npm — HOLDS unpublished (merged on main only).
- drizzle `#6162` TaggedErrorClass — HOLDS OPEN (no update since Aug 25).
- Instant Cloud sunset 2027-08-31 — HOLDS.
- Jazz alpha tip — HOLDS at `jazz-tools@2.0.0-alpha.54`.
- Evolu `@evolu/common@8.11.0` — HOLDS staged-not-cut.
- MCP `#3306` Enterprise IdP docs — HOLDS OPEN (no update since Sep 1).
- SEP-3004 — HOLDS OPEN (no in-window Final move).

## Weekly consolidation (Sunday)

### Trends (week of 2026-09-05 → 2026-09-13)

1. **Effect v4 MCP toolkit race:** tip moved rc.113→rc.115 mid-week; `#7265` MERGED after the rc.115 cut; publish vehicle `#8201`/rc.116 still OPEN — the dominant engineering watch for beep Effect pins.
2. **Skills-over-MCP finalization without ship:** SEP-2640 Accepted → Status=Final on branch with SDK refs and overnight Finalization commits; host/runtime GA still blocked on merge + Tier-1 SDKs.
3. **Legal AI competitive fabric densifies:** Harvey Contract Review Agents + Guardrails acquisition + $550M raise; Legora firm-wide (Edwin Coe, MoFo); iManage write MCP + Oct platform GA; Everlaw first-party MCP vs partnership fall-2026 clocks; Patlytics/Otto/patent-kb IP MCP surfaces.
4. **Local-first continuity after Instant sunset:** Jazz alpha.54 cut then alpha.55 staged; Evolu 8.11.0 staged; Zero canary channel active — self-host/local-first paths remain the foil.
5. **MCP supply-chain realism:** registry 48.8% initialize (2609.10962), Scanning the Harness, scanners-as-skills packaging — TrustShift-adjacent.

### Tombstone reaper

Reaped **6** suggested actions originating in `research/2026-09-03` that remained unactioned across subsequent packets 2026-09-05, 2026-09-10, and 2026-09-12 (see `research/ledger/tombstones/2026-09-13.jsonl`). Standing refute watches and active watchlist keeps were **not** tombstoned. Resurrection requires evidence post-dating 2026-09-13.

### Weekly digest (one-liner per axis)

- **Law:** Quiet Sunday press; IP MCP GitHub edge + competitor fabric captures; DMS partnership clocks HOLD.
- **Effect:** Tip frozen at rc.115; rc.116 changeset grew; Jazz/Evolu still staged; Zero canary.21.
- **Agents:** SEP-2640 Final-on-branch MOVES; scanners-as-skills; weekend arXiv gap; #3306/#3004 HOLD.

## Intersections with today's repo-replay

No open research PR at preflight (this packet becomes the open PR). Prior packet #1123 on main. Effect `#8201`/rc.116 + MCP adapter publish gap sits on beep Effect pin / MCP toolkit edge. SEP-2640 Final≠merged sits on Agent Plugins vs wire skills packaging. Patlytics MCP + patent-kb sit next to Tom/IP competitor positioning. Scanners-as-skills sits next to TrustShift / harness scanner watches.

## Frictions

- Native X post/news search attempted; returned client-not-enrolled (client_id 29986667). x=0.
- Local `gh` CLI token invalid (401). Remote reads via GitHub MCP. Publisher uses Cursor cloud agent GitHub connection.
- arXiv API flaky on complex boolean; agents axis fell back to HTML day lists (weekend gap confirmed).
- Sol/Luna blinded verify unavailable. Packet stays partial.
- Writer composed from structured sanitized records only.

## Appendix — topical notes

Law: 12 findings. In-window patent MCP creates + novel competitor/fabric URLs; three standing HOLDs.

Effect: 11 findings. Publish gap + staged local-first + Zero canary; SchemaJIT still draft.

Agents: 9 findings. SEP-2640 Finalization MOVES; scanners-as-skills; standing #3306/#3004 HOLD; no weekend arXiv novel.
