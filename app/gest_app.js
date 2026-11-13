/* App Gestionale (Dashboard + Preventivatore) sul telefono · Maestri Ombra Luce
 * - accesso con PIN (Stefano / Irene) verso lo script Gestionale.gs
 * - la cartella PLANETARIO su Google Drive diventa una "cartella" per il CRM (stessa interfaccia della cartella del PC)
 * - la pagina vera (Dashboard_Clienti.html o Configuratore_Preventivi_Completo.html) si scarica da PLANETARIO,
 *   resta salvata nel telefono e si riscarica solo quando cambia. */
(function(){
'use strict';
var API = window.GEST_API, PAGINA = window.GEST_PAGINA, TK = 'gest_tok', NM = 'gest_nome';
var $ = function(id){ return document.getElementById(id); };
function tok(){ try{ return localStorage.getItem(TK)||''; }catch(e){ return ''; } }
function msg(t){ var m=$('gsMsg'); if(m) m.textContent=t; }
function bar(p){ var b=document.querySelector('#gsBar i'); if(b) b.style.width=Math.round(p*100)+'%'; }
function errore(t){ var e=$('gsErr'); if(!e){ e=document.createElement('div'); e.id='gsErr'; document.body.appendChild(e); }
  e.style.cssText='display:block;position:fixed;left:10px;right:10px;bottom:10px;z-index:99999;background:#fdecea;color:#8a1c12;border-radius:10px;padding:12px 14px;font:13px/1.4 system-ui,sans-serif;white-space:pre-wrap;word-break:break-word';
  e.textContent=t; }

/* ---------- chiamate allo script ---------- */
function rpc(f, a){
  return fetch(API, {method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body:JSON.stringify({f:f, a:a||[]}), redirect:'follow'})
    .then(function(r){ if(!r.ok) throw new Error('Server non raggiungibile ('+r.status+')'); return r.json(); }, function(){ var e=new Error('Connessione assente'); e.rete=true; throw e; })
    .then(function(j){ if(j && j.ok) return j.r; var e=new Error(j&&j.errore||'Errore dal server'); e.codice=j&&j.codice;
      if(e.codice==='login'){ try{ localStorage.removeItem(TK); }catch(_){} } throw e; });
}
window.GEST = { rpc: rpc, esci: function(){ try{ localStorage.removeItem(TK); }catch(e){} location.reload(); }, nome: function(){ try{ return localStorage.getItem(NM)||''; }catch(e){ return ''; } } };

/* ---------- PLANETARIO come cartella ---------- */
var LISTE = new Map(), CONT = new Map(), TTL = 15000;
function unisciP(a,b){ return a ? a+'/'+b : b; }
function nonTrovato(n){ var e = new Error('Non trovato: '+n); e.name='NotFoundError'; return e; }
function lista(p, fresca){ var c=LISTE.get(p); if(c && !fresca && Date.now()-c.t<TTL) return c.pr;
  var pr = rpc('gElenca',[tok(), p]).catch(function(e){ LISTE.delete(p); if(e.codice==='nontrovato') throw nonTrovato(p); throw e; });
  LISTE.set(p,{t:Date.now(), pr:pr}); return pr; }
function invalida(p){ LISTE.delete(p); }
function b64aByte(s){ var b=atob(s), u=new Uint8Array(b.length); for(var i=0;i<b.length;i++) u[i]=b.charCodeAt(i); return u; }
function byteAb64(u){ var s='', k=0x8000; for(var i=0;i<u.length;i+=k) s+=String.fromCharCode.apply(null, u.subarray(i,i+k)); return btoa(s); }
async function leggiTutto(p){ var x=await rpc('gLeggi',[tok(), p, 0]), parti=[b64aByte(x.b64)];
  for(var i=1;i<x.tot;i++){ var y=await rpc('gLeggi',[tok(), p, i]); parti.push(b64aByte(y.b64)); } return {parti:parti, t:x.t, m:x.m}; }

function RFile(dir, nome){ this.kind='file'; this.name=nome; this._d=dir; this._p=unisciP(dir,nome); }
RFile.prototype.queryPermission = RFile.prototype.requestPermission = function(){ return Promise.resolve('granted'); };
RFile.prototype.isSameEntry = function(o){ return Promise.resolve(!!o && o._p===this._p); };
RFile.prototype.getFile = async function(){
  var L = await lista(this._d), e = L.find(function(x){ return x.k==='f' && x.n===this.name; }, this); if(!e) throw nonTrovato(this.name);
  var c = CONT.get(this._p); if(!c || c.m!==e.m){ var r=await leggiTutto(this._p); c={m:e.m, parti:r.parti, t:r.t}; if(e.s < 3e6) CONT.set(this._p,c); }
  return new File(c.parti, this.name, {type:c.t||'', lastModified:e.m});
};
RFile.prototype.createWritable = async function(){ var self=this, pezzi=[];
  return { write: async function(d){ if(d && typeof d==='object' && d.type==='write') d=d.data; if(d && typeof d==='object' && d.type) return; pezzi.push(d); },
    seek: async function(){}, truncate: async function(n){ if(!n) pezzi=[]; }, abort: async function(){ pezzi=[]; },
    close: async function(){ var b = new Blob(pezzi), u = new Uint8Array(await b.arrayBuffer());
      await rpc('gScrivi',[tok(), self._p, byteAb64(u), {b64:true}]); CONT.delete(self._p); invalida(self._d); } };
};
function RDir(p, nome){ this.kind='directory'; this.name=nome; this._p=p; }
RDir.prototype.queryPermission = RDir.prototype.requestPermission = function(){ return Promise.resolve('granted'); };
RDir.prototype.isSameEntry = function(o){ return Promise.resolve(!!o && o._p===this._p && o.kind==='directory'); };
RDir.prototype.getDirectoryHandle = async function(n, o){ var L=await lista(this._p), p=unisciP(this._p,n);
  if(!L.some(function(x){ return x.k==='d' && x.n===n; })){ if(!(o&&o.create)) throw nonTrovato(n); await rpc('gCartella',[tok(), p]); invalida(this._p); }
  return new RDir(p, n); };
RDir.prototype.getFileHandle = async function(n, o){ var L=await lista(this._p);
  if(!L.some(function(x){ return x.k==='f' && x.n===n; }) && !(o&&o.create)) throw nonTrovato(n); return new RFile(this._p, n); };
RDir.prototype.removeEntry = async function(n){ await rpc('gElimina',[tok(), unisciP(this._p,n)]); invalida(this._p); LISTE.delete(unisciP(this._p,n)); CONT.delete(unisciP(this._p,n)); };
RDir.prototype.resolve = async function(h){ return h && h._p && h._p.indexOf(this._p)===0 ? h._p.slice(this._p.length).split('/').filter(Boolean) : null; };
RDir.prototype.entries = async function*(){ var L=await lista(this._p); for(var i=0;i<L.length;i++){ var x=L[i]; yield [x.n, x.k==='d' ? new RDir(unisciP(this._p,x.n), x.n) : new RFile(this._p, x.n)]; } };
RDir.prototype.values = async function*(){ for await (var e of this.entries()) yield e[1]; };
RDir.prototype.keys = async function*(){ for await (var e of this.entries()) yield e[0]; };
RDir.prototype[Symbol.asyncIterator] = RDir.prototype.entries;
window.CARTELLA_REMOTA = new RDir('', 'PLANETARIO');

/* ---------- memoria delle pagine nel telefono ---------- */
function db(){ return new Promise(function(ok){ try{ var r=indexedDB.open('gest_pagine',1); r.onupgradeneeded=function(){ r.result.createObjectStore('p'); }; r.onsuccess=function(){ ok(r.result); }; r.onerror=function(){ ok(null); }; }catch(e){ ok(null); } }); }
function leggi(d,k){ return new Promise(function(ok){ if(!d) return ok(null); try{ var q=d.transaction('p').objectStore('p').get(k); q.onsuccess=function(){ ok(q.result||null); }; q.onerror=function(){ ok(null); }; }catch(e){ ok(null); } }); }
function scrivi(d,k,v){ try{ d && d.transaction('p','readwrite').objectStore('p').put(v,k); }catch(e){} }

/* ---------- accesso con PIN ---------- */
function login(){ return new Promise(function(ok){
  var b=$('gsBoot'); b.innerHTML='<img src="'+window.GEST_LOGO+'" alt="Maestri Ombra Luce" class="gsLogo"><b class="gsTit">GESTIONALE</b>'+
    '<form id="gsF" class="gsCard"><h2>Accesso</h2><label>Chi sei<select id="gsU"><option value="stefano">Stefano</option><option value="irene">Irene</option></select></label>'+
    '<label>PIN<input id="gsP" type="password" inputmode="numeric" autocomplete="current-password" required></label><button>Entra</button><p id="gsE" role="alert"></p></form>';
  try{ var u=localStorage.getItem('gest_ultimo'); if(u) $('gsU').value=u; }catch(e){}
  $('gsP').focus();
  $('gsF').onsubmit=function(ev){ ev.preventDefault(); var bt=this.querySelector('button'); bt.disabled=true; bt.textContent='Controllo…'; $('gsE').textContent='';
    rpc('gLogin',[$('gsU').value, $('gsP').value]).then(function(r){ try{ localStorage.setItem(TK,r.token); localStorage.setItem(NM,r.nome); localStorage.setItem('gest_ultimo',$('gsU').value); }catch(e){}
      b.innerHTML='<img src="'+window.GEST_LOGO+'" alt="" class="gsLogo"><div id="gsBar"><i></i></div><div id="gsMsg">Ciao '+r.nome+'…</div>'; ok(); })
    .catch(function(e){ $('gsE').textContent=e.message; bt.disabled=false; bt.textContent='Entra'; $('gsP').select(); }); };
}); }

/* ---------- avvio: scarico (o riprendo) la pagina e la apro ---------- */
async function avvia(){
  if(!API){ errore('Manca l’indirizzo dello script Gestionale (config.js)'); return; }
  if(!tok()) await login();
  var d=await db(), c=await leggi(d,PAGINA), R=null;
  try{ R = await rpc('gElenca',[tok(), '']); }
  catch(e){ if(e.codice==='login'){ await login(); return avvia(); }
    if(!c) throw e; msg('Senza connessione: uso la copia salvata'); }
  /* versione = pagina + script che la pagina carica dalla cartella (es. Catalogo_ordini.js) */
  var vf=function(n){ var x=R&&R.find(function(y){ return y.k==='f' && y.n===n; }); return x ? x.m+'-'+x.s : 'manca'; };
  var html, deps;
  if(!R || (c && c.v===vf(PAGINA) && (c.deps||[]).every(function(n){ return c.dv[n]===vf(n); }))){ html=c.h; }
  else { if(vf(PAGINA)==='manca') throw new Error('In PLANETARIO non trovo '+PAGINA);
    msg(c?'Scarico l’aggiornamento…':'Scarico l’app (solo la prima volta)…'); bar(.03);
    var x=await rpc('gLeggi',[tok(), PAGINA, 0]), parti=[b64aByte(x.b64)]; bar(1/x.tot);
    for(var i=1;i<x.tot;i++){ var y=await rpc('gLeggi',[tok(), PAGINA, i]); parti.push(b64aByte(y.b64)); bar((i+1)/x.tot); }
    html = await new Blob(parti).text();
    deps=[]; html.replace(/<script src="([\w.-]+\.js)"><\/script>/g, function(m,n){ if(deps.indexOf(n)<0) deps.push(n); return m; });
    var dv={}, testi={};
    for(var k=0;k<deps.length;k++){ var n=deps[k]; dv[n]=vf(n); if(dv[n]==='manca'){ testi[n]=''; continue; } msg('Scarico '+n+'…');
      var z=await rpc('gLeggi',[tok(), n, 0]), pz=[b64aByte(z.b64)]; for(var j=1;j<z.tot;j++){ var w=await rpc('gLeggi',[tok(), n, j]); pz.push(b64aByte(w.b64)); }
      testi[n]=await new Blob(pz).text(); }
    html = html.replace(/<script src="([\w.-]+\.js)"><\/script>/g, function(m,n){ return n in testi ? '<script>'+testi[n].replace(/<\/script/gi,'<\\/script')+'<\/script>' : m; });
    scrivi(d,PAGINA,{v:vf(PAGINA), h:html, deps:deps, dv:dv}); }
  msg('Avvio…');
  /* dentro l'app: segno la modalità e il nome di chi usa il telefono, prima di tutti gli script della pagina */
  var pre = '<script>window.MODO_APP=true;window.CRM_OPERATORE_APP='+JSON.stringify(GEST.nome())+';<\/script><link rel="manifest" href="manifest.webmanifest"><meta name="theme-color" content="#ffffff"><link rel="apple-touch-icon" href="apple-touch-icon.png"><link rel="stylesheet" href="app_mobile.css">';
  html = html.replace(/<head([^>]*)>/i, function(m){ return m+pre; });
  document.open(); document.write(html); document.close();
  dopo();
}
/* link interni (dashboard ⇄ preventivatore) nella stessa finestra dell'app */
function dopo(){
  var interna=function(u){ try{ var x=new URL(u, location.href); return x.origin===location.origin && /\.html$/i.test(x.pathname) ? x : null; }catch(e){ return null; } };
  document.addEventListener('click', function(ev){ var a=ev.target.closest && ev.target.closest('a[target="_blank"]'); if(!a) return; var x=interna(a.getAttribute('href')); if(x){ ev.preventDefault(); location.href=x.href; } }, true);
  var wo=window.open; window.open=function(u,t,f){ var x=u && interna(u); if(x){ location.href=x.href; return window; } return wo.apply(window, arguments); };
}
avvia().catch(function(e){ msg(''); errore('Errore: '+(e.message||e)+'\nRiprova tra poco; se continua, manda una foto a Claude.'); });
})();
