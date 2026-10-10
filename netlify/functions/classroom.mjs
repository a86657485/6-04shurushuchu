import {getDatabase} from '@netlify/database';
import {createClassroomHandler} from '../../cloud/service.mjs';

let handler;
export default async req=>{
 try{
  if(!handler){
   const {pool}=getDatabase();
   const db={query:(...args)=>pool.query(...args),transaction:async fn=>{
    const client=await pool.connect();
    try{await client.query('BEGIN');const value=await fn(client);await client.query('COMMIT');return value;}
    catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
   }};
   handler=createClassroomHandler({db,teacherKey:process.env.LESSON4_TEACHER_ACCESS_KEY||''});
  }
  return await handler(req);
 }catch(e){console.error('Cloud classroom startup failed:',String(e.message||e.name).replace(/postgres(?:ql)?:\/\/\S+/g,'[database connection redacted]'));return Response.json({error:'课堂后端尚未连接，请联系老师；本机待同步记录会保留。'},{status:503,headers:{'Cache-Control':'no-store'}});}
};
export const config={path:['/api/*','/teacher','/teacher/*','/teacher.html','/teacher.html/*','/test','/test/*','/teacher-microphone','/teacher-microphone/*','/teacher-microphone.html','/teacher-microphone.html/*']};
