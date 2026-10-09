/**
 * Path traversal as Effect primitives.
 *
 * Upward: ascend a directory chain toward the filesystem root and return the
 * first candidate satisfying a predicate. Each probe absorbs its own failure,
 * so one unreadable ancestor never hides a valid match above it.
 *
 * Downward: descend from a compiled `@effected/glob` pattern's literal prefix
 * and return the matching file paths. Unlike the upward walk, an unreadable
 * subtree fails typed by default — a swallowed subtree is silently missing
 * membership, not a candidate that did not match.
 *
 * @packageDocumentation
 */

export {
	DescendError,
	type DescendOptions,
	type DescendRecordOptions,
	type DescendResult,
	type UnreadableDirectory,
	descend,
} from "./Descend.ts";
export { type CompileAndExpandOptions, GlobExpansionError, compileAndExpand } from "./Expand.ts";
export { type AscendOptions, Walker } from "./Walker.ts";
