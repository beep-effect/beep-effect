"""Disposable independent Prometheus scrape/alert proof for the actual worker.

The local HTTP receiver simulates Alertmanager's v2 API. No external notification
is sent, and no production scrape configuration is changed.
"""
import hashlib
from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import os
from pathlib import Path
import socket
import threading
import time
import urllib.request
import uuid

import jinja2
import yaml


class ObservationHealthProof:
    def __init__(self, root, dankserver, state, command):
        self.root, self.state, self.command = root, state, command
        self.script = dankserver / 'ansible/roles/monitoring/files/observation-health-snapshot.py'
        self.rule_template = dankserver / 'ansible/roles/monitoring/templates/prometheus-alerts.yml.j2'
        self.output = root / 'worker-health.prom'
        self.unit = 'foundation-health-alert-' + uuid.uuid4().hex[:12] + '.service'
        self.alerts = []
        self.evidence = {'syntheticOnly': True, 'productionConfigurationChanged': False,
                         'receiver': 'disposable local Alertmanager v2 API receiver; no human notification',
                         'scriptSha256': hashlib.sha256(self.script.read_bytes()).hexdigest(),
                         'rulesSha256': hashlib.sha256(self.rule_template.read_bytes()).hexdigest()}
        owner = self

        class Receiver(BaseHTTPRequestHandler):
            def setup(self):
                super().setup()
                self.connection.settimeout(2)

            def do_GET(self):
                if self.path != '/metrics':
                    self.send_error(404)
                    return
                data = owner.output.read_bytes() if owner.output.exists() else b''
                self.send_response(200)
                self.send_header('Content-Type', 'text/plain; version=0.0.4')
                self.send_header('Content-Length', str(len(data)))
                self.end_headers()
                self.wfile.write(data)

            def do_POST(self):
                length = int(self.headers.get('Content-Length', '0'))
                if self.path != '/api/v2/alerts' or not 0 < length <= 65536:
                    self.send_error(400)
                    return
                body = json.loads(self.rfile.read(length))
                for alert in body:
                    if alert.get('labels', {}).get('alertname') == 'BeepObservationWorkerUnavailable':
                        # Retain only fixed synthetic labels, no descriptions or URLs.
                        if len(owner.alerts) < 4:
                            owner.alerts.append({'alertname': alert['labels']['alertname'],
                                                 'receivedAt': time.time()})
                self.send_response(200)
                self.send_header('Content-Length', '0')
                self.end_headers()

            def log_message(self, *_):
                pass

        self.server = HTTPServer(('127.0.0.1', 0), Receiver)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def probe(self):
        self.command(['/usr/bin/python', str(self.script), '--socket', str(self.state / 'worker.sock'),
                      '--journal-directory', str(self.state), '--output', str(self.output)], timeout=8)
        text = self.output.read_text()
        assert len(text) < 32768 and str(self.state) not in text
        return text

    def start(self):
        assert 'beep_observation_observer_worker_up 1' in self.probe()
        variables = dict(monitoring_backup_stale_threshold_seconds=172800,
                         phoenix_backup_stale_threshold_seconds=172800,
                         monitoring_restore_drill_stale_threshold_seconds=604800,
                         phoenix_restore_drill_stale_threshold_seconds=604800,
                         monitoring_data_root='/srv/monitoring', monitoring_data_disk_enabled=True,
                         monitoring_observation_health_enabled=True)
        rendered = jinja2.Environment(undefined=jinja2.StrictUndefined).from_string(self.rule_template.read_text()).render(**variables)
        group = yaml.safe_load(rendered)['groups'][-1]
        self.rules = self.root / 'worker-health-rules.yml'
        self.rules.write_text(yaml.safe_dump({'groups': [group]}))
        self.command(['/usr/bin/promtool', 'check', 'rules', str(self.rules)])
        with socket.socket() as reservation:
            reservation.bind(('127.0.0.1', 0))
            self.port = reservation.getsockname()[1]
        receiver = '127.0.0.1:' + str(self.server.server_port)
        config = {'global': {'scrape_interval': '1s', 'evaluation_interval': '1s'},
                  'rule_files': [str(self.rules)],
                  'scrape_configs': [{'job_name': 'node', 'static_configs': [{'targets': [receiver]}]}],
                  'alerting': {'alertmanagers': [{'static_configs': [{'targets': [receiver]}]}]}}
        config_path = self.root / 'worker-health-prometheus.yml'
        config_path.write_text(yaml.safe_dump(config))
        self.command(['systemd-run', '--user', '--unit=' + self.unit,
                      '--property=MemoryHigh=268435456', '--property=MemoryMax=805306368',
                      '--property=MemorySwapMax=0', '--property=CPUQuota=50%',
                      '--property=TasksMax=64', '--property=RuntimeMaxSec=140', '--property=LimitCORE=0',
                      '--setenv=GOMAXPROCS=2', '/usr/bin/prometheus', '--config.file=' + str(config_path),
                      '--storage.tsdb.path=' + str(self.root / 'health-tsdb'),
                      '--storage.tsdb.retention.size=16MB', '--storage.tsdb.retention.time=5m',
                      '--web.listen-address=127.0.0.1:' + str(self.port)])
        deadline = time.monotonic() + 15
        while True:
            try:
                with urllib.request.urlopen(f'http://127.0.0.1:{self.port}/-/ready', timeout=2) as response:
                    assert response.status == 200
                break
            except OSError:
                assert time.monotonic() < deadline, 'Independent Prometheus did not become ready'
                time.sleep(.2)
        deadline = time.monotonic() + 15
        while True:
            with urllib.request.urlopen(f'http://127.0.0.1:{self.port}/api/v1/query?query=beep_observation_observer_worker_up', timeout=2) as response:
                rows = json.load(response)['data']['result']
            if len(rows) == 1 and rows[0]['value'][1] == '1':
                break
            assert time.monotonic() < deadline, 'Actual worker was not independently scraped'
            time.sleep(.5)
        self.evidence.update(actualWorkerScraped=True, metricsOnlyPrivateAccess=True,
                             prometheusVersion=self.command(['/usr/bin/prometheus', '--version']).stdout.splitlines()[0])

    def worker_stopped(self):
        assert 'beep_observation_observer_worker_up 0' in self.probe()
        deadline = time.monotonic() + 85
        while not self.alerts:
            assert time.monotonic() < deadline, 'Stopped-worker alert was not delivered'
            self.probe()
            status = self.command(['systemctl', '--user', 'show', self.unit, '-p', 'MemoryCurrent', '-p', 'MainPID']).stdout
            values = dict(line.split('=', 1) for line in status.splitlines() if '=' in line)
            assert values['MainPID'] != '0', 'Independent Prometheus stopped'
            assert int(values['MemoryCurrent']) < 512 * 1024**2, 'Proof exceeded soft memory budget'
            time.sleep(2)
        assert hashlib.sha256(self.script.read_bytes()).hexdigest() == self.evidence['scriptSha256'], 'Health probe changed during qualification'
        assert hashlib.sha256(self.rule_template.read_bytes()).hexdigest() == self.evidence['rulesSha256'], 'Health rules changed during qualification'
        self.evidence.update(stoppedWorkerObserved=True, alertDeliveredToLocalReceiver=True, alerts=self.alerts)

    def close(self):
        self.command(['systemctl', '--user', 'stop', self.unit], check=False)
        value = self.command(['systemctl', '--user', 'show', self.unit, '-p', 'MainPID', '--value'], check=False)
        assert value.stdout.strip() in ('0', ''), 'Proof monitor is still running'
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=3)
        self.evidence['ownedMonitorStopped'] = True
