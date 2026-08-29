# S1 — Graphiti Provenance / License Inventory

**Date:** 2026-07-25
**Spike:** P0 / S1 of `goals/epistemic-bitemporal-edge-core`
**Contract:** `ops/handoffs/p0-spike-contract.md` § "S1 — Provenance/license inventory"
**Donor under inventory:** `getzep/graphiti` (Apache-2.0)

## Verdict

**PASS.** The donor license is unchanged (Apache-2.0), there is no root `NOTICE`
file so the §4(d) reproduction duty does not attach, all three mined contract
locations are still present at their originally mined line ranges with zero
drift, and every remaining Apache-2.0 duty (§4(a) license copy, §4(b) copyright
retention, §4(c) modified-file marking) is dischargeable with artifacts this
repo already knows how to produce. No stop condition fired. Porting may proceed
into P1 once the drafted `THIRD_PARTY_NOTICES.md` section below is actually
landed.

One honest caveat, recorded rather than buried: the donor's `LICENSE` is not
byte-identical to the canonical Apache Software Foundation text. The deviation
is a single clause in §6 (Trademarks) and is discussed under "License
verification" — it does not touch any duty this repo owes.

## Live donor revision

| Item | Value |
| --- | --- |
| Repository | <https://github.com/getzep/graphiti> |
| Default branch | `main` |
| Default-branch HEAD SHA | `448e57c5841f418f2a90586e53b11f7280f367a8` |
| HEAD commit date (UTC) | 2026-07-25T14:53:59Z |
| HEAD commit subject | `@vvivekranjan has signed the CLA in getzep/graphiti#1673` |
| Latest published release | `v0.29.2` ("v0.29.2 - FalkorDB Bug Fixes"), 2026-06-08 |
| Release tag commit SHA | `ff7e29ccd127d8d9721b5cbb2163a6407ef915fe` |
| `pyproject.toml` version at HEAD | `0.29.2` |
| `pyproject.toml` license field | `Apache-2.0` |

Newer *tags* exist that are not published releases: `v0.30.0pre1` through
`v0.30.0pre5` (`v0.30.0pre5` = `f2c4c973625686b8af5b1b1b947ab548c8048846`).
The latest non-prerelease release remains `v0.29.2`, which is exactly the
revision the exploration pinned. HEAD is ahead of the `v0.29.2` tag, but the
package version on `main` has not been bumped past `0.29.2`.

**Recommended pin for the notices entry:** tag `v0.29.2` at commit
`ff7e29ccd127d8d9721b5cbb2163a6407ef915fe`. It is a stable published release,
it matches the exploration's research point, and — as proved below — the three
files we port from are byte-identical between that tag and today's `main`, so
pinning the tag costs no fidelity.

## Inventory table

| Item | Expected (prior research) | Live (2026-07-25) | Status |
| --- | --- | --- | --- |
| License | Apache-2.0 | Apache-2.0 (`LICENSE`, 201 lines) | PASS |
| Root `NOTICE` | unknown | **ABSENT** (repo-wide `find -iname 'NOTICE*'` = 0) | PASS (no §4(d) duty) |
| Version pin | v0.29.2 | v0.29.2 still latest release; `main` still `0.29.2` | PASS |
| `edges.py` temporal fields | `graphiti_core/edges.py:263-285` | `graphiti_core/edges.py:263-285` | PASS — no drift |
| `nodes.py` episode lineage | `graphiti_core/nodes.py:318-351` | `graphiti_core/nodes.py:318-351` | PASS — no drift |
| Invalidate-don't-delete | `.../edge_operations.py:538-847` | `.../edge_operations.py:538-847` | PASS — no drift |
| Donor runtime dependency | must be none | none (0 dep entries, 0 `bun.lock` hits) | PASS |
| Copyright holder | unknown | `Zep Software, Inc.` (2024 and 2025 headers) | PASS |

The packet's own warning that the mined locations "may have drifted" turned out
to be unnecessary this cycle: not only do the line ranges still land on the
right constructs, the three files are byte-for-byte identical between the
`v0.29.2` tag and the current `main` HEAD. Verified by fetching each file from
`raw.githubusercontent.com` at `v0.29.2` and diffing against the shallow clone —
all three diffs were empty. Live SHA-256 of the ported-from files, recorded so a
future cycle can detect drift without re-diffing:

