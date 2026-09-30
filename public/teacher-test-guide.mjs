import {escape} from './sync.mjs?v=1';

const operations={
 road:['点击“观察红灯”，观察行人停下；结果自动保存','点击“观察绿灯”，观察确认安全后的通行并比较'],
 sound:['点击“测试安静”观察灯不亮，自动保存结果','点击“发出明显声音”，观察灯亮并比较两次结果'],
 text:['用中文输入法键入拼音并选择汉字','点击“完成输入”，保存按键信息和屏幕上的汉字'],
 door:['点击“人物回到远处”，门关闭后自动保存','点击“人物靠近门口”，门开启后自动保存；还可移动人物观察停留和离开']
};

export function renderStageReference(stage,activity,example){
 const label=(choices,value)=>choices.find(([key])=>key===value)?.[1]||'未设置';
 const parts=['input','compute','output'];
 return `<div class="test-reference"><button id="test-guide-close" type="button">收起参考</button><p class="eyebrow">教师隔离测试 · 本关参考</p><h2>${escape(activity.title)} · 标准操作</h2><ol>${(operations[stage]||[]).map(step=>`<li>${escape(step)}</li>`).join('')}</ol><p><b>预测示例：</b>${escape(label(activity.predict,example.prediction))}</p><h3>工作过程标准答案</h3><div class="test-reference-flow">${parts.map((part,i)=>`${i?'<span aria-hidden="true">→</span>':''}<div><b>${{input:'输入',compute:'计算',output:'输出'}[part]}</b><p>${escape(label(activity.diagram[part],example.diagram[part]))}</p></div>`).join('')}</div><p><b>迁移判断：</b>${escape(activity.transferQuestion)} → ${escape(label(activity.transfer,example.transfer))}</p><p class="note">可以先在场景亲自操作，再点击“载入本关达标示例”核对记录。示例用于教师测试，不进入班级统计。</p></div>`;
}

export function renderExamReference(questions){
 return `<div class="test-reference"><button id="test-guide-close" type="button">收起参考</button><p class="eyebrow">教师隔离测试 · 题库参考</p><h2>20题考核的题库参考答案</h2><p>题库共 ${questions.length} 题；每次抽取20题。点击题目查看答案和解析，测试模式还可亲自作答并提交。</p><div class="test-reference-bank">${questions.map((q,i)=>`<details><summary>${i+1} · ${escape(q.goal)} · ${escape(q.prompt)}</summary><p><b>正确答案：${escape(q.options[q.answer])}</b></p><p>解析：${escape(q.explanation)}</p></details>`).join('')}</div></div>`;
}
