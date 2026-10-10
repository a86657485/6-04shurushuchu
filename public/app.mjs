import {CampusScene} from './scene.mjs?v=1';
import {Microphone} from './microphone.mjs?v=3';
import {TeacherMicrophoneBridge} from './microphone-bridge.mjs?v=2';
import {readSharedLight} from './shared-light.mjs?v=3';
import {ClassroomSync,api,download,escape,uniqueId} from './sync.mjs?v=1';
import {activities,sceneObservations} from './activities.mjs?v=2';
import {chooseHintTarget} from './hint-guide.mjs?v=3';
import {renderProcessFlow} from './process-flow.mjs?v=4';
import {QuizView} from './quiz.mjs?v=6';
import {RobotTrial} from './robot-trial.mjs?v=1';
import {renderStageReference,renderExamReference} from './teacher-test-guide.mjs?v=4';
import {learningProgress,nextExperimentAction,newAutomaticObservation} from './student-journey.mjs?v=2';
const $=id=>document.getElementById(id),R=window.LessonRules;
const mode=location.pathname==='/test'?'test':location.pathname==='/demo'?'demo':'student';
let state,stage='road',drafts={},scene,welcomeScene,quiz,testExamples,hintCount=0,signal='red',action='stop',sound=R.newSound(),soundLevel=0,source='simulation',micListening=false,live=null,door={until:0,doorOpen:false,personX:.1},textInput='',textOutput='',submittedOnce=false,robotTrial=null,activeDiagramPart='input',guideActive=false,hintBaseText='',observationPending=false;
let learningStep='predict',experimentActivated=false,soundPulse=null,diagramEditing=true,microphoneBridge=null,microphoneRouteReady=window.isSecureContext,microphoneRouteRequested=false,microphoneRouteError='';
const sync=new ClassroomSync((message,pending)=>{$('sync-status').textContent=message;$('sync-status').className=pending?'warning':'';},s=>{state=s;refreshNav();});
function toast(message){$('toast').textContent=message;$('toast').hidden=false;setTimeout(()=>$('toast').hidden=true,4000);}
function storageKey(){return 'lesson4-drafts:'+state.student.id+':'+state.round;}
function draft(){const r=drafts[stage]||{};r.prediction||='';r.trials=Array.isArray(r.trials)?r.trials:[];r.diagram={input:'',compute:'',output:'',...r.diagram};r.transfer||='';r.hints||=0;r.submitted=r.submitted===true;return drafts[stage]=r;}
function persist(send=true){const d=draft();d.editedAt=Date.now();try{if(mode==='student')localStorage.setItem(storageKey(),JSON.stringify(drafts));}catch{toast('本机存储不足，请保存学习报告');}if(send&&mode==='student')sync.enqueue(stage,d);}
function changed(){draft().submitted=false;$('feedback').textContent='';persist();renderJourney();refreshGuide();}
function setPrediction(value){const d=draft();if(d.prediction)return;d.prediction=value;persist();learningStep='experiment';renderPrediction();renderJourney();refreshGuide();scrollLearningTask();}
function scrollLearningTask(){if(innerWidth<=760)(learningStep==='experiment'?$('experiment-actions'):document.querySelector('.journey-panel')).scrollIntoView({block:'start'});}
function journeyProgress(){return learningProgress(draft(),R.experimentChecks(stage,draft()));}
function setLearningStep(step){const progress=journeyProgress();if(step==='experiment'&&!draft().prediction||step==='explain'&&!progress.experimentDone)return;learningStep=step;renderJourney();refreshGuide();scrollLearningTask();}
function renderJourney(){
 const d=draft(),p=journeyProgress(),checks=R.experimentChecks(stage,d),passed=d.submitted&&R.assess(stage,d).pass;
 const steps=[['predict','先想一想'],['experiment','做实验'],['explain','搭流程图']];
 $('learning-steps').innerHTML=steps.map(([id,label],i)=>`<button data-learning-step="${id}" aria-current="${learningStep===id?'step':'false'}" ${id==='experiment'&&!d.prediction||id==='explain'&&!p.experimentDone?'disabled':''}><span>${i+1}</span>${label}</button>`).join('');
 $('learning-steps').querySelectorAll('button').forEach(button=>button.onclick=()=>setLearningStep(button.dataset.learningStep));
 $('stage-page').dataset.learningStep=learningStep;
 $('learning-step-label').textContent='第 '+(steps.findIndex(([id])=>id===learningStep)+1)+' 步 / 3';
 $('learning-step-title').textContent={predict:'先选一个预测',experiment:stage==='text'?'完成一次汉字输入':'操作一次，再换个条件',explain:'用流程图说清楚'}[learningStep];
 $('learning-step-instruction').textContent={predict:'选好后，页面会带你开始实验。预测错了也可以继续。',experiment:stage==='text'?'用中文输入法输入一个词，再点“完成输入”。':'点击左侧标出的操作，两种结果会自动保存。',explain:'选好三个流程节点，再判断一个新条件。'}[learningStep];
 if(learningStep==='predict'&&d.prediction)$('learning-step-instruction').textContent='这是你最初的预测，已经保留。点击下方按钮回到实验。';
 $('prediction-panel').hidden=learningStep!=='predict';
 $('experiment-actions').hidden=learningStep==='predict';
 $('experiment-progress').hidden=learningStep!=='experiment';
 $('experiment-progress').innerHTML='<div class="experiment-checks">'+checks.map(c=>`<div class="experiment-check ${c.complete?'complete':''}"><span>${c.complete?'✓':'○'}</span><b>${c.label}</b><small>${c.complete?'已自动保存':'等待实验'}</small></div>`).join('')+'</div>';
 $('trial-details').hidden=learningStep!=='experiment'||!d.trials.length;
 $('scene-context').hidden=learningStep!=='predict';if(learningStep!=='predict'){$('story').hidden=true;$('story-open').hidden=false;}
 $('trial-summary').textContent='查看已保存的 '+d.trials.length+' 次结果';
 $('explain-panel').hidden=learningStep!=='explain';
 $('transfer').hidden=!p.diagramDone||diagramEditing;
 $('step-next').hidden=learningStep==='explain'||learningStep==='predict'&&!d.prediction;
 $('step-next').disabled=learningStep==='experiment'&&!p.experimentDone;
 $('step-next').textContent=learningStep==='predict'?'开始实验 →':p.experimentDone?'实验已记好，搭流程图 →':'先完成上面的实验';
 $('submit').hidden=learningStep!=='explain'||passed;
 $('submit').disabled=!p.readyToSubmit||diagramEditing;
 $('submit').textContent=p.readyToSubmit?'检验我的解释 →':'选完流程图和新条件判断';
 $('next').hidden=learningStep!=='explain'||!passed;
 $('next').textContent=stage==='door'?'四关完成，查看学习报告 →':'本关完成，进入下一站 →';
 $('step-back').hidden=learningStep==='predict';
 $('step-back').textContent=learningStep==='experiment'?'回看我的预测':'返回实验看看';
 if(passed){$('feedback').className='feedback success';$('feedback').textContent='操作和解释都已通过。点击下方按钮进入下一站。';}
}
function refreshGuide(){
 document.querySelectorAll('.guided-next,.current-control').forEach(el=>el.classList.remove('guided-next','current-control'));
 if($('stage-page').hidden)return;
 const d=draft(),checks=R.experimentChecks(stage,d),reviewErrors=submittedOnce?R.assess(stage,{...d,submitted:true}).errors:[];
 let target;
 if(learningStep==='predict')target={selector:'#prediction-panel .choice-row',label:'选择一个预测'};
 else if(learningStep==='experiment'){
  target=nextExperimentAction(stage,checks,{signal,source,micListening,liveActive:readSharedLight(live).fresh,hasTextOutput:/[\u3400-\u9fff]/.test(textOutput)});
  if(stage==='sound'&&source==='simulation'&&experimentActivated&&soundLevel<=.35&&sound.lamp&&!checks[0].complete)target={selector:null,instruction:'灯仍在延时保持。熄灭后，页面会自动保存安静时的结果。'};
  if(stage==='door'&&observationPending&&door.personX<.65&&door.doorOpen)target={selector:null,instruction:'人物已离开，门正在延时关闭。关闭后结果会自动保存。'};
  $('experiment-instruction').textContent=target.instruction;
 }else{
  target=chooseHintTarget(stage,d,{checks,reviewErrors,passed:!$('next').hidden});
  if(diagramEditing){target={selector:'.flow-choices',label:'为'+{input:'输入',compute:'计算',output:'输出'}[activeDiagramPart]+'选择一张词卡'};$('learning-step-instruction').textContent='现在为「'+{input:'输入',compute:'计算',output:'输出'}[activeDiagramPart]+'」选词卡。选好后，页面会转到下一个节点。';}
  $('experiment-instruction').textContent='需要核对结果时，可以继续操作或点击右侧“返回实验看看”。';
 }
 const el=target?.selector&&document.querySelector(target.selector);
 if(el&&!el.disabled&&!el.closest('[hidden]'))el.classList.add(guideActive?'guided-next':'current-control');
 $('hint-text').textContent=guideActive?hintBaseText+(target?.instruction?' 操作：'+target.instruction:target?.label?' 下一步：'+target.label+'。':''):'';
}
function renderScenePhoto(){
 const photo=$('scene-photo'),large=$('scene-photo-large'),button=$('scene-photo-button');
 const src='/assets/scenes/'+stage+'.jpg',description=stage==='road'?'校园路口交通信号与行人':stage==='sound'?'校园楼道里的声控灯':stage==='text'?'键盘输入与屏幕显示': '校园入口的自动门';
 button.hidden=false;photo.alt=description+'的AI生成情境示意图';large.alt=photo.alt;photo.src=src;large.src=src;
 $('scene-observation').textContent=sceneObservations[stage];$('scene-photo-caption').textContent='情境示意图 · AI生成。'+sceneObservations[stage];
 photo.onerror=()=>{button.hidden=true;};
}
function renderPrediction(){const a=activities[stage],d=draft();$('prediction-panel').innerHTML=`<div class="prediction"><b>先留下一次预测</b><p>${a.question}</p><div class="choice-row">${a.predict.map(([v,t])=>`<button data-predict="${v}" ${d.prediction?'disabled':''} class="${d.prediction===v?'selected':''}">${t}</button>`).join('')}</div><small>${d.prediction?'首次预测已保留。实验结果不同时，可以修订解释。':'选好后再实验；预测错误也可以继续探索。'}</small></div>`;$('prediction-panel').querySelectorAll('button').forEach(b=>b.onclick=()=>setPrediction(b.dataset.predict));}
function refreshNav(){if(!state)return;const earned=new Set((state.awards||[]).map(a=>a.stage));$('identity').textContent=state.student.classId+'班 · '+state.student.name+(mode!=='student'?'（隔离演示）':'');$('points').textContent=(state.points||0)+' 通关积分';$('stages').innerHTML=R.stages.map((s,i)=>`<button data-stage="${s.id}" class="${s.id===stage?'active':''} ${earned.has(s.id)?'done':''}" ${mode==='student'&&i>0&&!earned.has(R.stages[i-1].id)?'disabled':''}>${i+1} ${s.name}</button>`).join('')+'<button data-stage="quiz">20题考核</button><button data-stage="report">我的报告</button>';$('stages').querySelectorAll('button').forEach(b=>b.onclick=()=>navigate(b.dataset.stage));}
async function enter(s){state=s;prepareMicrophoneRoute();$('login').hidden=true;$('learning').hidden=false;$('switch').hidden=mode!=='student';$('export').hidden=false;welcomeScene?.destroy();welcomeScene=null;drafts={};if(mode==='student'){try{drafts=JSON.parse(localStorage.getItem(storageKey())||'{}');}catch{}for(const [k,v] of Object.entries(s.records||{})){const latest=v.latest;if(latest&&(!drafts[k]||(latest.editedAt||new Date(latest.created).getTime())>(drafts[k].editedAt||0)))drafts[k]=structuredClone(latest.record||latest);}sync.attach(s);for(const e of sync.queue||[]){if(e.stage&&e.record&&(!drafts[e.stage]||(e.record.editedAt||0)>(drafts[e.stage].editedAt||0)))drafts[e.stage]=structuredClone(e.record);}}else{$('test-tools').hidden=mode!=='test';$('sync-status').textContent=mode==='test'?'测试记录独立，不进入班级统计':'演示状态，不进入班级统计';}
 scene=new CampusScene($('scene'));await scene.init();stage=R.stages.find(s=>!sHas(s.id))?.id||'door';renderStage();quiz=new QuizView($('quiz-page'),{getState:()=>state,mode,examples:testExamples,onState:s=>{state=s;refreshNav();},onExit:()=>navigate(stage)});refreshNav();}
