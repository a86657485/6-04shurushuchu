import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';

const classes=['601','602','603','604','605','606'];
const quote=value=>"'"+String(value).replaceAll("'","''")+"'";
export function buildPrivateMigration(roster,source){
 const ids=new Set();for(const s of roster){if(ids.has(s.id))throw new Error('名单身份ID重复');if(!s.id||!classes.includes(String(s.classId))||typeof s.name!=='string'||!s.name.trim()||s.name.includes('\0'))throw new Error('名单格式不正确');ids.add(s.id);}
 const students=new Map(source.students.map(s=>[s.id,s]));for(const s of roster)students.set(s.id,{...s,manual:0});
 const lines=['-- Private classroom data: never commit or publish as static files.'];
 for(const s of students.values()){
  if(!classes.includes(String(s.classId)))throw new Error('旧记录含非六年级班级');
  lines.push(`INSERT INTO lesson4_students(id,class_id,name,manual,active) VALUES(${quote(s.id)},${quote(s.classId)},${quote(s.name)},${Boolean(s.manual)},${ids.has(s.id)||Boolean(s.manual)}) ON CONFLICT(id) DO NOTHING;`);
 }
 for(const r of source.rounds){if(!Number.isInteger(r.n)||r.n<1||!classes.includes(r.classId))throw new Error('轮次格式不正确');lines.push(`INSERT INTO lesson4_rounds VALUES(${quote(r.classId)},${r.n}) ON CONFLICT(class_id) DO UPDATE SET n=GREATEST(lesson4_rounds.n,excluded.n);`);}
 for(const s of source.states){if(!students.has(s.sid))throw new Error('学习记录缺少对应学生');lines.push(`INSERT INTO lesson4_states VALUES(${quote(s.sid)},${quote(s.round)},${quote(JSON.stringify(JSON.parse(s.json)))}::jsonb) ON CONFLICT(sid,round) DO NOTHING;`);}
 for(const e of source.events){if(!students.has(e.sid))throw new Error('事件缺少对应学生');lines.push(`INSERT INTO lesson4_events VALUES(${quote(e.id)},${quote(e.sid)},${quote(e.round)}) ON CONFLICT(id,sid,round) DO NOTHING;`);}
 for(const e of source.exams){if(!students.has(e.sid))throw new Error('考核缺少对应学生');const data=JSON.parse(e.json);lines.push(`INSERT INTO lesson4_exams(id,sid,round,data,created) VALUES(${quote(e.id)},${quote(e.sid)},${quote(e.round)},${quote(JSON.stringify(data))}::jsonb,${quote(data.created||new Date().toISOString())}::timestamptz) ON CONFLICT(id) DO NOTHING;`);}
 return lines.join('\n')+'\n';
}

async function main(){
 const root=path.resolve(import.meta.dirname,'..'),dir=path.join(root,'.private');await fs.mkdir(dir,{recursive:true,mode:0o700});
 const roster=JSON.parse(await fs.readFile(path.join(root,'roster.json'),'utf8'));
 const db=new DatabaseSync(path.join(root,'runtime/classroom.sqlite'),{readOnly:true});const source={};
 try{db.exec('BEGIN');for(const table of ['students','rounds','states','events','exams'])source[table]=db.prepare('SELECT * FROM '+table).all();db.exec('COMMIT');}finally{db.close();}
 const sql=buildPrivateMigration(roster,source),stamp=new Date().toISOString().replaceAll(/[:.]/g,'-');
 const snapshot=path.join(dir,stamp+'-cloud-source.json'),migration=path.join(dir,stamp+'-import-private.sql');
 await fs.writeFile(snapshot,JSON.stringify({roster,source},null,2),{mode:0o600,flag:'wx'});
 await fs.writeFile(migration,sql,{mode:0o600,flag:'wx'});
 console.log(JSON.stringify({roster:roster.length,counts:Object.fromEntries(Object.entries(source).map(([k,v])=>[k,v.length])),snapshot,migration}));
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)await main();
