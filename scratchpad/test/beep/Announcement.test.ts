import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import {
  Announcement,
  AnnouncementContent,
  AnnouncementListResponse,
  AnnouncementType,
  ChangelogAnnouncement,
  ChangelogContent,
  ChangelogItem,
  ChangelogResponse,
  Display,
  FeatureAnnouncement,
  FeatureContent,
  FeatureResponse,
  FeatureStep,
  NoticeAnnouncement,
  Targeting,
  TriggerType,
  announcementFromDict,
  announcementToDict,
  displayToDict,
  getAnnouncementContent,
  getChangelogContent,
  getEffectiveDisplay,
  getEffectiveTargeting,
  getFeatureContent,
  targetingToDict,
} from "../../beep/Announcement.ts";

const decodeAnnouncement = S.decodeUnknownEffect(Announcement);

const created = DateTime.makeUnsafe("2020-01-02T03:04:05.000Z");

const notice = () =>
  NoticeAnnouncement.make({
    id: "note-1",
    createdAt: created,
    content: AnnouncementContent.make({ title: "Hello", body: "World" }),
  });

describe("Announcement", () => {
  it("builds arbitrary values", () => {
    for (const schema of [
      AnnouncementType,
      TriggerType,
      ChangelogItem,
      ChangelogContent,
      FeatureStep,
      FeatureContent,
      AnnouncementContent,
      Targeting,
      Display,
      ChangelogAnnouncement,
      FeatureAnnouncement,
      NoticeAnnouncement,
      Announcement,
      ChangelogResponse,
      FeatureResponse,
      AnnouncementListResponse,
    ]) {
      assert.notStrictEqual(schema.pipe(Arbitrary.schema), undefined);
    }
  });

  it("decodes each content arm", () => {
    const logInput: unknown = {
      id: "log-1",
      type: "changelog",
      createdAt: "2020-01-02T03:04:05.000Z",
      active: true,
      content: { title: "January", changes: [{ title: "Fix", description: "Audio", indentLevel: 0 }] },
    };
    const log = Effect.runSync(decodeAnnouncement(logInput));
    assert.strictEqual(log.type, "changelog");
    const featureInput: unknown = {
      id: "feat-1",
      type: "feature",
      createdAt: "2020-01-02T03:04:05.000Z",
      active: true,
      content: { title: "Memory", steps: [{ title: "Open", description: "Tap" }] },
    };
    const feature = Effect.runSync(decodeAnnouncement(featureInput));
    assert.strictEqual(feature.type, "feature");
    const generalInput: unknown = {
      id: "note-1",
      type: "announcement",
      createdAt: "2020-01-02T03:04:05.000Z",
      active: true,
      content: { title: "Hello", body: "World" },
    };
    const general = Effect.runSync(decodeAnnouncement(generalInput));
    assert.strictEqual(general.type, "announcement");
  });

  it("reads matching content and rejects the other arms", () => {
    const log = ChangelogAnnouncement.make({
      id: "log-1",
      createdAt: created,
      content: ChangelogContent.make({
        title: "January",
        changes: [ChangelogItem.make({ title: "Fix", description: "Audio" })],
      }),
    });
    assert.strictEqual(Effect.runSync(getChangelogContent(log)).title, "January");
    assert.strictEqual(getFeatureContent(log).pipe(Effect.result, Effect.runSync, Result.isFailure), true);
    const feature = FeatureAnnouncement.make({
      id: "feat-1",
      createdAt: created,
      content: FeatureContent.make({
        title: "Memory",
        steps: [FeatureStep.make({ title: "Open", description: "Tap" })],
      }),
    });
    assert.strictEqual(Effect.runSync(getFeatureContent(feature)).title, "Memory");
    const row = notice();
    assert.strictEqual(Effect.runSync(getAnnouncementContent(row)).body, "World");
    assert.strictEqual(getChangelogContent(row).pipe(Effect.result, Effect.runSync, Result.isFailure), true);
  });

  it("falls back from a bad type and drops bad targeting", () => {
    const row = Effect.runSync(
      announcementFromDict({
      type: "nope",
        created_at: "",
      content: { title: "Hello", body: "World" },
        targeting: { trigger: "nope" },
        display: [],
      }),
    );
    assert.strictEqual(row.type, "announcement");
    assert.strictEqual(row.id, "");
    assert.strictEqual(O.isNone(row.targeting), true);
    assert.strictEqual(O.isNone(row.display), true);
  });

  it("omits absent display and copies legacy targeting", () => {
    const row = NoticeAnnouncement.make({
      id: "note-1",
      createdAt: created,
      appVersion: O.some("1.2.0"),
      content: AnnouncementContent.make({ title: "Hello", body: "World" }),
    });
    const dict = Effect.runSync(announcementToDict(row));
    assert.strictEqual("display" in dict, false);
    const targeting = getEffectiveTargeting(row);
    assert.strictEqual(O.getOrNull(targeting.appVersionMin), "1.2.0");
    assert.strictEqual(targeting.trigger, "version_upgrade");
    const display = getEffectiveDisplay(row);
    assert.strictEqual(display.dismissible, true);
    assert.strictEqual(targetingToDict(Targeting.make({})).app_version_min, null);
    assert.strictEqual(displayToDict(Display.make({})).start_at, null);
  });
});
