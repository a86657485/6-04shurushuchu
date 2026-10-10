import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

// The optional DML file is private deployment input, never a public asset or Git source.
export async function applyPrivateDataMigration(db,file=path.join(process.cwd(),'cloud','initial-data.sql')){
 let sql;try{sql=await fs.readFile(file,'utf8');}catch(e){if(e.code==='ENOENT')return {applied:false};throw e;}
 const checks=JSON.parse(await fs.readFile(file.replace(/\.sql$/,'-checks.json'),'utf8'));
 const version='20261010-initial-classroom-data',digest=crypto.createHash('sha256').update(sql).digest('hex');
 return db.transaction(async tx=>{
  await tx.query('SELECT pg_advisory_xact_lock(6041010)');
  const prior=(await tx.query('SELECT digest FROM lesson4_data_migrations WHERE version=$1',[version])).rows[0];
  if(prior){if(prior.digest!==digest)throw Error('已应用的私有迁移内容发生变更，请保留原文件并新增迁移');return {applied:false};}
  await tx.query('LOCK TABLE lesson4_rounds IN EXCLUSIVE MODE');
  for(const state of checks.states){
   const conflict=(await tx.query('SELECT sid FROM lesson4_states WHERE sid=$1 AND round=$2 AND data<>$3::jsonb',[state.sid,state.round,state.json])).rows;
   if(conflict.length)throw Error('云端已存在不同的学习记录，导入已停止；两份记录均保留');
  }
  await tx.exec(sql);
  await tx.query('INSERT INTO lesson4_data_migrations(version,digest) VALUES($1,$2)',[version,digest]);
  return {applied:true};
 });
}
