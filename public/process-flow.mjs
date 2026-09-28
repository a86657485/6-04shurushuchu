const steps=[['input','输入'],['compute','计算'],['output','输出']];
const htmlEscape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

/** The diagram shows the student's saved choices; only the active node exposes word cards. */
export function renderProcessFlow(diagram,values={},active='input',order=choices=>choices){
  const flow=steps.map(([part,title],index)=>{
    const selected=(diagram[part]||[]).find(([value])=>value===values[part]);
    const card=`<div class="flow-step"><span class="flow-kind">${title}</span><button type="button" id="diagram-${part}" class="flow-node${selected?' filled':''}" aria-label="${title}：${selected?htmlEscape(selected[1]):'点击选择描述'}" aria-pressed="${active===part}" aria-controls="flow-options"><span class="flow-content">${selected?htmlEscape(selected[1]):'点击选择描述'}</span></button></div>`;
    return index?`<span class="flow-arrow" aria-hidden="true">→</span>${card}`:card;
  }).join('');
  const title=steps.find(([part])=>part===active)?.[1]||'输入';
  const options=order(diagram[active]||[],active).map(([value,label])=>`<button type="button" class="flow-choice${values[active]===value?' selected':''}" data-flow-value="${htmlEscape(value)}" aria-pressed="${values[active]===value}">${htmlEscape(label)}</button>`).join('');
  return `<div class="process-flow" aria-label="输入到计算再到输出的工作过程示意图">${flow}</div><div id="flow-options" class="flow-options"><p>为「${title}」选择词卡；点击任一节点可重新修改。</p><div class="flow-choices">${options}</div></div>`;
}
