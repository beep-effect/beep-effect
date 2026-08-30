/**
 * Shared filesystem metadata helpers for AI metrics source selection.
 *
 * @since 0.0.0
 */

import * as O from "effect/Option";
import type { FileSystem } from "effect";

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
    onNone: () => 0,
    onSome: (mtime) => mtime.getTime(),
  });
