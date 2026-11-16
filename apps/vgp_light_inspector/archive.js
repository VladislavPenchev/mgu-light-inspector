'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
class Archive {
    constructor(dir){this.dir=dir;}
    start(){
        this.name=null;
        if(!fs.existsSync(this.dir))fs.mkdirSync(this.dir,{mode:0o700});
        const bytes=fs.readdirSync(this.dir).reduce((n,f)=>n+fs.statSync(path.join(this.dir,f)).size,0);
        if(bytes>16*1024*1024)throw Error('Report storage full; export existing reports before another scan');
        this.name=new Date().toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomBytes(6).toString('hex')+'.json';
        // Reserve without overwriting an earlier report.
        const fd=fs.openSync(path.join(this.dir,this.name),'wx',0o600);fs.closeSync(fd);
        return this.name;
    }
    save(report){
        if(!this.name)throw Error('No archive selected');
        const data=JSON.stringify(report,null,2)+'\n',file=path.join(this.dir,this.name),temp=file+'.tmp';
        const fd=fs.openSync(temp,'w',0o600);
        try{fs.writeFileSync(fd,data);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
        fs.renameSync(temp,file);
        fs.writeFileSync(file+'.sha256',hash(data)+'  '+this.name+'\n',{mode:0o600});
        // Freeze first completed identification capture; this is NOT a restore image.
        const baseline=path.join(this.dir,'first-complete-identification.json');
        if(report.status==='complete'&&report.rows.some(r=>r.status==='ok')&&!fs.existsSync(baseline)){
            fs.writeFileSync(baseline,data,{flag:'wx',mode:0o600});fs.writeFileSync(baseline+'.sha256',hash(data)+'\n',{flag:'wx',mode:0o600});
        }
        return file;
    }
}
module.exports={Archive,hash};
