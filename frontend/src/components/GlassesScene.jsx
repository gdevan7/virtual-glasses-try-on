import {useEffect,useRef} from "react";
import * as THREE from "three";

function roundedRect(w,h,r){
  const s=new THREE.Shape(),x=-w/2,y=-h/2;
  s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);
  s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);
  s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s;
}
function makeFrame(style,color){
  const group=new THREE.Group();
  const frameMat=new THREE.MeshStandardMaterial({color,metalness:style==="round"?.65:.18,roughness:.3});
  const lensMat=new THREE.MeshPhysicalMaterial({color:"#cfe5ff",transparent:true,opacity:.13,roughness:.18,side:THREE.DoubleSide,depthWrite:false});
  const round=style==="round",w=round?.39:.45,h=round?.38:.32,r=round?.19:.075;
  for(const side of [-1,1]){
    const lensShape=roundedRect(w,h,r);
    const outline=lensShape.getPoints(64).map(p=>new THREE.Vector3(p.x+side*.47,p.y,.025));
    outline.push(outline[0].clone());
    group.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(outline),96,round?.018:.023,8,false),frameMat));
    const lens=new THREE.Mesh(new THREE.ShapeGeometry(lensShape,32),lensMat);
    lens.position.set(side*.47,0,.005);group.add(lens);
    // Temples extend backwards from the hinges, into the scene, rather than out past the lenses.
    const templeCurve=new THREE.CatmullRomCurve3([
      new THREE.Vector3(side*.91,.015,.02),
      new THREE.Vector3(side*1.00,.01,-.10),
      new THREE.Vector3(side*1.03,-.005,-.36),
      new THREE.Vector3(side*.98,-.025,-.55)
    ]);
    group.add(new THREE.Mesh(new THREE.TubeGeometry(templeCurve,24,.014,8,false),frameMat));
    const hinge=new THREE.Mesh(new THREE.SphereGeometry(.028,12,8),frameMat);
    hinge.position.set(side*.91,.015,.02);group.add(hinge);
  }
  const bridgeCurve=new THREE.CatmullRomCurve3([
    new THREE.Vector3(-.10,.035,.03),new THREE.Vector3(-.055,-.005,.055),
    new THREE.Vector3(0,-.025,.06),new THREE.Vector3(.055,-.005,.055),
    new THREE.Vector3(.10,.035,.03)
  ]);
  group.add(new THREE.Mesh(new THREE.TubeGeometry(bridgeCurve,24,.022,8,false),frameMat));
  return group;
}
export default function GlassesScene({glasses,landmarks,enabled}){
  const host=useRef(null),state=useRef({glasses,landmarks,enabled});
  useEffect(()=>{state.current={glasses,landmarks,enabled};},[glasses,landmarks,enabled]);
  useEffect(()=>{
    const el=host.current,scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(35,1,.01,100);
    const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});
    camera.position.z=5;renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));renderer.setClearColor(0,0);
    el.appendChild(renderer.domElement);
    scene.add(new THREE.HemisphereLight(0xffffff,0x8a94a6,2));
    const light=new THREE.DirectionalLight(0xffffff,2);light.position.set(1,2,4);scene.add(light);
    const root=new THREE.Group();scene.add(root);let model=null,key="",raf=0;
    const resize=()=>{const w=el.clientWidth||1,h=el.clientHeight||1;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();};
    const obs=new ResizeObserver(resize);obs.observe(el);resize();
    const disposeModel=()=>{if(model){root.remove(model);model.traverse(o=>{o.geometry?.dispose();if(o.material){if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose();}});model=null;}};
    const loop=()=>{
      const s=state.current,k=s.glasses?`${s.glasses.id}-${s.glasses.frame_color}-${s.glasses.style}`:"";
      if(k!==key){disposeModel();model=s.glasses?makeFrame(s.glasses.style,s.glasses.frame_color):null;if(model)root.add(model);key=k;}
      root.visible=Boolean(s.enabled&&s.landmarks&&model);
      if(root.visible){
        const lm=s.landmarks,l=lm[33],r=lm[263],n=lm[168];
        if(l&&r&&n){
          const cx=(l.x+r.x)/2,cy=(l.y+r.y)/2,d=Math.hypot(r.x-l.x,r.y-l.y);
          root.position.lerp(new THREE.Vector3((.5-cx)*3.7,(.5-cy)*2.6,0),.4);
          // Previous scale was too small: scale the frame relative to the detected eye distance.
          const sc=THREE.MathUtils.clamp(d*5.1,.7,1.8);
          root.scale.lerp(new THREE.Vector3(sc,sc,sc),.3);
          root.rotation.z=THREE.MathUtils.lerp(root.rotation.z,-Math.atan2(r.y-l.y,r.x-l.x),.3);
          const yaw=THREE.MathUtils.clamp((n.x-cx)/Math.max(d,.001),-.45,.45);
          root.rotation.y=THREE.MathUtils.lerp(root.rotation.y,yaw,.25);
        }
      }
      renderer.render(scene,camera);raf=requestAnimationFrame(loop);
    };
    loop();
    return()=>{cancelAnimationFrame(raf);obs.disconnect();disposeModel();renderer.dispose();renderer.domElement.remove();};
  },[]);
  return <div ref={host} className="glasses-scene"/>;
}