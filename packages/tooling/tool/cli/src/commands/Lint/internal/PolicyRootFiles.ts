/**
 * Repository-root files a policy command reads instead of importing, and the
 * seals that declare them.
 *
 * **Details**
 *
 * The import walk covers code. A command also reads root files: a checker
 * configuration it hands to a tool, a configuration the tool it runs
 * discovers on its own, or `turbo.json`. Each route names such a file family
 * and the code-level string literals that mark a reader: a literal containing
 * one of the family's names, or a literal that is exactly the discovering
 * tool's name. A seal declares a family when a module of its command's
 * closure carries a marker, so a configuration edit replays only the policy
 * tasks whose command can read it. Comments, JSDoc examples and help text (a
 * `description` property or a `withDescription` argument) never match; an
 * over-match only costs a replay. The CLI shell's dispatch manifest names the
 * `fallow` command group, so the Fallow family stays a shared input.
 *
 * `turbo.json` has no tool marker: a command that runs Turbo is a quality
 * runner, which the fingerprint refuses as a policy script (`usesFastPath`),
 * and every root task already hashes the root `turbo.json` itself.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, O, Str } from "@beep/utils";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as MutableHashMap from "effect/MutableHashMap";
import * as Order from "effect/Order";
import { ts } from "ts-morph";
import { PolicyRootFileRoute } from "../PolicyFingerprint.schemas.ts";
import { OXLINT_CIRCULAR_CONFIG, OXLINT_DEPRECATED_APIS_CONFIG } from "./LintPackage.ts";
import type { PolicyClosure, PolicyFingerprintError } from "../PolicyFingerprint.schemas.ts";
import type { PolicySourceTree } from "./PolicyFingerprintGraph.ts";

/**
 * The root files every policy command loads: the root manifest and the
 * TypeScript configuration Bun resolves the CLI's imports through.
 *
 * @internal
 * @category constants
 * @since 0.0.0
 */
export const POLICY_SHARED_ROOT_FILES: ReadonlyArray<string> = ["package.json", "tsconfig.base.json", "tsconfig.json"];

/**
 * Root file families routed to the seals whose closure reads them.
 *
 * **Details**
 *
 * Oxlint loads the `@beep/lint-rules` JS plugins, and their TSDoc rule reads
 * `tsdoc.json`, so `tsdoc.json` travels with the Oxlint family. Fallow reads
 * the manual-tools plugin its `.fallowrc.jsonc` names.
 *
 * @internal
 * @category constants
 * @since 0.0.0
 */
export const POLICY_ROOT_FILE_ROUTES: ReadonlyArray<PolicyRootFileRoute> = [
  PolicyRootFileRoute.make({
    files: [
      OXLINT_CIRCULAR_CONFIG,
      OXLINT_DEPRECATED_APIS_CONFIG,
      ".oxlintrc.docs.json",
      ".oxlintrc.json",
      "tsdoc.json",
    ],
    names: [".oxlintrc", "tsdoc.json"],
    tools: ["oxlint"],
  }),
  PolicyRootFileRoute.make({ files: ["biome.jsonc"], names: ["biome.json"], tools: ["biome", "@biomejs/biome"] }),
  PolicyRootFileRoute.make({ files: ["_typos.toml"], names: ["_typos.toml"], tools: ["typos"] }),
  PolicyRootFileRoute.make({
    files: [".fallowrc.jsonc", "fallow-plugin-manual-development-tools.json"],
    names: [".fallowrc", "fallow-plugin-"],
    tools: ["fallow"],
  }),
  PolicyRootFileRoute.make({ files: ["standards/lint-policy.sweeps.jsonc"], names: ["lint-policy.sweeps"], tools: [] }),
  PolicyRootFileRoute.make({
    files: ["standards/policy-tools.fingerprint.json"],
    names: ["policy-tools.fingerprint"],
    tools: [],
  }),
  PolicyRootFileRoute.make({ files: ["turbo.json"], names: ["turbo.json"], tools: [] }),
];

const TYPESCRIPT_SOURCE = /\.(?:ts|tsx|mts|cts)$/;
const MARKERS = A.flatMap(POLICY_ROOT_FILE_ROUTES, (route) => [...route.names, ...route.tools]);

