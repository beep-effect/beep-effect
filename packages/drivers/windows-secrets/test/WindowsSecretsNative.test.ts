import { SecretStoreFailure, SecretTarget, SecretTooLarge } from "@beep/windows-secrets";
import {
  CredentialWFields,
  decodeCredentialBlob,
  decodeDataBlob,
  decodeUtf16Le,
  encodeCredentialW,
  encodeDataBlob,
  NativeRegion,
  utf16LeBytes,
} from "@beep/windows-secrets/internal/WindowsSecretsLayout";
import { acquireNativeSecretStore } from "@beep/windows-secrets/internal/WindowsSecretsNative";
import { beforeEach, describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Scope from "effect/Scope";
import * as Str from "effect/String";
import { vi } from "vitest";

// Every FFI entry point is replaced before importing the adapter. Addresses are
// synthetic IDs into test-owned byte buffers; no DLL or host memory is accessed.
const ffi = vi.hoisted(() => ({
  dlopen: vi.fn(),
  ptr: vi.fn<(bytes: Uint8Array) => number>(),
  toArrayBuffer: vi.fn<(address: bigint, offset: number, length: number) => ArrayBuffer>(),
}));
vi.mock("bun:ffi", () => ({
  ...ffi,
  FFIType: { ptr: "ptr", u32: "u32", i32: "i32", void: "void" },
}));

const operations: ReadonlyArray<"protect" | "unprotect"> = ["protect", "unprotect"];
const target = SecretTarget.make("beep/test/native");
const makeRuntime = () => {
  const memory = MutableHashMap.empty<bigint, Uint8Array>();
  let nextAddress = 100;
  const allocate = (bytes: Uint8Array) => {
    const address = BigInt(nextAddress++);
    MutableHashMap.set(memory, address, bytes);
    return address;
  };
  const bytesAt = (address: bigint) => O.getOrThrow(MutableHashMap.get(memory, address));
  ffi.ptr.mockImplementation((bytes) => Number(allocate(bytes)));
  ffi.toArrayBuffer.mockImplementation(
    (address, offset, length) => Uint8Array.from(bytesAt(address).subarray(offset, offset + length)).buffer
  );
  const symbols = {
    CredReadW: vi.fn<(_target: Uint8Array, type: number, flags: number, output: BigUint64Array) => number>(() => 1),
    CredWriteW: vi.fn<(_credential: Uint8Array, flags: number) => number>(() => 1),
    CredDeleteW: vi.fn<(_target: Uint8Array, type: number, flags: number) => number>(() => 1),
    CredFree: vi.fn<(_address: bigint) => void>(),
    CryptProtectData: vi.fn<
      (
        _input: Uint8Array,
        description: null,
        entropy: null,
        reserved: null,
        prompt: null,
        flags: number,
        output: Uint8Array
      ) => number
    >(() => 1),
    CryptUnprotectData: vi.fn<
      (
        _input: Uint8Array,
        description: null,
        entropy: null,
        reserved: null,
        prompt: null,
        flags: number,
        output: Uint8Array
      ) => number
    >(() => 1),
    LocalFree: vi.fn<(_address: bigint) => void>(),
    GetLastError: vi.fn(() => 5),
  };
  const closeCredential = vi.fn();
  const closeCrypto = vi.fn();
  const closeKernel = vi.fn();
  ffi.dlopen
    .mockReturnValueOnce({ symbols, close: closeCredential })
    .mockReturnValueOnce({ symbols, close: closeCrypto })
    .mockReturnValueOnce({ symbols, close: closeKernel });
  return { symbols, allocate, bytesAt, closeCredential, closeCrypto, closeKernel };
};

beforeEach(() => vi.resetAllMocks());

describe("Windows native adapter through synthetic FFI", { concurrent: false }, () => {
  it.effect("opens the expected DLL contracts and closes each handle with the scope", () =>
    Effect.gen(function* () {
      const runtime = makeRuntime();
      yield* Effect.acquireUseRelease(
        Scope.make(),
        (scope) => Scope.provide(acquireNativeSecretStore, scope),
        Scope.close
      );
      expect(ffi.dlopen.mock.calls).toMatchObject([
        ["advapi32.dll", { CredReadW: { returns: "i32" }, CredFree: { returns: "void" } }],
        ["crypt32.dll", { CryptProtectData: { returns: "i32" } }],
        ["kernel32.dll", { GetLastError: { returns: "u32" } }],
      ]);
      expect(runtime.closeCredential).toHaveBeenCalledOnce();
      expect(runtime.closeCrypto).toHaveBeenCalledOnce();
      expect(runtime.closeKernel).toHaveBeenCalledOnce();
    })
  );

  it.effect.each(["fixture-🔐", ""])("copies and frees the native credential %j", (value) =>
    Effect.gen(function* () {
      const { symbols, allocate } = makeRuntime();
      const blob = utf16LeBytes(value);
      const address = allocate(
        encodeCredentialW(
          CredentialWFields.make({
            targetName: 0n,
            credentialBlob: NativeRegion.make({ address: allocate(blob), byteLength: blob.byteLength }),
          })
        )
      );
      symbols.CredReadW.mockImplementation((name, type, flags, output) => {
        expect(decodeUtf16Le(name)).toBe(`${target}\0`);
        expect([type, flags]).toEqual([1, 0]);
        output[0] = address;
        return 1;
      });
      const store = yield* acquireNativeSecretStore;
      const got = yield* store.get(target);
      assertSome(O.map(got, Redacted.value), value);
      expect(symbols.CredFree).toHaveBeenCalledExactlyOnceWith(address);
      expect(blob).toEqual(utf16LeBytes(value));
    })
  );

  it.effect.each([1168, 5])("maps CredReadW failure code %i without freeing an absent allocation", (code) =>
    Effect.gen(function* () {
      const { symbols } = makeRuntime();
      symbols.CredReadW.mockReturnValue(0);
      symbols.GetLastError.mockReturnValue(code);
      const store = yield* acquireNativeSecretStore;
      if (code === 1168) {
        const got1 = yield* store.get(target);
        assertNone(got1);
      } else {
        const error = yield* Effect.flip(store.get(target));
        expect(error).toEqual(
          SecretStoreFailure.make({ operation: "read", code, reason: "CredReadW returned failure for the target." })
        );
        expect(error.message).toContain("read failed (Win32 error 5)");
      }
      expect(symbols.CredFree).not.toHaveBeenCalled();
    })
  );

  it.effect.each([1, 0])("encodes a credential write and scrubs input buffers on native result %i", (result) =>
    Effect.gen(function* () {
      const { symbols, bytesAt } = makeRuntime();
      let targetBuffer: Uint8Array = new Uint8Array(0);
      let secretBuffer: Uint8Array = new Uint8Array(0);
      symbols.CredWriteW.mockImplementation((credential, flags) => {
        const view = new DataView(credential.buffer);
        targetBuffer = bytesAt(view.getBigUint64(8, true));
        secretBuffer = bytesAt(decodeCredentialBlob(credential).address);
        expect(decodeUtf16Le(targetBuffer)).toBe(`${target}\0`);
        expect(decodeUtf16Le(secretBuffer)).toBe("fixture");
        expect(view.getUint32(4, true)).toBe(1);
        expect(view.getUint32(48, true)).toBe(2);
        expect(flags).toBe(0);
        return result;
      });
      const store = yield* acquireNativeSecretStore;
      const write = store.set(target, Redacted.make("fixture"));
      if (result === 1) {
        yield* write;
      } else {
        const flip2 = yield* Effect.flip(write);
        expect(flip2).toEqual(
          SecretStoreFailure.make({
            operation: "write",
            code: 5,
            reason: "CredWriteW returned failure for the target.",
          })
        );
      }
      expect(targetBuffer).toEqual(new Uint8Array(targetBuffer.byteLength));
      expect(secretBuffer).toEqual(new Uint8Array(secretBuffer.byteLength));
    })
  );

  it.effect("rejects oversize writes before calling native code", () =>
    Effect.gen(function* () {
      const { symbols } = makeRuntime();
      const store = yield* acquireNativeSecretStore;
      const flip3 = yield* Effect.flip(store.set(target, Redacted.make(Str.repeat(1281)("x"))));
      expect(flip3).toBeInstanceOf(SecretTooLarge);
      expect(symbols.CredWriteW).not.toHaveBeenCalled();
      expect(ffi.ptr).not.toHaveBeenCalled();
    })
  );

  it.effect.each([1, 1168, 5])("deletes idempotently and reports other native errors (%i)", (code) =>
    Effect.gen(function* () {
      const { symbols } = makeRuntime();
      symbols.CredDeleteW.mockReturnValue(code === 1 ? 1 : 0);
      symbols.GetLastError.mockReturnValue(code);
      const store = yield* acquireNativeSecretStore;
      if (code === 5) {
        const flip4 = yield* Effect.flip(store.remove(target));
        expect(flip4).toEqual(
          SecretStoreFailure.make({
            operation: "delete",
            code,
            reason: "CredDeleteW returned failure for the target.",
          })
        );
      } else {
        yield* store.remove(target);
      }
      expect(symbols.CredDeleteW).toHaveBeenCalledWith(utf16LeBytes(`${target}\0`), 1, 0);
    })
  );

  it.effect.each(operations)("copies %s output and frees Windows-owned bytes", (operation) =>
    Effect.gen(function* () {
      const { symbols, allocate, bytesAt } = makeRuntime();
      const input = new Uint8Array([1, 2, 3]);
      const nativeOutput = new Uint8Array([9, 8, 7, 6]);
      const address = allocate(nativeOutput);
      const nativeCall = operation === "protect" ? symbols.CryptProtectData : symbols.CryptUnprotectData;
      nativeCall.mockImplementation((blob, description, entropy, reserved, prompt, flags, output) => {
        const region = decodeDataBlob(blob);
        expect(bytesAt(region.address)).toBe(input);
        expect(region.byteLength).toBe(input.byteLength);
        expect([description, entropy, reserved, prompt, flags]).toEqual([null, null, null, null, 1]);
        output.set(encodeDataBlob(NativeRegion.make({ address, byteLength: nativeOutput.byteLength })));
        return 1;
      });
      const store = yield* acquireNativeSecretStore;
      const output = yield* store[operation](input);
      expect(output).toEqual(nativeOutput);
      expect(output).not.toBe(nativeOutput);
      output.fill(0);
      expect(nativeOutput).toEqual(new Uint8Array([9, 8, 7, 6]));
      expect(input).toEqual(new Uint8Array([1, 2, 3]));
      expect(symbols.LocalFree).toHaveBeenCalledExactlyOnceWith(address);
    })
  );

  it.effect.each(operations)("reports %s failure without freeing unallocated output", (operation) =>
    Effect.gen(function* () {
      const { symbols } = makeRuntime();
      const nativeCall = operation === "protect" ? symbols.CryptProtectData : symbols.CryptUnprotectData;
      nativeCall.mockReturnValue(0);
      const store = yield* acquireNativeSecretStore;
      const error = yield* Effect.flip(store[operation](new Uint8Array(0)));
      expect(error).toEqual(
        SecretStoreFailure.make({
          operation,
          code: 5,
          reason:
            operation === "protect" ? "CryptProtectData returned failure." : "CryptUnprotectData returned failure.",
        })
      );
      expect(ffi.ptr).toHaveBeenCalledWith(new Uint8Array(1));
      expect(symbols.LocalFree).not.toHaveBeenCalled();
    })
  );
});
