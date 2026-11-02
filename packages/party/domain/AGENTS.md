# @beep/party-domain

Party slice domain: deterministic PartyKey v1 and graduated identifier normalizers.

## Surface

- See `src/index.ts` barrel — do not hand-maintain inventory tables here.

## Laws

- Root `AGENTS.md` and `standards/ARCHITECTURE.md` govern this package; record only genuinely package-specific deltas here.
- Before handing back a change, run `bun run beep quality package-verify @beep/party-domain` from the repository root. Use `--quick` only for a justified lint+check subset; a failure arms the checkout's shared P0 inbox.

## Package deltas

- PartyKey v1 determinism depends on these pinned inputs:
  - `tr46` 7.0.0 (UTS #46 IDNA mapping);
  - `libphonenumber-js` 1.13.15 (phone parsing and validity at graduation);
  - the runtime's Unicode tables, used for NFC, `White_Space` trimming and
    case mapping. This was checked on Node 24.22.1, which reports Unicode 17.0.

  A bump of any of them must re-run the pinned fixtures in
  `test/PartyKey.test.ts`. Any change to canonical bytes or keys needs a
  `pk:v2` assessment with an explicit KeyAssignment migration, per the
  party-slice SPEC (PartyKey v1 bytes).
- Phone contract: decoding a stored `PhoneNumber` or `tel` basis checks the
  E.164 shape only. Validity under phone metadata is checked once, at
  graduation (`normalizePhone`), so stored identifiers keep decoding after a
  metadata update.
- `IdentifierIssue.input` can hold raw identifier text (personal data). Report
  `reason` and `field`, and never log `input` verbatim. Basis failures carry an
  empty `input`.
- Layout follows `bun run beep architecture plan --slice party --domain-kind
  values`: `src/values/<Concept>/<Concept>.{model,behavior,errors}.ts`, plus
  the private shared normalizer core in `src/internal/`. The thin
  `src/Identifier.ts` and `src/PartyKey.ts` barrels keep the published
  `@beep/party-domain/Identifier` and `/PartyKey` subpaths stable under the
  package's wildcard export.
