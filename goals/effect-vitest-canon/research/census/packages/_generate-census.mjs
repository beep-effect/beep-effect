import fs from "node:fs"
import path from "node:path"
import { Project, SyntaxKind } from "ts-morph"

const root = process.cwd()
const outDir = path.join(root, "goals/effect-vitest-canon/research/census/packages")
const extensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", ".mjs", ".cjs"])
const excluded = /\/(?:scratchpad|\.claude|goals|explorations|docs|node_modules)\//
const discoveredFiles = fs.readFileSync(0, "utf8").split(/\r?\n/).filter(Boolean)
const candidates = discoveredFiles.filter((file) => file.startsWith("packages/") && extensions.has(path.extname(file)) && !excluded.test(`/${file}`))
const rootPackage = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"))
const expandWorkspacePattern = (pattern) => {
  const parts = pattern.split("/")
  let paths = [""]
  for (const part of parts) {
    const next = []
    for (const current of paths) {
      if (part !== "*") { next.push(path.join(current, part)); continue }
      const absolute = path.join(root, current)
      if (!fs.existsSync(absolute)) continue
      for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) if (entry.isDirectory()) next.push(path.join(current, entry.name))
    }
    paths = next
  }
  return paths
}
const isNamedTest = (file) => /\.(?:test|spec)\.(?:ts|tsx|js|jsx|mts|cts|mjs|cjs)$/.test(file)
const isTsTestSupport = (file) => /\/test\/.+\.ts$/.test(`/${file}`)
const files = candidates.filter((file) => isNamedTest(file) || isTsTestSupport(file)).sort()

const workspaceRoots = rootPackage.workspaces
  .filter((pattern) => pattern === "packages" || pattern.startsWith("packages/"))
  .flatMap(expandWorkspacePattern)
  .filter((dir) => fs.existsSync(path.join(root, dir, "package.json")))
const owners = workspaceRoots.map((dir) => {
  const json = JSON.parse(fs.readFileSync(path.join(root, dir, "package.json"), "utf8"))
  return { dir, name: typeof json.name === "string" ? json.name : dir }
}).sort((a, b) => b.dir.length - a.dir.length)
const ownerOf = (file) => owners.find(({ dir }) => file === dir || file.startsWith(`${dir}/`))?.name ?? "unresolved"
const records = files.map((file) => {
  const text = fs.readFileSync(path.join(root, file), "utf8")
  const stat = fs.statSync(path.join(root, file))
  const lines = text.split(/\r?\n/)
  const kind = isNamedTest(file) ? "test" : "support"
  return { file, package: ownerOf(file), kind, bytes: stat.size, lines: lines.length, text, lineText: lines }
})
const syntaxProject = new Project({ skipAddingFilesFromTsConfig: true, compilerOptions: { allowJs: true } })
const syntaxFiles = new Map(records.map((record) => [record.file, syntaxProject.addSourceFileAtPath(path.join(root, record.file))]))
const exactCallMatches = (record, callee) => {
  const sourceFile = syntaxFiles.get(record.file)
  const calls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).filter((call) => call.getExpression().getText() === callee)
  return { count: calls.length, lines: [...new Set(calls.map((call) => call.getStartLineNumber()))].sort((a, b) => a - b) }
}

const lineMatches = (record, regex) => {
  const flags = regex.flags.replace("g", "")
  const matcher = new RegExp(regex.source, flags)
  const global = new RegExp(regex.source, flags.includes("g") ? flags : `${flags}g`)
  const lines = []
  let count = 0
  for (let index = 0; index < record.lineText.length; index += 1) {
    const line = record.lineText[index]
    if (!matcher.test(line)) continue
    const matches = line.match(global)
    const n = matches?.length ?? 1
    count += n
    lines.push(index + 1)
  }
  return { count, lines }
}

const combinedMatches = (record, regexes) => {
  const lineSet = new Set()
  let count = 0
  for (const regex of regexes) {
    const hit = lineMatches(record, regex)
    count += hit.count
    hit.lines.forEach((line) => lineSet.add(line))
  }
  return { count, lines: [...lineSet].sort((a, b) => a - b) }
}

const classes = new Map()
const addClass = (name, method, selector, limitations = []) => {
  const hits = []
  for (const record of records) {
    const result = selector(record)
    if (result && result.count > 0) hits.push({ file: record.file, count: result.count, lines: result.lines })
  }
  classes.set(name, {
    class: name,
    method,
    fileCount: hits.length,
    occurrenceCount: hits.reduce((sum, hit) => sum + hit.count, 0),
    files: hits,
    limitations
  })
}

