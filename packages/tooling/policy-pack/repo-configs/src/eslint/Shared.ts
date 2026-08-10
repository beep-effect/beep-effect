/**
 * Shared ESLint helper schemas and path utilities.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { normalizePath as normalizeSchemaPath, PosixPath as PosixPathSchema } from "@beep/schema";

/**
 * POSIX-normalized path string schema re-exported for tooling config consumers.
 *
 * **Example** (Decode POSIX path schema)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as S from "effect/Schema"
 * import { PosixPath } from "@beep/repo-configs/eslint/Shared"
 *
 * const decoded = S.decodeUnknownSync(PosixPath)("packages/tooling/policy-pack/repo-configs")
 *
 * strictEqual(decoded, "packages/tooling/policy-pack/repo-configs")
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const PosixPath = PosixPathSchema;

/**
 * Type for {@link PosixPath}.
 *
 * **Example** (Alias PosixPath type)
 *
 * ```ts
 * import type { PosixPath } from "@beep/repo-configs/eslint/Shared"
 * type ExamplePath = PosixPath
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PosixPath = typeof PosixPath.Type;

/**
 * Normalize a file-system path to POSIX separators.
 *
 * **Example** (Normalize path separators)
 *
 * ```ts
 * import { normalizePath } from "@beep/repo-configs/eslint/Shared"
 * const path = normalizePath("packages/tooling/policy-pack/repo-configs/src/index.ts")
 * console.log(path)
 * ```
 *
 * @param value - Input path string that may contain native separators.
 * @returns Path string normalized to POSIX separators.
 * @category utilities
 * @since 0.0.0
 */
export const normalizePath = (value: string): PosixPath => normalizeSchemaPath(value);
