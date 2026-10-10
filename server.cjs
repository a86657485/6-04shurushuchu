'use strict';
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const os=require('node:os');
const {DatabaseSync}=require('node:sqlite');
const quiz=require('./quiz.cjs');
const {isTeacherAddress,teacherOrigins}=require('./teacher-access.cjs');
const BASE=__dirname;
const CLASSES=['601','602','603','604','605','606'];
const COOKIE_STUDENT='lesson4_student';
function createService(options={}){
 const networkInterfaces=options.networkInterfaces||os.networkInterfaces;
 const runtimeDir=options.runtimeDir||path.join(BASE,'runtime');fs.mkdirSync(runtimeDir,{recursive:true,mode:0o700});
 const oldTeacherPassword=path.join(runtimeDir,'teacher-password.txt');
 if(fs.existsSync(oldTeacherPassword))fs.unlinkSync(oldTeacherPassword);
 let roster=options.roster;
 if(!roster){const source=fs.existsSync(path.join(BASE,'roster.json'))?'roster.json':'roster.example.json';roster=JSON.parse(fs.readFileSync(path.join(BASE,source),'utf8'));if(source.includes('example'))console.warn('使用明确标注的样例名单，请按说明导入六年级正式名单。');}
 const rules=options.rules||require('./public/rules.js');
 const stages=(rules.stages||['road','sound','text','door']).map(s=>typeof s==='string'?s:s.id);
 const db=new DatabaseSync(path.join(runtimeDir,'classroom.sqlite'));
 db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=3000;
 CREATE TABLE IF NOT EXISTS students(id TEXT PRIMARY KEY,classId TEXT NOT NULL,name TEXT NOT NULL,manual INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS rounds(classId TEXT PRIMARY KEY,n INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS states(sid TEXT NOT NULL,round TEXT NOT NULL,json TEXT NOT NULL,PRIMARY KEY(sid,round));
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,role TEXT NOT NULL,sid TEXT,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS events(id TEXT NOT NULL,sid TEXT NOT NULL,round TEXT NOT NULL,PRIMARY KEY(id,sid,round));
 CREATE TABLE IF NOT EXISTS exams(id TEXT PRIMARY KEY,sid TEXT NOT NULL,round TEXT NOT NULL,json TEXT NOT NULL);
 `);
 db.prepare('DELETE FROM sessions WHERE role=?').run('teacher');
 const rosterIds=new Set();
 for(const s of roster){if(!CLASSES.includes(String(s.classId))||!s.id||!String(s.name).trim())throw new Error('名单包含不合法的六年级班级或身份');rosterIds.add(String(s.id));db.prepare('INSERT INTO students VALUES(?,?,?,0) ON CONFLICT(id) DO UPDATE SET classId=excluded.classId,name=excluded.name,manual=0').run(String(s.id),String(s.classId),String(s.name).trim());}
 for(const c of CLASSES)db.prepare('INSERT OR IGNORE INTO rounds VALUES(?,1)').run(c);
 let live={at:null,level:0,lamp:false,active:false,triggerCount:0};
 const now=()=>new Date().toISOString();
 const student=id=>{const s=db.prepare('SELECT * FROM students WHERE id=?').get(id);return s?{...s,manual:!!s.manual}:null;};
 const roundFor=s=>'r'+db.prepare('SELECT n FROM rounds WHERE classId=?').get(s.classId).n;
 const initial=(s,round)=>({student:s,round,records:Object.fromEntries(stages.map(k=>[k,{first:null,latest:null,firstSubmitted:null,lastSubmitted:null,history:[]}])),awards:[],points:0,updated:null,quizAttempts:[]});
 function state(s,round=roundFor(s)){const row=db.prepare('SELECT json FROM states WHERE sid=? AND round=?').get(s.id,round);const data=row?JSON.parse(row.json):initial(s,round);data.student=s;for(const stage of Object.values(data.records)){if(stage.firstSubmitted===undefined)stage.firstSubmitted=stage.history.find(r=>r.submitted===true)||null;if(stage.lastSubmitted===undefined)stage.lastSubmitted=stage.history.findLast(r=>r.submitted===true)||null;}const unfinished=db.prepare('SELECT json FROM exams WHERE sid=? AND round=? ORDER BY rowid DESC').all(s.id,round).map(r=>JSON.parse(r.json)).find(e=>!e.submitted);if(unfinished)data.currentExam={id:unfinished.id,round:unfinished.round,questions:unfinished.questions.map(quiz.publicQuestion)};else delete data.currentExam;return data;}
 function save(data){data.updated=now();db.prepare('INSERT INTO states VALUES(?,?,?) ON CONFLICT(sid,round) DO UPDATE SET json=excluded.json').run(data.student.id,data.round,JSON.stringify(data));}
 function cookieSession(req){const token=(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(COOKIE_STUDENT+'='))?.slice(COOKIE_STUDENT.length+1);if(!token)return null;return db.prepare('SELECT * FROM sessions WHERE token=? AND role=? AND expires>?').get(token,'student',Date.now());}
 function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
 function fail(status,message,extra={}){throw Object.assign(new Error(message),{status,...extra});}
 function teacher(req){if(!isTeacherAddress(req.socket.remoteAddress,networkInterfaces()))fail(403,'教师入口仅限教师电脑本机访问');}
 function signedStudent(req){const session=cookieSession(req);if(!session)fail(401,'请先选择班级与姓名');const s=student(session.sid);if(!s)fail(401,'学生身份不存在');return s;}
 function matchIdentity(req,body){const s=signedStudent(req);if(body.sid!==s.id)fail(403,'记录身份与当前学生不一致');if(body.round!==roundFor(s))fail(409,'课堂已经开启新轮次，旧轮次记录未覆盖，请刷新查看',{round:roundFor(s)});return s;}
 function setSession(res,sid){const token=crypto.randomBytes(24).toString('hex');db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(token,'student',sid,Date.now()+7*86400000);res.setHeader('Set-Cookie',`${COOKIE_STUDENT}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800`);}
 async function readBody(req){let size=0;const parts=[];for await(const chunk of req){size+=chunk.length;if(size>128*1024)fail(413,'提交内容过大');parts.push(chunk);}if(!parts.length)return {};try{const body=JSON.parse(Buffer.concat(parts).toString());if(!body||typeof body!=='object'||Array.isArray(body))fail(400,'提交格式不正确');return body;}catch(e){if(e.status)throw e;fail(400,'提交格式不正确');}}
 function examFor(s,id){const row=db.prepare('SELECT json FROM exams WHERE id=? AND sid=?').get(id,s.id);if(!row)fail(404,'考核不存在');const e=JSON.parse(row.json);if(e.round!==roundFor(s))fail(409,'本次考核属于旧轮次');return e;}
 const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; media-src 'self' blob:; object-src 'none'; frame-ancestors 'self'");
  try{
   const url=new URL(req.url,'http://localhost');const p=url.pathname;
   if(!['GET','POST','HEAD'].includes(req.method))fail(405,'不支持的请求方法');
   if(req.method==='POST'&&req.headers.origin){let same=false;try{same=new URL(req.headers.origin).host===req.headers.host;}catch{}if(!same)fail(403,'不接受来自其他页面的提交');}
   const body=req.method==='POST'?await readBody(req):{};
   if(p==='/api/classes'&&req.method==='GET')return json(res,200,{classes:CLASSES});
   if(p==='/api/roster'&&req.method==='GET'){const c=url.searchParams.get('class');if(!CLASSES.includes(c))fail(400,'请选择六年级班级');return json(res,200,db.prepare('SELECT id,name,manual FROM students WHERE classId=? ORDER BY rowid').all(c).filter(s=>rosterIds.has(s.id)||s.manual).map(s=>({...s,manual:!!s.manual})));}
   if(p==='/api/login'&&req.method==='POST'){
    const classId=String(body.classId||'');if(!CLASSES.includes(classId))fail(400,'请选择六年级班级');let s;
    if(body.id){s=student(String(body.id));if(!s||s.classId!==classId)fail(400,'姓名不属于所选班级');}
    else{if(typeof body.name!=='string')fail(400,'请输入姓名文字');const name=body.name.trim();if(!name||name.length>30)fail(400,'请输入有效姓名，最多30个字符');const matches=db.prepare('SELECT * FROM students WHERE classId=? AND name=?').all(classId,name);if(matches.length)fail(409,'已有同名记录，请确认并选择已有身份',{choices:matches.map(s=>({id:s.id,name:s.name,manual:!!s.manual}))});s={id:'manual-'+crypto.randomUUID(),classId,name,manual:true};db.prepare('INSERT INTO students VALUES(?,?,?,1)').run(s.id,classId,name);}
    const data=state(s);save(data);setSession(res,s.id);return json(res,200,data);
   }
   if(p==='/api/me'&&req.method==='GET')return json(res,200,state(signedStudent(req)));
   if(p==='/api/logout'&&req.method==='POST'){const session=cookieSession(req);if(session)db.prepare('DELETE FROM sessions WHERE token=?').run(session.token);res.setHeader('Set-Cookie',`${COOKIE_STUDENT}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);return json(res,200,{ok:true});}
   if(p==='/api/event'&&req.method==='POST'){
    const s=matchIdentity(req,body);if(!stages.includes(body.stage))fail(400,'未知关卡');if(typeof body.eventId!=='string'||!body.eventId.trim()||body.eventId.length>120)fail(400,'缺少有效记录标识');if(!body.record||typeof body.record!=='object'||Array.isArray(body.record))fail(400,'缺少学习记录');if(body.record.trials!==undefined&&(!Array.isArray(body.record.trials)||body.record.trials.some(t=>!t||typeof t!=='object'||Array.isArray(t))))fail(400,'实验记录格式不正确');
    if(body.record.hints!==undefined&&(!Number.isSafeInteger(body.record.hints)||body.record.hints<0))fail(400,'提示次数格式不正确');
    const data=state(s);if(db.prepare('SELECT 1 FROM events WHERE id=? AND sid=? AND round=?').get(body.eventId,s.id,data.round))return json(res,200,data);
    const index=stages.indexOf(body.stage);if(index&& !data.awards.some(a=>a.stage===stages[index-1]))fail(409,'请先完成上一必做关卡');
    const assessment=rules.assess(body.stage,body.record);const received=Date.now();const editTime=(r,fallback)=>Number.isFinite(r?.editedAt)&&r.editedAt>=0&&r.editedAt<=received+60000?r.editedAt:fallback;const record={...body.record,editedAt:editTime(body.record,received),eventId:body.eventId,assessment,created:new Date(received).toISOString()};const stage=data.records[body.stage];const stale=!!stage.latest&&record.editedAt<editTime(stage.latest,Date.parse(stage.latest.created)||0);if(!stage.first&&['yes','no','same','different','stop','go','open','closed'].includes(record.prediction))stage.first=record;if(!stale)stage.latest=record;if(record.submitted===true){if(!stage.firstSubmitted)stage.firstSubmitted=record;if(!stale)stage.lastSubmitted=record;}stage.history.push(record);if(stage.history.length>40)stage.history=stage.first?[stage.first,...stage.history.filter(r=>r.eventId!==stage.first.eventId).slice(-39)]:stage.history.slice(-40);
    if(!stale&&assessment.pass&&!data.awards.some(a=>a.stage===body.stage)){data.awards.push({stage:body.stage,points:10,created:now()});data.points=data.awards.reduce((n,a)=>n+a.points,0);}
    db.exec('BEGIN IMMEDIATE');try{save(data);db.prepare('INSERT INTO events VALUES(?,?,?)').run(body.eventId,s.id,data.round);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}return json(res,200,data);
   }
   if(p==='/api/exam/create'&&req.method==='POST'){
    const s=(body.sid!==undefined||body.round!==undefined)?matchIdentity(req,body):signedStudent(req),data=state(s);if(data.currentExam)return json(res,200,data.currentExam);const e={id:crypto.randomUUID(),sid:s.id,round:data.round,created:now(),questions:quiz.pickQuestions(),submitted:null};db.prepare('INSERT INTO exams VALUES(?,?,?,?)').run(e.id,s.id,e.round,JSON.stringify(e));return json(res,200,{id:e.id,round:e.round,questions:e.questions.map(quiz.publicQuestion)});
   }
   if(p==='/api/exam/submit'&&req.method==='POST'){
    const s=matchIdentity(req,body),e=examFor(s,body.examId);if(e.submitted)return json(res,200,e.submitted);
    const answers=body.answers;if(!answers||typeof answers!=='object'||e.questions.some(q=>!Number.isInteger(answers[q.id])||answers[q.id]<0||answers[q.id]>=q.options.length))fail(400,'请完成全部20题后提交');
    const feedback=e.questions.map(q=>({...q,correct:answers[q.id]===q.answer,chosen:answers[q.id]}));const result={id:e.id,score:feedback.filter(q=>q.correct).length*5,answers:Object.fromEntries(e.questions.map(q=>[q.id,answers[q.id]])),feedback,created:now()};e.submitted=result;const data=state(s);data.quizAttempts.push(result);delete data.currentExam;
    db.exec('BEGIN IMMEDIATE');try{db.prepare('UPDATE exams SET json=? WHERE id=?').run(JSON.stringify(e),e.id);save(data);db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}return json(res,200,result);
   }
   if(p==='/api/live'&&req.method==='GET')return json(res,200,{...live,serverNow:Date.now()});
   if(p.startsWith('/api/teacher/')){
    teacher(req);
    if(p==='/api/teacher/microphone-context'&&req.method==='GET'){const port=server.address().port;return json(res,200,{microphoneUrl:`http://localhost:${port}/teacher-microphone`,allowedOrigins:teacherOrigins(port,networkInterfaces())});}
    if(p==='/api/teacher/class'&&req.method==='GET'){const classId=url.searchParams.get('class');if(!CLASSES.includes(classId))fail(400,'请选择六年级班级');const students=db.prepare('SELECT * FROM students WHERE classId=? ORDER BY rowid').all(classId).filter(s=>rosterIds.has(s.id)||s.manual).map(s=>{s.manual=!!s.manual;const current=state(s);current.roundHistory=db.prepare('SELECT json FROM states WHERE sid=? AND round<>?').all(s.id,current.round).map(r=>JSON.parse(r.json));return current;});return json(res,200,{classId,at:now(),round:'r'+db.prepare('SELECT n FROM rounds WHERE classId=?').get(classId).n,students});}
    if(p==='/api/teacher/answers'&&req.method==='GET')return json(res,200,{questions:quiz.questions,stages,goals:rules.goals||{},examples:rules.examples||{}});
    if(p==='/api/teacher/new-round'&&req.method==='POST'){if(!CLASSES.includes(body.classId))fail(400,'请选择六年级班级');db.prepare('UPDATE rounds SET n=n+1 WHERE classId=?').run(body.classId);return json(res,200,{ok:true,classId:body.classId,round:'r'+db.prepare('SELECT n FROM rounds WHERE classId=?').get(body.classId).n});}
    if(p==='/api/teacher/live'&&req.method==='POST'){if(!Number.isFinite(body.level)||body.level<0||body.level>1||typeof body.lamp!=='boolean'||typeof body.active!=='boolean'||!Number.isInteger(body.triggerCount)||body.triggerCount<0)fail(400,'声音观察数据不正确');live={at:now(),level:body.level,lamp:body.lamp,active:body.active,triggerCount:body.triggerCount};return json(res,200,live);}
   }
   if(p.startsWith('/api/'))fail(404,'接口不存在');
   if(['/test','/teacher-microphone','/teacher-microphone.html'].includes(p))teacher(req);
   const aliases={'/':'index.html','/teacher':'teacher.html','/teacher-microphone':'teacher-microphone.html','/test':'index.html','/demo':'index.html'};
   let relative=aliases[p];if(!relative){let decoded;try{decoded=decodeURIComponent(p);}catch{fail(400,'地址格式不正确');}if(decoded.includes('..')||decoded.includes('\\')||decoded.includes('\0'))fail(404,'文件不存在');relative=decoded.replace(/^\/+/,'');}
   const publicRoot=path.join(BASE,'public'),file=path.resolve(publicRoot,relative);if(!file.startsWith(publicRoot+path.sep))fail(404,'文件不存在');if(!fs.existsSync(file)||!fs.statSync(file).isFile())fail(404,'文件不存在');if(!fs.realpathSync(file).startsWith(fs.realpathSync(publicRoot)+path.sep))fail(404,'文件不存在');
   if(['teacher.html','teacher-microphone.html'].some(name=>fs.existsSync(path.join(publicRoot,name))&&fs.realpathSync(file)===fs.realpathSync(path.join(publicRoot,name))))teacher(req);
   const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.glb':'model/gltf-binary','.woff2':'font/woff2','.wav':'audio/wav'};res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':['.html','.js','.mjs','.css'].includes(path.extname(file))?'no-cache':'public, max-age=3600'});if(req.method==='HEAD')return res.end();fs.createReadStream(file).pipe(res);
  }catch(e){if(res.headersSent){res.destroy();return;}json(res,e.status||500,{error:e.status?e.message:'服务暂时无法保存，请稍后重试',...(e.choices?{choices:e.choices}:{}),...(e.round?{round:e.round}:{} )});if(!e.status)console.error('课堂服务错误:',e.message);}
 });
 return {server,close:()=>db.close(),runtimeDir};
}
if(require.main===module){const service=createService();const port=Number(process.env.PORT)||8794;service.server.listen(port,'0.0.0.0',()=>{console.log(`教师本机入口：http://localhost:${port}/teacher（免密码，限教师电脑访问）`);for(const [name,nets] of Object.entries(os.networkInterfaces())){if(!/^en\d+$/.test(name))continue;for(const net of nets){if(net.family==='IPv4'&&!net.internal)console.log(`学生局域网入口：http://${net.address}:${port}`);}}});const shutdown=()=>service.server.close(()=>{service.close();process.exit(0);});process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);}
module.exports={createService};
