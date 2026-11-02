import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import {install,uninstall,status,locateWorkbench} from '../src/installer.ts';
const original='<!DOCTYPE html><html><head><meta http-equiv="Content-Security-Policy" content="script-src \'self\';"></head><body></body><script src="./workbench.js" type="module"></script></html>\n';
async function fixture(t:any) {
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'neovide 光标 ')); t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const dir=path.join(root,'out/vs/code/electron-browser/workbench');await fs.mkdir(dir,{recursive:true});
 const html=path.join(dir,'workbench.html');await fs.writeFile(html,original);return {root,dir,html};
}
test('install twice is idempotent, executes safe config, and restores exact original',async t=>{
 const {root,html,dir}=await fixture(t);await install(root,'console.log("renderer");',{trailSize:0.8});
 const patched=await fs.readFile(html,'utf8');assert.equal((await status(root)).state,'installed');
 await install(root,'console.log("renderer");',{trailSize:0.8});assert.equal(await fs.readFile(html,'utf8'),patched);
 assert.ok(patched.includes('script-src \'self\';'));assert.equal((patched.match(/neovide-cursor:start/g)||[]).length,1);
 const script=await fs.readFile(path.join(dir,'neovide-cursor.runtime.js'),'utf8');assert.ok(script.includes('"trailSize":0.8'));
 await uninstall(root);assert.equal(await fs.readFile(html,'utf8'),original);assert.equal((await status(root)).state,'not-installed');
 await uninstall(root);assert.equal(await fs.readFile(html,'utf8'),original);
});
test('uninstall preserves unrelated changes made after install',async t=>{
 const {root,html}=await fixture(t);await install(root,'void 0;',{});
 await fs.appendFile(html,'<!-- another extension -->');await uninstall(root);
 assert.equal(await fs.readFile(html,'utf8'),original+'<!-- another extension -->');
});
test('updated clean HTML is never replaced with a stale backup',async t=>{
 const {root,html}=await fixture(t);await install(root,'void 0;',{});
 await fs.writeFile(html,original+'<!-- new VS Code -->');assert.equal((await status(root)).state,'needs-repair');
 await install(root,'void 1;',{});await uninstall(root);assert.equal(await fs.readFile(html,'utf8'),original+'<!-- new VS Code -->');
});
test('tampered marker fails without modifying HTML',async t=>{
 const {root,html}=await fixture(t);await install(root,'void 0;',{});
 const bad=(await fs.readFile(html,'utf8')).replace('./neovide-cursor.runtime.js','./other.js');await fs.writeFile(html,bad);
 await assert.rejects(()=>uninstall(root),/modified|conflict/i);assert.equal(await fs.readFile(html,'utf8'),bad);
});
test('foreign runtime asset and symlinks are not overwritten',async t=>{
 const {root,dir,html}=await fixture(t);const asset=path.join(dir,'neovide-cursor.runtime.js');
 await fs.writeFile(asset,'foreign');await assert.rejects(()=>install(root,'void 0;',{}),/owned|conflict/i);
 assert.equal(await fs.readFile(html,'utf8'),original);await fs.unlink(asset);await fs.symlink(html,asset);
 await assert.rejects(()=>install(root,'void 0;',{}),/symlink|regular/i);assert.equal(await fs.readFile(html,'utf8'),original);
});
test('unsupported layout fails explicitly',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'neovide-unsupported-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 await assert.rejects(()=>locateWorkbench(root),/workbench/i);
});
