# Journal adapter run-4 golden

All inputs are small synthetic properties projections authored for this fixture.
No fleet or ledger bytes were copied; values are low-entropy words. The one
reused file is `input/run4-fleet/live/grammar.properties`, a byte copy of the
run-3 golden's synthetic grammar fixture. `expected-metadata.yaml` supplies a
synthetic commit; `input/` has the same two-pin layout as the corpus. Expected
records are JSON encoded YAML, named `so-<sha12>.yaml.expected` so the validator
never scans them as live observations. The expected set has 65 records over 21
inputs and locks adapter version 1.3.0 (recorded call (u)); the 39-record set of
the unpinned v1.2.0 and the 58-record set of the first v1.3.0 proof are replaced
(review round 2 added fixture rows and changed no adapter byte).

Run the trusted adapter through the shipped sandbox runner in `self-check` mode,
with this directory as the fourth argument. The adapter regenerates the complete
filename and byte set and compares it with `expected/`; missing records, extra
records, and changed bytes fail. It does not regenerate expected files.

| Input | Locked rule |
| --- | --- |
| `run4-fleet/attempts/a/{a,b,c}/attempts.properties` | R1 per stanza: the first stanza of the kind carries every representable key; a later stanza with one new key (`outcome`) emits a record carrying that key alone; stanzas with no new key emit nothing; an unrepresentable prose value leaves its key unseen until a later stanza pairs it representably (`note`), where the vocabulary record and the R3 record share a span and differ in facts. R3: first `attempt-started` per `stage` value across the kind, the first with no `stage`, a repeated stage and a repeated absence suppressed; `_tag` and `stage` read by first occurrence (an `attempt-finished` row with a new stage value and a later `_tag=attempt-started` line is not selected; a started row whose second `stage` line is a new value is not selected). The first `pre-push` row is also the first vocabulary stanza: one record, counted under `vocabulary` |
| `run4-fleet/attempts/a/d/other.properties` | R3 reads only `attempts.properties`: a started row with a new stage in another file is vocabulary only |
| `run4-ledger/attempts/a/a/attempts.properties` | The census and the stage classes reset per pin and kind. Record 0 is an `attempt-finished` row that carries every key of the started row after it, so the vocabulary record is record 0 (the census reset) and the `pre-push` started row, record 1, is selected by R3 alone (the stage-class reset); a variant that never resets the class sets loses record 1 |
| `run4-ledger/attempts/a/b/proof-ledger.properties` | R4 reads only the `ledgers` kind: a fact and a shadow in a `proof-ledger.properties` under another kind are vocabulary only |
| `run4-fleet/live/grammar.properties` | v1.1.0 grammar edges, unchanged bytes and unchanged code: CR and CRLF boundaries, quoted and half-quoted payload, inline hash/bang/semicolon, URL, nonempty object grammar, trailing-space rejection, blank-line continuation and cross-line separator refusal. The file has no record marker, so it is one leading stanza. Its leading BOM and form-feed comment do not discriminate on their own; the next two rows lock those edges |
| `run4-fleet/live/bom.properties` | A document BOM is stripped before pairing: the first key is `bomled`, never a BOM-prefixed key |
| `run4-fleet/live/formfeed.properties` | A form-feed-led comment line is stripped to a blank line, so the pair before it is refused by the blank-line continuation rule |
| `run4-fleet/live/journal.properties` | R2 reads only the `admission` kind: an eviction in a `journal.properties` under another kind is vocabulary only |
| `run4-fleet/live/leading.properties` | R1 boundary: the line ahead of the first marker is one leading stanza (span line 1 alone, name without a suffix); the first marked stanza is its own record (lines 2 to 3); a later stanza that repeats a seen key emits nothing |
| `run4-fleet/live/scoped.properties` | R1 eligibility is tested against the stanza span, never the file: `scoped=word` is followed by an indented line in record 0 (refused there) and by an ordinary line in record 1, so record 0 emits nothing and record 1 introduces both keys |
| `run4-fleet/admission/canonical/journal.properties`, records 0 to 15 | R2 as in v1.1.0: enqueued/admitted/released winner, enqueued/withdrawn loser, both evictions, a pending enqueue, interleaved events with the complete chain span and nonce-specific facts, a v1 `admission-withdrawn` row ahead of the first v3 one excluded from first-v3-tag selection (it is the second row, so its vocabulary record carries one key and cannot stand in for the excluded row), a withdrawal before its enqueue not a chain (records 14 to 15). The released rows lock each half of the checkout-and-branch test: record 10 has neither key, record 11 a checkout and no branch, record 12 a branch and no checkout, and only record 13, the first with both, is selected as `first-event-tag`. R1: one record per stanza that introduces a key (records 0, 1, 2, 6, 7), each carrying only its new keys; record 7 shares its span with the `dead-lease` chain and differs in facts |
| the same file, records 16 to 33 | R2 as changed by call (u). `base` (kind `full`, priority `high`) opens a class; `low-priority` differs in priority only and `quick-kind` in kind only, and each opens its own class; `repeat` is a second plain chain of the opened class and is dropped; `late-withdrawn` and `late-evicted` (a lease eviction) belong to the opened class and are kept because they carry a withdrawal or an eviction; `early-withdrawn` precedes the first plain chain of its class (`after-withdrawn`), which is still kept, so a kept withdrawal chain opens no class. The enqueue rows of records 2 to 15 carry neither key, so `winner` opens the class of two absent values. R1: record 16 introduces `kind` and `priority` and carries those two alone |
| the same file, records 34 to 43 (review round 2) | `late-ticket` (records 34 to 35) is an enqueue of the opened class followed by a ticket eviction and no admission: kept, so each eviction tag alone keeps a chain. `plain-absent` (36 to 37) is a second plain chain with neither `kind` nor `priority`: dropped, so a missing key is a class value like any other. `twice` (38 to 40) has two enqueue rows, the first of the opened class and the second of an unseen one: dropped, so the class is read from the first enqueue row. `odd-start` (41 to 43) starts with an admitted row that has neither key and enqueues with an unseen class: kept, so the class is read from the enqueue row, never from the chain's first event |
| `run4-fleet/admission/canonical/protocol.properties` | The protocol projection participates in the admission vocabulary; a single-stanza file gives a record that equals the file |
| `run4-fleet/admission/canonical/sidecar.properties` | R2 reads only `journal.properties`: an eviction in another admission file is vocabulary only |
| `run4-fleet/admission/second/journal.properties` | The first-v3-tag rule is keyed per journal root: a lone v3 enqueue under a second root is selected although the first root already showed that tag |
| `run4-ledger/admission/canonical/journal.properties` | The first-v3-tag set resets per pin and kind: after a v1 enqueue row that takes the vocabulary record, the v3 enqueue row is selected although the other pin's journal of the same root showed that tag |
| `run4-ledger/ledgers/alpha/proof-ledger.properties` | R4: repeated `kind` read by ordered occurrence (record kind, then decision kind; a third `kind` line and second `reason`/`observed` lines never open a class) and repeated `schemaVersion`; (a) first fact and first shadow per clone and stage, a later stage for the same clone, a fact with no `stage` in an already open (c) class selected by the absent-stage class alone, a second `stage` line ignored; (b) first shadow per decision kind, `reason` and `observed`: a hit with no `reason`, and two shadows that each differ from the first in one component only (`reason`; decision kind); (c) first fact per `outcome`, `tier`, `inputSource` and `laneClass`: four facts that each differ from the first in one component only, the `tier` one by absence; a record with an unknown record kind never selected; records with no new class suppressed. R1: records 0, 1 and 3 introduce keys; each vocabulary record shares its span with an R4 record and differs in facts (a repeated key enters the vocabulary by its first pairing only) |
| `run4-ledger/ledgers/beta/proof-ledger.properties` | R4 (a) resets per clone while (b) and (c) span the kind: after the clone's first shadow and fact, a hit shadow and a failed fact whose classes `alpha` opened stay unselected; a shadow that differs in `observed` only is selected; a shadow with a single `kind` has an absent decision kind |
| `run4-ledger/ledgers/beta/other.properties` | R4 reads only `proof-ledger.properties`: a fact row in another file is vocabulary only |
| `run4-ledger/ledgers/gamma/attempts.properties` | R3 reads only the `attempts` kind: a started row in an `attempts.properties` under another kind is vocabulary only |

