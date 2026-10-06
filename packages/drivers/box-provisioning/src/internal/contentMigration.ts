import { $BoxProvisioningId } from "@beep/identity";
import { MutableHashMap, Order } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { boxNameEquivalenceKey } from "../BoxProvisioningIntent.ts";
import type { BoxContentMigrationFile, BoxContentMigrationMap } from "../BoxContentMigrationMap.ts";

const $I = $BoxProvisioningId.create("internal/contentMigration");

/** One distinct folder a migration map requires, declared or implied as an ancestor. */
export class RequiredContentFolder extends S.Class<RequiredContentFolder>($I`RequiredContentFolder`)(
  {
    depth: S.Natural,
    /** Leaf name spelling used if the folder has to be created. */
    name: S.String,
    nameKey: S.String,
    parentPathKey: S.Option(S.String),
    pathKey: S.String,
    /** Provider-equivalent key of every segment, root-most first. */
    pathKeys: S.Array(S.String),
  },
  $I.annote("RequiredContentFolder", {
    description: "Required destination folder with its provider-equivalent path keys and create spelling.",
  })
) {}

export const contentPathKeys = (path: ReadonlyArray<string>): ReadonlyArray<string> =>
  A.map(path, boxNameEquivalenceKey);

/** Injective provider-equivalent key of a folder path: Box names cannot contain a slash. */
export const contentPathKey = (path: ReadonlyArray<string>): string => A.join(contentPathKeys(path), "/");

/** Provider-equivalent key of a file destination; equals a folder path key exactly when the two collide. */
export const contentDestinationKey = (file: BoxContentMigrationFile): string =>
  `${contentPathKey(file.folderPath)}/${boxNameEquivalenceKey(file.fileName)}`;

const byDepthThenPathKey = Order.combine(
  Order.mapInput(Order.Number, (folder: RequiredContentFolder) => folder.depth),
  Order.mapInput(Order.String, (folder: RequiredContentFolder) => folder.pathKey)
);

/**
 * Every folder the map needs, including each ancestor, ordered by depth then key.
 *
 * Spellings that differ only by case or trailing whitespace are one folder; the
 * spelling that sorts first across the whole map is the one a create would use,
 * so the result does not depend on entry order.
 */
export const requiredContentFolders = (map: BoxContentMigrationMap): ReadonlyArray<RequiredContentFolder> => {
  const paths = A.sortWith(
    A.appendAll(
      A.map(map.folders, (folder): ReadonlyArray<string> => folder.path),
      A.map(map.files, (file): ReadonlyArray<string> => file.folderPath)
    ),
    A.join("/"),
    Order.String
  );
  const byPathKey = MutableHashMap.empty<string, RequiredContentFolder>();
  A.forEach(paths, (path) =>
    A.forEach(path, (name, index) => {
      const depth = index + 1;
      const pathKeys = contentPathKeys(A.take(path, depth));
      const pathKey = A.join(pathKeys, "/");
      if (MutableHashMap.has(byPathKey, pathKey)) {
        return;
      }
      MutableHashMap.set(
        byPathKey,
        pathKey,
        RequiredContentFolder.make({
          depth,
          name,
          nameKey: boxNameEquivalenceKey(name),
          parentPathKey: depth > 1 ? O.some(A.join(A.take(pathKeys, depth - 1), "/")) : O.none(),
          pathKey,
          pathKeys,
        })
      );
    })
  );
  return A.sort(MutableHashMap.values(byPathKey), byDepthThenPathKey);
};
