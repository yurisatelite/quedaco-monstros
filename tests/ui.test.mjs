import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {chromium} from 'playwright';

test('lista com 340 monstros rola nos dois sentidos e mantém os botões acessíveis',{skip:process.platform!=='win32'},async()=>{
  const root=resolve(import.meta.dirname,'..');
  const server=createServer(async(req,res)=>{
    try{
      const pathname=new URL(req.url,'http://localhost').pathname;
      const file=pathname==='/foundry.css'?'C:/Program Files/Foundry Virtual Tabletop/resources/app/public/css/foundry2.css':resolve(root,'.'+pathname);
      if(pathname!=='/foundry.css'&&!file.startsWith(root+sep))throw Error('Invalid path');
      res.setHeader('Content-Type',file.endsWith('.mjs')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(await readFile(file));
    }catch{res.statusCode=404;res.end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1100,height:820}});
    await page.goto(`http://127.0.0.1:${server.address().port}/tests/ui-fixture.html`);
    await page.waitForFunction(()=>window.fixtureReady);
    await page.getByRole('button',{name:'Auditar todos os importados'}).click();
    await page.getByRole('button',{name:'Corrigir monstros selecionados'}).waitFor();
    assert.equal(await page.locator('[data-row]').count(),340);
    const scroller=page.locator('.qm-scroll');
    assert.ok(await scroller.evaluate(el=>el.scrollHeight>el.clientHeight));
    await scroller.evaluate(el=>el.scrollTop=el.scrollHeight);
    assert.ok(await scroller.evaluate(el=>el.scrollTop>100));
    await scroller.hover();await page.mouse.wheel(0,-100000);
    await page.waitForFunction(()=>document.querySelector('.qm-scroll').scrollTop===0);
    const footer=await page.locator('.form-footer').boundingBox();
    assert.ok(footer.y>=0&&footer.y+footer.height<=820);
    await page.locator('[name="search"]').fill('Monster 339');
    assert.equal(await page.locator('[data-row]:not([hidden])').count(),1);
    assert.equal(await page.locator('pre').count(),0);
    await page.locator('[name="reviewActor"]').selectOption('a339');
    await page.getByRole('button',{name:'Revisar uma ficha'}).click();
    await page.getByRole('button',{name:'Aplicar selecionadas'}).waitFor();
    assert.ok((await page.locator('.qm').innerText()).includes('Club'));
    assert.equal(await page.locator('pre').count(),0);
    assert.equal(await page.evaluate(()=>notifications.some(n=>n.includes('Original não encontrado'))),false);
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
});
