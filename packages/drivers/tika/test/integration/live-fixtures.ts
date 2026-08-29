import { deflateSync } from "node:zlib";

const textEncoder = new TextEncoder();

const crcTable = Array.from({ length: 256 }, (_unused, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit = bit + 1) {
    value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

const crc32 = (bytes: Uint8Array): number => {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = crcTable[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const concatBytes = (chunks: ReadonlyArray<Uint8Array>): Uint8Array => {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset = offset + chunk.length;
  }
  return output;
};

const uint32 = (value: number): Uint8Array => {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, false);
  return bytes;
};

const uint16le = (value: number): Uint8Array => {
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value, true);
  return bytes;
};

const uint32le = (value: number): Uint8Array => {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value >>> 0, true);
  return bytes;
};

const pngChunk = (type: string, data: Uint8Array): Uint8Array => {
  const typed = concatBytes([textEncoder.encode(type), data]);
  return concatBytes([uint32(data.length), typed, uint32(crc32(typed))]);
};

/**
 * Byte fixtures the opt-in live lane feeds to a real Tika Server.
 *
 * Every payload is generated at runtime — no binary blobs are committed.
 */
export const livePlainText = textEncoder.encode("hello live tika corpus\n");

export const liveMarkdown = textEncoder.encode("# Live Tika\n\nhello live tika corpus\n");

export const liveHtml = textEncoder.encode(
  "<!doctype html><html><head><title>Live Tika</title></head><body><p>hello live tika corpus</p></body></html>"
);

export const liveXhtml = textEncoder.encode(
  '<?xml version="1.0" encoding="UTF-8"?>' +
    '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Live Tika</title></head>' +
    "<body><p>hello live tika corpus</p></body></html>"
);

export const liveRtf = textEncoder.encode(
  "{\\rtf1\\ansi\\deff0 {\\fonttbl{\\f0 Helvetica;}}\\f0 hello live tika corpus\\par}"
);

/**
 * Build a structurally valid single-page PDF with a computed cross-reference table.
 */
