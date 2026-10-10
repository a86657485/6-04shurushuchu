import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import pathModule from 'node:path';
import rulesDefault from '../public/rules.js';
import quiz from '../quiz.cjs';

const classes=['601','602','603','604','605','606'];
const pages={'/teacher':'teacher.html','/teacher.html':'teacher.html','/test':'index.html','/teacher-microphone':'teacher-microphone.html','/teacher-microphone.html':'teacher-microphone.html'};
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
const equal=(a,b)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&crypto.timingSafeEqual(x,y);};
const fail=(status,message,extra={})=>{throw Object.assign(new Error(message),{status,...extra});};
const now=()=>new Date().toISOString();
const identity=row=>({id:row.id,classId:row.class_id,name:row.name,manual:row.manual});
const cookie=(name,value,age)=>`${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
const cookies=req=>Object.fromEntries((req.headers.get('cookie')||'').split(';').map(x=>x.trim().split('=')).filter(x=>x.length===2));
const json=(data,status=200,headers={})=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',...headers}});

export function createClassroomHandler({db,teacherKey='',rules=rulesDefault}){
 const stages=rules.stages.map(s=>typeof s==='string'?s:s.id);
 const initial=(s,round)=>({student:s,round,records:Object.fromEntries(stages.map(k=>[k,{first:null,latest:null,firstSubmitted:null,lastSubmitted:null,history:[]}])),awards:[],points:0,updated:null,quizAttempts:[]});
 const query=async(tx,sql,params=[])=> (await tx.query(sql,params)).rows;
 async function student(tx,req){
  const token=cookies(req).lesson4_student;if(!token)fail(401,'请先选择班级与姓名');
  const [s]=await query(tx,'SELECT s.* FROM lesson4_students s JOIN lesson4_sessions c ON c.sid=s.id WHERE c.token=$1 AND c.expires>$2',[digest(token),Date.now()]);
  if(!s)fail(401,'请重新选择班级与姓名');return identity(s);
 }
 async function roundFor(tx,classId,lock='FOR SHARE'){
  const [r]=await query(tx,`SELECT n FROM lesson4_rounds WHERE class_id=$1 ${lock}`,[classId]);
  if(!r)fail(400,'请选择六年级班级');return 'r'+r.n;
 }
 async function loadState(tx,s,round,stored,exams){
  const row=stored===undefined?(await query(tx,'SELECT data FROM lesson4_states WHERE sid=$1 AND round=$2',[s.id,round]))[0]:stored;
  const data=row?structuredClone(row.data):initial(s,round);data.student=s;
  for(const stage of Object.values(data.records)){
   if(stage.firstSubmitted===undefined)stage.firstSubmitted=stage.history.find(r=>r.submitted===true)||null;
   if(stage.lastSubmitted===undefined)stage.lastSubmitted=stage.history.findLast(r=>r.submitted===true)||null;
  }
  const papers=exams??await query(tx,'SELECT data FROM lesson4_exams WHERE sid=$1 AND round=$2 ORDER BY created DESC,id DESC',[s.id,round]);
  const unfinished=papers.map(e=>e.data).find(e=>!e.submitted);
  if(unfinished)data.currentExam={id:unfinished.id,round:unfinished.round,questions:unfinished.questions.map(quiz.publicQuestion)};else delete data.currentExam;
  return data;
 }
 async function save(tx,data){data.updated=now();await tx.query('INSERT INTO lesson4_states VALUES($1,$2,$3) ON CONFLICT(sid,round) DO UPDATE SET data=excluded.data',[data.student.id,data.round,JSON.stringify(data)]);}
 function teacher(req){
  if(teacherKey.length<32)fail(503,'教师入口尚未配置，请联系网站管理员');
  const [expires,signature]=String(cookies(req).lesson4_teacher||'').split('.');
  const expected=crypto.createHmac('sha256',teacherKey).update('teacher:'+expires).digest('hex');
  if(!expires||!signature||!Number.isSafeInteger(Number(expires))||Number(expires)<Date.now()||!equal(signature,expected))fail(403,'请从老师专用入口打开此页面');
 }
 async function writeStudent(req,body,fn){
  return db.transaction(async tx=>{
   const s=await student(tx,req),round=await roundFor(tx,s.classId);
   await tx.query('SELECT id FROM lesson4_students WHERE id=$1 FOR UPDATE',[s.id]);
   if(body.sid!==undefined&&body.sid!==s.id)fail(403,'记录身份与当前学生不一致');
   if(body.round!==undefined&&body.round!==round)fail(409,'课堂已经开启新轮次，旧轮次记录未覆盖，请刷新查看',{round});
   return fn(tx,s,round);
  });
 }
 async function readBody(req){
  const text=await req.text();if(Buffer.byteLength(text)>128*1024)fail(413,'提交内容过大');
  if(!text)return {};try{const value=JSON.parse(text);if(!value||typeof value!=='object'||Array.isArray(value))fail(400,'提交格式不正确');return value;}catch(e){if(e.status)throw e;fail(400,'提交格式不正确');}
 }
 return async req=>{
  try{
   const url=new URL(req.url),path=url.pathname.replace(/\/+$/,'')||'/';
   if(!['GET','POST','HEAD'].includes(req.method))fail(405,'不支持的请求方法');
   if(req.method==='POST'&&req.headers.get('origin')&&req.headers.get('origin')!==url.origin)fail(403,'不接受来自其他页面的提交');
   if(path==='/api/teacher/enter'&&req.method==='GET'){
    if(teacherKey.length<32)fail(503,'教师入口尚未配置，请联系网站管理员');
    if(!equal(url.searchParams.get('key')||'',teacherKey))fail(403,'教师专用入口无效');
    const expires=String(Date.now()+8*3600000),signature=crypto.createHmac('sha256',teacherKey).update('teacher:'+expires).digest('hex');
    return new Response(null,{status:302,headers:{Location:'/teacher','Set-Cookie':cookie('lesson4_teacher',expires+'.'+signature,8*3600),'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
   }
   if(pages[path]){
    teacher(req);if(req.method==='POST')fail(405,'不支持的请求方法');
    if(url.pathname.endsWith('/'))return new Response(null,{status:302,headers:{Location:path,'Cache-Control':'no-store'}});
    const text=await fs.readFile(pathModule.join(process.cwd(),'public',pages[path]),'utf8');
    return new Response(req.method==='HEAD'?null:text,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; media-src 'self' blob:; object-src 'none'; frame-ancestors 'self'"}});
   }
   if(path.startsWith('/api/teacher/'))teacher(req);
   const body=req.method==='POST'?await readBody(req):{};
   if(req.method==='POST'&&!/^application\/json(?:;|$)/i.test(req.headers.get('content-type')||''))fail(415,'请使用课堂页面提交记录');
   if(path==='/api/classes'&&req.method==='GET')return json({classes});
   if(path==='/api/roster'&&req.method==='GET'){
    const classId=url.searchParams.get('class');if(!classes.includes(classId))fail(400,'请选择六年级班级');
    return json((await query(db,'SELECT id,name,manual FROM lesson4_students WHERE class_id=$1 AND active=TRUE ORDER BY position,id',[classId])));
   }
   if(path==='/api/login'&&req.method==='POST'){
    let token;
    const value=await db.transaction(async tx=>{
     const classId=String(body.classId||'');if(!classes.includes(classId))fail(400,'请选择六年级班级');
     const round=await roundFor(tx,classId,body.id?'FOR SHARE':'FOR UPDATE');let row;
     if(body.id){[row]=await query(tx,'SELECT * FROM lesson4_students WHERE id=$1 AND class_id=$2 AND active=TRUE FOR UPDATE',[String(body.id),classId]);if(!row)fail(400,'姓名不属于所选班级');}
     else{
      if(typeof body.name!=='string')fail(400,'请输入姓名文字');const name=body.name.trim();if(!name||name.length>30)fail(400,'请输入有效姓名，最多30个字符');
      const matches=await query(tx,'SELECT id,name,manual FROM lesson4_students WHERE class_id=$1 AND name=$2 AND active=TRUE ORDER BY position',[classId,name]);
      if(matches.length)fail(409,'已有同名记录，请确认并选择已有身份',{choices:matches});
      [row]=await query(tx,'INSERT INTO lesson4_students(id,class_id,name,manual) VALUES($1,$2,$3,TRUE) RETURNING *',['manual-'+crypto.randomUUID(),classId,name]);
     }
     const s=identity(row),data=await loadState(tx,s,round);await save(tx,data);token=crypto.randomBytes(24).toString('hex');
     await tx.query('INSERT INTO lesson4_sessions VALUES($1,$2,$3)',[digest(token),s.id,Date.now()+7*86400000]);return data;
    });return json(value,200,{'Set-Cookie':cookie('lesson4_student',token,604800)});
   }
   if(path==='/api/me'&&req.method==='GET')return json(await db.transaction(async tx=>{const s=await student(tx,req);return loadState(tx,s,await roundFor(tx,s.classId));}));
   if(path==='/api/logout'&&req.method==='POST'){
    const token=cookies(req).lesson4_student;if(token)await db.query('DELETE FROM lesson4_sessions WHERE token=$1',[digest(token)]);
    return json({ok:true},200,{'Set-Cookie':cookie('lesson4_student','',0)});
   }
   if(path==='/api/event'&&req.method==='POST'){
    if(body.sid===undefined||body.round===undefined)fail(400,'缺少学生身份或课堂轮次');
    return json(await writeStudent(req,body,async(tx,s,round)=>{
     if(!stages.includes(body.stage))fail(400,'未知关卡');if(typeof body.eventId!=='string'||!body.eventId.trim()||body.eventId.length>120)fail(400,'缺少有效记录标识');
     if(!body.record||typeof body.record!=='object'||Array.isArray(body.record))fail(400,'缺少学习记录');
     if(body.record.hints!==undefined&&(!Number.isSafeInteger(body.record.hints)||body.record.hints<0))fail(400,'提示次数格式不正确');
     if(body.record.trials!==undefined&&(!Array.isArray(body.record.trials)||body.record.trials.some(t=>!t||typeof t!=='object'||Array.isArray(t))))fail(400,'实验记录格式不正确');
     const data=await loadState(tx,s,round);if((await query(tx,'SELECT id FROM lesson4_events WHERE id=$1 AND sid=$2 AND round=$3',[body.eventId,s.id,round])).length)return data;
     const index=stages.indexOf(body.stage);if(index&&!data.awards.some(a=>a.stage===stages[index-1]))fail(409,'请先完成上一必做关卡');
     const assessment=rules.assess(body.stage,body.record),received=Date.now();
     const editTime=(r,fallback)=>Number.isFinite(r?.editedAt)&&r.editedAt>=0&&r.editedAt<=received+60000?r.editedAt:fallback;
     const record={...body.record,editedAt:editTime(body.record,received),eventId:body.eventId,assessment,created:new Date(received).toISOString()},stage=data.records[body.stage];
     const stale=!!stage.latest&&record.editedAt<editTime(stage.latest,Date.parse(stage.latest.created)||0);
     if(!stage.first&&['yes','no','same','different','stop','go','open','closed'].includes(record.prediction))stage.first=record;
     if(!stale)stage.latest=record;
     if(record.submitted===true){if(!stage.firstSubmitted)stage.firstSubmitted=record;if(!stale)stage.lastSubmitted=record;}
     stage.history.push(record);if(stage.history.length>40)stage.history=stage.first?[stage.first,...stage.history.filter(r=>r.eventId!==stage.first.eventId).slice(-39)]:stage.history.slice(-40);
     if(!stale&&assessment.pass&&!data.awards.some(a=>a.stage===body.stage)){data.awards.push({stage:body.stage,points:10,created:now()});data.points=data.awards.reduce((n,a)=>n+a.points,0);}
     await save(tx,data);await tx.query('INSERT INTO lesson4_events VALUES($1,$2,$3)',[body.eventId,s.id,round]);return data;
    }));
   }
   if(path==='/api/exam/create'&&req.method==='POST')return json(await writeStudent(req,body,async(tx,s,round)=>{
    const data=await loadState(tx,s,round);if(data.currentExam)return data.currentExam;
    const e={id:crypto.randomUUID(),sid:s.id,round,created:now(),questions:quiz.pickQuestions(),submitted:null};
    await tx.query('INSERT INTO lesson4_exams(id,sid,round,data) VALUES($1,$2,$3,$4)',[e.id,s.id,round,JSON.stringify(e)]);
    return {id:e.id,round,questions:e.questions.map(quiz.publicQuestion)};
   }));
   if(path==='/api/exam/submit'&&req.method==='POST'){
    if(body.sid===undefined||body.round===undefined)fail(400,'缺少学生身份或课堂轮次');
    return json(await writeStudent(req,body,async(tx,s,round)=>{
     const [row]=await query(tx,'SELECT data FROM lesson4_exams WHERE id=$1 AND sid=$2',[body.examId,s.id]);if(!row)fail(404,'考核不存在');
     const e=row.data;if(e.round!==round)fail(409,'本次考核属于旧轮次');if(e.submitted)return e.submitted;
     const answers=body.answers;if(!answers||typeof answers!=='object'||e.questions.some(q=>!Number.isInteger(answers[q.id])||answers[q.id]<0||answers[q.id]>=q.options.length))fail(400,'请完成全部20题后提交');
     const feedback=e.questions.map(q=>({...q,correct:answers[q.id]===q.answer,chosen:answers[q.id]}));
     const result={id:e.id,score:feedback.filter(q=>q.correct).length*5,answers:Object.fromEntries(e.questions.map(q=>[q.id,answers[q.id]])),feedback,created:now()};
     e.submitted=result;const data=await loadState(tx,s,round);data.quizAttempts.push(result);delete data.currentExam;
     await tx.query('UPDATE lesson4_exams SET data=$1 WHERE id=$2',[JSON.stringify(e),e.id]);await save(tx,data);return result;
    }));
   }
   if(path==='/api/live'&&req.method==='GET')return json({...((await query(db,'SELECT data FROM lesson4_live WHERE id=1'))[0].data),serverNow:Date.now()});
   if(path==='/api/teacher/class'&&req.method==='GET')return json(await db.transaction(async tx=>{
    const classId=url.searchParams.get('class');if(!classes.includes(classId))fail(400,'请选择六年级班级');const round=await roundFor(tx,classId);
    const ss=await query(tx,'SELECT * FROM lesson4_students WHERE class_id=$1 AND active=TRUE ORDER BY position,id',[classId]);
    const records=await query(tx,'SELECT st.* FROM lesson4_states st JOIN lesson4_students s ON s.id=st.sid WHERE s.class_id=$1',[classId]);
    const exams=await query(tx,'SELECT e.* FROM lesson4_exams e JOIN lesson4_students s ON s.id=e.sid WHERE s.class_id=$1 AND e.round=$2 ORDER BY e.created DESC,e.id DESC',[classId,round]);
    const students=await Promise.all(ss.map(async row=>{const s=identity(row),data=await loadState(tx,s,round,records.find(r=>r.sid===s.id&&r.round===round)||null,exams.filter(e=>e.sid===s.id));data.roundHistory=records.filter(r=>r.sid===s.id&&r.round!==round).map(r=>r.data);return data;}));
    return {classId,round,at:now(),students};
   }));
   if(path==='/api/teacher/answers'&&req.method==='GET')return json({questions:quiz.questions,stages,goals:rules.goals||{},examples:rules.examples||{}});
   if(path==='/api/teacher/new-round'&&req.method==='POST'){
    if(!classes.includes(body.classId))fail(400,'请选择六年级班级');
    const [r]=await query(db,'UPDATE lesson4_rounds SET n=n+1 WHERE class_id=$1 RETURNING n',[body.classId]);return json({ok:true,classId:body.classId,round:'r'+r.n});
   }
   if(path==='/api/teacher/live'&&req.method==='POST'){
    if(!Number.isFinite(body.level)||body.level<0||body.level>1||typeof body.lamp!=='boolean'||typeof body.active!=='boolean'||!Number.isInteger(body.triggerCount)||body.triggerCount<0)fail(400,'声音观察数据不正确');
    const live={at:now(),level:body.level,lamp:body.lamp,active:body.active,triggerCount:body.triggerCount};await db.query('UPDATE lesson4_live SET data=$1 WHERE id=1',[JSON.stringify(live)]);return json(live);
   }
   if(path==='/api/teacher/microphone-context'&&req.method==='GET')return json({microphoneUrl:url.origin+'/teacher-microphone',allowedOrigins:[url.origin]});
   fail(404,'接口不存在');
  }catch(e){if(!e.status)console.error('Cloud classroom request failed:',e.code||e.name);return json({error:e.status?e.message:'课堂服务暂时无法保存，请稍后重试',...(e.choices?{choices:e.choices}:{}),...(e.round?{round:e.round}:{})},e.status||503);}
 };
}
