# html-dl-child-grammar P2 refresh audit

Source HEAD: `f137beedb270a071d4aa2ecc1dd52a9d233044d1`.
Owner bytes match `git show <HEAD>:packages/foundation/modeling/html/src/Html.conformance.ts`.
Inventory and old design were snapshotted before source inspection and never rewritten.
Outcome: retained E1, pair cardinality4/3, derived/internal/literalkit/Tier1, designed.
Only row citation/notes change; independent P3 is pending.

## Substantive design corrections

- Distinguish singular wrapped dt+/dd+ group from plural direct groups.
- Preserve top-level foreign-only contentModel versus nested foreign parent-order diagnostics.
- Specify complete parent/content-model/descendant issue ordering and exact messages.
- Explain that empty is filtered-element grammar, not necessarily a childless or valid tree.
- Record HTML ASCII whitespace semantics; NBSP still triggers text rejection.
- Correct guard accounting: emptiness decision moves to classifier; wrapped nonempty check is actually removed; real nested/text/regex guards remain.
- Keep contextual-div's shared singular helper unchanged; no generic shared classifier.
- Remove stale test anchors and unsupported unconditional changeset prescription.

## Discovery

Graft located description-list arm, all sequence/regex uses, actual tests,
children/path helpers, whitespace helper, browser parser fixture and LiteralKit
match implementation. Targeted source reads covered1743-1833, content-model
1680-1728, traversal2134-2184, public inspection2201 onward, metadata and exports.
Shared-file coordination with select owner agreed on separate private kits and
one deduplicated LiteralKit import; common input projections remain unchanged.

## Live-source sample probe (19 fixtures, exit0)

Executed `bun --eval` from repo root, importing current `inspectConformance`,
Dl/Dt/Dd/Div/Script/Template/Span/ForeignElement model constructors and Text/Comment
constructors directly. Built empty Dt/Dd nodes, ordinary svg foreign nodes,
`Script(content=void 0)`, empty Template, and Dl(children=fixture). Serialized each
result using JSON.stringify. This is a sample of actual current API outputs, not
exhaustive enumeration, not an implementation test, and not package verification.

Shorthand P = path[] elementOrder exact dl message in proposed design;
D = path[children.0] elementOrder exact div message;
C(path,text) = contentModel issue at exact path with stated text.

| Fixture | Exact ordered issues (shorthand above) |
| --- | --- |
| empty | [] |
| dt,dd | [] |
| dt,dd,dt,dd directly | [] |
| div(dt,dd) | [] |
| div(dt,dd,dt,dd) | [P,D] |
| div(dt,dd),div(dt,dd) | [] |
| script-only | [] |
| template-only | [] |
| dt,dd,div(dt,dd) | [P] |
| foreign-only | [C(children.0, `<dl> does not permit foreign content`)] |
| dt,dd,foreign | [C(children.2, `<dl> does not permit foreign content`)] |
| div(dt,dd,foreign) | [P,C(children.0/children.2, `<div> does not permit foreign content`)] |
| text x only | [C(children.0, `<dl> does not permit text children`),P] |
| NBSP only | [C(children.0, `<dl> does not permit text children`),P] |
| ASCII space/tab/CR/LF/FF and comment | [] |
| div(dt,dd,text x) | [P,C(children.0/children.2, `<div> does not permit text children`),D] |
| div(dt,dd,span) | [P,C(children.0/children.2, `<div> does not permit <span>`),D] |
| empty div | [P,D] |
| lone dd | [P] |

All slash-separated paths above denote two separate children.N path segments.
The 4/3 proof does not rely on this sample: it follows for every sequence length
from disjoint nonempty tag alphabets (dt/dd versus div) and the explicit wrapped
nonempty guard. Finite samples supply diagnostic regression anchors only.

No tracked edits, source implementation, full tests, independent P3, census,
publication or merge credit. Parent is the canonical writer.

