# Canonical bound constructor and edition recipe binding

The previous operation artifact normalizes inherited class methods to
`eyecite.models.Token.from_match`, losing the bound class. It remains valid
within its recorded comparison scope, but cannot alone select target constructors.
This checkpoint adds independent source observations rather than inferring the
class from the presence of constructor extras.

The clean pinned eyecite 2.7.6 source at
`04d82c032ad5fd0f9ab72a61c87110c46ee8f52e`, tree
`a35a58fac03400f71a93a93485b77f1d56f2b02f`, executes under CPython 3.11.15 with
PYTHONHASHSEED=0 and exact eyecite/reporters-db/courts-db dependency versions.
The producer checks every default extractor against configuration artifact
`8603461486e165c4cb98f238b58910c269e8d6b59f4a16323c075276e94eec3c`, already
used by the canonical selector/ordering controls. The other captured configuration
is distinct and is not silently substituted for this default configuration.

All 6,805 actual bound class methods are observed: 6,799 CitationToken and one
each IdToken, SupraToken, ParagraphToken, StopWordToken,
PlaceholderCitationToken and SectionToken. Every method is verified as the
inherited Token.from_match bound to its actual built-in subclass. Ordered exact
and variation edition lists retain duplicate occurrences and reference all
2,533 frozen edition artifacts. Native pattern fingerprints include the canonical
width byte and little-endian Python words, matching the existing descriptor rule.
No fresh-process edition or extractor hash production is claimed.

`ExtractorRecipes.ts` uses schema-first metadata, Effect HashMap/HashSet and
captured timing. The caller supplies the existing token edition owner's local
identities. Duplicate extractor ids, edition refs or edition ids fail; missing
edition references fail before a registry is returned. Non-citation extras are
rejected. Binding requires the exact extractor id and the worker-returned pattern
fingerprint/flags, and returns independent constructor-argument arrays.
The metadata and descriptor schema do not grant worker execution authority.

Two focused tests replay all 6,805 recipes and 2,533 edition references, check
class counts and ordered mapped occurrences, and retain duplicate-list,
missing-reference, duplicate-binding, wrong-program, wrong-flags, unknown-id,
pattern-ceiling and output-ownership controls. Server lint/type checks and scoped
Oxlint pass. Repeat source capture is byte-identical after canonical formatting.

Producer SHA-256:
`0e420604e7b6b9c0192e44127a5ac23ca41536890cfccfc2d2be6bfb9eeb5a10`.
Fixture SHA-256:
`e89d62e4c27d27f36fd7748368fbb6cc4e5ac604b30c0434f0a6a07b2d5bd2cf`.

Policy review: the fixture test uses only BunFileSystem.layer and Digest to
verify the real committed source observation. Its EV010 resource exception has
owner @beep/law-practice-server and exits when an independently authenticated
corpus is injected instead. Replacing it with independently seeded memory files
would remove repository-artifact authentication. The fixture suite only decodes source observations and introduces no schema-first
codec-law advisory. Existing RegexInput property coverage remains separate. No
semantic, coverage or source-accounting obligation is waived. The staged new-only
Fallow audit passes with zero introduced findings; normal commit hooks pass.

Full canonical matching/worker-capture/assembly composition, whole-operation
output reservations, general custom constructor protocols, the second captured
configuration's constructor bindings, regex-family safety and public tokenizer
integration remain open. This metadata proof is not an end-to-end tokenizer claim.
