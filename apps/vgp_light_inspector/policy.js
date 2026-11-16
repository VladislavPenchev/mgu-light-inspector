'use strict';
// An allowlist, not a blacklist. No caller-provided ECU, SID, DID or bytes.
const IFACE='com.harman.infotainment.systemfunctions.tasu.tasu.InternalTasu';
const INSTANCE='SystemFunctionsInternalTasuInst1';
// Expected families were confirmed by the owner's first F150 capture.
const TARGETS=Object.freeze([
    {address:0x40,name:'BDC_G05',identity:'0F2680'},
    {address:0x43,name:'FLM02_L',identity:'0F26C0'},
    {address:0x44,name:'FLM02_R',identity:'0F26D0'}
].map(Object.freeze));
// Explicitly documented UDS 22 reads in each matching PRG, Default mode.
const DIDS=Object.freeze([
    [0xF150,'BMW SGBD identifier'],[0xF101,'Current SVK identification (raw)'],
    [0xF18A,'System supplier identifier'],[0xF18B,'ECU manufacturing data'],
    [0xF18C,'ECU serial number']
].map(Object.freeze));
function validate(method,r){
    if(method!=='sendTasuRequest'||!r||r.serviceID!==0x22||r.sourceAddress!==0xF2||r.subroutineID!==0||r.deadlockTime!==0)throw Error('Blocked: read-only transport envelope');
    if(!TARGETS.some(t=>t.address===r.targetAddress))throw Error('Blocked: ECU not allowlisted');
    if(!(Buffer.isBuffer(r.udsData)||Array.isArray(r.udsData))||r.udsDataLength!==2||r.udsData.length!==2)throw Error('Blocked: identification reads only');
    if(!Array.from(r.udsData).every(x=>Number.isInteger(x)&&x>=0&&x<=255))throw Error('Blocked: invalid bytes');
    const did=(r.udsData[0]<<8)|r.udsData[1];
    if(!DIDS.some(d=>d[0]===did))throw Error('Blocked: DID not allowlisted');
}
function guardedSignals(signals,allowed){
    let proxy;
    return {
        async proxy(iface,instance){if(iface!==IFACE||instance!==INSTANCE)throw Error('Blocked: proxy');proxy=await signals.proxy(iface,instance);return proxy;},
        on(p,event,fn,log){if(p!==proxy||event!=='sendTasuResponse')throw Error('Blocked: subscription');return signals.on(p,event,fn,log);},
        onAvailable(p,fn){if(p!==proxy)throw Error('Blocked: availability');return signals.onAvailable(p,fn);},
        call(p,method,request,timeout){
            if(p!==proxy)throw Error('Blocked: foreign proxy');validate(method,request);
            // Re-check directly before sending; stop/movement cancels delayed retries too.
            if(!allowed())throw Error('Stopped: stationary scan permission expired');
            const copy=Object.assign({},request,{udsData:Buffer.from(request.udsData)});
            return signals.call(p,method,copy,Math.min(timeout||3000,3000));
        }
    };
}
module.exports={TARGETS,DIDS,IFACE,INSTANCE,validate,guardedSignals};
