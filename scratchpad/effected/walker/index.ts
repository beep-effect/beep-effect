/**
 * Path traversal as Effect primitives.
 *
 * **Details**
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
	DescendResult,
	UnreadableDirectory,
	descend,
} from "./Descend.ts";
export { CompileAndExpandOptions, GlobExpansionError, compileAndExpand } from "./Expand.ts";
export { AscendOptions, Walker } from "./Walker.ts";
