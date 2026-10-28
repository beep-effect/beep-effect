#!/usr/bin/env python3
"""Exercise SSH notification wrappers without a network, device, agent, or notification."""
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile

parent = Path.home() / '.cache/beep/ssh-touch-check'
parent.mkdir(parents=True, exist_ok=True)
for wrapper in map(Path, sys.argv[1:]):
    with tempfile.TemporaryDirectory(dir=parent) as temporary:
        home = Path(temporary)
        binary = home / 'bin'
        binary.mkdir()
        (home / '.ssh').mkdir()
        alerts = home / '.local/bin'
        alerts.mkdir(parents=True)
        events = home / 'events'
        calls = home / 'calls'
        mock = binary / 'ssh'
        mock.write_text('''#!/usr/bin/env python3
import json,os,sys
from pathlib import Path
arguments=sys.argv[1:]
destination=None
remote=[]
configuration=False
operation=None
control_path='none'
local_command=None
permit_local_command=False
index=0
while index<len(arguments):
 argument=arguments[index]
 if argument in ['-F','-S','-O','-o','-i']:
  value=arguments[index+1]
  if argument=='-S':control_path=value
  elif argument=='-O':operation=value
  elif argument=='-o' and value.startswith('ControlPath='):control_path=value.partition('=')[2]
  elif argument=='-o' and value.startswith('LocalCommand='):local_command=value.partition('=')[2]
  elif argument=='-o' and value=='PermitLocalCommand=yes':permit_local_command=True
  index+=2
 elif argument=='-G':configuration=True;index+=1
 elif argument.startswith('-'):index+=1
 elif destination is None:destination=argument;index+=1
 else:remote=arguments[index:];break
if configuration:
 print('controlpath '+control_path)
elif operation is not None:
 sys.exit(0 if operation=='check' and control_path==os.environ['MOCK_SOCKET'] and os.environ['MOCK_REUSE']=='true' else 255)
else:
 reused=control_path==os.environ['MOCK_SOCKET'] and os.environ['MOCK_REUSE']=='true'
 if not reused and permit_local_command and local_command:
  import subprocess
  subprocess.run(['bash','-c',local_command],check=True,timeout=5)
 with Path(os.environ['MOCK_CALLS']).open('a') as out:out.write(json.dumps({'argv':arguments,'remote':remote})+'\\n')
''')
        mock.chmod(0o700)
        for name in ['ssh-add', 'ssh-keygen']:
            target = binary / name
            target.write_text('#!/bin/sh\nprintf "%s\\n" "256 $MOCK_KEY_FINGERPRINT fixture (ED25519-SK)"\n')
            target.chmod(0o700)
        alert = alerts / 'yubikey-touch-alert'
        alert.write_text('''#!/usr/bin/env python3
import json,os,sys
from pathlib import Path
with Path(os.environ['MOCK_EVENTS']).open('a') as out:out.write(json.dumps(sys.argv[1:])+'\\n')
''')
        alert.chmod(0o700)
        handles = []
        for suffix in ['dankserver', 'tbk-worker']:
            key_suffix = suffix.replace('-', '_') if suffix == 'tbk-worker' else suffix
            (home / '.ssh' / ('id_ed25519_sk_' + key_suffix)).write_text('inert fixture')
            (home / '.ssh' / ('id_ed25519_sk_' + key_suffix + '.pub')).write_text('inert fixture')
            handle = socket.socket(socket.AF_UNIX)
            handle.bind(str(home / '.ssh' / ('agent-' + suffix + '.sock')))
            handles.append(handle)
        environment = {**os.environ, 'HOME': str(home), 'PATH': str(binary) + os.pathsep + os.environ['PATH'],
                       'MOCK_KEY_FINGERPRINT': 'SHA256:bVUwE95rPZDRHE6byIIJdOkfc90OHj1dFC1sc1Rz1HA' if 'ubuntu' in wrapper.name else 'SHA256:/MMPLM/N77AYZ6fGapAV83I/ALH9IyF5h2xmVwpgnPU',
                       'MOCK_SOCKET': str(home / 'control socket'), 'MOCK_CALLS': str(calls), 'MOCK_EVENTS': str(events)}
        cases = [
                ('true', ['-o', 'ControlPath='+environment['MOCK_SOCKET'], 'echo', 'fixture'], 0, ['echo', 'fixture'], True),
                ('true', ['echo', 'fixture'], 1, ['echo', 'fixture'], False),
                ('false', ['-S', environment['MOCK_SOCKET'], 'echo', 'fixture'], 1, ['echo', 'fixture'], False),
                ('false', ['echo', 'fixture'], 1, ['echo', 'fixture'], False),
                ('false', ['-G'], 0, [], False),
                ('false', ['echo', '-G'], 1, ['echo', '-G'], False),
                ('false', ['echo', '-O', 'check'], 1, ['echo', '-O', 'check'], False),
                ('false', ['-o', 'ConnectTimeout=1', '-G'], 0, [], False),
        ]
        if wrapper.name.removesuffix('.sh') in ['ssh-beep-worker-yubi', 'ssh-tbk-worker', 'ssh-tbk-ubuntu']:
            cases.extend([
                ('true', ['--admin', '-o', 'ControlPath='+environment['MOCK_SOCKET'], 'echo', 'fixture'], 1, ['echo', 'fixture'], True),
                ('true', ['--admin', '-o', 'ControlPath='+environment['MOCK_SOCKET'], 'echo', '-G'], 1, ['echo', '-G'], True),
                ('false', ['--admin', 'echo', 'fixture'], 2, ['echo', 'fixture'], False),
                ('true', ['--admin', '-o', 'ControlPath='+environment['MOCK_SOCKET'], '-G'], 0, [], False),
                ('false', ['--admin', '-G'], 0, [], False),
            ])
        try:
            for reuse, arguments, expected_starts, expected_remote, expected_reuse in cases:
                events.write_text('')
                calls.write_text('')
                result = subprocess.run(['bash', str(wrapper.resolve()), *arguments], env={**environment, 'MOCK_REUSE': reuse},
                                        capture_output=True, text=True, timeout=15)
                assert result.returncode == 0, wrapper.name + ': wrapper failed'
                starts = [event for line in events.read_text().splitlines() if (event := json.loads(line))[0] == 'start']
                assert len(starts) == expected_starts, wrapper.name + ': incorrect alerts for ' + str(arguments)
                recorded = [json.loads(line) for line in calls.read_text().splitlines()]
                assert len(recorded) == (1 if expected_remote else 0), wrapper.name + ': incorrect final invocation count'
                if expected_remote:
                    invocation = recorded[0]
                    assert invocation['remote'] == expected_remote, wrapper.name + ': remote command changed'
                    assert ('ProxyCommand=false' in invocation['argv']) == expected_reuse
                    if expected_reuse:
                        assert 'ControlMaster=no' in invocation['argv']
                        assert environment['MOCK_SOCKET'] in invocation['argv']
                        if arguments[0] == '--admin':
                            assert 'sudo' in starts[0][2] and 'waiting' not in starts[0][2]
            print('PASS: ' + wrapper.name + ': ordinary reuse quiet; fresh auth announced; admin sudo heads-up retained; queries quiet; no fallback dial')
        finally:
            for handle in handles:
                handle.close()
