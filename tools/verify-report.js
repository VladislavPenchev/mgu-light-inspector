'use strict';
const fs=require('fs'),crypto=require('crypto');
const file=process.argv[2];
if(!file){console.error('Usage: node tools/verify-report.js path/to/report.json');process.exit(2);}
try{
    const data=fs.readFileSync(file),expected=fs.readFileSync(file+'.sha256','utf8').trim().split(/\s/)[0];
    const actual=crypto.createHash('sha256').update(data).digest('hex');
    if(actual!==expected)throw Error('Checksum mismatch: report may be incomplete or modified');
    const r=JSON.parse(data);if(r.schema!==1||r.restorable!==false||r.codingBackup!==false||r.firmwareBackup!==false)throw Error('Unexpected report schema');
    console.log('SHA-256 verified. Status: '+r.status+'. Records: '+r.rows.length+'. NOT a restore/coding/firmware backup.');
}catch(e){console.error(e.message);process.exit(1);}
