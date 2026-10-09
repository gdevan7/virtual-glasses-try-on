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
  const lensMat=new THREE.MeshPhysicalMaterial({color:"#cfe5ff",transparent:true,opacity:.1,roughness:.18,side:THREE.DoubleSide,depthWrite:false});
  const round=style==="round",w=round?.39:.45,h=round?.38:.32,r=round?.19:.075;
  for(const side of [-1,1]){
    const lensShape=roundedRect(w,h,r);
    const outline=lensShape.getPoints(64).map(p=>new THREE.Vector3(p.x+side*.47,p.y,.025));
    outline.push(outline[0].clone());
    group.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(outline),96,round?.018:.023,8,false),frameMat));
    const lens=new THREE.Mesh(new THREE.ShapeGeometry(lensShape,32),lensMat);
    lens.position.set(side*.47,0,.005);group.add(lens);
    const templeCurve=new THREE.CatmullRomCurve3([
      new THREE.Vector3(side*.91,.015,.02),new THREE.Vector3(side*1.00,.01,-.10),
      new THREE.Vector3(side*1.03,-.005,-.36),new THREE.Vector3(side*.98,-.025,-.55)
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
        const lm=s.landmarks,l=lm[33],r=lm[263],nose=lm[168];
        if(l&&r&&nose){
          const cx=(l.x+r.x)/2,cy=(l.y+r.y)/2;
          const eyeDistance=Math.hypot(r.x-l.x,r.y-l.y);
          // Match the CSS mirrored preview and object-fit: cover crop.
          const stageW=el.clientWidth||1,stageH=el.clientHeight||1;
          const video=el.parentElement?.querySelector("video");
          const vw=video?.videoWidth||16,vh=video?.videoHeight||9;
          const coverScale=Math.max(stageW/vw,stageH/vh);
          const renderedW=vw*coverScale,renderedH=vh*coverScale;
          const cropX=(renderedW-stageW)/(2*renderedW),cropY=(renderedH-stageH)/(2*renderedH);
          const nx=(cx-cropX)/(1-2*cropX);
          const ny=(cy-cropY)/(1-2*cropY);
          const visibleEyeDistance=eyeDistance/(1-2*cropX);
          // The model is anchored on the eye midpoint; use eye distance for scale.
          const worldH=2* Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*camera.position.z;
          const worldW=worldH*camera.aspect;
          const targetX=(nx-.5)*worldW;
          const targetY=(.5-ny)*worldH;
          root.position.x=THREE.MathUtils.lerp(root.position.x,targetX,.55);
          root.position.y=THREE.MathUtils.lerp(root.position.y,targetY,.55);
          const targetScale=THREE.MathUtils.clamp(visibleEyeDistance*worldW/1.9,.48,1.55);
          root.scale.setScalar(THREE.MathUtils.lerp(root.scale.x,targetScale,.4));
          // A mirrored canvas reverses the visible roll direction, so use image-space roll directly.
          const roll=-Math.atan2(r.y-l.y,r.x-l.x);
          root.rotation.z=THREE.MathUtils.lerp(root.rotation.z,roll,.45);
          // Disable the unstable nose-offset yaw approximation: it made the lenses drift apart.
          root.rotation.y=THREE.MathUtils.lerp(root.rotation.y,0,.3);
          root.rotation.x=THREE.MathUtils.lerp(root.rotation.x,0,.3);
        }
      }
      renderer.render(scene,camera);raf=requestAnimationFrame(loop);
    };
    loop();
    return()=>{cancelAnimationFrame(raf);obs.disconnect();disposeModel();renderer.dispose();renderer.domElement.remove();};
  },[]);
  return <div ref={host} className="glasses-scene"/>;
}