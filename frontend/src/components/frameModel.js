import * as THREE from "three";

// Semua dimensi dalam milimeter (ukuran kacamata nyata), sehingga skala
// ke layar dihitung dari jarak mata (lihat EYE_MM di GlassesScene.jsx).
// w/h = ukuran lubang lensa, n = kebulatan superellipse (2 = elips, besar = kotak),
// rim = tebal bingkai, depth = ketebalan ekstrusi, bridge = jarak antar lensa.
const STYLES = {
  classic: { w: 52, h: 42, n: 3.2, rim: 5, depth: 5, bridge: 18, metal: 0.1, rough: 0.35 },
  round: { w: 48, h: 48, n: 2, rim: 2.2, depth: 3, bridge: 20, metal: 0.8, rough: 0.3 },
  amber: { w: 53, h: 44, n: 3.8, rim: 4.2, depth: 5, bridge: 17, metal: 0.15, rough: 0.3 },
};

// Superellipse tertutup: n=2 elips, n besar = lebih kotak.
function contour(w, h, n, seg = 96) {
  const pts = [];
  for (let i = 0; i < seg; i++) {
    const t = (i / seg) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    pts.push(
      new THREE.Vector2(
        Math.sign(c) * Math.abs(c) ** (2 / n) * (w / 2),
        Math.sign(s) * Math.abs(s) ** (2 / n) * (h / 2)
      )
    );
  }
  return pts;
}

export function buildFrame(style, color) {
  const S = STYLES[style] || STYLES.classic;
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, metalness: S.metal, roughness: S.rough });
  const lensMat = new THREE.MeshPhysicalMaterial({
    color: "#dcecff",
    transparent: true,
    opacity: 0.12,
    roughness: 0.1,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const padMat = new THREE.MeshStandardMaterial({ color: "#d8dde3", roughness: 0.4 });
  const outerW = S.w + 2 * S.rim;
  const outerH = S.h + 2 * S.rim;
  const cx = outerW / 2 + S.bridge / 2;

  for (const side of [-1, 1]) {
    // Rim: bentuk luar dengan lubang lensa, jadi bingkai tebal seperti asetat.
    const outer = new THREE.Shape(contour(outerW, outerH, S.n));
    outer.holes.push(new THREE.Path(contour(S.w, S.h, S.n)));
    const geo = new THREE.ExtrudeGeometry(outer, {
      depth: S.depth,
      bevelEnabled: true,
      bevelSize: 0.5,
      bevelThickness: 0.5,
      bevelSegments: 2,
    });
    geo.translate(0, 0, -S.depth / 2);
    const rim = new THREE.Mesh(geo, mat);
    rim.position.x = side * cx;
    group.add(rim);

    const lens = new THREE.Mesh(
      new THREE.ShapeGeometry(new THREE.Shape(contour(S.w, S.h, S.n))),
      lensMat
    );
    lens.position.set(side * cx, 0, 0);
    group.add(lens);

    // Temple: dari engsel lurus ke belakang, lalu melengkung ke bawah (telinga).
    const hx = side * (cx + outerW / 2);
    const y = outerH * 0.2;
    const temple = new THREE.CatmullRomCurve3([
      new THREE.Vector3(hx, y, -S.depth / 2),
      new THREE.Vector3(hx, y, -60),
      new THREE.Vector3(hx, y, -105),
      new THREE.Vector3(hx, y - 6, -128),
      new THREE.Vector3(hx, y - 22, -140),
    ]);
    group.add(new THREE.Mesh(new THREE.TubeGeometry(temple, 40, style === "round" ? 1.2 : 2, 8), mat));

    const pad = new THREE.Mesh(new THREE.SphereGeometry(3, 12, 8), padMat);
    pad.scale.set(0.5, 1.2, 0.5);
    pad.position.set(side * (S.bridge / 2 + 3), -2, -9);
    group.add(pad);
  }

  const bridge = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-S.bridge / 2 - 1, outerH * 0.22, 0),
    new THREE.Vector3(0, outerH * 0.3, 2),
    new THREE.Vector3(S.bridge / 2 + 1, outerH * 0.22, 0),
  ]);
  group.add(new THREE.Mesh(new THREE.TubeGeometry(bridge, 24, 1.6, 8), mat));
  return group;
}
