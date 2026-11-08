import { isInBar } from './bar-venue.js';

export function createBarScene({ THREE, scene, mesh, mat, nameSprite, audioContext }) {
  const root = new THREE.Group(); root.name = 'lotusLiveBar'; scene.add(root);
  const dark = mat(0x211626), wood = mat(0x543045), gold = mat(0xe6ae62), rose = mat(0xc0479a, { emissive: 0x7c1953, emissiveIntensity: .7 });
  const box = (w,h,d,m,x,y,z) => mesh(new THREE.BoxGeometry(w,h,d),m,x,y,z,root);
  box(16,.12,16,dark,22,.02,28);
  box(.2,3.2,16,wood,30,1.6,28); box(16,3.2,.2,wood,22,1.6,36);
  box(16,1,.2,wood,22,.5,20);
  box(.2,1.1,2,wood,14,.55,21); box(.2,1.1,10,wood,14,.55,31);
  const sign=nameSprite('LOTUS · LIVE BAR','#ffc3e9','10.000 công đức · Nhạc không lời');sign.position.set(20,3.7,21);sign.scale.set(8,2,1);root.add(sign);
  box(9,.45,3,wood,22,.24,33.3);
  const backdrop=nameSprite('LOTUS LIVE','#ffe2a3','Ban nhạc mô phỏng · Sân khấu chung');backdrop.position.set(22,3.2,35.6);backdrop.scale.set(8,2,1);root.add(backdrop);
  for(const x of [17,27]){box(.9,1.9,.7,dark,x,1.3,33.5);for(const y of [.9,1.7])mesh(new THREE.CylinderGeometry(.28,.28,.08,16),gold,x,y,33.1,root).rotation.x=Math.PI/2;}
  const band=[];
  for(const [i,x] of [19,22,25].entries()){
    const person=new THREE.Group();person.position.set(x,.47,33.2);root.add(person);
    mesh(new THREE.CylinderGeometry(.26,.38,.8,12),mat([0x7265ad,0xce7c9b,0x4d9a9a][i]),0,.65,0,person);
    mesh(new THREE.SphereGeometry(.3,12,10),mat(0xe9bf9c),0,1.3,0,person);
    for(const sx of [-.1,.1])mesh(new THREE.SphereGeometry(.035,8,6),dark,sx,1.35,-.27,person);
    band.push(person);
    if(i===0){box(1.6,.18,.65,dark,x,1.25,32.6);for(let k=0;k<12;k++)box(.09,.03,.45,k%3===1?dark:gold,x-.66+k*.12,1.36,32.55);}
    if(i===1){mesh(new THREE.CylinderGeometry(.035,.035,1.4,8),gold,x,.95,32.5,root);mesh(new THREE.SphereGeometry(.1,8,8),dark,x,1.65,32.5,root);}
    if(i===2){const drum=mesh(new THREE.CylinderGeometry(.5,.5,.55,16),rose,x,.9,32.6,root);drum.rotation.x=Math.PI/2;}
  }
  for(const x of [18,26])for(const z of [24.5,28.5]){
    mesh(new THREE.CylinderGeometry(.8,.8,.14,20),wood,x,.95,z,root);
    mesh(new THREE.CylinderGeometry(.1,.18,.9,10),gold,x,.45,z,root);
    for(const dx of [-1.2,1.2])mesh(new THREE.CylinderGeometry(.35,.35,.5,12),rose,x+dx,.25,z,root);
    box(.12,.22,.12,gold,x,.14+1,z);
  }
  box(1.3,1.2,9,wood,29,.6,27);
  for(let i=0;i<8;i++)box(.14,.45,.14,mat([0x9a73d4,0x66bbbc,0xf5b965][i%3]),29,1.45,23+i);
  const lights=[];
  for(const [i,x] of [18,22,26].entries()){
    const light=new THREE.PointLight([0xff73ba,0x9b8aff,0x64dddc][i],16,14,1.7);light.position.set(x,3,31);root.add(light);lights.push(light);
    mesh(new THREE.SphereGeometry(.12,8,6),rose,x,3,31,root);
  }
  let bus=null, context=null, lastBeat=-1;
  const melody=[64,67,71,74,71,67,64,62,60,64,67,71,69,67,64,62,62,65,69,72,69,65,62,60,59,62,67,71,69,67,62,59];
  function note(c,midi,duration,volume,type='sine'){
    const at=c.currentTime,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.value=440*2**((midi-69)/12);
    g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(volume,at+.015);g.gain.exponentialRampToValueAtTime(.0001,at+duration);
    o.connect(g);g.connect(bus);o.start(at);o.stop(at+duration+.02);o.onended=()=>{o.disconnect();g.disconnect();};
  }
  function silence(){if(bus&&context)bus.gain.setValueAtTime(0,context.currentTime);lastBeat=-1;}
  return {
    silence,
    update(position,enabled){
      const time=Date.now()/1000,beat=Math.floor(time/.3);
      sign.visible = !position || !isInBar(position);
      band.forEach((p,i)=>{p.rotation.z=Math.sin(time*5+i)*.05;p.position.y=.47+Math.max(0,Math.sin(time*5+i))*.04;});
      lights.forEach((l,i)=>l.intensity=12+Math.sin(time*2+i)*4);
      if(!position||!isInBar(position)||!enabled||document.hidden){silence();return;}
      const c=audioContext();if(!c||c.state!=='running'){silence();return;}
      if(context!==c){context=c;bus=c.createGain();bus.connect(c.destination);}
      bus.gain.setTargetAtTime(.32,c.currentTime,.05);
      if(beat===lastBeat)return;lastBeat=beat;
      const step=((beat%32)+32)%32;
      note(c,melody[step],.28,.16,'triangle');
      if(step%2===0)note(c,[48,45,50,43][Math.floor(step/8)],.48,.2);
      if(step%4===0){const chord=[[60,64,67],[57,60,64],[62,65,69],[59,62,67]][Math.floor(step/8)];chord.forEach(n=>note(c,n,.65,.055));}
      if(step%2===1)note(c,91,.035,.025,'square');
    }
  };
}
