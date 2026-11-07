# Pinned native XML balance query

The new private XmlBalanceKernel authenticates a 1,622,787-byte query module and
reuses compileCitationNativeWasm and its restricted WASI host. The small authored
C wrapper links unchanged libxml2 2.12.3 and the existing complete converter/runtime
archives from the authenticated HTML relink distribution. The HTML kernel binary,
its digest, cleaner ABI and existing transport are unchanged.

This is a component for the annotation skip/wrap path, not a second OS process
manager, a new parser implementation or a live production installation. The
synchronous method must be connected to the existing owned worker transport
before engine use. The module itself supplies no parent deadline or retirement
barrier; no such proof is claimed here.

## Source behavior

probe-annotation-xml.py requires the clean official commit/tree, Python 3.11.15,
lxml 5.1.0 and libxml2 2.12.3. It invokes the original is_balanced_html helper for
300 outcomes, including 57 no-angle fast paths. Cases retain malformed/nested
markup, namespaces, duplicate attributes, entities, comments/CDATA, NULs,
Unicode widths and parser depth boundaries. Fresh replay is byte-identical.

Source replay corrected an initial assumption about adjacent surrogate points:
lxml accepts a valid pair when its Unicode input uses two-byte storage, but
rejects those same literal points in a four-byte string. Both cases now have
explicit source controls and the adapter preserves source width. Lone-surrogate
markup returns false. A no-angle string returns true without XML parsing, even
when a later parser would reject its NUL/surrogate content. There are no observed
exception outcomes in this prepared native-string corpus.

The wrapper applies the exact default parser option bits in lxml 5.1.0
parser.pxi, without namespace-cleaning/recovery/huge-tree options. The original
outer div excludes a valid source-controlled document type. All parser messages
and trees remain internal. XML rejection, including the source's depth refusal,
returns false; this adds no safety divergence or partial-result success path.
Complete whole-operation safety and arbitrary host behavior remain unqualified.

The pinned parser source is
[lxml 5.1.0 parser.pxi](https://raw.githubusercontent.com/lxml/lxml/lxml-5.1.0/src/lxml/parser.pxi),
SHA-256 f51dab773ab57fc2ce68a480cc09c5821077ac0b29cb8bdc31307aabcbb44520.
Its default option declaration and XMLParser initialization were checked directly.

## Build and provenance

build-annotation-xml.py verifies the existing complete parser relink bundle
against the HTML build receipt. It checks WASI SDK version, records the compiler
binary digest, compiles only this wrapper and links the complete existing
archives. Two fresh wrapper builds are byte-identical. The recipe supports a
replacement libiconv archive, records its digest and requires no signing key.
Complete library sources/licenses/relink material remain in the packaged HTML
asset directory; the XML directory contains wrapper source, binary, build receipt
and rebuild/relink instructions. Package files explicitly retain this directory.

- Oracle: 04d82c032ad5fd0f9ab72a61c87110c46ee8f52e.
- Fixture SHA-256:
  8ecdd67731000b801254535338eca46e3329baa901cd16d6c49e285cf4c5bc99.
- Probe SHA-256:
  23df3d5dc7445e1ac9f46616ce8919eb450846b034596cc2c4072ec9160ae97a.
- XML wrapper SHA-256:
  eb76cd3b252044ad3f789ca595e753098b97fb62566b2231d573e5d4aba8efea.
- Native binary SHA-256:
  10a71415bb305b1cac194ef9cc577253a35d40b5b22dc0b81ee2079e3c918b48.

The build receipt records the final exact wrapper/recipe/tool/library hashes;
it is authoritative if a prose digest above is superseded by a later repair.
No source hash or asset baseline is weakened to accept a mismatching binary.

## Verification and remaining integration

Twenty tests across the new XML and existing HTML kernel suites pass in 6.67
seconds. This includes all 300 source outcomes, changed-binary rejection,
malformed native layout/point refusal and the existing closed-WASI/HTML controls.
The XML invocation has a compile-time closed failure union and R=never.
Package dry-run retains all four XML assets, the existing complete parser relink
archive and the original converter source. Server lint/type checks, declaration
emission and blocking laws pass. Scoped
Fallow passes with zero introduced findings and nine inherited nonblocking clone
groups, without threshold, suppression or baseline changes. New-head hosted
confirmation remains pending.

```sh
"$EYECITE_ORACLE_ROOT/.venv/bin/python" \
  goals/citation-extraction-engine/ops/probe-annotation-xml.py \
  --oracle-root "$EYECITE_ORACLE_ROOT" --output /tmp/annotation-xml.json
cmp /tmp/annotation-xml.json \
  packages/law-practice/use-cases/test/fixtures/eyecite/annotation-xml.json
python goals/citation-extraction-engine/ops/build-annotation-xml.py \
  --sdk /path/to/wasi-sdk-34.0-x86_64-linux \
  --output-directory /tmp/annotation-xml-build
bun run beep quality package-verify @beep/law-practice-server --quick
bun run --cwd packages/law-practice/server beep:build
bun run beep lint laws --package packages/law-practice/server
cd packages/law-practice/server
bun pm pack --dry-run --ignore-scripts
bunx --bun vitest run test/CitationXmlBalanceKernel.test.ts \
  test/CitationHtmlKernel.test.ts
```

Typed XML worker/RPC installation and its exact frame/retirement controls,
full skip/wrap dispatch, replacement-template interpretation, custom annotators,
public service/Layer and whole-engine safety/scaling remain required. No source,
donor or representation/fidelity proof row is promoted. All eleven representation
laws, four fidelity questions and fifteen unfinished proof rows remain open
without a semantic waiver.
