// 通信層：ホスト1人＋参加者最大3人のスター型。
// 本番は PeerJS（WebRTC。シグナリングは PeerJS の無料クラウド、届かない回線では PeerJS の TURN 経由）。
// ?net=local を付けると同じブラウザ内のタブ同士を BroadcastChannel でつなぐ（テスト用）。
export const PROTO=4;
const PREFIX='kagaku-kitchen-v1-';
const CODE_CH='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function newCode(){let s='';for(let i=0;i<4;i++)s+=CODE_CH[Math.floor(Math.random()*CODE_CH.length)];return s;}
export const normCode=s=>String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,4);

const Q=new URLSearchParams(location.search);
const LOCAL=Q.get('net')==='local';
function peerOpts(){
  const o={debug:0};
  if(Q.get('peerhost')){o.host=Q.get('peerhost');o.port=+Q.get('peerport')||9000;o.path=Q.get('peerpath')||'/';o.secure=Q.get('peersecure')==='1';}
  return o;
}
// 浮動小数を丸めて送る（スナップショットを軽くする）
const enc=m=>JSON.stringify(m,(k,v)=>typeof v==='number'&&!Number.isInteger(v)?Math.round(v*100)/100:v);
const dec=d=>{if(typeof d!=='string')return null;try{return JSON.parse(d);}catch(e){return null;}};

function errText(e){
  const t=e&&e.type;
  if(t==='peer-unavailable')return 'その部屋が見つからない。コードを確認して';
  if(t==='browser-incompatible')return 'このブラウザは通信に対応していない';
  if(t==='network'||t==='server-error'||t==='socket-error'||t==='socket-closed')return '接続サーバーに届かない。回線を確認して再試行して';
  if(t==='webrtc')return 'WebRTCの接続に失敗した';
  return (e&&e.message)||'通信エラー';
}

/* ================= ホスト ================= */
export class HostNet{
  constructor(h){this.h=h;this.conns=new Map();this.closed=false;this.peer=null;this.bc=null;this.code='';}
  async start(){
    if(LOCAL)return this._startLocal();
    if(!window.Peer)throw new Error('通信ライブラリを読み込めなかった');
    let last=null;
    for(let i=0;i<5;i++){
      const code=newCode();
      try{await this._open(code);this.code=code;return code;}
      catch(e){last=e;if(e&&e.type==='unavailable-id')continue;throw new Error(errText(e));}
    }
    throw new Error(errText(last));
  }
  _open(code){
    return new Promise((res,rej)=>{
      const peer=new window.Peer(PREFIX+code,peerOpts());let opened=false;
      const to=setTimeout(()=>{if(!opened){try{peer.destroy();}catch(e){}rej({type:'network'});}},15000);
      peer.on('open',()=>{opened=true;clearTimeout(to);this.peer=peer;res();});
      peer.on('error',e=>{if(!opened){clearTimeout(to);try{peer.destroy();}catch(x){}rej(e);}});
      peer.on('disconnected',()=>{if(opened&&!this.closed){try{peer.reconnect();}catch(e){}}});
      peer.on('connection',conn=>{
        conn.on('open',()=>{
          if(this.closed){conn.close();return;}
          const cid=conn.peer;this.conns.set(cid,conn);this.h.onConnect(cid);
          conn.on('data',d=>{const m=dec(d);if(m)this.h.onMessage(cid,m);});
          const gone=()=>{if(this.conns.get(cid)===conn){this.conns.delete(cid);this.h.onClose(cid);}};
          conn.on('close',gone);conn.on('error',gone);
          if(conn.peerConnection)conn.peerConnection.addEventListener('iceconnectionstatechange',()=>{
            const s=conn.peerConnection.iceConnectionState;if(s==='failed'||s==='closed')gone();
          });
        });
      });
    });
  }
  _startLocal(){
    const code=newCode();
    this.code=code;this.bc=new BroadcastChannel('kk-'+code);
    this.bc.onmessage=e=>{
      const {from,to,kind,data}=e.data||{};if(to!=='host')return;
      if(kind==='hello'){this.conns.set(from,{local:true});this.bc.postMessage({to:from,kind:'welcome'});this.h.onConnect(from);}
      else if(kind==='data'&&this.conns.has(from)){const m=dec(data);if(m)this.h.onMessage(from,m);}
      else if(kind==='bye'&&this.conns.has(from)){this.conns.delete(from);this.h.onClose(from);}
    };
    return Promise.resolve(code);
  }
  send(cid,m){
    const c=this.conns.get(cid);if(!c)return;const d=enc(m);
    if(this.bc){this.bc.postMessage({to:cid,kind:'data',data:d});return;}
    try{if(c.open)c.send(d);}catch(e){}
  }
  broadcast(m){for(const cid of this.conns.keys())this.send(cid,m);}
  drop(cid){
    const c=this.conns.get(cid);this.conns.delete(cid);
    if(this.bc)this.bc.postMessage({to:cid,kind:'bye'});else if(c)try{c.close();}catch(e){}
  }
  close(){
    this.closed=true;
    for(const cid of [...this.conns.keys()])this.drop(cid);
    if(this.bc){this.bc.close();this.bc=null;}
    if(this.peer)try{this.peer.destroy();}catch(e){}
  }
}

