import { fileURLToPath } from "node:url";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem } from "effect";

const handlerPath = fileURLToPath(new URL("../src/commands/CreatePackage/Handler.ts", import.meta.url));

describe("create-package identity template", () => {
  it.effect("keeps the identity registration template aligned with @beep/identity's generated surface", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const handlerSource = yield* fs.readFileString(handlerPath);

      expect(handlerSource).toContain('const IDENTITY_PACKAGE_NAME = "@beep/identity" as const;');
      expect(handlerSource).toContain(
        "const toIdentityAccessorName = (packageName: string): string => `$${Str.pascalCase(packageName)}Id`;"
      );
      expect(handlerSource).toContain('` * import { ${accessorName} } from "@beep/identity"`');
      expect(handlerSource).toContain(
        '`export const ${accessorName}: Identity.IdentityComposer<"@beep/${packageName}"> = composers.${accessorName};`'
      );
      expect(handlerSource).toContain(
        'sourceFile.getVariableDeclaration("generatedComposers") ?? sourceFile.getVariableDeclarationOrThrow("composers")'
      );
    }).pipe(provideScopedLayer(NodeServices.layer))
  );
});
