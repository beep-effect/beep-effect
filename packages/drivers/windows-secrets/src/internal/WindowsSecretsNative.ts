/**
 * `bun:ffi` bindings for Credential Manager (`advapi32.dll`), DPAPI
 * (`crypt32.dll`) and `kernel32.dll`.
 *
 * Imported only by the live layer after it has confirmed the host is Windows.
 * Every native buffer Windows hands back is copied into JS memory and freed
 * with `CredFree`/`LocalFree` before the operation returns; JS buffers that
 * held secret bytes are zeroed once the call is done with them.
 *
 * @internal
 * @since 0.0.0
 */

import { dlopen, FFIType, ptr, toArrayBuffer } from "bun:ffi";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import { SecretStoreFailure } from "../WindowsSecrets.errors.ts";
import {
  CRED_TYPE_GENERIC,
  CRYPTPROTECT_UI_FORBIDDEN,
  CredentialW,
  CredentialWFields,
  credentialBlob,
  decodeCredentialBlob,
  decodeDataBlob,
  decodeUtf16Le,
  ERROR_NOT_FOUND,
  encodeCredentialW,
  encodeDataBlob,
  NativeRegion,
  NULL_ADDRESS,
  utf16LeCString,
} from "./WindowsSecretsLayout.ts";
import type { SecretStoreOperation, SecretTarget } from "../WindowsSecrets.models.ts";
import type { WindowsSecretStoreShape } from "../WindowsSecrets.service.ts";

const openLibraries = () => {
  const advapi32 = dlopen("advapi32.dll", {
    // BOOL CredWriteW(PCREDENTIALW Credential, DWORD Flags)
    CredWriteW: { args: [FFIType.ptr, FFIType.u32], returns: FFIType.i32 },
    // BOOL CredReadW(LPCWSTR TargetName, DWORD Type, DWORD Flags, PCREDENTIALW* Credential)
    CredReadW: { args: [FFIType.ptr, FFIType.u32, FFIType.u32, FFIType.ptr], returns: FFIType.i32 },
    // BOOL CredDeleteW(LPCWSTR TargetName, DWORD Type, DWORD Flags)
    CredDeleteW: { args: [FFIType.ptr, FFIType.u32, FFIType.u32], returns: FFIType.i32 },
    // void CredFree(PVOID Buffer)
    CredFree: { args: [FFIType.ptr], returns: FFIType.void },
  });
  const crypt32 = dlopen("crypt32.dll", {
    // BOOL CryptProtectData(DATA_BLOB* in, LPCWSTR descr, DATA_BLOB* entropy, PVOID reserved,
    //                       CRYPTPROTECT_PROMPTSTRUCT* prompt, DWORD flags, DATA_BLOB* out)
    CryptProtectData: {
      args: [FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.u32, FFIType.ptr],
      returns: FFIType.i32,
    },
    // BOOL CryptUnprotectData(DATA_BLOB* in, LPWSTR* descr, DATA_BLOB* entropy, PVOID reserved,
    //                         CRYPTPROTECT_PROMPTSTRUCT* prompt, DWORD flags, DATA_BLOB* out)
    CryptUnprotectData: {
      args: [FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.u32, FFIType.ptr],
      returns: FFIType.i32,
    },
  });
  const kernel32 = dlopen("kernel32.dll", {
    // HLOCAL LocalFree(HLOCAL hMem)
    LocalFree: { args: [FFIType.ptr], returns: FFIType.ptr },
    // DWORD GetLastError(void)
    GetLastError: { args: [], returns: FFIType.u32 },
  });
  return { advapi32, crypt32, kernel32 };
};

type Libraries = ReturnType<typeof openLibraries>;

/** `ptr()` rejects empty views; a one-byte stand-in keeps the address valid. */
const addressOf = (bytes: Uint8Array): bigint => BigInt(ptr(bytes.byteLength === 0 ? new Uint8Array(1) : bytes));

/** Copy a Windows-owned region into JS memory. */
const copyRegion = (region: NativeRegion): Uint8Array =>
  region.byteLength === 0
    ? new Uint8Array(0)
    : new Uint8Array(toArrayBuffer(region.address, 0, region.byteLength)).slice();

