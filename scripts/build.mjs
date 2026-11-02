import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
await mkdir('dist',{recursive:true});
await build({entryPoints:['src/renderer.ts'],bundle:true,outfile:'dist/renderer.js',format:'iife',platform:'browser',target:'chrome120',legalComments:'inline',sourcemap:true});
for(const [input,output] of [['src/extension.ts','dist/extension.cjs'],['src/installer.ts','dist/installer.cjs']]){
 await build({entryPoints:[input],bundle:true,outfile:output,format:'cjs',platform:'node',target:'node20',external:['vscode'],sourcemap:true});
}
