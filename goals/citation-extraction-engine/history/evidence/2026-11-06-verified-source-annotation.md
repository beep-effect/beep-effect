# Verified raw-source annotation composition

The private source annotation operation now admits before resolver work and
connects genuine canonical source evidence to the existing native annotation
entry. It captures the resolver, callback, updater, policy, runtime and Clock.
Returned annotate work requires no services. Private children reuse the parent
permit, Scope and cumulative text budget rather than opening another operation.

The raw primitive source profile has a required plain slot and optional markup
slot. Each slot contains a canonical source identity and primitive sourceText.
A captured supplied updater selects markup, including empty markup, and leaves
plain unread. Both relevant slots and native replacement tuples are snapshotted
before resolver calls. Replacement words use the existing bounded Unicode and
budget services; each allocated receiving copy is charged. No new source proof,
hash protocol, arena, scheduler or transport is invented.

SourceEvidence resolves and verifies each relevant source independently. The
selected source is markup when nonempty or selected by a supplied updater;
otherwise it is plain. The other supplied source remains a genuine companion
proof. The result keeps these verifier-issued capabilities separate from the
complete rendered native word. It does not issue an anchor or source proof for
newly annotated output. General host values and native replacement tuples are
still a private profile, not the final public request contract.

## Verification

Eleven tests across source annotation, the admitted native entry and a controlled
clock pass in 6.48 seconds after the final source/helper correction. They cover:

- Resolver work observes exactly one active outer operation.
- Resolver mutation of caller replacement bytes and tuple membership cannot
  change the captured annotation output.
- Genuine VerifiedSourceText passes the canonical runtime guard; a mismatched
  caller string fails with the selected annotation input error.
- Over-limit raw text refuses before resolver/native work.
- Bun and Node verify both source slots and replay original annotation-mapping
  case 0, even when plain resolution mutates the caller's markup text.
- All observed native children have independently confirmed exits.
- A supplied updater verifies empty markup without reading plain.
- A 40ms resolver followed by a 40ms callback fails at the shared 50ms annotation
  deadline. Admission is released; the callback does not get a fresh full timer.
- The native entry still replays all 214 original unchecked cases twice with
  independent budget totals and preserves real skip/wrap/mapping behavior.

An earlier source/evidence run passed eight tests in 3.66 seconds. Final package
lint/types, declaration emission and blocking laws pass. Scoped Fallow reports
zero introduced findings and nine inherited clone groups under unchanged policy.
The initial combined prepare function exceeded the cognitive envelope; explicit
request capture, proof selection and native-source preparation responsibilities
remove the finding. A mistaken Option helper was replaced by the existing
Effect Record.getSomes primitive; affected tests were rerun successfully.
Declaration emission uses named capability field codecs so TypeScript preserves
the prerequisite's private verifier capability without expanding its class.

```sh
bun run beep quality package-verify @beep/law-practice-server --quick
bun run --cwd packages/law-practice/server beep:build
bun run beep lint laws --package packages/law-practice/server
bunx fallow audit --config .fallowrc.jsonc --format json --quiet \
  --base origin/main --gate new-only
cd packages/law-practice/server
bunx --bun vitest run test/CitationSourceAnnotation.test.ts \
  test/CitationSourceAnnotationTiming.test.ts test/CitationAnnotationEntry.test.ts
```

The public CitationEngine service/Layer, complete request/failure translation,
general host and nested callback behavior, builtin difflib, whole-engine safety/
scaling, lawful Bluebook transforms and exhaustive source/donor accounting remain
required. All eleven representation laws, four fidelity questions and fifteen
unfinished proof rows remain open. No semantic waiver, disposition promotion,
expected-source change, prerequisite adaptation or baseline weakening occurs.
Hosted verification remains separate from this component proof.
