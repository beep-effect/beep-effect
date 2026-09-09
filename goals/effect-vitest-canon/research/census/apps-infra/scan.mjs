import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { Node, Project, SyntaxKind } from "ts-morph"

const root = process.cwd()
const outDir = path.join(root, "goals/effect-vitest-canon/research/census/apps-infra")
const extensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", ".mjs", ".cjs"])
const excludedSegments = new Set([
  "node_modules", ".claude", "scratchpad", "goals", "explorations", "docs"
])

const rg = spawnSync("rg", ["--files", "--hidden", "apps", "infra"], { cwd: root, encoding: "utf8" })
if (rg.status !== 0) throw new Error(`rg --files failed with status ${rg.status}: ${rg.stderr.trim()}`)

const isExcluded = (file) => file.split("/").some((segment) => excludedSegments.has(segment))
const isTestFile = (file) => /\.(?:test|spec)\.(?:ts|tsx|js|jsx|mts|cts|mjs|cjs)$/.test(file)
const isSupport = (file) => file.includes("/test/") && path.extname(file) === ".ts" && !isTestFile(file)
const files = rg.stdout.trim().split("\n").filter(Boolean).filter((file) =>
  extensions.has(path.extname(file)) && !isExcluded(file) && (isTestFile(file) || isSupport(file))
).sort()

const noIgnoreRg = spawnSync("rg", ["--files", "--hidden", "--no-ignore", "apps", "infra"], { cwd: root, encoding: "utf8" })
if (noIgnoreRg.status !== 0) throw new Error(`rg --files --no-ignore failed with status ${noIgnoreRg.status}: ${noIgnoreRg.stderr.trim()}`)
const noIgnorePaths = noIgnoreRg.stdout.trim().split("\n").filter(Boolean)
const noIgnoreEligible = noIgnorePaths.filter((file) =>
  extensions.has(path.extname(file)) && !isExcluded(file) && (isTestFile(file) || isSupport(file))
).sort()
const ignoredEligible = noIgnoreEligible.filter((file) => !files.includes(file))
const sourceNamedBuildLike = noIgnorePaths.filter((file) =>
  !isExcluded(file) && file.split("/").some((segment) => ["build", "generated", "vendor"].includes(segment))
).sort()

const rootManifest = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"))
const workspacePatterns = Array.isArray(rootManifest.workspaces) ? rootManifest.workspaces : []
const globRegex = (pattern) => new RegExp(`^${pattern.split("*").map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[^/]+")}$`)
const workspaceMatchers = workspacePatterns.map((pattern) => ({ pattern, regex: globRegex(pattern) }))
const packageCache = new Map()
const packageOwner = (file) => {
  const candidates = []
  let dir = path.dirname(path.join(root, file))
  while (dir.startsWith(root)) {
    const relative = path.relative(root, dir)
    if (workspaceMatchers.some(({ regex }) => regex.test(relative))) candidates.push({ dir, relative })
    if (dir === root) break
    dir = path.dirname(dir)
  }
  const workspace = candidates.sort((a, b) => b.relative.length - a.relative.length)[0]
  if (workspace === undefined) return "unregistered-workspace"
  const manifest = path.join(workspace.dir, "package.json")
  if (!fs.existsSync(manifest)) return `unregistered-manifest:${workspace.relative}`
  if (!packageCache.has(manifest)) {
    const parsed = JSON.parse(fs.readFileSync(manifest, "utf8"))
    packageCache.set(manifest, typeof parsed.name === "string" ? parsed.name : workspace.relative)
  }
  return packageCache.get(manifest)
}

const records = files.map((file) => {
  const absolute = path.join(root, file)
  const buffer = fs.readFileSync(absolute)
  const text = buffer.toString("utf8")
  return {
    file,
    package: packageOwner(file),
    kind: isTestFile(file) ? "test" : "support",
    bytes: buffer.length,
    lines: text.length === 0 ? 0 : (text.match(/\n/g)?.length ?? 0) + (text.endsWith("\n") ? 0 : 1),
    text
  }
})

