/**
 * Inline rule fixture sources.
 *
 * Each rule has an `invalid` source (expected to trip the rule N times) and a `valid`
 * source (expected to be silent). Keeping these as string constants — rather than
 * on-disk `.ts` fixture files — avoids the intentional violations being linted/parsed by
 * Biome, tsc, and ESLint; the harness writes each source to a temp file before linting.
 */

import * as A from "effect/Array";
import type { RuleName } from "@beep/lint-rules";

export type RuleSource = {
  readonly invalid: string;
  readonly invalidCount: number;
  readonly valid: string;
  readonly messageIncludes: string;
};

export const SOURCES: { readonly [K in RuleName]: RuleSource } = {
  "no-citation-optional-invocation": {
    invalidCount: 36,
    messageIncludes: "citation request authority must be explicit",
    invalid:
      "const v000 = Effect.serviceOption(CitationTextBudget); const v001 = Context.getOption(context, CitationTextBudget); const v010 = Effect.serviceOption(UC.CitationTextBudget); const v011 = Context.getOption(context, UC.CitationTextBudget); const v100 = Effect.serviceOption(CitationOperationAdmission); const v101 = Context.getOption(context, CitationOperationAdmission); const v110 = Effect.serviceOption(UC.CitationOperationAdmission); const v111 = Context.getOption(context, UC.CitationOperationAdmission); const v200 = Effect.serviceOption(CitationInvocation); const v201 = Context.getOption(context, CitationInvocation); const v210 = Effect.serviceOption(UC.CitationInvocation); const v211 = Context.getOption(context, UC.CitationInvocation); const added00 = Context.getOption(CitationTextBudget); const added01 = Context.getOrUndefined(context, CitationTextBudget); const added02 = Context.getOrUndefined(CitationTextBudget); const added03 = serviceOption(CitationTextBudget); const added10 = Context.getOption(CitationOperationAdmission); const added11 = Context.getOrUndefined(context, CitationOperationAdmission); const added12 = Context.getOrUndefined(CitationOperationAdmission); const added13 = serviceOption(CitationOperationAdmission); const added20 = Context.getOption(CitationInvocation); const added21 = Context.getOrUndefined(context, CitationInvocation); const added22 = Context.getOrUndefined(CitationInvocation); const added23 = serviceOption(CitationInvocation); const added30 = Context.getOption(UC.CitationTextBudget); const added31 = Context.getOrUndefined(context, UC.CitationTextBudget); const added32 = Context.getOrUndefined(UC.CitationTextBudget); const added33 = serviceOption(UC.CitationTextBudget); const added40 = Context.getOption(UC.CitationOperationAdmission); const added41 = Context.getOrUndefined(context, UC.CitationOperationAdmission); const added42 = Context.getOrUndefined(UC.CitationOperationAdmission); const added43 = serviceOption(UC.CitationOperationAdmission); const added50 = Context.getOption(UC.CitationInvocation); const added51 = Context.getOrUndefined(context, UC.CitationInvocation); const added52 = Context.getOrUndefined(UC.CitationInvocation); const added53 = serviceOption(UC.CitationInvocation);",
    valid:
      "const a = Effect.serviceOption(CitationNativeProcessAdmission); const b = Context.getOption(context, UC.CitationNativeProcessAdmission); const c = reserveCitationInvocationText(4);",
  },
  "no-file-url-pathname": {
    invalidCount: 4,
    messageIncludes: "NodeURL.fileURLToPath(new URL(...))",
    invalid: A.join(
      [
        'const a = new URL("./space here.ts", import.meta.url).pathname;',
        "const b = new URL(`./${name}.ts`, import.meta.url).pathname;",
        "const c = new URL(import.meta.url).pathname;",
        'const d = decodeURIComponent(new URL("./100%25.ts", import.meta.url).pathname);',
      ],
      "\n"
    ),
    valid: A.join(
      [
        'const a = NodeURL.fileURLToPath(new URL("./space here.ts", import.meta.url));',
        'const b = new URL("https://example.com/path").pathname;',
        "const c = new URL(request.url, baseUrl).pathname;",
        'const url = new URL("./asset", import.meta.url);',
        'const path = url.protocol === "file:" ? NodeURL.fileURLToPath(url) : url.pathname;',
        'const d = "new URL(./file, import.meta.url).pathname";',
        '// new URL("./file", import.meta.url).pathname',
      ],
      "\n"
    ),
  },
  "no-native-error": {
    invalidCount: 2,
    messageIncludes: "native Error",
    invalid: A.join(["export const boom = () => new Error('nope');", "export const boom2 = () => new Error();"], "\n"),
    valid: "export const ok = () => 'no native error here';",
  },
  "no-bigint-literals": {
    invalidCount: 3,
    messageIncludes: "BigInt literals",
    invalid: A.join(["export const a = 1n;", "export const b = 0xffn;", "export const c = 0b1010n;"], "\n"),
    valid: A.join(["export const a = BigInt(1);", "export const b = BigInt('255');", "export const c = 42;"], "\n"),
  },
  "no-empty-named-blocks": {
    invalidCount: 1,
    messageIncludes: "empty named import",
    invalid: "import {} from './side-effect.ts';",
    valid: A.join(["import { join } from 'node:path';", "export const p = join('a', 'b');"], "\n"),
  },
  "prefer-array-flat-map": {
    invalidCount: 1,
    messageIncludes: ".map(...).flat()",
    invalid: "export const flattened = [[1], [2]].map((x) => x).flat();",
    valid: A.join(
      ["export const flattened = [[1], [2]].flatMap((x) => x);", "export const mapped = [1, 2].map((x) => x + 1);"],
      "\n"
    ),
  },
  "prefer-exact-optional-key": {
    invalidCount: 33,
    messageIncludes: "exact optional keys",
    invalid: A.join(
      [
        "import * as S from 'effect/Schema';",
        "import * as Schema from 'effect/Schema';",
        "import * as Codec from 'effect/Schema';",
        "import type * as Shape from 'effect/Schema';",
        "import { optional } from 'effect/Schema';",
        "import { a, optional as o } from 'effect/Schema';",
        "import type { OptionFromOptional } from 'effect/Schema';",
        "export const Call = S.Struct({ a: S.optional(S.String) });",
        "export const Piped = S.Struct({ b: X.pipe(S.optional) });",
        "const fields = { c: S.optional(S.Number) };",
        "export const Hoisted = S.Struct(fields);",
        "export const Aliased = Schema.Struct({ d: Schema.optional(Schema.String) });",
        "export const Siblings = S.Struct({ e: S.withDecodingDefault(() => 'x')(S.String), f: S.OptionFromOptional(S.Number) });",
        "export const Mapped = S.Struct({ g: S.String }).mapFields(Struct.map(S.optional));",
        "const opt = S.optional;",
        "export type Typed = S.optional<typeof S.String>;",
        "export type Queried = typeof S.optional;",
        "export const Tuple = S.Tuple([S.String, S.optional(S.Number)]);",
        "export const Computed = S['optional'];",
        "export const ArbitraryAlias = Codec.optional(Codec.String);",
        "export const AliasDefault = Codec.withDecodingDefault(() => 'x')(Codec.String);",
        "export const AliasOption = Codec.OptionFromOptional(Codec.String);",
        "export const AliasComputed = Codec['optional'];",
        "export type AliasType = Codec.optional<typeof Codec.String>;",
        "export type TypeOnlyAlias = Shape.optional<Shape.String>;",
        "import DefaultSchema, * as Combined from 'effect/Schema';",
        "export const CombinedAlias = Combined.optional(Combined.String);",
        "export function siblingScopes() { { const Codec = { optional: (x: number) => x }; Codec.optional(1); } return Codec.optional(Codec.String); }",
        "export function importedType(Codec: unknown) { type T = Codec.optional<typeof S.String>; return 1; }",
        "export function typeNameInAnnotation(other: { Codec: number }) { return Codec.optional(Codec.String); }",
        "export function nestedCallbackType(cb: (Codec: number) => void) { return Codec.optional(Codec.String); }",
        "export function nestedMethodType(opts: { map(Codec: number): number }) { return Codec.withDecodingDefault(() => 'x')(Codec.String); }",
        "export function nestedDefault(x = (Codec: number) => Codec) { return Codec.OptionFromOptional(Codec.String); }",
        "export function nestedQuery(cb: (Codec: number) => void) { type T = typeof Codec.optional; return 1; }",
        "export class NestedConstructor { constructor(cb: (Codec: number) => void) { Codec.optional(Codec.String); } }",
        "import DefaultSchema2, { optional as combinedOptional, OptionFromOptional as combinedOption } from 'effect/Schema';",
        "export { withDecodingDefault } from 'effect/Schema';",
      ],
      "\n"
    ),
    valid: A.join(
      [
        "import { optionalKey as k } from 'effect/Schema';",
        "import { optional as other } from 'effect/Other';",
        "export { optionalKey } from 'effect/Schema';",
        "export const Exact = S.Struct({ a: S.optionalKey(S.String), b: S.optionalKey(S.UndefinedOr(S.Number)) });",
        "export const Keyed = S.Struct({ c: S.withDecodingDefaultKey(() => 'x')(S.String), d: S.OptionFromOptionalKey(S.String) });",
        "export const Flagged = Flag.optional(1);",
        "export const Local = { optional: 1 }.optional;",
        "const S = { optional: (x: number) => x };",
        "export const LocalS = S.optional(1);",
        "const Schema = { OptionFromOptional: (x: number) => x };",
        "export const LocalSchema = Schema.OptionFromOptional(1);",
        "import * as Codec from 'effect/Schema';",
        "export const AliasExact = Codec.optionalKey(Codec.String);",
        "export const AliasExplicit = Codec.optionalKey(Codec.UndefinedOr(Codec.String));",
        "import { optionalKey as optional } from 'effect/Schema';",
        "import type { withDecodingDefaultKey as withDecodingDefault } from 'effect/Schema';",
        "export { optionalKey as optional, OptionFromOptionalKey as OptionFromOptional } from 'effect/Schema';",
        "export function localParameter(Codec: { optional: (x: number) => number }) { return Codec.optional(1); }",
        "export const localArrow = (Codec: { optional: (x: number) => number }) => Codec.optional(1);",
        "export const localExpression = function (Codec: { optional: (x: number) => number }) { return Codec.optional(1); };",
        "export const methods = { local(Codec: { optional: (x: number) => number }) { return Codec.optional(1); } };",
        "export class LocalMethods { local(Codec: { optional: (x: number) => number }) { return Codec.optional(1); } }",
        "export class LocalConstructor { constructor(Codec: { optional: (x: number) => number }) { Codec.optional(1); } }",
        "export class LocalPropertyConstructor { constructor(private Codec: { optional: (x: number) => number }) { Codec.optional(1); } }",
        "{ const Codec = { optional: (x: number) => x }; Codec.optional(1); }",
        "export function localBinding() { const Codec = { optional: (x: number) => x }; return Codec.optional(1); }",
        "export function localQuery(Codec: { optional: number }) { type T = typeof Codec.optional; return Codec.optional; }",
        "export type Exactly = S.optionalKey<typeof S.String>;",
        "// S.optional(S.String) in a comment",
        "export const InString = 'S.optional(S.String)';",
      ],
      "\n"
    ),
  },
  "prefer-identity-annote-pipe": {
    invalidCount: 11,
    messageIncludes: "identity annotations go through",
    invalid: A.join(
      [
        "export const Single = S.String.annotate($I.annote('Single', { description: 'one line' }));",
        "export const Multi = S.Struct({ a: S.String }).annotate(",
        "  $SchemaId.annote('Multi', {",
        "    description: 'spans lines',",
        "  })",
        ");",
        "export const TypedAnnote = S.Number.annotate($I.annote<number>('TypedAnnote'));",
        "export const TypedAnnotate = S.Number.annotate<number>($I.annote('TypedAnnotate'));",
        "export const CheckAnnotate = S.Number.check(S.isInt().annotate($I.annote('CheckAnnotate')));",
        "export const Chained = S.String.annotate($Pkg.create('internal/x').annote('Chained'));",
        "export const Key = S.Struct({ a: S.String.annotateKey($I.annote('Key.a')) });",
        "export const SuspendKey = S.Struct({ a: S.suspend(() => S.String).annotateKey($I.annote('SuspendKey.a')) });",
        "export class BaseKey extends S.Opaque<BaseKey>()(S.Struct({ a: S.String.annotateKey($I.annote('BaseKey.a')) })) {}",
        "export class Branch extends S.Opaque<Branch>()(",
        "  S.TaggedStruct('Branch', {",
        "    children: S.Array(S.suspend((): S.Codec<Branch> => Branch)).annotateKey(",
        "      $I.annote('Branch.children', { description: 'recursive base' })",
        "    ),",
        "    parent: S.NullOr(S.suspend((): S.Codec<Branch> => Branch)).annotateKey($I.annote('Branch.parent')),",
        "  })",
        ") {}",
      ],
      "\n"
    ),
    valid: A.join(
      [
        "export class Tree extends S.Opaque<Tree>()(",
        "  S.TaggedStruct('Tree', {",
        "    children: $I.annoteKey('Tree.children', { description: 'recursive base' })(",
        "      S.Array(S.suspend((): S.Codec<Tree> => Tree))",
        "    ),",
        "    parent: S.NullOr(S.suspend((): S.Codec<Tree> => Tree)).annotateKey({ description: 'raw object' }),",
        "  })",
        ") {}",
        "export class Model extends S.Class<Model>('Model')({ a: S.String }, $I.annote('Model', { description: 'class' })) {}",
        "export class Boom extends S.TaggedError<Boom>()('Boom', {}, $I.annoteError<Boom>('Boom', { description: 'error' })) {}",
        "export const Checked = S.Number.check(S.isInt($I.annote('Checked')));",
        "export const Piped = S.String.pipe($I.annoteSchema('Piped', { description: 'canonical' }));",
        "export const PipedKey = S.Struct({ a: S.String.pipe($I.annoteKey('PipedKey.a')) });",
        "export const Plain = S.String.annotate({ identifier: 'Plain' });",
        "export const NotComposer = S.String.annotate(I.annote('NotComposer'));",
        "// S.String.annotate($I.annote('InComment'))",
        "export const InString = 'S.String.annotate($I.annote(1))';",
      ],
      "\n"
    ),
  },
  "no-hand-built-identity-annotation": {
    invalidCount: 10,
    messageIncludes: "hand-built",
    invalid: A.join(
      [
        "export const Pattern = S.String.check(S.isPattern(/x/, { identifier: $I`Pattern`, description: 'd' }));",
        "export const Filter = S.makeFilter((n: number) => n > 0, { identifier: $SchemaId`Filter` });",
        "export const Group = S.makeFilterGroup([S.isInt()], { identifier: $I`Group` });",
        "export const Annotated = S.String.annotate({ identifier: $I`Annotated`, title: 't' });",
        "export const Declared = S.declare((u: unknown): u is string => typeof u === 'string', {",
        "  'identifier': $I`Declared`,",
        "});",
        "export const Interpolated = S.Number.check(S.isInt({ identifier: $I`Interpolated.${'x'}` }));",
        "export const Made = S.Number.check(S.isInt({ identifier: $I.make('Made') }));",
        "export const CreatedMade = S.Number.check(S.isInt({ identifier: $I.create(id).make('CreatedMade') }));",
        "export const CreatedTag = S.Number.check(S.isInt({ identifier: $Pkg.create('internal/x')`CreatedTag` }));",
        "export const Broken = S.Number.check(S.isInt({",
        "  identifier: $Pkg",
        "    .create('internal/x')",
        "    .make('Broken'),",
        "}));",
      ],
      "\n"
    ),
    valid: A.join(
      [
        "export const StringId = S.String.annotate({ identifier: 'StringId' });",
        "export const Untagged = S.String.annotate({ identifier: `Untagged` });",
        "export const NotComposer = S.String.annotate({ identifier: I`NotComposer` });",
        "export const OtherKey = S.String.annotate({ title: $I`OtherKey` });",
        "export const OtherMake = S.String.annotate({ identifier: I.make('OtherMake') });",
        "export const SchemaMake = S.String.annotate({ identifier: S.String.make('x') });",
        "export const MadeTitle = S.String.annotate({ title: $I.make('MadeTitle') });",
        "export const CreatedAnnote = S.Number.check(S.isInt($I.create(id).annote('CreatedAnnote')));",
        "export const Piped = S.String.pipe($I.annoteSchema('Piped'));",
        "export const Checked = S.Number.check(S.isInt($I.annote('Checked')));",
        "export const FieldKey = S.Struct({ a: S.String.annotateKey({ description: 'raw key annotation' }) });",
        "const identifier = $I`Shorthand`;",
        "export const Shorthand = S.String.annotate({ identifier });",
        "export const InString = '{ identifier: $I`InString` }';",
      ],
      "\n"
    ),
  },
  "no-hand-rolled-canonical-json": {
    invalidCount: 16,
    messageIncludes: "hand-rolled JSON object text",
    // The shapes of the census encoders E1 to E9 (goals/canonical-digest-owner),
    // compact and newline padded.
    invalid: A.join(
      [
        "export const e1 = (entries: ReadonlyArray<readonly [string, unknown]>) =>",
        "  `{${A.join(",
        "    A.map(entries, ([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`),",
        '    ","',
        "  )}}`;",
        'export const e5 = (members: ReadonlyArray<string>) => `{${A.join(members, ",")}}`;',
        'export const dataLast = (members: ReadonlyArray<string>) => `{${A.join(",")(members)}}`;',
        'export const method = (members: Array<string>) => `{${members.join(",")}}`;',
        'export const e3 = `{${pipe(entries, A.map(render), A.join(","))}}`;',
        'export const piped = `{${members.pipe(A.join(","))}}`;',
        "export const e2 = `{${pads.open}${A.join(rendered, pads.joiner)}${pads.close}}`;",
        'export const e8 = `{\\n${A.join(lines, ",\\n")}\\n${indent}}`;',
        'export const e9 = `{\\n${pipe(entries, A.map(render), A.join(",\\n"))}\\n${indent}}`;',
        "export const multiline = `{",
        '${A.join(lines, ",\\n")}',
        "}`;",
        'export const document = `{${A.join(members, ",")}}\\n`;',
        'export const e4 = flow(R.toEntries, A.sort(order), A.map(render), A.join(","), (body) => `{${body}}`);',
        'export const wrapped = pipe(entries, A.map(render), A.join(","), (body: string) => `{${body}}`);',
        'export const wrappedPadded = entries.pipe(A.map(render), A.join(",\\n"), (body) => `{\\n${body}\\n}`);',
        'export const concat = "{" + A.join(members, ",") + "}";',
        "export const concatPadded = '{\\n' + members.join(',\\n') + '\\n}';",
      ],
      "\n"
    ),
    valid: A.join(
      [
        "export const path = (template: string, key: string) => pipe(template, Str.replace(`{${key}}`, value));",
        "export const embrace = (str: string): string => `{${str}}`;",
        'export const quantifier = `{${omitted ? "0" : ""}${Str.slice(index + 1, end)(source.pattern)}}`;',
        "export const lazyQuantifier = `{${minimum}${tail}}${lazy}`;",
        "export const mdx = `{${mapMdxLines(value, (line, index, blank) => (index === 0 || blank ? line : `  ${line}`))}}`;",
        "export const attribute = `{${attribute.value}}`;",
        'export const array = `[${A.join(items, ",")}]`;',
        'export const tomlInlineTable = `{ ${A.join(parts, ", ")} }`;',
        'export const tagged = html`{${A.join(members, ",")}}`;',
        'export const fixedKeys = `{"citation": ${decimal}, "class": "Resource"}`;',
        'export const elementBraces = pipe(items, A.map((item) => `{${item}}`), A.join(","));',
        'export const nestedWrap = pipe(items, A.join(","), (joined) => render(joined, A.map(rest, (r) => `{${r}}`)));',
        'export const suffix = `{${A.join(members, ",")}} trailing`;',
        'export const concatArray = "[" + A.join(members, ",") + "]";',
        "export const owner = JsoncFingerprint.canonicalizeResult(value);",
        "export const relaxed = JsoncFingerprint.canonicalizeResult(value, JsoncCanonicalizeOptions.make({ omitUndefinedMembers: true }));",
        "export const inString = \"`{${A.join(members, ',')}}`\";",
        '// `{${A.join(members, ",")}}` in a comment',
      ],
      "\n"
    ),
  },
  "no-hand-rolled-git-gh-spawn": {
    invalidCount: 14,
    messageIncludes: "hand-rolled git or gh spawn",
    // One site per shape the repo-cli and ai-metrics census found: a program
    // literal in the first three arguments followed by argv, a runner spec, a
    // Bun argv and the shared gh-CLI route.
    invalid: A.join(
      [
        'export const kitless = ChildProcess.make("git", ["status"], { cwd });',
        'export const variableArgv = ChildProcess.make("gh", args, { cwd });',
        "export const capture = runRepoCommandCapture(",
        '  "gh",',
        '  ["pr", "checks", "--json", "name"],',
        "  root",
        ");",
        "export const singleQuoted = runRepoCommandCaptureRaw('git', ['ls-files', '-z'], root);",
        'export const second = captureVersion(root, "git", ["rev-parse", "--git-common-dir"]);',
        'export const third = mustRun(home, canonicalRoot, "git", ["clone", "--quiet"]);',
        'export const computedArgv = captureCommand("git", leasedRemoteDeletionArgs(state), cwd);',
        'export const pinned = runCapturedStreams({ command: "/usr/bin/git", args, cwd });',
        'export const spec = runCaptured({ command: "gh", args: ["api", path], cwd });',
        'export const step = QualityTaskStep.make({ label: "fetch", command: "git", args: ["fetch"] });',
        'export const preRuntime = Bun.spawnSync({ cmd: ["git", ...args], stdout: "pipe" });',
        'export const bunArgv = Bun.spawn(["gh", "api", "user"], { stdout: "pipe" });',
        "export const sharedGh = ghOutput({ args, cwd, label, onFailure });",
        'export const exitStatus = yield* status("git", ["diff", "--quiet", "HEAD"]);',
      ],
      "\n"
    ),
    valid: A.join(
      [
        'export const gitCommand = Command.make("git", {}, () => Console.log("git commands"));',
        'export const ghCommand = Command.make("gh");',
        'export const line = formatCommandLine("git", invocation.redactedArgs);',
        'export const exited = withExitCode("lint:jsdoc-module-tags", "git", ["ls-files"], 1);',
        'export const label = RouteError.new("git", `git diff ${base} failed`);',
        'export const mapped = RouteError.mapError("git", "Failed to spawn git.");',
        'export const detail = YeetCommandError.new("refused", { command: "git", exitCode: 1 });',
        'export const otherProgram = runFixedStep(root, "secrets:gitleaks", "gitleaks", ["git", "--no-banner"]);',
        'export const domain = LiteralKit(["op", "gh", "network"]);',
        'export const prefix = spawn("github", ["x"]);',
        'export const df = Bun.spawnSync(["df", "--output=avail"]);',
        "export const dynamic = Bun.spawnSync({ cmd: [command, ...args] });",
        'export const kit = Git.log({ revisions: ["HEAD"], limit: 1 });',
        'export const helper = closeoutGhOutput(context, ["repo", "view"], "gh repo view");',
        'export const quoted = "ChildProcess.make(\\"git\\", [\\"status\\"])";',
        '// ChildProcess.make("git", ["status"]) in a comment',
        "// biome-ignore lint/plugin/no-hand-rolled-git-gh-spawn: KEEP (D-22): no kit member reads a commit's parent list",
        'export const recorded = runRepoCommandCapture("git", ["show", "-s", "--format=%P", sha], root);',
      ],
      "\n"
    ),
  },
  "no-unrecorded-spawner-double": {
    invalidCount: 3,
    messageIncludes: "hand-rolled ChildProcessSpawner test double",
    invalid: A.join(
      [
        "export const decorator = ChildProcessSpawner.make((command) => real.spawn(command));",
        "export const generator = ChildProcessSpawner.make(",
        "  Effect.fnUntraced(function* (command) {",
        "    return yield* real.spawn(command);",
        "  })",
        ");",
        "export const canned = ChildProcessSpawner.make(() => Effect.succeed(handle));",
      ],
      "\n"
    ),
    valid: A.join(
      [
        'export const guard = ChildProcessSpawner.make(() => Effect.die("must not spawn"));',
        'export const spread = { ...ChildProcessSpawner.make(() => Effect.die("Unexpected process spawn")) };',
        'export const scripted = ScriptedSpawner.make({ script: () => ({ stdout: "ok", exit: 0 }) });',
        "export const handle = ChildProcessSpawner.makeHandle({ pid: ChildProcessSpawner.ProcessId(1) });",
        "// biome-ignore lint/plugin/no-unrecorded-spawner-double: Own double: decorates the real platform spawner",
        "export const recorded = ChildProcessSpawner.make((command) => real.spawn(command));",
      ],
      "\n"
    ),
  },
};
