/**
 * Core docgen workflow for parsing, checking, and writing documentation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/// <reference path="./markdown-toc.d.ts" />

import chalk from "@beep/chalk";
import { $RepoDocgenId } from "@beep/identity/packages";
import { encodeTSConfigPrettyEffect, FsUtils } from "@beep/repo-utils";
import { A, Str, thunkEmptyStr, thunkFalse } from "@beep/utils";
import markdownToc from "@effect/markdown-toc";
import { Effect, FileSystem, flow, HashSet, Order, Path, pipe, Stream } from "effect";
import * as S from "effect/Schema";
import * as ChildProcess from "effect/unstable/process/ChildProcess";
import * as Checker from "./Checker.ts";
import * as Configuration from "./Configuration.ts";
import * as Domain from "./Domain.ts";
import * as Parser from "./Parser.ts";
import * as Printer from "./Printer.ts";
import { writeDocgenProofManifest } from "./ProofManifest.ts";

const $I = $RepoDocgenId.create("Core");

const SOURCE_FILE_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts"] as const;
const DECLARATION_FILE_EXTENSIONS = [".d.ts", ".d.mts", ".d.cts"] as const;

type SourceFileExtension = (typeof SOURCE_FILE_EXTENSIONS)[number];

const FencedCodeBlockExtension = S.Union([S.Literal(".ts"), S.Literal(".tsx")]).pipe(
  $I.annoteSchema("FencedCodeBlockExtension", {
    description: "Generated file extension for an extracted TypeScript example block.",
  })
);
class FencedCodeBlock extends S.Class<FencedCodeBlock>($I`FencedCodeBlock`)(
  {
    code: S.String,
    extension: FencedCodeBlockExtension,
  },
  $I.annote("FencedCodeBlock", {
    description: "Extracted TypeScript fenced code payload and generated file extension.",
  })
) {}

const normalizeSlashes = (value: string): string => Str.replace(/\\/g, "/")(value);

const isDocgenSourceFile = (filePath: string): boolean =>
  A.some(SOURCE_FILE_EXTENSIONS, (extension) => Str.endsWith(extension)(filePath)) &&
  !A.some(DECLARATION_FILE_EXTENSIONS, (extension) => Str.endsWith(extension)(filePath));

const sourceGlobForExtension = (srcDir: string, extension: SourceFileExtension, path: Path.Path): string =>
  path.normalize(path.join(srcDir, "**", `*${extension}`));

const includePatternToGlob = (srcDir: string, includePattern: string, path: Path.Path): string => {
  const normalizedPattern = normalizeSlashes(path.normalize(includePattern));
  const normalizedSrcDir = normalizeSlashes(path.normalize(srcDir));
  const srcPrefix = `${normalizedSrcDir}/`;
  return normalizedPattern === normalizedSrcDir || Str.startsWith(srcPrefix)(normalizedPattern)
    ? normalizedPattern
    : path.normalize(path.join(srcDir, includePattern));
};

const resolveSourceGlobs = (config: Configuration.ConfigurationShape, path: Path.Path): ReadonlyArray<string> =>
  config.include.length === 0
    ? A.map(SOURCE_FILE_EXTENSIONS, (extension) => sourceGlobForExtension(config.srcDir, extension, path))
    : A.map(config.include, (includePattern) => includePatternToGlob(config.srcDir, includePattern, path));

const globFiles = (pattern: string, exclude: ReadonlyArray<string> = []) =>
  Effect.gen(function* () {
    const fsUtils = yield* FsUtils;
    return yield* fsUtils.globFiles(pattern, exclude.length === 0 ? undefined : { ignore: A.fromIterable(exclude) });
  }).pipe(
    Effect.mapError(() =>
      Domain.DocgenError.make({
        message: `[Core.globFiles] Unable to execute glob pattern '${pattern}' excluding files matching '${exclude}'`,
      })
    )
  );

const readSourceFiles = Effect.gen(function* () {
  const config = yield* Configuration.Configuration;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const patterns = resolveSourceGlobs(config, path);
  const paths = yield* Effect.forEach(patterns, (pattern) => globFiles(pattern, config.exclude), {
    concurrency: "unbounded",
  }).pipe(Effect.map(flow(A.flatten, A.filter(isDocgenSourceFile), A.dedupe, A.sort(Order.String))));
  yield* Effect.logInfo(chalk.bold(`${paths.length} module(s) found`));

  return yield* Effect.forEach(
    paths,
    (filePath) =>
      fs.readFileString(filePath).pipe(
        Effect.map((content) => Domain.File.new(filePath, content, { isOverwritable: false })),
        Effect.mapError((cause) =>
          Domain.DocgenError.make({
            message: `[Core.readSourceFiles] Failed to read '${filePath}'\n${String(cause)}`,
          })
        )
      ),
    { concurrency: "unbounded" }
  );
});

const writeFileToOutDir = Effect.fn("writeFileToOutDir")(function* (file: Domain.File) {
  const config = yield* Configuration.Configuration;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const process = yield* Domain.Process;
  const cwd = yield* process.cwd;
  const fileName = path.relative(path.join(cwd, config.outDir), file.path);
  const exists = yield* fs.exists(file.path).pipe(
    Effect.mapError((cause) =>
      Domain.DocgenError.make({
        message: `[Core.writeFileToOutDir] Failed to check '${file.path}'\n${String(cause)}`,
      })
    )
  );

  if (exists && !file.isOverwritable) {
    yield* Effect.logDebug(`File ${chalk.black(fileName)} already exists, skipping creation.`);
    return;
  }

  if (exists && file.isOverwritable) {
    yield* Effect.logDebug(`Overwriting file ${chalk.black(fileName)}...`);
  }

  yield* fs.makeDirectory(path.dirname(file.path), { recursive: true }).pipe(
    Effect.mapError((cause) =>
      Domain.DocgenError.make({
        message: `[Core.writeFileToOutDir] Failed to create '${path.dirname(file.path)}'\n${String(cause)}`,
      })
    )
  );
  yield* fs.writeFileString(file.path, file.content).pipe(
    Effect.mapError((cause) =>
      Domain.DocgenError.make({
        message: `[Core.writeFileToOutDir] Failed to write '${file.path}'\n${String(cause)}`,
      })
    )
  );
});

const writeFilesToOutDir = (files: ReadonlyArray<Domain.File>) =>
  Effect.forEach(files, writeFileToOutDir, { discard: true });

const parseModules = (files: ReadonlyArray<Domain.File>) =>
  Parser.parseFiles(files).pipe(
    Effect.mapError((errors) =>
      Domain.DocgenError.make({
        message: `[Core.parseModules] The following error(s) occurred while parsing the TypeScript source files:\n${pipe(errors, A.map(A.join("\n")), A.join("\n"))}`,
      })
    )
  );

const typeCheckAndRunExamples = Effect.fn("typeCheckAndRunExamples")(function* (modules: ReadonlyArray<Domain.Module>) {
  const config = yield* Configuration.Configuration;
  yield* cleanupExamples;
  const files = yield* getExampleFiles(modules);
  const len = files.length;

  if (len > 0) {
    yield* Effect.logInfo(`${len} example(s) found`);
    yield* writeExamplesToOutDir(files);
    yield* createExamplesTsConfigJson;
    yield* Effect.logInfo("Typechecking examples...");
    yield* runTscOnExamples;
    if (config.runExamples) {
      yield* Effect.logInfo("Running examples...");
      yield* runBunOnExamples;
    } else {
      yield* Effect.logInfo(chalk.gray("Skipping running examples"));
    }
  } else {
    yield* Effect.logInfo("No examples found.");
  }

  yield* cleanupExamples;
});

const filterJoin: (segments: ReadonlyArray<string>) => string = flow(A.filter(Str.isNonEmpty), A.join("-"));
const sanitizeExampleName = (name: string): string => {
  const sanitized = pipe(name, Str.replace(/[^A-Za-z0-9._-]+/g, "_"), Str.replace(/^_+|_+$/g, ""));
  return sanitized.length > 0 ? sanitized : "example";
};

const extractPrefixedNestedNamespaces = (
  doc: Domain.Namespace,
  prefix: string
): ReadonlyArray<readonly [string, Domain.Namespace]> => {
  const newPrefix = Str.isEmpty(prefix) ? doc.name : `${prefix}-${doc.name}`;
  const namespaces = A.flatMap(doc.namespaces, (namespace) => extractPrefixedNestedNamespaces(namespace, newPrefix));
  return A.prepend(namespaces, [prefix, doc] as const);
};

/**
 * Fence metadata token that removes an example from generated type-check files.
 *
 * **When to use**
 *
 * Use with a TypeScript fence that documents intentionally non-compiling code.
 *
 * **Details**
 *
 * The fence remains available to rendered documentation but is omitted from
 * docgen's generated example project.
 *
 * **Example** (Exclude an intentionally invalid fence)
 *
 * ```ts
 * import { extractFencedCodeBlocks, SKIP_TYPE_CHECKING_FENCE_METADATA } from "@beep/repo-docgen/Core"
 *
 * const fence = "~".repeat(3)
 * const markdown = `${fence}ts ${SKIP_TYPE_CHECKING_FENCE_METADATA}\nconst intentionallyInvalid = <\n${fence}`
 * const [examples] = extractFencedCodeBlocks(markdown)
 *
 * console.log(examples.length) // 0 — skip-type-checking fences are excluded
 * ```
 *
 * @see {@link extractFencedCodeBlocks} for metadata-aware fence extraction.
 * @category constants
 * @since 0.0.0
 */
