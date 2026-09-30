(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LessonRules=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const stages=[{id:'road',name:'红灯前的判断',points:10},{id:'sound',name:'楼道里的声控灯',points:10},{id:'text',name:'键盘里的汉字',points:10},{id:'door',name:'会感知的自动门',points:10}];
const goals={road:{input:'red',compute:'wait',output:'stop'},sound:{input:'sound',compute:'compare',output:'light'},text:{input:'keys',compute:'convert',output:'hanzi'},door:{input:'person',compute:'detect',output:'door'}};
const sources=['simulation','microphone','teacher','keyboard'];
function newSound(){return {lamp:false,until:0,aboveSince:null,armed:true,triggerCount:0,level:0};}
function stepSound(prev,level,now){const s={...prev,level:Math.max(0,Math.min(1,Number(level)||0))};if(s.level>=.55){if(s.aboveSince===null)s.aboveSince=now;if(s.level>=.8||now-s.aboveSince>=80){s.until=now+5000;if(s.armed){s.triggerCount++;s.armed=false;}}}else if(s.level<=.35){s.aboveSince=null;s.armed=true;}s.lamp=now<s.until;return s;}
function stepDoor(prev,x,now){const until=x>=.65?now+1500:prev.until||0;return {until,doorOpen:now<until,personX:Math.max(0,Math.min(1,x))};}
function experimentChecks(stage,record={}){
 const ts=Array.isArray(record.trials)?record.trials:[],check=(id,label,complete)=>({id,label,complete});
 if(stage==='road')return [check('red','观察红灯时的反应',ts.some(t=>t.signal==='red'&&t.action==='stop')),check('green','观察绿灯时的反应',ts.some(t=>t.signal==='green'&&t.action==='check'))];
 if(stage==='sound'){const valid=ts.filter(t=>sources.includes(t.source)&&Number.isFinite(t.level)&&t.level>=0&&t.level<=1&&typeof t.lamp==='boolean');return [check('quiet','安静时的灯状态',valid.some(t=>t.level<=.35&&!t.lamp)),check('sound','发声时的灯状态',valid.some(t=>t.level>=.55&&t.lamp))];}
 if(stage==='text')return [check('text','输入信息与显示的汉字',ts.some(t=>typeof t.input==='string'&&t.input.trim().length>0&&typeof t.output==='string'&&/[\u3400-\u9fff]/.test(t.output)&&['keyboard','simulation'].includes(t.source)))];
 if(stage==='door')return [check('far','人物远处时的门状态',ts.some(t=>Number.isFinite(t.x)&&t.x>=0&&t.x<.65&&t.open===false)),check('near','人物靠近时的门状态',ts.some(t=>Number.isFinite(t.x)&&t.x>=.65&&t.x<=1&&t.open===true))];
 return [];
}
function assess(stage,record){const errors=[];if(!stages.some(s=>s.id===stage)||!record||typeof record!=='object')return {pass:false,errors:['还没有本关学习记录']};if(record.submitted!==true)errors.push('请提交本次解释后再检验');const r=record;if(!['yes','no','same','different','stop','go','open','closed'].includes(r.prediction))errors.push('先留下你的首次预测');for(const part of ['input','compute','output'])if(r.diagram?.[part]!==goals[stage][part])errors.push({input:'输入描述需再检查：记录的是信息，还是设备？',compute:'计算描述需再检查：系统怎样处理输入？',output:'输出描述需再检查：观察到了什么结果？'}[part]);
if(experimentChecks(stage,r).some(c=>!c.complete))errors.push({road:'比较红灯等待与绿灯确认路况后的反应',sound:'记录一次未触发和一次成功触发的声音对照',text:'亲自输入汉字并记录输入和显示结果',door:'记录远处关闭、靠近开启两个状态'}[stage]);
if(stage==='road'&&r.transfer!=='check')errors.push('绿灯时还要怎样确认能否通行？');
if(stage==='sound'&&r.transfer!=='strength')errors.push('比较说话与拍手，判断系统检测的是什么');
if(stage==='text'&&r.transfer!=='screen')errors.push('区分输入设备、输入信息与输出结果');
if(stage==='door'&&r.transfer!=='keep')errors.push('人在检测区停留时，门应怎样变化？');
return {pass:errors.length===0,errors};}
const examples={road:{prediction:'stop',trials:[{signal:'red',action:'stop'},{signal:'green',action:'check'}],diagram:goals.road,transfer:'check'},sound:{prediction:'yes',trials:[{level:.1,lamp:false,source:'simulation'},{level:.8,lamp:true,source:'simulation'}],diagram:goals.sound,transfer:'strength'},text:{prediction:'different',trials:[{input:'xiaoyuan',output:'校园',source:'keyboard'}],diagram:goals.text,transfer:'screen'},door:{prediction:'open',trials:[{x:.1,open:false},{x:.8,open:true}],diagram:goals.door,transfer:'keep'}};
for(const r of Object.values(examples))r.submitted=true;
function robotDistance(speed,time){return Math.max(0,Number(speed)||0)*Math.max(0,Number(time)||0);}
return {robotDistance,stages,goals,sources,newSound,stepSound,stepDoor,experimentChecks,assess,examples};
});
