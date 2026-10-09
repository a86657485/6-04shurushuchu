import test from 'node:test';
import assert from 'node:assert/strict';
import {TeacherMicrophoneBridge} from '../public/microphone-bridge.mjs';

function fixture(blocked=false){
 const messages=[],statuses=[],samples=[];let onMessage,monitor,openedUrl;
 const popup={closed:false,focus(){},postMessage(data,origin){messages.push({data,origin});},close(){this.closed=true;}};
 const hostWindow={location:{origin:'http://192.168.1.10:4321'},open(url){openedUrl=url;return blocked?null:popup;},addEventListener(name,fn){if(name==='message')onMessage=fn;},removeEventListener(){},setInterval(fn){monitor=fn;return 1;},clearInterval(){}};
 const bridge=new TeacherMicrophoneBridge({microphoneUrl:'http://localhost:4321/teacher-microphone',hostWindow,onStatus:s=>statuses.push(s),onSample:s=>samples.push(s)});
 const event=(data,extra={})=>onMessage({origin:'http://localhost:4321',source:popup,data:{channel:bridge.channel,...data},...extra});
 return {bridge,popup,messages,statuses,samples,event,monitor:()=>monitor(),url:()=>new URL(openedUrl)};
}

test('LAN教师页先在localhost窗口握手，再开始采声；只接受正确来源的样本',()=>{
 const f=fixture();f.bridge.start();
 assert.equal(f.url().hostname,'localhost');assert.equal(f.url().port,'4321');
 assert.equal(f.url().searchParams.get('parentOrigin'),'http://192.168.1.10:4321');
 assert.equal(f.messages.length,0);
 f.event({type:'teacher-microphone-ready'},{origin:'http://untrusted.example'});assert.equal(f.messages.length,0);
 f.event({type:'teacher-microphone-ready'});assert.equal(f.messages[0].data.action,'start');
 f.event({type:'teacher-microphone-sample',level:.9,channel:'wrong'});assert.equal(f.samples.length,0);
 f.event({type:'teacher-microphone-sample',level:.9},{source:{}});assert.equal(f.samples.length,0);
 f.event({type:'teacher-microphone-sample',level:2});assert.equal(f.samples.length,0);
 f.event({type:'teacher-microphone-sample',level:.9});assert.equal(f.samples[0].level,.9);
 f.bridge.stop();assert.equal(f.messages.at(-1).data.action,'stop');assert.equal(f.popup.closed,true);assert.equal(f.samples.at(-1).level,0);
 f.bridge.destroy();
});

test('弹窗被拦截或授权窗口被关闭时，明确停止而不伪报正在采声',()=>{
 const blocked=fixture(true);blocked.bridge.start();assert.equal(blocked.statuses.at(-1).state,'error');assert.match(blocked.statuses.at(-1).message,/弹窗/);blocked.bridge.destroy();
 const f=fixture();f.bridge.start();f.popup.closed=true;f.monitor();assert.equal(f.statuses.at(-1).state,'stopped');assert.equal(f.samples.at(-1).level,0);f.bridge.destroy();
});