export const SKIP_TYPE_CHECKING_FENCE_METADATA = "skip-type-checking";

/**
 * Extracts type-checkable fenced code block text from markdown.
 *
 * **When to use**
 *
 * Use when callers need plain code strings and do not need generated file
 * extensions.
 *
 * **Details**
 *
 * Fences tagged with {@link SKIP_TYPE_CHECKING_FENCE_METADATA} are intentionally ignored.
 * Unterminated fences are reported as warnings so docgen can continue parsing the module.
 *
 * **Example** (Extract a TypeScript fence)
 *
 * ```ts
 * import { extractFencedCode } from "@beep/repo-docgen/Core"
 * const [examples] = extractFencedCode("~~~ts\nconst value = 1\n~~~")
 * console.log(examples[0])
 * ```
 *
 * @internal
 * @param content - Markdown text scanned for fenced code blocks.
 * @returns A tuple of the extracted example code strings and any parser warnings.
 * @see {@link extractFencedCodeBlocks} when generated `.ts` or `.tsx` extensions are required.
 * @category parsing
 * @since 0.0.0
 */
export const extractFencedCode = (content: string): [examples: Array<string>, warnings: Array<string>] => {
  const [examples, warnings] = extractFencedCodeBlocks(content);
  return [A.map(examples, (example) => example.code), warnings];
};

