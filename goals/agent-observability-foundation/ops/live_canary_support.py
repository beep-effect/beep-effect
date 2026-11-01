"""Explicit two-record tailnet canary, used only by the installed-unit verifier.

No real source enrollment. Retain the private journal, queue and backend records
after stopping the route. Never retry the producer POST after an ambiguous reply.
"""
from datetime import datetime, timezone
import hashlib
import ipaddress
import json
import os
from pathlib import Path
import sqlite3
import socket
import time
import urllib.error
import urllib.request
import uuid

import jinja2
import yaml

COLLECTOR = 'otel/opentelemetry-collector-contrib@sha256:1175b03003053962012f5a231f5567f66a3e8fdb960c7835c0e48f7aa1555806'
ORIGIN = 'https://dankserver.tailc7c348.ts.net:8447'


def request(url, data=None, method=None):
    req = urllib.request.Request(url, data=None if data is None else json.dumps(data).encode(),
                                 method=method, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=8) as reply:
        body = reply.read(262145)
        assert len(body) <= 262144
        return body


class LiveCanary:
    def __init__(self, root, dankserver, command, declared=None, disposable=None):
        self.root, self.dankserver, self.command = root, dankserver, command
        self.declared, self.disposable = declared, disposable
        self.origin = disposable.origin if disposable else ORIGIN
        self.stage = "disposable" if disposable else "live"
        self.token = uuid.uuid4().hex[:12]
        self.name = 'foundation-live-canary-' + self.token
        self.project = 'foundation-canary-' + self.token
        self.created = False
        self.guard = None
        self.evidence = {'result': 'incomplete', 'syntheticRecordsOnly': True, 'actualHarnessCoverage': False,
                         'productionCollectorChanged': False, 'backend': self.origin, 'stage': self.stage, 'project': self.project,
                         'collectorImage': COLLECTOR, 'recordBudget': 2, 'producerAutomaticRetries': 0}

    def start(self):
        available = next(int(line.split()[1])*1024 for line in Path('/proc/meminfo').read_text().splitlines()
                         if line.startswith('MemAvailable:'))
        assert available >= 16*1024**3, 'Insufficient host headroom for bounded canary'
        self.evidence['initialHostAvailableBytes'] = available
        assert request(self.origin+'/healthz') == b'OK'
        if self.disposable:
            network_args = ['--network', self.disposable.network]
            collector_origin = self.disposable.collector_origin
        else:
            tailnet_address = socket.gethostbyname('dankserver.tailc7c348.ts.net')
            assert ipaddress.ip_address(tailnet_address) in ipaddress.ip_network('100.64.0.0/10')
            network_args = ['--add-host', 'dankserver.tailc7c348.ts.net:'+tailnet_address]
            collector_origin = self.origin
            self.evidence['containerDns'] = 'explicit host-resolved tailnet address; TLS hostname verification retained'
        # A new project avoids mixed populations and makes the entire response bounded.
        try:
            request(self.origin+'/v1/projects/'+self.project)
        except urllib.error.HTTPError as error:
            assert error.code == 404
            error.close()
        else:
            raise AssertionError('Canary project already exists; refuse identity reuse')
        self.command(['docker', 'image', 'inspect', COLLECTOR])
        template = self.dankserver/'ansible/roles/monitoring/templates/otel-config.yaml.j2'
        rendered = jinja2.Environment(undefined=jinja2.StrictUndefined).from_string(template.read_text()).render(
            monitoring_otel_metadata_route_enabled=True,
            monitoring_otel_phoenix_project=self.project, monitoring_otel_prometheus_exporter_port=9464)
        config = yaml.safe_load(rendered)
        config['exporters']['otlphttp/phoenix']['traces_endpoint'] = collector_origin+'/v1/traces'
        # Bound retries to this canary window. Preserve the queue on shutdown.
        config['exporters']['otlphttp/phoenix']['retry_on_failure']['max_elapsed_time'] = '30s'
        self.path = self.root/'collector.yaml'
        self.path.write_text(yaml.safe_dump(config)); self.path.chmod(0o600)
        self.queue = self.root/'queue'; self.queue.mkdir(mode=0o700)
        self.evidence['templateSha256'] = hashlib.sha256(template.read_bytes()).hexdigest()
        self.evidence['renderedSha256'] = hashlib.sha256(self.path.read_bytes()).hexdigest()
        self.evidence['onlyTemplateOverrides'] = ['explicit metadata route selection', 'project', 'export endpoint', '30s retry window']
        self.command(['docker', 'run', '--rm', '--pull=never', '--user', f'{os.getuid()}:{os.getgid()}',
                      '--memory=512m', '--memory-swap=512m', '--cpus=1', '--pids-limit=128',
                      '--read-only', '--cap-drop=ALL', '--security-opt=no-new-privileges', '--log-driver=none',
                      '-v', f'{self.path}:/etc/canary.yaml:ro', '-v', f'{self.queue}:/var/lib/otelcol/phoenix',
                      COLLECTOR, 'validate', '--config=/etc/canary.yaml'])
        # Record ownership before invoking Docker: uncertain starts still get inspected.
        self.created = True
        self.command(['docker', 'run', '-d', '--pull=never', '--name', self.name,
                      '--label', 'beep.observation.canary='+self.token,
                      *network_args,
                      '--user', f'{os.getuid()}:{os.getgid()}', '--memory=512m', '--memory-swap=512m',
                      '--cpus=1', '--pids-limit=128', '--read-only', '--cap-drop=ALL',
                      '--security-opt=no-new-privileges', '--log-driver=none',
                      '-p', '127.0.0.1::4319', '-p', '127.0.0.1::8888',
                      '-v', f'{self.path}:/etc/canary.yaml:ro', '-v', f'{self.queue}:/var/lib/otelcol/phoenix',
                      COLLECTOR, '--config=/etc/canary.yaml'])
        info = json.loads(self.command(['docker', 'inspect', self.name]).stdout)[0]
        self.guard = self.name+'-expiry'
        self.command(['systemd-run', '--user', '--quiet', '--unit='+self.guard, '--on-active=150s',
                      '--timer-property=AccuracySec=1s', '/usr/bin/docker', 'stop', '--time=10', info['Id']])
        self.evidence['independentCollectorStopDeadlineSeconds'] = 150
        limits = info['HostConfig']
        assert limits['Memory'] == limits['MemorySwap'] == 536870912
        assert limits['NanoCpus'] == 1000000000 and limits['PidsLimit'] == 128
        assert limits['ReadonlyRootfs'] and limits['CapDrop'] == ['ALL']
        assert info['State']['Running'] and not info['State']['OOMKilled']
        assert all(b['HostIp'] == '127.0.0.1' for bindings in info['NetworkSettings']['Ports'].values()
                   for b in (bindings or []))
        self.export = 'http://'+self.command(['docker', 'port', self.name, '4319/tcp']).stdout.strip()+'/v1/traces'
        self.metrics = 'http://'+self.command(['docker', 'port', self.name, '8888/tcp']).stdout.strip()+'/metrics'
        deadline = time.monotonic()+10
        while True:
            try:
                if b'otelcol_exporter_queue_capacity' in request(self.metrics): break
            except (OSError, urllib.error.URLError): pass
            assert time.monotonic() < deadline, 'Collector readiness deadline'
            time.sleep(.2)
        self.evidence['collectorLimitsVerified'] = True

    def configure(self, path):
        config = json.loads(path.read_text())
        config['destination'] = {'endpoint': self.export, 'backendOrigin': self.origin,
                                 'project': self.project, 'timeoutMillis': 5000}
        config['route']['syntheticFixtureMetadata'] = True
        config['runtime'].update(intervalMillis=1000, cycleTimeoutMillis=10000, staleAfterMillis=15000)
        config['scheduling'].update(tickTimeoutMillis=5000, reconcileDelayMillis=1000)
        # No transcript roots and no producer lifecycle enrollment in a synthetic route canary.
        config.pop('launchHttp', None)
        if self.declared:
            self.declared.configure(config, self.token)
        self.config_path = path
        path.write_text(json.dumps(config))

    def exercise(self, state, private_request, public_request):
        assert private_request('POST', '/control/resume')[0] == 200
        now = (time.time_ns() // 1000) * 1000 + 870
        self.evidence["subMicrosecondFixtureRemainder"] = 870
        payload = {'resourceSpans': [{'scopeSpans': [{'spans': [
            {'traceId': uuid.uuid4().hex, 'spanId': uuid.uuid4().hex[:16],
             'name': 'SYNTHETIC-PRIVATE-CONTENT-'+self.token,
             'startTimeUnixNano': str(now+i*1000000000), 'endTimeUnixNano': str(now+i*1000000000+100000000),
             'attributes': [{'key': 'beep.fixture.surface', 'value': {'stringValue': surface}},
                            {'key': 'openinference.span.kind', 'value': {'stringValue': 'AGENT'}},
                            {'key': 'session.id', 'value': {'stringValue': 'synthetic-'+surface+'-'+self.token}},
                            {'key': 'input.value', 'value': {'stringValue': 'SYNTHETIC-PRIVATE-CONTENT-'+self.token}}]}
            for i, surface in enumerate(['cli', 'desktop'])]}]}]}
        body = json.dumps(payload).encode()
        (self.root/'synthetic-input.json').write_bytes(body); (self.root/'synthetic-input.json').chmod(0o600)
        config = json.loads(self.config_path.read_text())
        spans = payload['resourceSpans'][0]['scopeSpans'][0]['spans']
        # Derive expectations from the request, never from returned rows.
        expected_ids = {hashlib.sha256(('synthetic-launch-proof-salt'+'\0'+'native-span/v1:'+
                         config['route']['routeId']+':'+s['traceId']+':'+s['spanId']).encode()).hexdigest() for s in spans}
        if self.declared:
            declaration, digest = self.declared.plan(self.root, self.config_path, payload, self.project, self.stage)
            assert {e['eventId'] for e in declaration['expectedEvents']} == expected_ids
            self.evidence['declaredRoute'] = declaration
            self.evidence['declaredRoutePlanSha256'] = digest
        # One producer submission only; ambiguous results end the proof without resend.
        status, receipt = public_request('POST', '/v1/traces', body, {'Content-Type': 'application/json'})
        assert status == 200, f'Canary intake refused: {status}'
        self.evidence['intakeAcknowledgmentBody'] = json.loads(receipt)
        deadline = time.monotonic()+40
        response = None
        while time.monotonic() < deadline:
            try:
                response = request(self.origin+'/v1/projects/'+self.project+'/spans?limit=3')
                rows = json.loads(response)
                if len(rows['data']) == 2:
                    assert rows['next_cursor'] is None
                    break
            except urllib.error.HTTPError as error:
                assert error.code == 404
                error.close()
            time.sleep(1)
        else: raise AssertionError('Canary backend read-back deadline; do not resend')
        assert ('SYNTHETIC-PRIVATE-CONTENT-'+self.token).encode() not in response
        assert ('synthetic-cli-'+self.token).encode() not in response
        assert ('synthetic-desktop-'+self.token).encode() not in response
        event_ids = {row['attributes']['ai_metrics.event_id'] for row in rows['data']}
        assert event_ids == expected_ids and len(event_ids) == 2
        assert all(row['attributes']['ai_metrics.route_id'] == config['route']['routeId'] for row in rows['data'])
        if self.declared:
            expected_surfaces = {e['eventId']: e['surface'] for e in declaration['expectedEvents']}
            assert all(expected_surfaces[row['attributes']['ai_metrics.event_id']] ==
                       row['attributes']['ai_metrics.fixture.surface'] for row in rows['data'])
        assert len({row['attributes']['session.id'] for row in rows['data']}) == 2
        assert {row['attributes']['ai_metrics.fixture.surface'] for row in rows['data']} == {'cli', 'desktop'}
        assert all(row['name'] == 'fixture.'+row['attributes']['ai_metrics.fixture.surface']+'.agent'
                   and row['span_kind'] == 'AGENT' and row['attributes']['ai_metrics.synthetic'] is True
                   and row['attributes']['ai_metrics.fixture.provenance'] == 'declared_synthetic_fixture'
                   for row in rows['data'])
        self.evidence['storedSyntheticSurfaceLabels'] = ['cli', 'desktop']
        assert {row['attributes']['ai_metrics.source_start_time_unix_nano'] for row in rows['data']} == {
            str(now), str(now+1000000000)}
        # Independent read-only inspection; never open the journal as a writer.
        deadline = time.monotonic()+20
        while True:
            with sqlite3.connect(f'file:{state}/journal.sqlite?mode=ro', uri=True) as db:
                intake = json.loads(db.execute('SELECT payload FROM observation_intake_config WHERE singleton=1').fetchone()[0])
                assert intake['hostId'] == config['intake']['hostId']
                assert intake['namespaceId'] == config['intake']['namespaceId']
                local = {r[0] for r in db.execute('SELECT event_id FROM observation_delivery_events')}
                visible = {r[0] for r in db.execute('SELECT event_id FROM observation_delivery_visibility')}
            assert local == event_ids
            if visible == event_ids: break
            assert time.monotonic() < deadline, 'Backend visible but worker reconciliation unproven'
            time.sleep(1)
        if self.declared:
            self.declared.verify()
            assert hashlib.sha256((self.root/'declared-route-plan.json').read_bytes()).hexdigest() == digest
            self.evidence['declaredRootJournalAndBackendAssociationVerified'] = True
        assert private_request('POST', '/control/pause')[0] == 200
        assert public_request('POST', '/v1/traces', b'{}', {'Content-Type': 'application/json'})[0] == 503
        description = ('Bounded synthetic foundation route canary. Two synthetic CLI/desktop-marked records; '
                       'no real harness coverage. Finite temporary route; lifecycle recorded in the foundation packet. '
                       'Retained as verification evidence.')
        request(self.origin+'/v1/projects/'+self.project, {'description': description}, 'PUT')
        assert json.loads(request(self.origin+'/v1/projects/'+self.project))['data']['description'] == description
        self.evidence.update(result='passed', eventIds=sorted(event_ids), storedRecords=rows['data'],
                             exactLocalAndBackendEventSets=True, workerVisibilityReceipts=2,
                             privateContentAbsentFromBackend=True, pausedBeforeStop=True,
                             recordedAt=datetime.now(timezone.utc).isoformat())

    def close(self):
        if not self.created: return
        result = self.command(['docker', 'inspect', self.name], check=False)
        if result.returncode:
            self.evidence['cleanup'] = 'container absent after attempted creation'
            return
        info = json.loads(result.stdout)[0]
        assert info['Config']['Labels']['beep.observation.canary'] == self.token
        self.command(['docker', 'stop', '--time=10', self.name])
        info = json.loads(self.command(['docker', 'inspect', self.name]).stdout)[0]
        assert not info['State']['Running'] and not info['State']['OOMKilled']
        files = list(self.queue.iterdir())
        assert len(files) <= 1 and all(p.is_file() and p.stat().st_size <= 67108864 for p in files)
        self.evidence['queueFilesRetained'] = [{'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in files]
        self.command(['docker', 'rm', self.name])
        assert self.command(['docker', 'inspect', self.name], check=False).returncode != 0
        if self.guard:
            self.command(['systemctl', '--user', 'stop', self.guard+'.timer', self.guard+'.service'], check=False)
            self.command(['systemctl', '--user', 'reset-failed', self.guard+'.service'], check=False)
            self.evidence['independentStopGuardReleased'] = True
        self.evidence['cleanup'] = 'owned collector stopped and removed; private queue retained'
        if self.evidence['result'] == 'passed':
            rows = json.loads(request(self.origin+'/v1/projects/'+self.project+'/spans?limit=3'))
            assert rows['next_cursor'] is None
            assert {r['attributes']['ai_metrics.event_id'] for r in rows['data']} == set(self.evidence['eventIds'])
            self.evidence['backendEvidencePreservedAfterRollback'] = True
