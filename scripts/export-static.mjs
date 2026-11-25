import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {dirname,extname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=new URL('../',import.meta.url),dist=new URL('dist/',root);
const output=resolve(process.argv[2]||fileURLToPath(new URL('release/notify-hub-prototype.html',root)));
const mime={'.svg':'image/svg+xml','.ttf':'font/ttf','.woff2':'font/woff2','.png':'image/png','.jpg':'image/jpeg'};
const dataURI=async url=>`data:${mime[extname(url.pathname)]||'application/octet-stream'};base64,${(await readFile(url)).toString('base64')}`;
const json=value=>JSON.stringify(value).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
const scriptText=text=>text.replace(/<\/script/gi,'<\\/script');

let html=await readFile(new URL('index.html',dist),'utf8');
const snapshot=JSON.parse(await readFile(new URL('data.json',dist),'utf8'));
snapshot.database=JSON.parse(await readFile(new URL('database.json',dist),'utf8'));
snapshot.logicalLibraries=JSON.parse(await readFile(new URL('logical-libraries.json',dist),'utf8'));
const assets={};
async function collectAssets(directory){
  for(const entry of (await readdir(directory,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
    const url=new URL(entry.name+(entry.isDirectory()?'/':''),directory);
    if(entry.isDirectory())await collectAssets(url);
    else if(mime[extname(entry.name)])assets[fileURLToPath(url).slice(fileURLToPath(dist).length)]=await dataURI(url);
  }
}
await collectAssets(new URL('icons/',dist));

for(const match of [...html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)]){
  const cssURL=new URL(match[1],dist);
  let css=await readFile(cssURL,'utf8');
  for(const resource of [...css.matchAll(/url\(\s*(['"]?)([^'"\s)]+)\1\s*\)/g)]){
    if(resource[2].startsWith('data:')||resource[2].startsWith('#'))continue;
    if(/^(?:https?:|\/\/)/.test(resource[2]))throw Error('Export requires a local CSS asset: '+resource[2]);
    css=css.replace(resource[0],`url("${await dataURI(new URL(resource[2],cssURL))}")`);
  }
  html=html.replace(match[0],()=>`<style>\n${css}\n</style>`);
}
const scripts=[...html.matchAll(/<script src="([^"]+)" defer><\/script>/g)];
if(!scripts.length)throw Error('No prototype scripts found; review static packaging.');
html=html.replace(scripts[0][0],()=>`<script type="application/json" id="prototype-snapshot">${json({snapshot,assets})}</script>\n`+scripts[0][0]);
for(const match of scripts){
  const source=await readFile(new URL(match[1],dist),'utf8');
  html=html.replace(match[0],()=>`<script>\n${scriptText(source)}\n</script>`);
}
if(/<script\b[^>]*\bsrc=|<link\b[^>]*rel="stylesheet"/i.test(html))throw Error('Export still references an external script or stylesheet.');
html=html.replace('<head>',`<head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; base-uri 'none'; object-src 'none'">`);
await mkdir(dirname(output),{recursive:true});
await writeFile(output,html);
console.log(JSON.stringify({output,bytes:Buffer.byteLength(html),embeddedIcons:Object.keys(assets).length,sourceFiles:Object.keys(snapshot.projects[0].files).length,networkRequired:false},null,2));
