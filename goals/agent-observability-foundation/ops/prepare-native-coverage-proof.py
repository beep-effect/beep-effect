#!/usr/bin/env python3
"""Prepare metadata-only coverage from the retained disposable backend receipt.

Expected IDs come from the fixed synthetic request contract, never the returned
IDs. This is a historical fixture report, not live harness enrollment or an
independent known-launch ledger. All launch populations remain unknown.
"""
import argparse
import hashlib
import json
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
root = Path(__file__).resolve().parents[3]
receipt_path = Path(__file__).with_name('reconstructed-collector-route-verification.json')
receipt_bytes = receipt_path.read_bytes()
receipt = json.loads(receipt_bytes)
assert receipt['result'] == 'passed' and receipt['syntheticOnly'] is True
assert receipt['actualHarnessEnrollment'] is False
for name, digest in receipt['sourceSha256'].items():
    assert hashlib.sha256((root / name).read_bytes()).hexdigest() == digest, name
hash_text = lambda value: hashlib.sha256(value.encode()).hexdigest()
receipt_id = hashlib.sha256(receipt_bytes).hexdigest()
salt = 'synthetic-phoenix-proof-salt'
namespace = hash_text(salt + '\0ai-metrics-hash-salt-namespace/v1')
boundary = hash_text('synthetic-native-coverage/v1:fixed-three-request-plan')
plan_evidence = hash_text('native-span/v1:routes-1-2-3:trace32:span16:source-nano1793000000000000001')
unknown = {'_tag': 'Unknown'}
window = {'populationWindowStart': '2026-10-26T07:33:20Z', 'populationWindowEnd': '2026-10-26T07:33:21Z'}
observed_at = receipt['recordedAt']
routes, observations = [], []
for digit, scenario in [('1', 'claude-complete'), ('2', 'openinference-complete'), ('3', 'claude-incomplete')]:
    route_id = digit * 64
    expected = hash_text(salt + '\0' + f'native-span/v1:{route_id}:{digit * 32}:{digit * 16}')
    matching = [row for row in receipt['readback']['checks'] if row['scenario'] == scenario]
    assert len(matching) == 1
    row = matching[0]
    assert row['eventId'] == expected and row['identityAndSessionMatch'] is True
    assert row['priorAcceptanceState'] == 'accepted-unverified' and row['localDeliveryState'] == 'visible'
    routes.append({'routeId': route_id, 'hostId': 'a' * 64, 'harness': 'claude-code', 'surface': 'worker',
        'transport': 'native-otlp', 'root': unknown, 'capability': unknown, 'policy': {'_tag': 'Included'},
        'heartbeat': unknown, 'knownLaunches': unknown,
        'expectedEvents': {'_tag': 'Enumerated', 'ids': [expected], 'evidenceId': plan_evidence}})
    observed = {'_tag': 'Observed', 'ids': [row['eventId']], 'evidenceId': receipt_id, 'exhaustive': False}
    # Each ID was positively checked. We have not conducted an exhaustive query
    # of every event for this route/window, so the snapshot remains partial.
    observations.append({'routeId': route_id, 'launches': unknown, 'acceptedEvents': observed, 'visibleEvents': observed})
result = {'version': 'observation-coverage/v1', 'boundaryEvidenceId': boundary, **window,
    'observedAt': observed_at, 'routes': observations,
    'inventory': {'schemaVersion': 'agent-observation-inventory/v1', **window, 'observedAt': observed_at,
        'boundaryEvidenceId': boundary, 'hosts': [{'hostId': 'a' * 64, 'identityNamespaceId': namespace}],
        'roots': [], 'routes': routes}}
args.output.write_text(json.dumps(result, indent=2) + '\n')
print('Prepared three independently expected synthetic native events; launches and actual harness capability remain unknown.')
