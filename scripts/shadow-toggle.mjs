import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const b=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--use-angle=d3d11']});
try{
  const p=await b.newPage();await p.goto('http://127.0.0.1:5173');await p.waitForFunction(()=>window.__XPIN);await p.evaluate(()=>window.__XPIN.ready);
  await p.evaluate(async()=>{const s=window.__XPIN.studio;s.applyLook(5);s.p.settings.dof=0;s.p.settings.grain=0;await s.view.sync(s.p);});
  const png=()=>p.evaluate(async()=>Array.from(new Uint8Array(await (await window.__XPIN.png(960)).arrayBuffer())));
  const on=Buffer.from(await png());await p.evaluate(()=>window.__XPIN.studio.p.lights.find(l=>l.presetManaged).shadow=false);const off=Buffer.from(await png());
  assert.ok(!on.equals(off));const audit=await p.evaluate(()=>{const s=window.__XPIN.studio,l=s.p.lights.find(l=>l.presetManaged),light=s.view.lights.get(l.id);return{cookie:!!light.map,shadowIntensity:light.shadow.intensity};});
  assert.equal(audit.cookie,true);assert.equal(audit.shadowIntensity,0);await writeFile('test-results/v4/shadow-toggle.json',JSON.stringify({audit,pixelsChanged:true},null,2));console.log(audit);
}finally{await b.close();}
