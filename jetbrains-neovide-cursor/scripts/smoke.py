#!/usr/bin/env python3
"""Load the test plugin inside actual IDEA using isolated config/system/plugin paths."""
import json, os, pathlib, subprocess, sys, tempfile
ROOT=pathlib.Path(__file__).resolve().parents[1]
performance='--performance' in sys.argv
gui=performance and '--gui' in sys.argv
sdk=json.loads((ROOT/'build/sdk.json').read_text());idea=pathlib.Path(sdk['idea'])
infofile=idea/'Resources/product-info.json'
if not infofile.exists():infofile=idea/'product-info.json'
launch=json.loads(infofile.read_text())['launch'][0]
sandbox=pathlib.Path(tempfile.mkdtemp(prefix='neovide-idea-smoke-'))
report=ROOT/('build/idea-performance.json' if performance else 'build/idea-smoke-report.txt')
if report.exists():report.unlink()
options=[x.replace('$APP_PACKAGE',str(idea.parent)) for x in launch.get('additionalJvmArguments',[])]
options += ['-Xmx1536m',f'-Djava.awt.headless={str(not gui).lower()}',f'-Dneovide.perf.headless={str(not gui).lower()}',f'-Didea.home.path={idea}',
            f'-Didea.config.path={sandbox}/config',f'-Didea.system.path={sandbox}/system',
            f'-Didea.log.path={sandbox}/log',f'-Didea.plugins.path={ROOT}/build/smoke-plugin',
            f'-Dneovide.test.report={report}','-Didea.headless.enable.statistics=false']
cp=os.pathsep.join(str(idea/'lib'/n) for n in launch['bootClassPathJarNames'])
log=ROOT/('build/idea-performance-console.log' if performance else 'build/idea-smoke-console.log')
print('Isolated IDEA test directory:',sandbox,flush=True)
with log.open('w') as stream:
    try:
        result=subprocess.run([sdk['java'],*options,'-cp',cp,launch.get('mainClass','com.intellij.idea.Main'),'neovideCursorPerf' if performance else 'neovideCursorTest'],
                              cwd=ROOT,stdout=stream,stderr=subprocess.STDOUT,timeout=180 if performance else 120)
    except subprocess.TimeoutExpired:
        print('IDE test timed out; inspect',log);sys.exit(1)
if report.exists():print(report.read_text())
if result.returncode or not report.exists():
    print(log.read_text()[-10000:]);print('See full log:',log);sys.exit(result.returncode or 1)
