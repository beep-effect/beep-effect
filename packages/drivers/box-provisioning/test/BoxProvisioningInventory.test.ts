import * as B from "@beep/box";
import { BoxProvisioningInventory } from "@beep/box-provisioning";
import { provideScopedLayer } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit, Layer } from "effect";
import * as O from "effect/Option";
import { desiredFixture } from "./fixtures.ts";

type InventoryClientOptions = {
  readonly collaboration?: boolean;
  readonly folderMetadataRead?: () => void;
  readonly metadataFailure?: unknown;
  readonly signRequestsFailure?: unknown;
  readonly paginateMetadata?: boolean;
  readonly webhookEntries?: ReadonlyArray<unknown>;
};

const metadataTemplate = (id: string) => ({ id, type: "metadata_template" });

const makeInventoryClient = (options: InventoryClientOptions = {}) => ({
  folderMetadata: {
    getFolderMetadata: (_folderId: string): Promise<unknown> => {
      options.folderMetadataRead?.();
      return Promise.resolve({ entries: [] });
    },
  },
  folders: {
    getFolderItems: (folderId: string, _optionalsInput: unknown): Promise<unknown> =>
      Promise.resolve(
        folderId === "0"
          ? {
              entries: [
                {
                  etag: "workspace-etag",
                  id: "100",
                  name: "Fixture workspace",
                  type: "folder",
                },
              ],
            }
          : { entries: [] }
      ),
  },
  listCollaborations: {
    getFolderCollaborations: (_folderId: string, _optionalsInput: unknown): Promise<unknown> =>
      Promise.resolve({
        entries:
          options.collaboration === true
            ? [
                {
                  accessibleBy: { id: "user-id", login: "user@example.test", type: "user" },
                  id: "collaboration-id",
                  item: { id: "100", type: "folder" },
                  role: "editor",
                  type: "collaboration",
                },
              ]
            : [],
      }),
  },
  metadataCascadePolicies: {
    getMetadataCascadePolicies: (_queryParams: unknown): Promise<unknown> => Promise.resolve({ entries: [] }),
  },
  metadataTemplates: {
    getEnterpriseMetadataTemplates: (queryParams: { readonly marker?: string }): Promise<unknown> =>
      options.metadataFailure === undefined
        ? Promise.resolve(
            options.paginateMetadata === true && O.isNone(O.fromUndefinedOr(queryParams.marker))
              ? { entries: [metadataTemplate("template-1")], nextMarker: "template-page-2" }
              : options.paginateMetadata === true
                ? { entries: [metadataTemplate("template-2")] }
                : { entries: [] }
          )
        : Promise.reject(options.metadataFailure),
    getGlobalMetadataTemplates: (_queryParams: unknown): Promise<unknown> => Promise.resolve({ entries: [] }),
  },
  retentionPolicies: {
    getRetentionPolicies: (_queryParams: unknown): Promise<unknown> => Promise.resolve({ entries: [] }),
  },
  signRequests: {
    getSignRequests: (_queryParams: unknown): Promise<unknown> =>
      options.signRequestsFailure === undefined
        ? Promise.resolve({ entries: [] })
        : Promise.reject(options.signRequestsFailure),
  },
  signTemplates: {
    getSignTemplates: (_queryParams: unknown): Promise<unknown> => Promise.resolve({ entries: [] }),
  },
  users: {
    getUserMe: (_queryParams: unknown): Promise<unknown> =>
      Promise.resolve({
        enterprise: { id: "enterprise-id", type: "enterprise" },
        id: "service-account-id",
        type: "user",
      }),
  },
  webhooks: {
    getWebhooks: (_queryParams: unknown): Promise<unknown> =>
      Promise.resolve({ entries: options.webhookEntries ?? [] }),
  },
});

const observeWithClient = (client: object) => {
  const InventoryTestLayer = BoxProvisioningInventory.layer.pipe(Layer.provide(B.Box.makeLayerFromClient(client)));
  return BoxProvisioningInventory.pipe(
    Effect.flatMap((inventory) => inventory.observe(desiredFixture)),
    provideScopedLayer(InventoryTestLayer)
  );
};

