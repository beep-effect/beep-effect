import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Node, Project } from "ts-morph";

const repoRoot = resolve(import.meta.dir, "../../../..");
const inventoryPath = resolve(import.meta.dir, "../migration-inventory.json");

type PropertyRead = {
  readonly file: string;
  readonly start: number;
  readonly property: string;
};

type Attachment = {
  readonly file: string;
  readonly helper: string;
  readonly jsonKeys: ReadonlyArray<string>;
  readonly line: number;
  readonly owner: string | null;
  readonly ownerPosition: number | null;
  readonly propertyReads: ReadonlyArray<PropertyRead>;
  readonly selectedKeys: ReadonlyArray<string>;
  readonly start: number;
};

type Inventory = {
  readonly attachments: ReadonlyArray<Attachment>;
};

const inventory = JSON.parse(readFileSync(inventoryPath, "utf8")) as Inventory;
const skippedOwners = new Set([
  "packages/foundation/modeling/schema/src/URL.ts:URLStr",
  "packages/shared/domain/src/entity/EntityId.ts:factory",
]);
const skippedFiles = new Set([
  "packages/foundation/modeling/schema/src/Unknown.ts",
  "packages/foundation/modeling/schema/test/codecStatics.test.ts",
]);

const groups = new Map<string, Array<Attachment>>();
for (const attachment of inventory.attachments) {
  const key = `${attachment.file}:${attachment.ownerPosition ?? attachment.start}`;
  const group = groups.get(key) ?? [];
  group.push(attachment);
  groups.set(key, group);
}

const project = new Project({ skipAddingFilesFromTsConfig: true });
const migrationFiles = new Set([
  ...inventory.attachments.map((attachment) => attachment.file),
  ...inventory.attachments.flatMap((attachment) => attachment.propertyReads.map((read) => read.file)),
]);
const sourceFiles = new Map(
  [...migrationFiles].map((file) => {
    const sourceFile = project.addSourceFileAtPath(resolve(repoRoot, file));
    return [file, sourceFile] as const;
  })
);

const nodeAt = (file: string, start: number): Node => {
  const sourceFile = sourceFiles.get(file);
  if (sourceFile === undefined) {
    throw new Error(`Missing source file '${file}'.`);
  }
  const descendant = sourceFile.getDescendantAtPos(start);
  if (descendant === undefined) {
    throw new Error(`Missing node at '${file}:${start}'.`);
  }
  let current = descendant;
  while (
    Node.isIdentifier(current) &&
    Node.isPropertyAccessExpression(current.getParent()) &&
    current.getParentOrThrow().getStart() === start
  ) {
    current = current.getParentOrThrow();
  }
  return current;
};

const replacementName = (node: Node): string => {
  if (Node.isPropertyAccessExpression(node)) {
    return `${node.getExpression().getText()}.withCodecStatics`;
  }
  return "withCodecStatics";
};

const helperNodes = new Map(
  inventory.attachments.map((attachment) => [
    `${attachment.file}:${attachment.start}`,
    nodeAt(attachment.file, attachment.start),
  ])
);
const propertyNodes = new Map(
  inventory.attachments.flatMap((attachment) =>
    attachment.propertyReads.map((read) => [`${read.file}:${read.start}`, nodeAt(read.file, read.start)] as const)
  )
);

let migratedGroups = 0;
let skippedGroups = 0;

for (const group of groups.values()) {
  const [first] = group;
  if (first === undefined) {
    continue;
  }
  const ownerKey = `${first.file}:${first.owner ?? ""}`;
  if (
    skippedFiles.has(first.file) ||
    skippedOwners.has(ownerKey) ||
    group.some((attachment) => attachment.jsonKeys.length > 0)
  ) {
    skippedGroups += 1;
    continue;
  }

  const keys = [...new Set(group.flatMap((attachment) => attachment.selectedKeys))].sort();
  const keyText = `[${keys.map((key) => `"${key}"`).join(", ")}]`;
  const ordered = [...group].sort((left, right) => right.start - left.start);

  for (const [index, attachment] of ordered.entries()) {
    const helper = helperNodes.get(`${attachment.file}:${attachment.start}`);
    if (helper === undefined) {
      throw new Error(`Missing cached helper at '${attachment.file}:${attachment.line}'.`);
    }
    const parent = helper.getParentOrThrow();
    if (!Node.isCallExpression(parent)) {
      throw new Error(`Expected helper call parent at '${attachment.file}:${attachment.line}'.`);
    }

    const keep = index === ordered.length - 1 && keys.length > 0;
    if (parent.getExpression() === helper) {
      if (keep) {
        helper.replaceWithText(replacementName(helper));
        parent.addArgument(keyText);
      } else {
        const [schema] = parent.getArguments();
        if (schema === undefined) {
          throw new Error(`Cannot remove data-first helper at '${attachment.file}:${attachment.line}'.`);
        }
        parent.replaceWithText(schema.getText());
      }
      continue;
    }

    const argumentIndex = parent.getArguments().indexOf(helper);
    if (argumentIndex < 0) {
      throw new Error(`Expected helper argument at '${attachment.file}:${attachment.line}'.`);
    }
    if (keep) {
      helper.replaceWithText(`${replacementName(helper)}(${keyText})`);
    } else {
      parent.removeArgument(argumentIndex);
    }
  }

  const hasBareCodecHelper = group.some((attachment) => attachment.helper === "withCodecStatics");
  const hasOptionBundle = group.some((attachment) => attachment.helper === "withOptionCodecStatics");
  if (hasBareCodecHelper) {
    const propertyReads = new Map<string, PropertyRead>();
    for (const read of group.flatMap((attachment) => attachment.propertyReads)) {
      propertyReads.set(`${read.file}:${read.start}`, read);
    }
    for (const read of propertyReads.values()) {
      if (read.property === "fromUnknown" || (read.property === "decodeOption" && !hasOptionBundle)) {
        const property = propertyNodes.get(`${read.file}:${read.start}`);
        if (property === undefined) {
          throw new Error(`Missing cached property at '${read.file}:${read.start}'.`);
        }
        property.replaceWithText(read.property === "fromUnknown" ? "decodeUnknownSync" : "decodeUnknownOption");
      }
    }
  }

  migratedGroups += 1;
}

for (const sourceFile of sourceFiles.values()) {
  if (!sourceFile.wasForgotten() && sourceFile.isSaved() === false) {
    await sourceFile.save();
  }
}

console.log(JSON.stringify({ migratedGroups, skippedGroups }));
