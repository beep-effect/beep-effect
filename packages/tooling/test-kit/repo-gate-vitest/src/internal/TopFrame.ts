/**
 * Top-frame selection for a failed test, ported from upstream
 * `packages/plugin/src/utils/process-failure.ts`: the first frame outside
 * framework code locates the failure and feeds its signature.
 *
 * @since 0.0.0
 */
import { FailureSignatureInput, failureSignature } from "@beep/gate-report/FailureSignature";
import { Location } from "@beep/gate-report/Item";
import * as A from "effect/Array";
import { constant, dual, flow, pipe } from "effect/Function";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Str from "effect/String";
import { framesOf, messageOf, readField } from "./ErrorText.ts";
import type { VitestError } from "./VitestShapes.ts";

type Frame = {
  readonly method: O.Option<string>;
  readonly file: string;
  readonly line: number;
  readonly column: number;
};

const NON_BACKTRACKING_FRAME_LINE = /^\s*at\s+(?:([\w$.<>[\] ]+?)\s+)?\(?([^\n)]+):(\d+):(\d+)\)?\s*$/u;

const UNKNOWN_FILE = "<unknown>";

const FRAMEWORK_MARKERS: ReadonlyArray<string> = ["/node_modules/", "vitest/dist", "@vitest/"];

/**
 * True for a frame inside Vitest, a dependency or Node itself.
 *
 * @since 0.0.0
 */
export const isFrameworkPath = (file: string): boolean =>
  Str.startsWith("node:")(file) || A.some(FRAMEWORK_MARKERS, (marker) => pipe(file, Str.includes(marker)));

const positionOf = (digits: string | undefined): number =>
  pipe(O.fromNullishOr(digits), O.flatMap(Num.parse), O.getOrElse(constant(0)));

const parseLine = (line: string): O.Option<Frame> =>
  pipe(
    O.fromNullishOr(NON_BACKTRACKING_FRAME_LINE.exec(line)),
    O.flatMap((match) =>
      O.map(
        O.fromNullishOr(match[2]),
        (file): Frame => ({
          method: O.fromNullishOr(match[1]),
          file,
          line: positionOf(match[3]),
          column: positionOf(match[4]),
        })
      )
    )
  );

/**
 * The frames of an error: Vitest's parsed frames when present (already
 * source-mapped), otherwise the `at` lines of its raw stack.
 *
 * @since 0.0.0
 */
export const errorFrames = (error: VitestError): ReadonlyArray<Frame> =>
  A.match(framesOf(error), {
    onNonEmpty: A.map(
      (frame): Frame =>
        P.isString(frame)
          ? O.getOrElse(parseLine(frame), () => ({ method: O.none(), file: UNKNOWN_FILE, line: 0, column: 0 }))
          : {
              method: O.fromNullishOr(frame.method),
              file: frame.file ?? UNKNOWN_FILE,
              line: frame.line ?? 0,
              column: frame.column ?? 0,
            }
    ),
    onEmpty: () =>
      pipe(
        readField(() => error.stack),
        O.map(Str.split("\n")),
        O.map(flow(A.map(parseLine), A.getSomes)),
        O.getOrElse((): ReadonlyArray<Frame> => [])
      ),
  });

/**
 * The first frame outside framework code with a known file.
 *
 * @since 0.0.0
 */
export const topFrame = (error: VitestError): O.Option<Frame> =>
  A.findFirst(errorFrames(error), (frame) => frame.file !== UNKNOWN_FILE && !isFrameworkPath(frame.file));

const relativeTo = (root: string, file: string): string =>
  Str.startsWith(`${root}/`)(file) ? Str.slice(root.length + 1)(file) : file;

/**
 * Where a failure happened: the top frame, its file made relative to the
 * package root when it lies inside it.
 *
 * @since 0.0.0
 */
export const failureLocation: {
  (root: string): (frame: Frame) => O.Option<Location>;
  (frame: Frame, root: string): O.Option<Location>;
} = dual(
  2,
  (frame: Frame, root: string): O.Option<Location> =>
    Location.makeOption({ file: relativeTo(root, frame.file), line: frame.line, column: frame.column })
);

/**
 * The failure signature of an error: none when no frame lies outside
 * framework code.
 *
 * @since 0.0.0
 */
export const errorSignature = (error: VitestError): O.Option<string> =>
  O.map(topFrame(error), (frame) =>
    failureSignature(
      FailureSignatureInput.make({
        errorName: O.getOrElse(
          readField(() => error.name),
          () => "Error"
        ),
        assertionMessage: messageOf(error),
        topFrameFunction: O.getOrElse(frame.method, () => "<anonymous>"),
        rawLine: O.some(frame.line),
      })
    )
  );
