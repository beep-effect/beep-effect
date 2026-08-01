# Metadata standards through a schema lens

Four families, best understood as four type-system designs. `XMP-beepQA` is
the worked example throughout.

## 1. EXIF — a closed record type, frozen in 1998

EXIF is a fixed vocabulary of numbered tags in TIFF IFD (Image File
Directory) structures: binary, offset-linked tables of
`(tag id, type, count, value)`. Think of it as a **sealed struct** you cannot
extend — camera-oriented fields (`ExposureTime`, `FNumber`, `GPSLatitude`)
plus a handful of generic slots (`ImageDescription`, `UserComment`,
`Software`, `DateTimeOriginal`).

- Lives natively in JPEG (`APP1` segment) and TIFF; PNG only gained a
  standard `eXIf` chunk in 2017; GIF cannot carry it at all.
- Typed, but weakly: rationals, ASCII, undefined-bytes. No namespacing, no
  schema evolution — extensions happen by vendors squatting on
  "MakerNotes" (an untyped bytes field interpreted per-vendor — the `unknown`
  of metadata).
- **Why we don't use it for provenance**: no custom fields without abusing
  `UserComment`, and no GIF support. We only meet EXIF when *reading* what
  cameras/tools wrote (`@beep/exiftool` `readTags` → the `ExifMetadata`
  schema, with a `raw` record for everything unmapped).

## 2. IPTC-IIM — the legacy newsroom record

1990s newswire fields (caption, credit, keywords) in a binary "IIM" block
(JPEG `APP13`/Photoshop IRB). A second sealed struct, string-typed, mostly
superseded — modern "IPTC" metadata is actually IPTC *Core*, which is an XMP
schema (below). You'll see IIM in stock-photo files; treat it as read-only
legacy. We never write it.

## 3. XMP — an open, namespaced record: RDF/XML packets

XMP is Adobe's "put an RDF graph in the file". A packet is XML describing
resources with **namespaced properties** — which makes it the extensible
one: anyone can mint a namespace URI and define fields under it. That is
exactly a **row-polymorphic record**: standard namespaces (`dc:` Dublin Core,
`xmp:`, `photoshop:`, `iptc4xmpCore:`) plus your own, coexisting in one
packet.

```xml
<rdf:Description rdf:about=""
    xmlns:beepQA="https://ns.beep.sh/qa/1.0/"
  beepQA:sessionId="0198f..."
  beepQA:scenarioName="drag-sash"
  beepQA:capturedAtEpochMs="1753900000000"/>
```

- The namespace URI (`https://ns.beep.sh/qa/1.0/`) is the type identifier —
  it needs to be globally unique, not resolvable. We reuse the repo's
  identity authority and version it in the path (`/1.0/`): schema evolution
  = new URI, old readers keep working. Same philosophy as our
  `schemaVersion` literals.
- Container placement: JPEG `APP1` (a second APP1 beside EXIF), PNG `iTXt`
  chunk keyed `XML:com.adobe.xmp`, **GIF via a GIF89a Application Extension**
  (`XMP DataXMP`) — the only rich-metadata channel GIF has, and why our GIF
  provenance is XMP. TIFF tag 700. MP4/MOV in a `uuid` box.
- Values are strings/structs/arrays (typed by convention, not enforcement) —
  so our `BeepQaProvenance` schema is the real type; XMP is its encoded form.
  `S.encode` to tag assignments, `S.decode` on read-back: schema-is-truth
  applied to a 20-year-old standard.
- exiftool is the universal read/write tool; custom namespaces are declared
  via `-config` (see `resources/beepqa.ExifTool_config`).

## 4. Container tags — the key-value escape hatch for video

Matroska (mkv/webm) and MP4 have their own metadata atoms: flat string
key-values at container level (`Tags` element / `udta`+`keys` atoms).
ffmpeg writes them with `-metadata KEY=value` during a remux (`-c copy` — no
re-encode). Untyped, unnamespaced — a **plain string map** — so we uppercase
and prefix: `BEEP_QA_SESSION_ID`. exiftool READS Matroska but cannot write
it, which is the entire reason the pipeline splits image provenance
(exiftool/XMP) from video provenance (ffmpeg tags).

## 5. C2PA — signed provenance manifests (the future track)

C2PA ("Content Credentials") stops describing and starts *proving*: a
manifest of assertions (creator, actions, ingredients) hashed over the asset
content and **cryptographically signed**, embedded in a JUMBF box. Tampering
breaks the signature; edits chain manifests. Type-wise it's a signed,
append-only event log versus XMP's mutable record.

Relevance here: our provenance says *what session produced this frame*;
C2PA would let a third party *verify nobody altered it since*. Overkill for
internal QA today — but the `CaptureProvenance` schema maps cleanly onto a
C2PA assertion, so a `c2patool` signing step after `writeXmpPacket` is a
clean phase-2 (the falsification-round `falsification: true` flag is exactly
the kind of claim you'd want signed).

## What survives what (the practical table)

| Operation | EXIF | XMP (image) | Container tags |
|---|---|---|---|
| ffmpeg re-encode of an image | dropped | dropped | n/a |
| ffmpeg `-c copy` remux | n/a | n/a | preserved + writable |
| exiftool `-o` copy-write | preserved | preserved + writable | read-only |
| Screenshot/crop in an editor | usually dropped | app-dependent | n/a |
| Upload to most chat/web apps | stripped | stripped | stripped |

Two operational corollaries: stamp provenance **last** (after every encode),
and never treat embedded metadata as the only copy — `session.json` is
canonical.
