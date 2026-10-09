'use strict';
const {isIP}=require('node:net');

function normalizeAddress(address){
 if(typeof address!=='string')return null;
 const value=address.split('%')[0];
 if(isIP(value)===4)return value;
 if(isIP(value)!==6)return null;
 const normalized=new URL(`http://[${value}]/`).hostname.slice(1,-1);
 const mapped=normalized.match(/^::ffff:([0-9a-f]+):([0-9a-f]+)$/);
 if(mapped){const high=parseInt(mapped[1],16),low=parseInt(mapped[2],16);return [high>>>8,high&255,low>>>8,low&255].join('.');}
 return normalized;
}
function localAddresses(interfaces){
 return Object.values(interfaces).flat().map(net=>normalizeAddress(net?.address)).filter(Boolean);
}
function isTeacherAddress(address,interfaces){
 const normalized=normalizeAddress(address);
 if(!normalized)return false;
 return normalized==='::1'||normalized.startsWith('127.')||localAddresses(interfaces).includes(normalized);
}
function teacherOrigins(port,interfaces){
 return [...new Set(['localhost','127.0.0.1','::1',...localAddresses(interfaces)].map(address=>new URL(`http://${address.includes(':')?'['+address+']':address}:${port}`).origin))];
}
module.exports={isTeacherAddress,teacherOrigins};
