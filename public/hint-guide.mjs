import {nextExperimentAction} from './student-journey.mjs?v=2';
const target=(selector,label)=>({selector,label});

export function chooseHintTarget(stage,record={},options={}){
 if(options.passed)return target('#next','保存并进入下一站');
 if(!record.prediction)return target('#prediction-panel .choice-row','选择一个预测');
 if(options.checks?.some(check=>!check.complete)){
  const next=nextExperimentAction(stage,options.checks,options);
  return {...next,label:next.instruction};
 }
 const errors=options.reviewErrors||[];
 for(const [part,name] of [['input','输入'],['compute','计算'],['output','输出']]){
  if(!record.diagram?.[part]||errors.some(message=>message.startsWith(name+'描述需再检查')))return target('#diagram-'+part,name+'描述');
 }
 if(!record.transfer||errors.some(message=>/绿灯时|比较说话与拍手|区分输入设备|人在检测区/.test(message)))return target('#transfer-choice','选择新条件下的判断');
 return target('#submit','检验我的解释');
}
