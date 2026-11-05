# Callback mutation shapes and projection requirements

Date: 2026-10-28. Source facts and partial private-session value proof;
document projection and complete callback fidelity remain open.

## Provenance

The new maintainer probe runs against the clean pinned eyecite commit/tree,
Python 3.11.15 with hash seed zero, and the frozen eyecite/reporters/courts
versions. The output binds resolve.py, models.py, the BSD-2-Clause license and
the exporter bytes. It constructs synthetic semantic objects; no extraction or
original-source span parity follows.

The committed artifact is
`packages/law-practice/use-cases/test/fixtures/eyecite/callback-mutation-observations.json`.
SHA-256:
`26e81eae9bfcd03ef2370be5d22f7241d96eea18591df602cced8dbc12540a63`.
It retains 16 scenes, 38 input occurrences and 38 callback events.

Test-local slots preserve list/dictionary/object identity relations without
emitting process addresses. The probe holds strong references to observed
objects, preventing allocator address reuse from fabricating alias relations.
Detached objects have separate slot references and explicit semantic fields;
they are not relabeled as input occurrences or verified mentions.

## Source results

Every scene succeeds in the oracle. The returned groups demonstrate:

- Reading a missing defaultdict key creates a retained empty group.
- Clearing, moving or reversing group contents changes final membership/order.
- A prior occurrence or current Id. occurrence can appear repeatedly.
- One occurrence can belong to two different resource groups.
- Falsy and None keys can exist when inserted directly by a callback, including
  an empty group under zero and a nonempty group under None.
- Two resource keys can share one member-list object. Appending the current
  citation through one key updates both groups.
- The dictionary passed to successive Id. callbacks is the same object.
- A dictionary retained by an Id. callback can be cleared by a later full
  callback, even though the full callback receives no dictionary argument.
- A callback can insert a detached citation into a returned member list.
- A supra callback can add or replace a prior-full entry with a detached full
  citation, then use the real default supra/Id. helpers to resolve known input
  occurrences. The detached full need not itself become a returned member.

These are callable-interface behaviors of the pinned public resolver, not
TypeScript extensions. Empty groups, repeats, ordering and cross-group members
cannot be discarded to fit the current document schema.

## Target scope

| Family | Scenes | Current target proof |
| --- | ---: | --- |
| Known-input group values | 10 | Final group values match |
| Aliases/retained dictionaries | 3 | Source retained; target open |
| Detached returned member | 1 | Source retained; target open |
| Detached prior-full context | 2 | Source retained; target open |

The new target test requires all 16 rows and the exact artifact hash, asserts
all family counts and the exact ten supported scene names, then executes every
known-input group-value scene. It compares resources and ordered member
references directly with source outputs. The ten scenes cover 21 input
occurrences. List identity slots are deliberately excluded from this value-only
comparison and remain open even for those scenes.

The six other scenes are explicit pending work, not silently filtered parity
cases. The source controls validate all 16 outputs, detached reference closure,
alias relations and fresh pinned replay. The final target checker must bind all
16 scenes and their identity observations before promoting custom resolution.

The prior 18-context/53-event trace suite now shares its fixture construction
and finite primitive adapter with this test. The helpers remain local test
code; no runtime fixture or Python dependency was added.

## Architecture check and required adaptations

The grill-with-docs check used the packet's ownership/publication contract and
`standards/architecture/04-rich-domain-model.md` and `08-testing.md`.
Ownership questions are answered by those documents: pure group/reference
semantics belong to law-practice domain; live callback state belongs to its
server; published ports belong to its server use-case subpath. No new package,
shared-kernel promotion or architecture-wide doctrine change is required.

The mismatch is an initiative-local provisional model restriction:

- Deriving members only from one chosen-authority edge per mention cannot
  represent repeats or cross-group membership.
- Deriving member order from the document's mention order cannot preserve an
  independently reversed group list.
- Requiring a resolved representative for every authority cannot preserve an
  empty listed group.
- Known-input-only references cannot encode a detached semantic object. Such
  an object must never receive a fabricated anchor or occurrence token.
- Copying transition arrays cannot by itself preserve shared list identities
  or a dictionary alias that a later full callback mutates.

The goal explicitly permits replacement of provisional citation contracts.
Projection must therefore retain group presence, ordered multiplicity and
reference distinctions separately from resolution decisions. Live alias state
must be handled in the server and proved against these scenes. It must not be
hidden in pure domain behavior or presented as a verified source capability.

This note records requirements, not a completed replacement schema or an
approved alias/foreign-object normalization. Existing default graph proofs
remain useful for their narrower path. All custom-resource, projection,
normalization, safety and full-engine completion rows remain open.

## Reproduction

```sh
python3 goals/citation-extraction-engine/ops/verify-callback-mutation-controls.py
bun run beep quality package-verify @beep/law-practice-server
```

For exact source replay, invoke the Python verifier with the pinned interpreter,
hash seed zero and `--oracle-root` pointing to the clean oracle checkout. It
compares all decoded JSON values in an owned temporary directory, allowing only
repository formatting differences.

The final server package gate passes (audit 31.3 seconds, docgen 11.4 seconds),
including the new ten-scene value comparison, the shared-fixture refactor and
all existing callback/default/persistence/identity/text suites. Build/type
checks, lint and documentation pass. Portable controls and fresh pinned Python
replay validate every one of the 16 source scenes.

The ten-component evidence audit and goals index pass; goals doctor reports no
new blocking findings. New-note and README Markdown checks pass. The complete
target comparator remains pending. Verification logs use the
`callback-mutation-` cache prefix.
