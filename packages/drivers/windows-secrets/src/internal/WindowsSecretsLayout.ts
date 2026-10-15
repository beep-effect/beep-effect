/**
 * Pure x64 struct layouts and string encodings for the Win32 secret APIs.
 *
 * Nothing here touches `bun:ffi`; pointers are plain `bigint` addresses, so
 * the encoders run and are tested on any host.
 *
 * @internal
 * @since 0.0.0
 */

import { $WindowsSecretsId } from "@beep/identity";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import { SecretTooLarge } from "../WindowsSecrets.errors.ts";
import { CredentialBlobMaxBytes } from "../WindowsSecrets.models.ts";
import type { SecretTarget } from "../WindowsSecrets.models.ts";

const $I = $WindowsSecretsId.create("internal/WindowsSecretsLayout");

/** Null pointer address. @internal */
export const NULL_ADDRESS = BigInt(0);
/** `CRED_TYPE_GENERIC`. @internal */
export const CRED_TYPE_GENERIC = 1;
/** `CRED_PERSIST_LOCAL_MACHINE`: survives logoff, stays on this machine. @internal */
export const CRED_PERSIST_LOCAL_MACHINE = 2;
/** `ERROR_NOT_FOUND`, returned by `CredReadW`/`CredDeleteW` for a missing target. @internal */
export const ERROR_NOT_FOUND = 1168;
/** `CRYPTPROTECT_UI_FORBIDDEN`: fail instead of prompting. @internal */
export const CRYPTPROTECT_UI_FORBIDDEN = 0x1;

/**
 * `CREDENTIALW` on x64 (LLP64, 8-byte pointers, natural alignment):
 *
 * | offset | field              | type      |
 * | ------ | ------------------ | --------- |
 * | 0      | Flags              | DWORD     |
 * | 4      | Type               | DWORD     |
 * | 8      | TargetName         | LPWSTR    |
 * | 16     | Comment            | LPWSTR    |
 * | 24     | LastWritten        | FILETIME  |
 * | 32     | CredentialBlobSize | DWORD     |
 * | 40     | CredentialBlob     | LPBYTE    | (4 bytes padding at 36)
 * | 48     | Persist            | DWORD     |
 * | 52     | AttributeCount     | DWORD     |
 * | 56     | Attributes         | PCRED_ATTRIBUTEW |
 * | 64     | TargetAlias        | LPWSTR    |
 * | 72     | UserName           | LPWSTR    |
 *
 * sizeof = 80.
 *
 * @internal
 */
export const CredentialW = {
  size: 80,
  flags: 0,
  type: 4,
  targetName: 8,
  comment: 16,
  lastWritten: 24,
  credentialBlobSize: 32,
  credentialBlob: 40,
  persist: 48,
  attributeCount: 52,
  attributes: 56,
  targetAlias: 64,
  userName: 72,
} as const;

/**
 * `DATA_BLOB` (`CRYPT_INTEGER_BLOB`) on x64: `cbData` DWORD at 0, 4 bytes of
 * padding, `pbData` BYTE* at 8; sizeof = 16.
 *
 * @internal
 */
export const DataBlob = {
  size: 16,
  cbData: 0,
  pbData: 8,
} as const;

/**
 * Address and length of a native byte region read out of a struct.
 *
 * @internal
 */
export class NativeRegion extends S.Opaque<NativeRegion, { readonly brand: unique symbol }>()(
  S.Struct({
    address: S.BigInt,
    byteLength: S.Int,
  }).pipe(
    $I.annoteSchema("NativeRegion", {
      description: "Native address and byte length of a buffer owned by Windows.",
    })
  )
) {}

const encodeUtf16Le = (value: string, terminatorUnits: number): Uint8Array<ArrayBuffer> => {
  const bytes = new Uint8Array((value.length + terminatorUnits) * 2);
  const view = new DataView(bytes.buffer);
  for (let index = 0; index < value.length; index++) {
    view.setUint16(index * 2, value.charCodeAt(index), true);
  }
  return bytes;
};

/**
 * Caller-supplied fields of a `CREDENTIALW` written by `CredWriteW`.
 *
 * @internal
 */
