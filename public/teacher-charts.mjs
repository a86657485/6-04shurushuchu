const rate = (number, total) => total ? Math.round(number / total * 100) : 0;
const share = (number, total) => total ? (number / total * 100).toFixed(2) : 0;

export function renderClassCharts(summary, {statusFilter = null, stageFilter = null} = {}) {
  const {total, status, stages} = summary;
  const states = [
    ['notEntered', '未进入', '#aabdc5'],
    ['inProgress', '进行中', '#2b8298'],
    ['complete', '完成主线', '#248477']
  ];
  const statusHtml = `<h2>全班学习状态</h2><p class="chart-subtitle">${summary.classId}班 · 本轮共 ${total} 人，包含手动加入学生</p>
    <div class="status-track" role="img" aria-label="${states.map(([key, label]) => `${label}${status[key]}人`).join('，')}">${total ? states.map(([key, , color]) => `<span style="width:${share(status[key], total)}%;background:${color}"></span>`).join('') : '<span class="empty-track"></span>'}</div>
    <div class="status-legend">${states.map(([key, label]) => `<button type="button" class="legend-item" data-chart-status="${key}" aria-pressed="${statusFilter===key}"><i class="legend-dot legend-${key}"></i><span>${label}</span><b>${status[key]} 人 · ${rate(status[key], total)}%</b></button>`).join('')}</div>`;
  const stageHtml = `<h2>四关完成情况</h2><p class="chart-subtitle">分母为本班 ${total} 人；点击一关查看未完成者</p>
    <div class="chart-rows">${stages.map(stage => `<button type="button" class="stage-chart-row" data-chart-stage="${stage.id}" aria-pressed="${stageFilter===stage.id}" aria-label="${stage.name}：${stage.complete}/${total}人已完成，点击查看未完成者"><span class="row-label">${stage.name}</span><span class="chart-bar"><i style="width:${rate(stage.complete, total)}%"></i></span><b>${stage.complete}/${total} · ${rate(stage.complete, total)}%</b></button>`).join('')}</div>`;
  const evidenceHtml = `<h2>提交后的目标表现</h2><p class="chart-subtitle">首次与最近均以本关已正式提交人数为分母；未提交单列，不计作错误。</p><div class="evidence-grid">${stages.map(stage => {
    const {submitted, firstPassed, latestPassed, unanswered} = stage.assessment;
    return `<div class="evidence-item"><h3>${stage.name}</h3><p>已提交 ${submitted}/${total} · 未提交 ${unanswered}</p>${submitted ? `<div class="evidence-measure"><span>首次符合</span><div class="chart-bar first"><i style="width:${rate(firstPassed, submitted)}%"></i></div><b>${firstPassed}/${submitted}</b></div><div class="evidence-measure"><span>最近符合</span><div class="chart-bar recent"><i style="width:${rate(latestPassed, submitted)}%"></i></div><b>${latestPassed}/${submitted}</b></div>` : '<p class="no-evidence">尚无提交证据</p>'}</div>`;
  }).join('')}</div>`;
  return {statusHtml, stageHtml, evidenceHtml};
}
