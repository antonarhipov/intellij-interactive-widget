import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {copyFile,cp,mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const root=new URL('../',import.meta.url),site=new URL('release/site/',root);
// Generate the original widget exactly as before, then add the separate page.
execFileSync(process.execPath,[fileURLToPath(new URL('scripts/export-static.mjs',root)),fileURLToPath(new URL('index.html',site))],{cwd:fileURLToPath(root),stdio:'inherit'});
await mkdir(site,{recursive:true});
await Promise.all(['idea-lp.css','idea-lp.js'].map(name=>copyFile(new URL('dist/'+name,root),new URL(name,site))));
let landing=await readFile(new URL('dist/idea-lp.html',root),'utf8');
for(const [file,reference] of [['index.html','./index.html?workspace=idea-lp'],['idea-lp.js','idea-lp.js'],['idea-lp.css','idea-lp.css']]){
  const hash=createHash('sha256').update(await readFile(new URL(file,site))).digest('hex').slice(0,16);
  const original='"'+reference+'"',versioned='"'+reference+(reference.includes('?')?'&amp;':'?')+'v='+hash+'"';
  if(!landing.includes(original))throw Error('Missing landing-page resource: '+reference);
  landing=landing.replace(original,versioned);
}
// Pages caches HTML and assets for ten minutes. A changed widget must get a
// fresh iframe navigation even when an older embedded document is still cached.
await writeFile(new URL('idea-lp.html',site),landing);
await cp(new URL('dist/idea-lp-assets/',root),new URL('idea-lp-assets/',site),{recursive:true});
console.log('Separate landing page: release/site/idea-lp.html');