const makeShape = (libraries: Libraries): WindowsSecretStoreShape => {
  const { advapi32, crypt32, kernel32 } = libraries;

  const failure = (operation: SecretStoreOperation, code: number, reason: string) =>
    SecretStoreFailure.make({ operation, code, reason });

  const get = Effect.fnUntraced(function* (target: SecretTarget) {
    const outCredential = new BigUint64Array(1);
    const ok = yield* Effect.sync(() =>
      advapi32.symbols.CredReadW(utf16LeCString(target), CRED_TYPE_GENERIC, 0, outCredential)
    );
    if (ok === 0) {
      const code = yield* Effect.sync(() => kernel32.symbols.GetLastError());
      return code === ERROR_NOT_FOUND
        ? O.none()
        : yield* failure("read", code, "CredReadW returned failure for the target.");
    }
    const credentialAddress = outCredential[0] ?? NULL_ADDRESS;
    return yield* Effect.sync(() => {
      const credential = new Uint8Array(toArrayBuffer(credentialAddress, 0, CredentialW.size));
      const blob = copyRegion(decodeCredentialBlob(credential));
      const value = decodeUtf16Le(blob);
      blob.fill(0);
      return O.some(Redacted.make(value));
    }).pipe(Effect.ensuring(Effect.sync(() => advapi32.symbols.CredFree(credentialAddress))));
  });

  const set = Effect.fnUntraced(function* (target: SecretTarget, value: Redacted.Redacted<string>) {
    const blob = yield* credentialBlob(target, Redacted.value(value));
    const ok = yield* Effect.sync(() => {
      const targetName = utf16LeCString(target);
      const credential = encodeCredentialW(
        CredentialWFields.make({
          targetName: addressOf(targetName),
          credentialBlob: NativeRegion.make({ address: addressOf(blob), byteLength: blob.byteLength }),
        })
      );
      const result = advapi32.symbols.CredWriteW(credential, 0);
      // Touching both buffers after the call keeps them reachable while Windows reads their addresses.
      targetName.fill(0);
      blob.fill(0);
      return result;
    });
    if (ok === 0) {
      const code = yield* Effect.sync(() => kernel32.symbols.GetLastError());
      return yield* failure("write", code, "CredWriteW returned failure for the target.");
    }
  });

  const remove = Effect.fnUntraced(function* (target: SecretTarget) {
    const ok = yield* Effect.sync(() => advapi32.symbols.CredDeleteW(utf16LeCString(target), CRED_TYPE_GENERIC, 0));
    if (ok === 0) {
      const code = yield* Effect.sync(() => kernel32.symbols.GetLastError());
      if (code !== ERROR_NOT_FOUND) {
        return yield* failure("delete", code, "CredDeleteW returned failure for the target.");
      }
    }
  });

  const dpapi = (operation: "protect" | "unprotect") =>
    Effect.fnUntraced(function* (bytes: Uint8Array) {
      const outBlob = new Uint8Array(encodeDataBlob(NativeRegion.make({ address: NULL_ADDRESS, byteLength: 0 })));
      const ok = yield* Effect.sync(() => {
        const inBlob = encodeDataBlob(NativeRegion.make({ address: addressOf(bytes), byteLength: bytes.byteLength }));
        return operation === "protect"
          ? crypt32.symbols.CryptProtectData(inBlob, null, null, null, null, CRYPTPROTECT_UI_FORBIDDEN, outBlob)
          : crypt32.symbols.CryptUnprotectData(inBlob, null, null, null, null, CRYPTPROTECT_UI_FORBIDDEN, outBlob);
      });
      if (ok === 0) {
        const code = yield* Effect.sync(() => kernel32.symbols.GetLastError());
        return yield* failure(
          operation,
          code,
          operation === "protect" ? "CryptProtectData returned failure." : "CryptUnprotectData returned failure."
        );
      }
      const region = decodeDataBlob(outBlob);
      return yield* Effect.sync(() => copyRegion(region)).pipe(
        Effect.ensuring(Effect.sync(() => kernel32.symbols.LocalFree(region.address)))
      );
    });

  return { get, set, remove, protect: dpapi("protect"), unprotect: dpapi("unprotect") };
};

/**
 * Open the Win32 libraries for the lifetime of the surrounding scope and build
 * the native store shape. A library that fails to load is a defect: these
 * DLLs ship with every supported Windows release.
 *
 * @internal
 */
export const acquireNativeSecretStore = Effect.acquireRelease(Effect.sync(openLibraries), (libraries) =>
  Effect.sync(() => {
    libraries.advapi32.close();
    libraries.crypt32.close();
    libraries.kernel32.close();
  })
).pipe(Effect.map(makeShape));
