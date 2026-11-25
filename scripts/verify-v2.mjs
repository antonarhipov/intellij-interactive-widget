import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../dist/',import.meta.url),html=readFileSync(new URL('v2.html',root),'utf8');
assert.ok(html.includes('data-runzo-version="2"')&&html.includes('workspace=idea-lp-v2'));
assert.ok(html.includes('id="runzo-invite"')&&html.includes('Click me to explore.'));
assert.equal((html.match(/<iframe\b/g)||[]).length,1);
assert.equal((html.match(/<section\b/g)||[]).length,9);
assert.ok(html.includes('href="v2.css"')&&html.includes('src="v2.js"'));
assert.ok(!html.includes('workspace=idea-lp"'));
const manifest=JSON.parse(readFileSync(new URL('v2-assets/manifest.json',root),'utf8'));
for(const name of ['body','left-leg','right-leg']){
  const asset=manifest.assets[name];assert.ok(html.includes(asset.path));assert.ok(existsSync(new URL(asset.path,root)));
  const data=readFileSync(new URL(asset.path,root));assert.equal(data.toString('ascii',8,12),'WEBP');
  assert.ok(data.includes(Buffer.from('ALPH')),'Transparent puppet layer: '+name);
  assert.equal(createHash('sha256').update(data).digest('hex'),asset.sha256);
}
console.log('PASS: separate v2 page, isolated workspace, original landing content, and three verified transparent Runzo layers.');
