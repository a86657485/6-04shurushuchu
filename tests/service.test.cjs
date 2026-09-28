const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const rules={stages:['road','sound','text','door'],assess:(stage,record)=>({pass:record.correct===true,errors:record.correct?[]:['需要修订']})};
async function fixture(t,dir,ruleSet=rules){
  assert.ok(fs.existsSync(path.join(root,'server.cjs')),'classroom service is implemented');
  const {createService}=require('../server.cjs');
  const runtimeDir=dir||fs.mkdtempSync(path.join(os.tmpdir(),'lesson4-'));
  const service=createService({runtimeDir,teacherPassword:'test-password',roster:[{id:'a',classId:'601',name:'虚构甲'},{id:'b',classId:'601',name:'虚构乙'},{id:'c',classId:'602',name:'虚构甲'}],rules:ruleSet});
  await new Promise(r=>service.server.listen(0,'127.0.0.1',r));
  const url='http://127.0.0.1:'+service.server.address().port;
  let stopped=false;async function stop(){if(stopped)return;stopped=true;await new Promise(r=>service.server.close(r));service.close();}t.after(async()=>{await stop();if(!dir)fs.rmSync(runtimeDir,{recursive:true,force:true});});
  const client=()=>{let cookie='';return async(route,body,headers={})=>{const res=await fetch(url+route,{method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),Cookie:cookie,...headers},body:body===undefined?undefined:JSON.stringify(body)});const set=res.headers.get('set-cookie');if(set)cookie=set.split(';')[0];let data;try{data=await res.json();}catch{data=null;}return {status:res.status,data,headers:res.headers};};};
  return {client,runtimeDir,stop};
}
test('rejects blank names, keeps identities separate and teacher routes private',async t=>{
  const f=await fixture(t);const a=f.client(),b=f.client();
  assert.equal((await a('/api/login',{classId:'601',name:'   '})).status,400);
  assert.equal((await a('/api/login',{classId:'501',name:'新同学'})).status,400);
  assert.equal((await a('/api/login',{classId:'601',id:'a'})).data.student.id,'a');
  assert.equal((await b('/api/login',{classId:'602',id:'c'})).data.student.id,'c');
  assert.equal((await a('/api/event',{eventId:'x',sid:'c',round:'r1',stage:'road',record:{correct:true}})).status,403);
  assert.equal((await a('/api/teacher/class?class=601')).status,401);
  assert.equal((await a('/test')).status,401);
  assert.equal((await a('/api/event',{eventId:'x',sid:'a',round:'r1',stage:'road',record:{correct:true}},{Origin:'https://untrusted.example'})).status,403);
});
test('awards valid stages once, preserves first answer and survives restart',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'lesson4-persist-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const f=await fixture(t,dir),a=f.client();await a('/api/login',{classId:'601',id:'a'});
  assert.equal((await a('/api/event',{eventId:'skip',sid:'a',round:'r1',stage:'sound',record:{correct:true}})).status,409);
  await a('/api/event',{eventId:'first',sid:'a',round:'r1',stage:'road',record:{prediction:'go',correct:false}});
  let result=await a('/api/event',{eventId:'pass',sid:'a',round:'r1',stage:'road',record:{correct:true}});
  assert.equal(result.data.points,10);assert.equal(result.data.records.road.first.correct,false);
  result=await a('/api/event',{eventId:'pass',sid:'a',round:'r1',stage:'road',record:{correct:true}});assert.equal(result.data.points,10);assert.equal(result.data.records.road.history.length,2);
  await a('/api/event',{eventId:'again',sid:'a',round:'r1',stage:'road',record:{correct:true}});
  await f.stop();const f2=await fixture(t,dir),a2=f2.client();await a2('/api/login',{classId:'601',id:'a'});assert.equal((await a2('/api/me')).data.points,10);
});
test('exam returns twenty balanced questions without answers and grades only full submissions',async t=>{
  const f=await fixture(t),a=f.client(),teacher=f.client();await a('/api/login',{classId:'601',id:'a'});
  const exam=(await a('/api/exam/create',{})).data;assert.equal(exam.questions.length,20);
  for(const q of exam.questions){assert.equal(q.answer,undefined);assert.equal(q.explanation,undefined);}
  assert.deepEqual(Object.values(exam.questions.reduce((a,q)=>(a[q.goal]=(a[q.goal]||0)+1,a),{})),[4,4,4,4,4]);
  assert.equal((await a('/api/exam/submit',{sid:'a',round:'r1',examId:exam.id,answers:{}})).status,400);
  await teacher('/api/teacher/login',{password:'test-password'});const bank=(await teacher('/api/teacher/answers')).data.questions;
  const answers=Object.fromEntries(exam.questions.map(q=>[q.id,bank.find(b=>b.id===q.id).answer]));
  const submit={sid:'a',round:'r1',examId:exam.id,answers};const scored=await a('/api/exam/submit',submit);assert.equal(scored.data.score,100);assert.equal(scored.data.feedback.length,20);
  await a('/api/exam/submit',submit);assert.equal((await a('/api/me')).data.quizAttempts.length,1);
});
test('new rounds preserve history, reject old uploads and demo cannot create records',async t=>{
  const f=await fixture(t),a=f.client(),teacher=f.client(),demo=f.client();await a('/api/login',{classId:'601',id:'a'});
  await a('/api/event',{eventId:'one',sid:'a',round:'r1',stage:'road',record:{correct:true}});
  await teacher('/api/teacher/login',{password:'test-password'});
  const before=(await teacher('/api/teacher/class?class=601')).data;assert.equal(before.students.length,2);assert.equal(before.students[0].points,10);
  await teacher('/api/teacher/new-round',{classId:'601'});assert.equal((await a('/api/me')).data.round,'r2');assert.equal((await a('/api/me')).data.points,0);
  assert.equal((await a('/api/event',{eventId:'old',sid:'a',round:'r1',stage:'road',record:{correct:true}})).status,409);
  assert.equal((await demo('/api/event',{eventId:'demo',sid:'a',round:'r2',stage:'road',record:{correct:true}})).status,401);
  const after=(await teacher('/api/teacher/class?class=601')).data;assert.equal(after.students[0].roundHistory[0].points,10);
  assert.equal((await a('/api/teacher/live',{level:.5,lamp:true,active:true,triggerCount:1})).status,401);
  await teacher('/api/teacher/live',{level:.5,lamp:true,active:true,triggerCount:1});assert.equal((await a('/api/live')).data.lamp,true);
  assert.equal((await a('/runtime/teacher-password.txt')).status,404);assert.equal((await a('/roster.json')).status,404);
});

