import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

async function fixture(t){
 assert.ok(await fs.stat(new URL('../cloud/service.mjs',import.meta.url)).catch(()=>false),'cloud classroom service exists');
 const {createClassroomHandler}=await import('../cloud/service.mjs');
 const pg=await PGlite.create();t.after(()=>pg.close());
 await pg.exec(await fs.readFile(new URL('../netlify/database/migrations/20261010090000_classroom.sql',import.meta.url),'utf8'));
 for(const [id,classId,name] of [['a','601','虚构甲'],['b','601','虚构乙'],['c','602','虚构甲']])await pg.query('INSERT INTO lesson4_students(id,class_id,name) VALUES($1,$2,$3)',[id,classId,name]);
 const handler=createClassroomHandler({db:pg,teacherKey:'fiction-teacher-access-key-long-enough',rules:(await import('../public/rules.js')).default});
 const client=()=>{let cookie='';return async(path,body,headers={})=>{
  const res=await handler(new Request('https://classroom.example'+path,{method:body===undefined?'GET':'POST',headers:{cookie,...(body===undefined?{}:{'Content-Type':'application/json',Origin:'https://classroom.example'}),...headers},body:body===undefined?undefined:JSON.stringify(body)}));
  const set=res.headers.get('set-cookie');if(set)cookie=set.split(';')[0];
  return {status:res.status,data:res.headers.get('content-type')?.includes('json')?await res.json():await res.text(),headers:res.headers};
 };};return {pg,handler,client};
}

test('cloud roster, private teacher entry and direct teacher paths enforce separation',async t=>{
 const f=await fixture(t),student=f.client(),teacher=f.client();
 assert.equal((await student('/api/roster?class=601')).data.length,2);
 assert.equal((await student('/api/roster?class=501')).status,400);
 for(const p of ['/teacher','/teacher.html','/teacher.html/','/test','/test/','/teacher-microphone','/teacher-microphone.html','/api/teacher/answers','/api/teacher/class?class=601'])assert.equal((await student(p)).status,403,p);
 const entry=await teacher('/api/teacher/enter?key=fiction-teacher-access-key-long-enough');assert.equal(entry.status,302);assert.equal(entry.headers.get('location'),'/teacher');assert.match(entry.headers.get('set-cookie'),/HttpOnly/);assert.match(entry.headers.get('set-cookie'),/Secure/);
 assert.equal((await teacher('/teacher')).status,200);assert.equal((await teacher('/test')).status,200);
 assert.equal((await teacher('/api/teacher/answers')).data.questions.length,40);
 assert.equal((await student('/api/login',{classId:'601',id:'a'})).data.student.id,'a');
 assert.equal((await student('/api/event',{sid:'b',round:'r1',stage:'road',eventId:'wrong',record:{}})).status,403);
 for(const hints of ['<form>unsafe</form>',-1,1.5])assert.equal((await student('/api/event',{sid:'a',round:'r1',stage:'road',eventId:'unsafe',record:{hints}})).status,400);
 assert.equal((await teacher('/api/teacher/new-round',{classId:'601'},{'Content-Type':'text/plain'})).status,415);
 assert.equal((await teacher('/test/')).headers.get('location'),'/test');
 assert.equal((await student('/api/logout',{})).status,200);assert.equal((await student('/api/me')).status,401);
});
test('cloud submissions deduplicate concurrent events and restore across handler instances',async t=>{
 const f=await fixture(t),a=f.client(),b=f.client();await a('/api/login',{classId:'601',id:'a'});await b('/api/login',{classId:'601',id:'a'});
 const R=(await import('../public/rules.js')).default;
 const e={sid:'a',round:'r1',stage:'road',eventId:'same',record:R.examples.road};
 const results=await Promise.all([a('/api/event',e),b('/api/event',e)]);assert.ok(results.every(r=>r.status===200));
 const state=(await a('/api/me')).data;assert.equal(state.points,10);assert.equal(state.records.road.history.length,1);
 const fresh=f.client();await fresh('/api/login',{classId:'601',id:'a'});assert.equal((await fresh('/api/me')).data.points,10);
 const {createClassroomHandler}=await import('../cloud/service.mjs');
 const newHandler=createClassroomHandler({db:f.pg,teacherKey:'fiction-teacher-access-key-long-enough'});
 const roster=await newHandler(new Request('https://classroom.example/api/roster?class=601'));assert.equal((await roster.json()).length,2);
 const earlier=Date.now()+1000,later=earlier+1000;
 await a('/api/event',{...e,eventId:'new',record:{...R.examples.road,editedAt:later}});
 await b('/api/event',{...e,eventId:'old',record:{...R.examples.road,editedAt:earlier}});
 assert.equal((await a('/api/me')).data.records.road.latest.eventId,'new');
});
test('cloud exams, new rounds and shared microphone persist without leaking answers',async t=>{
 const f=await fixture(t),a=f.client(),teacher=f.client();await teacher('/api/teacher/enter?key=fiction-teacher-access-key-long-enough');await a('/api/login',{classId:'601',id:'a'});
 const [x,y]=await Promise.all([a('/api/exam/create',{}),a('/api/exam/create',{})]);assert.equal(x.data.id,y.data.id);assert.equal(x.data.questions.length,20);assert.ok(x.data.questions.every(q=>q.answer===undefined));
 assert.equal((await a('/api/exam/submit',{sid:'a',round:'r1',examId:x.data.id,answers:{}})).status,400);
 const answers=Object.fromEntries(x.data.questions.map(q=>[q.id,0]));const body={sid:'a',round:'r1',examId:x.data.id,answers};
 await Promise.all([a('/api/exam/submit',body),a('/api/exam/submit',body)]);assert.equal((await a('/api/me')).data.quizAttempts.length,1);
 assert.equal((await a('/api/teacher/live',{level:.5,lamp:true,active:true,triggerCount:1})).status,403);
 await teacher('/api/teacher/live',{level:.5,lamp:true,active:true,triggerCount:1});assert.equal((await a('/api/live')).data.lamp,true);
 await teacher('/api/teacher/new-round',{classId:'601'});assert.equal((await a('/api/me')).data.round,'r2');
 assert.equal((await a('/api/event',{sid:'a',round:'r1',stage:'road',eventId:'old-round',record:{}})).status,409);
 assert.equal((await teacher('/api/teacher/class?class=601')).data.students[0].roundHistory.length,1);
});
