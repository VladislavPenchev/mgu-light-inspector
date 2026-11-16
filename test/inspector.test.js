'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path');
const {TARGETS,DIDS,validate,guardedSignals,IFACE,INSTANCE}=require('../apps/vgp_light_inspector/policy');
const {Scan,parse}=require('../apps/vgp_light_inspector/scan');
const {Archive,hash}=require('../apps/vgp_light_inspector/archive');
const envelope=(sid=0x22)=>({sourceAddress:0xF2,targetAddress:0x43,serviceID:sid,subroutineID:0,deadlockTime:0,udsDataLength:2,udsData:[0xF1,0x01]});
test('only UDS 22 and exact identification targets/DIDs can leave the app',()=>{
    for(let sid=0;sid<=255;sid++)if(sid!==0x22)assert.throws(()=>validate('sendTasuRequest',envelope(sid)));
    TARGETS.forEach(t=>DIDS.forEach(d=>validate('sendTasuRequest',Object.assign(envelope(),{targetAddress:t.address,udsData:[d[0]>>8,d[0]&255]}))));
    [0xDF,0x12,0,256].forEach(a=>assert.throws(()=>validate('sendTasuRequest',Object.assign(envelope(),{targetAddress:a}))));
    [[0xD5,0x42],[0x45,0x30],[0xF1,0x90],[0xF1,0x91,0]].forEach(b=>assert.throws(()=>validate('sendTasuRequest',Object.assign(envelope(),{udsData:b,udsDataLength:b.length}))));
    assert.throws(()=>validate('otherMethod',envelope()));
});
test('transport guard rechecks permission, clones bytes and rejects unrelated proxy access',async()=>{
    let enabled=true,calls=0;const p={},base={proxy:async()=>p,on(){},onAvailable(){},call(proxy,m,r){calls++;assert.notEqual(r.udsData,req.udsData);return 'NO_ERROR';}};
    const guard=guardedSignals(base,()=>enabled),req=envelope();await guard.proxy(IFACE,INSTANCE);guard.call(p,'sendTasuRequest',req,9000);assert.equal(calls,1);
    enabled=false;assert.throws(()=>guard.call(p,'sendTasuRequest',req));assert.equal(calls,1);
    await assert.rejects(guard.proxy('other','1'));assert.throws(()=>guard.on(p,'wrong',()=>{}));
});
test('parser records refusals and never turns identification into compatibility claims',()=>{
    assert.equal(parse([0x7F,0x22,0x31],0xF191).status,'refused');
    assert.equal(parse([0x62,0xF1,0x91,65,66],0xF191).ascii,'AB');
    assert.equal(parse([0x62,0xF1,0x90,65],0xF191).status,'invalid-reply');
    assert.equal(parse(null,0xF191).status,'no-response');
});
test('manual scan reads only finite allowlist, incrementally archives, no resets/writes',async()=>{
    const rows=[],saved=[],link={ready:true,async init(){},async read(a,d){rows.push([a,d]);return d===0xF150 ? [0x62,0xF1,0x50].concat(Array.from(Buffer.from(TARGETS.find(t=>t.address===a).identity,'hex'))) : [0x62,d>>8,d&255,65];},cancel(){}};
    const archive={start:()=> 'a.json',save:r=>saved.push(JSON.parse(JSON.stringify(r)))};
    const scan=new Scan(link,archive,()=>true);await scan.run();
    assert.equal(rows.length,TARGETS.length*DIDS.length);assert.equal(saved.length,rows.length+2);
    assert.equal(scan.report.status,'complete');assert.equal(scan.report.restorable,false);assert.equal(scan.report.welcomeCompatibility,'not determined');
});
test('unknown stationary state sends no request; cancellation archives partial report',async()=>{
    let calls=0;const archive={start:()=> 'b.json',save:()=>{}},link={ready:true,async init(){},async read(a,d){calls++;scan.stop();return [0x62,d>>8,d&255,65];},cancel(){}};
    const blocked=new Scan(link,archive,()=>false);await blocked.run();assert.equal(calls,0);
    const scan=new Scan(link,archive,()=>true);await scan.run();assert.equal(calls,1);assert.equal(scan.report.status,'cancelled');
});
test('unidentified ECU is skipped immediately; repeated scans retain immutable baseline and prior files',async()=>{
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'light-inspector-'));
    try{
        const ar=new Archive(dir);ar.start();const first=ar.name;
        const report={schema:1,status:'complete',restorable:false,codingBackup:false,firmwareBackup:false,rows:[{status:'ok'}]};
        ar.save(report);const baseline=fs.readFileSync(path.join(dir,'first-complete-identification.json'));
        assert.equal(hash(fs.readFileSync(path.join(dir,first))),fs.readFileSync(path.join(dir,first+'.sha256'),'utf8').split(' ')[0]);
        ar.start();assert.notEqual(ar.name,first);ar.save(Object.assign({},report,{rows:[{status:'refused'}]}));
        assert.deepEqual(fs.readFileSync(path.join(dir,'first-complete-identification.json')),baseline);assert.ok(fs.existsSync(path.join(dir,first)));
        let reads=0;const s=new Scan({ready:true,async init(){},read:async()=>{reads++;return null;},cancel(){}},{start:()=> 'test',save(){}},()=>true);await s.run();assert.equal(reads,3);
    }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('archive start failure on a second scan never overwrites a previous report',async()=>{
    let fail=false,saves=0;const ar={start(){if(fail)throw Error('storage full');return 'old';},save(){saves++;}};
    const s=new Scan({ready:true,async init(){},read:async()=>null,cancel(){}},ar,()=>true);
    await s.run();const before=saves;fail=true;await s.run();assert.equal(saves,before);assert.equal(s.file,null);
});

test('mismatched SGBD family prevents every further read to that address',async()=>{
 const requests=[],s=new Scan({ready:true,async init(){},async read(a,d){requests.push([a,d]);return [0x62,0xF1,0x50,0x0F,0x26,0x81];},cancel(){}},{start:()=> 'mismatch.json',save(){}},()=>true);
 await s.run();assert.equal(requests.length,3);assert.ok(requests.every(x=>x[1]===0xF150));assert.ok(s.report.rows.every(x=>x.familyMatch===false));
});
test('only documented new identification fields are allowlisted',()=>{
 assert.deepEqual(DIDS.map(d=>d[0]),[0xF150,0xF101,0xF18A,0xF18B,0xF18C]);
 [0xF180,0xF181,0xF182,0xF187,0xF188,0xF189,0xF191].forEach(d=>assert.throws(()=>validate('sendTasuRequest',Object.assign(envelope(),{udsData:[d>>8,d&255]}))));
});
