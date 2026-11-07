# Admitted native annotation operation

The private annotation entry now composes original tuple sorting, optional
source mapping, markup skip/wrap processing and the captured native annotator
through the existing metadata operation owner. It uses the existing Effect
Context, Scope, admission and text-budget capabilities; no parallel execution,
registry or lifetime framework is introduced.

Installation captures the callback and optional supplied offset updater. Each
invocation removes later ambient callback/span-processor replacements and
reinstalls only its captured callback. The supplied updater selects source even
when empty without reading plain text. Invalid mode fails before other request
fields are read. The callback receives the invocation's existing producer budget;
the receiver separately admits and snapshots the returned native word.

Private child stages reuse the outer operation permit through a shared captured
Context helper, also used by extraction. The owner must provide that Context
only inside the admitted invocation; child services cannot escape its Scope.
Default mapping preserves sort-before-map and right-start/left-end behavior.
Diff workers now capture the selected operation for timing, admission and safety
labels, matching the existing regex owner. Their common timing helper owns
selected-operation safety translation.

## Verification

All 214 original unchecked cases pass through the admitted entry twice, with
identical outputs and independent reservation totals on successive calls. No
native processes launch on this branch. Controls preserve invalid-mode read
order, installed callback ownership despite later caller replacement, producer
budget delivery and the empty supplied-source branch without inspecting plain.

Actual Bun and Node entries preserve original balanced skip behavior and
annotation-wrap-composition case 20, including unbalanced interior slicing.
Each runtime independently confirms three child exits for those modes. Original
annotation-mapping case 0 then passes through the default discovery/diff path;
all additional observed children have confirmed exits. Node XML, diff and regex
bundles use separate scoped directories.

Eleven tests across entry, original callback replay and operation-reference
controls pass in 53.10 seconds. A separate earlier entry/diff regression run
passes sixteen tests in 8.30 seconds before the mapping assertion was added.
Final package lint/types, declaration emission and blocking laws pass. Scoped
Fallow reports zero introduced findings and nine inherited clone groups with
unchanged policy. The first new-code audit exposed one duplicated worker safety
handler; sharing it through the existing timing owner removes the duplication.
The initial entry test used an incorrect observed-exit field name; correcting
that assertion retains the zero-spawn requirement.

```sh
bun run beep quality package-verify @beep/law-practice-server --quick
bun run --cwd packages/law-practice/server beep:build
bun run beep lint laws --package packages/law-practice/server
bunx fallow audit --config .fallowrc.jsonc --format json --quiet \
  --base origin/main --gate new-only
cd packages/law-practice/server
bunx --bun vitest run test/CitationAnnotationEntry.test.ts \
  test/CitationAnnotationCallback.test.ts test/CitationRegexOperation.test.ts
```

This qualifies a private native-string profile, not the complete public engine.
Raw-source annotation with genuine source evidence, public service/Layer dispatch,
general host values and iterator/sort protocols, nested callbacks, builtin
difflib behavior, final exception translation and whole-engine safety/scaling
remain required. All eleven representation laws, four fidelity questions and
fifteen unfinished proof rows remain open. No source/donor disposition, semantic
waiver, expected result, prerequisite contract, baseline or threshold changes.
Hosted verification of the published head remains separate from local proof.
