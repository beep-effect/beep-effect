/**
 * Streaming, byte-exact patch identities shared by refresh and rewrite proof.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as Stream from "effect/Stream";

const $I = $RepoCliId.create("commands/Yeet/internal/PatchIdentity");

// The lane's patch for one file, verbatim: the per-file header block (blob
// ids, `---`/`+++` names) is dropped and hunk headers lose their line numbers,
// so the same edit on a moved base still matches. Content lines keep every
// byte, whitespace and invalid UTF-8 included. A `GIT binary patch` body is
// kept byte for byte too, but its delta copies source bytes by offset, so it
// cannot see a change to the bytes it copies; `PATCH_IDENTITY_DIFF_FLAGS`
// diffs every file as text for that reason.
const MarkerEncoder = new TextEncoder();
const asciiBytes = (text: string): Uint8Array => MarkerEncoder.encode(text);

const NewlineByte = 0x0a;
const NewlineBytes = asciiBytes("\n");
const HunkMarker = asciiBytes("@@");
const BinaryPatchMarker = asciiBytes("GIT binary patch");
const PatchHeaderPrefixes = A.map(["diff --git ", "index ", "--- ", "+++ "], asciiBytes);

// A line is classified on its first bytes alone: one byte past the longest
// marker tells an exact `GIT binary patch` line from a longer one.
const ClassifyPrefixLength = BinaryPatchMarker.length + 1;

const bytesStartWith =
  (marker: Uint8Array) =>
  (bytes: Uint8Array): boolean =>
    bytes.length >= marker.length && A.every(A.range(0, marker.length - 1), (at) => bytes[at] === marker[at]);

// The first bytes of one diff line: all of it when `complete`, otherwise
// `ClassifyPrefixLength` bytes of a longer line.
type LinePrefix = {
  readonly bytes: Uint8Array;
  readonly complete: boolean;
  readonly inBody: boolean;
};

// One line's contribution to the identity: `emit` is what enters the digest
// (none drops the line), and `streamRest` passes the line's remaining bytes
// through verbatim.
type LineVerdict = {
  readonly inBody: boolean;
  readonly emit: O.Option<Uint8Array>;
  readonly streamRest: boolean;
};

// The header block ends at the first hunk header or binary patch marker; from
// there every line is kept, hunk headers reduced to `@@`.
const classifyLine: (line: LinePrefix) => LineVerdict = Match.type<LinePrefix>().pipe(
  Match.when(
    ({ bytes }) => bytesStartWith(HunkMarker)(bytes),
    (): LineVerdict => ({ inBody: true, emit: O.some(HunkMarker), streamRest: false })
  ),
  Match.when(
    ({ inBody }) => inBody,
    ({ bytes }): LineVerdict => ({ inBody: true, emit: O.some(bytes), streamRest: true })
  ),
  Match.when(
    ({ bytes, complete }) =>
      complete && bytes.length === BinaryPatchMarker.length && bytesStartWith(BinaryPatchMarker)(bytes),
    ({ bytes }): LineVerdict => ({ inBody: true, emit: O.some(bytes), streamRest: true })
  ),
  Match.when(
    ({ bytes }) => A.some(PatchHeaderPrefixes, (prefix) => bytesStartWith(prefix)(bytes)),
    (): LineVerdict => ({ inBody: false, emit: O.none(), streamRest: false })
  ),
  Match.orElse(({ bytes }): LineVerdict => ({ inBody: false, emit: O.some(bytes), streamRest: true }))
);

/**
 * Digest the patch identity of one file's diff while it streams.
 *
 * **Details**
 *
 * The identity drops the per-file header block (`diff --git`, `index`, `---`,
 * `+++`), erases hunk-header line numbers so the same edit on a moved base
 * matches, and keeps every content byte as git wrote it: whitespace, `\r` and
 * bytes that are not valid UTF-8 all count. Lines split on the `\n` byte
 * alone and are classified on their first bytes, so only that short prefix and
 * a SHA-256 state are held; a diff of any size, or a single line of any
 * length, compares in linear time without a capture bound. Equal digests mean
 * equal identities.
 *
 * **Example** (Digest a streamed diff)
 *
 * ```ts
 * import { finalCheckPatchIdentityDigest } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 * import * as Stream from "effect/Stream"
 *
 * const digest = finalCheckPatchIdentityDigest(
 *   Stream.make(new TextEncoder().encode("diff --git a/x b/x\n@@ -1 +1 @@\n-a\n+b\n"))
 * )
 * console.log(Effect.isEffect(digest)) // true
 * ```
 *
 * @param diff - Raw `git diff` stdout bytes for one path.
 * @returns The hex SHA-256 of the patch identity.
 * @category parsing
 * @since 0.0.0
 */