const fenceExtension = (metadata: string): ".ts" | ".tsx" => {
  const normalized = pipe(metadata, Str.toLowerCase, Str.trim);
  return Str.startsWith("tsx")(normalized) || Str.startsWith("typescript jsx")(normalized) ? ".tsx" : ".ts";
};

const isTypeScriptFence = (metadata: string): boolean =>
  pipe(
    ["ts", "tsx", "typescript"],
    A.some((prefix) => Str.startsWith(prefix)(metadata))
  );

/**
 * Extracts type-checkable fenced TypeScript code blocks with their generated file extensions.
 *
 * **When to use**
 *
 * Use when extracted examples must preserve whether docgen should emit a
 * `.ts` or `.tsx` file.
 *
 * **Details**
 *
 * `tsx` and `typescript jsx` fences are emitted as `.tsx`; `ts` and `typescript` fences are emitted as `.ts`.
 * Fences carrying {@link SKIP_TYPE_CHECKING_FENCE_METADATA} are omitted.
 *
 * **Gotchas**
 *
 * An unterminated fence is returned through the warnings tuple rather than
 * failing extraction.
 *
 * **Example** (Preserve a TSX fence extension)
 *
 * ```ts
 * import { extractFencedCodeBlocks } from "@beep/repo-docgen/Core"
 * const [examples] = extractFencedCodeBlocks("~~~tsx\nconst view = <div />\n~~~")
 * console.log(examples[0]?.extension)
 * ```
 *
 * @internal
 * @param content - Markdown text scanned for fenced TypeScript code blocks.
 * @returns A tuple of the extracted fenced code blocks with extensions and any parser warnings.
 * @see {@link extractFencedCode} when callers only need code strings.
 * @category parsing
 * @since 0.0.0
 */
