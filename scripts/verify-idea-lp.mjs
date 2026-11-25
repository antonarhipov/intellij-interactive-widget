import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';

const root=new URL('../dist/',import.meta.url),html=readFileSync(new URL('idea-lp.html',root),'utf8'),checks=[];
const check=(ok,message)=>{assert.ok(ok,message);checks.push(message)};
check((html.match(/<iframe\b/g)||[]).length===1&&html.includes('data-src="./index.html?workspace=idea-lp"'),'One embedded original widget with isolated browsing preferences');
check((html.match(/<section\b/g)||[]).length===9&&html.includes('The Power of IntelliJ')&&html.includes('Customer Stories')&&html.includes('Enterprise-grade security and governance'),'Original landing-page sections and copy are retained');
check(html.includes('id="wt-site-header"')&&html.includes('id="js-menu-second"')&&html.includes('<footer'),'Original global navigation, product navigation and footer are retained');
check((html.match(/<video\b/g)||[]).length===1&&html.includes('id="idea-mobile-video"')&&html.includes('data-src="https://resources.jetbrains.com/storage/products/intellij-idea/video/overview/hero.mp4"')&&html.includes('preload="none"'),'Original hero video is available on mobile and loads only on playback');
const scripts=[...html.matchAll(/<script\b[^>]*src="([^"]+)"/g)].map(m=>m[1]);
check(scripts.length===1&&scripts[0]==='idea-lp.js'&&!/<script\b(?![^>]*src=)/.test(html),'Only the local landing-page behavior runs; original site and tracking scripts are absent');
check(!/\s(?:src|poster)="https?:/.test(html)&&!/<link\b[^>]*href="https?:/.test(html),'All page imagery, fonts and styles are local assets');
check(html.includes('name="robots" content="noindex, nofollow"'),'Landing-page study is excluded from search indexing');
check(html.includes('id="idea-demo-control"')&&html.includes('Interactive demo</strong>')&&html.includes('Explore yourself'),'Desktop widget includes a persistent interactive invitation and exploration control');
for(const m of html.matchAll(/(?:src|href|srcset)="(idea-lp-assets\/[^"]+)"/g)){
 const path=m[1].split(/[?#]/)[0];assert.ok(existsSync(new URL(path,root)),path);
}
const manifest=JSON.parse(readFileSync(new URL('idea-lp-assets/manifest.json',root),'utf8'));
for(const [url,asset] of Object.entries(manifest.assets)){
 const local=asset.local_path||asset.path;
 assert.ok(local,'Asset has a path: '+url);
 const bytes=readFileSync(new URL(local,root));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.local_sha256,url);
}
checks.push('All captured visual assets match their recorded local hashes');
console.log(JSON.stringify({result:'PASS',checks,assets:Object.keys(manifest.assets).length},null,2));
