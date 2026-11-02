#!/usr/bin/env python3
"""Read and reconcile the bounded synthetic native and optional reconstructed proof fixtures."""
import argparse
import hashlib
import json
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--endpoint", required=True)
parser.add_argument("--expected", type=Path, required=True)
parser.add_argument("--output", type=Path, required=True)
args = parser.parse_args()
url = urlsplit(args.endpoint)
if (url.scheme != "http" or url.hostname != "127.0.0.1" or url.username
        or url.password or url.path not in ("", "/") or url.query or url.fragment):
    raise SystemExit("Requires the disposable loopback Phoenix origin")
if args.expected.stat().st_size > 65536:
    raise SystemExit("Synthetic expectation file exceeds bound")
expected = json.loads(args.expected.read_text())
assert expected["project"] == "foundation-synthetic-proof"
assert len(expected["observations"]) == 3
reconstructed = expected.get("reconstructedObservations", [])
assert len(reconstructed) in (0, 6)
count = 3 + len(reconstructed)
with urlopen(f"{args.endpoint.rstrip('/')}/v1/projects/foundation-synthetic-proof/spans?limit=10", timeout=5) as response:
    assert response.status == 200
    body = response.read(65537)
assert len(body) <= 65536
stored = json.loads(body)
assert len(stored["data"]) == count and stored["next_cursor"] is None
assert b"synthetic-private" not in body
by_id = {row["context"]["span_id"]: row for row in stored["data"]}
assert len(by_id) == count
checks = []
for item in expected["observations"]:
    row = by_id[item["spanId"]]
    attributes = row["attributes"]
    assert row["context"]["trace_id"] == item["traceId"]
    assert attributes["ai_metrics.event_id"] == item["eventId"]
    assert attributes["session.id"] == item["sessionId"]
    assert item["fixtureSurface"] in ("cli", "desktop")
    assert row["span_kind"] == "LLM" and row["name"] == "fixture." + item["fixtureSurface"] + ".llm"
    assert attributes["ai_metrics.synthetic"] is True
    assert attributes["ai_metrics.fixture.surface"] == item["fixtureSurface"]
    assert attributes["ai_metrics.fixture.provenance"] == "declared_synthetic_fixture"
    assert attributes["llm.token_count.completion"] == 5
    complete = item["scenario"] != "claude-incomplete"
    if complete:
        assert attributes["llm.token_count.prompt"] == 130
        assert attributes["llm.token_count.total"] == 135
        assert attributes["llm.token_count.prompt_details.cache_read"] == 100
        assert attributes["llm.token_count.prompt_details.cache_write"] == 20
    else:
        assert "llm.token_count.prompt" not in attributes
        assert "llm.token_count.total" not in attributes
    assert attributes["ai_metrics.usage.complete"] == complete
    assert "llm.provider" not in attributes
    assert attributes["ai_metrics.source_start_time_unix_nano"] == "1793000000000000870"
    assert attributes["ai_metrics.source_end_time_unix_nano"] == "1793000000100000870"
    assert row["start_time"] == "2026-10-26T07:33:20.000001+00:00"
    assert row["end_time"] == "2026-10-26T07:33:20.100001+00:00"
    assert item["acceptanceState"]["state"] == "accepted-unverified"
    assert item["state"]["state"] == "visible"
    checks.append({
        "scenario": item["scenario"], "fixtureSurface": item["fixtureSurface"], "traceId": item["traceId"],
        "spanId": item["spanId"], "eventId": item["eventId"],
        "prompt": attributes.get("llm.token_count.prompt"),
        "completion": attributes["llm.token_count.completion"],
        "total": attributes.get("llm.token_count.total"),
        "usageComplete": complete, "identityAndSessionMatch": True,
        "privateCanariesAbsent": True, "exactSourceNanosecondsRetained": True,
        "localDeliveryState": "visible", "priorAcceptanceState": "accepted-unverified",
    })