export const extractFencedCodeBlocks = (
  content: string
): [examples: Array<FencedCodeBlock>, warnings: Array<string>] => {
  const fenceRegex = /(?:```|~~~)(.*?)\n([\s\S]*?)(?:(```|~~~)|$)/g;
  const matches = pipe(content, Str.matchAll(fenceRegex), A.fromIterable);
  const warnings = pipe(
    matches,
    A.filter((match) => match[3] === undefined),
    A.map(() => `Code block does not have a matching closing fence:\n${content}`)
  );

  const examples = pipe(
    matches,
    A.filter((match) => {
      const metadata = Str.toLowerCase(match[1] ?? "");
      const isSkipTypeChecking = Str.includes(SKIP_TYPE_CHECKING_FENCE_METADATA)(metadata);
      return isTypeScriptFence(metadata) && !isSkipTypeChecking;
    }),
    A.map((match) =>
      FencedCodeBlock.make({
        code: Str.trim(match[2] ?? ""),
        extension: fenceExtension(match[1] ?? ""),
      })
    )
  );

  return [examples, warnings];
};

const getExampleFiles = Effect.fn("getExampleFiles")(function* (modules: ReadonlyArray<Domain.Module>) {
  const config = yield* Configuration.Configuration;
  const path = yield* Path.Path;
  let warnings: Array<string> = [];
  let usedExampleFileNames = HashSet.empty<string>();

  const uniqueExamplePath = (fileName: string): string => {
    let candidate = fileName;
    let suffix = 1;

    while (HashSet.has(usedExampleFileNames, Str.toLowerCase(candidate))) {
      candidate = pipe(fileName, Str.replace(/(\.tsx?|\.mts|\.cts)$/, `-${suffix}$1`));
      suffix += 1;
    }

    usedExampleFileNames = HashSet.add(usedExampleFileNames, Str.toLowerCase(candidate));
    return path.join(config.outDir, "examples", candidate);
  };

  const files = A.flatMap(modules, (module) => {
    const prefix = A.join("-")(module.path);

    const getFiles =
      (exampleId: string) =>
      (namedDoc: { readonly name: string; readonly doc: Domain.Doc }): ReadonlyArray<Domain.File> => {
        let descriptionExamples: ReadonlyArray<FencedCodeBlock> = [];
        if (namedDoc.doc.description !== undefined) {
          const [examples, nextWarnings] = extractFencedCodeBlocks(namedDoc.doc.description);
          warnings = A.appendAll(warnings, nextWarnings);
          descriptionExamples = examples;
        }

        let exampleTagExamples: ReadonlyArray<FencedCodeBlock> = [];
        for (const example of namedDoc.doc.examples) {
          const [examples, nextWarnings] = extractFencedCodeBlocks(example);
          warnings = A.appendAll(warnings, nextWarnings);
          exampleTagExamples = A.appendAll(exampleTagExamples, examples);
        }

        return pipe(
          descriptionExamples,
          A.appendAll(exampleTagExamples),
          A.map((example, index) =>
            Domain.File.new(
              uniqueExamplePath(
                `${prefix}-${exampleId}-${sanitizeExampleName(namedDoc.name)}-${index}${example.extension}`
              ),
              example.code,
              { isOverwritable: true }
            )
          )
        );
      };

    const allPrefixedNamespaces = A.flatMap(module.namespaces, (namespace) =>
      extractPrefixedNestedNamespaces(namespace, "")
    );

    const moduleExamples = getFiles("module")(module);
    const classExamples = A.flatMap(module.classes, (c) =>
      A.flatten([
        getFiles("class")(c),
        A.flatMap(c.methods, getFiles(`${c.name}-method`)),
        A.flatMap(c.staticMethods, getFiles(`${c.name}-staticmethod`)),
        A.flatMap(c.properties, getFiles(`${c.name}-property`)),
      ])
    );
    const allPrefixedInterfaces = A.appendAll(
      A.map(module.interfaces, (iface) => ["" as string, iface] as const),
      A.flatMap(allPrefixedNamespaces, ([prefixValue, namespace]) =>
        A.map(namespace.interfaces, (iface) => [filterJoin([prefixValue, namespace.name]), iface] as const)
      )
    );
    const interfacesExamples = A.flatMap(allPrefixedInterfaces, ([namespaceValue, doc]) =>
      getFiles(filterJoin(["interface", namespaceValue]))(doc)
    );
    const allPrefixedTypeAliases = A.appendAll(
      A.map(module.typeAliases, (typeAlias) => ["" as string, typeAlias] as const),
      A.flatMap(allPrefixedNamespaces, ([prefixValue, namespace]) =>
        A.map(namespace.typeAliases, (typeAlias) => [filterJoin([prefixValue, namespace.name]), typeAlias] as const)
      )
    );
    const typeAliasesExamples = A.flatMap(allPrefixedTypeAliases, ([namespaceValue, doc]) =>
      getFiles(filterJoin(["typealias", namespaceValue]))(doc)
    );
    const constantsExamples = A.flatMap(module.constants, getFiles("constant"));
    const functionsExamples = A.flatMap(module.functions, getFiles("function"));
    const exportsExamples = A.flatMap(module.exports, getFiles("export"));
    const namespacesExamples = A.flatMap(allPrefixedNamespaces, ([namespaceValue, doc]) =>
      getFiles(filterJoin(["namespace", namespaceValue]))(doc)
    );

    return A.flatten([
      moduleExamples,
      classExamples,
      interfacesExamples,
      typeAliasesExamples,
      constantsExamples,
      functionsExamples,
      namespacesExamples,
      exportsExamples,
    ]);
  });

  if (warnings.length > 0) {
    yield* Effect.logWarning(A.join("\n")(warnings));
  }

  return files;
});