test('manual names recover through confirmation and submitted exams belong to their student',async t=>{
 const f=await fixture(t),a=f.client(),b=f.client();
 const login=await a('/api/login',{classId:'601',name:'  虚构新同学  '});assert.equal(login.data.student.name,'虚构新同学');assert.equal(login.data.student.manual,true);
 const duplicate=await b('/api/login',{classId:'601',name:'虚构新同学'});assert.equal(duplicate.status,409);assert.equal(duplicate.data.choices[0].id,login.data.student.id);
 await b('/api/login',{classId:'601',id:'b'});const e=(await a('/api/exam/create',{})).data;
 const answers=Object.fromEntries(e.questions.map(q=>[q.id,0]));assert.equal((await b('/api/exam/submit',{sid:'b',round:'r1',examId:e.id,answers})).status,404);
 assert.equal((await b('/api/me')).data.quizAttempts.length,0);
});
test('production rule checks drive completion, examples pass four stages',async t=>{
 const realRules=require('../public/rules.js');const f=await fixture(t,undefined,realRules),a=f.client();
 await a('/api/login',{classId:'601',id:'a'});
 await a('/api/event',{eventId:'wrong-real',sid:'a',round:'r1',stage:'road',record:{prediction:'stop',diagram:{}}});assert.equal((await a('/api/me')).data.points,0);
 for(const stage of realRules.stages){const result=await a('/api/event',{eventId:'real-'+stage.id,sid:'a',round:'r1',stage:stage.id,record:realRules.examples[stage.id]});assert.equal(result.status,200);assert.ok(result.data.awards.some(v=>v.stage===stage.id));}assert.equal((await a('/api/me')).data.points,40);
 assert.equal((await a('/api/teacher/answers')).status,401);
});

