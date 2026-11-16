'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
test('real entrypoint starts without diagnostic traffic; missing speed blocks manual scan',async()=>{
    let impl,init=0,reads=0;const clicks={},handlers={};
    class FakeLink{constructor(){}init(){init++;}read(){reads++;}cancel(){}}
    const dir=path.join(__dirname,'../apps/vgp_light_inspector');
    const fakeRequire=n=>n==='./kit/mgu'?{run:x=>{impl=x;}}:n==='./kit/readonly-diag'?{ReadOnlyDiag:FakeLink}:n.startsWith('./')?require(path.join(dir,n)):require(n);
    vm.runInNewContext(fs.readFileSync(path.join(dir,'main.js'),'utf8'),{require:fakeRequire,Date,Number});
    const ctx={dataDir:osTemp(),log:console,signals:{async watch(i,instance,fields,log,opts){assert.equal(opts.pollMs,2000);return {shutdown(){}};}},
        ui:{onClick(n,fn){clicks[n]=fn;},onVisible(fn){handlers.visible=fn;}},app:{on(n,fn){handlers[n]=fn;}},loop(){}};
    await impl.start(ctx);assert.equal(init,0);assert.equal(reads,0);
    await clicks.BTN_SCAN();assert.equal(init,0);assert.equal(reads,0);
    clicks.BTN_STOP();handlers.visible('MAIN',false);handlers.shutdown();
});
function osTemp(){return require('os').tmpdir();}
