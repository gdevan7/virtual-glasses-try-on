import { useEffect, useRef } from "react";
import * as THREE from "three";
import { buildFrame } from "./frameModel.js";

// Jarak sudut luar mata (landmark 33 <-> 263) dalam mm. Tuning di sini bila
// kacamata terasa terlalu besar/kecil (rentang wajar 85-95).
const EYE_MM = 90;
// Maju-mundur kacamata terhadap wajah (mm).
const GLASSES_Z = 20;

// Kamera ortografik dalam satuan piksel stage. Stage dibuat seaspek dengan video,
// jadi koordinat landmark ternormalisasi langsung berlaku tanpa hitungan crop.
// trackRef.current = { lm, matrix } diperbarui dari CameraStage tanpa render ulang React.
export default function GlassesScene({ glasses, trackRef, enabled }) {
  const host = useRef(null);
  const props = useRef({ glasses, enabled });
  useEffect(() => {
    props.current = { glasses, enabled };
  }, [glasses, enabled]);

  useEffect(() => {
    const el = host.current;
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -3000, 3000);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    el.appendChild(renderer.domElement);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a94a6, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 2);
    key.position.set(60, 120, 300);
    scene.add(key);

    const pivot = new THREE.Group();
    scene.add(pivot);
    // Kepala tak terlihat: hanya menulis depth agar temple tersembunyi di belakang wajah.
    const occluder = new THREE.Mesh(
      new THREE.SphereGeometry(1, 32, 24),
      new THREE.MeshBasicMaterial({ colorWrite: false })
    );
    occluder.scale.set(72, 95, 90);
    occluder.position.set(0, -10, -85);
    occluder.renderOrder = -1;
    pivot.add(occluder);
    const holder = new THREE.Group();
    holder.position.z = GLASSES_Z;
    pivot.add(holder);

    let model = null;
    let curKey = "";
    let raf = 0;
    let first = true;

    const resize = () => {
      const w = el.clientWidth || 1;
      const h = el.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.left = -w / 2;
      camera.right = w / 2;
      camera.top = h / 2;
      camera.bottom = -h / 2;
      camera.updateProjectionMatrix();
    };
    const obs = new ResizeObserver(resize);
    obs.observe(el);
    resize();

    const disposeModel = () => {
      if (!model) return;
      holder.remove(model);
      model.traverse((o) => {
        o.geometry?.dispose();
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
        else o.material?.dispose();
      });
      model = null;
    };

    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const sc = new THREE.Vector3();
    const tq = new THREE.Quaternion();
    const eul = new THREE.Euler();

    const loop = () => {
      const { glasses, enabled } = props.current;
      const t = trackRef.current;
      const k = glasses ? `${glasses.id}|${glasses.style}|${glasses.frame_color}` : "";
      if (k !== curKey) {
        disposeModel();
        if (glasses) {
          model = buildFrame(glasses.style, glasses.frame_color);
          holder.add(model);
        }
        curKey = k;
      }

      const ok = Boolean(enabled && model && t?.lm && t?.matrix);
      if (!ok) first = true;
      pivot.visible = ok;
      if (ok) {
        const w = el.clientWidth;
        const h = el.clientHeight;
        const L = t.lm[33];
        const R = t.lm[263];
        m.fromArray(t.matrix).decompose(p, tq, sc); // rotasi 3D dari MediaPipe
        eul.setFromQuaternion(tq, "YXZ");
        const eyePx = Math.hypot((R.x - L.x) * w, (R.y - L.y) * h);
        // Kompensasi foreshortening saat kepala menoleh.
        const s = eyePx / (EYE_MM * Math.max(Math.cos(eul.y), 0.6));
        const x = ((L.x + R.x) / 2) * w - w / 2;
        const y = h / 2 - ((L.y + R.y) / 2) * h;
        const a = first ? 1 : 0.6;
        pivot.position.x = THREE.MathUtils.lerp(pivot.position.x, x, a);
        pivot.position.y = THREE.MathUtils.lerp(pivot.position.y, y, a);
        pivot.scale.setScalar(THREE.MathUtils.lerp(pivot.scale.x || s, s, first ? 1 : 0.4));
        if (first) pivot.quaternion.copy(tq);
        else pivot.quaternion.slerp(tq, 0.5);
        first = false;
      }
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      obs.disconnect();
      disposeModel();
      occluder.geometry.dispose();
      occluder.material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [trackRef]);

  return <div ref={host} className="glasses-scene" />;
}
