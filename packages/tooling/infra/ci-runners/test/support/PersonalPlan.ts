/** The personal-stage plan recorded 2026-11-14 (stage renamed to dev_alice, timestamps zeroed). */
export const personalPlanLog = `
[00:00:00.000] INFO: Plan · dev_alice
[00:00:00.000] INFO: Importing stack module
[00:00:00.000] INFO: AWS: using environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SESSION_TOKEN, AWS_REGION).
[00:00:00.000] INFO: Resolving stack services
[00:00:00.000] INFO: Loading stack state
[00:00:00.000] INFO: Computing plan
[00:00:00.000] INFO: Plan ready (2.2s)
[00:00:00.000] INFO: Plan: 66 to create, 9 binding changes
[00:00:00.000] INFO: [Runners/AppId] create
[00:00:00.000] INFO: [Runners/AppKey] create
[00:00:00.000] INFO: [Runners/Poolheavy/BuildQueue] create
[00:00:00.000] INFO: [Runners/Pooloverflow/BuildQueue] create
[00:00:00.000] INFO: [Runners/Poolheavy/BuildQueueDlq] create
[00:00:00.000] INFO: [Runners/Pooloverflow/BuildQueueDlq] create
[00:00:00.000] INFO: [DefaultSecurityGroup] create
[00:00:00.000] INFO: [Runners/DeregisterRetryQueue] create
[00:00:00.000] INFO: [Runners/DeregisterRetryQueueDlq] create
[00:00:00.000] INFO: [Runners/DeregisterRetrySource] create
[00:00:00.000] INFO: [FlowLog] create
[00:00:00.000] INFO: [FlowLogGroup] create
[00:00:00.000] INFO: [FlowLogsRole] create
[00:00:00.000] INFO: [ImdsDisablePolicy] create
[00:00:00.000] INFO: [Runners/InstanceStateChangeInvoke] create
[00:00:00.000] INFO: [Runners/InstanceStateChangeRule] create
[00:00:00.000] INFO: [InternetGateway] create
[00:00:00.000] INFO: [Runners/Poolheavy/LaunchTemplate] create
[00:00:00.000] INFO: [Runners/Pooloverflow/LaunchTemplate] create
[00:00:00.000] INFO: [PublicDefaultRoute] create
[00:00:00.000] INFO: [PublicRouteTable] create
[00:00:00.000] INFO: [PublicSubnet1] create
[00:00:00.000] INFO: [PublicSubnet1Route] create
[00:00:00.000] INFO: [PublicSubnet2] create
[00:00:00.000] INFO: [PublicSubnet2Route] create
[00:00:00.000] INFO: [PublicSubnet3] create
[00:00:00.000] INFO: [PublicSubnet3Route] create
[00:00:00.000] INFO: [PublicSubnet4] create
[00:00:00.000] INFO: [PublicSubnet4Route] create
[00:00:00.000] INFO: [PublicSubnet5] create
[00:00:00.000] INFO: [PublicSubnet5Route] create
[00:00:00.000] INFO: [Reaper] create
[00:00:00.000] INFO: [Reaper/Reaper] create
[00:00:00.000] INFO: [ReaperInvoke] create
[00:00:00.000] INFO: [ReaperSchedule] create
[00:00:00.000] INFO: [Runners/RunnerBinaries] create
[00:00:00.000] INFO: [Runners/RunnerBinariesSyncer] create
[00:00:00.000] INFO: [Runners/RunnerBinariesSyncer/RunnerBinariesSyncer] create
[00:00:00.000] INFO: [Runners/RunnerBinariesSyncerInvoke] create
[00:00:00.000] INFO: [Runners/RunnerBinariesSyncerSchedule] create
[00:00:00.000] INFO: [RunnerBoundaryPolicy] create
[00:00:00.000] INFO: [Runners/Poolheavy/RunnerInstanceProfile] create
[00:00:00.000] INFO: [Runners/Pooloverflow/RunnerInstanceProfile] create
[00:00:00.000] INFO: [Runners/Poolheavy/RunnerRole] create
[00:00:00.000] INFO: [Runners/Pooloverflow/RunnerRole] create
[00:00:00.000] INFO: [RunnerSecurityGroup] create
[00:00:00.000] INFO: [Runners/Poolheavy/ScaleDown] create
[00:00:00.000] INFO: [Runners/Poolheavy/ScaleDown/ScaleDown] create
[00:00:00.000] INFO: [Runners/Pooloverflow/ScaleDown] create
[00:00:00.000] INFO: [Runners/Pooloverflow/ScaleDown/ScaleDown] create
[00:00:00.000] INFO: [Runners/Poolheavy/ScaleDownInvoke] create
[00:00:00.000] INFO: [Runners/Pooloverflow/ScaleDownInvoke] create
[00:00:00.000] INFO: [Runners/Poolheavy/ScaleDownSchedule] create
[00:00:00.000] INFO: [Runners/Pooloverflow/ScaleDownSchedule] create
[00:00:00.000] INFO: [Runners/Poolheavy/ScaleUp] create
[00:00:00.000] INFO: [Runners/Poolheavy/ScaleUp/ScaleUp] create
[00:00:00.000] INFO: [Runners/Pooloverflow/ScaleUp] create
[00:00:00.000] INFO: [Runners/Pooloverflow/ScaleUp/ScaleUp] create
[00:00:00.000] INFO: [Runners/Poolheavy/ScaleUpSource] create
[00:00:00.000] INFO: [Runners/Pooloverflow/ScaleUpSource] create
[00:00:00.000] INFO: [Runners/SecretsKey] create
[00:00:00.000] INFO: [Runners/SecretsKeyAlias] create
[00:00:00.000] INFO: [Runners/SpotInterruptionInvoke] create
[00:00:00.000] INFO: [Runners/SpotInterruptionRule] create
[00:00:00.000] INFO: [Runners/SsmHousekeeper] create
[00:00:00.000] INFO: [Runners/SsmHousekeeper/SsmHousekeeper] create
[00:00:00.000] INFO: [Runners/SsmHousekeeperInvoke] create
[00:00:00.000] INFO: [Runners/SsmHousekeeperSchedule] create
[00:00:00.000] INFO: [Runners/Sweep] create
[00:00:00.000] INFO: [Runners/TerminationWatcher] create
[00:00:00.000] INFO: [Runners/TerminationWatcher/TerminationWatcher] create
[00:00:00.000] INFO: [Vpc] create
[00:00:00.000] INFO: [Runners/Webhook] create
[00:00:00.000] INFO: [Runners/Webhook/Webhook] create
[00:00:00.000] INFO: [Runners/WebhookSecret] create
`;
