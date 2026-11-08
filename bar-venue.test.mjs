import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { canEnterBar, barPosition, BAR } from './bar-venue.js';
import { createRoomServer } from './server.mjs';
import { createMeritAccount } from './merit-guard.mjs';

test('bar access requires current verified balance at 10,000; past rewards and blocked accounts do not qualify', () => {
  assert.equal(canEnterBar({ merit: 9999, rewardMerit: 50000 }), false);
  assert.equal(canEnterBar({ merit: 10000 }), true);
  assert.equal(canEnterBar({ merit: 10000, blocked: true }), false);
  assert.equal(canEnterBar({ merit: NaN }), false);
  assert.equal(barPosition(22, 28, false).x, 13.2);
  assert.deepEqual(barPosition(22, 28, true), { x: 22, z: 28 });
  assert.deepEqual(barPosition(9000, -99, true), { x: BAR.maxX, z: BAR.minZ });
});

test('bar HTTP/SSE: admission, shared positions, no entry fee, low-balance/blocked denial, ejection and public modules', async t => {
  const accounts = new Map(), server = createRoomServer({ accounts });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.closeRoom());
  const base = `http://127.0.0.1:${server.address().port}`;
  async function post(route, data, session, cookie) {
    return fetch(`${base}/api/${route}${session ? '?id=' + session.id : ''}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(session ? { Authorization: `Bearer ${session.token}` } : {}), ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(data) });
  }
  async function join(merit) {
    const identity=randomBytes(24).toString('hex'), account=createMeritAccount(Date.now());
    account.merit=merit;account.rewardMerit=50000;accounts.set(identity,account);
    const session=await(await post('join',{name:'Khách bar',protocol:2},null,`chuaha_identity=${identity}`)).json();
    const controller=new AbortController();t.after(()=>controller.abort());
    const res=await fetch(`${base}/api/events?id=${session.id}&token=${session.token}`,{signal:controller.signal});
    const reader=res.body.getReader(),decoder=new TextDecoder();let buffer='';
    async function next(type,predicate=()=>true){
      for(;;){const end=buffer.indexOf('\n\n');if(end>=0){const block=buffer.slice(0,end);buffer=buffer.slice(end+2);const lines=block.split('\n');if(lines.find(l=>l.startsWith('event: '))?.slice(7)===type){const data=JSON.parse(lines.find(l=>l.startsWith('data: ')).slice(6));if(predicate(data))return data;}continue;}
        const {value,done}=await reader.read();if(done)throw Error('Stream ended');buffer+=decoder.decode(value,{stream:true});}
    }
    await next('welcome');return {session,account,next};
  }
  const low=await join(9999), rich=await join(10000);
  assert.equal((await post('bar',{action:'enter'},low.session)).status,403);
  const entered=await post('bar',{action:'enter'},rich.session);assert.equal(entered.status,200);
  assert.deepEqual((await entered.json()).position,BAR.entry);assert.equal(rich.account.merit,10000);
  const inside=await low.next('players',p=>p.some(s=>s.id===rich.session.id&&s.x===BAR.entry.x));
  assert.equal(inside.find(p=>p.id===rich.session.id).z,BAR.entry.z);
  await post('state',{x:22,z:28},low.session);
  const safe=await rich.next('players',p=>p.some(s=>s.id===low.session.id&&s.x===13.2));assert.equal(safe.find(s=>s.id===low.session.id).x,13.2);
  assert.equal((await post('bar',{action:'exit'},rich.session)).status,200);
  await post('bar',{action:'enter'},rich.session);
  // Current score can fall after a wager. The next verified state must not remain inside.
  rich.account.merit=9999;
  await post('state',{x:22,z:28},rich.session);
  const ejected=await low.next('players',p=>p.some(s=>s.id===rich.session.id&&s.x===13.2&&s.z===28));assert.ok(ejected.find(s=>s.id===rich.session.id).x<=13.2);
  assert.equal((await post('bar',{action:'enter'},rich.session)).status,403);
  rich.account.merit=10000;rich.account.blocked=true;rich.account.blockedUntil=Date.now()+60000;
  assert.equal((await post('bar',{action:'enter'},rich.session)).status,403);
  assert.equal((await post('bar',{action:'dance'},low.session)).status,400);
  for(const file of ['bar-venue.js','bar-scene.js'])assert.equal((await fetch(`${base}/${file}`)).status,200);
});
