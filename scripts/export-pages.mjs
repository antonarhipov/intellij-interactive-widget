import {execFileSync} from 'node:child_process';
import {copyFile,cp,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const root=new URL('../',import.meta.url),site=new URL('release/site/',root);
// Generate the original widget exactly as before, then add the separate page.
execFileSync(process.execPath,[fileURLToPath(new URL('scripts/export-static.mjs',root)),fileURLToPath(new URL('index.html',site))],{cwd:fileURLToPath(root),stdio:'inherit'});
await mkdir(site,{recursive:true});
await Promise.all(['idea-lp.html','idea-lp.css','idea-lp.js'].map(name=>copyFile(new URL('dist/'+name,root),new URL(name,site))));
await cp(new URL('dist/idea-lp-assets/',root),new URL('idea-lp-assets/',site),{recursive:true});
console.log('Separate landing page: release/site/idea-lp.html');