const getExamplesEntryPoint = Effect.fn("getExamplesEntryPoint")(function* (examples: ReadonlyArray<Domain.File>) {
  const config = yield* Configuration.Configuration;
  const path = yield* Path.Path;
  const content = pipe(
    examples,
    A.map((example) => `import "./${Str.replace(/\.(tsx?|mts|cts)$/, "")(path.basename(example.path))}"`),
    A.join("\n")
  );
  return Domain.File.new(path.normalize(path.join(config.outDir, "examples", "index.ts")), `${content}\n`, {
    isOverwritable: true,
  });
});

const cleanupExamples = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const config = yield* Configuration.Configuration;
  const path = yield* Path.Path;
  const examplesDir = path.join(config.outDir, "examples");
  yield* fs.remove(examplesDir, { recursive: true, force: true }).pipe(
    Effect.mapError((cause) =>
      Domain.DocgenError.make({
        message: `[Core.cleanupExamples] Failed to remove '${examplesDir}'\n${String(cause)}`,
      })
    )
  );
});

const collectCommandOutput = (command: ChildProcess.Command) =>
  Effect.scoped(
    Effect.gen(function* () {
      const handle = yield* command;
      const output = yield* handle.all.pipe(
        Stream.decodeText(),
        Stream.runFold(thunkEmptyStr, (acc: string, chunk) => `${acc}${chunk}`)
      );
      const exitCode = yield* handle.exitCode;
      return {
        output: Str.trim(output),
        exitCode,
      };
    })
  );

