import * as vscode from 'vscode';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {install,uninstall,status} from './installer.ts';
import {normalizeConfig,defaults} from './config.ts';

export function activate(context:vscode.ExtensionContext):void {
  const output=vscode.window.createOutputChannel('Lune Glide');context.subscriptions.push(output);
  const config=()=>{
    // Application-wide injection must not execute settings supplied by an untrusted workspace.
    const c=vscode.workspace.getConfiguration('neovideCursor');const values:Record<string,unknown>={};
    for(const key of Object.keys(defaults))values[key]=c.inspect(key)?.globalValue??defaults[key as keyof typeof defaults];
    return normalizeConfig(values);
  };
  async function current(){return status(vscode.env.appRoot);}
  async function reloadMessage(message:string){
    const action=await vscode.window.showInformationMessage(message,'Reload Window');
    if(action==='Reload Window')await vscode.commands.executeCommand('workbench.action.reloadWindow');
  }
  const command=(name:string,fn:()=>Promise<void>)=>context.subscriptions.push(vscode.commands.registerCommand(`neovideCursor.${name}`,async()=>{
    try{
      if(vscode.env.uiKind!==vscode.UIKind.Desktop)throw new Error('This extension requires desktop VS Code.');
      if(vscode.env.remoteName&&context.extension.extensionKind!==vscode.ExtensionKind.UI)throw new Error('Install this extension locally, not on the remote extension host.');
      await fn();
    }catch(e){output.appendLine(String(e));output.show(true);await vscode.window.showErrorMessage(`Lune Glide: ${e instanceof Error?e.message:String(e)}`);}
  }));
  async function apply(){
    const bundle=await fs.readFile(path.join(context.extensionPath,'dist/renderer.js'),'utf8');
    await install(vscode.env.appRoot,bundle,config());await context.globalState.update('installed',true);
    output.appendLine(`Installed for VS Code ${vscode.version}: ${vscode.env.appRoot}`);
    await reloadMessage('Lune Glide installed. Reload this and other open VS Code windows to apply.');
  }
  command('enable',async()=>{
    const answer=await vscode.window.showWarningMessage(
      'Lune Glide adds a local script to this VS Code installation. It affects every window/profile, may trigger an installation-integrity warning, and needs repair after updates. Use Disable before uninstalling. Your CSP and product checksums are not changed.',
      {modal:true},'Enable Cursor Animation');
    if(answer==='Enable Cursor Animation')await apply();
  });
  command('disable',async()=>{
    await uninstall(vscode.env.appRoot);await context.globalState.update('installed',false);
    await reloadMessage('Lune Glide injection removed. Reload every open VS Code window to restore native rendering.');
  });
  command('repair',async()=>{
    const answer=await vscode.window.showWarningMessage('Reapply Lune Glide to this VS Code installation using your current User settings?',{modal:true},'Repair');
    if(answer==='Repair')await apply();
  });
  command('applySettings',async()=>{
    if((await current()).state==='not-installed'){await vscode.window.showInformationMessage('Run Lune Glide: Enable first.');return;}
    await apply();
  });
  command('status',async()=>{
    const state=await current();output.appendLine(JSON.stringify({version:vscode.version,...state,settings:config()},null,2));output.show(true);
  });
  command('settings',async()=>{await vscode.commands.executeCommand('workbench.action.openSettings','@ext:lune.neovide-cursor');});
  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(async e=>{
    if(!e.affectsConfiguration('neovideCursor')||!context.globalState.get('installed'))return;
    const answer=await vscode.window.showInformationMessage('Lune Glide settings changed. Apply them to all windows of this installation?','Apply Settings');
    if(answer==='Apply Settings')await vscode.commands.executeCommand('neovideCursor.applySettings');
  }));
  // Detection only: never patch application files during activation or extension updates.
  void current().then(async s=>{
    if(context.globalState.get('installed')&&s.state!=='installed'){
      const answer=await vscode.window.showWarningMessage('Lune Glide needs repair after a VS Code update or file change.','Repair','Status');
      if(answer)await vscode.commands.executeCommand(answer==='Repair'?'neovideCursor.repair':'neovideCursor.status');
    }
  }).catch(e=>output.appendLine(`Detection: ${String(e)}`));
}
export function deactivate():void {/* Injection is installation-wide; use Disable before uninstalling. */}
