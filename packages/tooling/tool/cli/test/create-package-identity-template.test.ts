import { fileURLToPath } from "node:url";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem } from "effect";

const identityRegistrationPath = fileURLToPath(
  new URL("../src/commands/CreatePackage/internal/IdentityRegistration.ts", import.meta.url)
);
const identityExportBlockPath = fileURLToPath(
  new URL("../src/commands/CreatePackage/internal/IdentityExportBlock.ts", import.meta.url)
);

describe("create-package identity template", () => {
  it.effect(
    "keeps the identity registration template aligned with @beep/identity's generated surface",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const identityRegistrationSource = yield* fs.readFileString(identityRegistrationPath);
      const identityExportBlockSource = yield* fs.readFileString(identityExportBlockPath);

      expect(identityRegistrationSource).toContain('const IDENTITY_PACKAGE_NAME = "@beep/identity" as const;');
      expect(identityExportBlockSource).toContain(
        "const toIdentityAccessorName = (packageName: string): string => `$${Str.pascalCase(packageName)}Id`;"
      );
      expect(identityExportBlockSource).toContain('` * import { ${accessorName} } from "@beep/identity/packages"`');
      expect(identityExportBlockSource).toContain(
        '`export const ${accessorName}: Identity.IdentityComposer<"@beep/${packageName}"> = composers.${accessorName};`'
      );
      expect(identityRegistrationSource).toContain(
        'sourceFile.getVariableDeclaration("generatedComposers") ?? sourceFile.getVariableDeclarationOrThrow("composers")'
      );
    }, provideScopedLayer(NodeServices.layer))
  );
});