const runTscOnExamples = Effect.gen(function* () {
  const config = yield* Configuration.Configuration;
  const process = yield* Domain.Process;
  const cwd = yield* process.cwd;
  const path = yield* Path.Path;
  const tsconfig = path.normalize(path.join(cwd, config.outDir, "examples", "tsconfig.json"));
  const command = ChildProcess.make(config.tscExecutable, ["--noEmit", "--project", tsconfig], {
    cwd,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });

  yield* Effect.logDebug("Running tsc on examples...");
  const { output, exitCode } = yield* collectCommandOutput(command).pipe(
    Effect.mapError((cause) =>
      Domain.DocgenError.make({
        message: `[Core.runTscOnExamples] Failed to run '${config.tscExecutable}'\n${String(cause)}`,
      })
    )
  );

  if (exitCode !== 0) {
    return yield* Domain.DocgenError.make({
      message: `Something went wrong while running tsc on examples:\n\n${output}`,
    });
  }
});

const runBunOnExamples = Effect.gen(function* () {
  const config = yield* Configuration.Configuration;
  const process = yield* Domain.Process;
  const cwd = yield* process.cwd;
  const path = yield* Path.Path;
  const examplesDir = path.normalize(path.join(cwd, config.outDir, "examples"));
  const index = path.join(examplesDir, "index.ts");
  const command = ChildProcess.make("bun", [index], {
    cwd: examplesDir,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });

  yield* Effect.logDebug("Running bun on examples...");
  const { output, exitCode } = yield* collectCommandOutput(command).pipe(
    Effect.mapError((cause) =>
      Domain.DocgenError.make({
        message: `[Core.runBunOnExamples] Failed to run bun examples\n${String(cause)}`,
      })
    )
  );

  if (exitCode !== 0) {
    return yield* Domain.DocgenError.make({
      message: `Something went wrong while running example files:\n\n${output}`,
    });
  }
});

const writeExamplesToOutDir = Effect.fn("writeExamplesToOutDir")(function* (examples: ReadonlyArray<Domain.File>) {
  yield* Effect.logDebug("Writing examples...");
  const entryPoint = yield* getExamplesEntryPoint(examples);
  yield* writeFilesToOutDir([entryPoint, ...examples]);
});

const createExamplesTsConfigJson = Effect.gen(function* () {
  yield* Effect.logDebug("Writing examples tsconfig...");
  const config = yield* Configuration.Configuration;
  const process = yield* Domain.Process;
  const cwd = yield* process.cwd;
  const path = yield* Path.Path;
  const content = yield* encodeTSConfigPrettyEffect({
    compilerOptions: config.examplesCompilerOptions,
  }).pipe(
    Effect.mapError((cause) =>
      Domain.DocgenError.make({
        message: `[Core.createExamplesTsConfigJson] Failed to encode examples tsconfig\n${String(cause)}`,
      })
    )
  );
  yield* writeFileToOutDir(
    Domain.File.new(path.join(cwd, config.outDir, "examples", "tsconfig.json"), content, { isOverwritable: true })
  );
});

const getMarkdown = Effect.fn("getMarkdown")(function* (modules: ReadonlyArray<Domain.Module>) {
  const homepage = yield* getMarkdownHomepage;
  const index = yield* getMarkdownIndex;
  const yml = yield* getMarkdownConfigYML();
  const moduleFiles = yield* getModuleMarkdownFiles(modules);
  return [homepage, index, yml, ...moduleFiles];
});

