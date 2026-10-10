import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs/promises';

test('private migration preserves identities, progress and events and is safe to replay',async t=>{
 assert.ok(await fs.stat(new URL('../tools/prepare-cloud-data.mjs',import.meta.url)).catch(()=>false),'private data migration exists');
 const {buildPrivateMigration}=await import('../tools/prepare-cloud-data.mjs');
 const data={students:[{id:'x',classId:'601',name:"虚构'同学",manual:0}],rounds:[{classId:'601',n:2}],states:[{sid:'x',round:'r1',json:JSON.stringify({student:{id:'x'},points:10})}],events:[{id:'event-x',sid:'x',round:'r1'}],exams:[]};
 const roster=[{id:'x',classId:'601',name:"虚构'同学"}];
 const sql=buildPrivateMigration(roster,data),pg=await PGlite.create();t.after(()=>pg.close());
 await pg.exec(await fs.readFile(new URL('../netlify/database/migrations/20261010090000_classroom.sql',import.meta.url),'utf8'));
 await pg.exec(sql);assert.equal((await pg.query('SELECT name FROM lesson4_students')).rows[0].name,"虚构'同学");
 assert.equal((await pg.query('SELECT data FROM lesson4_states')).rows[0].data.points,10);
 assert.equal((await pg.query('SELECT n FROM lesson4_rounds WHERE class_id=$1',['601'])).rows[0].n,2);
 await pg.query('UPDATE lesson4_states SET data=$1',[JSON.stringify({student:{id:'x'},points:30})]);
 await pg.exec(sql);assert.equal((await pg.query('SELECT data FROM lesson4_states')).rows[0].data.points,30);
 assert.equal((await pg.query('SELECT COUNT(*) AS n FROM lesson4_events')).rows[0].n,1);
 assert.throws(()=>buildPrivateMigration([...roster,...roster],data),/重复/);
});
