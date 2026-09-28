/** Derive every visual total from one selected class and learning round. */
export function summarizeClass(payload, stages) {
  if (!payload || !Array.isArray(payload.students)) throw new Error('学生数据未能读取');
  if (!payload.classId) throw new Error('班级信息缺失');
  const students = payload.students;
  if (students.some(s => String(s.student?.classId) !== String(payload.classId))) {
    throw new Error('班级数据不一致，请重新加载');
  }
  const total = students.length;
  const complete = students.filter(s => stages.every(stage => (s.awards || []).some(a => a.stage === stage.id))).length;
  const entered = students.filter(s => Boolean(s.updated)).length;
  if (complete > entered) throw new Error('完成状态与进入人数不一致，请重新加载');
  const status = {notEntered: total - entered, inProgress: entered - complete, complete};
  const stageRows = stages.map(stage => {
    const completed = students.filter(s => (s.awards || []).some(a => a.stage === stage.id)).length;
    const answered = students.filter(s => Boolean(s.records?.[stage.id]?.lastSubmitted));
    return {
      id: stage.id,
      name: stage.name,
      complete: completed,
      assessment: {
        submitted: answered.length,
        firstPassed: answered.filter(s => s.records[stage.id].firstSubmitted?.assessment?.pass === true).length,
        latestPassed: answered.filter(s => s.records[stage.id].lastSubmitted?.assessment?.pass === true).length,
        unanswered: total - answered.length
      }
    };
  });
  return {classId: String(payload.classId), round: payload.round, at: payload.at, total, entered, status, stages: stageRows};
}