Rule counts over this fixture (first matching rule per record): vocabulary 31,
nonce-chain 13, first-event-tag 3, first-stage 3, ledger-clone-stage 6,
ledger-shadow-class 5, ledger-fact-class 4. A record that is first under two
rules is emitted once and counted under the first (the vocabulary rule runs
first in each file); the adapter's census line lists every class opened under
`classes` (here 6 plain-chain, 4 first-stage, 6 clone-stage, 6 shadow and 5
fact classes).

The expected set was produced by a throwaway copy of the trusted adapter whose
observe branch read `input/` and `expected-metadata.yaml` of a scratch copy of
this directory outside the checkout and wrote `.expected` names, run through the
sandbox runner's `observe` mode (the runner has no write-golden mode). The span
list was read against the table above, the files were copied here, and the real
adapter then proved them with `self-check`. The throwaway copy is deleted. The
same route produced the 65-record set of review round 2.

The locks were proven by mutation on 2026-10-06: fifty-five single-edit variants
of the v1.3.0 adapter, each in its own 0700 directory outside the checkout and
run through the sandbox runner's `self-check` against this directory, all exit 1.
The whole list is re-run after any fixture or rule change, never only the new
variants.

- The thirty variants of the v1.2.0 proof, re-applied to the v1.3.0 bytes: drop
  or add one key component of R4 (a), (b) or (c) (each of clone, absent stage,
  decision kind, `reason`, `observed`, `outcome`, `tier`, `inputSource`,
  `laneClass`; (c) on `outcome` alone and on `inputSource` alone; (b) and (c)
  keyed per clone), read the last `kind` as the decision kind, admit an unknown
  record kind, lift the kind or the file-name restriction of R2, R3 and R4 (six
  variants), remove the v3 guard, the checkout-and-branch test or the
  enqueue-before-outcome order of R2, drop the `_tag` test or the absent-stage
  class of R3, read keys or vocabulary pairings by last occurrence, and remove
  the BOM strip or the form feed from the comment pattern.