const getMarkdownHomepage = Effect.gen(function* () {
  const config = yield* Configuration.Configuration;
  const process = yield* Domain.Process;
  const cwd = yield* process.cwd;
  const path = yield* Path.Path;
  return Domain.File.new(
    path.join(cwd, config.outDir, "index.md"),
    Str.stripMargin(`|---
       |title: Home
       |nav_order: 1
       |---
       |`),
    { isOverwritable: false }
  );
});

const getMarkdownIndex = Effect.gen(function* () {
  const config = yield* Configuration.Configuration;
  const process = yield* Domain.Process;
  const cwd = yield* process.cwd;
  const path = yield* Path.Path;
  return Domain.File.new(
    path.join(cwd, config.outDir, "modules", "index.md"),
    Str.stripMargin(`|---
       |title: Modules
       |has_children: true
       |permalink: /docs/modules
       |nav_order: 2
       |---
       |`),
    { isOverwritable: false }
  );
});

const resolveConfigYML = Effect.fn("resolveConfigYML")(function* (content: string) {
  const config = yield* Configuration.Configuration;
  return pipe(
    content,
    Str.replace(/^remote_theme:.*$/m, `remote_theme: ${config.theme}`),
    Str.replace(/^search_enabled:.*$/m, `search_enabled: ${config.enableSearch}`),
    Str.replace(
      /^ {2}'\S* on GitHub':\n {4}- '.*'/m,
      `  '${config.projectName} on GitHub':\n    - '${config.projectHomepage}'`
    )
  );
});

const getHomepageNavigationHeader = (config: Configuration.ConfigurationShape): string =>
  pipe(config.projectHomepage, Str.toLowerCase, Str.includes("github"))
    ? `${config.projectName} on GitHub`
    : "Homepage";

const getMarkdownConfigYML = Effect.fn("getMarkdownConfigYML")(function* () {
  const config = yield* Configuration.Configuration;
  const process = yield* Domain.Process;
  const fs = yield* FileSystem.FileSystem;
  const cwd = yield* process.cwd;
  const path = yield* Path.Path;
  const configPath = path.join(cwd, config.outDir, "_config.yml");
  const exists = yield* fs.exists(configPath).pipe(Effect.orElseSucceed(thunkFalse));

  if (exists) {
    const content = yield* fs.readFileString(configPath).pipe(
      Effect.mapError((cause) =>
        Domain.DocgenError.make({
          message: `[Core.getMarkdownConfigYML] Failed to read '${configPath}'\n${String(cause)}`,
        })
      )
    );
    const resolved = yield* resolveConfigYML(content);
    return Domain.File.new(configPath, resolved, { isOverwritable: true });
  }

  return Domain.File.new(
    configPath,
    Str.stripMargin(`|remote_theme: ${config.theme}
         |
         |# Enable or disable the site search
         |search_enabled: ${config.enableSearch}
         |
         |# Aux links for the upper right navigation
         |aux_links:
         |'${getHomepageNavigationHeader(config)}':
         |  - '${config.projectHomepage}'`),
    { isOverwritable: false }
  );
});

const getModuleMarkdownOutputPath = Effect.fn("getModuleMarkdownOutputPath")(function* (module: Domain.Module) {
  const config = yield* Configuration.Configuration;
  const path = yield* Path.Path;
  const modulePath = pipe(module.path, A.drop(1), A.join(path.sep));
  return path.normalize(path.join(config.outDir, "modules", `${modulePath}.md`));
});

const getModuleMarkdownFiles = (modules: ReadonlyArray<Domain.Module>) =>
  Effect.forEach(
    modules,
    Effect.fnUntraced(function* (module, index) {
      const outputPath = yield* getModuleMarkdownOutputPath(module);
      const moduleContent = yield* Printer.printModule(module);
      const toc = markdownToc(moduleContent, { bullets: "-" }).content;
      const frontMatter = Printer.printFrontMatter(module, index + 1);
      const content = pipe(
        `${frontMatter}\n\n${moduleContent}`,
        Str.replace(
          "<!-- toc -->",
          `---
## Exports Grouped by Category
${toc}
---`
        )
      );
      const prettified = yield* Printer.prettify(content);
      return Domain.File.new(outputPath, prettified, { isOverwritable: true });
    })
  );

