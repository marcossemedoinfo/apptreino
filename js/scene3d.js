// Motor 3D de Biomecânica, Estúdio Fitness e Demonstração Anatômica (Three.js r160)

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const CAMERA_PRESETS = {
  threeQuarter: { pos: [2.05, 1.48, 2.45], target: [0, 0.85, 0] },
  front: { pos: [0, 1.34, 3.0], target: [0, 0.86, 0] },
  side: { pos: [2.95, 1.22, 0.15], target: [0, 0.82, 0] },
  top: { pos: [0.05, 3.35, 1.3], target: [0, 0.72, 0] }
};

const MAT_TOP_Y = 0.026;
const TREADMILL_BELT_Y = 0.148;

function createLatheFromProfile(pts, radialSegs = 22, scaleX = 1, scaleZ = 1) {
  // LatheGeometry exige pontos de baixo para cima (Y crescente) para normais apontarem para fora
  const ordered = pts[pts.length - 1][1] < pts[0][1] ? [...pts].reverse() : pts;
  const curve = new THREE.SplineCurve(ordered.map(([r, y]) => new THREE.Vector2(Math.max(0.001, r), y)));
  const sampled = curve.getPoints(20);
  const geo = new THREE.LatheGeometry(sampled, radialSegs);
  if (scaleX !== 1 || scaleZ !== 1) {
    geo.scale(scaleX, 1, scaleZ);
  }
  geo.computeVertexNormals();
  return geo;
}

export class WorkoutScene3D {
  constructor(container, { onPhaseChange } = {}) {
    this.container = container;
    this.onPhaseChange = onPhaseChange || (() => {});
    this.animId = 'squat';
    this.playing = true;
    this.autoRotate = false;
    this.speedMultiplier = 1.0;
    this.treadmillSpeedKmh = 4.5;
    this.treadmillIncline = 0;
    this.activeSide = 'right';
    this.highlightMuscles = true;
    this.activeMuscles = [];
    this.simTime = 0;
    this.lastFrameMs = performance.now();
    this.beltOffset = 0;
    this.disposed = false;
    this.lastPhaseText = '';
    this.blendAlpha = 1; // < 1 durante transição suave entre exercícios
    this.prevPose = null;

    this.initScene();
    this.buildStudioEnvironment();
    this.buildProps();
    this.buildCharacterRig();
    this.setExercise({ anim: 'squat', prop: 'none', defaultCamera: 'threeQuarter', muscles: ['quads', 'glutes'] });
    this.bindResize();
    this.animate();
  }

  initScene() {
    const w = this.container.clientWidth || 640;
    const h = this.container.clientHeight || 420;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#09101f');
    this.scene.fog = new THREE.Fog('#09101f', 6.5, 14.5);

    this.camera = new THREE.PerspectiveCamera(39, w / h, 0.1, 40);
    this.camera.position.set(...CAMERA_PRESETS.threeQuarter.pos);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;

    // Ambiente PBR realista de estúdio (RoomEnvironment nativo do Three r160)
    try {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      this.envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
      this.scene.environment = this.envRT.texture;
      pmrem.dispose();
    } catch {
      // Fallback seguro caso PMREM não esteja disponível
    }

    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.autoRotate = false;
    this.controls.autoRotateSpeed = 1.6;
    this.controls.minDistance = 1.35;
    this.controls.maxDistance = 5.6;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.target.set(...CAMERA_PRESETS.threeQuarter.target);
    this.controls.update();

    // Iluminação cinematográfica de 3 pontos + luz de chão
    const hemi = new THREE.HemisphereLight('#e2e8f0', '#0f172a', 0.65);
    this.scene.add(hemi);

    const keyLight = new THREE.DirectionalLight('#fff7ed', 1.6);
    keyLight.position.set(2.6, 4.4, 3.2);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 14;
    const d = 2.4;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0004;
    keyLight.shadow.normalBias = 0.015;
    this.scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight('#bae6fd', 0.55);
    fillLight.position.set(-2.8, 2.1, 2.4);
    this.scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight('#10b981', 0.85);
    rimLight.position.set(-2.2, 2.6, -2.9);
    this.scene.add(rimLight);
  }

