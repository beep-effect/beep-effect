import { AccountsSecretsItem, layoutSecretsItem, secretsLayoutIdentity } from "@beep/repo-cli/commands/Accounts";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import { ChildProcess } from "effect/process";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";

const item =
  '{"id":"synthetic-item","version":7,"fields":[{"id":"a","label":"DEV_Z","type":"CONCEALED","value":"synthetic-secret-z","reference":"op://fixture/item/DEV_Z","extra":{"keep":true}},{"id":"b","label":"GITHUB_TOKEN","type":"CONCEALED","value":"synthetic-secret-b"},{"id":"c","label":"AI_KEY","type":"CONCEALED","value":"synthetic-secret-c"},{"id":"notesPlain","label":"notes","type":"STRING","purpose":"NOTES","value":"synthetic-private-note"}],"sections":[{"id":"old","label":"Old"}],"urls":[{"href":"https://fixture.invalid"}]}';

it.layer(NodeServices.layer, { timeout: "30 seconds" })("accounts secrets layout", (it) => {
  it.effect(
    "routes prefixes and mapped labels, keeps notes first, prunes empty sections and preserves every field attribute",
    Effect.fnUntraced(function* () {
      const decoded = yield* S.decodeUnknownEffect(S.fromJsonString(AccountsSecretsItem))(item);
      const transformed = yield* layoutSecretsItem(decoded);
      expect(A.map(transformed.fields, (field) => field.id)).toEqual(["notesPlain", "c", "b", "a"]);
      expect(transformed.sections).toEqual([
        { id: "ai", label: "AI" },
        { id: "dev", label: "DEV" },
      ]);
      expect(yield* secretsLayoutIdentity(transformed.fields)).toBe(yield* secretsLayoutIdentity(decoded.fields));
      expect(yield* S.encodeEffect(S.fromJsonString(AccountsSecretsItem))(transformed)).toContain(
        '"extra":{"keep":true}'
      );
      expect(transformed.urls).toEqual([{ href: "https://fixture.invalid" }]);
      expect(yield* layoutSecretsItem(transformed)).toEqual(transformed);
      const unmapped = yield* S.decodeUnknownEffect(S.fromJsonString(AccountsSecretsItem))(
        '{"fields":[{"id":"x","label":"UNKNOWN","type":"STRING","value":"synthetic-only"}],"sections":[]}'
      );
      expect(yield* layoutSecretsItem(unmapped).pipe(Effect.isFailure)).toBe(true);
      const changed = yield* S.decodeUnknownEffect(S.fromJsonString(AccountsSecretsItem))(
        Str.replace("synthetic-secret-z", "different-synthetic-value")(item)
      );
      expect(yield* secretsLayoutIdentity(changed.fields)).not.toBe(yield* secretsLayoutIdentity(decoded.fields));
    })
  );

  it.effect(
    "never calls item edit in dry-run or through the agent apply route and never prints synthetic values",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const ambientPath = yield* Config.String("PATH");
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "secrets-layout-fixture-" });
      const bin = path.join(root, "bin");
      yield* fs.makeDirectory(bin);
      yield* fs.writeFileString(path.join(root, "item.json"), item);
      const fake =
        '#!/bin/sh\nprintf "%s\\n" "$1 $2" >> "$LAYOUT_FIXTURE/operations"\nif [ "$2" = "edit" ]; then cat > "$LAYOUT_FIXTURE/edited.json"; fi\ncat "$LAYOUT_FIXTURE/item.json"\n';
      for (const name of ["op", "op-human"]) {
        yield* fs.writeFileString(path.join(bin, name), fake);
        yield* fs.chmod(path.join(bin, name), 0o755);
      }
      const cli = yield* path.fromFileUrl(new URL("../src/bin.ts", import.meta.url));
      const run = Effect.fn("SecretsLayoutTest.run")(function* (apply: boolean, human = false) {
        const handle = yield* ChildProcess.make(
          "bun",
          [cli, "accounts", "secrets-layout", ...(apply ? ["--apply"] : [])],
          {
            env: { PATH: `${bin}:${ambientPath}`, OP_BIN: human ? "op-human" : "op", LAYOUT_FIXTURE: root },
            stdin: "ignore",
            stdout: "pipe",
            stderr: "pipe",
          }
        );
        const [code, stdout, stderr] = yield* Effect.all(
          [
            handle.exitCode,
            Stream.mkString(Stream.decodeText(handle.stdout)),
            Stream.mkString(Stream.decodeText(handle.stderr)),
          ],
          { concurrency: "unbounded" }
        );
        expect(`${stdout}${stderr}`).not.toContain("synthetic-secret-");
        expect(`${stdout}${stderr}`).not.toContain("synthetic-private-note");
        return { code, stdout, stderr };
      }, Effect.scoped);
      expect((yield* run(false)).code).toBe(0);
      expect(yield* fs.readFileString(path.join(root, "operations"))).toBe("item get\n");
      expect(yield* fs.exists(path.join(root, "edited.json"))).toBe(false);
      expect((yield* run(true)).code).not.toBe(0);
      expect(yield* fs.readFileString(path.join(root, "operations"))).toBe("item get\n");
      const applied = yield* run(true, true);
      expect(applied.code, applied.stderr).toBe(0);
      expect(applied.stdout).toContain("written version 7: 4 fields, sections: AI DEV");
      expect(yield* fs.readFileString(path.join(root, "operations"))).toBe("item get\nitem get\nitem edit\n");
      const sent = yield* S.decodeUnknownEffect(S.fromJsonString(AccountsSecretsItem))(
        yield* fs.readFileString(path.join(root, "edited.json"))
      );
      const original = yield* S.decodeUnknownEffect(S.fromJsonString(AccountsSecretsItem))(item);
      expect(yield* secretsLayoutIdentity(sent.fields)).toBe(yield* secretsLayoutIdentity(original.fields));
    })
  );
});
