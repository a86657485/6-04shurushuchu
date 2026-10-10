import {api,download,escape} from './sync.mjs?v=1';
import {CampusScene} from './scene.mjs?v=1';
import {Microphone} from './microphone.mjs?v=3';
import {TeacherMicrophoneBridge} from './microphone-bridge.mjs?v=2';
import {summarizeClass} from './teacher-stats.mjs?v=2';
import {renderClassCharts} from './teacher-charts.mjs?v=2';
if(new URL(location.href).searchParams.has('key')){const url=new URL(location.href);url.searchParams.delete('key');history.replaceState(null,'',url.pathname+url.search+url.hash);}
const $=id=>document.getElementById(id),R=window.LessonRules;let data,selected=null,chartStatus=null,chartStage=null,requestNumber=0,teacherScene,sound=R.newSound(),level=0,active=false,sampleAt=0,sharing=false,auth=false,mode='3d',microphoneBridge=null;
for(let c=601;c<=606;c++)$('teacher-class').add(new Option(c+'班',String(c)));
const date=v=>v?new Date(v).toLocaleTimeString('zh-CN',{hour12:false}):'未进入';
const count=s=>(s.awards||[]).length;
function phase(s,id){if(s.awards.some(a=>a.stage===id))return '已完成';return s.records[id]?.first?'进行中':'未开始';}
function current(s){const next=R.stages.find(t=>!s.awards.some(a=>a.stage===t.id));return !s.updated?'未进入':next?.name||'主线已完成';}
async function refresh(){
 if(!auth)return;
 const classId=$('teacher-class').value,request=++requestNumber;
 if(data?.classId!==classId){data=null;clearClassView();$('class-status').textContent=classId+'班数据加载中…';}
 try{
  const incoming=await api('/api/teacher/class?class='+classId);
  if(request!==requestNumber||classId!==$('teacher-class').value)return;
  const stats=summarizeClass(incoming,R.stages);
  const priorClass=data?.classId,priorRound=data?.round,priorStudents=data&&JSON.stringify(data.students);
  data=incoming;
  $('class-status').textContent=`${classId}班 · ${data.round} · 最近拉取 ${date(data.at)} · 每5秒更新；各图分母见图内说明`;
  $('class-status').className='note';
  if(priorClass!==classId||priorRound!==incoming.round||priorStudents!==JSON.stringify(incoming.students))render(stats);
 }catch(e){
  if(request!==requestNumber)return;
  if(data?.classId!==classId){data=null;clearClassView();}
  $('class-status').textContent=classId+'班更新失败：'+e.message+'。画面未作为实时数据使用。';
  $('class-status').className='warning';

 }
}
function clearClassView(){for(const id of ['summary','status-chart','stage-chart','evidence-chart','student-rows','diagnosis','stage-counts'])$(id).replaceChildren();$('student-detail').hidden=true;$('chart-filter').textContent='';}