  buildStudioEnvironment() {
    // Textura procedural para piso emborrachado de academia
    const floorCanvas = document.createElement('canvas');
    floorCanvas.width = 512;
    floorCanvas.height = 512;
    const fCtx = floorCanvas.getContext('2d');
    fCtx.fillStyle = '#0e1628';
    fCtx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 4000; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      fCtx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.025)' : 'rgba(16,185,129,0.02)';
      fCtx.fillRect(x, y, 2, 2);
    }
    fCtx.strokeStyle = 'rgba(148,163,184,0.06)';
    fCtx.lineWidth = 2;
    for (let p = 0; p <= 512; p += 128) {
      fCtx.beginPath(); fCtx.moveTo(p, 0); fCtx.lineTo(p, 512); fCtx.stroke();
      fCtx.beginPath(); fCtx.moveTo(0, p); fCtx.lineTo(512, p); fCtx.stroke();
    }
    const floorTex = new THREE.CanvasTexture(floorCanvas);
    floorTex.wrapS = THREE.RepeatWrapping;
    floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(6, 6);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(7.2, 64),
      new THREE.MeshStandardMaterial({
        map: floorTex,
        roughness: 0.78,
        metalness: 0.1,
        envMapIntensity: 0.35
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Plataforma circular elevada sutil de treino
    const platform = new THREE.Mesh(
      new THREE.CylinderGeometry(1.36, 1.42, 0.016, 48),
      new THREE.MeshStandardMaterial({ color: '#142038', roughness: 0.65, metalness: 0.2, envMapIntensity: 0.4 })
    );
    platform.position.y = -0.008;
    platform.receiveShadow = true;
    this.scene.add(platform);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.34, 1.38, 64),
      new THREE.MeshBasicMaterial({ color: '#10b981', transparent: true, opacity: 0.45, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.002;
    this.scene.add(ring);

    // Fundo curvo arquitetônico distante em -Z (nunca bloqueia câmeras)
    const backdrop = new THREE.Mesh(
      new THREE.CylinderGeometry(5.2, 5.2, 3.6, 36, 1, true, Math.PI * 0.72, Math.PI * 0.56),
      new THREE.MeshStandardMaterial({
        color: '#0f1a30',
        roughness: 0.85,
        metalness: 0.1,
        side: THREE.BackSide,
        envMapIntensity: 0.2
      })
    );
    backdrop.position.y = 1.8;
    this.scene.add(backdrop);

    // Barras de LED decorativas no fundo do estúdio
    for (const bx of [-1.85, 0, 1.85]) {
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(0.035, 2.3, 0.035),
        new THREE.MeshBasicMaterial({ color: bx === 0 ? '#38bdf8' : '#10b981', transparent: true, opacity: 0.45 })
      );
      bar.position.set(bx, 1.35, -4.65 + Math.abs(bx) * 0.12);
      this.scene.add(bar);
    }
  }

  buildProps() {
    this.propsGroup = new THREE.Group();
    this.scene.add(this.propsGroup);

    // 1. Tapete de exercício confortável com bordas arredondadas
    const matGroup = new THREE.Group();
    const matMat = new THREE.MeshStandardMaterial({ color: '#0f766e', roughness: 0.82, metalness: 0.05, envMapIntensity: 0.25 });
    const matTrimMat = new THREE.MeshStandardMaterial({ color: '#2dd4bf', roughness: 0.55, envMapIntensity: 0.4 });

    const matBody = new THREE.Mesh(new THREE.BoxGeometry(0.84, MAT_TOP_Y, 1.94), matMat);
    matBody.position.y = MAT_TOP_Y / 2;
    matBody.receiveShadow = true;
    matBody.castShadow = true;
    matGroup.add(matBody);

    for (const ez of [-0.97, 0.97]) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(MAT_TOP_Y / 2, MAT_TOP_Y / 2, 0.84, 12), matTrimMat);
      cap.rotation.z = Math.PI / 2;
      cap.position.set(0, MAT_TOP_Y / 2, ez);
      matGroup.add(cap);
    }

    // Linha central de alinhamento no tapete
    const centerLine = new THREE.Mesh(new THREE.PlaneGeometry(0.016, 1.82), matTrimMat);
    centerLine.rotation.x = -Math.PI / 2;
    centerLine.position.y = MAT_TOP_Y + 0.001;
    matGroup.add(centerLine);

    matGroup.visible = false;
    this.propsGroup.add(matGroup);
    this.propMat = matGroup;

    // 2. Parede de apoio moderna (para Flexão na parede)
    const wallGroup = new THREE.Group();
    const wallPanel = new THREE.Mesh(
      new THREE.BoxGeometry(1.95, 2.3, 0.09),
      new THREE.MeshStandardMaterial({
        color: '#2b3a52',
        roughness: 0.55,
        metalness: 0.15,
        transparent: true,
        opacity: 0.86,
        envMapIntensity: 0.4
      })
    );
    wallPanel.position.set(0, 1.15, 0.72);
    wallPanel.receiveShadow = true;
    wallPanel.castShadow = true;
    wallGroup.add(wallPanel);

    const wallLed = new THREE.Mesh(
      new THREE.BoxGeometry(1.95, 0.025, 0.105),
      new THREE.MeshBasicMaterial({ color: '#38bdf8' })
    );
    wallLed.position.set(0, 1.95, 0.72);
    wallGroup.add(wallLed);

    const wallBase = new THREE.Mesh(
      new THREE.BoxGeometry(1.98, 0.09, 0.12),
      new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.6 })
    );
    wallBase.position.set(0, 0.045, 0.72);
    wallGroup.add(wallBase);

    wallGroup.visible = false;
    this.propsGroup.add(wallGroup);
    this.propWall = wallGroup;

    // 2b. Pilar / Batente lateral (para Alongamento Peitoral)
    const postGroup = new THREE.Group();
    const postMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 2.28, 0.2),
      new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.55, metalness: 0.2, envMapIntensity: 0.4 })
    );
    postMesh.position.set(-0.75, 1.14, -0.06);
    postMesh.castShadow = true;
    postMesh.receiveShadow = true;
    postGroup.add(postMesh);

    const postAccent = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, 2.1, 0.21),
      new THREE.MeshBasicMaterial({ color: '#10b981' })
    );
    postAccent.position.set(-0.68, 1.1, -0.06);
    postGroup.add(postAccent);

    postGroup.visible = false;
    this.propsGroup.add(postGroup);
    this.propPost = postGroup;

    // 3. Cadeira ergonômica (para Agachamento com cadeira)
    const chairGroup = new THREE.Group();
    const chairFrameMat = new THREE.MeshStandardMaterial({ color: '#64748b', roughness: 0.35, metalness: 0.7, envMapIntensity: 0.8 });
    const chairPadMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.58, metalness: 0.1, envMapIntensity: 0.3 });

    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.055, 0.44), chairPadMat);
    seat.position.set(0, 0.44, -0.45);
    seat.castShadow = true;
    seat.receiveShadow = true;
    chairGroup.add(seat);

    const seatRim = new THREE.Mesh(new THREE.BoxGeometry(0.47, 0.014, 0.45), chairFrameMat);
    seatRim.position.set(0, 0.415, -0.45);
    chairGroup.add(seatRim);

    const backrest = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.4, 0.045), chairPadMat);
    backrest.position.set(0, 0.69, -0.66);
    backrest.rotation.x = -0.08;
    backrest.castShadow = true;
    chairGroup.add(backrest);

    const legPositions = [
      [-0.2, 0.21, -0.26],
      [0.2, 0.21, -0.26],
      [-0.2, 0.21, -0.64],
      [0.2, 0.21, -0.64]
    ];
    for (const [lx, ly, lz] of legPositions) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.013, 0.42, 12), chairFrameMat);
      leg.position.set(lx, ly, lz);
      leg.castShadow = true;
      chairGroup.add(leg);
    }
    chairGroup.visible = false;
    this.propsGroup.add(chairGroup);
    this.propChair = chairGroup;

    // 4. Esteira elétrica detalhada
    const tmGroup = new THREE.Group();
    const tmBodyMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.4, metalness: 0.6, envMapIntensity: 0.7 });
    const tmTrimMat = new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.35, metalness: 0.75, envMapIntensity: 0.8 });
    const tmScreenMat = new THREE.MeshStandardMaterial({ color: '#0f172a', emissive: '#10b981', emissiveIntensity: 0.5, roughness: 0.2 });

    const deckFrame = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.11, 1.68), tmBodyMat);
    deckFrame.position.set(0, 0.08, 0.04);
    deckFrame.castShadow = true;
    deckFrame.receiveShadow = true;
    tmGroup.add(deckFrame);

    // Carena do motor frontal
    const motorHood = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.14, 0.26), tmTrimMat);
    motorHood.position.set(0, 0.13, 0.76);
    motorHood.castShadow = true;
    tmGroup.add(motorHood);

    // Lona animada de corrida
    const beltCanvas = document.createElement('canvas');
    beltCanvas.width = 256;
    beltCanvas.height = 512;
    const bCtx = beltCanvas.getContext('2d');
    bCtx.fillStyle = '#0b1120';
    bCtx.fillRect(0, 0, 256, 512);
    bCtx.fillStyle = '#1e293b';
    for (let y = 0; y < 512; y += 32) {
      bCtx.fillRect(16, y, 224, 5);
    }
    bCtx.fillStyle = '#10b981';
    bCtx.fillRect(14, 0, 7, 512);
    bCtx.fillRect(235, 0, 7, 512);
    bCtx.fillStyle = 'rgba(56,189,248,0.28)';
    bCtx.fillRect(125, 0, 6, 512);

    this.beltTexture = new THREE.CanvasTexture(beltCanvas);
    this.beltTexture.wrapS = THREE.RepeatWrapping;
    this.beltTexture.wrapT = THREE.RepeatWrapping;
    this.beltTexture.repeat.set(1, 2.5);

    const beltMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.56, 1.48),
      new THREE.MeshStandardMaterial({ map: this.beltTexture, roughness: 0.85, envMapIntensity: 0.2 })
    );
    beltMesh.rotation.x = -Math.PI / 2;
    beltMesh.position.set(0, TREADMILL_BELT_Y, -0.02);
    beltMesh.receiveShadow = true;
    tmGroup.add(beltMesh);

    for (const side of [-1, 1]) {
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.04, 1.12, 16), tmTrimMat);
      mast.position.set(side * 0.35, 0.64, 0.66);
      mast.rotation.x = -0.18;
      mast.castShadow = true;
      tmGroup.add(mast);

      const handle = new THREE.Mesh(new THREE.CapsuleGeometry(0.023, 0.38, 6, 12), tmBodyMat);
      handle.position.set(side * 0.35, 0.98, 0.42);
      handle.rotation.x = Math.PI / 2 - 0.12;
      handle.castShadow = true;
      tmGroup.add(handle);
    }

    const consoleBox = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.24, 0.22), tmBodyMat);
    consoleBox.position.set(0, 1.15, 0.6);
    consoleBox.rotation.x = -0.45;
    consoleBox.castShadow = true;
    tmGroup.add(consoleBox);

    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.13), tmScreenMat);
    screen.position.set(0, 1.2, 0.5);
    screen.rotation.x = -0.45;
    tmGroup.add(screen);

    tmGroup.visible = false;
    this.propsGroup.add(tmGroup);
    this.propTreadmill = tmGroup;
  }

  buildCharacterRig() {
    this.mats = {
      skin: new THREE.MeshStandardMaterial({ color: '#e2ae8c', roughness: 0.52, metalness: 0.04, envMapIntensity: 0.35 }),
      hair: new THREE.MeshStandardMaterial({ color: '#171f2e', roughness: 0.68, envMapIntensity: 0.25 }),
      eyes: new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.18, envMapIntensity: 0.6 }),
      sclera: new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.3 }),
      shirt: new THREE.MeshStandardMaterial({ color: '#0d9488', roughness: 0.62, metalness: 0.05, envMapIntensity: 0.3 }),
      shirtTrim: new THREE.MeshStandardMaterial({ color: '#14b8a6', roughness: 0.45, envMapIntensity: 0.4 }),
      shorts: new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.72, envMapIntensity: 0.25 }),
      shoe: new THREE.MeshStandardMaterial({ color: '#f1f5f9', roughness: 0.42, metalness: 0.08, envMapIntensity: 0.55 }),
      shoeAccent: new THREE.MeshStandardMaterial({ color: '#10b981', roughness: 0.35, metalness: 0.15, envMapIntensity: 0.6 }),
      watch: new THREE.MeshStandardMaterial({ color: '#020617', emissive: '#38bdf8', emissiveIntensity: 0.35, roughness: 0.25, metalness: 0.6 }),
      joints: new THREE.MeshStandardMaterial({ color: '#d69f7d', roughness: 0.54, envMapIntensity: 0.3 })
    };

    this.muscleMats = {
      core: this.mats.shirt.clone(),
      chest: this.mats.shirt.clone(),
      shoulders: this.mats.shirt.clone(),
      back: this.mats.shirt.clone(),
      arms: this.mats.skin.clone(),
      glutes: this.mats.shorts.clone(),
      hips: this.mats.shorts.clone(),
      quads: this.mats.skin.clone(),
      hamstrings: this.mats.skin.clone(),
      calves: this.mats.skin.clone()
    };

    const m = this.mats;
    const mm = this.muscleMats;

    this.charRoot = new THREE.Group();
    this.scene.add(this.charRoot);

    // PELVIS (pivô central) com forma atlética suave
    this.pelvis = new THREE.Group();
    this.pelvis.position.set(0, 0.94, 0);
    this.charRoot.add(this.pelvis);

    const pelvisGeo = createLatheFromProfile([
      [0.095, -0.075],
      [0.145, -0.02],
      [0.148, 0.035],
      [0.125, 0.085]
    ], 22, 1.08, 0.78);
    const pelvisMesh = new THREE.Mesh(pelvisGeo, mm.glutes);
    pelvisMesh.castShadow = true;
    this.pelvis.add(pelvisMesh);

    const waistband = new THREE.Mesh(
      new THREE.CylinderGeometry(0.132, 0.136, 0.036, 22),
      mm.hips
    );
    waistband.scale.set(1.06, 1, 0.78);
    waistband.position.y = 0.072;
    this.pelvis.add(waistband);

    // SPINE -> CHEST -> NECK -> HEAD
    this.spine = new THREE.Group();
    this.spine.position.set(0, 0.085, 0);
    this.pelvis.add(this.spine);

    const waistGeo = createLatheFromProfile([
      [0.116, 0.0],
      [0.112, 0.1],
      [0.128, 0.21]
    ], 22, 1.06, 0.76);
    const waistMesh = new THREE.Mesh(waistGeo, mm.core);
    waistMesh.castShadow = true;
    this.spine.add(waistMesh);

    this.chest = new THREE.Group();
    this.chest.position.set(0, 0.195, 0);
    this.spine.add(this.chest);

    const torsoGeo = createLatheFromProfile([
      [0.126, 0.0],
      [0.142, 0.1],
      [0.156, 0.2],
      [0.138, 0.265],
      [0.062, 0.295]
    ], 24, 1.16, 0.76);
    const torsoMesh = new THREE.Mesh(torsoGeo, mm.chest);
    torsoMesh.castShadow = true;
    this.chest.add(torsoMesh);

    // Peitoral esculpido e definição dorsal
    for (const sx of [-0.072, 0.072]) {
      const pec = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 14), mm.chest);
      pec.scale.set(1.05, 0.82, 0.55);
      pec.position.set(sx, 0.185, 0.085);
      this.chest.add(pec);
    }

    const backSculpt = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.085, 0.14, 8, 16),
      mm.back
    );
    backSculpt.scale.set(1.35, 1, 0.55);
    backSculpt.position.set(0, 0.16, -0.075);
    this.chest.add(backSculpt);

    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.066, 0.012, 10, 22), m.shirtTrim);
    collar.rotation.x = Math.PI / 2 - 0.12;
    collar.position.set(0, 0.285, 0.01);
    this.chest.add(collar);

    const shoulderBar = new THREE.Mesh(new THREE.CapsuleGeometry(0.068, 0.30, 10, 16), mm.shoulders);
    shoulderBar.rotation.z = Math.PI / 2;
    shoulderBar.position.set(0, 0.235, 0);
    shoulderBar.castShadow = true;
    this.chest.add(shoulderBar);

    // PESCOÇO & CABEÇA ESCULPIDA
    this.neck = new THREE.Group();
    this.neck.position.set(0, 0.285, 0);
    this.chest.add(this.neck);

    const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.054, 0.09, 16), m.skin);
    neckMesh.position.y = 0.04;
    neckMesh.castShadow = true;
    this.neck.add(neckMesh);

    this.head = new THREE.Group();
    this.head.position.set(0, 0.15, 0.008);
    this.neck.add(this.head);

    const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.102, 24, 20), m.skin);
    cranium.scale.set(0.9, 1.04, 0.98);
    cranium.castShadow = true;
    this.head.add(cranium);

    const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.074, 18, 14), m.skin);
    jaw.scale.set(0.82, 0.85, 0.92);
    jaw.position.set(0, -0.055, 0.022);
    this.head.add(jaw);

    // Orelhas
    for (const ex of [-0.092, 0.092]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 10), m.joints);
      ear.scale.set(0.45, 1.0, 0.72);
      ear.position.set(ex, -0.008, -0.005);
      this.head.add(ear);
    }

    // Cabelo estilizado em camadas
    const hairTop = new THREE.Mesh(
      new THREE.SphereGeometry(0.106, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.58),
      m.hair
    );
    hairTop.scale.set(0.92, 1.02, 1.02);
    hairTop.rotation.x = -0.28;
    hairTop.position.set(0, 0.012, -0.006);
    this.head.add(hairTop);

    const hairFront = new THREE.Mesh(new THREE.CapsuleGeometry(0.032, 0.08, 6, 12), m.hair);
    hairFront.rotation.z = Math.PI / 2;
    hairFront.position.set(0, 0.076, 0.052);
    this.head.add(hairFront);

    // Rosto expressivo (+Z)
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.015, 0.036, 10), m.joints);
    nose.rotation.x = Math.PI * 0.36;
    nose.position.set(0, -0.014, 0.098);
    this.head.add(nose);

    for (const sx of [-0.034, 0.034]) {
      const eyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 10), m.sclera);
      eyeWhite.scale.set(1.0, 0.8, 0.6);
      eyeWhite.position.set(sx, 0.012, 0.091);
      this.head.add(eyeWhite);

      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 8), m.eyes);
      pupil.position.set(sx, 0.012, 0.097);
      this.head.add(pupil);

      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.007, 0.01), m.hair);
      brow.position.set(sx, 0.032, 0.092);
      brow.rotation.z = sx < 0 ? 0.08 : -0.08;
      this.head.add(brow);
    }

    // BRAÇOS ESCULPIDOS (Esquerdo +X, Direito -X)
    const upperArmGeo = createLatheFromProfile([
      [0.05, 0.0],
      [0.049, -0.06],
      [0.047, -0.14],
      [0.039, -0.23],
      [0.035, -0.26]
    ], 18, 0.96, 1.04);

    const forearmGeo = createLatheFromProfile([
      [0.038, 0.0],
      [0.041, -0.06],
      [0.034, -0.15],
      [0.026, -0.24]
    ], 18, 0.96, 1.04);

    const buildArm = (sideSign) => {
      const shoulder = new THREE.Group();
      shoulder.position.set(sideSign * 0.215, 0.235, 0);
      this.chest.add(shoulder);

      // Manga curta da camiseta no ombro
      const sleeve = new THREE.Mesh(
        createLatheFromProfile([
          [0.057, 0.01],
          [0.058, -0.05],
          [0.053, -0.105]
        ], 18),
        mm.shoulders
      );
      sleeve.castShadow = true;
      shoulder.add(sleeve);

      const sJoint = new THREE.Mesh(new THREE.SphereGeometry(0.056, 16, 14), mm.shoulders);
      sJoint.castShadow = true;
      shoulder.add(sJoint);

      const upperArm = new THREE.Mesh(upperArmGeo, mm.arms);
      upperArm.castShadow = true;
      shoulder.add(upperArm);

      const elbow = new THREE.Group();
      elbow.position.set(0, -0.26, 0);
      shoulder.add(elbow);

      const eJoint = new THREE.Mesh(new THREE.SphereGeometry(0.037, 14, 12), m.joints);
      elbow.add(eJoint);

      const forearm = new THREE.Mesh(forearmGeo, mm.arms);
      forearm.castShadow = true;
      elbow.add(forearm);

      const wrist = new THREE.Group();
      wrist.position.set(0, -0.24, 0);
      elbow.add(wrist);

      // Smartwatch no pulso esquerdo
      if (sideSign === 1) {
        const strap = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.026, 14), m.shorts);
        strap.position.y = 0.02;
        wrist.add(strap);
        const face = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.03, 0.012), m.watch);
        face.position.set(0.024, 0.02, 0.016);
        wrist.add(face);
      }

      const palm = new THREE.Mesh(new THREE.CapsuleGeometry(0.026, 0.044, 6, 12), m.skin);
      palm.scale.set(0.72, 1.0, 1.25);
      palm.position.y = -0.042;
      palm.castShadow = true;
      wrist.add(palm);

      const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.026, 4, 8), m.skin);
      thumb.position.set(-sideSign * 0.01, -0.034, 0.036);
      thumb.rotation.x = 0.55;
      wrist.add(thumb);

      const handContact = new THREE.Object3D();
      handContact.position.set(0, -0.088, 0);
      wrist.add(handContact);

      const palmContact = new THREE.Object3D();
      palmContact.position.set(0, -0.042, -0.034);
      wrist.add(palmContact);

      return { shoulder, elbow, wrist, handContact, palmContact };
    };

    const armL = buildArm(1);
    const armR = buildArm(-1);
    this.shoulderL = armL.shoulder;
    this.elbowL = armL.elbow;
    this.wristL = armL.wrist;
    this.handContactL = armL.handContact;
    this.palmContactL = armL.palmContact;

    this.shoulderR = armR.shoulder;
    this.elbowR = armR.elbow;
    this.wristR = armR.wrist;
    this.handContactR = armR.handContact;
    this.palmContactR = armR.palmContact;

    // PERNAS ESCULPIDAS (Esquerda +X, Direita -X)
    const shortGeo = createLatheFromProfile([
      [0.078, 0.0],
      [0.076, -0.08],
      [0.068, -0.175]
    ], 20, 0.96, 1.05);

    const thighGeo = createLatheFromProfile([
      [0.072, -0.05],
      [0.068, -0.16],
      [0.058, -0.3],
      [0.049, -0.41]
    ], 20, 0.95, 1.06);

    const shinGeo = createLatheFromProfile([
      [0.048, 0.0],
      [0.055, -0.11],
      [0.044, -0.24],
      [0.034, -0.39]
    ], 20, 0.94, 1.08);

    const buildLeg = (sideSign) => {
      const hip = new THREE.Group();
      hip.position.set(sideSign * 0.098, -0.04, 0);
      this.pelvis.add(hip);

      const shortLeg = new THREE.Mesh(shortGeo, mm.hips);
      shortLeg.castShadow = true;
      hip.add(shortLeg);

      const thigh = new THREE.Mesh(thighGeo, mm.quads);
      thigh.castShadow = true;
      hip.add(thigh);

      const hamSculpt = new THREE.Mesh(new THREE.CapsuleGeometry(0.038, 0.16, 6, 12), mm.hamstrings);
      hamSculpt.position.set(0, -0.24, -0.036);
      hip.add(hamSculpt);

      const knee = new THREE.Group();
      knee.position.set(0, -0.41, 0);
      hip.add(knee);

      const kneeJoint = new THREE.Mesh(new THREE.SphereGeometry(0.049, 16, 14), m.joints);
      knee.add(kneeJoint);

      const kneeFrontContact = new THREE.Object3D();
      kneeFrontContact.position.set(0, -0.01, 0.05);
      knee.add(kneeFrontContact);

      const shin = new THREE.Mesh(shinGeo, mm.calves);
      shin.castShadow = true;
      knee.add(shin);

      const ankle = new THREE.Group();
      ankle.position.set(0, -0.40, 0);
      knee.add(ankle);

      const ankleJoint = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 12), m.joints);
      ankle.add(ankleJoint);

      // Tênis esportivo esculpido
      const shoeBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.044, 0.115, 8, 14), m.shoe);
      shoeBody.rotation.x = Math.PI / 2;
      shoeBody.scale.set(1.0, 1.0, 0.82);
      shoeBody.position.set(0, -0.038, 0.048);
      shoeBody.castShadow = true;
      ankle.add(shoeBody);

      const shoeTongue = new THREE.Mesh(new THREE.SphereGeometry(0.038, 12, 10), m.shoeAccent);
      shoeTongue.scale.set(0.95, 0.72, 1.2);
      shoeTongue.position.set(0, -0.015, 0.038);
      ankle.add(shoeTongue);

      const shoeSole = new THREE.Mesh(new THREE.CapsuleGeometry(0.047, 0.125, 6, 12), m.shoeAccent);
      shoeSole.rotation.x = Math.PI / 2;
      shoeSole.scale.set(1.02, 1.02, 0.36);
      shoeSole.position.set(0, -0.068, 0.048);
      ankle.add(shoeSole);

      const heelContact = new THREE.Object3D();
      heelContact.position.set(0, -0.084, -0.038);
      ankle.add(heelContact);

      const toeContact = new THREE.Object3D();
      toeContact.position.set(0, -0.084, 0.135);
      ankle.add(toeContact);

      return { hip, knee, ankle, kneeFrontContact, heelContact, toeContact };
    };

    const legL = buildLeg(1);
    const legR = buildLeg(-1);
    this.hipL = legL.hip;
    this.kneeL = legL.knee;
    this.ankleL = legL.ankle;
    this.kneeContactL = legL.kneeFrontContact;
    this.heelContactL = legL.heelContact;
    this.toeContactL = legL.toeContact;

    this.hipR = legR.hip;
    this.kneeR = legR.knee;
    this.ankleR = legR.ankle;
    this.kneeContactR = legR.kneeFrontContact;
    this.heelContactR = legR.heelContact;
    this.toeContactR = legR.toeContact;

    // Marcadores de contato para solo/tapete
    this.backPelvisContact = new THREE.Object3D();
    this.backPelvisContact.position.set(0, 0, -0.105);
    this.pelvis.add(this.backPelvisContact);

    this.backChestContact = new THREE.Object3D();
    this.backChestContact.position.set(0, 0.15, -0.115);
    this.chest.add(this.backChestContact);

    this.sideForearmContactL = new THREE.Object3D();
    this.sideForearmContactL.position.set(0, -0.12, -0.038);
    this.elbowL.add(this.sideForearmContactL);

    this.sideForearmContactR = new THREE.Object3D();
    this.sideForearmContactR.position.set(0, -0.12, -0.038);
    this.elbowR.add(this.sideForearmContactR);

    this.sideAnkleContactL = new THREE.Object3D();
    this.sideAnkleContactL.position.set(0.048, -0.068, 0.048);
    this.ankleL.add(this.sideAnkleContactL);

    this.sideAnkleContactR = new THREE.Object3D();
    this.sideAnkleContactR.position.set(-0.048, -0.068, 0.048);
    this.ankleR.add(this.sideAnkleContactR);

    this.allJoints = [
      this.pelvis, this.spine, this.chest, this.neck, this.head,
      this.shoulderL, this.elbowL, this.wristL,
      this.shoulderR, this.elbowR, this.wristR,
      this.hipL, this.kneeL, this.ankleL,
      this.hipR, this.kneeR, this.ankleR
    ];
  }

  captureJointRotations() {
    return this.allJoints.map(j => ({ x: j.rotation.x, y: j.rotation.y, z: j.rotation.z }));
  }

  blendFromPrevious(prev, alpha) {
    if (!prev || alpha >= 1) return;
    const lerpAngle = (a, b, t) => a + (b - a) * t;
    this.allJoints.forEach((j, idx) => {
      const p = prev[idx];
      if (!p) return;
      j.rotation.x = lerpAngle(p.x, j.rotation.x, alpha);
      j.rotation.y = lerpAngle(p.y, j.rotation.y, alpha);
      j.rotation.z = lerpAngle(p.z, j.rotation.z, alpha);
    });
  }

  setExercise({ anim, prop, defaultCamera, muscles = [], speedKmh = 4.5, incline = 0 }) {
    const changedAnim = this.animId !== anim;
    if (changedAnim && this.allJoints) {
      this.prevPose = this.captureJointRotations();
      this.blendAlpha = 0;
      this.simTime = 0;
    }

    this.animId = anim || 'squat';
    this.activeMuscles = muscles || [];
    this.treadmillSpeedKmh = speedKmh || 4.5;
    this.treadmillIncline = incline || 0;

    this.propMat.visible = prop === 'mat';
    this.propWall.visible = prop === 'wall';
    this.propPost.visible = prop === 'doorframe';
    this.propChair.visible = prop === 'chair';
    this.propTreadmill.visible = prop === 'treadmill';

    if (prop === 'treadmill') {
      this.propTreadmill.rotation.x = -(this.treadmillIncline * 0.015);
    }

    if (defaultCamera && CAMERA_PRESETS[defaultCamera]) {
      this.setCameraPreset(defaultCamera);
    }
  }

  setTreadmillParams(speedKmh, incline = 0) {
    this.treadmillSpeedKmh = speedKmh;
    this.treadmillIncline = incline;
    if (this.propTreadmill.visible) {
      this.propTreadmill.rotation.x = -(incline * 0.015);
    }
  }

  setSide(side) {
    const next = side === 'left' ? 'left' : 'right';
    if (next !== this.activeSide && this.allJoints) {
      this.prevPose = this.captureJointRotations();
      this.blendAlpha = 0;
    }
    this.activeSide = next;
  }

  setPlaying(playing) {
    this.playing = Boolean(playing);
  }

  setAutoRotate(enabled) {
    this.autoRotate = Boolean(enabled);
    if (this.controls) {
      this.controls.autoRotate = this.autoRotate;
    }
  }

  setSpeedMultiplier(mult) {
    this.speedMultiplier = mult;
  }

  setHighlightMuscles(enabled) {
    this.highlightMuscles = Boolean(enabled);
  }

  setCameraPreset(presetName) {
    const preset = CAMERA_PRESETS[presetName] || CAMERA_PRESETS.threeQuarter;
    this.camera.position.set(...preset.pos);
    this.controls.target.set(...preset.target);
    this.controls.update();
  }

  resetPose() {
    this.charRoot.position.set(0, 0, 0);
    this.charRoot.rotation.set(0, 0, 0);
    this.pelvis.position.set(0, 0.94, 0);
    for (const j of this.allJoints) {
      j.rotation.set(0, 0, 0);
    }
  }

  snapToSupport(supportY, markers) {
    this.charRoot.updateMatrixWorld(true);
    let minY = Infinity;
    const v = new THREE.Vector3();
    for (const obj of markers) {
      obj.getWorldPosition(v);
      if (v.y < minY) minY = v.y;
    }
    if (Number.isFinite(minY)) {
      this.charRoot.position.y += (supportY - minY);
    }
  }

  emitPhaseCue(text) {
    if (text !== this.lastPhaseText) {
      this.lastPhaseText = text;
      this.onPhaseChange(text);
    }
  }

  updateMuscleHighlights(nowSec) {
    const pulse = 0.28 + 0.22 * Math.sin(nowSec * 4.2);
    for (const [key, mat] of Object.entries(this.muscleMats)) {
      if (this.highlightMuscles && this.activeMuscles.includes(key)) {
        mat.emissive.set('#10b981');
        mat.emissiveIntensity = pulse;
      } else {
        mat.emissive.set('#000000');
        mat.emissiveIntensity = 0;
      }
    }
  }

  applyPose(t, dt) {
    this.resetPose();
    const isLeft = this.activeSide === 'left';
    const sgn = isLeft ? 1 : -1;

    const wave01 = (freq = 1.0, phase = 0) => 0.5 - 0.5 * Math.cos(t * freq + phase);
    const wave11 = (freq = 1.0, phase = 0) => Math.sin(t * freq + phase);

    let supportY = 0;
    let supportMarkers = [this.heelContactL, this.heelContactR];

    switch (this.animId) {
      case 'ankle_rotation': {
        const leg = isLeft
          ? { hip: this.hipL, knee: this.kneeL, ankle: this.ankleL }
          : { hip: this.hipR, knee: this.kneeR, ankle: this.ankleR };
        supportMarkers = isLeft ? [this.heelContactR, this.toeContactR] : [this.heelContactL, this.toeContactL];

        leg.hip.rotation.x = -0.34;
        leg.knee.rotation.x = 0.24;
        leg.ankle.rotation.x = 0.28 + 0.28 * Math.sin(t * 3.6);
        leg.ankle.rotation.y = 0.36 * Math.cos(t * 3.6);
        leg.ankle.rotation.z = 0.18 * Math.sin(t * 3.6);
        this.shoulderL.rotation.z = 0.16;
        this.shoulderR.rotation.z = -0.16;
        this.emitPhaseCue(isLeft ? 'Gire o tornozelo esquerdo' : 'Gire o tornozelo direito');
        break;
      }

      case 'hip_rotation': {
        const ang = t * 2.4;
        this.pelvis.position.x = 0.085 * Math.cos(ang);
        this.pelvis.position.z = 0.075 * Math.sin(ang);
        this.pelvis.rotation.z = -0.12 * Math.cos(ang);
        this.pelvis.rotation.x = 0.1 * Math.sin(ang);
        this.spine.rotation.z = 0.1 * Math.cos(ang);
        this.spine.rotation.x = -0.08 * Math.sin(ang);
        this.shoulderL.rotation.z = 0.45;
        this.elbowL.rotation.x = -0.3;
        this.elbowL.rotation.z = -0.75;
        this.shoulderR.rotation.z = -0.45;
        this.elbowR.rotation.x = -0.3;
        this.elbowR.rotation.z = 0.75;
        this.hipL.rotation.z = 0.12;
        this.hipR.rotation.z = -0.12;
        this.emitPhaseCue('Círculos amplos com o quadril');
        break;
      }

      case 'leg_swing': {
        const swing = 0.68 * wave11(2.8);
        const leg = isLeft ? { hip: this.hipL, knee: this.kneeL } : { hip: this.hipR, knee: this.kneeR };
        supportMarkers = isLeft ? [this.heelContactR, this.toeContactR] : [this.heelContactL, this.toeContactL];
        leg.hip.rotation.x = swing;
        leg.knee.rotation.x = 0.08;
        this.shoulderL.rotation.z = 0.3;
        this.shoulderR.rotation.z = -0.3;
        this.shoulderL.rotation.x = -swing * 0.35;
        this.shoulderR.rotation.x = swing * 0.35;
        this.emitPhaseCue(swing < 0 ? 'Balanço para frente' : 'Balanço para trás');
        break;
      }

      case 'arm_circles': {
        const ang = t * 3.0;
        this.shoulderL.rotation.z = Math.PI / 2 - 0.05 + 0.16 * Math.sin(ang);
        this.shoulderL.rotation.x = 0.22 * Math.cos(ang);
        this.shoulderR.rotation.z = -(Math.PI / 2 - 0.05 + 0.16 * Math.sin(ang));
        this.shoulderR.rotation.x = 0.22 * Math.cos(ang);
        this.hipL.rotation.z = 0.07;
        this.hipR.rotation.z = -0.07;
        this.emitPhaseCue('Ombros relaxados • Giro contínuo');
        break;
      }

      case 'high_knees': {
        const phase = t * 4.5;
        const liftL = Math.max(0, Math.sin(phase));
        const liftR = Math.max(0, -Math.sin(phase));
        this.hipL.rotation.x = -1.45 * liftL;
        this.kneeL.rotation.x = 1.55 * liftL;
        this.hipR.rotation.x = -1.45 * liftR;
        this.kneeR.rotation.x = 1.55 * liftR;
        this.elbowL.rotation.x = -1.3;
        this.elbowR.rotation.x = -1.3;
        this.shoulderL.rotation.x = -0.75 * liftR + 0.25 * liftL;
        this.shoulderR.rotation.x = -0.75 * liftL + 0.25 * liftR;
        supportMarkers = [this.toeContactL, this.toeContactR];
        this.emitPhaseCue('Eleve os joelhos até a linha do quadril');
        break;
      }

      case 'treadmill': {
        const kmh = this.treadmillSpeedKmh || 4.5;
        const isJog = kmh >= 5.3;
        const freq = isJog ? 6.8 : 3.2 + (kmh - 3.0) * 0.85;
        const stride = isJog ? 0.62 : 0.34 + (kmh - 3.0) * 0.08;
        const p = t * freq;

        const swingL = Math.sin(p) * stride;
        const swingR = Math.sin(p + Math.PI) * stride;
        const kneeLiftL = Math.max(0, -Math.cos(p)) * (isJog ? 1.15 : 0.55);
        const kneeLiftR = Math.max(0, -Math.cos(p + Math.PI)) * (isJog ? 1.15 : 0.55);

        this.hipL.rotation.x = swingL;
        this.kneeL.rotation.x = 0.12 + kneeLiftL;
        this.hipR.rotation.x = swingR;
        this.kneeR.rotation.x = 0.12 + kneeLiftR;

        this.spine.rotation.x = isJog ? 0.14 : 0.06;
        this.elbowL.rotation.x = isJog ? -1.45 : -0.85;
        this.elbowR.rotation.x = isJog ? -1.45 : -0.85;
        this.shoulderL.rotation.x = -swingL * 0.9;
        this.shoulderR.rotation.x = -swingR * 0.9;

        this.charRoot.position.z = -0.05;
        const bounce = isJog ? Math.abs(Math.sin(p)) * 0.032 : 0;
        supportY = TREADMILL_BELT_Y + bounce;
        supportMarkers = [this.toeContactL, this.heelContactL, this.toeContactR, this.heelContactR];
        this.emitPhaseCue(`${isJog ? 'Trote' : 'Caminhada'} • ${String(kmh).replace('.', ',')} km/h`);
        break;
      }

      case 'squat':
      case 'chair_squat': {
        const d = wave01(2.1);
        this.hipL.rotation.x = -1.46 * d;
        this.hipR.rotation.x = -1.46 * d;
        this.hipL.rotation.z = 0.1;
        this.hipR.rotation.z = -0.1;
        this.kneeL.rotation.x = 1.6 * d;
        this.kneeR.rotation.x = 1.6 * d;
        this.ankleL.rotation.x = -0.24 * d;
        this.ankleR.rotation.x = -0.24 * d;
        this.spine.rotation.x = 0.34 * d;
        this.shoulderL.rotation.x = -1.25 * d - 0.15;
        this.shoulderR.rotation.x = -1.25 * d - 0.15;
        this.elbowL.rotation.x = -0.35 + 0.25 * d;
        this.elbowR.rotation.x = -0.35 + 0.25 * d;
        if (this.animId === 'chair_squat') this.charRoot.position.z = -0.04;
        supportMarkers = [this.heelContactL, this.heelContactR, this.toeContactL, this.toeContactR];
        this.emitPhaseCue(d > 0.55 ? 'Desça controlando • Calcanhares firmes' : 'Empurre o chão para subir');
        break;
      }

      case 'wall_pushup': {
        const press = wave01(2.3);
        const lean = 0.26 + 0.18 * press;
        this.charRoot.position.z = -0.02;
        this.pelvis.rotation.x = lean;
        this.ankleL.rotation.x = -lean * 0.85;
        this.ankleR.rotation.x = -lean * 0.85;
        this.hipL.rotation.z = 0.06;
        this.hipR.rotation.z = -0.06;

        this.shoulderL.rotation.x = -1.45 - 0.25 * press;
        this.shoulderR.rotation.x = -1.45 - 0.25 * press;
        this.shoulderL.rotation.z = 0.16 * press;
        this.shoulderR.rotation.z = -0.16 * press;
        this.elbowL.rotation.x = -0.12 - 1.25 * press;
        this.elbowR.rotation.x = -0.12 - 1.25 * press;
        this.wristL.rotation.x = -0.9 + 0.3 * press;
        this.wristR.rotation.x = -0.9 + 0.3 * press;
        supportMarkers = [this.toeContactL, this.toeContactR];
        this.emitPhaseCue(press > 0.55 ? 'Aproxime o peito da parede' : 'Empurre de volta mantendo o corpo reto');
        break;
      }

      case 'glute_bridge': {
        const lift = wave01(2.1);
        this.pelvis.rotation.x = -Math.PI / 2 - 0.36 * lift;
        this.spine.rotation.x = 0.36 * lift;
        this.hipL.rotation.x = -0.95 + 0.56 * lift;
        this.hipR.rotation.x = -0.95 + 0.56 * lift;
        this.kneeL.rotation.x = 1.9 - 0.42 * lift;
        this.kneeR.rotation.x = 1.9 - 0.42 * lift;
        this.ankleL.rotation.x = 0.42;
        this.ankleR.rotation.x = 0.42;
        this.shoulderL.rotation.z = 0.22;
        this.shoulderR.rotation.z = -0.22;
        this.charRoot.position.z = -0.22;
        supportY = MAT_TOP_Y;
        supportMarkers = [this.backChestContact, this.heelContactL, this.heelContactR];
        this.emitPhaseCue(lift > 0.65 ? 'Contraia os glúteos no topo' : 'Desça devagar sem despencar');
        break;
      }

      case 'bird_dog': {
        const cycle = (t * 0.85) % 2;
        const activeLeftArm = cycle < 1;
        const ext = Math.sin((cycle % 1) * Math.PI);

        this.pelvis.rotation.x = Math.PI / 2;
        this.neck.rotation.x = -0.55;
        this.shoulderL.rotation.x = -Math.PI / 2;
        this.shoulderR.rotation.x = -Math.PI / 2;
        this.hipL.rotation.x = -Math.PI / 2;
        this.hipR.rotation.x = -Math.PI / 2;
        this.kneeL.rotation.x = Math.PI / 2;
        this.kneeR.rotation.x = Math.PI / 2;

        if (activeLeftArm) {
          this.shoulderL.rotation.x = -Math.PI / 2 - (Math.PI / 2) * ext;
          this.hipR.rotation.x = -Math.PI / 2 + (Math.PI / 2) * ext;
          this.kneeR.rotation.x = (Math.PI / 2) * (1 - ext);
          supportMarkers = [this.handContactR, this.kneeContactL];
          this.emitPhaseCue('Braço esquerdo + perna direita estendidos');
        } else {
          this.shoulderR.rotation.x = -Math.PI / 2 - (Math.PI / 2) * ext;
          this.hipL.rotation.x = -Math.PI / 2 + (Math.PI / 2) * ext;
          this.kneeL.rotation.x = (Math.PI / 2) * (1 - ext);
          supportMarkers = [this.handContactL, this.kneeContactR];
          this.emitPhaseCue('Braço direito + perna esquerda estendidos');
        }
        supportY = MAT_TOP_Y;
        break;
      }

      case 'dead_bug': {
        const cycle = (t * 0.9) % 2;
        const leftArmDrops = cycle < 1;
        const ext = Math.sin((cycle % 1) * Math.PI);

        this.pelvis.rotation.x = -Math.PI / 2;
        this.shoulderL.rotation.x = -Math.PI / 2;
        this.shoulderR.rotation.x = -Math.PI / 2;
        this.hipL.rotation.x = -Math.PI / 2;
        this.hipR.rotation.x = -Math.PI / 2;
        this.kneeL.rotation.x = Math.PI / 2;
        this.kneeR.rotation.x = Math.PI / 2;

        if (leftArmDrops) {
          this.shoulderL.rotation.x = -Math.PI / 2 - 1.35 * ext;
          this.hipR.rotation.x = -Math.PI / 2 + 1.3 * ext;
          this.kneeR.rotation.x = (Math.PI / 2) * (1 - 0.88 * ext);
        } else {
          this.shoulderR.rotation.x = -Math.PI / 2 - 1.35 * ext;
          this.hipL.rotation.x = -Math.PI / 2 + 1.3 * ext;
          this.kneeL.rotation.x = (Math.PI / 2) * (1 - 0.88 * ext);
        }
        this.charRoot.position.z = -0.1;
        supportY = MAT_TOP_Y;
        supportMarkers = [this.backPelvisContact, this.backChestContact];
        this.emitPhaseCue('Mantenha a lombar encostada no tapete');
        break;
      }

      case 'knee_plank': {
        const breath = 0.015 * Math.sin(t * 2.5);
        this.pelvis.rotation.x = Math.PI / 2 - 0.32 + breath;
        this.neck.rotation.x = -0.35;
        this.shoulderL.rotation.x = -(Math.PI / 2 - 0.32);
        this.shoulderR.rotation.x = -(Math.PI / 2 - 0.32);
        this.wristL.rotation.x = -Math.PI / 2;
        this.wristR.rotation.x = -Math.PI / 2;
        this.kneeL.rotation.x = 1.05;
        this.kneeR.rotation.x = 1.05;
        this.hipL.rotation.z = 0.05;
        this.hipR.rotation.z = -0.05;
        supportY = MAT_TOP_Y;
        supportMarkers = [
          this.handContactL, this.handContactR,
          this.palmContactL, this.palmContactR,
          this.kneeContactL, this.kneeContactR
        ];
        this.emitPhaseCue('Abdômen contraído • Coluna alinhada');
        break;
      }

      case 'crunch': {
        const up = wave01(2.3);
        this.pelvis.rotation.x = -Math.PI / 2;
        this.hipL.rotation.x = -0.95;
        this.hipR.rotation.x = -0.95;
        this.kneeL.rotation.x = 1.85;
        this.kneeR.rotation.x = 1.85;
        this.ankleL.rotation.x = 0.45;
        this.ankleR.rotation.x = 0.45;

        this.spine.rotation.x = 0.52 * up;
        this.neck.rotation.x = 0.18 * up;
        this.shoulderL.rotation.x = -2.25;
        this.shoulderL.rotation.z = 0.65;
        this.elbowL.rotation.x = -1.7;
        this.shoulderR.rotation.x = -2.25;
        this.shoulderR.rotation.z = -0.65;
        this.elbowR.rotation.x = -1.7;

        this.charRoot.position.z = -0.18;
        supportY = MAT_TOP_Y;
        supportMarkers = [this.backPelvisContact, this.heelContactL, this.heelContactR];
        this.emitPhaseCue(up > 0.5 ? 'Solte o ar subindo os ombros' : 'Inspire descendo devagar');
        break;
      }

      case 'side_plank': {
        const breath = 0.012 * Math.sin(t * 2.5);
        const tilt = 0.177;
        if (!isLeft) {
          this.pelvis.rotation.z = Math.PI / 2 - tilt + breath;
          this.shoulderR.rotation.z = -(Math.PI / 2 - tilt);
          this.elbowR.rotation.x = -Math.PI / 2;
          this.shoulderL.rotation.z = 0.24;
          this.elbowL.rotation.x = -0.65;
          supportMarkers = [this.sideForearmContactR, this.sideAnkleContactR];
          this.emitPhaseCue('Prancha lateral direita • Quadril elevado');
        } else {
          this.pelvis.rotation.z = -(Math.PI / 2 - tilt + breath);
          this.shoulderL.rotation.z = Math.PI / 2 - tilt;
          this.elbowL.rotation.x = -Math.PI / 2;
          this.shoulderR.rotation.z = -0.24;
          this.elbowR.rotation.x = -0.65;
          supportMarkers = [this.sideForearmContactL, this.sideAnkleContactL];
          this.emitPhaseCue('Prancha lateral esquerda • Quadril elevado');
        }
        supportY = MAT_TOP_Y;
        break;
      }

      case 'lateral_leg_raise': {
        const lift = wave01(2.3);
        const legHip = isLeft ? this.hipL : this.hipR;
        supportMarkers = isLeft ? [this.heelContactR, this.toeContactR] : [this.heelContactL, this.toeContactL];
        legHip.rotation.z = sgn * (0.06 + 0.68 * lift);
        this.shoulderL.rotation.z = 0.52;
        this.shoulderR.rotation.z = -0.52;
        this.emitPhaseCue(isLeft ? 'Eleve a perna esquerda lateralmente' : 'Eleve a perna direita lateralmente');
        break;
      }

      case 'calf_raise': {
        const rise = wave01(2.5);
        this.ankleL.rotation.x = 0.46 * rise;
        this.ankleR.rotation.x = 0.46 * rise;
        this.hipL.rotation.z = 0.05;
        this.hipR.rotation.z = -0.05;
        this.shoulderL.rotation.z = 0.12;
        this.shoulderR.rotation.z = -0.12;
        supportMarkers = [this.toeContactL, this.toeContactR];
        this.emitPhaseCue(rise > 0.6 ? 'Segure no alto na ponta dos pés' : 'Desça os calcanhares com controle');
        break;
      }

      case 'side_steps': {
        const step = wave11(3.2);
        const wide = Math.abs(step);
        this.charRoot.position.x = step * 0.28;
        this.hipL.rotation.x = -0.22;
        this.hipR.rotation.x = -0.22;
        this.kneeL.rotation.x = 0.35;
        this.kneeR.rotation.x = 0.35;
        this.hipL.rotation.z = 0.28 * wide;
        this.hipR.rotation.z = -0.28 * wide;
        this.shoulderL.rotation.z = 0.25 + 0.2 * wide;
        this.shoulderR.rotation.z = -0.25 - 0.2 * wide;
        this.elbowL.rotation.x = -0.9;
        this.elbowR.rotation.x = -0.9;
        supportMarkers = [this.toeContactL, this.toeContactR];
        this.emitPhaseCue('Passos laterais em ritmo constante');
        break;
      }

      case 'torso_twist': {
        const twist = 0.58 * wave11(2.4);
        this.spine.rotation.y = twist;
        this.chest.rotation.y = twist * 0.45;
        this.hipL.rotation.z = 0.1;
        this.hipR.rotation.z = -0.1;
        this.shoulderL.rotation.x = -0.55;
        this.shoulderR.rotation.x = -0.55;
        this.shoulderL.rotation.z = 0.22;
        this.shoulderR.rotation.z = -0.22;
        this.elbowL.rotation.x = -1.55;
        this.elbowR.rotation.x = -1.55;
        this.emitPhaseCue('Gire o tronco mantendo o quadril firme');
        break;
      }

      case 'lateral_arm_raise': {
        const raise = wave01(2.1);
        const armAngle = 0.12 + 1.42 * raise;
        this.shoulderL.rotation.z = armAngle;
        this.shoulderR.rotation.z = -armAngle;
        this.elbowL.rotation.x = -0.14;
        this.elbowR.rotation.x = -0.14;
        this.hipL.rotation.z = 0.06;
        this.hipR.rotation.z = -0.06;
        this.emitPhaseCue(raise > 0.6 ? 'Suba até a linha dos ombros' : 'Desça devagar controlando');
        break;
      }

      case 'quad_stretch': {
        const pulse = 0.03 * Math.sin(t * 2.0);
        const leg = isLeft ? { hip: this.hipL, knee: this.kneeL } : { hip: this.hipR, knee: this.kneeR };
        const arm = isLeft
          ? { shoulder: this.shoulderL, elbow: this.elbowL, zSign: 1 }
          : { shoulder: this.shoulderR, elbow: this.elbowR, zSign: -1 };
        const oppArm = isLeft ? this.shoulderR : this.shoulderL;
        supportMarkers = isLeft ? [this.heelContactR, this.toeContactR] : [this.heelContactL, this.toeContactL];

        // Mão segurando firmemente o pé/tornozelo atrás
        leg.hip.rotation.x = 0.28 + pulse;
        leg.knee.rotation.x = 2.34 + pulse;
        this.spine.rotation.x = 0.06;
        arm.shoulder.rotation.x = 0.68;
        arm.shoulder.rotation.z = arm.zSign * 0.08;
        arm.elbow.rotation.x = -0.18;
        oppArm.rotation.z = -arm.zSign * 0.28;
        this.emitPhaseCue(isLeft ? 'Alongue a frente da coxa esquerda' : 'Alongue a frente da coxa direita');
        break;
      }

      case 'hamstring_stretch': {
        const pulse = 0.03 * Math.sin(t * 1.8);
        const frontLeg = isLeft
          ? { hip: this.hipL, knee: this.kneeL, ankle: this.ankleL }
          : { hip: this.hipR, knee: this.kneeR, ankle: this.ankleR };
        const backLeg = isLeft
          ? { hip: this.hipR, knee: this.kneeR, ankle: this.ankleR }
          : { hip: this.hipL, knee: this.kneeL, ankle: this.ankleL };

        frontLeg.hip.rotation.x = -0.62;
        frontLeg.knee.rotation.x = 0.04;
        frontLeg.ankle.rotation.x = -0.25;

        backLeg.hip.rotation.x = 0.26;
        backLeg.knee.rotation.x = 0.44;

        this.spine.rotation.x = 0.78 + pulse;
        this.shoulderL.rotation.x = -0.95;
        this.shoulderR.rotation.x = -0.95;
        this.emitPhaseCue('Incline a partir do quadril sem dobrar a coluna');
        break;
      }

      case 'calf_stretch': {
        const pulse = 0.035 * Math.sin(t * 1.8);
        const backLeg = isLeft
          ? { hip: this.hipL, knee: this.kneeL, ankle: this.ankleL }
          : { hip: this.hipR, knee: this.kneeR, ankle: this.ankleR };
        const frontLeg = isLeft
          ? { hip: this.hipR, knee: this.kneeR, ankle: this.ankleR }
          : { hip: this.hipL, knee: this.kneeL, ankle: this.ankleL };

        frontLeg.hip.rotation.x = -0.64 - pulse;
        frontLeg.knee.rotation.x = 0.74 + pulse;
        frontLeg.ankle.rotation.x = -0.12;

        backLeg.hip.rotation.x = 0.46;
        backLeg.knee.rotation.x = 0.04;
        backLeg.ankle.rotation.x = -0.45;

        this.spine.rotation.x = 0.12;
        this.shoulderL.rotation.x = -0.25;
        this.shoulderR.rotation.x = -0.25;
        supportMarkers = [this.heelContactL, this.heelContactR, this.toeContactL, this.toeContactR];
        this.emitPhaseCue('Pressione o calcanhar de trás no chão');
        break;
      }

      case 'hip_flexor_stretch': {
        const pulse = 0.035 * Math.sin(t * 1.8);
        const backLeg = isLeft
          ? { hip: this.hipL, knee: this.kneeL, kneeContact: this.kneeContactL }
          : { hip: this.hipR, knee: this.kneeR, kneeContact: this.kneeContactR };
        const frontLeg = isLeft
          ? { hip: this.hipR, knee: this.kneeR, heel: this.heelContactR }
          : { hip: this.hipL, knee: this.kneeL, heel: this.heelContactL };

        frontLeg.hip.rotation.x = -1.65 - pulse;
        frontLeg.knee.rotation.x = 1.65 + pulse;
        backLeg.hip.rotation.x = 0.22 + pulse;
        backLeg.knee.rotation.x = 1.35;

        this.shoulderL.rotation.z = 0.32;
        this.shoulderR.rotation.z = -0.32;
        this.elbowL.rotation.x = -0.4;
        this.elbowR.rotation.x = -0.4;
        supportY = MAT_TOP_Y;
        supportMarkers = [backLeg.kneeContact, frontLeg.heel];
        this.emitPhaseCue('Avance o quadril suavemente mantendo o tronco ereto');
        break;
      }

      case 'chest_stretch': {
        const pulse = 0.045 * Math.sin(t * 1.8);
        this.propPost.position.x = isLeft ? 1.5 : 0;
        const arm = isLeft ? { sh: this.shoulderL, z: 1 } : { sh: this.shoulderR, z: -1 };
        const other = isLeft ? { sh: this.shoulderR, z: -1 } : { sh: this.shoulderL, z: 1 };

        arm.sh.rotation.z = arm.z * 1.54;
        arm.sh.rotation.x = 0.24 + pulse;
        other.sh.rotation.z = other.z * 0.16;
        this.spine.rotation.y = arm.z * (-0.34 - pulse);
        this.hipL.rotation.z = 0.08;
        this.hipR.rotation.z = -0.08;
        this.emitPhaseCue('Abra o peito respirando profundamente');
        break;
      }

      case 'rest_day':
      default: {
        const sway = Math.sin(t * 1.4);
        this.shoulderL.rotation.z = 0.14 + 0.03 * sway;
        this.shoulderR.rotation.z = -0.14 - 0.03 * sway;
        this.hipL.rotation.z = 0.06;
        this.hipR.rotation.z = -0.06;
        this.chest.rotation.x = 0.02 * sway;
        this.emitPhaseCue('Recuperação ativa e hidratação');
        break;
      }
    }

    // Transição suave entre poses ao trocar de exercício
    if (this.blendAlpha < 1 && this.prevPose) {
      this.blendAlpha = Math.min(1, this.blendAlpha + dt * 5.0);
      this.blendFromPrevious(this.prevPose, this.blendAlpha);
    }

    this.snapToSupport(supportY, supportMarkers);
  }

  animate() {
    if (this.disposed) return;
    requestAnimationFrame(() => this.animate());

    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastFrameMs) / 1000);
    this.lastFrameMs = now;

    if (this.playing) {
      this.simTime += dt * this.speedMultiplier;
      if (this.propTreadmill.visible && this.animId === 'treadmill') {
        const beltSpeed = (this.treadmillSpeedKmh / 3.6) * 0.45 * this.speedMultiplier;
        this.beltOffset = (this.beltOffset + dt * beltSpeed) % 1;
        this.beltTexture.offset.y = -this.beltOffset;
      }
    }

    this.applyPose(this.simTime, dt);
    this.updateMuscleHighlights(now / 1000);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  bindResize() {
    this.resizeObserver = new ResizeObserver(() => {
      if (this.disposed) return;
      const w = this.container.clientWidth;
      const h = this.container.clientHeight;
      if (w > 0 && h > 0) {
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
      }
    });
    this.resizeObserver.observe(this.container);
  }

  dispose() {
    this.disposed = true;
    this.resizeObserver?.disconnect();
    this.controls?.dispose();
    this.envRT?.dispose();
    this.renderer?.dispose();
  }
}
