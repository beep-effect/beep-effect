import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { Node, Project, SyntaxKind } from "ts-morph";
import type { Symbol as MorphSymbol, SourceFile, VariableDeclaration } from "ts-morph";

const repoRoot = resolve(import.meta.dir, "../../../..");
const outputPath = resolve(import.meta.dir, Bun.argv[2] ?? "../migration-inventory.json");

const helperNames = new Set([
  "withCodecStatics",
  "withEffectCodecStatics",
  "withExitCodecStatics",
  "withOptionCodecStatics",
  "withPromiseCodecStatics",
  "withResultCodecStatics",
  "withSyncCodecStatics",
]);

const codecStaticNames = new Set([
  "asserts",
  "decodeEffect",
  "decodeExit",
  "decodeOption",
  "decodePromise",
  "decodeResult",
  "decodeSync",
  "decodeUnknownEffect",
  "decodeUnknownExit",
  "decodeUnknownOption",
  "decodeUnknownPromise",
  "decodeUnknownResult",
  "decodeUnknownSync",
  "encodeEffect",
  "encodeExit",
  "encodeOption",
  "encodePromise",
  "encodeResult",
  "encodeSync",
  "encodeUnknownEffect",
  "encodeUnknownExit",
  "encodeUnknownOption",
  "encodeUnknownPromise",
  "encodeUnknownResult",
  "encodeUnknownSync",
  "equivalence",
  "fromUnknown",
  "is",
  "toArbitrary",
]);

const schemaMethodNames = new Set(["annotate", "annotateKey", "check", "pipe", "rebuild"]);

const rootSchemaSource = (source: Node | undefined): Node | undefined => {
  let current = source;
  while (current !== undefined && Node.isCallExpression(current)) {
    const expression = current.getExpression();
    if (!Node.isPropertyAccessExpression(expression) || !schemaMethodNames.has(expression.getName())) {
      return current;
    }
    current = expression.getExpression();
  }
  return current;
};

type PendingAttachment = {
  file: string;
  helper: string;
  line: number;
  start: number;
  owner: string | null;
  ownerPosition: number | null;
  pipelineSource: string | null;
  precedingOperations: ReadonlyArray<string>;
  sourceCodecStatics: ReadonlyArray<string>;
  sourceHasCases: boolean;
  rootSource: string | null;
  rootSourceCodecStatics: ReadonlyArray<string>;
  rootSourceHasCases: boolean;
  declaredKeys: Set<string>;
  selectedKeys: Set<string>;
  jsonKeys: Set<string>;
  propertyReads: Array<{ file: string; start: number; property: string }>;
  referenceCount: number;
};

const project = new Project({
  tsConfigFilePath: resolve(repoRoot, "tsconfig.base.json"),
  skipAddingFilesFromTsConfig: true,
});

project.addSourceFilesAtPaths([
  resolve(repoRoot, "apps/**/src/**/*.{ts,tsx}"),
  resolve(repoRoot, "apps/**/test/**/*.{ts,tsx}"),
  resolve(repoRoot, "packages/**/src/**/*.{ts,tsx}"),
  resolve(repoRoot, "packages/**/test/**/*.{ts,tsx}"),
  resolve(repoRoot, "scripts/**/*.{ts,tsx}"),
]);

const helperName = (node: Node): string | undefined => {
  if (Node.isIdentifier(node) && helperNames.has(node.getText())) {
    const parent = node.getParent();
    if (Node.isPropertyAccessExpression(parent) && parent.getNameNode() === node) {
      return undefined;
    }
    return node.getText();
  }
  if (Node.isPropertyAccessExpression(node) && helperNames.has(node.getName())) {
    return node.getName();
  }
  return undefined;
};

const ownerOf = (node: Node): VariableDeclaration | undefined =>
  node.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);

const normalizedSymbol = (symbol: MorphSymbol | undefined): MorphSymbol | undefined => {
  let current = symbol;
  while (current?.isAlias()) {
    current = current.getAliasedSymbol();
  }
  return current;
};

const symbolKey = (symbol: MorphSymbol | undefined): object | undefined => normalizedSymbol(symbol)?.compilerSymbol;

const selectedKey = (property: string, helper: string): string | undefined => {
  if (property.includes("FromJsonString")) {
    return undefined;
  }
  if (helper === "withCodecStatics" && property === "fromUnknown") {
    return "decodeUnknownSync";
  }
  if (helper === "withCodecStatics" && property === "decodeOption") {
    return "decodeOption";
  }
  if (helper === "withCodecStatics") {
    return codecStaticNames.has(property) ? property : undefined;
  }
  const shared =
    property === "asserts" || property === "equivalence" || property === "is" || property === "toArbitrary";
  const family = helper.slice("with".length, -"CodecStatics".length);
  return codecStaticNames.has(property) && (shared || property.endsWith(family)) ? property : undefined;
};

const attachments: Array<PendingAttachment> = [];
const seenLocations = new Set<string>();
const attachmentsByOwner = new Map<object, Array<PendingAttachment>>();

const isAttachmentReference = (node: Node, helper: string): boolean => {
  const parent = node.getParent();
  if (helper === "withCodecStatics") {
    return Node.isCallExpression(parent) && parent.getExpression() === node;
  }
  return Node.isCallExpression(parent) && (parent.getExpression() === node || parent.getArguments().includes(node));
};