const routeMarkedBy = (literal: string) => (route: PolicyRootFileRoute) =>
  A.contains(route.tools, literal) || A.some(route.names, (name) => Str.includes(name)(literal));

const HELP_TEXT = "description";

// A `description: …` property or a `….withDescription(…)` call holds help text, not a path.
const isHelpText = (node: ts.Node): boolean =>
  (ts.isPropertyAssignment(node) &&
    (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) &&
    node.name.text === HELP_TEXT) ||
  (ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === "withDescription");

/**
 * The code-level string literals of one TypeScript module: string and
 * no-substitution template literals plus every template's static text,
 * outside help text.
 *
 * @param file - The module path, for the parser's dialect.
 * @param text - The module source.
 * @returns The literal texts in document order.
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const codeStringLiterals: {
  (text: string): (file: string) => ReadonlyArray<string>;
  (file: string, text: string): ReadonlyArray<string>;
} = dual(2, (file: string, text: string): ReadonlyArray<string> => {
  const literals: Array<string> = [];
  const visit = (node: ts.Node): void => {
    if (isHelpText(node)) return;
    if (ts.isStringLiteralLike(node)) literals.push(node.text);
    else if (ts.isTemplateExpression(node))
      literals.push(node.head.text, ...A.map(node.templateSpans, (span) => span.literal.text));
    ts.forEachChild(node, visit);
  };
  const kind = Str.endsWith("x")(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  visit(ts.createSourceFile(file, text, ts.ScriptTarget.Latest, false, kind));
  return literals;
});

/**
 * The route files one module's source marks as read.
 *
 * @param file - The module path.
 * @param text - The module source.
 * @returns The marked route files, sorted and deduplicated.
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const moduleRootFileReads: {
  (text: string): (file: string) => ReadonlyArray<string>;
  (file: string, text: string): ReadonlyArray<string>;
} = dual(
  2,
  (file: string, text: string): ReadonlyArray<string> =>
    // Most modules name no marker at all; skip their parse.
    A.some(MARKERS, (marker) => Str.includes(marker)(text))
      ? A.sort(
          A.dedupe(
            A.flatMap(codeStringLiterals(file, text), (literal) =>
              A.flatMap(POLICY_ROOT_FILE_ROUTES, (route) => (routeMarkedBy(literal)(route) ? route.files : []))
            )
          ),
          Order.String
        )
      : A.empty<string>()
);

/**
 * Build a reader that lists the routed root files a closure reads.
 *
 * **Details**
 *
 * Every reached module is scanned, and every TypeScript file under the `src`
 * of a workspace the walk could not follow (an opaque dynamic import). Module
 * results are cached, so one reader serves every seal of a computation.
 *
 * @param tree - The source tree the closure was walked over.
 * @returns The closure reader.
 * @internal
 * @category constructors
 * @since 0.0.0
 */
export const makeRootFileReader = (tree: PolicySourceTree) => {
  const cache = MutableHashMap.empty<string, ReadonlyArray<string>>();
  const reads = (file: string): Effect.Effect<ReadonlyArray<string>, PolicyFingerprintError> =>
    O.match(MutableHashMap.get(cache, file), {
      onSome: Effect.succeed,
      onNone: () =>
        Effect.map(tree.read(file), (text) => {
          const files = O.match(text, {
            onNone: A.empty<string>,
            onSome: (source) => moduleRootFileReads(file, source),
          });
          MutableHashMap.set(cache, file, files);
          return files;
        }),
    });
  return Effect.fnUntraced(function* (closure: PolicyClosure) {
    const opaque = yield* Effect.forEach(A.fromIterable(closure.opaqueWorkspaces), (directory) =>
      tree.files(`${directory}/src`)
    );
    const modules = [...closure.modules, ...A.flatten(opaque)];
    const files = yield* Effect.forEach(
      A.filter(modules, (file) => TYPESCRIPT_SOURCE.test(file)),
      reads
    );
    return A.sort(A.dedupe(A.flatten(files)), Order.String);
  });
};