- Six for R2 as changed: a withdrawal chain sampled like a plain one; an
  eviction chain sampled like a plain one; every plain chain kept; the class
  keyed on `kind` alone; the class keyed on `priority` alone; a kept withdrawal
  or eviction chain opening its class.
- Eight for R1 as changed: one whole-file stanza (the v1.2.0 span); the span
  running to the end of the file; the span running one line into the next
  stanza; only the first stanza of a file emitting; keys never marked seen;
  the record carrying every pair of its stanza; a leading stanza only in a
  marker-less file; the census never reset. The "never marked seen" and "every
  pair" variants stop on the adapter's own filename-collision check (a
  vocabulary record and a single-event chain would then share span and facts
  under two names) before the comparison runs.
- Eleven from review round 2: a ticket-eviction chain sampled like a plain one
  (only a lease eviction or a withdrawal keeps a chain); a lease-eviction chain
  sampled like a plain one; the class sets never reset between (pin, kind)
  groups; a released row selected on a checkout alone; a released row selected
  on a branch alone; the class read from the last enqueue row; the class read
  from the chain's first event; a chain with an absent `kind` or `priority`
  never sampled; R1 eligibility tested against the whole file; the
  first-v3-tag key without the journal root; the first-v3-tag set never reset.

Fifty-three variants fail the set comparison and two stop on the collision
check.

`source_excerpt` is the entire verbatim source span. Chain spans may contain
interleaved events from another nonce; those events remain visible in the quote,
while only the selected nonce's pairs enter `observed_facts`. Flat properties
keys do not recover the raw JSON nesting; the adapter does not claim that they
do. `originKey`, `ownerRef` and `key` values here are fixture words: they are
carried verbatim and never selected on.
