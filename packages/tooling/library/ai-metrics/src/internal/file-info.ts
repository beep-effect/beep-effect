/**
 * Shared filesystem metadata helpers for AI metrics source selection.
 *
 * @since 0.0.0
 */

import { thunk0 } from "@beep/utils/thunk";
import * as O from "effect/Option";
import type * as FileSystem from "effect/FileSystem";

/**
 * Convert Effect filesystem file sizes into plain numeric byte counts for JSON-safe metrics.
 *
 * @category utilities
 * @since 0.0.0
 */
export const fileSizeBytes = (info: FileSystem.File.Info): number => globalThis.Number(info.size);

/**
 * Convert an optional filesystem modification time to epoch milliseconds.
 *
 * @category utilities
 * @since 0.0.0
 */
export const modifiedAtMillis = (info: FileSystem.File.Info): number =>
  O.match(info.mtime, {
    onNone: thunk0,
    onSome: (mtime) => mtime.getTime(),
  });
