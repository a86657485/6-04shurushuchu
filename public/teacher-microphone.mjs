import {api} from './sync.mjs?v=1';
import {Microphone} from './microphone.mjs?v=2';

const $=id=>document.getElementById(id),R=window.LessonRules;
const parameters=new URLSearchParams(location.search),parentOrigin=parameters.get('parentOrigin'),channel=parameters.get('channel');
let connected=false,level=0,active=false,sound=R.newSound();
function notify(type,data={}){if(connected&&!window.opener.closed)window.opener.postMessage({type,channel,...data},parentOrigin);}
const mic=new Microphone({pauseWhenHidden:false,onSample:sample=>{level=sample.level;notify('teacher-microphone-sample',{level});},onStatus:status=>{active=status.state==='listening';if(!active)level=0;$('helper-status').textContent=status.message;notify('teacher-microphone-status',status);}});
function start(){sound=R.newSound();mic.start();}
function stop(){mic.stop();sound=R.newSound();}
$('helper-start').onclick=start;$('helper-stop').onclick=stop;$('helper-calibrate').onclick=()=>mic.calibrate();$('helper-close').onclick=()=>{stop();window.close();};
window.addEventListener('message',event=>{
 if(!connected||event.source!==window.opener||event.origin!==parentOrigin||event.data?.channel!==channel||event.data?.type!=='teacher-microphone-command')return;
 if(event.data.action==='start')start();if(event.data.action==='stop')stop();if(event.data.action==='calibrate')mic.calibrate();
});
const renderTimer=setInterval(()=>{sound=R.stepSound(sound,active?level:0,Date.now());$('helper-lamp').classList.toggle('on',sound.lamp);$('helper-lamp').setAttribute('aria-label',sound.lamp?'灯亮':'灯未亮');$('helper-lamp-label').textContent=sound.lamp?'灯亮':'灯未亮';$('helper-meter').style.width=level*100+'%';$('helper-level').textContent=Math.round(level*100)+'%';if(connected&&window.opener.closed){stop();window.close();}},60);
window.addEventListener('pagehide',()=>{clearInterval(renderTimer);mic.destroy();});
async function boot(){
 const context=await api('/api/teacher/microphone-context');
 if(parentOrigin||channel){
  if(!window.opener||!context.allowedOrigins.includes(parentOrigin)||!/^[A-Za-z0-9-]{16,80}$/.test(channel||''))throw Error('请从教师大屏重新打开麦克风测试窗口。');
  connected=true;$('helper-start').disabled=false;$('helper-connection').textContent='已连接教师大屏；实测响度和灯光会同步给课堂页面。';notify('teacher-microphone-ready');
 }else{$('helper-start').disabled=false;$('helper-status').textContent='点击开启并允许使用麦克风。';$('helper-connection').textContent='当前为单独测试窗口；从教师大屏打开时会同步课堂观察。';}
}
boot().catch(error=>{$('helper-status').textContent=error.message;$('helper-start').disabled=true;});