function render(stats=summarizeClass(data,R.stages)){const ss=data.students,N=stats.total,entered=stats.entered,done=stats.status.complete;$('summary').innerHTML=[['班级人数',N],['已进入',entered],['未进入',N-entered],['进行中',entered-done],['完成主线',done]].map(([t,n])=>'<div>'+t+'<b>'+n+'</b></div>').join('');const charts=renderClassCharts(stats,{statusFilter:chartStatus,stageFilter:chartStage});$('status-chart').innerHTML=charts.statusHtml;$('stage-chart').innerHTML=charts.stageHtml;$('evidence-chart').innerHTML=charts.evidenceHtml;bindChartFilters();const q=$('teacher-search').value.trim(),filtered=ss.filter(s=>s.student.name.includes(q)&&(!$('unfinished').checked||count(s)<4)&&(!chartStatus||(chartStatus==='notEntered'?!s.updated:chartStatus==='complete'?count(s)===4:Boolean(s.updated)&&count(s)<4))&&(!chartStage||!s.awards.some(a=>a.stage===chartStage)));if(selected&&!filtered.some(s=>s.student.id===selected)){selected=null;$('student-detail').hidden=true;}$('chart-filter').innerHTML=(chartStatus||chartStage)?`学生明细显示 ${filtered.length}/${N} 人 · ${chartStatus?{notEntered:'未进入',inProgress:'进行中',complete:'完成主线'}[chartStatus]:''} ${chartStage?'· '+R.stages.find(t=>t.id===chartStage).name+'未完成':''} <button id="clear-chart-filter" type="button">清除图表筛选</button>`:`学生明细显示 ${filtered.length}/${N} 人；姓名查找和“只看未完成”仅筛选明细，图表仍按全班统计。`;const clear=$('clear-chart-filter');if(clear)clear.onclick=()=>{chartStatus=null;chartStage=null;render();};$('student-rows').innerHTML=filtered.map(s=>`<tr><td>${escape(s.student.name)} ${s.student.manual?'<span class="tag">手动</span>':''}</td><td>${current(s)}</td>${R.stages.map(t=>'<td>'+phase(s,t.id)+'</td>').join('')}<td>${count(s)}/4 · ${count(s)*25}%</td><td>${s.points}</td><td>${s.quizAttempts[0]?.score??'未答'} / ${s.quizAttempts.at(-1)?.score??'未答'}</td><td>${date(s.updated)}</td><td><button data-student="${escape(s.student.id)}">查看证据</button></td></tr>`).join('')||'<tr><td colspan="11">没有符合条件的学生。</td></tr>';$('student-rows').querySelectorAll('button').forEach(b=>b.onclick=()=>{selected=b.dataset.student;detail();});if(selected)detail();diagnosis();}
function bindChartFilters(){document.querySelectorAll('[data-chart-status]').forEach(button=>button.onclick=()=>{chartStatus=chartStatus===button.dataset.chartStatus?null:button.dataset.chartStatus;render();});document.querySelectorAll('[data-chart-stage]').forEach(button=>button.onclick=()=>{chartStage=chartStage===button.dataset.chartStage?null:button.dataset.chartStage;render();});}
function diagnosis(){const ss=data.students;const paragraphs=R.stages.map(t=>{const answered=ss.filter(s=>s.records[t.id]?.lastSubmitted),first=answered.filter(s=>s.records[t.id].firstSubmitted?.assessment?.pass),recent=answered.filter(s=>s.records[t.id].lastSubmitted.assessment?.pass);const errors={};for(const s of answered)for(const err of s.records[t.id].lastSubmitted.assessment?.errors||[])errors[err]=(errors[err]||0)+1;const top=Object.entries(errors).sort((a,b)=>b[1]-a[1])[0];return `<p><b>${t.name}</b> · 已提交 ${answered.length}，未提交 ${ss.length-answered.length}；首次通过 ${first.length}/${answered.length}，最近通过 ${recent.length}/${answered.length}。${answered.length===0?'尚无可判断的提交证据。':top?'常见卡点：'+escape(top[0])+'（'+top[1]+'人）。':'已提交记录暂无共同卡点。'}</p>`;});$('diagnosis').innerHTML='<h2>看到证据，再决定怎样支持</h2>'+paragraphs.join('')+'<p class="note">可选一份匿名错图，请学生区分信息与设备，再用新案例检验。未答不计为错误；完成与积分不能代替理解证据。</p>';}
function detail(){const s=data.students.find(s=>s.student.id===selected);if(!s)return;$('student-detail').hidden=false;$('student-detail').innerHTML=`<h2>${escape(s.student.name)}的过程证据</h2><p>${s.student.classId}班 · ${data.round} · ${s.points}通关积分 · 旧轮次 ${s.roundHistory?.length||0}份</p>${R.stages.map(t=>{const v=s.records[t.id],last=v?.latest,submittedLast=v?.lastSubmitted,firstSubmitted=v?.firstSubmitted;return `<details><summary>${t.name} · ${phase(s,t.id)}</summary><p>首次预测：${escape(v?.first?.prediction||'尚无证据')}；首次提交：${firstSubmitted?.assessment?.pass?'符合目标':firstSubmitted?'需修订':'尚无证据'}；最近提交：${submittedLast?(submittedLast.assessment?.pass?'符合目标':'需修订'):'尚未提交'}</p><p>提示 ${escape(last?.hints||0)} 次。最近声音来源：${escape([...new Set((last?.trials||[]).map(t=>t.source).filter(Boolean))].map(x=>({simulation:'模拟',microphone:'本机实测',teacher:'教师实测观察',keyboard:'亲自输入'}[x]||x)).join('、')||'本关不涉及声音')}</p><pre>${escape(JSON.stringify({首次:v?.first,最近:last},null,2))}</pre></details>`;}).join('')}<details><summary>考核：首次与最近表现</summary><p>首次 ${s.quizAttempts[0]?.score??'未答'}，最近 ${s.quizAttempts.at(-1)?.score??'未答'}；共 ${s.quizAttempts.length} 次。</p><pre>${escape(JSON.stringify(s.quizAttempts.at(-1)?.feedback||[],null,2))}</pre></details><details><summary>查看保留的旧轮次</summary><pre>${escape(JSON.stringify(s.roundHistory||[],null,2))}</pre></details><button id="detail-close">收起详情</button>`;$('detail-close').onclick=()=>{selected=null;$('student-detail').hidden=true;};}
async function enter(){auth=true;if(!window.isSecureContext){const context=await api('/api/teacher/microphone-context');microphoneBridge=new TeacherMicrophoneBridge({microphoneUrl:context.microphoneUrl,...microphoneCallbacks});}$('test-link').hidden=false;await refresh();if(!teacherScene){teacherScene=new CampusScene($('teacher-scene'));await teacherScene.init();teacherScene.setStage('sound');teacherScene.setState({lamp:false,level:0});}}

