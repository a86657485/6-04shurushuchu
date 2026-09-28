const target = (selector, label) => ({selector, label});

function missingExperiment(stage, trials, options) {
  if (stage === 'road') {
    const red = trials.some(t => t.signal === 'red' && t.action === 'stop');
    const green = trials.some(t => t.signal === 'green' && t.action === 'check');
    if (!red) return options.signal === 'green' ? target('#red', '红灯') : target('#stop-person', '停下等待');
    if (!green) return options.signal === 'green' ? target('#go-person', '确认安全后通行') : target('#green', '绿灯');
  }
  if (stage === 'sound') {
    const low = trials.some(t => Number.isFinite(t.level) && t.level <= .35 && t.lamp === false);
    const high = trials.some(t => Number.isFinite(t.level) && t.level >= .55 && t.lamp === true);
    if (!low || !high) {
      if (options.source === 'microphone') return !options.micListening
        ? target('#mic-start', '开启麦克风') : target('#record', '记录现在的结果');
      if (options.source === 'teacher') return options.liveActive
        ? target('#record', '记录现在的结果') : target('#sound-source', '声音来源');
      return !low ? target('#quiet', '安静') : target('#loud', '明显声音');
    }
  }
  if (stage === 'text') {
    const recorded = trials.some(t => typeof t.output === 'string' && /[\u3400-\u9fff]/.test(t.output));
    if (!recorded) return options.hasTextOutput
      ? target('#capture-text', '记录输入汉字') : target('#hanzi-input', '输入汉字框');
  }
  if (stage === 'door') {
    const far = trials.some(t => Number.isFinite(t.x) && t.x < .65 && t.open === false);
    const near = trials.some(t => Number.isFinite(t.x) && t.x >= .65 && t.open === true);
    if (!far || !near) {
      if (options.observationPending) return target('#record', '记录现在的结果');
      return !far ? target('#far', '回到远处') : target('#near', '靠近检测区');
    }
  }
  return null;
}

export function chooseHintTarget(stage, record = {}, options = {}) {
  if (options.passed) return target('#next', '保存并进入下一站');
  if (!record.prediction) return target('#prediction-panel button:not(:disabled)', '你的预测选项');
  const trials = Array.isArray(record.trials) ? record.trials : [];
  const experiment = missingExperiment(stage, trials, options);
  if (experiment) return experiment;

  const errors = options.reviewErrors || [];
  for (const [part, name] of [['input', '输入'], ['compute', '计算'], ['output', '输出']]) {
    if (!record.diagram?.[part] || errors.some(message => message.startsWith(name + '描述需再检查'))) {
      return target('#diagram-' + part, name + '描述');
    }
  }
  if (!record.transfer || errors.some(message => /绿灯时|比较说话与拍手|区分输入设备|人在检测区/.test(message))) {
    return target('#transfer-choice', '换个条件的判断');
  }
  return target('#submit', '检验我的解释');
}
