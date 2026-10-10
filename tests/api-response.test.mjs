import test from 'node:test';
import assert from 'node:assert/strict';
import {api} from '../public/sync.mjs';

test('API reports missing classroom service instead of parsing an HTML error page',async t=>{
 const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original;});
 globalThis.fetch=async()=>new Response('<!DOCTYPE html>Not found',{status:404,headers:{'Content-Type':'text/html'}});
 await assert.rejects(api('/api/roster?class=601'),e=>e.status===404&&e.message.includes('课堂服务')&&!e.message.includes('Unexpected'));
});
test('API reports empty responses and preserves structured conflict details',async t=>{
 const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original;});
 globalThis.fetch=async()=>new Response('',{status:502});
 await assert.rejects(api('/api/me'),e=>e.status===502&&e.message.includes('课堂服务'));
 globalThis.fetch=async()=>Response.json({error:'请确认已有身份',choices:[{id:'fiction'}]},{status:409});
 await assert.rejects(api('/api/login',{}),e=>e.status===409&&e.data.choices[0].id==='fiction');
});