const writeMarkdown = Effect.fn("writeMarkdown")(function* (files: ReadonlyArray<Domain.File>) {
  const config = yield* Configuration.Configuration;
  const path = yield* Path.Path;
  const fileSystem = yield* FileSystem.FileSystem;
  const patterns = A.map(SOURCE_FILE_EXTENSIONS, (extension) =>
    path.normalize(path.join(config.outDir, "**", `*${extension}.md`))
  );
  yield* Effect.logDebug(`Deleting ${chalk.black(A.join(patterns, ", "))}...`);
  const paths = yield* Effect.forEach(patterns, (pattern) => globFiles(pattern), { concurrency: "unbounded" }).pipe(
    Effect.map(flow(A.flatten, A.dedupe))
  );
  yield* Effect.forEach(
    paths,
    (filePath) =>
      fileSystem.remove(filePath, { recursive: true }).pipe(
        Effect.mapError((cause) =>
          Domain.DocgenError.make({
            message: `[Core.writeMarkdown] Failed to delete '${filePath}'\n${String(cause)}`,
          })
        )
      ),
    {
      concurrency: "unbounded",
      discard: true,
    }
  );
  return yield* writeFilesToOutDir(files);
});

/**
 * Runs docgen from source discovery through checked examples and rendered
 * markdown output.
 *
 * **When to use**
 *
 * Use as the main executable workflow after providing a docgen configuration
 * and its required services.
 *
 * **Details**
 *
 * Source checking and markdown rendering run concurrently. Full-package runs
 * write a proof manifest after output is emitted.
 *
 * **Gotchas**
 *
 * Focused include runs skip the proof manifest because their output set does
 * not represent the complete package.
 *
 * **Example** (Attach error logging to the workflow)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { program } from "@beep/repo-docgen/Core"
 *
 * const logged = program.pipe(
 *   Effect.tapError((error) => Effect.logError(error.message))
 * )
 * console.log(Effect.isEffect(logged)) // true
 * ```
 *
 * @internal
 * @effects
 * - Reads configured source files and optional generated docs configuration from the current package.
 * - Writes markdown pages, generated example files, example `tsconfig.json`, and full-run proof manifests.
 * - Runs the configured TypeScript compiler against extracted examples and optionally executes them with Bun.
 * @see {@link Configuration.Configuration} for the service that supplies workflow settings.
 * @category workflows
 * @since 0.0.0
 */
export const program = Effect.gen(function* () {
  const config = yield* Configuration.Configuration;
  yield* Effect.logInfo("Reading modules...");
  const sourceFiles = yield* readSourceFiles;
  yield* Effect.logInfo("Parsing modules...");
  const modules = yield* parseModules(sourceFiles);

  yield* Effect.all(
    [
      Effect.gen(function* () {
        yield* Effect.logInfo("Checking modules...");
        const errors = yield* Checker.checkModules(modules);
        if (errors.length > 0) {
          return yield* Domain.DocgenError.make({
            message: `The following errors occurred while checking the modules:\n\n${A.join("\n\n")(errors)}`,
          });
        }
        yield* typeCheckAndRunExamples(modules);
      }),
      Effect.gen(function* () {
        yield* Effect.logInfo("Creating markdown files...");
        const outputFiles = yield* getMarkdown(modules);
        yield* Effect.logInfo("Writing markdown files...");
        yield* writeMarkdown(outputFiles);
      }),
    ],
    { concurrency: "unbounded", discard: true }
  );
  if (config.include.length === 0) {
    yield* writeDocgenProofManifest();
  } else {
    yield* Effect.logInfo(chalk.gray("Skipping proof manifest for focused include run"));
  }
  yield* Effect.logInfo(chalk.bold.green("✓ Docs generation succeeded!"));
});
