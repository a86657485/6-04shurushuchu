import {getDatabase} from '@netlify/database';
import {createClassroomHandler} from '../../cloud/service.mjs';
import {applyPrivateDataMigration} from '../../cloud/private-data-migration.mjs';

let initialization;
async function initialize(){
 const {pool}=getDatabase();
 const db={query:(...args)=>pool.query(...args),transaction:async fn=>{
  const client=await pool.connect();
  try{await client.query('BEGIN');const value=await fn({query:(...args)=>client.query(...args),exec:sql=>client.query(sql)});await client.query('COMMIT');return value;}
  catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
 }};
 try{
  await applyPrivateDataMigration(db);
  return createClassroomHandler({db,teacherKey:process.env.LESSON4_TEACHER_ACCESS_KEY||''});
 }catch(e){await pool.end();throw e;}
}
export default async req=>{
 try{
  initialization??=initialize().catch(e=>{initialization=null;throw e;});
  return await (await initialization)(req);
 }catch(e){console.error('Cloud classroom startup failed:',e.code||e.name);return Response.json({error:'课堂后端尚未连接，请联系老师；本机待同步记录会保留。'},{status:503,headers:{'Cache-Control':'no-store'}});}
};
export const config={path:['/api/*','/teacher','/teacher/*','/teacher.html','/teacher.html/*','/test','/test/*','/teacher-microphone','/teacher-microphone/*','/teacher-microphone.html','/teacher-microphone.html/*']};