export const makeLivePdf = (text = "hello live tika corpus"): Uint8Array => {
  const content = `BT /F1 24 Tf 20 100 Td (${text}) Tj ET\n`;
  const contentLength = textEncoder.encode(content).length;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${contentLength} >>\nstream\n${content}endstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: Array<number> = [];

  objects.forEach((object, index) => {
    offsets.push(textEncoder.encode(pdf).length);
    pdf = `${pdf}${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const startXref = textEncoder.encode(pdf).length;
  const entries = offsets.map((offset) => `${`${offset}`.padStart(10, "0")} 00000 n \n`).join("");

  pdf = `${pdf}xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${entries}`;
  pdf = `${pdf}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`;

  return textEncoder.encode(pdf);
};

/**
 * Build a valid 1x1 truecolor PNG with computed chunk CRCs.
 */
export const makeLivePng = (): Uint8Array => {
  const signature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const header = concatBytes([uint32(1), uint32(1), new Uint8Array([8, 2, 0, 0, 0])]);
  const raw = new Uint8Array([0, 0xff, 0x00, 0x00]);

  return concatBytes([
    signature,
    pngChunk("IHDR", header),
    pngChunk("IDAT", new Uint8Array(deflateSync(raw))),
    pngChunk("IEND", new Uint8Array(0)),
  ]);
};

const zipDosDate = 0x0021; // 1980-01-01, keeps the archive byte-for-byte stable.
const zipDosTime = 0x0000;

type ZipEntry = {
  readonly data: Uint8Array;
  readonly name: Uint8Array;
};

const zipEntry = (name: string, xml: string): ZipEntry => ({
  data: textEncoder.encode(xml),
  name: textEncoder.encode(name),
});

const zipLocalHeader = (entry: ZipEntry): Uint8Array =>
  concatBytes([
    uint32le(0x04034b50),
    uint16le(20),
    uint16le(0),
    uint16le(0),
    uint16le(zipDosTime),
    uint16le(zipDosDate),
    uint32le(crc32(entry.data)),
    uint32le(entry.data.length),
    uint32le(entry.data.length),
    uint16le(entry.name.length),
    uint16le(0),
    entry.name,
  ]);

const zipCentralHeader = (entry: ZipEntry, offset: number): Uint8Array =>
  concatBytes([
    uint32le(0x02014b50),
    uint16le(20),
    uint16le(20),
    uint16le(0),
    uint16le(0),
    uint16le(zipDosTime),
    uint16le(zipDosDate),
    uint32le(crc32(entry.data)),
    uint32le(entry.data.length),
    uint32le(entry.data.length),
    uint16le(entry.name.length),
    uint16le(0),
    uint16le(0),
    uint16le(0),
    uint16le(0),
    uint32le(0),
    uint32le(offset),
    entry.name,
  ]);

/**
 * Build a minimal OOXML WordprocessingML package with a hand-written ZIP
 * container (stored entries, computed CRC-32, central directory, EOCD).
 */
export const makeLiveDocx = (text = "hello live tika corpus"): Uint8Array => {
  const entries = [
    zipEntry(
      "[Content_Types].xml",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
        "</Types>"
    ),
    zipEntry(
      "_rels/.rels",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Target="word/document.xml" ' +
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"/>' +
        "</Relationships>"
    ),
    zipEntry(
      "word/document.xml",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
        `<w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`
    ),
  ];

  const locals: Array<Uint8Array> = [];
  const centrals: Array<Uint8Array> = [];
  let offset = 0;

  for (const entry of entries) {
    const local = concatBytes([zipLocalHeader(entry), entry.data]);
    centrals.push(zipCentralHeader(entry, offset));
    locals.push(local);
    offset = offset + local.length;
  }

  const directory = concatBytes(centrals);
  const endOfDirectory = concatBytes([
    uint32le(0x06054b50),
    uint16le(0),
    uint16le(0),
    uint16le(entries.length),
    uint16le(entries.length),
    uint32le(directory.length),
    uint32le(offset),
    uint16le(0),
  ]);

  return concatBytes([...locals, directory, endOfDirectory]);
};

const cfbSectorSize = 512;
const cfbFreeSector = 0xffffffff;
const cfbEndOfChain = 0xfffffffe;
const cfbFatSector = 0xfffffffd;
const cfbDirectoryEntrySize = 128;
const cfbMiniStreamCutoff = 4096;

type CfbStream = {
  readonly data: Uint8Array;
  readonly name: string;
};

const cfbSectorsFor = (byteLength: number): number => Math.ceil(byteLength / cfbSectorSize);

const cfbDirectoryEntry = (
  name: string,
  objectType: number,
  childId: number,
  rightSiblingId: number,
  startSector: number,
  streamSize: number
): Uint8Array => {
  const entry = new Uint8Array(cfbDirectoryEntrySize);
  const view = new DataView(entry.buffer);
  for (let index = 0; index < name.length; index = index + 1) {
    view.setUint16(index * 2, name.charCodeAt(index), true);
  }
  view.setUint16(0x40, name.length === 0 ? 0 : (name.length + 1) * 2, true);
  entry[0x42] = objectType;
  entry[0x43] = 1;
  view.setUint32(0x44, cfbFreeSector, true);
  view.setUint32(0x48, rightSiblingId, true);
  view.setUint32(0x4c, childId, true);
  view.setUint32(0x74, startSector, true);
  view.setUint32(0x78, streamSize, true);
  return entry;
};

// Lays every stream out in the regular FAT chain and skips the mini FAT
// entirely. That is only legal while each stream's *declared* size is at least
// the 4096-byte mini-stream cutoff — readers route anything smaller through the
// mini stream, which this container does not build, and the failure is silent
// (empty text, no error).
const makeCompoundFile = (streams: ReadonlyArray<CfbStream>): Uint8Array => {
  let cursor = 0;
  const placed = streams.map((stream) => {
    const startSector = cursor;
    cursor = cursor + cfbSectorsFor(stream.data.length);
    return { startSector, stream };
  });

  const directorySector = cursor;
  const directorySectorCount = Math.ceil((placed.length + 1) / 4);
  const fatSector = directorySector + directorySectorCount;

  let fatSectorCount = 1;
  while (fatSector + fatSectorCount > fatSectorCount * (cfbSectorSize / 4)) {
    fatSectorCount = fatSectorCount + 1;
  }
  const totalSectors = fatSector + fatSectorCount;

  const fat = new Uint8Array(fatSectorCount * cfbSectorSize).fill(0xff);
  const fatView = new DataView(fat.buffer);
  const chain = (start: number, count: number): void => {
    for (let index = 0; index < count; index = index + 1) {
      fatView.setUint32((start + index) * 4, index + 1 === count ? cfbEndOfChain : start + index + 1, true);
    }
  };
  for (const { startSector, stream } of placed) {
    chain(startSector, cfbSectorsFor(stream.data.length));
  }
  chain(directorySector, directorySectorCount);
  for (let index = 0; index < fatSectorCount; index = index + 1) {
    fatView.setUint32((fatSector + index) * 4, cfbFatSector, true);
  }

  const directory = new Uint8Array(directorySectorCount * cfbSectorSize);
  directory.set(
    cfbDirectoryEntry("Root Entry", 5, placed.length === 0 ? cfbFreeSector : 1, cfbFreeSector, cfbEndOfChain, 0),
    0
  );
  placed.forEach(({ startSector, stream }, index) => {
    directory.set(
      cfbDirectoryEntry(
        stream.name,
        2,
        cfbFreeSector,
        index + 2 > placed.length ? cfbFreeSector : index + 2,
        startSector,
        stream.data.length
      ),
      (index + 1) * cfbDirectoryEntrySize
    );
  });
  for (let index = placed.length + 1; index < directorySectorCount * 4; index = index + 1) {
    directory.set(
      cfbDirectoryEntry("", 0, cfbFreeSector, cfbFreeSector, cfbFreeSector, 0),
      index * cfbDirectoryEntrySize
    );
  }

  const header = new Uint8Array(cfbSectorSize);
  const headerView = new DataView(header.buffer);
  header.set(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), 0);
  headerView.setUint16(0x18, 0x003e, true);
  headerView.setUint16(0x1a, 0x0003, true);
  headerView.setUint16(0x1c, 0xfffe, true);
  headerView.setUint16(0x1e, 0x0009, true);
  headerView.setUint16(0x20, 0x0006, true);
  headerView.setUint32(0x2c, fatSectorCount, true);
  headerView.setUint32(0x30, directorySector, true);
  headerView.setUint32(0x38, cfbMiniStreamCutoff, true);
  headerView.setUint32(0x3c, cfbEndOfChain, true);
  headerView.setUint32(0x44, cfbEndOfChain, true);
  for (let index = 0; index < 109; index = index + 1) {
    headerView.setUint32(0x4c + index * 4, index < fatSectorCount ? fatSector + index : cfbFreeSector, true);
  }

  const body = new Uint8Array(totalSectors * cfbSectorSize);
  for (const { startSector, stream } of placed) {
    body.set(stream.data, startSector * cfbSectorSize);
  }
  body.set(directory, directorySector * cfbSectorSize);
  body.set(fat, fatSector * cfbSectorSize);

  return concatBytes([header, body]);
};

const wordFibSize = 0x200;
// Parked inside the zeroed FIB region so it never lands on text bytes no matter
// how long the text grows; POI's guessCodePage reads it and garbage there can
// select a double-byte charset that mangles extraction.
const wordFontTableOffset = 0x180;

// HWPFOldDocument reads its table pointers at hard-coded absolute offsets in
// this stream (0x88 fcPlcfsed, 0xb8 fcPlcfbteChpx, 0xc0 fcPlcfbtePapx,
// 0xd0 fcSttbfffn, 0x160 fcClx), not through the FIB structure. Zero-length
// tables are safe, so the reserved 512-byte FIB region stays zero-filled apart
// from the fields set below. Text must stay ASCII: it is encoded as UTF-8 here
// but POI decodes it as cp1252.
const makeWordDocumentStream = (text: string): Uint8Array => {
  const body = textEncoder.encode(`${text}\r`);
  const fcMin = wordFibSize;
  // Pad the declared stream size to the mini-stream cutoff; anything smaller is
  // routed through the mini FAT that makeCompoundFile never builds.
  const stream = new Uint8Array(Math.max(cfbMiniStreamCutoff, cfbSectorsFor(fcMin + body.length) * cfbSectorSize));
  const view = new DataView(stream.buffer);
  stream.set(body, fcMin);

  view.setUint16(0x00, 0xa5dc, true); // wIdent
  view.setUint16(0x02, 101, true); // nFib
  view.setUint16(0x06, 0x0409, true); // lid
  view.setUint16(0x0c, 101, true); // nFibBack
  view.setUint32(0x18, fcMin, true); // fcMin
  view.setUint32(0x1c, fcMin + body.length, true); // fcMac
  view.setUint16(0x20, 0x000e, true); // csw
  view.setUint16(0x3e, 0x0016, true); // cslw
  view.setUint32(0x40, stream.length, true); // cbMac
  view.setUint32(0x54, body.length, true); // ccpText
  view.setUint32(0xd0, wordFontTableOffset, true); // fcSttbfffn

  return stream;
};

/**
 * Build a minimal legacy Word 6/95 document inside a hand-written OLE2
 * compound file.
 *
 * `nFib` below 106 routes POI down its `HWPFOldDocument` path, which reads the
 * text straight out of `WordDocument` between `fcMin` and `fcMac` and needs no
 * companion table stream.
 */
export const makeLiveDoc = (text = "hello live tika corpus"): Uint8Array =>
  makeCompoundFile([{ data: makeWordDocumentStream(text), name: "WordDocument" }]);
