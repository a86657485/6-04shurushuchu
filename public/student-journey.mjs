export function learningProgress(record,checks){
 const experimentDone=checks.length>0&&checks.every(c=>c.complete);
 const diagramDone=['input','compute','output'].every(part=>!!record.diagram?.[part]);
 return {experimentDone,diagramDone,initialStep:!record.prediction?'predict':!experimentDone?'experiment':'explain',readyToSubmit:!!record.prediction&&experimentDone&&diagramDone&&!!record.transfer};
}

export function nextExperimentAction(stage,checks,options={}){
 const missing=checks.find(c=>!c.complete);
 if(!missing)return {selector:'#step-next',instruction:'对照结果已记录。点击右侧“搭流程图”，解释系统怎样工作。'};
 if(stage==='road')return missing.id==='red'?{selector:'#red',instruction:'点击“观察红灯”，看看行人怎样反应；页面会自动保存结果。'}:{selector:'#green',instruction:'点击“观察绿灯”，比较这次行人的反应；页面会自动保存结果。'};
 if(stage==='sound'){
  if(options.source==='microphone')return !options.micListening?{selector:'#mic-start',instruction:'点击“开启麦克风”并允许使用，页面会自动记录安静和发声的状态。'}:{selector:null,instruction:missing.id==='quiet'?'保持安静，观察灯熄灭后的状态；页面会自动记录。':'正常说话或轻拍手，观察灯是否亮起；页面会自动记录。'};
  if(options.source==='teacher')return {selector:null,instruction:options.liveActive?'观察教师的安静与发声实验，页面会自动记录。':'等待教师在大屏开启现场实验；也可改用模拟声音。'};
  return missing.id==='quiet'?{selector:'#quiet',instruction:'点击“测试安静”，观察灯的状态；结果会自动记录。'}:{selector:'#loud',instruction:'点击“发出明显声音”，观察灯的变化；结果会自动记录。'};
 }
 if(stage==='text')return {selector:options.hasTextOutput?'#capture-text':'#hanzi-input',instruction:options.hasTextOutput?'点击“完成输入”，保存屏幕上显示的汉字。':'在下方输入框用中文输入法输入一个词，再点击“完成输入”。'};
 if(stage==='door')return missing.id==='far'?{selector:'#far',instruction:'点击“人物回到远处”，观察门的状态；关闭后会自动记录。'}:{selector:'#near',instruction:'点击“人物靠近门口”，观察门的变化；结果会自动记录。'};
 return {selector:null,instruction:''};
}

export function newAutomaticObservation(stage,trials,observation){
 if(stage==='sound'){
  const {source,level,lamp,active,at}=observation;
  if(!active||!['simulation','microphone','teacher'].includes(source)||!Number.isFinite(level)||level<0||level>1||typeof lamp!=='boolean')return null;
  const kind=level<=.35&&!lamp?'low':level>=.55&&lamp?'high':null;
  if(!kind||trials.some(t=>t.source===source&&(kind==='low'?t.level<=.35&&!t.lamp:t.level>=.55&&t.lamp)))return null;
  return {source,level,lamp,at};
 }
 if(stage==='door'){
  const {x,open,at}=observation;
  if(!Number.isFinite(x)||x<0||x>1||open!==(x>=.65))return null;
  if(trials.some(t=>x<.65?t.x<.65&&t.open===false:t.x>=.65&&t.open===true))return null;
  return {x,open,at};
 }
 return null;
}
