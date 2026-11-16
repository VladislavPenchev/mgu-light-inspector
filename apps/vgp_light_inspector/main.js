'use strict';
const path=require('path'),mgu=require('./kit/mgu');
const {ReadOnlyDiag}=require('./kit/readonly-diag');
const {guardedSignals}=require('./policy');
const {Archive}=require('./archive');
const {Scan}=require('./scan');
mgu.run({
    async start(ctx){
        let speed=null,lastSpeed=0;
        const allowed=()=>speed!==null&&speed<0.5&&Date.now()-lastSpeed<5000&&scan.running&&!scan.cancelled&&Date.now()<=scan.deadline;
        const link=new ReadOnlyDiag(guardedSignals(ctx.signals,allowed),ctx.log,{gapMs:250,silentAfter:2});
        const archive=new Archive(path.join(ctx.dataDir,'light-reports'));
        const stationary=()=>speed!==null&&speed<0.5&&Date.now()-lastSpeed<5000;
        const scan=new Scan(link,archive,stationary);
        const sub=await ctx.signals.watch('de.bmw.infotainment.vehicle.Vehicle2','1',{
            statusCarSpeed2:v=>{const n=v&&v.speedVehicleCentreOfGravity;speed=typeof n==='number'&&Number.isFinite(n)&&n>=0&&n!==65535?n*0.015625:null;lastSpeed=Date.now();if(!stationary())scan.stop();}
        },ctx.log,{pollMs:2000});
        ctx.ui.onClick('BTN_SCAN',()=>scan.run());ctx.ui.onClick('BTN_STOP',()=>scan.stop());
        ctx.app.on('shutdown',()=>{scan.stop();if(sub.shutdown)sub.shutdown();});
        ctx.ui.onVisible((name,on)=>{if(name==='MAIN'&&!on)scan.stop();});
        ctx.loop('MAIN',2,async()=>{
            if(scan.running&&!stationary())scan.stop();
            const cv=ctx.canvas(1600,520),t=ctx.theme();cv.fillRect(0,0,1600,520,t.bg);
            cv.text('LIGHT INSPECTOR - READ ONLY',55,80,43,t.text,{font:'bold'});
            cv.text('NO coding / NO lamp tests / NO flashing / NO restore',55,145,25,'#64dca2');
            cv.text(scan.message.slice(0,100),55,215,24,t.text);
            cv.text('Stationary data: '+(stationary()?'ready':'unavailable')+'   Records: '+(scan.report?scan.report.rows.length:0),55,280,23,t.dim);
            cv.text('Report: '+(scan.file||'not created'),55,345,20,t.dim);
            cv.text('Identification archive only - NOT a recoverable coding or firmware backup.',55,410,23,'#ffcd75');
            cv.text('Start a scan manually while parked. Stop or leave this page to cancel.',55,465,22,t.dim);
            await ctx.ui.image('MAIN_GFX',cv);
        });
    }
});
