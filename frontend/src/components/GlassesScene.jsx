import {useEffect,useRef} from "react";
import * as THREE from "three";

function lensOutline(style){
  // Normalized contours for recognizable optical frames; all dimensions are in local frame units.
  if(style==="round") return [
    [-.30,-.16],[-.29,-.25],[-.23,-.31],[-.12,-.33],[.08,-.33],[.22,-.29],[.29,-.20],[.30,-.04],[.27,.18],[.20,.28],[.08,.32],[-.10,.32],[-.23,.27],[-.29,.16]
  ];
  if(style==="amber") return [
    [-.31,-.20],[-.25,-.29],[-.10,-.32],[.10,-.31],[.25,-.25],[.30,-.12],[.29,.16],[.23,.27],[.10,.31],[-.11,.30],[-.25,.23],[-.30,.06]
  ];
  return [
    [-.30,-.18],[-.25,-.27],[-.12,-.30],[.10,-.30],[.25,-.25],[.30,-.14],[.29,.14],[.24,.25],[.11,.29],[-.12,.29],[-.25,.23],[-.30,.08]
  ];
}
function contourShape(points){
  const curve=new THREE.SplineCurve(points.map(([x,y])=>new THREE.Vector2(x,y)));
  return curve.getPoints(96);
}
function makeFrame(style,color){
  const group=new THREE.Group();
  const round=style==="round",amber=style==="amber";
  const frameMat=new THREE.MeshStandardMaterial({
    color, metalness:round?.72:(amber?.18:.12), roughness:round?.28:.32
  });
  const lensMat=new THREE.MeshPhysicalMaterial({
    color:"#dcecff", transparent:true, opacity:.075, roughness:.16,
    metalness:0, side:THREE.DoubleSide, depthWrite:false
  });
  const points=lensOutline(style);
  const width=round?.38:.43;
  const lensGap=.055;
  for(const side of [-1,1]){
    const local=contourShape(points);
    const cx=side*(width/2+lensGap/2);
    const vertices=local.map(p=>new THREE.Vector3(p.x+cx,p.y,0));
    const closed=[...vertices,vertices[0].clone()];
    const rail=new THREE.CatmullRomCurve3(closed,true,"centripetal");
    const thickness=round?.014:(amber?.025:.022);
    group.add(new THREE.Mesh(new THREE.TubeGeometry(rail,128,thickness,10,true),frameMat));
    const lensShape=new THREE.Shape();
    local.forEach((p,i)=>i===0?lensShape.moveTo(p.x+cx,p.y):lensShape.lineTo(p.x+cx,p.y));
    lensShape.closePath();
    const lens=new THREE.Mesh(new THREE.ShapeGeometry(lensShape,32),lensMat);
    lens.position.z=-.006;group.add(lens);
    // Hinges are joined to a tapered, swept-back temple instead of detached line segments.
    const hingeX=cx+side*.215;
    const hinge=new THREE.Mesh(new THREE.SphereGeometry(.022,16,10),frameMat);
    hinge.position.set(hingeX,.015,.005);group.add(hinge);
    const temple=new THREE.CatmullRomCurve3([
      new THREE.Vector3(hingeX,.015,.005),
      new THREE.Vector3(hingeX+side*.035,.025,-.06),
      new THREE.Vector3(hingeX+side*.045,.005,-.25),
      new THREE.Vector3(hingeX+side*.005,-.045,-.47),
      new THREE.Vector3(hingeX-side*.025,-.065,-.52)
    ]);
    group.add(new THREE.Mesh(new THREE.TubeGeometry(temple,36,round?.012:.016,8,false),frameMat));
  }
  // Anatomically compact saddle bridge with two small nose-pad arms.
  const bridge=new THREE.CatmullRomCurve3([
    new THREE.Vector3(-.075,.055,.012),new THREE.Vector3(-.045,.018,.035),
    new THREE.Vector3(-.022,-.012,.045),new THREE.Vector3(.022,-.012,.045),
    new THREE.Vector3(.045,.018,.035),new THREE.Vector3(.075,.055,.012)
  ]);
  group.add(new THREE.Mesh(new THREE.TubeGeometry(bridge,32,.018,10,false),frameMat));
  for(const side of [-1,1]){
    const arm=new THREE.CatmullRomCurve3([
      new THREE.Vector3(side*.055,-.005,.025),
      new THREE.Vector3(side*.085,-.035,.04),
      new THREE.Vector3(side*.11,-.055,.03)
    ]);
    group.add(new THREE.Mesh(new THREE.TubeGeometry(arm,12,.008,8,false),frameMat));
    const pad=new THREE.Mesh(new THREE.SphereGeometry(.023,12,8),new THREE.MeshStandardMaterial({color:"#b8c1cc",roughness:.4}));
    pad.position.set(side*.11,-.058,.03);pad.scale.set(.7,1.2,.45);group.add(pad);
  }
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