## Input SHA-256 bindings

- `inventory.start.jsonl`: `22189fe9ecc326fadf0bb1d0743b903e297894acfb8aadd853b4f4a9e8826917`
- `design.start.md`: `80017068d12451f8ec7042aa6611bb488cc9ea0090abf7138a9cb6f6f9c9ddfc`
- `goals/boolean-creep/GOAL.md`: `560a143a9a389f361a14c08d15818ab7fb988be6b85f4f403ee17cb64f2d188d`
- `goals/boolean-creep/SPEC.md`: `9df7ebe63b9c7c1e253892ff1b36600baa8b22f7c6598617e7e8995575ad5087`
- `goals/boolean-creep/DECISIONS.md`: `e6851a394568acf774d51b2d840635b8f4fbee200dd346d26bc82dbef624ea8d`
- `packages/foundation/modeling/html/src/Html.conformance.ts`: `7a9ca39b11ca3f85d426f826392150d4874d2a34c63c1b0f689906f676e3eac2`
- `packages/foundation/modeling/html/src/Html.meta.ts`: `d5b6c9bc9230bcf22679e517d70f707d98709f1e40c5c6c8a507b6ac9cfe2b1c`
- `packages/foundation/modeling/html/src/Html.attributes.ts`: `7a815ef355d229d005ffc62f836e1ed222865d7cd92380615a69a371f9be0956`
- `packages/foundation/modeling/html/src/internal/conformance/Html.conformance-contracts.ts`: `d6f28cf31d853061edd10c16642319b098a344ff85e89a243dc74ce2045ba122`
- `packages/foundation/modeling/html/src/Html.model.ts`: `5428e2ac37c33acb85fb917fb7fefefe8b57c640eec97a122c47d2405f40f4bc`
- `packages/foundation/modeling/html/src/Html.nodes.ts`: `bf1664dc3b7b7f97902931c58fb24efc3e4ab784ac7ad7fc295e163c78fb1c8f`
- `packages/foundation/modeling/html/src/index.ts`: `95dedf64877863567cd2ded17968a5e55b644c85e230d5eb4a7c2ceec4d2eace`
- `packages/foundation/modeling/html/src/Html.ts`: `1b5930ab143cc927004c2b187252942296dc1fe81a958f83a09fa15f80978507`
- `packages/foundation/modeling/html/package.json`: `d4162bc5309948a0d6debcecd9c297a3b538d5612ea6e482eba00ce24e4cfc48`
- `packages/foundation/modeling/html/test/Html.conformance-hardening.test.ts`: `58f42d7b9fe570a355184e09c105487027834ea5254fb017749ccb09982a9ce1`
- `packages/foundation/modeling/html/test/Html.coverage-matrix.test.ts`: `0db5336ab1f8da499653009fb5c550dda7c2073ebd10fee2cfa2e224c3743008`
- `packages/foundation/modeling/html/test/Html.browser-conformance.test.ts`: `a232d9f5b75057a376d45512b307a2f12167f77a927b4191dea2fa28f4915c08`
- `packages/foundation/modeling/schema/src/LiteralKit/LiteralKit.schema.ts`: `36915d6791ed01e0f1e33384513441570597e84d9b5750f6b6cc009a4aea24be`

## Proposal SHA-256 bindings

- `proposed-design.md`: `e723748b175e844a66025470f734eefa94a02781d68e05c0b70a108083c575b9`
- `proposed-row.json`: `afd3e2f6f9b932f4e40e50e5ad5d0ebb068e61b9deb683c1179177e36eb7598c`

Parent integration: verified input hashes; starting inventory is preserved at `history/inventory/2026-09-22-pre-html-refresh.jsonl` and previous design at `history/designs/2026-09-22-pre-refresh-html-dl-child-grammar.md`. Source qualification checked against the owner's current grammar branch. No independent P3 credit.
Parent correction: isScriptSupporting is at line1651, not1641.