function sHas(id){return (state.awards||[]).some(a=>a.stage===id);}
function navigate(id){robotTrial?.destroy();robotTrial=null;stopMicrophone();if(mode==='test')$('test-answer-panel').hidden=true;if(id==='quiz'){$('stage-page').hidden=true;$('end-page').hidden=true;$('quiz-page').hidden=false;quiz.open();return;}if(id==='reward'&&mode==='test'){$('stage-page').hidden=true;$('end-page').hidden=true;$('quiz-page').hidden=false;quiz.previewReward();return;}quiz?.close();if(id==='report')return report();$('stage-page').hidden=false;$('end-page').hidden=true;$('quiz-page').hidden=true;stage=id;renderStage();refreshNav();}
function renderStage(){
 stopMicrophone();clearTimeout(soundPulse);hintCount=draft().hints||0;submittedOnce=draft().submitted;guideActive=false;hintBaseText='';observationPending=false;experimentActivated=false;
 sound=R.newSound();soundLevel=0;source='simulation';door={until:0,doorOpen:false,personX:.1};textInput='';textOutput='';signal='red';action='stop';live=null;
 learningStep=journeyProgress().initialStep;diagramEditing=!journeyProgress().diagramDone;activeDiagramPart=['input','compute','output'].find(part=>!draft().diagram[part])||'input';
 const a=activities[stage];$('chapter').textContent='第'+(R.stages.findIndex(s=>s.id===stage)+1)+'站 / 4 · 本关10积分';$('stage-title').textContent=a.title;$('stage-goal').textContent=a.goal;$('story-text').textContent=a.story;$('scene-note').textContent=a.note;renderScenePhoto();$('story').hidden=true;$('story-open').hidden=false;$('feedback').textContent='';$('hint-text').textContent='';
 scene.setStage(stage);scene.onInteract=event=>{
  if(!draft().prediction){toast('先在右侧选一个预测，再开始实验');return;}
  if(event.type==='position'&&stage==='door'){door=R.stepDoor(door,event.personX,Date.now());observationPending=true;const slider=$('person-x');if(slider)slider.value=event.personX*100;updateScene();autoRecordObservation();refreshGuide();}
  else if(event.type==='toggleSignal'&&stage==='road')$(signal==='red'?'green':'red').click();
  else if(event.type==='requestSound'){if(source==='simulation')$('loud')?.click();else toast('现场实验请使用下方麦克风控件。');}
  else if(event.type==='focusText')$('hanzi-input')?.focus();
 };
 renderPrediction();renderControls();renderTrials();renderDiagram();renderTransfer();renderJourney();updateScene();refreshGuide();
}
function orderedOptions(opts,key){let n=0;for(const c of state.student.id+stage+key)n=(n+c.charCodeAt(0))%3;return [...opts.slice(n),...opts.slice(0,n)];}
function renderDiagram(){
 const a=activities[stage],d=draft();
 $('diagram').innerHTML=renderProcessFlow(a.diagram,d.diagram,activeDiagramPart,orderedOptions);$('flow-options').hidden=!diagramEditing;
 for(const part of ['input','compute','output']){
  $(`diagram-${part}`).onclick=()=>{
   activeDiagramPart=part;diagramEditing=true;
   renderJourney();renderDiagram();
   refreshGuide();
   $(`diagram-${part}`).focus();
  };
 }
 $('diagram').querySelectorAll('[data-flow-value]').forEach(button=>{
  button.onclick=()=>{
   const part=activeDiagramPart,value=button.dataset.flowValue;
   if(!a.diagram[part].some(([candidate])=>candidate===value))return;
   draft().diagram[part]=value;diagramEditing=!['input','compute','output'].every(step=>!!draft().diagram[step]);
   changed();
   activeDiagramPart=['input','compute','output'].find(step=>!draft().diagram[step])||part;
   renderDiagram();
   refreshGuide();
   $(`diagram-${activeDiagramPart}`).focus();
  };
 });
}
function renderTransfer(){const a=activities[stage],d=draft();$('transfer').innerHTML=`<h3>换个条件，再想一想</h3><p>${a.transferQuestion}</p><div id="transfer-choice" class="transfer-choices">${orderedOptions(a.transfer,'transfer').map(([v,t])=>`<button data-transfer="${v}" aria-pressed="${d.transfer===v}" class="${d.transfer===v?'selected':''}">${t}</button>`).join('')}</div>`;$('transfer').querySelectorAll('button').forEach(button=>button.onclick=()=>{draft().transfer=button.dataset.transfer;changed();renderTransfer();refreshGuide();});}
function renderControls(){
 let html='';
 if(stage==='road')html='<div class="control-row"><button id="red" class="primary">观察红灯</button><button id="green">观察绿灯</button></div>';
 if(stage==='sound')html='<div id="sim-buttons" class="control-row"><button id="quiet" class="primary">测试安静</button><button id="loud">发出明显声音</button></div><details id="sound-settings" class="sound-settings"><summary>选用现场麦克风 / 观察教师</summary><label>声音来源<select id="sound-source"><option value="simulation">模拟声音 · 独立实验</option><option value="microphone">本机麦克风 · 实测</option><option value="teacher">观察教师现场实测</option></select></label><div id="mic-controls" hidden><button id="mic-start">开启麦克风</button><button id="mic-stop">停止采声</button><button id="mic-calibrate">重新校准</button></div></details><div class="sound-meter"><i id="meter-fill"></i></div><small id="mic-message">点击声音按钮，页面自动保存结果</small>';
 if(stage==='text')html='<div class="text-controls"><input type="text" id="hanzi-input" aria-label="输入汉字" placeholder="用中文输入法输入一个词"><button id="capture-text" class="primary">完成输入</button></div><details class="sound-settings"><summary>电脑没有中文输入法？</summary><button id="simulate-text">模拟“xiaoyuan → 校园”</button></details>';
 if(stage==='door')html='<div class="control-row"><button id="far" class="primary">人物回到远处</button><button id="near">人物靠近门口</button></div><details class="sound-settings"><summary>自己移动人物，观察检测区</summary><label>人物位置<input type="range" id="person-x" aria-label="来访者位置" min="0" max="100" value="10"></label></details>';
 $('controls').innerHTML=html;
 if(stage==='road'){
  $('red').onclick=()=>{signal='red';action='stop';updateScene();addTrial();};
  $('green').onclick=()=>{signal='green';action='check';updateScene();addTrial();};
 }
 if(stage==='sound'){
  $('sound-source').onchange=e=>{clearTimeout(soundPulse);stopMicrophone();source=e.target.value;sound=R.newSound();soundLevel=0;experimentActivated=false;$('sim-buttons').hidden=source!=='simulation';$('mic-controls').hidden=source!=='microphone';$('mic-message').textContent=source==='teacher'?'等待教师现场实验':'当前选择：'+(source==='simulation'?'模拟声音':'本机麦克风');refreshGuide();};
  $('quiet').onclick=()=>{clearTimeout(soundPulse);experimentActivated=true;soundLevel=0;sound=R.stepSound(sound,0,Date.now());updateScene();autoRecordObservation();refreshGuide();};
  $('loud').onclick=()=>{clearTimeout(soundPulse);experimentActivated=true;soundLevel=.9;sound=R.stepSound(sound,soundLevel,Date.now());updateScene();autoRecordObservation();refreshGuide();soundPulse=setTimeout(()=>{if(stage==='sound'&&source==='simulation'){soundLevel=0;updateScene();refreshGuide();}},350);};
  $('mic-start').disabled=!microphoneRouteReady;$('mic-start').onclick=startMicrophone;$('mic-stop').onclick=()=>{stopMicrophone();soundLevel=0;refreshGuide();};$('mic-calibrate').onclick=()=>{if(microphoneBridge)microphoneBridge.calibrate();else mic.calibrate();};
 }
 if(stage==='text'){
  let composing=false;$('hanzi-input').oncompositionstart=()=>composing=true;$('hanzi-input').oncompositionend=e=>{composing=false;source='keyboard';textOutput=e.target.value;updateScene();refreshGuide();};
  $('hanzi-input').oninput=e=>{if(!composing){source='keyboard';textOutput=e.target.value;updateScene();refreshGuide();}};$('hanzi-input').onkeydown=e=>{if(e.key.length===1||e.key==='Backspace')textInput=(textInput+e.key).slice(-200);};
  $('capture-text').onclick=()=>{textOutput=$('hanzi-input').value;textInput=textInput||textOutput;addTrial();};
  $('simulate-text').onclick=()=>{textInput='xiaoyuan';textOutput='校园';$('hanzi-input').value=textOutput;source='simulation';updateScene();addTrial();};
 }
 if(stage==='door'){
  const move=x=>{door=R.stepDoor(door,x,Date.now());observationPending=true;$('person-x').value=x*100;updateScene();autoRecordObservation();refreshGuide();};
  $('person-x').oninput=e=>move(Number(e.target.value)/100);$('far').onclick=()=>move(.1);$('near').onclick=()=>move(.85);
 }
}
const microphoneCallbacks={onSample:s=>{soundLevel=s.level;},onStatus:s=>{micListening=s.state==='listening';const el=$('mic-message');if(el)el.textContent=s.message;if(['stopped','error'].includes(s.state))soundLevel=0;refreshGuide();}};
const mic=new Microphone(microphoneCallbacks);
async function prepareMicrophoneRoute(){
 if(window.isSecureContext||microphoneRouteRequested)return;
 microphoneRouteRequested=true;microphoneRouteReady=false;
 try{const context=await api('/api/teacher/microphone-context');microphoneBridge=new TeacherMicrophoneBridge({microphoneUrl:context.microphoneUrl,...microphoneCallbacks});}catch(error){if(error.status!==403)microphoneRouteError='麦克风窗口未连接，请刷新页面后重试。';}
 finally{microphoneRouteReady=true;const button=$('mic-start');if(button)button.disabled=false;}
}
function startMicrophone(){
 if(!microphoneRouteReady)return;
 if(microphoneBridge)microphoneBridge.start();
 else if(window.isSecureContext)mic.start();
 else $('mic-message').textContent=microphoneRouteError||'请选择“观察教师现场实测”或“模拟声音”。';
}
function stopMicrophone(){microphoneBridge?.stop();mic.stop();}
function updateScene(){
 if(!scene)return;
 const shared=readSharedLight(live);
 scene.setState({
  lamp:source==='teacher'?shared.lamp:sound.lamp,
  level:source==='teacher'?shared.level:soundLevel,
  doorOpen:door.doorOpen,personX:door.personX,signal,
  moving:signal==='green'&&action==='check',text:textOutput
 });
 let message='';
 if(stage==='road')message='信号：'+(signal==='red'?'红灯':'绿灯')+' · 行人：'+(action==='stop'?'停下等待':'观察路况后通行');
 if(stage==='sound'){
  message=(source==='simulation'?'模拟声音':source==='microphone'?'本机实测':'教师实测观察')+' · '+((source==='teacher'?shared.lamp:sound.lamp)?'灯亮':'灯不亮');
  if(source==='teacher'){
   if(!shared.fresh)message='教师采声已停止或尚未连接，不能记录为现场结果';
   const status=$('mic-message');
   if(status)status.textContent=shared.fresh?'教师现场实测已同步；只观察共享状态':'等待教师现场实验；只观察共享状态';
  }
  const meter=$('meter-fill');
  if(meter)meter.style.width=((source==='teacher'?shared.level:soundLevel)*100)+'%';
 }
 if(stage==='text')message='屏幕显示：'+(textOutput||'等待输入汉字');
 if(stage==='door')message='来访者：'+(door.personX>=.65?'在检测区':'在检测区外')+' · 门：'+(door.doorOpen?'打开':'关闭');
 $('live-status').textContent=message;
}
setInterval(()=>{if(!scene||$('stage-page').hidden)return;const now=Date.now();if(stage==='sound'&&source!=='teacher')sound=R.stepSound(sound,soundLevel,now);if(stage==='door')door=R.stepDoor(door,door.personX,now);updateScene();autoRecordObservation();},60);
setInterval(async()=>{if(stage!=='sound'||source!=='teacher'||!scene||$('stage-page').hidden)return;try{live={...await api('/api/live'),clientReceivedAt:Date.now()};updateScene();autoRecordObservation();}catch{live=null;updateScene();}},700);
function saveTrial(t){const d=draft();d.trials.push(t);d.trials=d.trials.slice(-30);observationPending=false;changed();renderTrials();}
function autoRecordObservation(){
 if(!state||!draft().prediction||learningStep!=='experiment')return;
 const d=draft();let observation;
 if(stage==='sound'){
  const shared=readSharedLight(live);
  observation={active:source==='teacher'?shared.fresh:source==='microphone'?micListening:experimentActivated,source,level:source==='teacher'?shared.level:soundLevel,lamp:source==='teacher'?shared.lamp:sound.lamp,at:Date.now()};
 }else if(stage==='door'&&observationPending)observation={x:door.personX,open:door.doorOpen,at:Date.now()};
 if(!observation)return;
 const record=newAutomaticObservation(stage,d.trials,observation);if(record)saveTrial(record);
}
function addTrial(){const d=draft();if(!d.prediction){toast('先留下首次预测');return;}let t;
 if(stage==='road')t={signal,action};
 if(stage==='sound'){const shared=readSharedLight(live);if(source==='teacher'&&!shared.fresh){toast('等待教师现场实验，或改用模拟声音');return;}if(source==='microphone'&&!micListening){toast('先开启麦克风并允许使用');return;}t={level:source==='teacher'?shared.level:soundLevel,lamp:source==='teacher'?shared.lamp:sound.lamp,source,at:Date.now()};}
 if(stage==='text'){if(!/[\u3400-\u9fff]/.test(textOutput)){toast('先用输入法选择汉字，再点击“完成输入”');return;}t={input:textInput||textOutput,output:textOutput,source};}
 if(stage==='door')t={x:door.personX,open:door.doorOpen,at:Date.now()};
 saveTrial(t);
}
function renderTrials(){const ts=draft().trials||[];$('trials').innerHTML=ts.length?ts.slice(-6).map(t=>'<p>'+escape(stage==='road'?(t.signal==='red'?'红灯':'绿灯')+' → '+(t.action==='stop'?'等待':'确认路况后通行'):stage==='sound'?({simulation:'模拟',microphone:'本机实测',teacher:'教师实测观察'}[t.source])+' · 相对强弱 '+Math.round(t.level*100)+' → '+(t.lamp?'亮':'不亮'):stage==='text'?'输入 '+t.input+' → '+t.output+'（'+(t.source==='keyboard'?'亲自输入':'模拟输入')+'）':(t.x>=.65?'检测区内':'检测区外')+' → '+(t.open?'开启':'关闭'))+'</p>').join(''):'<p>预测后操作，再记录。这里只保留关键结果。</p>';}
$('step-next').onclick=()=>setLearningStep(learningStep==='predict'?'experiment':'explain');
$('step-back').onclick=()=>setLearningStep(learningStep==='experiment'?'predict':'experiment');
$('submit').onclick=()=>{const d=draft();d.submitted=true;const result=R.assess(stage,d);submittedOnce=true;persist();if(result.pass&&mode!=='student'&&!sHas(stage)){state.awards.push({stage,points:10,created:Date.now()});state.points+=10;refreshNav();}renderJourney();$('feedback').className='feedback'+(result.pass?' success':'');$('feedback').textContent=result.pass?'实验和解释已通过。点击下方按钮继续。':result.errors[0];if(!result.pass){const wrongPart=['input','compute','output'].find(part=>d.diagram[part]!==R.goals[stage][part]);diagramEditing=!!wrongPart;activeDiagramPart=wrongPart||activeDiagramPart;renderJourney();renderDiagram();guideActive=true;hintBaseText='先检查标出的地方，再试一次。';}refreshGuide();};
$('next').onclick=async()=>{if(!draft().submitted||!R.assess(stage,draft()).pass)return;const i=R.stages.findIndex(s=>s.id===stage);if(mode==='student'&&!sHas(stage)){await sync.flush();if(!sHas(stage)){toast('先等待本关同步成功；离线时可导出记录');return;}}if(i<3)navigate(R.stages[i+1].id);else report();};
$('hint').onclick=()=>{const a=activities[stage];hintCount=Math.min(3,hintCount+1);draft().hints=hintCount;hintBaseText='提示 '+hintCount+'/3：'+a.hints[hintCount-1];guideActive=true;persist();refreshGuide();document.querySelector('.guided-next')?.scrollIntoView({behavior:'smooth',block:'nearest',inline:'nearest'});};
$('fresh').onclick=()=>{drafts[stage]={prediction:'',trials:[],diagram:{input:'',compute:'',output:''},transfer:'',submitted:false,hints:0};persist();stopMicrophone();renderStage();toast('已开启新尝试；此前提交和积分仍保留在报告中');};
$('story-close').onclick=()=>{$('story').hidden=true;$('story-open').hidden=false;};$('story-open').onclick=()=>{$('story').hidden=false;$('story-open').hidden=true;};
$('scene-photo-button').onclick=()=>{$('scene-photo-dialog').showModal();};
$('context-photo').onclick=()=>{$('scene-photo-dialog').showModal();};
$('scene-photo-close').onclick=()=>{$('scene-photo-dialog').close();($('scene-context').hidden?$('context-photo'):$('scene-photo-button')).focus();};
for(const [id,m] of [['mode-2d','2d'],['mode-3d','3d']])$(id).onclick=()=>{scene.setMode(m);$('mode-2d').setAttribute('aria-pressed',m==='2d');$('mode-3d').setAttribute('aria-pressed',m==='3d');};
$('fill-example').onclick=()=>{drafts[stage]=structuredClone((testExamples?.examples||R.examples)[stage]);drafts[stage].submitted=false;renderStage();$('feedback').className='feedback success';$('feedback').textContent='已载入标准路径，请点击检验确认';};$('test-reset').onclick=()=>{drafts={};state.awards=[];state.points=0;navigate('road');};
function showTestReference(html){const panel=$('test-answer-panel');panel.innerHTML=html;panel.hidden=false;$('test-guide-close').onclick=()=>{panel.hidden=true;$('test-tools').scrollIntoView({block:'start'});};panel.scrollIntoView({block:'start'});}
$('test-answer').onclick=()=>{if($('stage-page').hidden)navigate(stage);showTestReference(renderStageReference(stage,activities[stage],testExamples.examples[stage]));};
$('test-bank').onclick=()=>showTestReference(renderExamReference(testExamples.questions));
$('test-reward').onclick=()=>navigate('reward');
$('export').onclick=()=>download('第4课-'+state.student.classId+'-'+state.student.name+'.json',{app:'第4课 输入输出与计算',at:new Date().toISOString(),mode,state,drafts,pending:sync.queue||[],limits:'通关积分不是掌握度；首次、最近与考核分别解释。'});
$('switch').onclick=async()=>{stopMicrophone();persist();await sync.flush();if(sync.queue?.length)toast('未同步记录已留在本机原身份下，换回后继续补传');await api('/api/logout',{}).catch(()=>{});sync.detach();scene?.destroy();scene=null;$('learning').hidden=true;$('login').hidden=false;$('switch').hidden=true;$('export').hidden=true;state=null;$('identity').textContent='';await initWelcome();};
function report(){stopMicrophone();$('stage-page').hidden=true;$('quiz-page').hidden=true;$('end-page').hidden=false;const count=(state.awards||[]).length;$('end-page').innerHTML=`<div class="end-card"><p class="eyebrow">本课学习记录</p><h1>${count===4?'你已经走完校园探索主线':'每一次尝试，都可以留下证据'}</h1><p>必做完成 ${count}/4 · 通关积分 ${state.points||0} · 考核首次 ${state.quizAttempts?.[0]?.score??'尚未作答'} / 最近 ${state.quizAttempts?.at(-1)?.score??'尚未作答'}</p><p>你能否在新情境中说出输入的信息、计算的处理和输出的结果？</p><div class="choice-row"><button id="report-quiz" class="primary">${state.quizAttempts?.length?'查看最近考核 / 再考一次':'进入20题考核'}</button><button id="report-download">导出完整学习记录</button><button id="report-back">回到学习场景</button></div>${R.stages.map(s=>{const r=state.records?.[s.id];const current=drafts[s.id];return `<details><summary>${s.name} · ${sHas(s.id)?'主线已完成':current?'进行中':'未开始'}</summary><p>首次预测：${escape(r?.first?.record?.prediction||r?.first?.prediction||current?.prediction||'尚无证据')} · 最近解释：${r?.latest?.assessment?.pass?'已通过':current?.submitted&&R.assess(s.id,current).pass?'本机验证通过':'待检验'}</p><p>提示使用：${escape(current?.hints||0)}次；允许提示和试错，不扣积分。</p></details>`;}).join('')}<div class="optional"><h3>选做：小递的直行参数实验</h3><p>改变速度和运行时间，预测前进距离，再运行。输入参数、计算距离、输出运动状态。无需完成此项就能保存主线。</p><label>速度（模拟单位/秒）<input id="robot-speed" type="number" min="1" max="5" value="2"></label><label>运行时间（秒）<input id="robot-time" type="number" min="1" max="5" value="3"></label><button id="run-robot">运行参数方案</button><button id="pause-robot">暂停 / 继续</button><canvas id="robot-canvas" width="720" height="160" aria-label="2D机器人直行实验"></canvas><p id="robot-output"></p></div></div>`;$('report-quiz').onclick=()=>navigate('quiz');$('report-download').onclick=()=>$('export').click();$('report-back').onclick=()=>navigate(stage);robotTrial=new RobotTrial($('robot-canvas'),$('robot-output'));$('pause-robot').onclick=()=>robotTrial.pause();$('run-robot').onclick=()=>{const v=Math.min(5,Math.max(1,Number($('robot-speed').value)||1)),t=Math.min(5,Math.max(1,Number($('robot-time').value)||1));robotTrial.run(v,t);drafts.optional={speed:v,time:t,expected:R.robotDistance(v,t),at:Date.now()};};}async function initWelcome(){try{welcomeScene=new CampusScene($('welcome-art'));await welcomeScene.init();welcomeScene.setStage('sound');welcomeScene.setState({lamp:true,level:0});}catch{}}
const classSelect=$('class');for(let c=601;c<=606;c++)classSelect.add(new Option(c+'班',String(c)));let roster=[];
function filterNames(){const q=$('search').value.trim();$('name').innerHTML='<option value="">请选择你的姓名</option>';roster.filter(s=>s.name.includes(q)).forEach(s=>{const dup=roster.filter(x=>x.name===s.name).length>1;$('name').add(new Option(s.name+(s.manual?'（手动录入）':'')+(dup?' · 编号'+s.id.split('-').at(-1):''),s.id));});}
classSelect.onchange=async()=>{try{roster=await api('/api/roster?class='+classSelect.value);filterNames();$('login-error').textContent='';}catch(e){roster=[];filterNames();$('login-error').textContent=e.message;}};$('search').oninput=filterNames;$('manual').onchange=()=>{$('manual-box').hidden=!$('manual').checked;$('name').required=!$('manual').checked;};$('name').onchange=()=>{$('identity-confirm').textContent=classSelect.value+'班 · '+($('name').selectedOptions[0]?.text||'请选姓名')+'，确认是你本人后进入。';};
$('login-form').onsubmit=async e=>{e.preventDefault();const b=e.submitter;b.disabled=true;try{const s=await api('/api/login',$('manual').checked?{classId:classSelect.value,name:$('manual-name').value}:{classId:classSelect.value,id:$('name').value});await enter(s.student&&s.round?s:await api('/api/me'));}catch(err){$('login-error').textContent=err.message;if(err.data?.choices){roster=err.data.choices;filterNames();$('manual').checked=false;$('manual-box').hidden=true;$('name').required=true;}}finally{b.disabled=false;}};
window.addEventListener('pagehide',stopMicrophone);
async function boot(){if(mode==='test'){try{testExamples=await api('/api/teacher/answers');await enter({student:{id:'test',classId:'虚构',name:'测试观察员'},round:'test',records:{},awards:[],points:0,quizAttempts:[]});}catch{location.href='/teacher';}}else if(mode==='demo')await enter({student:{id:'demo',classId:'演示',name:'小观察员'},round:'demo',records:{},awards:[],points:0,quizAttempts:[]});else{try{await enter(await api('/api/me'));}catch{await initWelcome();}}}
boot().catch(e=>{$('login-error').textContent='页面加载出现问题：'+e.message;});