$('teacher-class').onchange=()=>{selected=null;chartStatus=null;chartStage=null;$('student-detail').hidden=true;refresh();};$('teacher-search').oninput=()=>data&&render();$('unfinished').onchange=()=>data&&render();$('class-export').onclick=()=>data&&download('第4课-'+data.classId+'-'+data.round+'.json',data);
$('new-round').onclick=async()=>{if(!confirm('为'+data.classId+'班开启新轮次？已保存的旧轮次会保留，当前积分与主线重新开始。'))return;try{await api('/api/teacher/new-round',{classId:data.classId});await refresh();}catch(e){$('class-status').textContent=e.message;}};
const microphoneCallbacks={onSample:s=>{level=s.level;sampleAt=Date.now();},onStatus:s=>{active=s.state==='listening';if(!active)level=0;$('teacher-mic-status').textContent=s.message;if(auth&&teacherScene)share();}};
const mic=new Microphone(microphoneCallbacks);
$('teacher-mic-start').onclick=()=>{sound=R.newSound();if(microphoneBridge)microphoneBridge.start();else mic.start();};$('teacher-mic-stop').onclick=()=>{if(microphoneBridge)microphoneBridge.stop();else mic.stop();level=0;active=false;sound=R.newSound();share();};$('teacher-mic-calibrate').onclick=()=>{if(microphoneBridge)microphoneBridge.calibrate();else mic.calibrate();};$('teacher-2d').onclick=()=>{mode=mode==='3d'?'2d':'3d';teacherScene.setMode(mode);};
setInterval(()=>{if(!teacherScene)return;if(Date.now()-sampleAt>1000)level=0;sound=R.stepSound(sound,active?level:0,Date.now());teacherScene.setState({lamp:sound.lamp,level});},60);
async function share(){if(!auth||sharing)return;sharing=true;try{await api('/api/teacher/live',{level:active?level:0,lamp:sound.lamp,active,triggerCount:sound.triggerCount});$('teacher-live-sync').textContent=(active?'现场事件已共享给学生':'当前没有正在采声')+' · '+new Date().toLocaleTimeString();}catch(e){$('teacher-live-sync').textContent='现场事件未同步：'+e.message;}finally{sharing=false;}}
setInterval(()=>{if(active)share();},350);setInterval(refresh,5000);

window.addEventListener('pagehide',()=>{microphoneBridge?.stop();mic.stop();});
enter().catch(e=>{$('class-status').textContent='教师大屏打开失败：'+e.message;});
