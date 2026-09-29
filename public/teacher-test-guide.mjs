import {escape} from './sync.mjs?v=1';

const operations={
 road:['先记录红灯时停下等待','再切换绿灯，确认路况安全后通行'],
 sound:['先用安静或轻声观察灯不亮','再用明显声音观察灯亮，并比较两次记录'],
 text:['用中文输入法键入拼音并选择汉字','记录按键信息和屏幕显示的汉字'],
 door:['先把人物放在远处观察门关闭','让人物进入检测区，停留并离开，观察门开闭']
};

export function renderStageReference(stage,activity,example){
 const label=(choices,value)=>choices.find(([key])=>key===value)?.[1]||'未设置';
 const parts=['input','compute','output'];
 return `<div class="test-reference"><button id="test-guide-close" type="button">收起参考</button><p class="eyebrow">教师隔离测试 · 本关参考</p><h2>${escape(activity.title)} · 标准操作</h2><ol>${(operations[stage]||[]).map(step=>`<li>${escape(step)}</li>`).join('')}</ol><p><b>预测示例：</b>${escape(label(activity.predict,example.prediction))}</p><h3>工作过程标准答案</h3><div class="test-reference-flow">${parts.map((part,i)=>`${i?'<span aria-hidden="true">→</span>':''}<div><b>${{input:'输入',compute:'计算',output:'输出'}[part]}</b><p>${escape(label(activity.diagram[part],example.diagram[part]))}</p></div>`).join('')}</div><p><b>迁移判断：</b>${escape(activity.transferQuestion)} → ${escape(label(activity.transfer,example.transfer))}</p><p class="note">可以先在场景亲自操作，再点击“载入本关达标示例”核对记录。示例用于教师测试，不进入班级统计。</p></div>`;
}

export function renderExamReference(questions){
 return `<div class="test-reference"><button id="test-guide-close" type="button">收起参考</button><p class="eyebrow">教师隔离测试 · 题库参考</p><h2>20题考核的题库参考答案</h2><p>题库共 ${questions.length} 题；每次抽取20题。点击题目查看答案和解析，测试模式还可亲自作答并提交。</p><div class="test-reference-bank">${questions.map((q,i)=>`<details><summary>${i+1} · ${escape(q.goal)} · ${escape(q.prompt)}</summary><p><b>正确答案：${escape(q.options[q.answer])}</b></p><p>解析：${escape(q.explanation)}</p></details>`).join('')}</div></div>`;
}
