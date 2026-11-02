import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {normalizeConfig} from './config.ts';
const assetName='neovide-cursor.runtime.js';
const manifestName='neovide-cursor.manifest.json';
const marker='<!-- neovide-cursor:start -->\n<script src="./neovide-cursor.runtime.js" defer></script>\n<!-- neovide-cursor:end -->\n';
const owned='// Neovide Cursor owned runtime v1\n';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
interface Manifest {schema:1; originalHash:string; patchedHash:string; runtimeHash:string; backup:string}
async function read(file:string):Promise<string|undefined> {
 try {const stat=await fs.lstat(file);if(!stat.isFile()||stat.isSymbolicLink())throw new Error(`Refusing non-regular file or symlink: ${file}`);return await fs.readFile(file,'utf8');}
 catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return undefined;throw e;}
}
async function atomic(file:string,data:string):Promise<void>{
 const old=await fs.stat(file).catch(()=>undefined);
 const tmp=`${file}.${randomUUID()}.tmp`;
 try {await fs.writeFile(tmp,data,{flag:'wx',mode:old?.mode??0o644});await fs.rename(tmp,file);}
 finally {await fs.rm(tmp,{force:true});}
}
export async function locateWorkbench(appRoot:string):Promise<string>{
 for(const dir of ['electron-browser','electron-sandbox']){
  const file=path.join(appRoot,'out/vs/code',dir,'workbench/workbench.html');
  if(await read(file)!==undefined)return file;
 }
 throw new Error(`Unsupported VS Code layout: workbench.html not found beneath ${appRoot}`);
}
function cleanHtml(html:string):string {
 const has=html.includes('neovide-cursor:');
 if(!has)return html;
 if(html.split(marker).length!==2 || html.replace(marker,'').includes('neovide-cursor:'))
  throw new Error('Injection marker was modified: conflict. Restore the marked section manually; no files were changed.');
 return html.replace(marker,'');
}
async function manifestAt(dir:string):Promise<Manifest|undefined>{
 const raw=await read(path.join(dir,manifestName));if(raw===undefined)return;
 const m=JSON.parse(raw) as Manifest;
 if(m.schema!==1 || !/^[a-f0-9]{64}$/.test(m.originalHash) || !/^[a-f0-9]{64}$/.test(m.runtimeHash)
  || m.backup!==`neovide-cursor.original.${m.originalHash}.html`)throw new Error('Invalid Lune Glide manifest; refusing to overwrite files.');
 return m;
}
async function locked<T>(dir:string,action:()=>Promise<T>):Promise<T>{
 const lock=path.join(dir,'neovide-cursor.lock');
 const handle=await fs.open(lock,'wx').catch(e=>{if(e.code==='EEXIST')throw new Error(`Another install is active (or a stale lock exists): ${lock}`);throw e;});
 try {await handle.writeFile(String(process.pid));return await action();}
 finally {await handle.close();await fs.unlink(lock);}
}
export async function status(appRoot:string):Promise<{state:'installed'|'not-installed'|'needs-repair';html:string;detail?:string}>{
 const html=await locateWorkbench(appRoot),dir=path.dirname(html);
 try {
  const content=(await read(html))!,m=await manifestAt(dir),asset=await read(path.join(dir,assetName));cleanHtml(content);
  if(content.includes(marker)&&m&&asset&&hash(asset)===m.runtimeHash)return {state:'installed',html};
  return {state:m||content.includes(marker)||asset?'needs-repair':'not-installed',html};
 }catch(e){return {state:'needs-repair',html,detail:String(e)};}
}
export async function install(appRoot:string,bundle:string,config:unknown):Promise<void>{
 const htmlFile=await locateWorkbench(appRoot),dir=path.dirname(htmlFile);
 await locked(dir,async()=>{
  const before=(await read(htmlFile))!,base=cleanHtml(before),m=await manifestAt(dir);
  const asset=path.join(dir,assetName),manifest=path.join(dir,manifestName);
  const oldAsset=await read(asset),oldManifest=await read(manifest);
  if(oldAsset!==undefined && (!m || hash(oldAsset)!==m.runtimeHash || !oldAsset.startsWith(owned)))
   throw new Error('Runtime asset is not owned or was modified: conflict. No files changed.');
  if(!/<\/html\s*>/i.test(base)||!base.includes('workbench.js'))throw new Error('Unsupported workbench HTML; no patch applied.');
  const backup=`neovide-cursor.original.${hash(base)}.html`;
  const backupFile=path.join(dir,backup),existing=await read(backupFile);
  if(existing!==undefined&&existing!==base)throw new Error('Backup conflict; no patch applied.');
  const runtime=owned+`globalThis.__NEOVIDE_CURSOR_CONFIG__=${JSON.stringify(normalizeConfig(config))};\n`+bundle;
  const patched=base.replace(/<\/html\s*>/i,match=>marker+match);
  const next:Manifest={schema:1,originalHash:hash(base),patchedHash:hash(patched),runtimeHash:hash(runtime),backup};
  // Backup is immutable and content-addressed. Never restore it over an updated workbench.
  if(existing===undefined)await fs.writeFile(backupFile,base,{flag:'wx'});
  try {
   await atomic(asset,runtime);await atomic(manifest,JSON.stringify(next,null,2)+'\n');
   // Refuse a concurrent edit rather than overwriting another extension's update.
   if(await read(htmlFile)!==before)throw new Error('Workbench changed during installation; retry.');
   await atomic(htmlFile,patched);
  }catch(e){
   if(oldAsset===undefined)await fs.rm(asset,{force:true});else await atomic(asset,oldAsset);
   if(oldManifest===undefined)await fs.rm(manifest,{force:true});else await atomic(manifest,oldManifest);
   throw e;
  }
 });
}
export async function uninstall(appRoot:string):Promise<void>{
 const htmlFile=await locateWorkbench(appRoot),dir=path.dirname(htmlFile);
 await locked(dir,async()=>{
  const before=(await read(htmlFile))!,base=cleanHtml(before);
  // Removing only our literal marker preserves other tools' modifications and VS Code updates.
  if(base!==before){if(await read(htmlFile)!==before)throw new Error('Workbench changed during removal; retry.');await atomic(htmlFile,base);}
  // Existing windows keep the already-loaded script until they reload.
  const asset=path.join(dir,assetName),old=await read(asset),m=await manifestAt(dir);
  if(old!==undefined && m && hash(old)===m.runtimeHash && old.startsWith(owned))await fs.unlink(asset);
  if(m)await fs.unlink(path.join(dir,manifestName));
 });
}
