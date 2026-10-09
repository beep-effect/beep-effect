/**
 * Typed git introspection over Effect's ChildProcessSpawner.
 *
 * Read a repository's state at any ref without checking it out, plus a
 * clearly-marked mutating tier — checkout, fetch, submodule management,
 * sparse-checkout, config writes and staging — that changes it.
 *
 * @packageDocumentation
 */

export {
	BranchEntry,
	CommitInfo,
	CommitLogEntry,
	ConfigListEntry,
	DirtyWorktreeError,
	Git,
	GitCommandError,
	type GitShape,
	LsFilesEntry,
	LsRemoteEntry,
	LsTreeEntry,
	MergeConflictError,
	NameStatusEntry,
	NonFastForwardError,
	NotARepositoryError,
	RefEntry,
	StashEntry,
	StatusEntry,
	type StatusRenderOptions,
	SubmoduleStatusEntry,
	UnknownRefError,
	WorktreeEntry,
} from "./Git.ts";
export { GitCommand, GitConfigScope, type GitInvocation } from "./GitCommand.ts";
export {
	GitConfig,
	GitConfigDiagnostic,
	GitConfigEditError,
	GitConfigEntry,
	GitConfigInclude,
	GitConfigParseError,
	GitConfigSection,
} from "./GitConfig.ts";
export {
	Gitmodules,
	GitmodulesDecodeError,
	GitmodulesEntry,
	type GitmodulesParseError,
} from "./Gitmodules.ts";