reconstruction_checks = []
for item in reconstructed:
    row = by_id[item['spanId']]
    attrs = row['attributes']
    assert row['context']['trace_id'] == item['traceId']
    assert attrs['ai_metrics.event_id'] == item['eventId']
    assert attrs['session.id'] == item['sessionId']
    assert attrs['ai_metrics.stream'] == 'reconstructed'
    assert attrs['ai_metrics.source_format'] == item['source']
    assert row['name'] == 'observed.' + item['kind'] and row['span_kind'] == 'CHAIN'
    assert row['parent_id'] is None and row['status_code'] == 'UNSET'
    assert row['start_time'] == row['end_time'] == '2026-10-26T07:33:20+00:00'
    assert attrs['ai_metrics.source_start_time_unix_nano'] == '1793000000000000001'
    assert attrs['ai_metrics.duration_known'] is False
    assert attrs['ai_metrics.usage.normalized'] is False and attrs['ai_metrics.usage.additive'] is False
    assert not any(key.startswith('llm.token_count.') for key in attrs)
    assert 'llm.provider' not in attrs and 'llm.model_name' not in attrs
    assert 'ai_metrics.route_id' not in attrs and 'ai_metrics.usage.convention' not in attrs
    usage = item['usage']
    if usage is not None:
        assert attrs['ai_metrics.usage.basis'] == usage['basis']
        for source, target in [('input', 'input'), ('output', 'output'), ('cacheRead', 'cache_read'), ('cacheWrite', 'cache_write')]:
            observed = usage[source]
            if observed['_tag'] == 'Some':
                assert attrs['ai_metrics.usage.' + target] == observed['value']
            else:
                assert 'ai_metrics.usage.' + target not in attrs
    else:
        assert 'ai_metrics.usage.basis' not in attrs
    assert item['priorAcceptanceState'] == 'accepted-unverified' and item['state']['state'] == 'visible'
    reconstruction_checks.append({'scenario': item['scenario'], 'eventId': item['eventId'],
                                  'identityAndSessionMatch': True, 'nonAdditiveUsage': True,
                                  'exactSourceNanosecondsRetained': True, 'localDeliveryState': 'visible'})
# Native totals remain identical with reconstruction present. Missing native total
# is a known subtotal, not zero or complete usage; these are attribute sums.
native_rows = [row for row in stored['data'] if row['attributes']['ai_metrics.stream'] == 'native']
reconstructed_rows = [row for row in stored['data'] if row['attributes']['ai_metrics.stream'] == 'reconstructed']
assert len(native_rows) == 3 and len(reconstructed_rows) == len(reconstructed)
assert sum(row['attributes'].get('llm.token_count.total', 0) for row in stored['data']) == 270
assert sum(row['attributes'].get('llm.token_count.prompt', 0) for row in stored['data']) == 260
assert sum(row['attributes'].get('llm.token_count.completion', 0) for row in stored['data']) == 15
assert sum('llm.token_count.total' not in row['attributes'] for row in native_rows) == 1
if reconstructed:
    sessions = {row['attributes']['session.id'] for row in stored['data']}
    assert len(sessions) == 3
    assert len({row['context']['trace_id'] for row in stored['data']}) == 9
    repeated = [item for item in reconstructed if item['scenario'] == 'claude-repeat']
    assert len(repeated) == 2 and repeated[0]['eventId'] != repeated[1]['eventId']
    assert repeated[0]['sessionId'] == repeated[1]['sessionId'] == expected['observations'][0]['sessionId']
