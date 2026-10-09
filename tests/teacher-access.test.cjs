const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createService}=require('../server.cjs');

test('teacher routes and management APIs open through the teacher computer LAN address without a password',async t=>{
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
 assert.equal((await fetch(local+'/teacher-microphone')).status,200);
 assert.equal((await fetch(local+'/teacher-microphone.html')).status,200);
 assert.equal((await fetch(local+'/api/teacher/class?class=601')).status,200);
 assert.equal((await fetch(local+'/api/teacher/answers')).status,200);
 assert.equal((await fetch(local+'/api/teacher/login',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,404);
 assert.equal(fs.existsSync(path.join(runtimeDir,'teacher-password.txt')),false);
 if(!lanAddress)return t.diagnostic('本机没有非回环网卡，本次仅检验本机入口');
 const lan=`http://${lanAddress}:${port}`;
 assert.equal((await fetch(lan+'/')).status,200);
 for(const route of ['/teacher','/teacher.html','/test','/teacher-microphone','/teacher-microphone.html','/api/teacher/microphone-context','/api/teacher/class?class=601','/api/teacher/answers'])assert.equal((await fetch(lan+route)).status,200,route);
 assert.equal((await fetch(lan+'/api/teacher/new-round',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({classId:'601'})})).status,200);
 assert.equal((await fetch(lan+'/api/teacher/live',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({level:.2,lamp:false,active:true,triggerCount:0})})).status,200);
});

test('microphone context uses the listening port and trusted computer addresses, ignoring Host',async t=>{
 const runtimeDir=fs.mkdtempSync(path.join(os.tmpdir(),'lesson4-mic-context-'));
 const service=createService({runtimeDir,roster:[],networkInterfaces:()=>({en0:[{address:'192.168.2.40',family:'IPv4'}],en1:[{address:'2001:db8::40',family:'IPv6'}]})});
 await new Promise(done=>service.server.listen(0,'0.0.0.0',done));
 t.after(async()=>{await new Promise(done=>service.server.close(done));service.close();fs.rmSync(runtimeDir,{recursive:true,force:true});});
 const port=service.server.address().port;
 const res=await fetch(`http://127.0.0.1:${port}/api/teacher/microphone-context`,{headers:{Host:'attacker.example:8888'}});
 assert.equal(res.status,200);
 const context=await res.json();
 assert.equal(context.microphoneUrl,`http://localhost:${port}/teacher-microphone`);
 for(const host of ['localhost','127.0.0.1','[::1]','192.168.2.40','[2001:db8::40]'])assert.ok(context.allowedOrigins.includes(`http://${host}:${port}`),host);
 assert.ok(!context.allowedOrigins.some(origin=>origin.includes('attacker')));
});

test('a remote device cannot gain teacher access using request headers',async t=>{
 const lanAddress=Object.values(os.networkInterfaces()).flat().find(v=>v&&v.family==='IPv4'&&!v.internal)?.address;
 if(!lanAddress)return t.skip('本机没有非回环网卡');
 const runtimeDir=fs.mkdtempSync(path.join(os.tmpdir(),'lesson4-teacher-remote-'));
 const service=createService({runtimeDir,roster:[],networkInterfaces:()=>({en0:[{address:'192.0.2.40',family:'IPv4'}]})});
 await new Promise(done=>service.server.listen(0,'0.0.0.0',done));
 t.after(async()=>{await new Promise(done=>service.server.close(done));service.close();fs.rmSync(runtimeDir,{recursive:true,force:true});});
 const base=`http://${lanAddress}:${service.server.address().port}`;
 const headers={Host:'localhost','X-Forwarded-For':'127.0.0.1','Forwarded':'for=127.0.0.1;host=localhost','X-Real-IP':'127.0.0.1'};
 for(const route of ['/teacher','/teacher.html','/test','/teacher-microphone','/teacher-microphone.html','/%74eacher-microphone.html','/api/teacher/microphone-context','/api/teacher/answers','/api/teacher/class?class=601'])assert.equal((await fetch(base+route,{headers})).status,403,route);
 for(const route of ['/api/teacher/new-round','/api/teacher/live'])assert.equal((await fetch(base+route,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:'{}'})).status,403,route);
});

test('teacher access follows current network interfaces after address changes',async t=>{
 const lanAddress=Object.values(os.networkInterfaces()).flat().find(v=>v&&v.family==='IPv4'&&!v.internal)?.address;
 if(!lanAddress)return t.skip('本机没有非回环网卡');
 let interfaces={};
 const runtimeDir=fs.mkdtempSync(path.join(os.tmpdir(),'lesson4-teacher-network-change-'));
 const service=createService({runtimeDir,roster:[],networkInterfaces:()=>interfaces});
 await new Promise(done=>service.server.listen(0,'0.0.0.0',done));
 t.after(async()=>{await new Promise(done=>service.server.close(done));service.close();fs.rmSync(runtimeDir,{recursive:true,force:true});});
 const url=`http://${lanAddress}:${service.server.address().port}/api/teacher/microphone-context`;
 assert.equal((await fetch(url)).status,403);
 interfaces={en0:[{address:lanAddress,family:'IPv4'}]};
 const response=await fetch(url);
 assert.equal(response.status,200);
 assert.ok((await response.json()).allowedOrigins.includes(new URL(url).origin));
 interfaces={};
 assert.equal((await fetch(url)).status,403);
});

test('retiring teacher password removes the legacy local credential file',async t=>{
 const runtimeDir=fs.mkdtempSync(path.join(os.tmpdir(),'lesson4-old-teacher-pass-'));
 fs.writeFileSync(path.join(runtimeDir,'teacher-password.txt'),'obsolete-test-secret\n');
 const service=createService({runtimeDir,roster:[{id:'sample-601',classId:'601',name:'虚构观察员'}]});
 t.after(()=>{service.close();fs.rmSync(runtimeDir,{recursive:true,force:true});});
 assert.equal(fs.existsSync(path.join(runtimeDir,'teacher-password.txt')),false);
});
