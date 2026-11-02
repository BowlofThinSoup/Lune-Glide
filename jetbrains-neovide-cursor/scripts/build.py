#!/usr/bin/env python3
"""Offline build against a local IntelliJ IDEA installation; no SDK jars are redistributed."""
import argparse, json, os, pathlib, shutil, subprocess, zipfile

ROOT=pathlib.Path(__file__).resolve().parents[1]

def run(args):
    result=subprocess.run([str(a) for a in args], cwd=ROOT)
    if result.returncode:raise SystemExit(result.returncode)

def archive(path, entries):
    path.parent.mkdir(parents=True,exist_ok=True)
    with zipfile.ZipFile(path,'w',zipfile.ZIP_DEFLATED) as z:
        for name,data in sorted(entries.items()):
            info=zipfile.ZipInfo(name, (2026,10,25,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED
            info.external_attr=0o100644 << 16;z.writestr(info,data)

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--idea-home',default=os.getenv('IDEA_HOME','/Applications/IntelliJ IDEA.app/Contents'))
    parser.add_argument('--jdk-home',default=os.getenv('JDK_HOME'))
    parser.add_argument('--test',action='store_true')
    args=parser.parse_args()
    idea=pathlib.Path(args.idea_home).resolve()
    if (idea/'Contents').is_dir():idea=idea/'Contents'
    infofile=idea/'Resources/product-info.json'
    if not infofile.exists():infofile=idea/'product-info.json'
    info=json.loads(infofile.read_text())
    if not info['buildNumber'].startswith('262.'):
        raise SystemExit('This release targets IDEA build 262; use the matching SDK or verify and update compatibility first.')
    jdk=pathlib.Path(args.jdk_home) if args.jdk_home else idea/'jbr/Contents/Home'
    if not jdk.exists():jdk=idea/'jbr'
    suffix='.exe' if os.name=='nt' else ''
    java=jdk/'bin'/('java'+suffix);javac=jdk/'bin'/('javac'+suffix)
    if not javac.exists():raise SystemExit('A JDK with javac is required; pass --jdk-home.')
    build=ROOT/'build';classes=build/'classes';tests=build/'test-classes'
    for p in (classes,tests):
        if p.exists():shutil.rmtree(p)
        p.mkdir(parents=True)
    cp=os.pathsep.join(str(p) for p in sorted((idea/'lib').rglob('*.jar')))
    run([javac,'--release','21','-encoding','UTF-8','-cp',cp,'-d',classes,*sorted((ROOT/'src/main/java').rglob('*.java'))])
    entries={str(p.relative_to(classes)):p.read_bytes() for p in classes.rglob('*.class')}
    entries.update({str(p.relative_to(ROOT/'src/main/resources')):p.read_bytes() for p in (ROOT/'src/main/resources').rglob('*') if p.is_file()})
    for name in ('LICENSE','THIRD_PARTY_NOTICES.md'):
        entries['META-INF/'+name]=(ROOT.parent/name).read_bytes()
    jar=build/'neovide-cursor.jar';archive(jar,entries)
    package=build/'distributions/lune-glide-jetbrains-0.1.3.zip'
    archive(package,{'neovide-cursor/lib/neovide-cursor.jar':jar.read_bytes()})
    print('SDK:',info['version'],info['buildNumber'],flush=True)
    print('Built:',package,flush=True)
    if args.test:
        run([javac,'--release','21','-encoding','UTF-8','-cp',cp+os.pathsep+str(classes),'-d',tests,*sorted((ROOT/'src/test/java').rglob('*.java'))])
        run([java,'-Djava.awt.headless=true','-cp',os.pathsep.join([str(tests),str(classes)]),'dev.lune.cursor.CoreTest'])
        # Test plugin includes production classes to preserve package-private access; never shipped.
        test_entries=dict(entries)
        test_entries.update({str(p.relative_to(tests)):p.read_bytes() for p in tests.rglob('*.class')})
        test_entries['META-INF/plugin.xml']=entries['META-INF/plugin.xml'].replace(b'<editorFactoryListener',b'<appStarter id="neovideCursorTest" implementation="dev.lune.cursor.IdeaSmokeTest"/><editorFactoryListener')
        test_entries['META-INF/plugin.xml']=test_entries['META-INF/plugin.xml'].replace(b'<editorFactoryListener',b'<appStarter id="neovideCursorPerf" implementation="dev.lune.cursor.IdeaPerformanceTest"/><editorFactoryListener')
        archive(build/'smoke-plugin/neovide-cursor/lib/neovide-cursor.jar',test_entries)
    (build/'sdk.json').write_text(json.dumps({'idea':str(idea),'java':str(java),'version':info['version'],'build':info['buildNumber']},indent=2))

if __name__=='__main__':main()
