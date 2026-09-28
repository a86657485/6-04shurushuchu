const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createService}=require('../server.cjs');

test('teacher route and management APIs open without a password on teacher computer, denied over LAN',async t=>{
 const runtimeDir=fs.mkdtempSync(path.join(os.tmpdir(),'lesson4-teacher-local-'));
 const service=createService({runtimeDir,roster:[{id:'sample-601',classId:'601',name:'虚构观察员'}]});
 await new Promise(done=>service.server.listen(0,'0.0.0.0',done));
 t.after(async()=>{await new Promise(done=>service.server.close(done));service.close();fs.rmSync(runtimeDir,{recursive:true,force:true});});
 const port=service.server.address().port;
 const local=`http://127.0.0.1:${port}`;
 const lanAddress=Object.values(os.networkInterfaces()).flat().find(v=>v&&v.family==='IPv4'&&!v.internal)?.address;
 assert.equal((await fetch(local+'/teacher')).status,200);
 assert.equal((await fetch(local+'/teacher.html')).status,200);
 assert.equal((await fetch(local+'/test')).status,200);
 assert.equal((await fetch(local+'/api/teacher/class?class=601')).status,200);
 assert.equal((await fetch(local+'/api/teacher/answers')).status,200);
 assert.equal((await fetch(local+'/api/teacher/login',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,404);
 assert.equal(fs.existsSync(path.join(runtimeDir,'teacher-password.txt')),false);
 if(!lanAddress)return t.diagnostic('本机没有非回环网卡，本次仅检验本机入口');
 const lan=`http://${lanAddress}:${port}`;
 assert.equal((await fetch(lan+'/')).status,200);
 for(const route of ['/teacher','/teacher.html','/test','/api/teacher/class?class=601','/api/teacher/answers'])assert.equal((await fetch(lan+route)).status,403,route);
 for(const route of ['/api/teacher/new-round','/api/teacher/live'])assert.equal((await fetch(lan+route,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,403,route);
});

test('retiring teacher password removes the legacy local credential file',async t=>{
 const runtimeDir=fs.mkdtempSync(path.join(os.tmpdir(),'lesson4-old-teacher-pass-'));
 fs.writeFileSync(path.join(runtimeDir,'teacher-password.txt'),'obsolete-test-secret\n');
 const service=createService({runtimeDir,roster:[{id:'sample-601',classId:'601',name:'虚构观察员'}]});
 t.after(()=>{service.close();fs.rmSync(runtimeDir,{recursive:true,force:true});});
 assert.equal(fs.existsSync(path.join(runtimeDir,'teacher-password.txt')),false);
});