export const finalCheckPatchIdentityDigest = <E, R>(
  diff: Stream.Stream<Uint8Array, E, R>
): Effect.Effect<string, E, R> =>
  Effect.suspend(() => {
    const hash = sha256.create();
    const prefix = new Uint8Array(ClassifyPrefixLength);
    let prefixLength = 0;
    let inBody = false;
    let anyKept = false;
    // None while the current line is still being classified.
    let verdict = O.none<LineVerdict>();

    const decide = (complete: boolean): LineVerdict => {
      const next = classifyLine({ bytes: prefix.slice(0, prefixLength), complete, inBody });
      inBody = next.inBody;
      if (O.isSome(next.emit)) {
        if (anyKept) hash.update(NewlineBytes);
        hash.update(next.emit.value);
        anyKept = true;
      }
      verdict = O.some(next);
      return next;
    };

    // Bytes of the current line, never containing `\n`.
    const feed = (bytes: Uint8Array): void => {
      const rest = O.match(verdict, {
        onSome: () => bytes,
        onNone: () => {
          const taken = Num.min(bytes.length, ClassifyPrefixLength - prefixLength);
          prefix.set(bytes.subarray(0, taken), prefixLength);
          prefixLength += taken;
          if (prefixLength === ClassifyPrefixLength) decide(false);
          return bytes.subarray(taken);
        },
      });
      if (rest.length > 0 && O.exists(verdict, ({ streamRest }) => streamRest)) hash.update(rest);
    };

    const endLine = (): void => {
      if (O.isNone(verdict)) decide(true);
      verdict = O.none();
      prefixLength = 0;
    };

    const scan = (chunk: Uint8Array): void => {
      let start = 0;
      let newline = chunk.indexOf(NewlineByte, start);
      while (newline !== -1) {
        feed(chunk.subarray(start, newline));
        endLine();
        start = newline + 1;
        newline = chunk.indexOf(NewlineByte, start);
      }
      feed(chunk.subarray(start));
    };

    return diff.pipe(
      Stream.runForEach((chunk) => Effect.sync(() => scan(chunk))),
      Effect.map(() => {
        endLine();
        return bytesToHex(hash.digest());
      })
    );
  }).pipe(Effect.withSpan($I`finalCheckPatchIdentityDigest`));

/**
 * The `git diff` flags a patch-identity read pins, so the bytes
 * {@link finalCheckPatchIdentityDigest} folds do not depend on local git config.
 *
 * **Details**
 *
 * The final-check refresh rule and the head-move classifier (rewrite and base
 * merge proofs) both read their patches with this list.
 *
 * Each flag overrides a default that config or attributes can change: colour,
 * renames, submodule visibility (`diff.ignoreSubmodules`, a submodule's
 * `ignore`) and format (`diff.submodule`), external diff and textconv, binary
 * detection (a `-diff` attribute), the abbreviated index line (`core.abbrev`),
 * the prefixes (`diff.noprefix`, `diff.mnemonicPrefix`), context and hunk
 * joining (`diff.context`, `diff.interHunkContext`), and the algorithm and
 * heuristic (`diff.algorithm`, a driver's `algorithm`, `diff.indentHeuristic`).
 * Callers put the global `--literal-pathspecs` before `diff`, so a path is
 * never read as a glob or as pathspec magic.
 *
 * **Example** (Read one path's patch identity)
 *
 * ```ts
 * import {
 *   finalCheckPatchIdentityDigest,
 *   PATCH_IDENTITY_DIFF_FLAGS,
 *   runGitFoldedStdout,
 * } from "@beep/repo-cli/test/Yeet"
 *
 * const digest = runGitFoldedStdout(
 *   ".",
 *   ["--literal-pathspecs", "diff", ...PATCH_IDENTITY_DIFF_FLAGS, "HEAD~1", "HEAD", "--", "README.md"],
 *   finalCheckPatchIdentityDigest
 * )
 * console.log(PATCH_IDENTITY_DIFF_FLAGS.includes("--no-textconv")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PATCH_IDENTITY_DIFF_FLAGS: ReadonlyArray<string> = [
  "--no-color",
  "--no-renames",
  "--ignore-submodules=none",
  "--submodule=short",
  "--no-ext-diff",
  "--no-textconv",
  "--text",
  "--full-index",
  "--src-prefix=a/",
  "--dst-prefix=b/",
  "--unified=3",
  "--inter-hunk-context=0",
  "--diff-algorithm=myers",
  "--indent-heuristic",
  // Left unpinned, because none of them can change the identity:
  // `diff.relative` is a no-op, git running at the checkout's top level, where paths are top-level.
  // `core.quotePath` respells only the per-file header lines the identity drops.
  // `diff.suppressBlankEmpty` drops the space before an empty context line, one to one.
];