const regexClass = (name, regex, limitations = []) => addClass(name, "line-oriented lexical scan over live in-scope package files", (r) => lineMatches(r, regex), limitations)
const unionClass = (name, regexes, limitations = []) => addClass(name, "union of line-oriented lexical scans over live in-scope package files", (r) => combinedMatches(r, regexes), limitations)
const importPattern = (source) => new RegExp(`(?:from\\s+["']${source}["']|import\\s*["']${source}["']|require\\(\\s*["']${source}["']\\s*\\))`)

regexClass("effect-vitest-imports", importPattern("@effect/vitest"))
regexClass("effect-vitest-plain-imports", importPattern("@effect/vitest/plain"))
regexClass("plain-vitest-imports", importPattern("vitest"))
regexClass("it-effect", /\bit\.effect\s*\(/, ["Exact it.effect( calls only; it.effect.prop( calls are excluded and counted separately."])
regexClass("it-live", /\bit\.live\s*\(/)
regexClass("it-layer", /\bit\.layer\s*\(/)
regexClass("it-flaky-test", /\bit\.flakyTest\s*\(/)
regexClass("it-prop", /\bit\.prop\s*\(/)
regexClass("it-effect-prop", /\bit\.effect\.prop\s*\(/)
regexClass("effect-prop", /\beffect\.prop\s*\(/)
regexClass("fc-assert", /\bfc\.assert\s*\(/)
regexClass("effect-run-promise", /\bEffect\.runPromise\s*\(/)
regexClass("effect-run-sync", /\bEffect\.runSync\s*\(/)
regexClass("effect-run-fork", /\bEffect\.runFork\s*\(/)
unionClass("effect-runners", [/\bEffect\.runPromise\s*\(/, /\bEffect\.runSync\s*\(/, /\bEffect\.runFork\s*\(/])
addClass("effect-provide", "ts-morph syntax-only CallExpression scan with exact callee text Effect.provide", (r) => exactCallMatches(r, "Effect.provide"), ["Exact syntax calls only; Effect.provideService and other longer member names are excluded. Aliased imports are not resolved because no type checker is used."])
regexClass("effect-scoped", /\bEffect\.scoped\s*\(/)
regexClass("effect-exit", /\bEffect\.exit\s*\(/)
regexClass("effect-result", /\bEffect\.result\s*\(/)
regexClass("effect-sleep", /\bEffect\.sleep\s*\(/)
regexClass("test-clock", /\bTestClock\b/)
regexClass("test-clock-adjust", /\bTestClock\.(?:adjust|setTime)\s*\(/)
regexClass("effect-vitest-utils-imports", importPattern("@effect/vitest/utils"))
unionClass("option-result-exit-expect-assertions", [
  /\bexpect\s*\([^\n]*(?:Option|Result|Exit|O|E)\.(?:isSome|isNone|isSuccess|isFailure|isExit|some|none|success|failure)/,
  /\bexpect\s*\([^\n]*\)\.(?:toEqual|toStrictEqual)\s*\([^\n]*(?:Option|Result|Exit|O|E)\.(?:some|none|success|failure)/,
  /\bexpect\s*\([^\n]*\._tag[^\n]*\)[^\n]*(?:Some|None|Success|Failure)/,
  /\bexpect\s*\([^\n]*\)[^\n]*toMatchObject\s*\([^\n]*_tag\s*:\s*["'](?:Some|None|Success|Failure)["']/
], ["Heuristic: aliases and inferred value types are not resolved; multiline assertions can be missed."])
addClass("it-effect-files-using-expect", "file-level intersection: file contains it.effect and expect(", (r) => /\bit\.effect\s*\(/.test(r.text) ? lineMatches(r, /\bexpect\s*\(/) : { count: 0, lines: [] }, ["File-level intersection does not prove expect is lexically inside an it.effect callback."])
addClass("it-effect-files-using-assert", "file-level intersection: file contains it.effect and assert.<method>(", (r) => /\bit\.effect\s*\(/.test(r.text) ? lineMatches(r, /\bassert\.[A-Za-z_$][\w$]*\s*\(/) : { count: 0, lines: [] }, ["File-level intersection does not prove assert is lexically inside an it.effect callback."])
unionClass("bun-node-filesystem", [/\bBunFileSystem\b/, /\bNodeFileSystem\b/])
unionClass("node-fs-imports", [importPattern("node:fs"), importPattern("node:fs/promises"), importPattern("fs"), importPattern("fs/promises")])
unionClass("os-tmpdir", [importPattern("node:os"), /\b(?:os\.)?tmpdir\s*\(/])
unionClass("vi-mocks-spies", [/\bvi\.mock\s*\(/, /\bvi\.spyOn\s*\(/])
unionClass("retry-attempts", [/\bretr(?:y|ies|ied|ying)\b/i, /\battempts?\b/i], ["Heuristic judgment set: comments, descriptions, library APIs, and legitimate domain retry behavior are included."])
regexClass("schedule-usage", /\bSchedule\.[A-Za-z_$][\w$]*/)

const namedWrapperCallRegex = /\bwith[A-Z][A-Za-z0-9_$]*\s*\(/g
addClass("named-wrapper-calls", "all lexical withXyz( call-like tokens, including declarations before definition subtraction", (r) => lineMatches(r, /\bwith[A-Z][A-Za-z0-9_$]*\s*\(/), ["Includes definitions and may include methods that are not test resource wrappers; wrappers.json separates discovered definitions."])
for (const name of ["withTempDirectory", "withTempWorkingDirectory", "withTempRepo", "withAdmissionTempRoot", "withEnvVar"]) regexClass(`${name}-calls`, new RegExp(`\\b${name}\\s*\\(`))

const hasEffectTest = (r) => /\bit\.(?:effect|live)\s*\(/.test(r.text)
const selectIf = (predicate, regex) => (r) => predicate(r) ? lineMatches(r, regex) : { count: 0, lines: [] }
addClass("EV001", "conservative lexical candidates: Effect runner calls in test-scope files", (r) => combinedMatches(r, [/\bEffect\.runPromise\s*\(/, /\bEffect\.runSync\s*\(/, /\bEffect\.runFork\s*\(/]), ["Candidate-only: syntax nesting was not used, so module-scope fixture construction and calls outside test callbacks remain included."])
addClass("EV002", "heuristic semantic candidates: exact syntax Effect.provide calls in files lexically containing it.effect or it.live", (r) => hasEffectTest(r) ? exactCallMatches(r, "Effect.provide") : { count: 0, lines: [] }, ["Candidate-only file-level intersection; exact CallExpression nodes are counted, but layer stub purity and callback nesting require AST or human judgment."])
addClass("EV003", "all withXyz( call-like tokens plus wrapper definitions documented in wrappers.json", (r) => lineMatches(r, /\bwith[A-Z][A-Za-z0-9_$]*\s*\(/), ["Candidate-only lexical family; includes non-resource helpers and declarations."])
addClass("EV004", "Effect.scoped calls in files containing it.effect or it.live", selectIf(hasEffectTest, /\bEffect\.scoped\s*\(/), ["Candidate-only file-level intersection; callback nesting is unresolved."])
addClass("EV005", "all Effect.result calls", (r) => lineMatches(r, /\bEffect\.result\s*\(/), ["Candidate-only: whether the result is used to assert an outcome requires judgment."])
addClass("EV006", "heuristic expect patterns over Option/Result/Exit-like constructors, guards, and canonical tags", (r) => combinedMatches(r, [/\bexpect\s*\([^\n]*(?:Option|Result|Exit|O|E)\.(?:isSome|isNone|isSuccess|isFailure|some|none|success|failure)/, /\bexpect\s*\([^\n]*\)\.(?:toEqual|toStrictEqual)\s*\([^\n]*(?:Option|Result|Exit|O|E)\.(?:some|none|success|failure)/, /\bexpect\s*\([^\n]*\._tag[^\n]*\)[^\n]*(?:Some|None|Success|Failure)/, /\bexpect\s*\([^\n]*\)[^\n]*toMatchObject\s*\([^\n]*_tag\s*:\s*["'](?:Some|None|Success|Failure)["']/]), ["Candidate-only: aliases and inferred value types are unavailable in a syntax-only census; multiline assertions can be missed and false positives remain possible."])
addClass("EV007", "fc.assert lines in files whose full text also contains fc.property or fc.asyncProperty", (r) => /\bfc\.(?:asyncProperty|property)\s*\(/.test(r.text) ? lineMatches(r, /\bfc\.assert\s*\(/) : { count: 0, lines: [] }, ["File-level association can pair calls from different tests; aliased FastCheck imports are not resolved."])
addClass("EV008", "Effect.sleep or Schedule usage in files with it.effect and without any TestClock.adjust/setTime", (r) => /\bit\.effect\s*\(/.test(r.text) && !/\bTestClock\.(?:adjust|setTime)\s*\(/.test(r.text) ? combinedMatches(r, [/\bEffect\.sleep\s*\(/, /\bSchedule\.[A-Za-z_$][\w$]*/]) : { count: 0, lines: [] }, ["Candidate-only file-level heuristic; callback boundaries, live-clock wrappers, and event-driven uses are unresolved."])
addClass("EV009", "it.live calls in files without lexical live-clock/live-console markers", (r) => !/(?:TestClock\.withLive|Clock\.(?:currentTime|sleep)|Console\.|Effect\.sleep|process\.(?:stdout|stderr))/.test(r.text) ? lineMatches(r, /\bit\.live\s*\(/) : { count: 0, lines: [] }, ["Candidate-only negative-evidence heuristic; indirect live services and imported helpers are unresolved."])
addClass("EV010", "raw filesystem/platform filesystem/tmpdir lexical candidates", (r) => combinedMatches(r, [/\bBunFileSystem\b/, /\bNodeFileSystem\b/, importPattern("node:fs"), importPattern("node:fs/promises"), importPattern("fs"), importPattern("fs/promises"), /\b(?:os\.)?tmpdir\s*\(/]), ["Candidate-only: subject requirements and platform-lifecycle intent require human judgment."])
addClass("EV011", "plain vitest imports in files with a lexical effect import", (r) => /(?:from\s+["']effect(?:\/[^"']*)?["']|import\s*["']effect(?:\/[^"']*)?["'])/.test(r.text) ? lineMatches(r, importPattern("vitest")) : { count: 0, lines: [] }, ["Lexical import intersection; type-only or indirect Effect usage is not distinguished."])
addClass("EV012", "all vi.mock and vi.spyOn sites", (r) => combinedMatches(r, [/\bvi\.mock\s*\(/, /\bvi\.spyOn\s*\(/]), ["Candidate-only: whether the target is an Effect service requires human judgment."])
addClass("EV013", "retry/attempt identifier and prose heuristic", (r) => combinedMatches(r, [/\bretr(?:y|ies|ied|ying)\b/i, /\battempts?\b/i]), ["Judgment class with intentionally broad false-positive capture, including comments, test names, and domain retry behavior."])
addClass("EV014", "it.layer call lines where the next 800 characters lack a timeout token", (r) => {
  const lines = []
  let count = 0
  const regex = /\bit\.layer\s*\(/g
  for (const match of r.text.matchAll(regex)) {
    const window = r.text.slice(match.index, match.index + 800)
    if (/\btimeout\s*:/.test(window)) continue
    count += 1
    lines.push(r.text.slice(0, match.index).split(/\r?\n/).length)
  }
  return { count, lines }
}, ["Candidate-only bounded-window heuristic; scoped/container/server layer semantics and calls longer than 800 characters require AST and human review."])
addClass("EV015", "TestClock.adjust/setTime calls in files also containing it.layer", (r) => /\bit\.layer\s*\(/.test(r.text) ? lineMatches(r, /\bTestClock\.(?:adjust|setTime)\s*\(/) : { count: 0, lines: [] }, ["Candidate-only file-level intersection; block nesting and per-test reset behavior are unresolved."])

const offsetLine = (text, offset) => text.slice(0, offset).split(/\r?\n/).length
const findMatchingBrace = (text, open) => {
  let depth = 0
  let quote = null
  let escaped = false
  let lineComment = false
  let blockComment = false
  for (let i = open; i < text.length; i += 1) {
    const c = text[i]
    const n = text[i + 1]
    if (lineComment) { if (c === "\n") lineComment = false; continue }
    if (blockComment) { if (c === "*" && n === "/") { blockComment = false; i += 1 }; continue }
    if (quote) { if (escaped) escaped = false; else if (c === "\\") escaped = true; else if (c === quote) quote = null; continue }
    if (c === "/" && n === "/") { lineComment = true; i += 1; continue }
    if (c === "/" && n === "*") { blockComment = true; i += 1; continue }
    if (c === '"' || c === "'" || c === "`") { quote = c; continue }
    if (c === "{") depth += 1
    else if (c === "}") { depth -= 1; if (depth === 0) return i }
  }
  return -1
}

const definitions = []
const definitionKeys = new Set()
const findStatementEnd = (text, start) => {
  const stack = []
  let quote = null
  let escaped = false
  let lineComment = false
  let blockComment = false
  const pairs = { "(": ")", "[": "]", "{": "}" }
  for (let i = start; i < text.length; i += 1) {
    const c = text[i]
    const n = text[i + 1]
    if (lineComment) { if (c === "\n") lineComment = false; continue }
    if (blockComment) { if (c === "*" && n === "/") { blockComment = false; i += 1 }; continue }
    if (quote) { if (escaped) escaped = false; else if (c === "\\") escaped = true; else if (c === quote) quote = null; continue }
    if (c === "/" && n === "/") { lineComment = true; i += 1; continue }
    if (c === "/" && n === "*") { blockComment = true; i += 1; continue }
    if (c === '"' || c === "'" || c === "`") { quote = c; continue }
    if (pairs[c]) stack.push(pairs[c])
    else if (stack.at(-1) === c) stack.pop()
    else if (c === ";" && stack.length === 0) return i
  }
  return text.length - 1
}
const pushDefinition = (record, name, start, declarationEnd) => {
  const key = `${record.file}:${start}:${name}`
  if (definitionKeys.has(key)) return
  definitionKeys.add(key)
  const body = record.text.slice(start, declarationEnd + 1).trim()
  if (body.length === 0) throw new Error(`Empty wrapper declaration at ${record.file}:${offsetLine(record.text, start)}`)
  const resources = [...new Set((body.match(/\b(?:acquireUseRelease|acquireRelease|mkdtemp|makeTempDirectory|temp(?:Dir|Directory)|tmpdir|FileSystem|ChildProcess|Server|Container|Pglite|PgLite|Docker|forkScoped|Scope)\b/g) ?? []))].sort()
  const layers = [...new Set((body.match(/\b(?:[A-Za-z_$][\w$]*Layer|Layer\.(?:effect|scoped|unwrap|provide|merge|succeed|mock)|Effect\.provide(?:Service)?)\b/g) ?? []))].sort()
  const candidateKind = resources.length > 0 || layers.length > 0 ? "resource-wrapper-candidate" : "pure-data-helper-candidate"
  definitions.push({ name, file: record.file, line: offsetLine(record.text, start), endLine: offsetLine(record.text, declarationEnd), body, resourcesAcquired: resources, layersBuilt: layers, candidateKind })
}
for (const record of records) {
  for (const match of record.text.matchAll(/(?:export\s+)?(?:async\s+)?function\s+(with[A-Z][A-Za-z0-9_$]*)\b/g)) {
    const open = record.text.indexOf("{", match.index + match[0].length)
    const close = open >= 0 ? findMatchingBrace(record.text, open) : -1
    if (close >= 0) pushDefinition(record, match[1], match.index, close)
  }
  for (const match of record.text.matchAll(/(?:export\s+)?const\s+(with[A-Z][A-Za-z0-9_$]*)\s*=/g)) {
    const end = findStatementEnd(record.text, match.index)
    const initializer = record.text.slice(match.index + match[0].length, end + 1)
    const arrow = initializer.indexOf("=>")
    const generator = initializer.search(/\bfunction\s*\*/)
    if (arrow < 0 && generator < 0) continue
    if (generator >= 0 && (arrow < 0 || generator < arrow)) {
      const open = record.text.indexOf("{", match.index + match[0].length + generator)
      const close = open >= 0 ? findMatchingBrace(record.text, open) : -1
      if (close >= 0) pushDefinition(record, match[1], match.index, end)
      continue
    }
    const arrowAbsolute = match.index + match[0].length + arrow
    const bodyStart = record.text.slice(arrowAbsolute + 2).search(/\S/) + arrowAbsolute + 2
    if (record.text[bodyStart] === "{") {
      const close = findMatchingBrace(record.text, bodyStart)
      if (close >= 0) pushDefinition(record, match[1], match.index, end)
    } else pushDefinition(record, match[1], match.index, end)
  }
}
definitions.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.name.localeCompare(b.name))
const callsByName = {}
for (const record of records) {
  for (const match of record.text.matchAll(namedWrapperCallRegex)) {
    const name = match[0].replace(/\s*\($/, "")
    callsByName[name] ??= { name, occurrenceCount: 0, fileCount: 0, files: [] }
    callsByName[name].occurrenceCount += 1
    let fileHit = callsByName[name].files.find((x) => x.file === record.file)
    if (!fileHit) { fileHit = { file: record.file, count: 0, lines: [] }; callsByName[name].files.push(fileHit); callsByName[name].fileCount += 1 }
    fileHit.count += 1
    fileHit.lines.push(offsetLine(record.text, match.index))
  }
}
for (const call of Object.values(callsByName)) {
  const defCount = definitions.filter((d) => d.name === call.name).length
  call.lexicalDefinitionCount = defCount
  call.estimatedCallCountExcludingDefinitions = Math.max(0, call.occurrenceCount - defCount)
}

const scope = records.map(({ file, package: packageName, kind, bytes, lines }) => ({ file, package: packageName, kind, bytes, lines }))
const wrappers = {
  method: "syntax-only declaration discovery with string/comment-aware balanced function braces and const statement boundaries; no type checker, getType, or tsconfig project",
  definitionCount: definitions.length,
  definitions,
  wrapperCalls: Object.values(callsByName).sort((a, b) => a.name.localeCompare(b.name)),
  limitations: ["Only named function declarations, const arrow functions, and const Effect.fn-style generator functions named withXyz are extracted.", "body contains the complete declaration, not only the inner function body.", "candidateKind is lexical: pure-data-helper-candidate rows are retained but are not asserted to acquire resources.", "resourcesAcquired and layersBuilt are lexical token inventories, not semantic conclusions."]
}

fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(path.join(outDir, "scope.json"), `${JSON.stringify(scope, null, 2)}\n`)
fs.writeFileSync(path.join(outDir, "wrappers.json"), `${JSON.stringify(wrappers, null, 2)}\n`)
for (const [name, value] of classes) fs.writeFileSync(path.join(outDir, `${name}.json`), `${JSON.stringify(value, null, 2)}\n`)
const compactCounts = Object.fromEntries([...classes].map(([name, value]) => [name, { fileCount: value.fileCount, occurrenceCount: value.occurrenceCount }]))
const summary = {
  generatedOn: "2026-09-08",
  status: "complete",
  model: "gpt-daybreak-blue-latest",
  effort: "medium",
  scopeFileCount: scope.length,
  testFileCount: records.filter((record) => record.kind === "test").length,
  supportFileCount: records.filter((record) => record.kind === "support").length,
  packageCount: new Set(records.map((r) => r.package)).size,
  classCount: classes.size,
  wrapperDefinitionCount: definitions.length,
  wrapperNameCount: Object.keys(callsByName).length,
  counts: compactCounts,
  scopeMethod: "newline discovery list from standalone rg --files packages; D9 path exclusions; test names plus test/**/*.ts support; owner from nearest root-registered workspace root",
  exclusions: ["scratchpad", ".claude", "goals", "explorations", "docs", "node_modules", "artifacts ignored by rg discovery"],
  historicalComparison: { historicalAppsPlusPackagesTestFiles20260904: 945, historicalInfraTestFiles20260904: 10, provisionalPackageTestFiles20260908: 865, livePackageTestFiles20260908: records.filter((record) => record.kind === "test").length, comparablePackageTestDiscrepancy: records.filter((record) => record.kind === "test").length - 865, status: "945 is not a package-only comparator; support files are excluded from test-file comparisons" },
  limitations: ["No type checker, getType, tsconfig project, tests, installs, or package-source edits were used.", "Callback-sensitive EV rules are conservative candidates, not detector-grade findings.", "Line-oriented occurrence counts can miss multiline constructs and include comments or strings.", "Directories named build, generated, or vendor were not excluded by name; standalone rg discovery found no in-scope package test/support rows under those directory names.", "The nested generated @pulumi/gharunners SDK is under infra and therefore outside this packages-only lane; its owning workspace is the root-registered infra workspace and its SDK-test limitation belongs in the apps-infra census."]
}
fs.writeFileSync(path.join(outDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`)
console.log(JSON.stringify({ scopeFileCount: scope.length, testFileCount: summary.testFileCount, supportFileCount: summary.supportFileCount, classCount: classes.size, wrapperDefinitionCount: definitions.length, output: path.relative(root, outDir) }))