```
0151d72ebfb057033c6d52a163e22f252f67b915722e14315b685c7831b3b1c6  graphiti_core/edges.py
529eb74b7c93e7551f6287b1a7bf6818d31fd045623b3260967dad573e4d801c  graphiti_core/nodes.py
b773ff4489968af2a996d5074e679cab9806cc0904a7ff9f2aecc74382325abe  graphiti_core/utils/maintenance/edge_operations.py
2825300b20d7b951209835a4a331f29e24725a39d65168e4b831df53aa372650  LICENSE
```

## License verification

`LICENSE` at the live revision is the Apache License 2.0. First lines:

```
                                 Apache License
                           Version 2.0, January 2004
                        http://www.apache.org/licenses/

   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION
```

The appendix boilerplate at the end of the file is left unfilled
(`Copyright [yyyy] [name of copyright owner]`), which is normal; the actual
copyright attribution lives in per-file headers.

**Deviation from canonical text.** Whitespace-normalized comparison against
<https://www.apache.org/licenses/LICENSE-2.0.txt> shows one substantive
difference, in §6 (Trademarks) at `LICENSE:138-141`:

```
   6. Trademarks. This License does not grant permission to use the trade
      names, trademarks, service marks, or product names of the Licensor,
      except as required for describing the origin of the Work and
      reproducing the content of the NOTICE file.
```

Canonical §6 reads "except as required for reasonable and customary use in
describing the origin of the Work…". The donor's copy drops "reasonable and
customary use in". This narrows (very slightly) the *trademark* carve-out and
touches nothing in §4, which is where all of this repo's reproduction and
marking duties live. It is recorded here for completeness, and because if we
vendor a copy of the donor's license text we should vendor *their* file rather
than a canonical download, so the copy we redistribute is the copy they granted
under.

