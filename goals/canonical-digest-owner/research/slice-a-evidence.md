# Slice A evidence

What slice A ran, on 2026-11-12 at commit `4f1ef2168f9`, and what it found.
The census is [`encoder-census.md`](./encoder-census.md).

## Tests added

| Test | What it holds |
| --- | --- |
| `packages/tooling/tool/cli/test/canonical-digest-owner-differential.test.ts` | The epistemics encoder, PacketCore's `canonicalJsonText` and the `@beep/md` frontmatter encoder emit the owner's bytes on generated plain JSON. A table fixes what each side does with nine inputs that are not plain JSON, and with nesting past the owner's cap. |
| `apps/labs/semantica/test/CanonicalDifferential.test.ts` | The same two tests for the lab encoder, and the committed W1 manifest `corpusHash` recomputed through the owner. |
| `packages/tooling/tool/cli/test/canonical-digest-owner-replay.test.ts` | Every stored packet event digest recomputed through `JsoncFingerprint.hash`, and a property over schema-derived trace entries. |
| `packages/execution-authority/domain/test/ExecutionAuthority.test.ts` (new block) | The four golden seal vectors, a three-link decision chain and a property over every seal the schemas can mint, each recomputed through the owner. |

## Generator

The differential uses `effect/Arbitrary` over `S.Json`. A sample of 400 values
from that arbitrary alone held doubles across the whole range including
subnormals, `__proto__` keys, null-prototype objects and astral strings, and
22 values with an unpaired surrogate, which the owner refuses. The repo-cli
test replaces unpaired surrogates with U+FFFD so every run stays on the domain,
and widens the tree with fixed pools: 20 numbers (negative zero, both ends of
the exponent switch, the smallest and largest doubles, integers around
`2 ** 53`) and 26 strings used as values and as keys (every two-character
escape, C0 controls, U+2028 and U+2029, a precomposed and a decomposed accent,
and U+10000 beside U+E000 and U+FB00, where UTF-16 code-unit order and
code-point order disagree).

The 2026-11-10 probe ran 20,000 values from pools of 14 numbers and 23
strings. The tracked tests run 400 generated values per encoder by default,
more when `BEEP_FC_NUM_RUNS` raises the floor.

## Packet event replay

| Source | Events | Recompute through the owner |
| --- | --- | --- |
| Tree, `goals/*/ops/events/` | 4 | 4 |
| Archive repository `beep-effect/beep-effect-goals-archive` at `6187b837dc1b` | 71 | 71 |
| History only: `goals/firecrawl-driver`, deleted with its packet in pull request 1975 | 1 | 1 |
| PacketCore fixture streams `forked`, `golden-linear`, `risk-override` | 13 | 13 |

The 76 stored events are every event file ever added on `main`: the list of
added paths in history equals the tree plus the archive plus that one deleted
packet. By type they are 66 `packet-created`, 9 `status-set` and 1
`risk-tier-overridden`; the fixture streams add `stage-entered`.

Each event is read the way `PacketEventStore` reads it (parse, upcast, decode,
re-encode). Three things hold for all of them: the owner's digest equals the
digest in the file name, the owner agrees with `packetEventDigest`, and
`renderPacketEventFile` reproduces the stored file byte for byte. The last one
confirms the indented renderer is a view and no digest is taken over it.

All 76 are a snapshot,
`packages/tooling/tool/cli/test/fixtures/canonical-digest-owner/stored-packet-events.jsonl`,
one line per event with its source commit. The four in-tree events are
snapshotted and not read live: the goal-data consumer census
(`packages/tooling/tool/cli/test/goal-data-consumer-census.test.ts`) requires
any test that reads `goals/` to be registered in `ciGoalDataConsumers`, which
puts matching pull requests on the code route. The first push of this slice
read the tree live and failed that census on hosted CI.

After a swap, the tree's own events are also re-verified by the production
read path, which recomputes each digest against its file name.

To refresh the archive lines when the archive grows, from the repository root
with the archive checked out by `bun run beep refs provision`:

```sh
archive=.repos/goals-archive
commit=$(git -C "$archive" rev-parse origin/main)
git -C "$archive" ls-tree -r --name-only "$commit" \
  | grep -E '/ops/events/[0-9]{5}-[a-z-]+-[0-9a-f]{64}\.json$' \
  | LC_ALL=C sort \
  | while read -r path; do
      git -C "$archive" show "$commit:$path" \
        | jq -Rsc --arg path "$path" --arg source "goals-archive@$commit" \
            '{source: $source, path: $path, text: .}'
    done
```

The tree lines come from the same loop over
`git ls-tree -r --name-only <commit> -- goals explorations` in this
repository, with `tree@<commit>` as the source. Keep the history-only line
unchanged, and update the three counts in the replay test.

## Execution-record seals

The seal preimage is a version line, a newline and the canonical JSON of the
wire form. The replay rebuilds the wire form from the public schemas
(`GrantSetDigestInput`, and the record schemas with `hash` removed) and takes
the bytes from the owner, so it does not call the domain's encoder.

- The four golden vectors recompute: two grant-set digests, one decision seal,
  one outcome seal.
- A chain of three decisions, one denied, recomputes link by link.
- Over schema-derived arbitrary decisions, outcomes and grant sets, every
  seal recomputes, except where a free-text field holds an unpaired
  surrogate. There the domain seals the value and the owner refuses with
  `LoneSurrogate`. One fixed case pins that, with the JSON pointer
  `/grants/0/sink/destination`.

## Coercion probe

A measurement, not a tracked test. Each of the three encoders was wrapped,
locally and never committed, so that every call also ran the owner and logged
one of: equal bytes, different bytes, refused only for `undefined` members
(checked by removing them and comparing again), or refused with a code. The
callers' test suites then ran one at a time:

- `packages/foundation/modeling/epistemics`
- `packages/epistemic/{domain,use-cases,tables,server}`
- `packages/execution-authority/{domain,use-cases,tables,server}`
- `apps/labs/semantica`
- 46 repo-cli test files for the Goals, Explore and Skills commands, which
  hold every caller of `canonicalJsonText`

| Encoder | Calls | Equal | `undefined` members only | Unpaired surrogate | Other refusals |
| --- | --- | --- | --- | --- | --- |
| epistemics | 19,351 | 18,283 | 1 | 1,059 | 8 |
| PacketCore | 1,826 | 1,355 | 445 | 18 | 8 |
| semantica | 6,726 | 6,717 | 1 | 2 | 6 |

No call produced bytes that differ from the owner's where the owner emits.
The repo-cli run included the slice A test files, so a few hundred of the
equal calls and all of the "other" refusals are the new tests calling the
encoders directly.

- Every "other refusal" (a non-finite number, a bigint, a `Date`, an
  `undefined` element, nesting past the cap) comes from the slice A table
  tests themselves, as do two of the PacketCore `undefined`-member calls and
  the three single ones.
- The 443 remaining PacketCore `undefined`-member calls are
  `Goals/Completion.ts`: `goalCompletionDeclarationDigest` and the
  declaration comparison pass `packetId` and `proposedCloseout` as
  `undefined` when absent.
- The unpaired surrogates come from schema-derived arbitraries in existing
  property tests: contradiction facts and proposal ids, evidence quotes,
  grant destinations and operations, packet trace actors and reasons, and a
  goal plan payload.

The decision file `2026-11-12-callers-rely-on-undefined-members-only` records
the conclusion.