/* ================= 参加者 ================= */
export class ClientNet{
  constructor(h){this.h=h;this.closed=false;this.peer=null;this.conn=null;this.bc=null;}
  join(code){
    code=normCode(code);
    if(LOCAL)return this._joinLocal(code);
    if(!window.Peer)return Promise.reject(new Error('通信ライブラリを読み込めなかった'));
    return new Promise((res,rej)=>{
      let done=false;
      const fail=e=>{if(done)return;done=true;clearTimeout(to);this.close();rej(new Error(typeof e==='string'?e:errText(e)));};
      const to=setTimeout(()=>fail('接続できなかった。同じWi-Fiにする・モバイル回線に切り替える等で再試行して'),20000);
      const peer=new window.Peer(peerOpts());this.peer=peer;
      peer.on('error',e=>{if(!done)fail(e);else if(e&&(e.type==='peer-unavailable'))this._lost();});
      peer.on('open',()=>{
        const conn=peer.connect(PREFIX+code,{reliable:true,serialization:'json'});this.conn=conn;
        conn.on('open',()=>{if(done)return;done=true;clearTimeout(to);res();});
        conn.on('data',d=>{const m=dec(d);if(m)this.h.onMessage(m);});
        conn.on('close',()=>this._lost());
        conn.on('error',()=>this._lost());
      });
    });
  }
  _joinLocal(code){
    this.id='c'+Math.random().toString(36).slice(2,8);
    this.bc=new BroadcastChannel('kk-'+code);
    return new Promise((res,rej)=>{
      const to=setTimeout(()=>{this.close();rej(new Error('その部屋が見つからない（local）'));},2500);
      this.bc.onmessage=e=>{
        const {to:dst,kind,data}=e.data||{};if(dst!==this.id)return;
        if(kind==='welcome'){clearTimeout(to);res();}
        else if(kind==='data'){const m=dec(data);if(m)this.h.onMessage(m);}
        else if(kind==='bye')this._lost();
      };
      this.bc.postMessage({from:this.id,to:'host',kind:'hello'});
    });
  }
  send(m){
    const d=enc(m);
    if(this.bc){this.bc.postMessage({from:this.id,to:'host',kind:'data',data:d});return;}
    try{if(this.conn&&this.conn.open)this.conn.send(d);}catch(e){}
  }
  _lost(){if(this.closed)return;this.close();this.h.onClose();}
  close(){
    if(this.closed)return;this.closed=true;
    if(this.bc){try{this.bc.postMessage({from:this.id,to:'host',kind:'bye'});}catch(e){}this.bc.close();this.bc=null;}
    if(this.conn)try{this.conn.close();}catch(e){}
    if(this.peer)try{this.peer.destroy();}catch(e){}
  }
}