**NOTICE file: ABSENT.** Neither `ls` of the repository root nor a repo-wide
`find . -iname 'NOTICE*'` (excluding `.git`) returned any match. Apache-2.0
§4(d) — the duty to reproduce attribution notices from a `NOTICE` file — is
conditional on the donor shipping one ("If the Work includes a `NOTICE` text
file…"). It does not attach here. This is the single most consequential finding
for effort: our attribution obligation reduces to §4(a) (ship a copy of the
license), §4(b) (retain copyright/patent/attribution notices present in the
source we take from), and §4(c) (carry prominent "You changed this" notices in
modified files).

**Copyright notices to retain (§4(b)).** All three source files we port from
carry the same header:

```
Copyright 2024, Zep Software, Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
```

Elsewhere in `graphiti_core/` a second variant appears, `Copyright 2025, Zep
Software, Inc.`. The notices entry should attribute **Zep Software, Inc. (2024,
2025)** to cover both.

## Re-cited contract locations

### 1. Temporal edge fields — `graphiti_core/edges.py:263-285`

Unchanged range. `EntityEdge` extends a base `Edge` that supplies `uuid`,
`group_id`, `source_node_uuid`, `target_node_uuid`, and `created_at`
(`edges.py:49-54`). The temporal axis fields:

```python
    expired_at: datetime | None = Field(
        default=None, description='datetime of when the node was invalidated'
    )
    valid_at: datetime | None = Field(
        default=None, description='datetime of when the fact became true'
    )
    invalid_at: datetime | None = Field(
        default=None, description='datetime of when the fact stopped being true'
    )
```

Two observations that matter for our port. First, all three temporal fields are
*nullable with a `None` default* — the donor treats "unknown valid_at" as a
first-class state, and its invalidation logic (below) then explicitly skips
edges whose `valid_at` is null. Our ratified contract uses half-open
`[validFrom, validTo)` with `Option` open ends, so the donor's null-`valid_at`
edges map to "unknown lower bound", not to "valid since the beginning of time";
that distinction needs a fixture.

Second, `reference_time` at `edges.py:280-282` ("reference timestamp from the
episode that produced this edge") is a *third* time-ish field beyond the two
axes, carrying the producing episode's timestamp onto the edge. It is present
at `v0.29.2` as well. It is not a bitemporal axis and should not be modeled as
one; if we want it, it belongs with lineage, not with validity.

`EntityEdge.save` persists all of `created_at`, `expired_at`, `valid_at`,
`invalid_at`, `reference_time` (`edges.py:342-356`), confirming both axes are
durable columns rather than derived values.

### 2. Episode lineage shape — `graphiti_core/nodes.py:318-351`

Unchanged range. The class body and the fields that constitute lineage:

```python
class EpisodicNode(Node):
    source: EpisodeType = Field(description='source type')
    source_description: str = Field(description='description of the data source')
    content: str = Field(description='raw episode data')
    valid_at: datetime = Field(
        description='datetime of when the original document was created',
    )
    entity_edges: list[str] = Field(
        description='list of entity edges referenced in this episode',
        default_factory=list,
    )
```

Note the asymmetry against `EntityEdge`: `EpisodicNode.valid_at` is
**non-optional** — an episode always knows when its source document existed —
while `created_at` comes from the base `Node` (`nodes.py:98`) as the record-time
stamp. The lineage link is `entity_edges`, a denormalized list of edge UUIDs
stored on the episode, mirrored back out in the save payload at
`nodes.py:341-351`. That is a graph-store-shaped denormalization; the
Postgres-native port should express the same lineage as a join table rather
than an array column, which is a divergence worth stating explicitly in the
modified-file header when we port this shape.

### 3. Invalidate-don't-delete — `.../edge_operations.py:538-847`

Unchanged range. The range spans `resolve_edge_contradictions` (538-573) through
the end of `resolve_extracted_edge` (…-847). The core of the contract:

```python
        # New edge invalidates edge
        elif (
            edge_valid_at_utc is not None
            and resolved_edge_valid_at_utc is not None
            and edge_valid_at_utc < resolved_edge_valid_at_utc
        ):
            edge.invalid_at = resolved_edge.valid_at
            edge.expired_at = edge.expired_at if edge.expired_at is not None else utc_now()
            invalidated_edges.append(edge)
```

(`edge_operations.py:563-571`.) The superseded edge is *mutated and returned*,
never deleted; `resolve_edge_contradictions` returns the list of invalidated
edges, and the caller in `graphiti.py:1156` folds them straight back into the
persistence set:

```python
                entity_edges = resolved_edges + invalidated_edges
```

So "invalidate, don't delete" is enforced structurally: the invalidated edges
travel the same save path as the freshly resolved ones. There is no delete call
anywhere in the supersession path.

## Supersession gotcha (load-bearing for S3/S5 fixtures)

**Confirmed.** Graphiti closes the superseded edge's **valid-time** axis at the
*invalidating fact's* `valid_at`, not at ingestion time; ingestion time is
stamped only on the **transaction** axis. The two assignments sit on adjacent
lines at `graphiti_core/utils/maintenance/edge_operations.py:569-570`:

```python
            edge.invalid_at = resolved_edge.valid_at
            edge.expired_at = edge.expired_at if edge.expired_at is not None else utc_now()
```

`invalid_at` (valid-time upper bound) takes the *new* edge's `valid_at`.
`expired_at` (transaction-time upper bound) takes `utc_now()`. This is the
correct bitemporal behavior and it is easy to get wrong in a port — the naive
implementation stamps `now` on both axes and silently destroys the ability to
answer "what did we believe was true *as of last Tuesday*". Our
`asOf(validAt, knownAt)` predicate depends on these being independent.

Note the guard `edge.expired_at if edge.expired_at is not None else utc_now()`:
transaction-time close is **idempotent**. An already-expired edge keeps its
original `expired_at`. Re-running supersession must not re-stamp the record
axis. That is a direct fixture requirement for the S5 concurrency lane, where
two racing supersessions could otherwise both stamp `expired_at`.

Three further behaviors from the same region, each of which should become a
named fixture:

**Null valid-time is skipped, not defaulted.** The invalidation branch requires
both `edge_valid_at_utc is not None` and `resolved_edge_valid_at_utc is not
None`. An edge with unknown `valid_at` is never invalidated by this path. A port
that treats a null lower bound as "-infinity" would invalidate edges the donor
leaves alone. Our `Option`-typed open ends make this a decision we must take
deliberately rather than inherit.

**Disjoint intervals are no-ops.** The first branch (`edge_operations.py:553-562`)
`continue`s when the existing edge's `invalid_at <= new edge's valid_at`, or the
new edge's `invalid_at <= existing edge's valid_at` — i.e. when the two validity
intervals do not overlap, nothing is invalidated. This is exactly the half-open
`[validFrom, validTo)` non-overlap test, and it confirms the donor's intervals
are half-open at the upper end (`<=` on the boundary means touching intervals do
not conflict).

**Out-of-order ingestion can expire the *new* edge at birth.** At
`edge_operations.py:820-839`, before contradictions are resolved:

```python
    now = utc_now()

    if resolved_edge.invalid_at and not resolved_edge.expired_at:
        resolved_edge.expired_at = now

    # Determine if the new_edge needs to be expired
    if resolved_edge.expired_at is None:
        invalidation_candidates.sort(key=lambda c: (c.valid_at is None, ensure_utc(c.valid_at)))
        for candidate in invalidation_candidates:
            ...
            if (
                candidate_valid_at_utc is not None
                and resolved_edge_valid_at_utc is not None
                and candidate_valid_at_utc > resolved_edge_valid_at_utc
            ):
                # Expire new edge since we have information about more recent events
                resolved_edge.invalid_at = candidate.valid_at
                resolved_edge.expired_at = now
                break
```

When a *retroactive* fact arrives — one whose `valid_at` predates an existing
edge — the donor does not invalidate the newer existing edge. It writes the
incoming edge already-superseded: `invalid_at` set to the existing edge's
`valid_at`, `expired_at` set to `now`. The record is still inserted, preserving
the "we learned this on day N" fact on the transaction axis while keeping the
valid-time picture correct. Our S3/S5 supersession fixtures need this case
explicitly; it is the one that distinguishes a real bitemporal store from an
append-with-tombstones store.

## Drafted `THIRD_PARTY_NOTICES.md` section

Drafted here only — `THIRD_PARTY_NOTICES.md` is **not** edited by this spike.
The edit lands in P1 alongside the first ported file. Shape mirrors the existing
Free Law Project section (upstream repo → pinned release → pinned commit →
affected material → copyright → license terms).

```markdown
## Zep Software, Inc. (Graphiti) — Apache-2.0 material

Upstream repository:

- graphiti: <https://github.com/getzep/graphiti>
  - Pinned release: `v0.29.2`
  - Pinned commit: [`ff7e29ccd127d8d9721b5cbb2163a6407ef915fe`](https://github.com/getzep/graphiti/commit/ff7e29ccd127d8d9721b5cbb2163a6407ef915fe)
  - Provenance inventory revision: default branch `main` at
    `448e57c5841f418f2a90586e53b11f7280f367a8` (2026-07-25); the files below are
    byte-identical between that revision and the pinned release.
  - Affected material: bitemporal edge temporal-field semantics (valid-time
    `valid_at`/`invalid_at` and transaction-time `created_at`/`expired_at`
    axes), the invalidate-don't-delete supersession contract (valid-time closes
    at the invalidating fact's valid time while only the transaction axis is
    stamped at ingestion), and the episode lineage shape linking episodes to the
    entity edges they produced.
  - Upstream locations consulted: `graphiti_core/edges.py:263-285`,
    `graphiti_core/nodes.py:318-351`,
    `graphiti_core/utils/maintenance/edge_operations.py:538-847`.
  - Form of use: **behavioral reimplementation in Effect/TypeScript against
    Postgres.** No Python source is copied, vendored, or redistributed; the
    donor is not a build-time or runtime dependency of this project. Storage
    shape, transaction boundaries, identity model, and error handling are
    this project's own and diverge from the donor.
  - Upstream ships no root `NOTICE` file at the pinned revision, so no
    Apache-2.0 §4(d) attribution-notice reproduction applies.

Copyright 2024, 2025 Zep Software, Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

A full copy of the Apache License, Version 2.0 is included at
[`licenses/Apache-2.0.txt`](./licenses/Apache-2.0.txt).
```

### Modified-file marking plan (§4(c))

Apache-2.0 §4(c) requires derivative files to "carry prominent notices stating
that You changed the files". Every beep file whose design is derived from the
Graphiti contracts above carries a header comment immediately after the file's
JSDoc module block:

```ts
/**
 * Derived from Graphiti (https://github.com/getzep/graphiti), v0.29.2,
 * commit ff7e29ccd127d8d9721b5cbb2163a6407ef915fe.
 * Copyright 2024, 2025 Zep Software, Inc. Licensed under the Apache License,
 * Version 2.0. See THIRD_PARTY_NOTICES.md.
 *
 * Modified: reimplemented in Effect/TypeScript over Postgres; no upstream
 * source was copied. <one line naming this file's specific divergence>
 */
```

The final line is per-file and must be written, not templated — e.g. for the
lineage port, "episode→edge lineage is a join table rather than the donor's
denormalized `entity_edges` array"; for the supersession port, "supersession is
a single serializable transaction rather than a caller-assembled save list".

Expected carriers (to be confirmed as P1 lands them): the edge domain model
carrying the two temporal axes, the supersession use case, and the episode
lineage table/model. Files that merely *consume* these models do not need the
header — the duty attaches to derivative works, not to their callers.

### §4(a) license-copy discharge

The repository does not currently vendor an Apache-2.0 text (the only bundled
license text is the BSD 2-Clause reproduced inline for Free Law Project).
Recommendation for P1: add `licenses/Apache-2.0.txt` containing **the donor's
own `LICENSE` file verbatim** (SHA-256 `2825300b…a372650`), not a fresh download
from apache.org, since the donor's copy differs from canonical text in §6 and
the copy we redistribute should be the copy the grant was made under. The
drafted notices entry above already links that path.

## No-runtime-dependency proof

Dependency-scoped scan across every `package.json` in the repo (excluding
`node_modules`), checking `dependencies`, `devDependencies`,
`peerDependencies`, `optionalDependencies`, `trustedDependencies`, `overrides`,
and `resolutions` for any key or version string matching `/graphiti/i`:

```
$ for f in $(find . -name package.json -not -path '*/node_modules/*' -not -path './.git/*'); do
    bun -e '...scan dep fields for /graphiti/i...' "$f"; done
(no output — zero dependency entries matching graphiti)

$ rg -ic "graphiti" bun.lock
0 hits in bun.lock

$ rg -i "graphiti[-_]core" --glob '**/package.json' --glob 'bun.lock' .
0 hits
```

A naive `rg -i "graphiti"` over `package.json` files is **not** zero-hit and
should not be cited as the proof. It returns repo-native script names
(`graphiti:proxy`, `graphiti:verify`, `graphiti:recover`, `graphiti:restore` in
the root `package.json`) and an export path
(`./commands/Graphiti` in `packages/tooling/tool/cli/package.json`). Those are
this repo's own CLI surface for operating the local, write-frozen
`graphiti-memory` MCP server — they are process-level tooling, not a package
dependency, and they pull no donor code into any build or runtime. The
dependency-scoped scan above is the load-bearing proof.

Python manifests were checked too: the only in-repo `pyproject.toml` is
`tools/skillopt/pyproject.toml`, with zero `graphiti` hits. (`find` also
surfaced copies under `.claude/worktrees/*`, which are transient worktrees of
this same repo, not separate manifests.)

For completeness on the other direction: the donor itself declares
`falkordb`, `kuzu`, `neo4j`, and various LLM clients as dependencies or optional
extras in its `pyproject.toml`. Because we take no donor dependency, none of
that transitive surface — including the SSPL-licensed FalkorDB extra — enters
this repository.

## Deferrals and exclusions (unchanged by this inventory)

**agentmemory (`rohitg00/agentmemory`, Apache-2.0) — deferred, untouched.** The
exploration mined `src/types.ts:411-435` (never-overwrite bitemporal `GraphEdge`)
and `src/functions/retention.ts:81-95` (retention scoring). Ratified sourcing
Decision 1 makes Graphiti the sole attributed donor for this core and defers
agentmemory adoption to a separately shaped retention goal. This inventory
confirms the deferral holds: this goal copies no retention constants, no tier
definitions, no decay behavior, no relation-confidence math, and adds no
agentmemory dependency. No agentmemory entry is drafted for
`THIRD_PARTY_NOTICES.md`, and none should be added until a goal actually adopts
the algorithm — attributing an unused donor is noise that later readers must
disprove.

**FalkorDB (SSPL) — excluded.** Not a dependency, not a projection engine, not
authorized. It appears only as an optional extra of the donor's own package,
which we never install.

**mike (AGPL-3.0) — excluded.** Recorded in the exploration as clean-room-only
(spec-first, no transcription) and explicitly not clean-roomed for this goal,
because this repo already owns the candidate-edit/version-lineage capability.
Nothing in this spike touches it.

**courtlistener (AGPL-3.0) — reference only.** The `DocketSources` additive
bitmask provenance idea remains a P3 reference with a clean-room requirement.
Out of scope here.

## How this was gathered

Shallow clone into the session scratchpad (no repo pollution; the clone is
session-scoped and is not checked in):

```
git clone --depth 1 https://github.com/getzep/graphiti \
  "$SCRATCH/graphiti-clone"
git -C "$SCRATCH/graphiti-clone" log -1 \
  --format='sha=%H%ncommitdate=%cI%nsubject=%s'
git -C "$SCRATCH/graphiti-clone" rev-parse --abbrev-ref HEAD
```

Release and tag metadata via the GitHub API (cheaper than a tag fetch):

```
curl -sS https://api.github.com/repos/getzep/graphiti/releases/latest
curl -sS "https://api.github.com/repos/getzep/graphiti/tags?per_page=5"
curl -sS https://api.github.com/repos/getzep/graphiti/git/ref/tags/v0.29.2
curl -sS "https://api.github.com/repos/getzep/graphiti/releases?per_page=3"
```

License and NOTICE:

```
head -20 LICENSE ; wc -l LICENSE ; tail -15 LICENSE
find . -iname 'NOTICE*' -not -path './.git/*'
curl -sSL https://www.apache.org/licenses/LICENSE-2.0.txt -o apache-2.0.txt
diff <(sed 's/[[:space:]]*$//' LICENSE) <(sed 's/[[:space:]]*$//' apache-2.0.txt)
rg -oI "Copyright [0-9]{4}[^\n]*" graphiti_core/ | sort -u
```

Contract re-location and drift check (fetch each file at the pinned tag, diff
against the live clone):

```
grep -n '^class \|valid_at\|invalid_at\|expired_at' graphiti_core/edges.py
grep -n '^class ' graphiti_core/nodes.py
grep -n '^async def \|^def \|invalid_at\|expired_at' \
  graphiti_core/utils/maintenance/edge_operations.py
curl -sSL "https://raw.githubusercontent.com/getzep/graphiti/v0.29.2/<path>"
diff v0292/<file> graphiti-clone/<path>        # all three empty
sha256sum graphiti_core/edges.py graphiti_core/nodes.py \
  graphiti_core/utils/maintenance/edge_operations.py LICENSE
rg -n "invalidated_edges" graphiti_core/
```

Runtime-dependency proof (run from the beep repo root):

```
for f in $(find . -name package.json -not -path '*/node_modules/*' \
  -not -path './.git/*'); do bun -e '<dep-field scan>' "$f"; done
rg -ic "graphiti" bun.lock
rg -i "graphiti[-_]core" --glob '**/package.json' --glob 'bun.lock' .
rg -i "graphiti" tools/skillopt/pyproject.toml
```

Scratchpad root for this session:
`/tmp/claude-1000/-home-elpresidank-YeeBois-projects-beep-effect2/770ac439-bf79-4675-ad0a-fcc881dbc669/scratchpad`
