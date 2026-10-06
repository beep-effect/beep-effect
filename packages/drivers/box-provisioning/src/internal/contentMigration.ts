import { MutableHashMap, Order } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import { boxNameEquivalenceKey } from "../BoxProvisioningIntent.ts";
import type { BoxContentMigrationFile, BoxContentMigrationMap } from "../BoxContentMigrationMap.ts";

/** One distinct folder a migration map requires, declared or implied as an ancestor. */
export type RequiredContentFolder = {
  readonly depth: number;
  /** Leaf name spelling used if the folder has to be created. */
  readonly name: string;
  readonly nameKey: string;
  readonly parentPathKey: O.Option<string>;
  readonly pathKey: string;
  /** Provider-equivalent key of every segment, root-most first. */
  readonly pathKeys: ReadonlyArray<string>;
};

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
    A.forEach(A.range(1, A.length(path)), (depth) => {
      const prefix = A.take(path, depth);
      const pathKeys = contentPathKeys(prefix);
      const pathKey = A.join(pathKeys, "/");
      if (MutableHashMap.has(byPathKey, pathKey)) {
        return;
      }
      O.match(O.all({ name: A.last(prefix), nameKey: A.last(pathKeys) }), {
        onNone: () => undefined,
        onSome: ({ name, nameKey }) =>
          MutableHashMap.set(byPathKey, pathKey, {
            depth,
            name,
            nameKey,
            parentPathKey: depth > 1 ? O.some(A.join(A.take(pathKeys, depth - 1), "/")) : O.none(),
            pathKey,
            pathKeys,
          }),
      });
    })
  );
  return A.sort(MutableHashMap.values(byPathKey), byDepthThenPathKey);
};
