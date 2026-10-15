import { CapabilitySupported, PracticeProfile } from "@beep/law-practice-domain";
import {
  BOX_READ_MAX_CHARACTERS,
  BoxDocument,
  BoxDriveProviderLayer,
  BoxDriveToolkit,
  BoxDriveToolkitHandlers,
  BoxListing,
  BoxToolError,
} from "@beep/practice-gateway/BoxDriveTools";
import { ProfileStore } from "@beep/practice-gateway/ProfileStore";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import * as MemoryFileSystem from "@beep/test-utils/MemoryFileSystem";
import * as BunPath from "@effect/platform-bun/BunPath";
import { describe, expect } from "@effect/vitest";
import { assertTrue, deepStrictEqual } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as McpServer from "effect/ai/McpServer";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { fakeHost, gapProfile, itLimits, settingsLayer } from "./fixtures.ts";

const Platform = Layer.mergeAll(MemoryFileSystem.layer, BunPath.layer);
const layerTimeout = "30 seconds";

const makePdf = (text: string) =>
  Effect.promise(() =>
    PDFDocument.create().then((document) =>
      document.embedFont(StandardFonts.Helvetica).then((font) => {
        document.addPage().drawText(text, { font, size: 12, x: 50, y: 700 });
        return document.save();
      })
    )
  );

// A Windows user folder on disk: Box holds a client folder, notes, a PDF,
// an image, and a symlink that leads out of the Box folder.
const userFolder = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const home = yield* fs.makeTempDirectoryScoped({ prefix: "practice-gateway-box-" });
  const box = path.join(home, "Box");
  yield* fs.makeDirectory(path.join(box, "Clients", "Smith"), { recursive: true });
  yield* fs.makeDirectory(path.join(home, "Private"), { recursive: true });
  yield* fs.writeFileString(path.join(home, "Private", "secret.txt"), "not for Claude");
  yield* fs.writeFileString(path.join(box, "Clients", "Smith", "notes.md"), "# Smith\nFiling due Friday.");
  yield* fs.writeFileString(path.join(box, "readme.txt"), "Box root file");
  yield* fs.writeFileString(path.join(box, "long.txt"), "x".repeat(BOX_READ_MAX_CHARACTERS + 10));
  yield* fs.writeFile(path.join(box, "Clients", "Smith", "letter.pdf"), yield* makePdf("Dear Ms Smith"));
  yield* fs.writeFile(path.join(box, "photo.png"), new Uint8Array([137, 80, 78, 71]));
  yield* fs.symlink(path.join(home, "Private"), path.join(box, "escape"));
  return home;
});

const ToolsOnDisk = Layer.unwrap(
  userFolder.pipe(
    Effect.map((home) => BoxDriveToolkitHandlers.pipe(Layer.provide(fakeHost({ folders: [["USERPROFILE", home]] }))))
  )
).pipe(Layer.provide(Platform));

const call = Effect.fnUntraced(function* (name: "box_list" | "box_read", params: { readonly path?: string }) {
  const toolkit = yield* BoxDriveToolkit;
  const stream = yield* toolkit.handle(name, { path: params.path ?? "" });
  const first = yield* Stream.runHead(stream);
  return O.getOrThrow(first).encodedResult;
});

const listing = (path?: string) =>
  call("box_list", path === undefined ? {} : { path }).pipe(Effect.flatMap(S.decodeUnknownEffect(BoxListing)));
const document = (path: string) => call("box_read", { path }).pipe(Effect.flatMap(S.decodeUnknownEffect(BoxDocument)));
const refusal = (name: "box_list" | "box_read", path: string) =>
  call(name, { path }).pipe(Effect.flatMap(S.decodeUnknownEffect(BoxToolError)));