test('manual login rejects non-text names rather than creating bogus identities',async t=>{
 const f=await fixture(t),a=f.client();for(const name of [{x:1},[],123])assert.equal((await a('/api/login',{classId:'601',name})).status,400);
});
test('login records entry for the teacher even before a student finishes any stage',async t=>{
 const f=await fixture(t),a=f.client(),teacher=f.client();await a('/api/login',{classId:'601',id:'a'});await teacher('/api/teacher/login',{password:'test-password'});
 const c=(await teacher('/api/teacher/class?class=601')).data;assert.ok(c.students.find(s=>s.student.id==='a').updated);assert.equal(c.students.find(s=>s.student.id==='b').updated,null);
});
test('serves browser modules with a JavaScript media type',async t=>{
 const f=await fixture(t),a=f.client();const response=await a('/app.mjs');assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/^text\/javascript/);
});
test('empty drafts do not replace the first prediction when history is capped',async t=>{
 const f=await fixture(t),a=f.client();await a('/api/login',{classId:'601',id:'a'});
 for(let i=0;i<15;i++)await a('/api/event',{eventId:'draft-'+i,sid:'a',round:'r1',stage:'road',record:{hints:1}});
 await a('/api/event',{eventId:'prediction',sid:'a',round:'r1',stage:'road',record:{prediction:'go',correct:false}});
 for(let i=0;i<32;i++)await a('/api/event',{eventId:'revision-'+i,sid:'a',round:'r1',stage:'road',record:{prediction:'stop',correct:true}});
 const s=(await a('/api/me')).data.records.road;assert.equal(s.first.prediction,'go');assert.equal(s.history.length,40);assert.equal(s.history.filter(r=>r.eventId==='prediction').length,1);
});
test('exam creation checks the requesting round before generating a new paper',async t=>{
 const f=await fixture(t),a=f.client(),teacher=f.client();await a('/api/login',{classId:'601',id:'a'});await teacher('/api/teacher/login',{password:'test-password'});await teacher('/api/teacher/new-round',{classId:'601'});
 assert.equal((await a('/api/exam/create',{sid:'a',round:'r1'})).status,409);
 const e=(await a('/api/exam/create',{sid:'a',round:'r2'})).data;assert.equal(e.round,'r2');assert.equal((await a('/api/me')).data.currentExam.round,'r2');
});
test('malformed observations are rejected as invalid records instead of crashing rules',async t=>{
 const realRules=require('../public/rules.js'),f=await fixture(t,undefined,realRules),a=f.client();await a('/api/login',{classId:'601',id:'a'});
 const result=await a('/api/event',{eventId:'malformed',sid:'a',round:'r1',stage:'road',record:{prediction:'go',trials:[null],submitted:true}});assert.equal(result.status,400);assert.equal((await a('/api/me')).data.points,0);
});
test('first and latest submitted explanations survive more than forty later drafts',async t=>{
 const realRules=require('../public/rules.js'),f=await fixture(t,undefined,realRules),a=f.client();await a('/api/login',{classId:'601',id:'a'});
 const first={...realRules.examples.road,diagram:{...realRules.goals.road,compute:'go'}};
 await a('/api/event',{eventId:'first-submit',sid:'a',round:'r1',stage:'road',record:first});
 await a('/api/event',{eventId:'latest-submit',sid:'a',round:'r1',stage:'road',record:realRules.examples.road});
 for(let i=0;i<45;i++)await a('/api/event',{eventId:'later-draft-'+i,sid:'a',round:'r1',stage:'road',record:{...realRules.examples.road,submitted:false,hints:i}});
 const s=(await a('/api/me')).data;assert.equal(s.records.road.history.length,40);assert.ok(s.records.road.firstSubmitted,'first submitted explanation is retained');assert.equal(s.records.road.firstSubmitted.eventId,'first-submit');assert.equal(s.records.road.firstSubmitted.assessment.pass,false);assert.equal(s.records.road.lastSubmitted.eventId,'latest-submit');assert.equal(s.records.road.lastSubmitted.assessment.pass,true);assert.equal(s.records.road.latest.submitted,false);assert.equal(s.points,10);
});
test('two devices keep the newer submitted record when an old offline event arrives last',async t=>{
 const realRules=require('../public/rules.js'),f=await fixture(t,undefined,realRules),a=f.client(),b=f.client();await a('/api/login',{classId:'601',id:'a'});await b('/api/login',{classId:'601',id:'a'});
 const t1=Date.now()-2000,t2=t1+1000;const event=(eventId,record)=>({eventId,sid:'a',round:'r1',stage:'road',record});
 await b('/api/event',event('new-device-submit',{...realRules.examples.road,editedAt:t2}));
 const older=event('offline-old-submit',{...realRules.examples.road,diagram:{...realRules.goals.road,compute:'go'},editedAt:t1});await a('/api/event',older);await a('/api/event',older);
 const s=(await b('/api/me')).data;assert.equal(s.records.road.latest.eventId,'new-device-submit');assert.equal(s.records.road.lastSubmitted.eventId,'new-device-submit');assert.equal(s.records.road.firstSubmitted.eventId,'new-device-submit');assert.equal(s.records.road.history.length,2);assert.equal(s.points,10);
});
test('an older passing submission does not overwrite a newer draft or award new points',async t=>{
 const realRules=require('../public/rules.js'),f=await fixture(t,undefined,realRules),a=f.client(),b=f.client();await a('/api/login',{classId:'601',id:'a'});await b('/api/login',{classId:'601',id:'a'});
 const t1=Date.now()-2000,t2=t1+1000;
 await b('/api/event',{eventId:'new-device-draft',sid:'a',round:'r1',stage:'road',record:{...realRules.examples.road,submitted:false,editedAt:t2}});
 await a('/api/event',{eventId:'old-device-pass',sid:'a',round:'r1',stage:'road',record:{...realRules.examples.road,editedAt:t1}});
 const s=(await b('/api/me')).data;assert.equal(s.records.road.latest.eventId,'new-device-draft');assert.equal(s.records.road.lastSubmitted,null);assert.equal(s.records.road.firstSubmitted.eventId,'old-device-pass');assert.equal(s.records.road.history.length,2);assert.equal(s.points,0);
});
test('extreme future edit timestamps use reception time instead of locking progress',async t=>{
 const f=await fixture(t),a=f.client();await a('/api/login',{classId:'601',id:'a'});
 await a('/api/event',{eventId:'future',sid:'a',round:'r1',stage:'road',record:{prediction:'go',correct:false,editedAt:Date.now()+1e12}});
 const current=(await a('/api/me')).data.records.road.latest;assert.ok(current.editedAt<=Date.now()+60000);
 await a('/api/event',{eventId:'normal-after-future',sid:'a',round:'r1',stage:'road',record:{prediction:'stop',correct:true,editedAt:Date.now()}});assert.equal((await a('/api/me')).data.records.road.latest.eventId,'normal-after-future');
});
