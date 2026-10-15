import { SecretTarget } from "@beep/windows-secrets";
import {
  CredentialW,
  CredentialWFields,
  credentialBlob,
  DataBlob,
  decodeCredentialBlob,
  decodeDataBlob,
  decodeUtf16Le,
  encodeCredentialW,
  encodeDataBlob,
  NativeRegion,
  utf16LeBytes,
  utf16LeCString,
} from "@beep/windows-secrets/internal/WindowsSecretsLayout";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Str from "effect/String";

const target = SecretTarget.make("beep/m365/refresh-token");

describe("UTF-16LE encoding", () => {
  it("encodes code units little-endian without a terminator", () => {
    expect([...utf16LeBytes("Aé")]).toEqual([0x41, 0x00, 0xe9, 0x00]);
  });

  it("appends a NUL code unit for wide C strings", () => {
    expect([...utf16LeCString("ab")]).toEqual([0x61, 0x00, 0x62, 0x00, 0x00, 0x00]);
  });

  it("round-trips surrogate pairs", () => {
    const value = "token-\u{1f511}-ü";
    expect(decodeUtf16Le(utf16LeBytes(value))).toBe(value);
  });
});

describe("CREDENTIALW layout", () => {
  it("writes fields at the documented x64 offsets", () => {
    const bytes = encodeCredentialW(
      CredentialWFields.make({
        targetName: 0x1122_3344_5566_7788n,
        credentialBlob: NativeRegion.make({ address: 0x0000_7fff_0000_1000n, byteLength: 42 }),
      })
    );
    const view = new DataView(bytes.buffer);
    expect(bytes.byteLength).toBe(80);
    expect(view.getUint32(CredentialW.flags, true)).toBe(0);
    expect(view.getUint32(CredentialW.type, true)).toBe(1);
    expect(view.getBigUint64(CredentialW.targetName, true)).toBe(0x1122_3344_5566_7788n);
    expect(view.getBigUint64(CredentialW.comment, true)).toBe(0n);
    expect(view.getUint32(CredentialW.credentialBlobSize, true)).toBe(42);
    expect(view.getBigUint64(CredentialW.credentialBlob, true)).toBe(0x0000_7fff_0000_1000n);
    expect(view.getUint32(CredentialW.persist, true)).toBe(2);
    expect(view.getUint32(CredentialW.attributeCount, true)).toBe(0);
    expect(view.getBigUint64(CredentialW.attributes, true)).toBe(0n);
    expect(view.getBigUint64(CredentialW.targetAlias, true)).toBe(0n);
    expect(view.getBigUint64(CredentialW.userName, true)).toBe(0n);
  });

  it("reads the blob region back", () => {
    const region = decodeCredentialBlob(
      encodeCredentialW(
        CredentialWFields.make({
          targetName: 1n,
          credentialBlob: NativeRegion.make({ address: 0xabcdn, byteLength: 7 }),
        })
      )
    );
    expect(region.byteLength).toBe(7);
    expect(region.address).toBe(0xabcdn);
  });
});

describe("DATA_BLOB layout", () => {
  it("round-trips cbData and pbData at offsets 0 and 8", () => {
    const bytes = encodeDataBlob(NativeRegion.make({ address: 0xdead_beefn, byteLength: 300 }));
    expect(bytes.byteLength).toBe(DataBlob.size);
    expect(new DataView(bytes.buffer).getUint32(4, true)).toBe(0);
    const region = decodeDataBlob(bytes);
    expect(region.byteLength).toBe(300);
    expect(region.address).toBe(0xdead_beefn);
  });
});

describe("credentialBlob", () => {
  it.effect("measures UTF-16LE bytes, not characters", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(credentialBlob(target, Str.repeat(641)("\u{1f511}")));
      expect(error.bytes).toBe(2564);
    })
  );
});