aggregate_query = """query FoundationAggregates($native: String!, $reconstructed: String!, $complete: String!, $flatNative: String!) {
  projects(first: 10) {
    pageInfo { hasNextPage }
    edges { node {
      name recordCount traceCount sessionCount
      flatNativeRecords: recordCount(filterCondition: $flatNative)
      tokenCountTotal tokenCountPrompt tokenCountCompletion
      nativeRecords: recordCount(filterCondition: $native)
      reconstructedRecords: recordCount(filterCondition: $reconstructed)
      nativeTraces: traceCount(filterCondition: $native)
      reconstructedTraces: traceCount(filterCondition: $reconstructed)
      nativeTokens: tokenCountTotal(filterCondition: $native)
      reconstructedTokens: tokenCountTotal(filterCondition: $reconstructed)
      completeNativeTokens: tokenCountTotal(filterCondition: $complete)
      allLatencyP50: latencyMsQuantile(probability: 0.5)
      nativeLatencyP50: latencyMsQuantile(probability: 0.5, filterCondition: $native)
    } }
  }
}"""
filters = {
    'native': 'attributes["ai_metrics"]["stream"] == "native"',
    'flatNative': 'attributes["ai_metrics.stream"] == "native"',
    'reconstructed': 'attributes["ai_metrics"]["stream"] == "reconstructed"',
    'complete': 'attributes["ai_metrics"]["stream"] == "native" and attributes["ai_metrics"]["usage"]["complete"] == True',
}
request = Request(args.endpoint.rstrip('/') + '/graphql',
                  data=json.dumps({'query': aggregate_query, 'variables': filters}).encode(),
                  headers={'Content-Type': 'application/json'})
with urlopen(request, timeout=10) as response:
    aggregate_body = response.read(1048577)
assert len(aggregate_body) <= 1048576
aggregates = json.loads(aggregate_body)
assert not aggregates.get('errors'), 'Synthetic aggregate query failed: ' + json.dumps(aggregates.get('errors'))
projects = aggregates['data']['projects']
assert projects['pageInfo']['hasNextPage'] is False
matches = [edge['node'] for edge in projects['edges'] if edge['node']['name'] == expected['project']]
assert len(matches) == 1
aggregate = matches[0]
assert aggregate['recordCount'] == aggregate['traceCount'] == count
assert aggregate['sessionCount'] == 3
assert aggregate['flatNativeRecords'] == 0, 'Pinned Phoenix dotted-key filter semantics changed'
assert aggregate['nativeRecords'] == aggregate['nativeTraces'] == 3, json.dumps(aggregate)
assert aggregate['reconstructedRecords'] == aggregate['reconstructedTraces'] == len(reconstructed)
assert aggregate['tokenCountTotal'] == aggregate['nativeTokens'] == 275
assert aggregate['tokenCountPrompt'] == 260 and aggregate['tokenCountCompletion'] == 15
assert aggregate['completeNativeTokens'] == 270 and aggregate['reconstructedTokens'] == 0
assert aggregate['nativeLatencyP50'] == 100
assert aggregate['allLatencyP50'] == (0 if reconstructed else 100)
proof = {
    "project": expected["project"], "syntheticOnly": True, "loopbackOnly": True,
    "responseSha256": hashlib.sha256(body).hexdigest(), "storedSpans": count,
    "nativeSpans": 3, "reconstructedSpans": len(reconstructed),
    "reconstructionChecks": reconstruction_checks,
    "nativeAttributeTotals": {"knownTotal": 270, "knownPrompt": 260, "knownCompletion": 15, "nativeSpansMissingTotal": 1},
    "checks": checks,
    "phoenixGraphqlAggregates": aggregate,
    "aggregateFilters": filters,
    "aggregateInterpretation": "275 is known native prompt plus completion, including a five-token incomplete subtotal; 270 belongs to complete native usage. Reconstructed zero contribution is not evidence of zero actual usage. Mixed zero-duration points reduce unfiltered P50 to zero; native-only P50 remains 100 ms.",
    "backendReadbackPrecision": "standard timestamps: microseconds; explicit source metadata: exact nanoseconds",
    "backendVisibilityAdapterImplemented": True,
    "liveDeployment": False, "goalComplete": False,
}
args.output.write_text(json.dumps(proof, indent=2) + "\n")
print(f"PASS: {count} synthetic identities, sessions, kinds, usage conventions and timestamps reconcile")
