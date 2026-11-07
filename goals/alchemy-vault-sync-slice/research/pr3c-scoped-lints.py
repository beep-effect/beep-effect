#!/usr/bin/env python3
"""Run the installed checkout's canonical lint scanners with PR 3c source roots.

This checkout has no native path/base flags for these commands. This adapter
copies scan orchestration into ignored .beep/, bounds only its discovered roots,
and leaves every detector implementation and configuration unchanged. Relative
imports are anchored to the original module. It never writes lint inventories.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("mode", choices=["schema-first", "effect-vitest"])
parser.add_argument(
    "--base",
    required=True,
    help="Commit the scan diffs against; record it beside the result (the handoff used 5b8d9cee35).",
)
args = parser.parse_args()
root = Path(subprocess.check_output(["git", "rev-parse", "--show-toplevel"], text=True).strip())
os.chdir(root)
files = subprocess.check_output(
    ["git", "diff", "--name-only", args.base, "--",
     "packages/documents/domain", "packages/documents/use-cases", "packages/documents/server"], text=True
).splitlines()
files = sorted(f for f in files if f.endswith((".ts", ".tsx")) and (root / f).is_file())
if not files:
    raise SystemExit("No scoped files; refusing an empty proof")
scratch = root / ".beep/pr3c-scoped-lints"
scratch.mkdir(parents=True, exist_ok=True)
internal = root / "packages/tooling/tool/cli/src/commands/Lint/internal"
module = internal / ("SchemaFirstScan.ts" if args.mode == "schema-first" else "EffectVitestScan.ts")
source = module.read_text()
digest = hashlib.sha256(source.encode()).hexdigest()
roots = json.dumps([str(root / f) for f in files])

def replace_once(text, old, new):
    if text.count(old) != 1:
        raise SystemExit("Canonical scanner changed at expected seam: " + old)
    return text.replace(old, new, 1)

if args.mode == "schema-first":
    source = replace_once(source,
        "const sourcePaths = A.sort(project.getFileSystem().globSync(SchemaFirstSourceFileGlobs), Order.String);",
        "const sourcePaths = " + roots + ";")
    source = replace_once(source,
        "const scanSchemaFirstInventory =", "export const scanSchemaFirstInventory =")
else:
    source = replace_once(source,
        "const sourcePaths = yield* discoverEffectVitestSourcePaths(root);",
        "const sourcePaths = " + roots + ";")
    source = replace_once(source,
        "const sortedFindings = A.sort(graphBackedFindings, findingOrder);",
        "const sortedFindings = A.sort(graphBackedFindings, findingOrder);"
        "const findingText = yield* S.encodeEffect(S.fromJsonString(S.Array(EffectVitestFinding)))(sortedFindings);"
        "yield* Console.log(findingText);")
    # Browser-safe rule filtering still runs against canonical discovered config.
    # Restrict only membership's baseline to these roots, so 'resolved' is scoped too.
    source = replace_once(source,
        "yield* reportMembership(merged, baseline);",
        "yield* reportMembership(merged, A.filter(baseline, (finding) => "
        + json.dumps(files) + ".includes(finding.file)));")

source = re.sub(r'from "(\.[^"]+)"',
                lambda m: "from " + json.dumps(str((module.parent / m[1]).resolve())), source)
(scratch / module.name).write_text(source)
schema_wrapper = r'''
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunServices from "@effect/platform-bun/BunServices";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import { scanSchemaFirstInventory } from "./SchemaFirstScan.ts";
import { readSchemaFirstInventoryDocument } from "__INTERNAL__/SchemaFirstStore.ts";
import { makeSchemaFirstEntryKey } from "__LINT__/Lint.schemas.ts";
const encode = S.encodeEffect(S.fromJsonString(S.Unknown));
await Effect.runPromise(Effect.gen(function*(){
 const result = yield* scanSchemaFirstInventory();
 const baseline = yield* readSchemaFirstInventoryDocument();
 const existing = O.isSome(baseline) ? baseline.value.entries : [];
 const introduced = A.filter(result.document.entries,
   e => !A.some(existing, b => makeSchemaFirstEntryKey(e) === makeSchemaFirstEntryKey(b)));
 const report = {
   sourceRoots: __ROOT_COUNT__, productionFiles: result.scannedFiles.length,
   scannedFiles: result.scannedFiles, introduced,
   parity: result.parityEntries, literalKit: result.literalKitConstAssertionViolations
 };
 const output = yield* encode(report);
 console.log(output);
 if(introduced.length || result.parityEntries.length || result.literalKitConstAssertionViolations.length)
   process.exitCode = 1;
}).pipe(Effect.provide(Layer.mergeAll(BunServices.layer, BunCrypto.layer))));
'''
vitest_wrapper = r'''
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunServices from "@effect/platform-bun/BunServices";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import { FsUtilsLive } from "@beep/repo-utils";
import { runEffectVitestLint } from "./EffectVitestScan.ts";
await Effect.runPromise(
 runEffectVitestLint({census:false,write:false,rows:O.none()}).pipe(
  Effect.provide(Layer.mergeAll(BunServices.layer,BunCrypto.layer,
    FsUtilsLive.pipe(Layer.provide(BunServices.layer))))
 )
);
'''
wrapper = schema_wrapper if args.mode == "schema-first" else vitest_wrapper
wrapper = wrapper.replace("__INTERNAL__", str(internal)).replace("__LINT__", str(internal.parent))
wrapper = wrapper.replace("__ROOT_COUNT__", str(len(files)))
(scratch / "run.ts").write_text(wrapper)
print(f"[pr3c-scoped-lint] mode={args.mode} roots={len(files)} canonical-sha256={digest}", flush=True)
result = subprocess.run(["bun", str(scratch / "run.ts")])
print(f"[pr3c-scoped-lint] exit={result.returncode}", flush=True)
raise SystemExit(result.returncode)
