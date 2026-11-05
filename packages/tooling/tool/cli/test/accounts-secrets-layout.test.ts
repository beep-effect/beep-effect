import { AccountsSecretsItem, layoutSecretsItem, secretsLayoutIdentity } from "@beep/repo-cli/test/Accounts";
import { it } from "@beep/test-runner";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";

const AccountsSecretsItemJson = S.fromJsonString(AccountsSecretsItem);

const item =
  '{"id":"synthetic-item","version":7,"fields":[{"id":"a","label":"DEV_Z","type":"CONCEALED","value":"synthetic-secret-z","reference":"op://fixture/item/DEV_Z","extra":{"keep":true}},{"id":"b","label":"GITHUB_TOKEN","type":"CONCEALED","value":"synthetic-secret-b"},{"id":"c","label":"AI_KEY","type":"CONCEALED","value":"synthetic-secret-c"},{"id":"notesPlain","label":"notes","type":"STRING","purpose":"NOTES","value":"synthetic-private-note"}],"sections":[{"id":"old","label":"Old"}],"urls":[{"href":"https://fixture.invalid"}]}';

it.layer(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer), { timeout: "30 seconds" })(
  "accounts secrets layout",
  (it) => {
    it.effect(
      "routes prefixes and mapped labels, keeps notes first, prunes empty sections and preserves every field attribute",
      Effect.fnUntraced(function* () {
        const decoded = yield* S.decodeEffect(AccountsSecretsItemJson)(item);
        const transformed = yield* layoutSecretsItem(decoded);
        expect(A.map(transformed.fields, (field) => field.id)).toEqual(["notesPlain", "c", "a", "b"]);
        expect(transformed.sections).toEqual([
          { id: "ai", label: "AI" },
          { id: "dev", label: "DEV" },
        ]);
        const secretsLayoutIdentity1 = yield* secretsLayoutIdentity(transformed.fields);
        const expectation = expect(secretsLayoutIdentity1);
        const secretsLayoutIdentity2 = yield* secretsLayoutIdentity(decoded.fields);
        expectation.toBe(secretsLayoutIdentity2);
        const value2 = yield* S.encodeEffect(AccountsSecretsItemJson)(transformed);
        expect(value2).toContain('"extra":{"keep":true}');
        expect(transformed.urls).toEqual([{ href: "https://fixture.invalid" }]);
        const layoutSecretsItem3 = yield* layoutSecretsItem(transformed);
        expect(layoutSecretsItem3).toEqual(transformed);
        const unmapped = yield* S.decodeEffect(AccountsSecretsItemJson)(
          '{"fields":[{"id":"x","label":"UNKNOWN","type":"STRING","value":"synthetic-only"}],"sections":[]}'
        );
        const pipe4 = yield* layoutSecretsItem(unmapped).pipe(Effect.isFailure);
        expect(pipe4).toBe(true);
        const changed = yield* S.decodeEffect(AccountsSecretsItemJson)(
          Str.replace("synthetic-secret-z", "different-synthetic-value")(item)
        );
        const secretsLayoutIdentity5 = yield* secretsLayoutIdentity(changed.fields);
        const argument = expect(secretsLayoutIdentity5).not;
        const secretsLayoutIdentity3 = yield* secretsLayoutIdentity(decoded.fields);
        argument.toBe(secretsLayoutIdentity3);
      })
    );

    it.effect.prop(
      "preserves arbitrary synthetic values and extension metadata through layout and codec round trips",
      { value: Arbitrary.schema(S.String) },
      ({ value }) =>
        Effect.gen(function* () {
          const original = yield* S.decodeEffect(AccountsSecretsItem)({
            fields: [{ id: "property-field", label: "DEV_PROPERTY", type: "CONCEALED", value, extra: value }],
            sections: [],
            extension: value,
          });
          const transformed = yield* layoutSecretsItem(original);
          const secretsLayoutIdentity6 = yield* secretsLayoutIdentity(transformed.fields);
          const expectation1 = expect(secretsLayoutIdentity6);
          const secretsLayoutIdentity4 = yield* secretsLayoutIdentity(original.fields);
          expectation1.toBe(secretsLayoutIdentity4);
          const encoded = yield* S.encodeEffect(AccountsSecretsItem)(transformed);
          expect(encoded.extension).toBe(value);
          expect(encoded.fields[0]?.extra).toBe(value);
          const decoded = yield* S.decodeEffect(AccountsSecretsItem)(encoded);
          const layoutSecretsItem7 = yield* layoutSecretsItem(decoded);
          expect(layoutSecretsItem7).toEqual(transformed);
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
        const run = Effect.fn("SecretsLayoutTest.run")(function* (apply: boolean, human: boolean) {
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
              handle.stdout.pipe(Stream.decodeText, Stream.mkString),
              handle.stderr.pipe(Stream.decodeText, Stream.mkString),
            ],
            { concurrency: "unbounded" }
          );
          expect(`${stdout}${stderr}`).not.toContain("synthetic-secret-");
          expect(`${stdout}${stderr}`).not.toContain("synthetic-private-note");
          return { code, stdout, stderr };
        }, Effect.scoped);
        expect((yield* run(false, false)).code).toBe(0);
        const readFileString8 = yield* fs.readFileString(path.join(root, "operations"));
        expect(readFileString8).toBe("item get\n");
        const exists9 = yield* fs.exists(path.join(root, "edited.json"));
        expect(exists9).toBe(false);
        expect((yield* run(true, false)).code).not.toBe(0);
        const readFileString10 = yield* fs.readFileString(path.join(root, "operations"));
        expect(readFileString10).toBe("item get\n");
        const applied = yield* run(true, true);
        expect(applied.code, applied.stderr).toBe(0);
        expect(applied.stdout).toContain("written version 7: 4 fields, sections: AI DEV");
        const readFileString11 = yield* fs.readFileString(path.join(root, "operations"));
        expect(readFileString11).toBe("item get\nitem get\nitem edit\n");
        const argument1 = S.decodeEffect(AccountsSecretsItemJson);
        const readFileString5 = yield* fs.readFileString(path.join(root, "edited.json"));
        const sent = yield* argument1(readFileString5);
        const original = yield* S.decodeEffect(AccountsSecretsItemJson)(item);
        const secretsLayoutIdentity12 = yield* secretsLayoutIdentity(sent.fields);
        const expectation2 = expect(secretsLayoutIdentity12);
        const secretsLayoutIdentity7 = yield* secretsLayoutIdentity(original.fields);
        expectation2.toBe(secretsLayoutIdentity7);
      })
    );
  }
);
