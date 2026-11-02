# PartyKey v1 domain foundation — 2026-11-02

Scope: a partial P1 foundation only. It creates `@beep/party-domain` and lands
PartyKey v1 canonical bytes plus the graduated identifier schemas and shared
normalizers, following SPEC "PartyKey v1 bytes and adapter equality". P1 and the
packet lifecycle stay `pending`/`active`; no phase, status or acceptance box is
flipped. Base: `origin/main` at `560195af`, in a Claude cloud session.

## Prerequisites checked at source

- `PartyId` is the neutral integer surrogate at
  `packages/shared/domain/src/identity/Party/PartyId.ts`. This foundation does
  not need it yet; `KeyAssignment` will map keys to it later.
- `packages/party/domain` did not exist. No open PR touched party paths.
- Source to graduate: `scratchpad/party/Party.ts` (`Identifier` union,
  `identifierKey`, `normalizeEmail`, `normalizeExchangeDn`).

## What landed

- `@beep/party-domain`, created with `bun run beep create-package party-domain
  --type library --parent-dir packages/party --dir-name domain`. The command's
  own registrations are the only edits outside the package: root workspace,
  identity `$PartyDomainId`, `bun.lock`, syncpack, root and vitest aliases,
  `tsconfig.packages.json` and the regenerated Fallow boundaries. `beep
  tsconfig-sync` then added the package's two reference lists. `tsconfig-sync
  --check` reports no drift.
- `src/Identifier.ts`:
  - `Identifier` tagged union (EmailAddress, PhoneNumber, ExchangeDn, Username,
    NativeAccountId, ExternalId) holding canonical values;
  - shared normalizers (`normalizeText`, `normalizeNamespace`,
    `normalizeEmail`, `normalizeExchangeDn`, `normalizeUsernameHandle`,
    `normalizePhone`); mailbox parsing is private to `normalizeEmail`;
  - graduating constructors and one typed `IdentifierIssue` with a `LiteralKit`
    reason.
- `src/PartyKey.ts`:
  - `PartyKey` (`pk:v1:` plus 64 lowercase hex digits);
  - `IdentifierBasis` and `SourceRecordBasis`;
  - `canonicalJson` and `canonicalBytes`;
  - `partyKeyOf`, `identifierBasis` and `sourceRecordPartyKey`.

## Contract as implemented

- Strings are NFC, then leading and trailing Unicode `White_Space` is trimmed.
  Case and internal whitespace are kept unless a scheme rule says otherwise.
  Unpaired surrogates are rejected.
- Canonical JSON: string fields only, keys sorted by Unicode code point, no
  whitespace, BOM or trailing newline. Only quote, backslash and C0 controls are
  escaped (named escapes, otherwise lowercase `\u00xx`).
- Email:
  1. Parse the mailbox, discarding any display-name wrapper.
  2. NFC/trim.
  3. Convert the domain with UTS #46 nontransitional processing and STD3 rules
     (`tr46.toASCII` with `useSTD3ASCIIRules`, `checkHyphens`, `checkBidi`,
     `checkJoiners` and `verifyDNSLength`).
  4. Lowercase the whole address and apply NFC again.

  Dots and plus tags are preserved. Unparseable mailboxes and invalid domains
  fail as issues and are never repaired.
- ExchangeDn is uppercased (then NFC). Username is the lowercased handle, with
  its service as authority. PhoneNumber is a validated E.164 value
  (`libphonenumber-js`); a number without `+` needs explicit country context,
  otherwise it fails as `ambiguous-phone`. NativeAccountId and ExternalId keep
  their value's case and key by namespace.
- Source-record fallback keys by the stable namespace and native record id
  (NFC/trim, case kept). A missing namespace or id fails as
  `missing-source-record-identity`; display names are never used.

Interpretations, recorded for review:

- `scheme` uses the graduated `identifierKey` prefix tokens: `email` (the SPEC's
  pinned token), `tel`, `x500`, `user`, `native` and `ext`.
- ExchangeDn is treated as globally scoped, with an empty authority, because
  the graduated `identifierKey` has no namespace for it.
- The union drops the scratchpad's `IdentifierId` field. Record ids belong to
  the later ledger and dedupe step.

## Decision: `tr46` catalog entry

UTS #46 nontransitional processing with STD3 rules needs `tr46`. It was already
installed at 7.0.0 as a dependency of the catalogued `whatwg-url`, but was not
in the catalog. Node's `url.domainToASCII` and `whatwg-url` both use
`UseSTD3ASCIIRules=false`, which is not equivalent: U+2488 maps to `1.` and
would be accepted. The fix adds one root catalog entry, `"tr46": "7.0.0"`,
matching the installed version, so `bun.lock` gains no new resolution. The
package declares `tr46`'s types locally in `src/tr46.d.ts`, following
`@beep/html`'s `whatwg-url.d.ts`. Reverse by removing the catalog line and the
dependency.

Reused rather than recreated: `@noble/hashes` (`sha256`, `bytesToHex`,
`utf8ToBytes`, as `@beep/epistemics` uses them), `libphonenumber-js` (catalog),
`@beep/schema` `CountryCode`, and `effect/String`, `effect/Array` and
`effect/Order` helpers. `@beep/epistemic-domain`'s `canonicalJson` was not
reused: it serializes detection JSON under different escaping rules, and its
package is excluded.

## Proof

- Pinned bytes:
  `{"authority":"","kind":"identifier","scheme":"email","value":"dana@example.test"}`
  (81 bytes). Digest calculated independently with
  `printf '%s' '<bytes>' | sha256sum`:
  `a390765977ccb1ea6062e33c4508f6847be63377c0c0057d726c99eac3a04d29`.
- `packages/party/domain/test/PartyKey.test.ts`: 20 synthetic cases using only
  `example.test` addresses. They cover:
  - the pinned bytes and digest, reordered input fields and escaping;
  - unpaired surrogates and the v1 key shape;
  - header `Dana Example <Dana@EXAMPLE.test>` versus card ` dana@example.test `,
    and the explicit `Dana@example.test` versus `dana@example.test` fixture;
  - composed versus decomposed local parts, and Unicode versus A-label domains;
  - plus tags and dots preserved, and changed metadata;
  - invalid mailboxes and domains, including an STD3-only rejection;
  - Exchange DN case, Username case and service, Native and External namespaces;
  - E.164 equivalence; missing authority, ambiguous and invalid phones;
  - the source-record fallback and its rejections, and input order.
- `bunx vitest run` in the package: 21/21 (the 20 above plus the scaffold
  test).
- `bun run beep quality package-verify @beep/party-domain`: docgen ok, audit
  reported as `skip` by the tool. A skip is not a pass.
- `bun run beep quality package-verify @beep/party-domain --quick`: lint ok,
  check ok.
- `bun run beep lint package-scripts`: 0 drifting. `bun run beep tsconfig-sync
  --check`: no drift.

Initial failures, all introduced by this change and fixed before the push:

- docgen rejected the categories `normalizers` and `canonicalization`;
- docgen's example typecheck could not see `tr46` types until a triple-slash
  reference was added;
- typecheck flagged the preferred `effect/String` helpers and the
  pipeable-signature rule;
- Biome flagged imports and formatting, and its unsafe optional-chain fix broke
  strict booleans, so that line was rewritten with `Option`.

## Correction wave (same staged change, after parent review)

The parent's static review of the first staged pass (recovery patch
`ccdefc9d…0877`, 62085 bytes) found schema-first and boundary gaps. All are
fixed in place; the pinned bytes, digest, one-key-per-identifier rule,
source-record fallback and metadata exclusion are unchanged.

- **Plain data is branded `S.Opaque`.**
  - The six identifier cases are Opaque `S.TaggedStruct`s, joined with
    `S.toTaggedUnion("_tag")`.
  - The two bases are Opaque structs with `kind: S.tag(...)`, joined with
    `S.toTaggedUnion("kind")`.
  - The constructor inputs are Opaque structs: `PhoneNumberInput`,
    `UsernameInput`, `NativeAccountIdInput`, `ExternalIdInput` and
    `SourceRecordInput`.
- **Value fields are branded and canonical.** `NormalizedEmail`, `E164Phone`,
  `NormalizedExchangeDn`, `NormalizedHandle`, `IdentifierNamespace` and
  `IdentifierValue` each re-run the shared pure normalizer as an annotated
  `S.makeFilter` check and accept only fixed points. A forged non-canonical
  value (for example `Dana@EXAMPLE.test`, a Unicode domain, an empty or padded
  namespace, or a lowercase DN) fails to decode.
- **Precise schemes.**
  - `IdentifierScheme` is a `LiteralKit` (`email`, `tel`, `x500`, `user`,
    `native`, `ext`).
  - A struct check requires an empty authority for exactly `email`, `tel` and
    `x500`, and a namespace for the others.
- **Decode boundary.** `canonicalJson`, `canonicalBytes` and `partyKeyOfBasis`
  decode their input with `onExcessProperty: "error"` before serializing.
  Missing, extra, non-string or mismatched fields fail as the new
  `invalid-basis` reason. Serialization uses the schema's `.match`, not
  `Object.entries` or casts.
- **Strict mailbox grammar.** Either a bare `local@domain` with exactly one
  `@`, or a display name followed by exactly one `<local@domain>` with nothing
  after it.
  - Rejected as `unparseable-mailbox`: `a@@example.test`, a second address,
    trailing text, unbalanced brackets, quoted local parts, an empty local part
    or an empty domain.
  - No provider alias rule was added.
- **Effect-first.**
  - Every exported Effect-returning function is a named `Effect.fn`.
  - The constructors decode through their case schema and return the precise
    case type.
  - No native `switch`, `as` assertion or direct `_tag` read remains in `src`.

Correction-wave proof:

| Check | Result |
| --- | --- |
| `bunx vitest run` | 24/24: the original 21 cases ported to the new input models, plus three regression groups (malformed mailboxes, forged identifiers, invalid bases) |
| `package-verify @beep/party-domain --quick` | lint ok, check ok |
| `package-verify @beep/party-domain` | docgen ok; audit `skip` as reported by the tool, not a pass |
| `bun run beep laws schema-tag-idioms --check` | 0 findings |
| `bun run beep tsconfig-sync --check` | no drift |

Initial failures this wave: one typecheck finding in the new test
(`TS377152 mapConstToAs`), fixed with `Effect.as`. Biome reformatted three
files.

## Review fix wave (PR #2588 independent review)

The independent review of head `829ceb5f` had seven actionable findings.
Finding 5, the stale ledger status line, is the parent's as single ledger
writer and is not edited here. The other six are fixed:

1. **Scheme-specific canonical basis values.** `IdentifierBasis` now requires
   `value` to be the scheme's graduated value: `email` → `NormalizedEmail`,
   `tel` → `E164Phone`, `x500` → `NormalizedExchangeDn`, `user` →
   `NormalizedHandle`. This sits next to the existing authority rule, so the
   public `canonicalJson`, `canonicalBytes` and `partyKeyOfBasis` reject an
   uppercase email, a non-E.164 `tel`, a lowercase `x500` or an uppercase `user`
   value as `invalid-basis`. The pinned bytes and digest are unchanged.
2. **Phone: structural decode versus graduation.** The SPEC hashes "validated
   `.e164`" and requires schema validation to reject malformed values.
   Validation now happens once, at graduation (`normalizePhone` keeps
   `isValid()` under the pinned metadata). Decoding a stored `PhoneNumber` or
   `tel` basis checks the E.164 shape only, so a metadata update cannot make
   stored identifiers undecodable. No scope was added.
3. **Topology.** I ran `bun run beep architecture plan --slice party --concept
   {PartyKey,Identifier} --domain-kind values --stage core` before deciding.
   Its layout, `src/values/<Concept>/{index,<Concept>.model,<Concept>.behavior}.ts`
   with a `src/values/index.ts` barrel, was adopted. `Identifier.errors.ts`
   holds the issue type, and the shared pure normalizer core moved to private
   `src/internal/IdentifierCore.ts`. Explicit `./values/*` exports would need
   root alias regeneration (`tsconfig-sync --check` reported changes to
   `tsconfig.json` and `vitest.aliases.generated.json`), which is outside this
   wave's scope. So the package keeps its wildcard export, and thin
   `src/Identifier.ts` and `src/PartyKey.ts` barrels keep the published
   `@beep/party-domain/Identifier` and `/PartyKey` subpaths unchanged. No root
   config changed.
4. **History note:** removed the nonexistent `parseMailbox` export from the
   list above.
6. **Issue privacy and precision.**
   - `IdentifierIssue` gains an optional `field` (`value`, `namespace`,
     `handle`, `record-id`, `country`, `basis`).
   - Basis failures no longer copy a schema message: `input` is empty and
     `field` is `basis`.
   - The source-record fallback reports which part failed.
   - A new `unsupported-country` reason separates a non-supported country from
     missing context (`ambiguous-phone`).
     Follow-up from the independent delta review: an `unsupported-country`
     issue reports `field: "country"` with the country code as `input`.
   - The JSDoc and the package `AGENTS.md` state that `input` can hold raw
     identifier text and must not be logged verbatim.
7. **Package docs.**
   - The README shows the two real entry points.
   - `AGENTS.md` records the determinism inputs: `tr46` 7.0.0,
     `libphonenumber-js` 1.13.15, and the runtime Unicode tables (Node 24.22.1
     reports Unicode 17.0).
   - A bump of any of them re-runs the pinned fixtures and needs a `pk:v2`
     assessment.

Review-wave proof, in the cloud lane on top of the frozen wave2 tree
`6c3b54f3e5a0e0bf9473a6a353549a313fe51776`: 28/28 tests (the 24 existing cases
plus four review regressions). Lint, check and docgen are recorded in the PR
handoff; audit is a tool-reported skip, not a pass.

## JSDoc correction (hosted JSDoc Ratchet on #2588)

The hosted JSDoc Ratchet failed at the parent's exact head. It reported:

- `missingExportExamples` 39 (allowed 0);
- `multiple-description-paragraphs` +5;
- `packagesNeedingRemediation` +1.

A read-only audit of this package's own docs attributed them:

- 39 public runtime exports had no `**Example**`;
- five module headers (`Identifier.model.ts`, `Identifier.behavior.ts`,
  `PartyKey.behavior.ts`, and the `src/Identifier.ts` and `src/PartyKey.ts`
  barrels) had two lead paragraphs.

The fix is docs only, with no change to code or public API:

- one titled, observable `**Example**` per public runtime export, through the
  public `@beep/party-domain/Identifier` and `/PartyKey` subpaths, using
  synthetic `example.test` data and dedicated Effect leaves;
- each header's second paragraph moved under `**Details**`.

The seven exports in private `src/internal/IdentifierCore.ts` have no examples.
Docgen excludes `src/internal/**`, and 46 − 7 = 39 matches the hosted count, but
the parent's filtered inventory is the authority on what the ratchet counts.

Local results:

| Check | Result |
| --- | --- |
| Docgen | ok; all examples typecheck |
| `package-verify --quick` | lint ok, check ok |
| Tests | 28/28 |
| Audit | `skip`, not a pass |

The repo-wide JSDoc inventory and ratchet were not run here, to avoid
duplicating the parent's root scan.

## Remaining P1 work

- `IdentifierId` and `KeyAssignment`.
- Propositions, claims and admission.
- `effect/Graph` resolution with the `DistinctParty` replay rules.
- `@beep/party-use-cases` and `@beep/party-server`, and the law-practice
  boundary test.
- The `LegalPartyReference` rename.
- Graduating the rest of the scratchpad and retiring it.
- `package-verify` for all three packages.

## Reversal

Revert the PR. Alternatively, `bun run beep delete-package @beep/party-domain`
removes the package and its generated registrations; then remove the `tr46`
catalog line.


## Parent recovery replay

The full correction patch was recovered without a cloud commit or hook bypass.
Its SHA-256 is `02362d24827f64135a59c934a68300aba21093cb1b5ae7438784e9a975d600bc`
(85,258 bytes), verified before applying to the original base. The earlier
62,085-byte patch and the parent's friction notes remain preserved separately.

An isolated non-root replay used frozen install with lifecycle scripts ignored,
then the repository's `prepare` command; no postinstall or infrastructure setup.
All 24 package tests passed. Quick package verification passed lint and check.
Default package verification exited 0 with docgen passing but audit explicitly
skipped: that is not an audit pass. A separate installed Gitleaks scan over the
isolated recovery patch directory found no leaks. It is not a claim that the
cloud commit hooks ran, or a complete repository final-check receipt.

The parent's package-wrapper friction receipt is retained in the goal ledger.
PR #2582 owns the separate cloud publication-tool repair; this Party foundation
does not modify bootstrap or remove its required security checks.


## Parent incremental review replay

The original author exported the correction relative to the frozen wave2 tree,
not a replacement of the parent main merge. The 93,041-byte incremental patch
has SHA-256
`68d070c492592be74c6dbccb30c67e190da50a96e7828d244243d71e9f70b359`.
It applied cleanly to the published parent head and preserved the earlier
recovery section. The parent independently ran all 28 tests successfully,
then quick package verification (lint and check). Default package verification
exited 0 with docgen passing and audit explicitly skipped. No aggregate
repository final-check is claimed. Independent delta acceptance and eventual
head proof remain separate gates. The parent corrected the stale ledger replay
status as its single writer.


## Parent main reconciliation and canonical package input registration

The parent normally merged main `7740135bc1c945e02f5bea6994e7fef649ab72be`
into this branch as `402878ccb963e66ae72b2c5fa62627f899561d7c`.
The authored Party implementation, tests and prior history were unchanged.
The hosted policy-fingerprint failure was reproduced by the canonical check.
An isolated comparison established that the older exact base was stale, while
current main passed the same canonical check and its writer produced no diff.
The earlier request for a main seal repair was withdrawn on PR #2594.

Against current main, the Party branch differed only by its new package manifest
in the computed check-input set. Running the canonical policy-fingerprint writer
added `packages/party/domain/package.json` to the generated declaration and Turbo
inputs: two files, one addition each. No scripts, qualification scopes or baseline
thresholds changed. The canonical check then passed, as did all five existing
policy-fingerprint Turbo input tests. This is scoped red-before/green-after
evidence; hosted checks and a new exact-head final-check remain separate gates.

Friction: attributing an old base failure to current main initially routed an
unnecessary repair. Rechecking the exact current main with the canonical writer
and check prevented a competing root change. Future attribution must identify
the current revision separately from the failing CI merge and its historical base.