const syntaxProject = new Project({ skipAddingFilesFromTsConfig: true })
const syntaxByFile = new Map(records.map((record) => {
  const sourceFile = syntaxProject.addSourceFileAtPath(path.join(root, record.file))
  return [record.file, sourceFile]
}))
const exactCallLines = (record, expressionText) => syntaxByFile.get(record.file)
  .getDescendantsOfKind(SyntaxKind.CallExpression)
  .filter((call) => call.getExpression().getText() === expressionText)
  .map((call) => call.getStartLineNumber())

const lineNumberAt = (text, index) => text.slice(0, index).split("\n").length
const occurrences = (text, regex) => {
  const flags = regex.flags.includes("g") ? regex.flags : `${regex.flags}g`
  const copy = new RegExp(regex.source, flags)
  const lines = []
  let match
  while ((match = copy.exec(text)) !== null) {
    lines.push(lineNumberAt(text, match.index))
    if (match[0].length === 0) copy.lastIndex += 1
  }
  return lines
}

const write = (name, value) => fs.writeFileSync(path.join(outDir, name), `${JSON.stringify(value, null, 2)}\n`)
const classOutput = (className, method, matcher, limitations) => {
  const matched = records.flatMap((record) => {
    const lines = matcher(record)
    return lines.length === 0 ? [] : [{ file: record.file, count: lines.length, lines }]
  })
  return {
    class: className,
    method,
    fileCount: matched.length,
    occurrenceCount: matched.reduce((sum, file) => sum + file.count, 0),
    files: matched,
    limitations
  }
}

const regexClass = (name, regex, limitations = "Verified textual occurrence census over the live scoped files; comments and strings can produce false positives, and multiline syntax can affect precision.") =>
  classOutput(name, `global regular expression: /${regex.source}/${regex.flags}`, (record) => occurrences(record.text, regex), limitations)

const classes = new Map()
const addRegex = (name, regex, limitations) => classes.set(name, regexClass(name, regex, limitations))
const addCustom = (name, method, matcher, limitations) => classes.set(name, classOutput(name, method, matcher, limitations))

