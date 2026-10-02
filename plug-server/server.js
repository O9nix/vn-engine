const http=require('http');
const fs=require('fs');
const path=require('path');
const ROOT=__dirname,DATA=path.join(ROOT,'data'),PUBLIC=path.join(ROOT,'public'),PLUGINS=path.join(DATA,'plugins'),DOCS=path.join(DATA,'docs');
for(const d of [PLUGINS,DOCS])fs.mkdirSync(d,{recursive:true});
const PORT=Number(process.env.PORT||8787),HOST=process.env.HOST||'127.0.0.1';
function send(res,status,body,type='application/json; charset=utf-8'){res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'});res.end(type.startsWith('application/json')?JSON.stringify(body,null,2):body);return true}
function readJson(f,fb){try{return JSON.parse(fs.readFileSync(f,'utf8'))}catch{return fb}}
function writeJson(f,v){fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,JSON.stringify(v,null,2)+'\n')}
function safe(s){return String(s||'').toLowerCase().replace(/[^a-z0-9._-]/g,'-').slice(0,100)}
function mp(id,v){return path.join(PLUGINS,safe(id),safe(v),'manifest.json')}
function body(req){return new Promise((ok,no)=>{let s='';req.on('data',c=>{s+=c;if(s.length>5000000)req.destroy()});req.on('end',()=>{try{ok(s?JSON.parse(s):{})}catch(e){no(e)}});req.on('error',no)})}
function index(){const a=[];if(!fs.existsSync(PLUGINS))return a;for(const id of fs.readdirSync(PLUGINS)){const d=path.join(PLUGINS,id);if(!fs.statSync(d).isDirectory())continue;for(const v of fs.readdirSync(d)){const f=mp(id,v);if(fs.existsSync(f))a.push(readJson(f,{}))}}return a}
function latest(a){const m=new Map();for(const p of a){const o=m.get(p.id);if(!o||String(p.version).localeCompare(String(o.version),undefined,{numeric:true})>0)m.set(p.id,p)}return [...m.values()]}
function validate(m){if(!m||!m.id||!m.name||!m.version||!m.entry)throw Error('manifest требует id, name, version и entry');if(!/^[a-z0-9][a-z0-9._-]{1,99}$/.test(m.id))throw Error('некорректный id');return {...m,publishedAt:m.publishedAt||new Date().toISOString()}}
async function api(req,res,u){
 if(req.method==='GET'&&u.pathname==='/api/health')return send(res,200,{ok:true,service:'vn-extension-hub'});
 if(req.method==='GET'&&u.pathname==='/api/plugins'){let a=latest(index()),q=(u.searchParams.get('q')||'').toLowerCase();if(q)a=a.filter(x=>JSON.stringify(x).toLowerCase().includes(q));return send(res,200,a)}
 let m=u.pathname.match(/^\/api\/plugins\/([^/]+)$/);if(req.method==='GET'&&m){const a=index().filter(x=>x.id===safe(m[1]));if(!a.length)return send(res,404,{error:'plugin_not_found'});return send(res,200,{latest:latest(a)[0],versions:a})}
 m=u.pathname.match(/^\/api\/plugins\/([^/]+)\/([^/]+)$/);if(req.method==='GET'&&m){const f=mp(m[1],m[2]);if(!fs.existsSync(f))return send(res,404,{error:'version_not_found'});return send(res,200,readJson(f,{}))}
 if(req.method==='POST'&&u.pathname==='/api/plugins')return body(req).then(b=>{const man=validate(b.manifest||b),d=path.dirname(mp(man.id,man.version));fs.mkdirSync(d,{recursive:true});writeJson(path.join(d,'manifest.json'),man);if(typeof b.code==='string')fs.writeFileSync(path.join(d,'extension.js'),b.code);send(res,201,man)}).catch(e=>send(res,400,{error:e.message}));
 if(req.method==='GET'&&u.pathname.startsWith('/api/docs/')){let rel=u.pathname.slice(10),f=path.join(DOCS,rel.endsWith('.json')?rel:rel+'.json');if(!f.startsWith(DOCS)||!fs.existsSync(f))return send(res,404,{error:'doc_not_found'});return send(res,200,readJson(f,{}))}
 return false}
function staticFile(req,res,u){
 if(u.pathname.startsWith('/plugins/')){
  const rel=u.pathname.slice('/plugins/'.length),f=path.resolve(PLUGINS,rel);
  if(!f.startsWith(path.resolve(PLUGINS)))return send(res,403,{error:'forbidden'});
  if(!fs.existsSync(f)||!fs.statSync(f).isFile())return send(res,404,{error:'plugin_file_not_found'});
  const t={'.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8'}[path.extname(f)]||'application/octet-stream';
  res.writeHead(200,{'Content-Type':t,'Cache-Control':'no-store','Access-Control-Allow-Origin':'*'});fs.createReadStream(f).pipe(res);return true;
 }
 let rel=u.pathname==='/'?'/index.html':u.pathname,f=path.resolve(PUBLIC,'.'+rel);
 if(!f.startsWith(path.resolve(PUBLIC)))return send(res,403,{error:'forbidden'});
 if(!fs.existsSync(f)||!fs.statSync(f).isFile())return send(res,404,{error:'not_found'});
 const t={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css'}[path.extname(f)]||'application/octet-stream';res.writeHead(200,{'Content-Type':t,'Access-Control-Allow-Origin':'*'});fs.createReadStream(f).pipe(res);return true
}
http.createServer(async(req,res)=>{const u=new URL(req.url,`http://${req.headers.host||HOST}`);try{if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'});return res.end()}if(await api(req,res,u))return;staticFile(req,res,u)}catch(e){send(res,500,{error:e.message})}}).listen(PORT,HOST,()=>console.log(`VN Extension Hub: http://${HOST}:${PORT}`));
