const test=require('node:test');
const assert=require('node:assert/strict');

test('teacher address check normalizes IPv4, mapped IPv6 and IPv6 without trusting headers',()=>{
 const {isTeacherAddress}=require('../teacher-access.cjs');
 const interfaces={en0:[{address:'192.168.1.30',family:'IPv4'}],en1:[{address:'2001:0db8:0:0:0:0:0:40',family:'IPv6'}]};
 for(const address of ['127.0.0.1','127.2.3.4','::1','::ffff:127.0.0.1','192.168.1.30','::ffff:192.168.1.30','::ffff:c0a8:11e','2001:db8::40'])assert.equal(isTeacherAddress(address,interfaces),true,address);
 for(const address of ['192.168.1.31','::ffff:192.168.1.31','2001:db8::41','localhost','127.0.0.1.attacker.example',undefined,''])assert.equal(isTeacherAddress(address,interfaces),false,String(address));
});

test('trusted origins deduplicate normalized local addresses and include loopbacks',()=>{
 const {teacherOrigins}=require('../teacher-access.cjs');
 const origins=teacherOrigins(43210,{en0:[{address:'192.168.1.30',family:'IPv4'},{address:'::ffff:192.168.1.30',family:'IPv6'},{address:'not-an-ip',family:'IPv4'}],en1:[{address:'2001:0db8:0:0:0:0:0:40',family:'IPv6'}]});
 assert.deepEqual(origins.sort(),['http://localhost:43210','http://127.0.0.1:43210','http://[::1]:43210','http://192.168.1.30:43210','http://[2001:db8::40]:43210'].sort());
});
