# Journal adapter run-3 golden

All inputs are small synthetic properties projections authored for this fixture.
No fleet bytes were copied. `expected-metadata.yaml` supplies a synthetic commit;
`input/` has the same four-pin layout as the corpus. Expected records are JSON
encoded YAML, named `so-<sha12>.yaml.expected` so v14 never scans them as live
observations. The expected set has 31 records.

Run the trusted adapter through the shipped sandbox runner in `self-check` mode,
with this directory as the fourth argument. The adapter regenerates the complete
filename and byte set and compares it with `expected/`; missing records, extra
records, and changed bytes fail. It does not regenerate expected files.

| Input | Locked rule |
| --- | --- |
| `run3-fleet/attempts/a/{a,b,c}/attempts.properties` | Lexicographic vocabulary census, first duplicate-key occurrence, unrepresentable prose value, later representable first occurrence, no-new-key suppression |
| `run3b-fleet/attempts/a/a/attempts.properties` | Census resets per pin and kind |
| `run3-fleet/live/grammar.properties` | Document BOM, form-feed comment, CR and CRLF boundaries, quoted and half-quoted payload, inline hash/bang/semicolon, URL, nonempty object grammar, trailing-space rejection, blank-line continuation and cross-line separator refusal |
| `run3-checkout-identity/bindings/{a,b,c,d,e}.properties` | First file per kind, same/linked/absent git directory relation, true/false/absent cache flags; duplicate class file omitted |
| `run3-checkout-identity/fleet-snapshot.properties` | Root-level snapshot participates in its own vocabulary census |
| `run3-fleet/admission/canonical/journal.properties` | Enqueued/admitted/released winner, enqueued/withdrawn loser, both evictions, heartbeat, interleaved events with complete chain span and nonce-specific facts |
| `run3-fleet/admission/session-tmp/journal.properties` | Independent session-root chain and first released-row selection |
| `run3b-fleet/admission/{canonical,session-tmp}/journal.properties` | First v3 tag per root, no cross-root or cross-pin nonce joining, v1 row excluded from first-v3-tag selection |
| `run3b-fleet/admission/canonical/protocol.properties` | Protocol projection participates in admission vocabulary |
| `run3-fleet/verdicts/a/{a,b,c,d}/verdict.properties` | Failure-kind/failed-step classes, three cache-plan results, duplicate class suppression, failed-step id after an earlier passed step retained |
| `run3b-synthetic/**` | Every projection emits even when no vocabulary key is new; both attempts remain; synthetic provenance is an observed fact |

The synthetic `canonical-runtime` binding tests a distinct discriminator value.
The live checkout-identity pin contains only `clone` and `linked-worktree` kinds;
this fixture does not assert a third live kind. Likewise the fixture's cache-plan
fields test a selection rule whose live verdict evidence is absent.

`source_excerpt` is the entire verbatim source span. Chain spans may contain
interleaved events from another nonce; those events remain visible in the quote,
while only the selected nonce's pairs enter `observed_facts`. A reader can join
nonce, tag, instant and checkout values using the original record stanzas. Flat
properties keys do not recover the raw JSON nesting; the adapter does not claim
that they do.