describe("@beep/box-provisioning inventory", () => {
  it.effect(
    "requests both provider identity guard fields",
    Effect.fnUntraced(function* () {
      let receivedQuery: unknown;
      const client = {
        users: {
          getUserMe: (queryParams: unknown): Promise<unknown> => {
            receivedQuery = queryParams;
            return Promise.reject({ statusCode: 503 });
          },
        },
      };
      const InventoryTestLayer = BoxProvisioningInventory.layer.pipe(Layer.provide(B.Box.makeLayerFromClient(client)));

      const exit = yield* BoxProvisioningInventory.pipe(
        Effect.flatMap((inventory) => inventory.observe(desiredFixture)),
        Effect.exit,
        provideScopedLayer(InventoryTestLayer)
      );

      expect(Exit.isFailure(exit)).toBe(true);
      expect(receivedQuery).toEqual({ fields: ["id", "enterprise"] });
    })
  );

  it.effect(
    "preserves collaboration login and provider id while following template pagination",
    Effect.fnUntraced(function* () {
      const observed = yield* observeWithClient(makeInventoryClient({ collaboration: true, paginateMetadata: true }));

      expect(observed.collaborations).toHaveLength(1);
      expect(observed.collaborations[0]?.principal).toBe("user@example.test");
      expect(O.getOrUndefined(observed.collaborations[0]?.principalProviderId ?? O.none())).toBe("user-id");
      expect(observed.metadata._tag).toBe("Available");
      if (observed.metadata._tag === "Available") {
        expect(observed.metadata.count).toBe(2);
      }
    })
  );

  it.effect(
    "does not request folder metadata on the root anchor",
    Effect.fnUntraced(function* () {
      let folderMetadataReads = 0;
      yield* observeWithClient(
        makeInventoryClient({
          folderMetadataRead: () => {
            folderMetadataReads += 1;
          },
        })
      );

      expect(folderMetadataReads).toBe(0);
    })
  );

  it.effect(
    "classifies missing application scope separately from subscription entitlement",
    Effect.fnUntraced(function* () {
      const observed = yield* observeWithClient(
        makeInventoryClient({
          metadataFailure: { responseInfo: { code: "insufficient_scope", statusCode: 403 } },
        })
      );

      expect(observed.metadata._tag).toBe("BlockedByPermission");
      if (observed.metadata._tag === "BlockedByPermission") {
        expect(O.getOrUndefined(observed.metadata.code)).toBe("insufficient_scope");
      }
    })
  );

  it.effect(
    "classifies an undocumented list 403 as permission rather than entitlement",
    Effect.fnUntraced(function* () {
      const observed = yield* observeWithClient(
        makeInventoryClient({
          metadataFailure: { responseInfo: { code: "forbidden", statusCode: 403 } },
        })
      );

      expect(observed.metadata._tag).toBe("BlockedByPermission");
      if (observed.metadata._tag === "BlockedByPermission") {
        expect(O.getOrUndefined(observed.metadata.code)).toBe("forbidden");
      }
    })
  );

  it.effect(
    "classifies a Box Sign listing 403 as permission-blocked instead of failing",
    Effect.fnUntraced(function* () {
      const observed = yield* observeWithClient(
        makeInventoryClient({
          signRequestsFailure: { responseInfo: { code: "forbidden", statusCode: 403 } },
        })
      );

      expect(observed.signRequests._tag).toBe("BlockedByPermission");
      if (observed.signRequests._tag === "BlockedByPermission") {
        expect(O.getOrUndefined(observed.signRequests.code)).toBe("forbidden");
      }
      expect(observed.signTemplates._tag).toBe("Available");
    })
  );

  it.effect(
    "fails closed when a listed webhook has no provider id",
    Effect.fnUntraced(function* () {
      const error = yield* observeWithClient(makeInventoryClient({ webhookEntries: [{ type: "webhook" }] })).pipe(
        Effect.flip
      );

      expect(error._tag).toBe("BoxProvisioningInvariantError");
      if (error._tag === "BoxProvisioningInvariantError") {
        expect(error.code).toBe("unreadable-sdk-response");
      }
    })
  );
});