describe("Box Drive tools", () => {
  it.layer(ToolsOnDisk, { timeout: layerTimeout })("over a Box folder on disk", (it) => {
    it.effect("lists folders first, then files, with sizes", () =>
      Effect.gen(function* () {
        const root = yield* listing();
        expect(root.path).toBe("");
        expect(A.map(root.entries, (entry) => [entry.name, entry.kind])).toEqual([
          ["Clients", "folder"],
          ["long.txt", "file"],
          ["photo.png", "file"],
          ["readme.txt", "file"],
        ]);
        deepStrictEqual(
          A.map(root.entries, (entry) => entry.sizeBytes),
          [O.none(), O.some(BOX_READ_MAX_CHARACTERS + 10), O.some(4), O.some(13)]
        );
        const smith = yield* listing("Clients\\Smith");
        expect(A.map(smith.entries, (entry) => entry.path)).toEqual([
          "Clients/Smith/letter.pdf",
          "Clients/Smith/notes.md",
        ]);
      })
    );

    it.effect("reads text and markdown files", () =>
      Effect.gen(function* () {
        const notes = yield* document("Clients/Smith/notes.md");
        expect(notes.content).toMatchObject({ kind: "text", text: "# Smith\nFiling due Friday.", truncated: false });
        const long = yield* document("long.txt");
        expect(long.content).toMatchObject({ kind: "text", truncated: true });
        expect(long.content.kind === "text" && long.content.text.length).toBe(BOX_READ_MAX_CHARACTERS);
      })
    );

    it.effect("reads a PDF's text layer through the document text driver", () =>
      Effect.gen(function* () {
        const letter = yield* document("Clients/Smith/letter.pdf");
        expect(letter.content.kind).toBe("text");
        expect(letter.content.kind === "text" && letter.content.text).toContain("Dear Ms Smith");
      })
    );

    it.effect("returns metadata only for formats without text", () =>
      Effect.gen(function* () {
        const photo = yield* document("photo.png");
        expect(photo).toMatchObject({ name: "photo.png", sizeBytes: 4 });
        expect(photo.content).toMatchObject({ kind: "metadata-only", reason: "Images have no text to read." });
      })
    );

    it.effect("refuses paths that leave the Box folder", () =>
      Effect.gen(function* () {
        expect((yield* refusal("box_read", "../Private/secret.txt")).reason).toBe("outside-box-folder");
        expect((yield* refusal("box_list", "Clients/../..")).reason).toBe("outside-box-folder");
        expect((yield* refusal("box_read", "/etc/passwd")).reason).toBe("outside-box-folder");
        expect((yield* refusal("box_read", "C:\\Windows\\win.ini")).reason).toBe("outside-box-folder");
        expect((yield* refusal("box_read", "escape/secret.txt")).reason).toBe("outside-box-folder");
        expect((yield* refusal("box_list", "escape")).reason).toBe("outside-box-folder");
      })
    );

    it.effect("explains missing paths and wrong kinds", () =>
      Effect.gen(function* () {
        expect((yield* refusal("box_read", "Clients/Jones/memo.txt")).reason).toBe("not-found");
        expect((yield* refusal("box_read", "Clients")).reason).toBe("not-a-file");
        expect((yield* refusal("box_list", "readme.txt")).reason).toBe("not-a-folder");
      })
    );
  });

  it.layer(
    BoxDriveToolkitHandlers.pipe(
      Layer.provide(Layer.merge(fakeHost({ folders: [["USERPROFILE", "/nowhere"]] }), Platform))
    ),
    { timeout: layerTimeout }
  )("without a Box folder", (it) => {
    it.effect("tells the lawyer Box Drive is not set up yet", () =>
      Effect.gen(function* () {
        const error = yield* refusal("box_list", "");
        expect(error.reason).toBe("box-folder-missing");
        expect(error.message).toContain("setup_status");
      })
    );
  });
});

// sanitizedToolkit registers on the shared McpServer layer; building it next
// to the provider shares the same instance through layer memoization.
const mountedFor = Effect.fn("mountedFor")(function* (profile: O.Option<PracticeProfile>) {
  const store = Layer.succeed(ProfileStore, ProfileStore.of({ get: Effect.succeed(profile), save: Effect.succeed }));
  const services = yield* Layer.build(
    Layer.merge(McpServer.McpServer.layer, BoxDriveProviderLayer).pipe(
      Layer.provide(Layer.mergeAll(store, fakeHost({}), settingsLayer({}), Platform))
    )
  );
  const server = Context.get(services, McpServer.McpServer);
  return A.map(server.tools, (entry) => entry.tool.name);
}, Effect.scoped);

describe("Box Drive provider", () => {
  it.effect("mounts the tools only when the profile selects Box Drive", () =>
    Effect.gen(function* () {
      expect(yield* mountedFor(O.some(gapProfile))).toEqual(["box_list", "box_read"]);
      expect(yield* mountedFor(O.none())).toEqual([]);
      const kgOnly = PracticeProfile.make({
        choices: [CapabilitySupported.make({ capability: "knowledge-graph", provider: "practice-kg" })],
        itLimits,
        recordedAt: DateTime.makeUnsafe(0),
      });
      expect(yield* mountedFor(O.some(kgOnly))).toEqual([]);
    })
  );
});

describe("Box tool results", () => {
  it.effect.prop(
    "round-trip every generated listing and document through their JSON form",
    { listing: Arbitrary.schema(BoxListing), document: Arbitrary.schema(BoxDocument) },
    ({ listing, document }) =>
      Effect.gen(function* () {
        const ListingJson = S.fromJsonString(BoxListing);
        const DocumentJson = S.fromJsonString(BoxDocument);
        // Schema equivalence, not deepStrictEqual: Opaque struct arbitraries build
        // null-prototype objects while decoding builds plain ones.
        assertTrue(
          S.toEquivalence(BoxListing)(
            yield* S.decodeEffect(ListingJson)(yield* S.encodeEffect(ListingJson)(listing)),
            listing
          )
        );
        assertTrue(
          S.toEquivalence(BoxDocument)(
            yield* S.decodeEffect(DocumentJson)(yield* S.encodeEffect(DocumentJson)(document)),
            document
          )
        );
      }),
    { arbitrary: fcRuns(50) }
  );
});
