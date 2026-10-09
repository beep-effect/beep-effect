/**
 * Narrows the `number | bigint` resource ids `@octokit/types` v17 declares
 * back to `number`.
 *
 * GitHub's REST payloads arrive through `JSON.parse`, which never produces a
 * bigint, so at runtime the value is always a number today — the union is
 * upstream future-proofing for ids beyond 2^53. If GitHub ever crosses that
 * line, the `id: number` fields on this package's public records have to be
 * redesigned; a runtime coercion here could not paper over it.
 *
 * Leaf module: imports nothing.
 */
export const numericId = (id: number | bigint): number => Number(id);
