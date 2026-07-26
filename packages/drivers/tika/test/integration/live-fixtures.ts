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