addRegex("effect-vitest-imports", /(?:from\s*["']@effect\/vitest["']|import\s*["']@effect\/vitest["'])/g)
addRegex("effect-vitest-plain-imports", /(?:from\s*["']@effect\/vitest\/plain["']|import\s*["']@effect\/vitest\/plain["'])/g)
addRegex("plain-vitest-imports", /(?:from\s*["']vitest["']|import\s*["']vitest["'])/g)
addCustom("it-effect", "ts-morph syntax-only exact CallExpression it.effect(...); excludes it.effect.prop(...) by expression identity", (record) => exactCallLines(record, "it.effect"), "Exact syntactic call identity; aliases and computed property access are not counted.")
addCustom("it-live", "ts-morph syntax-only exact CallExpression it.live(...)", (record) => exactCallLines(record, "it.live"), "Exact syntactic call identity; aliases and computed property access are not counted.")
addCustom("it-layer", "ts-morph syntax-only exact CallExpression it.layer(...)", (record) => exactCallLines(record, "it.layer"), "Exact syntactic call identity; aliases and computed property access are not counted.")
addCustom("it-flaky-test", "ts-morph syntax-only exact CallExpression it.flakyTest(...)", (record) => exactCallLines(record, "it.flakyTest"), "Exact syntactic call identity; aliases and computed property access are not counted.")
addCustom("it-prop", "ts-morph syntax-only exact CallExpression it.prop(...)", (record) => exactCallLines(record, "it.prop"), "Exact syntactic call identity; excludes it.effect.prop and aliases.")
addCustom("it-effect-prop", "ts-morph syntax-only exact CallExpression it.effect.prop(...)", (record) => exactCallLines(record, "it.effect.prop"), "Exact syntactic call identity; aliases are not counted.")
addCustom("effect-prop", "ts-morph syntax-only exact CallExpression effect.prop(...)", (record) => exactCallLines(record, "effect.prop"), "Exact syntactic call identity; aliases are not counted.")
addCustom("fc-assert", "ts-morph syntax-only exact CallExpression fc.assert(...)", (record) => exactCallLines(record, "fc.assert"), "Exact syntactic call identity; aliases are not counted.")
addRegex("fc-assert-property", /\bfc\.assert\s*\(\s*fc\.(?:asyncProperty|property)\s*\(/gs)
addCustom("effect-run-promise", "ts-morph syntax-only exact CallExpression Effect.runPromise(...)", (record) => exactCallLines(record, "Effect.runPromise"), "Exact syntactic call identity; aliases are not counted.")
addCustom("effect-run-sync", "ts-morph syntax-only exact CallExpression Effect.runSync(...)", (record) => exactCallLines(record, "Effect.runSync"), "Exact syntactic call identity; aliases are not counted.")
addCustom("effect-run-fork", "ts-morph syntax-only exact CallExpression Effect.runFork(...)", (record) => exactCallLines(record, "Effect.runFork"), "Exact syntactic call identity; aliases are not counted.")
addCustom("effect-run-methods", "union of exact Effect.runPromise/runSync/runFork CallExpressions", (record) => ["Effect.runPromise", "Effect.runSync", "Effect.runFork"].flatMap((name) => exactCallLines(record, name)).sort((a, b) => a - b), "Exact syntactic call identity; aliases are not counted.")
addCustom("effect-provide", "ts-morph syntax-only exact CallExpression Effect.provide(...)", (record) => exactCallLines(record, "Effect.provide"), "Exact syntactic call identity. Effect.provideService and other longer member names are excluded; aliases are not counted.")
addCustom("effect-scoped", "ts-morph syntax-only exact CallExpression Effect.scoped(...)", (record) => exactCallLines(record, "Effect.scoped"), "Exact syntactic call identity; aliases are not counted.")
addCustom("effect-exit", "ts-morph syntax-only exact CallExpression Effect.exit(...)", (record) => exactCallLines(record, "Effect.exit"), "Exact syntactic call identity; aliases are not counted.")
addCustom("effect-result", "ts-morph syntax-only exact CallExpression Effect.result(...)", (record) => exactCallLines(record, "Effect.result"), "Exact syntactic call identity; aliases are not counted.")
addCustom("effect-sleep", "ts-morph syntax-only exact CallExpression Effect.sleep(...)", (record) => exactCallLines(record, "Effect.sleep"), "Exact syntactic call identity; aliases are not counted.")
addRegex("test-clock", /\bTestClock\b/g)
addRegex("test-clock-adjust", /\bTestClock\.adjust\s*\(/g)
addRegex("effect-vitest-utils-imports", /(?:from\s*["']@effect\/vitest\/utils["']|import\s*["']@effect\/vitest\/utils["'])/g)
addRegex("node-fs-imports", /(?:from\s*["']node:fs(?:\/promises)?["']|import\s*["']node:fs(?:\/promises)?["']|require\s*\(\s*["']node:fs(?:\/promises)?["']\s*\))/g)
addRegex("os-tmpdir", /\b(?:os\.)?tmpdir\s*\(/g)
addRegex("bun-node-filesystem", /\b(?:BunFileSystem|NodeFileSystem)\b/g)
addRegex("vi-mock", /\bvi\.mock\s*\(/g)
addRegex("vi-spy-on", /\bvi\.spyOn\s*\(/g)
addRegex("vi-mocks-spies", /\bvi\.(?:mock|spyOn)\s*\(/g)
addRegex("retries-attempts", /\b(?:retry|retries|retried|attempt|attempts|backoff)\b/gi, "Heuristic token census only. Hits can describe product behavior, fixtures, or prose rather than hand-rolled test retry loops; every file needs judgment.")
addRegex("option-result-exit-expect-assertions", /(?:expect\s*\([^\n;]*(?:Option|Result|Exit|isSome|isNone|isSuccess|isFailure)[^\n;]*\)|\.to(?:Equal|StrictEqual|Be)\s*\([^\n;]*(?:Option|Result|Exit|some\s*\(|none\s*\(|success\s*\(|failure\s*\())/g, "Heuristic textual census of hand-rolled Option, Result, or Exit expectations. Alias imports, multiline expressions, and unrelated names can cause misses or false positives.")

addCustom("it-effect-expect", "files containing it.effect plus global expect(...) occurrences", (record) =>
  exactCallLines(record, "it.effect").length > 0 ? occurrences(record.text, /\bexpect\s*\(/g) : [],
  "Verified co-occurrence within a file, not AST containment inside the specific it.effect callback.")
addCustom("it-effect-assert", "files containing it.effect plus assert member/call occurrences", (record) =>
  exactCallLines(record, "it.effect").length > 0 ? occurrences(record.text, /\bassert(?:\.|\s*\()/g) : [],
  "Verified co-occurrence within a file, not AST containment inside the specific it.effect callback.")

const wrapperNameRegex = /\b(with[A-Z][A-Za-z0-9_]*)\s*\(/g
addCustom("named-wrapper-calls", "all withXyz(...) textual call-like occurrences", (record) => occurrences(record.text, wrapperNameRegex),
  "Includes definition signatures and any non-wrapper function sharing the withXyz naming convention. wrappers.json separates detected definitions heuristically.")

const definitions = []
for (const sourceFile of syntaxProject.getSourceFiles()) {
  const file = path.relative(root, sourceFile.getFilePath())
  for (const declaration of sourceFile.getVariableDeclarations()) {
    const name = declaration.getName()
    if (!/^with[A-Z][A-Za-z0-9_]*$/.test(name)) continue
    const initializer = declaration.getInitializer()
    if (initializer === undefined) continue
    const isFunctionDefinition = Node.isArrowFunction(initializer) || Node.isFunctionExpression(initializer)
    const isDualizedDefinition = Node.isCallExpression(initializer) && initializer.getExpression().getText() === "dual"
    if (!isFunctionDefinition && !isDualizedDefinition) continue
    const statement = declaration.getVariableStatementOrThrow()
    const body = statement.getText()
    const resourcesAcquired = [...new Set([...body.matchAll(/\b(?:Effect\.)?(acquireRelease|acquireUseRelease|makeTempDirectoryScoped|makeTempFileScoped|mkdtemp|tmpdir|open|listen|start)\b/g)].map((match) => match[0]))]
    const layersBuilt = [...new Set([...body.matchAll(/\b(?:Layer\.[A-Za-z0-9_]+|[A-Za-z0-9_]*Layer)\b/g)].map((match) => match[0]))]
    definitions.push({
      name,
      file,
      line: statement.getStartLineNumber(),
      endLine: statement.getEndLineNumber(),
      body,
      resourcesAcquired,
      layersBuilt
    })
  }
  for (const declaration of sourceFile.getFunctions()) {
    const name = declaration.getName()
    if (name === undefined || !/^with[A-Z][A-Za-z0-9_]*$/.test(name)) continue
    const body = declaration.getText()
    const resourcesAcquired = [...new Set([...body.matchAll(/\b(?:Effect\.)?(acquireRelease|acquireUseRelease|makeTempDirectoryScoped|makeTempFileScoped|mkdtemp|tmpdir|open|listen|start)\b/g)].map((match) => match[0]))]
    const layersBuilt = [...new Set([...body.matchAll(/\b(?:Layer\.[A-Za-z0-9_]+|[A-Za-z0-9_]*Layer)\b/g)].map((match) => match[0]))]
    definitions.push({
      name,
      file,
      line: declaration.getStartLineNumber(),
      endLine: declaration.getEndLineNumber(),
      body,
      resourcesAcquired,
      layersBuilt
    })
  }
}
definitions.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.name.localeCompare(b.name))

const wrapperCalls = []
for (const record of records) {
  const byName = new Map()
  let match
  const pattern = new RegExp(wrapperNameRegex.source, "g")
  while ((match = pattern.exec(record.text)) !== null) {
    const line = lineNumberAt(record.text, match.index)
    const key = match[1]
    const current = byName.get(key) ?? []
    current.push(line)
    byName.set(key, current)
  }
  for (const [name, lines] of [...byName].sort(([a], [b]) => a.localeCompare(b))) {
    wrapperCalls.push({ name, file: record.file, count: lines.length, lines })
  }
}

const callCountsByName = Object.fromEntries([
  "withTempDirectory", "withTempWorkingDirectory", "withTempRepo", "withAdmissionTempRoot", "withEnvVar",
  ...wrapperCalls.map((call) => call.name)
].sort().filter((name, index, names) => index === 0 || name !== names[index - 1]).map((name) => [
  name,
  wrapperCalls.filter((call) => call.name === name).reduce((sum, call) => sum + call.count, 0)
]))

write("scope.json", records.map(({ text: _text, ...record }) => record))
write("discovery-differences.json", {
  method: "Compared rg --files --hidden with rg --files --hidden --no-ignore after applying only the D9 path exclusions and the same file-kind predicate.",
  d9ExcludedSegments: [...excludedSegments],
  confirmedIgnoredArtifactPatterns: ["coverage/", "dist/", "build/", ".turbo", "**/.next/", "**/src-tauri/target/"],
  defaultEligibleCount: files.length,
  noIgnoreEligibleCount: noIgnoreEligible.length,
  ignoredOrGeneratedEligible: ignoredEligible,
  sourcePathsUnderBuildGeneratedOrVendorSegments: sourceNamedBuildLike,
  limitations: "The artifact patterns are confirmed from root/app/infra ignore configuration. An empty difference means no additional eligible test/support file is currently present under ignored output paths; it is not a claim that such outputs can never exist."
})
write("wrappers.json", {
  method: "ts-morph syntax-only Project with skipAddingFilesFromTsConfig; complete variable statements/function declarations for withXyz definitions. No getType. Calls are textual withXyz(...) occurrences.",
  definitions,
  calls: wrapperCalls,
  callCountsByName,
  definitionCount: definitions.length,
  callOccurrenceCount: wrapperCalls.reduce((sum, call) => sum + call.count, 0),
  limitations: "Definitions are syntax-only AST declarations. Pure data helpers remain candidates and are not inferred to acquire resources. resourcesAcquired and layersBuilt are token inventories, not semantic proofs. Call counts are lexical and can include member APIs such as withLive."
})

for (const [name, output] of classes) write(`${name}.json`, output)

const candidate = (rule, method, matcher, limitations) => write(`${rule}.json`, classOutput(rule, method, matcher, limitations))
const effectTest = (record) => exactCallLines(record, "it.effect").length > 0 || exactCallLines(record, "it.live").length > 0
candidate("EV001", "runPromise/runSync/runFork co-occurring with a test file or support module", (record) =>
  ["Effect.runPromise", "Effect.runSync", "Effect.runFork"].flatMap((name) => exactCallLines(record, name)).sort((a, b) => a - b),
  "Candidate census only: syntax-only text does not prove the call is inside a test callback; module-scope pure fixture construction may be allowed.")
candidate("EV002", "exact Effect.provide CallExpressions co-occurring in files containing exact it.effect or it.live calls", (record) =>
  effectTest(record) ? exactCallLines(record, "Effect.provide") : [],
  "Semantic candidate only: exact Effect.provide calls exclude Effect.provideService, but file-level co-occurrence does not prove callback containment or distinguish non-stub from Layer.succeed/Layer.mock stubs.")
candidate("EV003", "withXyz(...) call-like occurrences plus wrapper definitions", (record) => occurrences(record.text, wrapperNameRegex),
  "Candidate census includes definition signatures and calls not necessarily at the test-body root. See wrappers.json for heuristic definition bodies and per-name call counts.")
candidate("EV004", "Effect.scoped co-occurring in files containing it.effect or it.live", (record) =>
  effectTest(record) ? exactCallLines(record, "Effect.scoped") : [],
  "Candidate census only: file-level co-occurrence does not prove the call is inside the runner callback.")
candidate("EV005", "exact Effect.result CallExpressions", (record) => exactCallLines(record, "Effect.result"),
  "Candidate census only: whether each result is used to assert an outcome requires syntax/semantic review.")
candidate("EV006", "heuristic expect assertions mentioning Option/Result/Exit constructors or predicates", (record) =>
  occurrences(record.text, /(?:expect\s*\([^\n;]*(?:Option|Result|Exit|isSome|isNone|isSuccess|isFailure)[^\n;]*\)|\.to(?:Equal|StrictEqual|Be)\s*\([^\n;]*(?:Option|Result|Exit|some\s*\(|none\s*\(|success\s*\(|failure\s*\())/g),
  "Judgment candidate. Alias imports and multiline expressions can be missed; generic names can be false positives.")
candidate("EV007", "fc.assert directly wrapping fc.property or fc.asyncProperty", (record) =>
  occurrences(record.text, /\bfc\.assert\s*\(\s*fc\.(?:asyncProperty|property)\s*\(/gs),
  "Verified textual shape, though aliasing and comments/strings can cause misses or false positives.")
candidate("EV008", "Effect.sleep or Schedule in it.effect files lacking TestClock.adjust anywhere in the file", (record) =>
  exactCallLines(record, "it.effect").length > 0 && exactCallLines(record, "TestClock.adjust").length === 0
    ? occurrences(record.text, /\b(?:Effect\.sleep|Schedule\.[A-Za-z0-9_]+)\b/g) : [],
  "Heuristic at file granularity. The sleep/Schedule may be outside the effect test or legitimately live, and an adjustment in another callback would suppress candidates.")
candidate("EV009", "all exact it.live CallExpressions requiring later need assessment", (record) => exactCallLines(record, "it.live"),
  "Judgment candidate: syntax-only inspection cannot reliably establish a live-clock or live-console requirement.")
candidate("EV010", "node:fs, BunFileSystem, NodeFileSystem, or tmpdir occurrences", (record) =>
  occurrences(record.text, /(?:["']node:fs(?:\/promises)?["']|\bBunFileSystem\b|\bNodeFileSystem\b|\b(?:os\.)?tmpdir\s*\()/g),
  "Judgment candidate: whether the subject only needs FileSystem or asserts platform lifecycle cannot be inferred textually.")
candidate("EV011", "plain vitest import in a file containing an effect package import", (record) =>
  /(?:from\s*["']effect(?:\/[^"']*)?["']|import\s*["']effect(?:\/[^"']*)?["'])/.test(record.text)
    ? occurrences(record.text, /(?:from\s*["']vitest["']|import\s*["']vitest["'])/g) : [],
  "Verified file-level import co-occurrence. It does not prove imported Effect APIs are used by a test callback.")
candidate("EV012", "vi.mock or vi.spyOn occurrences", (record) => occurrences(record.text, /\bvi\.(?:mock|spyOn)\s*\(/g),
  "Judgment candidate: textual inspection does not determine whether the target is an Effect service.")
candidate("EV013", "retry/attempt/backoff token occurrences", (record) => occurrences(record.text, /\b(?:retry|retries|retried|attempt|attempts|backoff)\b/gi),
  "Broad judgment candidate. Tokens may name product behavior, assertions, fixtures, or prose instead of hand-rolled retry loops.")
candidate("EV014", "it.layer sites in files mentioning scoped/container/server resources but with no timeout token in the file", (record) => {
  if (exactCallLines(record, "it.layer").length === 0) return []
  if (!/\b(?:container|server|scoped|acquireRelease|Layer\.scoped|Layer\.unwrap)\b/i.test(record.text)) return []
  if (/\btimeout\s*:/.test(record.text)) return []
  return exactCallLines(record, "it.layer")
}, "Heuristic at file granularity. Resource kind, call boundaries, and option ownership require AST and human review; any timeout token suppresses the whole file.")
candidate("EV015", "TestClock.adjust in files containing it.layer", (record) =>
  exactCallLines(record, "it.layer").length > 0 ? exactCallLines(record, "TestClock.adjust") : [],
  "Judgment candidate: file-level co-occurrence does not prove callback nesting or whether per-test reset/excludeTestServices is already present.")

const summaryClasses = Object.fromEntries([...classes].map(([name, value]) => [name, {
  fileCount: value.fileCount,
  occurrenceCount: value.occurrenceCount
}]))
const ev = Object.fromEntries(Array.from({ length: 15 }, (_, index) => {
  const id = `EV${String(index + 1).padStart(3, "0")}`
  const parsed = JSON.parse(fs.readFileSync(path.join(outDir, `${id}.json`), "utf8"))
  return [id, { fileCount: parsed.fileCount, occurrenceCount: parsed.occurrenceCount }]
}))
write("summary.json", {
  generatedOn: "2026-09-08",
  scope: {
    roots: ["apps/**", "infra/**"],
    fileCount: records.length,
    testFileCount: records.filter((record) => record.kind === "test").length,
    supportFileCount: records.filter((record) => record.kind === "support").length,
    bytes: records.reduce((sum, record) => sum + record.bytes, 0),
    lines: records.reduce((sum, record) => sum + record.lines, 0),
    packageCount: new Set(records.map((record) => record.package)).size,
    kindDomain: ["test", "support"],
    ownership: "nearest ancestor directory matching a root package.json workspace entry; nested unregistered manifests do not own files",
    ignoredEligibleDifferenceCount: ignoredEligible.length
  },
  scopeByRoot: Object.fromEntries(["apps", "infra"].map((scopeRoot) => [scopeRoot, {
    test: records.filter((record) => record.file.startsWith(`${scopeRoot}/`) && record.kind === "test").length,
    support: records.filter((record) => record.file.startsWith(`${scopeRoot}/`) && record.kind === "support").length
  }])),
  scopeByPackage: Object.fromEntries([...new Set(records.map((record) => record.package))].sort().map((packageName) => [packageName, {
    test: records.filter((record) => record.package === packageName && record.kind === "test").length,
    support: records.filter((record) => record.package === packageName && record.kind === "support").length
  }])),
  classes: summaryClasses,
  countingNotes: {
    itEffectIncludesEffectProp: false,
    effectProvideExactCallOnly: true,
    effectProvideServiceExcluded: true
  },
  wrappers: { definitionCount: definitions.length, callOccurrenceCount: wrapperCalls.reduce((sum, call) => sum + call.count, 0) },
  evCandidates: ev,
  countStatus: "LIVE census; historical 2026-09-04 estimates were not forced."
})

const ensure = (condition, message) => {
  if (!condition) throw new Error(`census validation failed: ${message}`)
}
const scopePaths = records.map((record) => record.file)
ensure(new Set(scopePaths).size === scopePaths.length, "scope paths are not unique")
ensure(records.every((record) => ["test", "support"].includes(record.kind)), "scope kind outside test|support")
ensure(records.every((record) => Object.keys(record).filter((key) => key !== "text").sort().join(",") === "bytes,file,kind,lines,package"), "scope output shape drift")
ensure(records.every((record) => !record.package.startsWith("unregistered")), "unregistered workspace owner")
ensure(records.filter((record) => record.file.startsWith("infra/")).every((record) => record.package === "@beep/infra"), "infra nested manifest captured ownership")
ensure(records.every((record) => !record.package.startsWith("@mock/pkg-")), "fixture manifest captured ownership")
for (const [name, output] of classes) {
  ensure(output.fileCount === output.files.length, `${name} fileCount aggregate mismatch`)
  ensure(output.occurrenceCount === output.files.reduce((sum, file) => sum + file.count, 0), `${name} occurrence aggregate mismatch`)
  ensure(new Set(output.files.map((file) => file.file)).size === output.files.length, `${name} duplicate file path`)
  ensure(output.files.every((file) => scopePaths.includes(file.file)), `${name} path outside scope`)
}
for (let index = 1; index <= 15; index += 1) {
  const id = `EV${String(index).padStart(3, "0")}`
  const output = JSON.parse(fs.readFileSync(path.join(outDir, `${id}.json`), "utf8"))
  ensure(output.class === id, `${id} class mismatch`)
  ensure(output.fileCount === output.files.length, `${id} fileCount aggregate mismatch`)
  ensure(output.occurrenceCount === output.files.reduce((sum, file) => sum + file.count, 0), `${id} occurrence aggregate mismatch`)
  ensure(new Set(output.files.map((file) => file.file)).size === output.files.length, `${id} duplicate file path`)
  ensure(output.files.every((file) => scopePaths.includes(file.file)), `${id} path outside scope`)
}
ensure(new Set(definitions.map((definition) => `${definition.file}:${definition.line}:${definition.name}`)).size === definitions.length, "duplicate wrapper definition identity")
ensure(definitions.every((definition) => definition.body.length > 0 && definition.endLine >= definition.line), "incomplete wrapper declaration metadata")
ensure(new Set(wrapperCalls.map((call) => `${call.file}:${call.name}`)).size === wrapperCalls.length, "duplicate wrapper call aggregate identity")
write("validation.json", {
  passed: true,
  checkedOn: "2026-09-08",
  checks: {
    scopeShape: "array rows contain exactly file, package, kind, bytes, lines",
    scopeKinds: ["test", "support"],
    uniqueScopePaths: scopePaths.length,
    registeredWorkspaceOwnersOnly: true,
    infraOwnedByActualWorkspace: true,
    mockFixtureOwnersExcluded: true,
    classAggregatesChecked: classes.size,
    evAggregatesChecked: 15,
    classAndEvPathsRestrictedToScope: true,
    wrapperDefinitionIdentitiesUnique: definitions.length,
    wrapperCallAggregatesUniqueByFileAndName: wrapperCalls.length
  }
})