export class CredentialWFields extends S.Opaque<CredentialWFields, { readonly brand: unique symbol }>()(
  S.Struct({
    targetName: S.BigInt,
    credentialBlob: NativeRegion,
  }).pipe(
    $I.annoteSchema("CredentialWFields", {
      description: "Target-name address and credential blob region for a generic credential write.",
    })
  )
) {}

/**
 * Encode a string as UTF-16LE code units without a terminator.
 *
 * @internal
 */
export const utf16LeBytes = (value: string): Uint8Array<ArrayBuffer> => encodeUtf16Le(value, 0);

/**
 * Encode a string as a NUL-terminated UTF-16LE wide string (`LPCWSTR`).
 *
 * @internal
 */
export const utf16LeCString = (value: string): Uint8Array<ArrayBuffer> => encodeUtf16Le(value, 1);

const utf16LeDecoder = new TextDecoder("utf-16le");

/**
 * Decode UTF-16LE bytes (no terminator) back into a string.
 *
 * @internal
 */
export const decodeUtf16Le = (bytes: Uint8Array): string => utf16LeDecoder.decode(bytes);

/**
 * Encode a secret value as a Credential Manager blob, failing when it exceeds
 * the 2,560-byte cap.
 *
 * @internal
 */
export const credentialBlob: {
  (value: string): (target: SecretTarget) => Effect.Effect<Uint8Array, SecretTooLarge>;
  (target: SecretTarget, value: string): Effect.Effect<Uint8Array, SecretTooLarge>;
} = dual(2, (target: SecretTarget, value: string): Effect.Effect<Uint8Array, SecretTooLarge> => {
  const bytes = utf16LeBytes(value);
  return bytes.byteLength > CredentialBlobMaxBytes
    ? Effect.fail(SecretTooLarge.make({ target, bytes: bytes.byteLength, limit: CredentialBlobMaxBytes }))
    : Effect.succeed(bytes);
});

/**
 * Build a `CREDENTIALW` for a generic, machine-persisted credential.
 *
 * @internal
 */
export const encodeCredentialW = (fields: CredentialWFields): Uint8Array<ArrayBuffer> => {
  const bytes = new Uint8Array(CredentialW.size);
  const view = new DataView(bytes.buffer);
  view.setUint32(CredentialW.flags, 0, true);
  view.setUint32(CredentialW.type, CRED_TYPE_GENERIC, true);
  view.setBigUint64(CredentialW.targetName, fields.targetName, true);
  view.setUint32(CredentialW.credentialBlobSize, fields.credentialBlob.byteLength, true);
  view.setBigUint64(CredentialW.credentialBlob, fields.credentialBlob.address, true);
  view.setUint32(CredentialW.persist, CRED_PERSIST_LOCAL_MACHINE, true);
  return bytes;
};

/**
 * Read the credential blob region out of a `CREDENTIALW` returned by `CredReadW`.
 *
 * @internal
 */
export const decodeCredentialBlob = (credential: Uint8Array): NativeRegion => {
  const view = new DataView(credential.buffer, credential.byteOffset, credential.byteLength);
  return NativeRegion.make({
    address: view.getBigUint64(CredentialW.credentialBlob, true),
    byteLength: view.getUint32(CredentialW.credentialBlobSize, true),
  });
};

/**
 * Build a `DATA_BLOB` describing `cbData` bytes at `pbData`.
 *
 * @internal
 */
export const encodeDataBlob = (region: NativeRegion): Uint8Array<ArrayBuffer> => {
  const bytes = new Uint8Array(DataBlob.size);
  const view = new DataView(bytes.buffer);
  view.setUint32(DataBlob.cbData, region.byteLength, true);
  view.setBigUint64(DataBlob.pbData, region.address, true);
  return bytes;
};

/**
 * Read a `DATA_BLOB` filled in by `CryptProtectData`/`CryptUnprotectData`.
 *
 * @internal
 */
export const decodeDataBlob = (blob: Uint8Array): NativeRegion => {
  const view = new DataView(blob.buffer, blob.byteOffset, blob.byteLength);
  return NativeRegion.make({
    address: view.getBigUint64(DataBlob.pbData, true),
    byteLength: view.getUint32(DataBlob.cbData, true),
  });
};