const inspectSourceFile = (sourceFile: SourceFile): void => {
  sourceFile.forEachDescendant((node) => {
    const helper = helperName(node);
    if (helper === undefined || !isAttachmentReference(node, helper)) {
      return;
    }

    const location = `${sourceFile.getFilePath()}:${node.getStart()}`;
    if (seenLocations.has(location)) {
      return;
    }
    seenLocations.add(location);

    const owner = ownerOf(node);
    const isNegativeSelectionFixture =
      sourceFile.getBaseName() === "codecStatics.test.ts" &&
      (owner === undefined || owner.getName() === "invalidSelectionsAreRejectedAtCompileTime");
    if (isNegativeSelectionFixture) {
      return;
    }
    const parent = node.getParent();
    const call = Node.isCallExpression(parent) && parent.getExpression() === node ? parent : undefined;
    const containingCall = call?.getParent();
    const pipelineCall =
      containingCall !== undefined && Node.isCallExpression(containingCall) ? containingCall : undefined;
    const pipelineExpression = pipelineCall?.getExpression();
    const pipelineArguments = pipelineCall?.getArguments() ?? [];
    const operationIndex = call === undefined ? -1 : pipelineArguments.indexOf(call);
    const isMethodPipe =
      pipelineExpression !== undefined &&
      Node.isPropertyAccessExpression(pipelineExpression) &&
      pipelineExpression.getName() === "pipe";
    const isFunctionPipe =
      pipelineExpression !== undefined &&
      Node.isIdentifier(pipelineExpression) &&
      pipelineExpression.getText() === "pipe";
    const pipelineSourceNode = isMethodPipe
      ? pipelineExpression.getExpression()
      : isFunctionPipe
        ? pipelineArguments[0]
        : call?.getArguments()[0];
    const pipelineSource = pipelineSourceNode?.getText();
    const sourceProperties = new Set(
      pipelineSourceNode
        ?.getType()
        .getProperties()
        .map((property) => property.getName())
    );
    const rootSourceNode = rootSchemaSource(pipelineSourceNode);
    const rootSourceProperties = new Set(
      rootSourceNode
        ?.getType()
        .getProperties()
        .map((property) => property.getName())
    );
    const precedingOperations =
      operationIndex < 0
        ? []
        : pipelineArguments
            .slice(isFunctionPipe ? 1 : 0, operationIndex)
            .map((operation) => operation.getText().slice(0, 160));
    const selection = call?.getArguments().at(-1);
    const declaredKeys = new Set<string>();
    if (selection !== undefined && Node.isArrayLiteralExpression(selection)) {
      for (const element of selection.getElements()) {
        if (Node.isStringLiteral(element)) {
          declaredKeys.add(element.getLiteralValue());
        }
      }
    }
    const attachment: PendingAttachment = {
      file: relative(repoRoot, sourceFile.getFilePath()),
      helper,
      line: node.getStartLineNumber(),
      start: node.getStart(),
      owner: owner?.getName() ?? null,
      ownerPosition: owner?.getStart() ?? null,
      pipelineSource: pipelineSource ?? null,
      precedingOperations,
      sourceCodecStatics: [...sourceProperties].filter((property) => codecStaticNames.has(property)).sort(),
      sourceHasCases: sourceProperties.has("cases"),
      rootSource: rootSourceNode?.getText() ?? null,
      rootSourceCodecStatics: [...rootSourceProperties].filter((property) => codecStaticNames.has(property)).sort(),
      rootSourceHasCases: rootSourceProperties.has("cases"),
      declaredKeys,
      selectedKeys: new Set(),
      jsonKeys: new Set(),
      propertyReads: [],
      referenceCount: 0,
    };
    attachments.push(attachment);

    const ownerKey = owner === undefined ? undefined : symbolKey(owner.getSymbol());
    if (ownerKey !== undefined) {
      const ownedAttachments = attachmentsByOwner.get(ownerKey) ?? [];
      ownedAttachments.push(attachment);
      attachmentsByOwner.set(ownerKey, ownedAttachments);
    }
  });
};

for (const sourceFile of project.getSourceFiles()) {
  inspectSourceFile(sourceFile);
}

for (const sourceFile of project.getSourceFiles()) {
  sourceFile.forEachDescendant((node) => {
    if (!Node.isPropertyAccessExpression(node)) {
      return;
    }
    const property = node.getName();
    if (!codecStaticNames.has(property) && !property.includes("FromJsonString")) {
      return;
    }
    const ownerKey = symbolKey(node.getExpression().getSymbol());
    if (ownerKey === undefined) {
      return;
    }
    const ownedAttachments = attachmentsByOwner.get(ownerKey);
    if (ownedAttachments === undefined) {
      return;
    }
    for (const attachment of ownedAttachments) {
      attachment.referenceCount += 1;
      attachment.propertyReads.push({
        file: relative(repoRoot, sourceFile.getFilePath()),
        start: node.getNameNode().getStart(),
        property,
      });
      if (property.includes("FromJsonString")) {
        attachment.jsonKeys.add(property);
      }
      const key = selectedKey(property, attachment.helper);
      if (key !== undefined) {
        attachment.selectedKeys.add(key);
      }
    }
  });
}

attachments.sort(
  (left, right) =>
    left.file.localeCompare(right.file) || left.line - right.line || left.helper.localeCompare(right.helper)
);

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(
  outputPath,
  `${JSON.stringify(
    {
      schemaVersion: "codec-static-migration-inventory/v1",
      generatedAt: new Date().toISOString(),
      sourceFileCount: project.getSourceFiles().length,
      attachmentCount: attachments.length,
      unresolvedOwnerCount: attachments.filter((attachment) => attachment.owner === null).length,
      jsonBoundaryCount: attachments.filter((attachment) => attachment.jsonKeys.size > 0).length,
      attachments: attachments.map((attachment) => ({
        ...attachment,
        declaredKeys: [...attachment.declaredKeys],
        selectedKeys: [...attachment.selectedKeys].sort(),
        jsonKeys: [...attachment.jsonKeys].sort(),
      })),
    },
    null,
    2
  )}\n`
);

console.log(outputPath);
