import {
  BoxAdoption,
  BoxAdoptions,
  BoxCollaborationIntent,
  BoxDesiredState,
  BoxDiscoveryAvailable,
  BoxEntitlements,
  BoxFolderIntent,
  BoxLogicalKey,
  BoxMetadataIntent,
  BoxObservedCollaboration,
  BoxObservedFolder,
  BoxObservedState,
  BoxObservedWebhook,
  BoxProviderId,
  BoxProviderRevision,
  BoxRetentionIntent,
  BoxSourceRevision,
  BoxWebhookIntent,
} from "@beep/box-provisioning";
import { HttpsUrl } from "@beep/schema";
import * as O from "effect/Option";

const workspaceKey = BoxLogicalKey.make("folder.workspace");
const childKey = BoxLogicalKey.make("folder.child");

export const desiredFixture = BoxDesiredState.make({
  adoptions: BoxAdoptions.make({
    entries: [
      BoxAdoption.make({
        expectedParentProviderId: BoxProviderId.make("0"),
        expectedProviderId: BoxProviderId.make("100"),
        logicalKey: workspaceKey,
        resourceKind: "folder",
      }),
    ],
  }),
  sourceRevision: BoxSourceRevision.make("intent-1"),
  expectedEnterpriseId: BoxProviderId.make("enterprise-id"),
  expectedSubjectId: BoxProviderId.make("service-account-id"),
  rootFolderId: BoxProviderId.make("0"),
  entitlements: BoxEntitlements.make({
    externalCollaboratorsRequirePaidSeats: true,
    metadata: "unavailable",
    planName: "Business",
    retention: "unavailable",
    signCustomIntegrationAnnualAllowance: O.some(100),
  }),
  folders: [
    BoxFolderIntent.make({ logicalKey: workspaceKey, name: "Fixture workspace", parentKey: O.none() }),
    BoxFolderIntent.make({ logicalKey: childKey, name: "Fixture child", parentKey: O.some(workspaceKey) }),
  ],
  collaborations: [
    BoxCollaborationIntent.make({
      billingImpact: "external",
      folderKey: childKey,
      logicalKey: BoxLogicalKey.make("collaboration.fixture"),
      principal: "collaborator@example.test",
      principalType: "user",
      role: "editor",
    }),
  ],
  webhooks: [
    BoxWebhookIntent.make({
      address: HttpsUrl.make("https://example.test/box/events"),
      folderKey: workspaceKey,
      logicalKey: BoxLogicalKey.make("webhook.workspace"),
      triggers: ["FILE.UPLOADED"],
    }),
  ],
  metadata: [
    BoxMetadataIntent.make({
      folderKey: childKey,
      logicalKey: BoxLogicalKey.make("metadata.child"),
      templateKey: "fixture_properties",
    }),
  ],
  retention: [
    BoxRetentionIntent.make({
      folderKey: childKey,
      logicalKey: BoxLogicalKey.make("retention.child"),
      policyKey: "records-policy",
    }),
  ],
});

const available = (kind: "metadata" | "retention" | "signRequests" | "signTemplates") =>
  BoxDiscoveryAvailable.make({ count: 0, kind });

export const observedFixture = BoxObservedState.make({
  enterpriseId: BoxProviderId.make("enterprise-id"),
  subjectId: BoxProviderId.make("service-account-id"),
  rootFolderId: BoxProviderId.make("0"),
  folders: [
    BoxObservedFolder.make({
      etag: O.some(BoxProviderRevision.make("etag-workspace")),
      name: "Fixture workspace",
      parentProviderId: O.some(BoxProviderId.make("0")),
      providerId: BoxProviderId.make("100"),
    }),
    BoxObservedFolder.make({
      etag: O.none(),
      name: "Foreign staging drop",
      parentProviderId: O.some(BoxProviderId.make("0")),
      providerId: BoxProviderId.make("999"),
    }),
  ],
  collaborations: [],
  webhooks: [],
  metadata: available("metadata"),
  retention: available("retention"),
  signRequests: available("signRequests"),
  signTemplates: available("signTemplates"),
});

export const postApplyAdoptionsFixture = [
  BoxAdoption.make({
    expectedParentProviderId: BoxProviderId.make("100"),
    expectedProviderId: BoxProviderId.make("101"),
    logicalKey: childKey,
    resourceKind: "folder",
  }),
];

export const observedAfterApplyFixture = BoxObservedState.make({
  ...observedFixture,
  folders: [
    ...observedFixture.folders,
    BoxObservedFolder.make({
      etag: O.some(BoxProviderRevision.make("etag-child")),
      name: "Fixture child",
      parentProviderId: O.some(BoxProviderId.make("100")),
      providerId: BoxProviderId.make("101"),
    }),
  ],
  collaborations: [
    BoxObservedCollaboration.make({
      folderProviderId: BoxProviderId.make("101"),
      principal: "collaborator@example.test",
      principalProviderId: O.none(),
      principalType: "user",
      providerId: BoxProviderId.make("200"),
      role: "editor",
    }),
  ],
  webhooks: [
    BoxObservedWebhook.make({
      address: HttpsUrl.make("https://example.test/box/events"),
      providerId: BoxProviderId.make("300"),
      targetProviderId: BoxProviderId.make("100"),
      triggers: ["FILE.UPLOADED"],
    }),
  ],
});
