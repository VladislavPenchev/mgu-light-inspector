'use strict';
const {TARGETS,DIDS}=require('./policy');
function parse(reply,did){
    if(!reply)return {status:'no-response',raw:null};
    if(reply.length>65536)throw Error('Oversized diagnostic reply');
    const bytes=Array.from(reply),raw=Buffer.from(bytes).toString('hex').toUpperCase();
    if(bytes.length>=3&&bytes[0]===0x7F&&bytes[1]===0x22)return {status:'refused',nrc:bytes[2],raw};
    if(bytes.length<3||bytes[0]!==0x62||bytes[1]!==did>>8||bytes[2]!== (did&255))return {status:'invalid-reply',raw};
    const payload=Buffer.from(bytes.slice(3));
    return {status:'ok',raw,payloadHex:payload.toString('hex').toUpperCase(),ascii:payload.toString('latin1').replace(/[^\x20-\x7E]/g,'.').slice(0,160)};
}
class Scan {
    constructor(link,archive,allowed,now){this.link=link;this.archive=archive;this.allowed=allowed;this.now=now||Date.now;this.running=false;this.message='Ready. Identification only; no coding or restore.';}
    stop(){this.cancelled=true;if(this.link.cancel)this.link.cancel();}
    async run(){
        if(this.running)return;
        if(!this.allowed()) {this.message='Scan needs fresh stationary speed data';return;}
        this.running=true;this.cancelled=false;this.file=null;
        const report={schema:1,app:'vgp_light_inspector',version:'0.1.0',started:new Date().toISOString(),status:'in-progress',
            scope:'ECU identification only',restorable:false,codingBackup:false,firmwareBackup:false,
            welcomeCompatibility:'not determined',limitations:['No coding/configuration dump','No flash image','No restore operation','Missing/refused identifiers are not interpreted as support'],rows:[]};
        this.report=report;const deadline=this.now()+120000;this.deadline=deadline;
        try{
            this.file=this.archive.start();this.archive.save(report);
            await this.link.init();if(!this.link.ready)throw Error(this.link.error||'Diagnostic transport unavailable');
            for(const target of TARGETS){
                let misses=0;
                for(const entry of DIDS){
                    if(this.cancelled||!this.allowed()||this.now()>deadline)throw Error('Scan stopped or stationary data unavailable');
                    if(misses>=2)break;
                    const did=entry[0];this.message=target.name+' / '+did.toString(16).toUpperCase();
                    let timer,reply;
                    try{
                        reply=await Promise.race([this.link.read(target.address,did,1500),new Promise((resolve,reject)=>{
                            timer=setTimeout(()=>reject(Error('Diagnostic read exceeded time budget')),Math.min(12000,Math.max(1,deadline-this.now())));
                        })]);
                    }finally{clearTimeout(timer);}
                    const row=Object.assign({address:target.address,ecu:target.name,did,label:entry[1],at:new Date().toISOString()},parse(reply,did));
                    report.rows.push(row);misses=row.status==='no-response'?misses+1:0;
                    this.archive.save(report);
                }
            }
            report.status='complete';this.message='Identification saved. Welcome compatibility not yet determined.';
        }catch(e){report.status=this.cancelled?'cancelled':'incomplete';report.error=String(e.message||e);this.message=report.error;}
        finally{
            report.finished=new Date().toISOString();
            try{if(this.file)this.archive.save(report);}catch(e){this.message='ARCHIVE ERROR: '+e.message;}
            this.stop();this.running=false;
        }
    }
}
module.exports={Scan,parse};
