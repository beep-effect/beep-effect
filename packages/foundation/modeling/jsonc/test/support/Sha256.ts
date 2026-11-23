import * as Str from "effect/String";

const K = Uint32Array.of(
  0x428a2f98,
  0x71374491,
  0xb5c0fbcf,
  0xe9b5dba5,
  0x3956c25b,
  0x59f111f1,
  0x923f82a4,
  0xab1c5ed5,
  0xd807aa98,
  0x12835b01,
  0x243185be,
  0x550c7dc3,
  0x72be5d74,
  0x80deb1fe,
  0x9bdc06a7,
  0xc19bf174,
  0xe49b69c1,
  0xefbe4786,
  0x0fc19dc6,
  0x240ca1cc,
  0x2de92c6f,
  0x4a7484aa,
  0x5cb0a9dc,
  0x76f988da,
  0x983e5152,
  0xa831c66d,
  0xb00327c8,
  0xbf597fc7,
  0xc6e00bf3,
  0xd5a79147,
  0x06ca6351,
  0x14292967,
  0x27b70a85,
  0x2e1b2138,
  0x4d2c6dfc,
  0x53380d13,
  0x650a7354,
  0x766a0abb,
  0x81c2c92e,
  0x92722c85,
  0xa2bfe8a1,
  0xa81a664b,
  0xc24b8b70,
  0xc76c51a3,
  0xd192e819,
  0xd6990624,
  0xf40e3585,
  0x106aa070,
  0x19a4c116,
  0x1e376c08,
  0x2748774c,
  0x34b0bcb5,
  0x391c0cb3,
  0x4ed8aa4a,
  0x5b9cca4f,
  0x682e6ff3,
  0x748f82ee,
  0x78a5636f,
  0x84c87814,
  0x8cc70208,
  0x90befffa,
  0xa4506ceb,
  0xbef9a3f7,
  0xc67178f2
);

const INITIAL = Uint32Array.of(
  0x6a09e667,
  0xbb67ae85,
  0x3c6ef372,
  0xa54ff53a,
  0x510e527f,
  0x9b05688c,
  0x1f83d9ab,
  0x5be0cd19
);

const rotr = (value: number, bits: number): number => (value >>> bits) | (value << (32 - bits));

const at = (words: Uint32Array, index: number): number => words[index] ?? 0;

const padWith0x80ZerosAndBigEndianBitLength = (bytes: Uint8Array): DataView => {
  const bitLength = bytes.length * 8;
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x1_0000_0000));
  view.setUint32(paddedLength - 4, bitLength >>> 0);
  return view;
};

const expandMessageScheduleOfOneBlock = (view: DataView, offset: number, w: Uint32Array): void => {
  for (let t = 0; t < 16; t++) {
    w[t] = view.getUint32(offset + t * 4);
  }
  for (let t = 16; t < 64; t++) {
    const w15 = at(w, t - 15);
    const w2 = at(w, t - 2);
    const s0 = rotr(w15, 7) ^ rotr(w15, 18) ^ (w15 >>> 3);
    const s1 = rotr(w2, 17) ^ rotr(w2, 19) ^ (w2 >>> 10);
    w[t] = (at(w, t - 16) + s0 + at(w, t - 7) + s1) >>> 0;
  }
};

const compressionRoundOverWorkingVariablesAThroughH = (v: Uint32Array, k: number, wt: number): void => {
  const [a, b, c, d, e, f, g, h] = [at(v, 0), at(v, 1), at(v, 2), at(v, 3), at(v, 4), at(v, 5), at(v, 6), at(v, 7)];
  const temp1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + k + wt) >>> 0;
  const temp2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
  v.copyWithin(1, 0, 7);
  v[4] = (d + temp1) >>> 0;
  v[0] = (temp1 + temp2) >>> 0;
};

const compressScheduledBlockIntoState = (state: Uint32Array, w: Uint32Array): void => {
  const v = Uint32Array.from(state);
  for (let t = 0; t < 64; t++) {
    compressionRoundOverWorkingVariablesAThroughH(v, at(K, t), at(w, t));
  }
  for (let i = 0; i < 8; i++) {
    state[i] = (at(state, i) + at(v, i)) >>> 0;
  }
};

/**
 * Computes the 32-byte SHA-256 digest of `bytes` synchronously.
 */
export const sha256 = (bytes: Uint8Array): Uint8Array => {
  const view = padWith0x80ZerosAndBigEndianBitLength(bytes);
  const state = Uint32Array.from(INITIAL);
  const w = new Uint32Array(64);
  for (let offset = 0; offset < view.byteLength; offset += 64) {
    expandMessageScheduleOfOneBlock(view, offset, w);
    compressScheduledBlockIntoState(state, w);
  }
  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) {
    outView.setUint32(i * 4, at(state, i));
  }
  return out;
};

/**
 * Lower-case hex encoding of a digest.
 */
export const toHex = (bytes: Uint8Array): string => {
  let hex = "";
  for (const byte of bytes) {
    hex += Str.padStart(2, "0")(byte.toString(16));
  }
  return hex;
};
