#!/usr/bin/env node
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {uninstall,status}=require('../dist/installer.cjs');
const [mode,appRoot]=process.argv.slice(2);
if(!['status','disable'].includes(mode)||!appRoot){
 console.error('Usage: node scripts/recover.mjs <status|disable> <VS Code resources/app directory>');process.exitCode=2;
}else{
 try{
  if(mode==='disable')await uninstall(appRoot);
  console.log(JSON.stringify(await status(appRoot),null,2));
  if(mode==='disable')console.log('Restart all VS Code windows. Original backups remain for manual recovery.');
 }catch(e){console.error(e.message);process.exitCode=1;}
}
