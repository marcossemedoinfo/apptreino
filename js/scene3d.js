// Motor 3D com Personal Trainer Humana Real (GLB SkinnedMesh) + IK Analítica + Precisão de Contato

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const CAMERA_PRESETS = {
  threeQuarter: { pos: [2.05, 1.46, 2.45], target: [0, 0.85, 0] },
  front: { pos: [0, 1.34, 2.98], target: [0, 0.86, 0] },
  side: { pos: [2.95, 1.22, 0.15], target: [0, 0.82, 0] },
  top: { pos: [0.05, 3.35, 1.3], target: [0, 0.72, 0] }
};

const MAT_TOP_Y = 0.030;
const TREADMILL_BELT_Y = 0.150;
const BENCH_TOP_Y = 0.380;
const SOLE_Y = 0.000;

// Valores padrão iniciais; medidos dinamicamente do esqueleto real em setupTrainerRig()
const DEFAULT_SEG = {
  thigh: 0.4133,
  shin: 0.4022,
  footH: 0.1146,
  footZ: 0.0326,
  hipsY: 0.9837,
  hipsZ: -0.0066,
  hipsToHipY: -0.0539,
  hipsToHipZ: 0.0623,
  hipY: 0.9298,
  hipZ: 0.0557,
  hipX: 0.0806,
  hipsToShY: 0.4292,
  hipsToShZ: 0.0258,
  upperArm: 0.2576,
  forearm: 0.2338
};

const BONE_PARENT = {
  Hips: null,
  Spine: 'Hips',
  Spine1: 'Spine',
  Spine2: 'Spine1',
  Neck: 'Spine2',
  Head: 'Neck',
  LeftShoulder: 'Spine2',
  LeftArm: 'LeftShoulder',
  LeftForeArm: 'LeftArm',
  LeftHand: 'LeftForeArm',
  RightShoulder: 'Spine2',
  RightArm: 'RightShoulder',
  RightForeArm: 'RightArm',
  RightHand: 'RightForeArm',
  LeftUpLeg: 'Hips',
  LeftLeg: 'LeftUpLeg',
  LeftFoot: 'LeftLeg',
  LeftToeBase: 'LeftFoot',
  RightUpLeg: 'Hips',
  RightLeg: 'RightUpLeg',
  RightFoot: 'RightLeg',
  RightToeBase: 'RightFoot'
};

const BONE_ORDER = Object.keys(BONE_PARENT);

// IK Analítica de 2 ossos para travar o tornozelo em (dz, dy) mantendo o pé horizontal
function solveLeg2BoneIK(dz, dy, seg, parentPitchX = 0) {
  const maxReach = seg.thigh + seg.shin - 0.004;
  let dist = Math.hypot(dz, dy);
  if (dist > maxReach) dist = maxReach;
  if (dist < 0.14) dist = 0.14;

  const cosKneeExt = Math.max(-1, Math.min(1, (seg.thigh ** 2 + seg.shin ** 2 - dist ** 2) / (2 * seg.thigh * seg.shin)));
  const kneeBend = Math.PI - Math.acos(cosKneeExt);

  const angDownToTarget = Math.atan2(dz, -dy);
  const cosA = Math.max(-1, Math.min(1, (seg.thigh ** 2 + dist ** 2 - seg.shin ** 2) / (2 * seg.thigh * dist)));
  const a = Math.acos(cosA);

  const thighWorldRx = -(angDownToTarget + a);
  const hipRx = thighWorldRx - parentPitchX;
  const footRx = -(parentPitchX + hipRx + kneeBend);
  return { hipRx, kneeRx: kneeBend, footRx };
}

// IK Analítica de braço 2 ossos para encostar palmas em um plano frontal (+Z)
function solveArm2BoneIK(dz, dy, seg, torsoPitchX = 0) {
  const maxReach = seg.upperArm + seg.forearm - 0.008;
  let dist = Math.hypot(dz, dy);
  if (dist > maxReach) dist = maxReach;
  if (dist < 0.14) dist = 0.14;

  const cosElbExt = Math.max(-1, Math.min(1, (seg.upperArm ** 2 + seg.forearm ** 2 - dist ** 2) / (2 * seg.upperArm * seg.forearm)));
  const elbowBend = -(Math.PI - Math.acos(cosElbExt));

  const angDownToTarget = Math.atan2(dz, -dy);
  const cosA = Math.max(-1, Math.min(1, (seg.upperArm ** 2 + dist ** 2 - seg.forearm ** 2) / (2 * seg.upperArm * dist)));
  const a = Math.acos(cosA);

  const upperWorldRx = -(angDownToTarget - a);
  const armRx = upperWorldRx - torsoPitchX;
  return { armRx, foreRx: elbowBend };
}

export class WorkoutScene3D {
  constructor(container, { onPhaseChange, onModelStatus } = {}) {
    this.container = container;
    this.onPhaseChange = onPhaseChange || (() => {});
    this.onModelStatus = onModelStatus || (() => {});

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

    this.modelReady = false;
    this.bones = {};
    this.restWorldQ = {};
    this.neutralWorldQ = {};
    this.seg = { ...DEFAULT_SEG };
    this.hipsRestPos = new THREE.Vector3(0, DEFAULT_SEG.hipsY, DEFAULT_SEG.hipsZ);
    this.markers = {};
    this.muscleRings = {};

    this.prevBoneLocalQ = {};
    this.blendAlpha = 1;
    this.currentHipsOffset = new THREE.Vector3();
    this.prevHipsOffset = new THREE.Vector3();

    this._qAccum = {};
    for (const b of BONE_ORDER) this._qAccum[b] = new THREE.Quaternion();
    this._qTmp = new THREE.Quaternion();
    this._qParent = new THREE.Quaternion();
    this._qTarget = new THREE.Quaternion();
    this._eulerTmp = new THREE.Euler(0, 0, 0, 'XYZ');
    this._vTmp = new THREE.Vector3();
    this._vTmp2 = new THREE.Vector3();

    this.initScene();
    this.buildStudioEnvironment();
    this.buildProps();
    this.charRoot = new THREE.Group();
    this.scene.add(this.charRoot);

    this.loadTrainerModel();
    this.setExercise({ anim: 'squat', prop: 'none', defaultCamera: 'threeQuarter', muscles: ['quads', 'glutes'] });
    this.bindResize();
    this.animate();
  }

  initScene() {
    const w = this.container.clientWidth || 640;
    const h = this.container.clientHeight || 420;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#09101f');
    this.scene.fog = new THREE.Fog('#09101f', 7.0, 15.0);

    this.camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 40);
    this.camera.position.set(...CAMERA_PRESETS.threeQuarter.pos);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;

    try {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      this.envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
      this.scene.environment = this.envRT.texture;
      pmrem.dispose();
    } catch {
      // Fallback sem PMREM
    }

    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.autoRotate = false;
    this.controls.autoRotateSpeed = 1.5;
    this.controls.minDistance = 1.3;
    this.controls.maxDistance = 5.6;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.target.set(...CAMERA_PRESETS.threeQuarter.target);
    this.controls.update();

    const hemi = new THREE.HemisphereLight('#f1f5f9', '#1e293b', 0.72);
    this.scene.add(hemi);

    const keyLight = new THREE.DirectionalLight('#fffaf0', 1.55);
    keyLight.position.set(2.4, 4.2, 3.2);
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

    const fillLight = new THREE.DirectionalLight('#cbd5e1', 0.65);
    fillLight.position.set(-2.6, 2.2, 2.5);
    this.scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight('#38bdf8', 0.75);
    rimLight.position.set(-2.0, 2.5, -2.8);
    this.scene.add(rimLight);
  }

  buildStudioEnvironment() {
    const floorCanvas = document.createElement('canvas');
    floorCanvas.width = 512;
    floorCanvas.height = 512;
    const fCtx = floorCanvas.getContext('2d');
    fCtx.fillStyle = '#0d1526';
    fCtx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 3600; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      fCtx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.022)' : 'rgba(16,185,129,0.018)';
      fCtx.fillRect(x, y, 2, 2);
    }
    fCtx.strokeStyle = 'rgba(148,163,184,0.05)';
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
        roughness: 0.82,
        metalness: 0.08,
        envMapIntensity: 0.25
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.03;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const platform = new THREE.Mesh(
      new THREE.CylinderGeometry(1.42, 1.48, 0.024, 64),
      new THREE.MeshStandardMaterial({
        color: '#14213a',
        roughness: 0.68,
        metalness: 0.16,
        envMapIntensity: 0.35
      })
    );
    platform.position.y = -0.012;
    platform.receiveShadow = true;
    this.scene.add(platform);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.38, 1.42, 64),
      new THREE.MeshBasicMaterial({
        color: '#10b981',
        transparent: true,
        opacity: 0.42,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.002;
    this.scene.add(ring);

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
    backdrop.position.y = 1.78;
    this.scene.add(backdrop);

    for (const bx of [-1.85, 0, 1.85]) {
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(0.035, 2.3, 0.035),
        new THREE.MeshBasicMaterial({ color: bx === 0 ? '#38bdf8' : '#10b981', transparent: true, opacity: 0.42 })
      );
      bar.position.set(bx, 1.35, -4.65 + Math.abs(bx) * 0.12);
      this.scene.add(bar);
    }
  }

  buildProps() {
    this.propsGroup = new THREE.Group();
    this.scene.add(this.propsGroup);

    // 1. Tapete de exercício
    const matGroup = new THREE.Group();
    const matMat = new THREE.MeshStandardMaterial({ color: '#0f766e', roughness: 0.82, metalness: 0.05, envMapIntensity: 0.22 });
    const matTrimMat = new THREE.MeshStandardMaterial({ color: '#2dd4bf', roughness: 0.55, envMapIntensity: 0.35 });

    const matThickness = MAT_TOP_Y - 0.002;
    const matBody = new THREE.Mesh(new THREE.BoxGeometry(0.84, matThickness, 1.98), matMat);
    matBody.position.y = 0.002 + matThickness / 2;
    matBody.receiveShadow = true;
    matBody.castShadow = true;
    matGroup.add(matBody);

    for (const ez of [-0.99, 0.99]) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(matThickness / 2, matThickness / 2, 0.84, 12), matTrimMat);
      cap.rotation.z = Math.PI / 2;
      cap.position.set(0, 0.002 + matThickness / 2, ez);
      matGroup.add(cap);
    }

    const centerLine = new THREE.Mesh(new THREE.PlaneGeometry(0.016, 1.82), matTrimMat);
    centerLine.rotation.x = -Math.PI / 2;
    centerLine.position.y = MAT_TOP_Y + 0.001;
    matGroup.add(centerLine);

    matGroup.visible = false;
    this.propsGroup.add(matGroup);
    this.propMat = matGroup;

    // 2. Parede frontal (Flexão na parede: face interna exata em Z = 0.675)
    const wallGroup = new THREE.Group();
    const wallPanel = new THREE.Mesh(
      new THREE.BoxGeometry(1.95, 2.3, 0.09),
      new THREE.MeshStandardMaterial({
        color: '#2b3a52',
        roughness: 0.55,
        metalness: 0.15,
        transparent: true,
        opacity: 0.85,
        envMapIntensity: 0.38
      })
    );
    wallPanel.position.set(0, 1.152, 0.72);
    wallPanel.receiveShadow = true;
    wallPanel.castShadow = true;
    wallGroup.add(wallPanel);

    const wallLed = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.024, 0.105), new THREE.MeshBasicMaterial({ color: '#38bdf8' }));
    wallLed.position.set(0, 1.95, 0.72);
    wallGroup.add(wallLed);

    const wallBase = new THREE.Mesh(
      new THREE.BoxGeometry(1.98, 0.09, 0.12),
      new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.6 })
    );
    wallBase.position.set(0, 0.047, 0.72);
    wallGroup.add(wallBase);

    wallGroup.visible = false;
    this.propsGroup.add(wallGroup);
    this.propWall = wallGroup;

    // 2b. Pilar lateral (Alongamento Peitoral: posicionado dinamicamente para encostar na palma)
    const postGroup = new THREE.Group();
    const postMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 2.28, 0.26),
      new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.55, metalness: 0.2, envMapIntensity: 0.4 })
    );
    postMesh.position.set(0, 1.142, 0);
    postMesh.castShadow = true;
    postMesh.receiveShadow = true;
    postGroup.add(postMesh);

    const postAccent = new THREE.Mesh(new THREE.BoxGeometry(0.136, 2.1, 0.02), new THREE.MeshBasicMaterial({ color: '#10b981' }));
    postAccent.position.set(0, 1.1, 0);
    postGroup.add(postAccent);

    postGroup.visible = false;
    this.propsGroup.add(postGroup);
    this.propPost = postGroup;

    // 3. Cadeira ergonômica (posicionada exatamente sob o quadril no Agachamento com cadeira)
    const chairGroup = new THREE.Group();
    const chairFrameMat = new THREE.MeshStandardMaterial({ color: '#64748b', roughness: 0.35, metalness: 0.7, envMapIntensity: 0.8 });
    const chairPadMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.58, metalness: 0.1, envMapIntensity: 0.3 });

    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.055, 0.42), chairPadMat);
    seat.position.set(0, 0.43, -0.25);
    seat.castShadow = true;
    seat.receiveShadow = true;
    chairGroup.add(seat);

    const seatRim = new THREE.Mesh(new THREE.BoxGeometry(0.47, 0.014, 0.43), chairFrameMat);
    seatRim.position.set(0, 0.405, -0.25);
    chairGroup.add(seatRim);

    const backrest = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.40, 0.045), chairPadMat);
    backrest.position.set(0, 0.68, -0.45);
    backrest.rotation.x = -0.08;
    backrest.castShadow = true;
    chairGroup.add(backrest);

    const legPositions = [
      [-0.2, 0.21, -0.07],
      [0.2, 0.21, -0.07],
      [-0.2, 0.21, -0.43],
      [0.2, 0.21, -0.43]
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

    // 3b. Banco de academia para apoio do pé (Posterior da coxa)
    const benchGroup = new THREE.Group();
    const benchPadMat = new THREE.MeshStandardMaterial({ color: '#3b1d36', roughness: 0.62, metalness: 0.08, envMapIntensity: 0.3 });
    const benchPad = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.06, 0.72), benchPadMat);
    benchPad.position.set(0, BENCH_TOP_Y - 0.03, 0.86);
    benchPad.castShadow = true;
    benchPad.receiveShadow = true;
    benchGroup.add(benchPad);

    const benchRail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.62), chairFrameMat);
    benchRail.position.set(0, BENCH_TOP_Y - 0.08, 0.86);
    benchGroup.add(benchRail);

    for (const bz of [0.58, 1.14]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.07, BENCH_TOP_Y - 0.08, 0.07), chairFrameMat);
      post.position.set(0, (BENCH_TOP_Y - 0.08) / 2 + 0.002, bz);
      post.castShadow = true;
      benchGroup.add(post);

      const footBar = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.035, 0.06), chairFrameMat);
      footBar.position.set(0, 0.02, bz);
      footBar.castShadow = true;
      benchGroup.add(footBar);
    }
    benchGroup.visible = false;
    this.propsGroup.add(benchGroup);
    this.propBench = benchGroup;

    // 4. Esteira elétrica
    const tmGroup = new THREE.Group();
    const tmBodyMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.4, metalness: 0.6, envMapIntensity: 0.7 });
    const tmTrimMat = new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.35, metalness: 0.75, envMapIntensity: 0.8 });
    const tmScreenMat = new THREE.MeshStandardMaterial({ color: '#0f172a', emissive: '#10b981', emissiveIntensity: 0.5, roughness: 0.2 });

    const deckFrame = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.11, 1.68), tmBodyMat);
    deckFrame.position.set(0, 0.08, 0.04);
    deckFrame.castShadow = true;
    deckFrame.receiveShadow = true;
    tmGroup.add(deckFrame);

    const motorHood = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.14, 0.26), tmTrimMat);
    motorHood.position.set(0, 0.135, 0.76);
    motorHood.castShadow = true;
    tmGroup.add(motorHood);

    const beltCanvas = document.createElement('canvas');
    beltCanvas.width = 256;
    beltCanvas.height = 512;
    const bCtx = beltCanvas.getContext('2d');
    bCtx.fillStyle = '#0b1120';
    bCtx.fillRect(0, 0, 256, 512);
    bCtx.fillStyle = '#1e293b';
    for (let y = 0; y < 512; y += 32) bCtx.fillRect(16, y, 224, 5);
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

  async loadTrainerModel() {
    this.onModelStatus('loading');
    try {
      if (MeshoptDecoder?.ready) {
        await MeshoptDecoder.ready;
      }
      const loader = new GLTFLoader();
      loader.setMeshoptDecoder(MeshoptDecoder);
      loader.load(
        './assets/personal_trainer.glb',
        (gltf) => {
          if (this.disposed) return;
          this.setupTrainerRig(gltf.scene);
          this.modelReady = true;
          this.onModelStatus('ready');
        },
        undefined,
        (err) => {
          console.error('Erro ao carregar personal_trainer.glb:', err);
          this.onModelStatus('error', err?.message || 'Falha ao carregar modelo 3D');
        }
      );
    } catch (err) {
      console.error('Erro no MeshoptDecoder/GLTFLoader:', err);
      this.onModelStatus('error', err?.message || 'Falha ao inicializar decodificador 3D');
    }
  }

  setupTrainerRig(modelScene) {
    this.trainerScene = modelScene;
    this.charRoot.add(this.trainerScene);

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy?.() || 4;
    this.trainerScene.traverse((obj) => {
      if (obj.isMesh || obj.isSkinnedMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
        obj.frustumCulled = false;
        if (obj.material) {
          obj.material.roughness = 0.74;
          obj.material.metalness = 0.02;
          obj.material.envMapIntensity = 0.28;
          if (obj.material.map) {
            obj.material.map.anisotropy = Math.min(8, maxAniso);
          }
        }
      }
      if (obj.isBone || BONE_ORDER.includes(obj.name) || /Hand(Thumb|Index|Middle|Ring|Pinky)|ToeEnd/.test(obj.name)) {
        this.bones[obj.name] = obj;
      }
    });

    this.charRoot.updateMatrixWorld(true);

    const leftArmDownQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -1.38, 'XYZ'));
    const rightArmDownQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 1.38, 'XYZ'));

    for (const name of BONE_ORDER) {
      const bone = this.bones[name];
      if (!bone) continue;
      const rw = new THREE.Quaternion();
      bone.getWorldQuaternion(rw);
      this.restWorldQ[name] = rw;

      if (name === 'LeftArm' || name === 'LeftForeArm' || name === 'LeftHand') {
        this.neutralWorldQ[name] = leftArmDownQ.clone().multiply(rw);
      } else if (name === 'RightArm' || name === 'RightForeArm' || name === 'RightHand') {
        this.neutralWorldQ[name] = rightArmDownQ.clone().multiply(rw);
      } else {
        this.neutralWorldQ[name] = rw.clone();
      }
    }

    if (this.bones.Hips) {
      this.hipsRestPos.copy(this.bones.Hips.position);
    }

    this.relaxFingers();

    // Marcadores exatos sobre os ossos reais (com SOLE_Y = 0.000)
    const getWorldPos = (name) => {
      const v = new THREE.Vector3();
      this.bones[name]?.getWorldPosition(v);
      return v;
    };
    const addWorldMarker = (boneName, worldVec) => {
      const m = new THREE.Object3D();
      const b = this.bones[boneName];
      if (!b) return m;
      b.add(m);
      m.position.copy(b.worldToLocal(worldVec.clone()));
      return m;
    };

    const pLFoot = getWorldPos('LeftFoot');
    const pLToe = getWorldPos('LeftToeBase');
    const pLToeEnd = getWorldPos('LeftToeEnd');
    const pRFoot = getWorldPos('RightFoot');
    const pRToe = getWorldPos('RightToeBase');
    const pRToeEnd = getWorldPos('RightToeEnd');
    const pLKnee = getWorldPos('LeftLeg');
    const pRKnee = getWorldPos('RightLeg');
    const pLHand = getWorldPos('LeftHand');
    const pRHand = getWorldPos('RightHand');
    const pLFore = getWorldPos('LeftForeArm');
    const pRFore = getWorldPos('RightForeArm');
    const pHips = getWorldPos('Hips');
    const pSpine2 = getWorldPos('Spine2');
    const pLArm = getWorldPos('LeftArm');
    const pLHip = getWorldPos('LeftUpLeg');

    // Mede comprimentos reais diretamente do esqueleto carregado
    this.seg = {
      thigh: pLHip.distanceTo(pLKnee),
      shin: pLKnee.distanceTo(pLFoot),
      footH: pLFoot.y,
      footZ: pLFoot.z,
      hipsY: pHips.y,
      hipsZ: pHips.z,
      hipsToHipY: pLHip.y - pHips.y,
      hipsToHipZ: pLHip.z - pHips.z,
      hipY: pLHip.y,
      hipZ: pLHip.z,
      hipX: pLHip.x,
      hipsToShY: pLArm.y - pHips.y,
      hipsToShZ: pLArm.z - pHips.z,
      upperArm: pLArm.distanceTo(pLFore),
      forearm: pLFore.distanceTo(pLHand)
    };

    this.markers = {
      heelL: addWorldMarker('LeftFoot', new THREE.Vector3(pLFoot.x, SOLE_Y, pLFoot.z - 0.042)),
      toeL: addWorldMarker('LeftToeBase', new THREE.Vector3(pLToe.x, SOLE_Y, pLToe.z + 0.02)),
      toeTipL: addWorldMarker('LeftToeBase', new THREE.Vector3(pLToeEnd.x, SOLE_Y, pLToeEnd.z + 0.01)),
      heelR: addWorldMarker('RightFoot', new THREE.Vector3(pRFoot.x, SOLE_Y, pRFoot.z - 0.042)),
      toeR: addWorldMarker('RightToeBase', new THREE.Vector3(pRToe.x, SOLE_Y, pRToe.z + 0.02)),
      toeTipR: addWorldMarker('RightToeBase', new THREE.Vector3(pRToeEnd.x, SOLE_Y, pRToeEnd.z + 0.01)),
      kneeL: addWorldMarker('LeftLeg', new THREE.Vector3(pLKnee.x, pLKnee.y - 0.015, pLKnee.z + 0.048)),
      kneeR: addWorldMarker('RightLeg', new THREE.Vector3(pRKnee.x, pRKnee.y - 0.015, pRKnee.z + 0.048)),
      handL: addWorldMarker('LeftHand', new THREE.Vector3(pLHand.x + 0.08, pLHand.y, pLHand.z)),
      palmL: addWorldMarker('LeftHand', new THREE.Vector3(pLHand.x + 0.04, pLHand.y - 0.018, pLHand.z)),
      handR: addWorldMarker('RightHand', new THREE.Vector3(pRHand.x - 0.08, pRHand.y, pRHand.z)),
      palmR: addWorldMarker('RightHand', new THREE.Vector3(pRHand.x - 0.04, pRHand.y - 0.018, pRHand.z)),
      // Marcadores de cotovelo ligados ao braço superior (para não girar quando o antebraço dobra)
      elbowBotL: addWorldMarker('LeftArm', new THREE.Vector3(pLFore.x, pLFore.y, pLFore.z - 0.032)),
      elbowBotR: addWorldMarker('RightArm', new THREE.Vector3(pRFore.x, pRFore.y, pRFore.z - 0.032)),
      sideElbowL: addWorldMarker('LeftArm', new THREE.Vector3(pLFore.x + 0.032, pLFore.y, pLFore.z)),
      sideElbowR: addWorldMarker('RightArm', new THREE.Vector3(pRFore.x - 0.032, pRFore.y, pRFore.z)),
      backPelvis: addWorldMarker('Hips', new THREE.Vector3(0, pHips.y, pHips.z - 0.105)),
      backChest: addWorldMarker('Spine2', new THREE.Vector3(0, pSpine2.y + 0.06, pSpine2.z - 0.115)),
      sideAnkleL: addWorldMarker('LeftFoot', new THREE.Vector3(pLFoot.x + 0.045, SOLE_Y + 0.028, pLFoot.z + 0.02)),
      sideAnkleR: addWorldMarker('RightFoot', new THREE.Vector3(pRFoot.x - 0.045, SOLE_Y + 0.028, pRFoot.z + 0.02))
    };

    this.buildMuscleFocusHalos();
  }

  relaxFingers() {
    const curlBone = (boneName, rx, ry, rz) => {
      const b = this.bones[boneName];
      if (!b || !b.parent) return;
      this.charRoot.updateMatrixWorld(true);
      const rw = new THREE.Quaternion();
      const pw = new THREE.Quaternion();
      b.getWorldQuaternion(rw);
      b.parent.getWorldQuaternion(pw);
      const qDelta = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'XYZ'));
      const targetW = qDelta.multiply(rw);
      b.quaternion.copy(pw.invert().multiply(targetW));
    };

    const curlSide = (prefix, sign) => {
      const fingers = ['Index', 'Middle', 'Ring', 'Pinky'];
      for (const f of fingers) {
        curlBone(`${prefix}${f}1`, 0, 0, sign * 0.28);
        curlBone(`${prefix}${f}2`, 0, 0, sign * 0.36);
        curlBone(`${prefix}${f}3`, 0, 0, sign * 0.25);
      }
      curlBone(`${prefix}Thumb1`, 0.12, sign * -0.2, sign * 0.15);
      curlBone(`${prefix}Thumb2`, 0, sign * -0.15, sign * 0.2);
    };
    curlSide('LeftHand', -1);
    curlSide('RightHand', 1);
  }

  buildMuscleFocusHalos() {
    const makeHalo = (boneName, radius, offsetLocal, rotX = Math.PI / 2) => {
      const b = this.bones[boneName];
      if (!b) return null;
      const mat = new THREE.MeshBasicMaterial({
        color: '#10b981',
        transparent: true,
        opacity: 0.0,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.26, 10, 32), mat);
      mesh.rotation.x = rotX;
      mesh.position.set(...offsetLocal);
      b.add(mesh);
      return mesh;
    };

    this.muscleRings = {
      core: [makeHalo('Spine1', 15.5, [0, 4, 0])],
      chest: [makeHalo('Spine2', 17.5, [0, 15, 2])],
      back: [makeHalo('Spine2', 17.0, [0, 12, -2])],
      glutes: [makeHalo('Hips', 18.0, [0, 2, -2])],
      hips: [makeHalo('Hips', 17.5, [0, 6, 0])],
      shoulders: [makeHalo('LeftArm', 7.5, [0, 3, 0]), makeHalo('RightArm', 7.5, [0, 3, 0])],
      arms: [makeHalo('LeftArm', 6.5, [0, 14, 0]), makeHalo('RightArm', 6.5, [0, 14, 0])],
      quads: [makeHalo('LeftUpLeg', 9.8, [0, 16, 1]), makeHalo('RightUpLeg', 9.8, [0, 16, 1])],
      hamstrings: [makeHalo('LeftUpLeg', 9.5, [0, 20, -1]), makeHalo('RightUpLeg', 9.5, [0, 20, -1])],
      calves: [makeHalo('LeftLeg', 7.2, [0, 16, 0]), makeHalo('RightLeg', 7.2, [0, 16, 0])]
    };
  }

  updateMuscleHighlights(nowSec) {
    const pulse = 0.16 + 0.12 * Math.sin(nowSec * 3.8);
    for (const [group, rings] of Object.entries(this.muscleRings)) {
      const active = this.highlightMuscles && this.activeMuscles.includes(group);
      for (const mesh of rings) {
        if (!mesh) continue;
        mesh.visible = active;
        if (active) mesh.material.opacity = pulse;
      }
    }
  }

  setExercise({ anim, prop, defaultCamera, muscles = [], speedKmh = 4.5, incline = 0 }) {
    const changedAnim = this.animId !== anim;
    if (changedAnim && this.modelReady) {
      for (const b of BONE_ORDER) {
        if (this.bones[b]) {
          this.prevBoneLocalQ[b] = this.bones[b].quaternion.clone();
        }
      }
      this.prevHipsOffset.copy(this.currentHipsOffset);
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
    this.propBench.visible = prop === 'bench';
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
    if (next !== this.activeSide && this.modelReady) {
      for (const b of BONE_ORDER) {
        if (this.bones[b]) this.prevBoneLocalQ[b] = this.bones[b].quaternion.clone();
      }
      this.prevHipsOffset.copy(this.currentHipsOffset);
      this.blendAlpha = 0;
    }
    this.activeSide = next;
  }

  setPlaying(playing) {
    this.playing = Boolean(playing);
  }

  setAutoRotate(enabled) {
    this.autoRotate = Boolean(enabled);
    if (this.controls) this.controls.autoRotate = this.autoRotate;
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

  emitPhaseCue(text) {
    if (text !== this.lastPhaseText) {
      this.lastPhaseText = text;
      this.onPhaseChange(text);
    }
  }

  snapToSupport(supportY, markersList) {
    this.charRoot.updateMatrixWorld(true);
    let minY = Infinity;
    for (const obj of markersList) {
      if (!obj) continue;
      obj.getWorldPosition(this._vTmp);
      if (this._vTmp.y < minY) minY = this._vTmp.y;
    }
    if (Number.isFinite(minY)) {
      this.charRoot.position.y += (supportY - minY);
    }
  }

  applyPose(t, dt) {
    if (!this.modelReady) return;

    const pose = {};
    for (const b of BONE_ORDER) pose[b] = [0, 0, 0];

    this.charRoot.position.set(0, 0, 0);
    this.currentHipsOffset.set(0, 0, 0);

    const isLeft = this.activeSide === 'left';
    const sgn = isLeft ? 1 : -1;

    const smooth01 = (freq = 1.0, phase = 0) => {
      const r = 0.5 - 0.5 * Math.cos(t * freq + phase);
      return r * r * (3 - 2 * r);
    };
    const wave11 = (freq = 1.0, phase = 0) => Math.sin(t * freq + phase);
    const breath = Math.sin(t * 2.1);

    const setSpineCurve = (rx, ry = 0, rz = 0, headCounterX = 0) => {
      pose.Spine = [rx * 0.30, ry * 0.30, rz * 0.30];
      pose.Spine1 = [rx * 0.35, ry * 0.35, rz * 0.35];
      pose.Spine2 = [rx * 0.35 + breath * 0.012, ry * 0.35, rz * 0.35];
      pose.Neck = [headCounterX * 0.5, -ry * 0.35, 0];
      pose.Head = [headCounterX * 0.5, -ry * 0.25, 0];
    };

    let useSnap = true;
    let supportY = 0;
    let supportMarkers = [this.markers.heelL, this.markers.heelR, this.markers.toeL, this.markers.toeR, this.markers.toeTipL, this.markers.toeTipR];

    switch (this.animId) {
      case 'ankle_rotation': {
        const up = isLeft ? 'LeftUpLeg' : 'RightUpLeg';
        const knee = isLeft ? 'LeftLeg' : 'RightLeg';
        const foot = isLeft ? 'LeftFoot' : 'RightFoot';
        supportMarkers = isLeft ? [this.markers.heelR, this.markers.toeR, this.markers.toeTipR] : [this.markers.heelL, this.markers.toeL, this.markers.toeTipL];

        pose[up] = [-0.82, 0, 0];
        pose[knee] = [0.68, 0, 0];
        pose[foot] = [0.16 + 0.22 * Math.sin(t * 3.4), 0.34 * Math.cos(t * 3.4), 0.16 * Math.sin(t * 3.4)];
        pose.LeftArm = [0, 0, 0.14];
        pose.RightArm = [0, 0, -0.14];
        pose.LeftForeArm = [-0.18, 0, 0];
        pose.RightForeArm = [-0.18, 0, 0];
        setSpineCurve(0.03, 0, 0, -0.03);
        this.emitPhaseCue(isLeft ? 'Gire o tornozelo esquerdo' : 'Gire o tornozelo direito');
        break;
      }

      case 'hip_rotation': {
        // Pés 100% imóveis e planos no chão via IK analítica; apenas o quadril gira em círculo
        const ang = t * 2.2;
        const hx = 0.065 * Math.cos(ang);
        const hz = 0.055 * Math.sin(ang);
        const hy = -0.015;
        this.currentHipsOffset.set(hx, hy, hz);

        const hipJointZ = this.seg.hipZ + hz;
        const hipJointY = this.seg.hipY + hy;
        const dz = this.seg.footZ - hipJointZ;
        const dy = this.seg.footH - hipJointY;
        const ik = solveLeg2BoneIK(dz, dy, this.seg, 0);

        const latTilt = -Math.atan2(hx, this.seg.thigh + this.seg.shin);
        pose.LeftUpLeg = [ik.hipRx, 0, latTilt];
        pose.RightUpLeg = [ik.hipRx, 0, latTilt];
        pose.LeftLeg = [ik.kneeRx, 0, 0];
        pose.RightLeg = [ik.kneeRx, 0, 0];
        pose.LeftFoot = [ik.footRx, 0, -latTilt];
        pose.RightFoot = [ik.footRx, 0, -latTilt];

        setSpineCurve(-0.05 * Math.sin(ang), 0, 0.06 * Math.cos(ang));
        pose.LeftArm = [0, 0, 0.42];
        pose.LeftForeArm = [-0.35, 0, -0.75];
        pose.RightArm = [0, 0, -0.42];
        pose.RightForeArm = [-0.35, 0, 0.75];
        this.emitPhaseCue('Círculos com o quadril • Pés firmes no chão');
        break;
      }

      case 'leg_swing': {
        const swing = 0.66 * wave11(2.5);
        const up = isLeft ? 'LeftUpLeg' : 'RightUpLeg';
        const knee = isLeft ? 'LeftLeg' : 'RightLeg';
        supportMarkers = isLeft ? [this.markers.heelR, this.markers.toeR, this.markers.toeTipR] : [this.markers.heelL, this.markers.toeL, this.markers.toeTipL];
        pose[up] = [swing, 0, 0];
        pose[knee] = [0.10 + Math.max(0, swing) * 0.15, 0, 0];
        pose.LeftArm = [-swing * 0.35, 0, 0.22];
        pose.RightArm = [swing * 0.35, 0, -0.22];
        pose.LeftForeArm = [-0.25, 0, 0];
        pose.RightForeArm = [-0.25, 0, 0];
        setSpineCurve(0.04, 0, 0, -0.04);
        this.emitPhaseCue(swing < 0 ? 'Balanço controlado à frente' : 'Balanço controlado atrás');
        break;
      }

      case 'arm_circles': {
        const ang = t * 2.8;
        pose.LeftShoulder = [0, 0, 0.12];
        pose.RightShoulder = [0, 0, -0.12];
        pose.LeftArm = [0, -0.32 * Math.cos(ang), Math.PI / 2 - 0.06 + 0.30 * Math.sin(ang)];
        pose.RightArm = [0, 0.32 * Math.cos(ang), -(Math.PI / 2 - 0.06 + 0.30 * Math.sin(ang))];
        pose.LeftForeArm = [-0.1, 0, 0];
        pose.RightForeArm = [-0.1, 0, 0];
        pose.LeftUpLeg = [0, 0, 0.06];
        pose.RightUpLeg = [0, 0, -0.06];
        setSpineCurve(0, 0, 0, 0);
        this.emitPhaseCue('Ombros relaxados • Rotações circulares amplas');
        break;
      }

      case 'high_knees': {
        const phase = t * 4.2;
        const liftL = Math.pow(Math.max(0, Math.sin(phase)), 0.85);
        const liftR = Math.pow(Math.max(0, -Math.sin(phase)), 0.85);
        pose.Hips = [0, 0.06 * Math.sin(phase), 0];
        pose.LeftUpLeg = [-1.42 * liftL + 0.08 * liftR, 0, 0];
        pose.LeftLeg = [1.55 * liftL + 0.06, 0, 0];
        pose.RightUpLeg = [-1.42 * liftR + 0.08 * liftL, 0, 0];
        pose.RightLeg = [1.55 * liftR + 0.06, 0, 0];
        pose.LeftForeArm = [-1.25, 0, 0];
        pose.RightForeArm = [-1.25, 0, 0];
        pose.LeftArm = [-0.75 * liftR + 0.28 * liftL, 0, 0.08];
        pose.RightArm = [-0.75 * liftL + 0.28 * liftR, 0, -0.08];
        setSpineCurve(0.06, -0.08 * Math.sin(phase), 0, -0.06);
        supportMarkers = [this.markers.heelL, this.markers.toeL, this.markers.heelR, this.markers.toeR];
        this.emitPhaseCue('Eleve os joelhos na linha do quadril');
        break;
      }

      case 'treadmill': {
        // Caminhada suave contínua sem pulinhos artificiais
        const kmh = this.treadmillSpeedKmh || 4.5;
        const isJog = kmh >= 5.3;
        const freq = isJog ? 6.2 : 3.0 + (kmh - 3.0) * 0.8;
        const stride = isJog ? 0.56 : 0.30 + (kmh - 3.0) * 0.07;
        const p = t * freq;

        const swingL = Math.sin(p) * stride;
        const swingR = Math.sin(p + Math.PI) * stride;
        const kneeL = Math.max(0, -Math.cos(p)) * (isJog ? 1.05 : 0.42);
        const kneeR = Math.max(0, -Math.cos(p + Math.PI)) * (isJog ? 1.05 : 0.42);

        pose.Hips = [0, 0.05 * Math.sin(p), 0];
        pose.LeftUpLeg = [swingL, 0, 0];
        pose.LeftLeg = [0.10 + kneeL, 0, 0];
        pose.LeftFoot = [-swingL * 0.35 - kneeL * 0.25, 0, 0];
        pose.RightUpLeg = [swingR, 0, 0];
        pose.RightLeg = [0.10 + kneeR, 0, 0];
        pose.RightFoot = [-swingR * 0.35 - kneeR * 0.25, 0, 0];

        setSpineCurve(isJog ? 0.12 : 0.05, -0.08 * Math.sin(p), 0, isJog ? -0.08 : -0.03);
        pose.LeftForeArm = [isJog ? -1.40 : -0.88, 0, 0];
        pose.RightForeArm = [isJog ? -1.40 : -0.88, 0, 0];
        pose.LeftArm = [-swingL * 0.9, 0, 0.08];
        pose.RightArm = [-swingR * 0.9, 0, -0.08];

        this.charRoot.position.z = -0.06;
        // Zero pulinhos na caminhada; contato contínuo na lona da esteira
        supportY = TREADMILL_BELT_Y;
        supportMarkers = [this.markers.toeL, this.markers.heelL, this.markers.toeR, this.markers.heelR];
        this.emitPhaseCue(`${isJog ? 'Trote' : 'Caminhada'} • ${String(kmh).replace('.', ',')} km/h`);
        break;
      }

      case 'squat':
      case 'chair_squat': {
        const d = smooth01(2.0);
        const isChair = this.animId === 'chair_squat';
        const shiftZ = -(isChair ? 0.26 : 0.22) * d;
        const shiftY = -(isChair ? 0.36 : 0.34) * d;
        const hz = this.seg.hipZ + shiftZ;
        const hy = this.seg.hipY + shiftY;
        this.currentHipsOffset.set(0, shiftY, shiftZ);

        const ik = solveLeg2BoneIK(this.seg.footZ - hz, this.seg.footH - hy, this.seg, 0);
        pose.LeftUpLeg = [ik.hipRx, 0.10 * d, 0.08];
        pose.RightUpLeg = [ik.hipRx, -0.10 * d, -0.08];
        pose.LeftLeg = [ik.kneeRx, 0, 0];
        pose.RightLeg = [ik.kneeRx, 0, 0];
        pose.LeftFoot = [ik.footRx, 0, 0];
        pose.RightFoot = [ik.footRx, 0, 0];

        setSpineCurve(0.30 * d, 0, 0, -0.26 * d);
        pose.LeftArm = [-1.25 * d - 0.15, 0, 0.08];
        pose.RightArm = [-1.25 * d - 0.15, 0, -0.08];
        pose.LeftForeArm = [-0.30 + 0.15 * d, 0, 0];
        pose.RightForeArm = [-0.30 + 0.15 * d, 0, 0];
        this.emitPhaseCue(isChair ? (d > 0.6 ? 'Toque o assento da cadeira suavemente' : 'Suba empurrando pelos calcanhares') : (d > 0.55 ? 'Desça levando o quadril para trás' : 'Empurre o chão para subir'));
        break;
      }

      case 'wall_pushup': {
        const press = smooth01(2.2);
        const lean = 0.22 + 0.20 * press;
        const fixedAnkleZ = -0.06;

        const restAnkDz = this.seg.footZ - this.seg.hipsZ;
        const restAnkDy = this.seg.footH - this.seg.hipsY;
        const rotAnkDz = restAnkDy * Math.sin(lean) + restAnkDz * Math.cos(lean);
        const rotAnkDy = restAnkDy * Math.cos(lean) - restAnkDz * Math.sin(lean);

        const hipsWorldZ = fixedAnkleZ - rotAnkDz;
        const hipsWorldY = this.seg.footH - rotAnkDy;
        this.charRoot.position.z = hipsWorldZ - this.hipsRestPos.z;
        this.charRoot.position.y = hipsWorldY - this.hipsRestPos.y;
        useSnap = false;

        pose.Hips = [lean, 0, 0];
        pose.LeftFoot = [-lean, 0, 0];
        pose.RightFoot = [-lean, 0, 0];
        pose.LeftUpLeg = [0, 0, 0.05];
        pose.RightUpLeg = [0, 0, -0.05];
        setSpineCurve(0.02, 0, 0, -0.16);

        const shZ = hipsWorldZ + this.seg.hipsToShY * Math.sin(lean) + this.seg.hipsToShZ * Math.cos(lean);
        const shY = hipsWorldY + this.seg.hipsToShY * Math.cos(lean) - this.seg.hipsToShZ * Math.sin(lean);
        const armIK = solveArm2BoneIK(0.645 - shZ, 1.28 - shY, this.seg, lean + 0.02);

        pose.LeftShoulder = [0, 0.16 * press, 0];
        pose.RightShoulder = [0, -0.16 * press, 0];
        pose.LeftArm = [armIK.armRx, 0, 0.14 * press + 0.06];
        pose.RightArm = [armIK.armRx, 0, -0.14 * press - 0.06];
        pose.LeftForeArm = [armIK.foreRx, -1.1, 0];
        pose.RightForeArm = [armIK.foreRx, 1.1, 0];
        pose.LeftHand = [-0.65, 0, 0];
        pose.RightHand = [-0.65, 0, 0];
        this.emitPhaseCue(press > 0.55 ? 'Aproxime o peito da parede • Pés fixos' : 'Empurre a parede de volta');
        break;
      }

      case 'glute_bridge': {
        const lift = smooth01(2.0);
        const beta = 0.40 * lift;
        const hipsPitch = -Math.PI / 2 - beta;

        const shZ = -0.35;
        const shY = MAT_TOP_Y + 0.095;
        const hipsZ = shZ + this.seg.hipsToShY * Math.cos(beta);
        const hipsY = shY + this.seg.hipsToShY * Math.sin(beta);

        const hjY = hipsY + this.seg.hipsToHipY * Math.cos(hipsPitch) - this.seg.hipsToHipZ * Math.sin(hipsPitch);
        const hjZ = hipsZ + this.seg.hipsToHipY * Math.sin(hipsPitch) + this.seg.hipsToHipZ * Math.cos(hipsPitch);

        const fixedAnkZ = 0.46;
        const fixedAnkY = MAT_TOP_Y + this.seg.footH;
        const dz = fixedAnkZ - hjZ;
        const dy = fixedAnkY - hjY;
        const dist = Math.hypot(dz, dy);
        const cosK = Math.max(-1, Math.min(1, (this.seg.thigh ** 2 + this.seg.shin ** 2 - dist ** 2) / (2 * this.seg.thigh * this.seg.shin)));
        const kneeBend = Math.PI - Math.acos(cosK);
        const alphaTarget = Math.atan2(dy, dz);
        const cosA = Math.max(-1, Math.min(1, (this.seg.thigh ** 2 + dist ** 2 - this.seg.shin ** 2) / (2 * this.seg.thigh * dist)));
        const a = Math.acos(cosA);
        const thighWorldFromPlusZ = alphaTarget + a;

        const uplegRx = beta - thighWorldFromPlusZ;
        const footRx = (Math.PI / 2 + beta) - uplegRx - kneeBend;

        this.charRoot.position.z = hipsZ - this.hipsRestPos.z;
        this.charRoot.position.y = hipsY - this.hipsRestPos.y;
        useSnap = false;

        pose.Hips = [hipsPitch, 0, 0];
        pose.Spine = [0, 0, 0];
        pose.Spine1 = [0, 0, 0];
        pose.Spine2 = [0, 0, 0];
        pose.Neck = [beta * 0.4, 0, 0];
        pose.Head = [beta * 0.3, 0, 0];
        pose.LeftUpLeg = [uplegRx, 0, 0.05];
        pose.RightUpLeg = [uplegRx, 0, -0.05];
        pose.LeftLeg = [kneeBend, 0, 0];
        pose.RightLeg = [kneeBend, 0, 0];
        pose.LeftFoot = [footRx, 0, 0];
        pose.RightFoot = [footRx, 0, 0];
        pose.LeftArm = [0.08, 0, 0.22];
        pose.RightArm = [0.08, 0, -0.22];
        this.emitPhaseCue(lift > 0.6 ? 'Eleve só o quadril e contraia glúteos' : 'Desça o quadril devagar • Pés firmes');
        break;
      }

      case 'bird_dog': {
        const cycle = (t * 0.8) % 2;
        const activeLeftArm = cycle < 1;
        const p = cycle % 1;
        const ext = Math.sin(Math.pow(Math.sin(p * Math.PI), 0.7) * (Math.PI / 2));

        pose.Hips = [Math.PI / 2, 0, 0];
        setSpineCurve(0.02 * breath, 0, 0, -0.52);
        pose.LeftArm = [-Math.PI / 2, 0, 0];
        pose.RightArm = [-Math.PI / 2, 0, 0];
        pose.LeftForeArm = [0, -1.15, 0];
        pose.RightForeArm = [0, 1.15, 0];
        pose.LeftUpLeg = [-Math.PI / 2, 0, 0];
        pose.RightUpLeg = [-Math.PI / 2, 0, 0];
        pose.LeftLeg = [Math.PI / 2, 0, 0];
        pose.RightLeg = [Math.PI / 2, 0, 0];

        if (activeLeftArm) {
          pose.LeftArm = [-Math.PI / 2 - (Math.PI / 2) * ext, 0, 0];
          pose.RightUpLeg = [-Math.PI / 2 + (Math.PI / 2) * ext, 0, 0];
          pose.RightLeg = [(Math.PI / 2) * (1 - ext), 0, 0];
          supportMarkers = [this.markers.handR, this.markers.palmR, this.markers.kneeL];
          this.emitPhaseCue('Braço esquerdo + perna direita estendidos');
        } else {
          pose.RightArm = [-Math.PI / 2 - (Math.PI / 2) * ext, 0, 0];
          pose.LeftUpLeg = [-Math.PI / 2 + (Math.PI / 2) * ext, 0, 0];
          pose.LeftLeg = [(Math.PI / 2) * (1 - ext), 0, 0];
          supportMarkers = [this.markers.handL, this.markers.palmL, this.markers.kneeR];
          this.emitPhaseCue('Braço direito + perna esquerda estendidos');
        }
        supportY = MAT_TOP_Y;
        break;
      }

      case 'dead_bug': {
        const cycle = (t * 0.85) % 2;
        const leftArmDrops = cycle < 1;
        const p = cycle % 1;
        const ext = Math.sin(Math.pow(Math.sin(p * Math.PI), 0.7) * (Math.PI / 2));

        pose.Hips = [-Math.PI / 2, 0, 0];
        setSpineCurve(0.05, 0, 0, 0.12);
        pose.LeftArm = [-Math.PI / 2, 0, 0];
        pose.RightArm = [-Math.PI / 2, 0, 0];
        pose.LeftUpLeg = [-Math.PI / 2, 0, 0];
        pose.RightUpLeg = [-Math.PI / 2, 0, 0];
        pose.LeftLeg = [Math.PI / 2, 0, 0];
        pose.RightLeg = [Math.PI / 2, 0, 0];

        if (leftArmDrops) {
          pose.LeftArm = [-Math.PI / 2 - 1.32 * ext, 0, 0];
          pose.RightUpLeg = [-Math.PI / 2 + 1.28 * ext, 0, 0];
          pose.RightLeg = [(Math.PI / 2) * (1 - 0.86 * ext), 0, 0];
        } else {
          pose.RightArm = [-Math.PI / 2 - 1.32 * ext, 0, 0];
          pose.LeftUpLeg = [-Math.PI / 2 + 1.28 * ext, 0, 0];
          pose.LeftLeg = [(Math.PI / 2) * (1 - 0.86 * ext), 0, 0];
        }
        this.charRoot.position.z = -0.1;
        supportY = MAT_TOP_Y;
        supportMarkers = [this.markers.backPelvis, this.markers.backChest];
        this.emitPhaseCue('Lombar colada no tapete • Movimento alternado');
        break;
      }

      case 'knee_plank': {
        // Cotovelos/antebraços no chão E joelhos apoiados no tapete simultaneamente (alpha=11°)
        const alpha = 0.192;
        pose.Hips = [Math.PI / 2 - alpha + breath * 0.008, 0, 0];
        setSpineCurve(0, 0, 0, -0.34);

        // Braços verticais dos ombros aos cotovelos; antebraços apoiados à frente no tapete
        pose.LeftArm = [-(Math.PI / 2 - alpha), 0, -0.08];
        pose.RightArm = [-(Math.PI / 2 - alpha), 0, 0.08];
        pose.LeftForeArm = [-Math.PI / 2, -0.45, 0];
        pose.RightForeArm = [-Math.PI / 2, 0.45, 0];

        // Coxas em +0.086 rad para ambos os joelhos tocarem o tapete junto com os cotovelos
        pose.LeftUpLeg = [0.086, 0, 0.04];
        pose.RightUpLeg = [0.086, 0, -0.04];
        pose.LeftLeg = [1.32, 0, 0];
        pose.RightLeg = [1.32, 0, 0];

        supportY = MAT_TOP_Y;
        supportMarkers = [this.markers.elbowBotL, this.markers.elbowBotR, this.markers.kneeL, this.markers.kneeR];
        this.emitPhaseCue('Cotovelos e joelhos apoiados no tapete');
        break;
      }

      case 'crunch': {
        const up = smooth01(2.2);
        pose.Hips = [-Math.PI / 2, 0, 0];
        pose.LeftUpLeg = [-0.95, 0, 0.06];
        pose.RightUpLeg = [-0.95, 0, -0.06];
        pose.LeftLeg = [1.85, 0, 0];
        pose.RightLeg = [1.85, 0, 0];
        pose.LeftFoot = [0.42, 0, 0];
        pose.RightFoot = [0.42, 0, 0];

        setSpineCurve(0.54 * up, 0, 0, 0.16 * up);
        pose.LeftArm = [-2.2, 0, 0.62];
        pose.LeftForeArm = [-1.72, 0, 0];
        pose.RightArm = [-2.2, 0, -0.62];
        pose.RightForeArm = [-1.72, 0, 0];

        this.charRoot.position.z = -0.18;
        supportY = MAT_TOP_Y;
        supportMarkers = [this.markers.backPelvis, this.markers.heelL, this.markers.heelR];
        this.emitPhaseCue(up > 0.5 ? 'Solte o ar subindo os ombros' : 'Retorne com controle');
        break;
      }

      case 'side_plank': {
        // Ângulo exato (0.258 rad = 14.8°) onde cotovelo de apoio e pé de baixo encostam juntos no tapete
        const tilt = 0.258;
        if (!isLeft) {
          pose.Hips = [0, 0, Math.PI / 2 - tilt + breath * 0.008];
          setSpineCurve(0, 0, -0.02, 0);
          pose.RightArm = [0, 0, -(Math.PI / 2 - tilt)];
          pose.RightForeArm = [-Math.PI / 2, 0, 0];
          pose.LeftArm = [0, 0, 0.24];
          pose.LeftForeArm = [-0.65, 0, 0];
          supportMarkers = [this.markers.sideElbowR, this.markers.sideAnkleR];
          this.emitPhaseCue('Prancha lateral direita • Pé e cotovelo no tapete');
        } else {
          pose.Hips = [0, 0, -(Math.PI / 2 - tilt + breath * 0.008)];
          setSpineCurve(0, 0, 0.02, 0);
          pose.LeftArm = [0, 0, Math.PI / 2 - tilt];
          pose.LeftForeArm = [-Math.PI / 2, 0, 0];
          pose.RightArm = [0, 0, -0.24];
          pose.RightForeArm = [-0.65, 0, 0];
          supportMarkers = [this.markers.sideElbowL, this.markers.sideAnkleL];
          this.emitPhaseCue('Prancha lateral esquerda • Pé e cotovelo no tapete');
        }
        supportY = MAT_TOP_Y;
        break;
      }

      case 'lateral_leg_raise': {
        const lift = smooth01(2.2);
        const up = isLeft ? 'LeftUpLeg' : 'RightUpLeg';
        supportMarkers = isLeft ? [this.markers.heelR, this.markers.toeR, this.markers.toeTipR] : [this.markers.heelL, this.markers.toeL, this.markers.toeTipL];
        pose[up] = [0, 0, sgn * (0.06 + 0.66 * lift)];
        pose.LeftArm = [0, 0, 0.48];
        pose.RightArm = [0, 0, -0.48];
        pose.LeftForeArm = [-0.2, 0, 0];
        pose.RightForeArm = [-0.2, 0, 0];
        setSpineCurve(0.02, 0, -sgn * 0.04 * lift, 0);
        this.emitPhaseCue(isLeft ? 'Eleve a perna esquerda lateralmente' : 'Eleve a perna direita lateralmente');
        break;
      }

      case 'calf_raise': {
        // Os DOIS pés sobem juntos até a ponta do pé (dedos ficam no chão com flexão de ToeBase!)
        const rise = smooth01(2.3);
        const ang = 0.46 * rise;
        pose.LeftFoot = [ang, 0, 0];
        pose.RightFoot = [ang, 0, 0];
        pose.LeftToeBase = [-ang, 0, 0];
        pose.RightToeBase = [-ang, 0, 0];
        pose.LeftUpLeg = [0, 0, 0.05];
        pose.RightUpLeg = [0, 0, -0.05];
        pose.LeftArm = [0, 0, 0.12];
        pose.RightArm = [0, 0, -0.12];
        setSpineCurve(0, 0, 0, 0);
        supportMarkers = [this.markers.toeL, this.markers.toeR, this.markers.toeTipL, this.markers.toeTipR];
        this.emitPhaseCue(rise > 0.6 ? 'Suba os dois calcanhares na ponta dos pés' : 'Desça os calcanhares até o chão');
        break;
      }

      case 'side_steps': {
        const step = wave11(3.0);
        const wide = Math.abs(step);
        this.charRoot.position.x = step * 0.28;
        pose.LeftUpLeg = [-0.24, 0, 0.28 * wide];
        pose.RightUpLeg = [-0.24, 0, -0.28 * wide];
        pose.LeftLeg = [0.38, 0, 0];
        pose.RightLeg = [0.38, 0, 0];
        pose.LeftArm = [-0.15, 0, 0.22 + 0.22 * wide];
        pose.RightArm = [-0.15, 0, -0.22 - 0.22 * wide];
        pose.LeftForeArm = [-0.95, 0, 0];
        pose.RightForeArm = [-0.95, 0, 0];
        setSpineCurve(0.06, 0, 0, -0.06);
        this.emitPhaseCue('Passos laterais em ritmo fluido');
        break;
      }

      case 'torso_twist': {
        const twist = 0.56 * wave11(2.2);
        setSpineCurve(0.02, twist, 0, 0);
        pose.LeftUpLeg = [0, 0, 0.1];
        pose.RightUpLeg = [0, 0, -0.1];
        pose.LeftArm = [-0.55, 0, 0.22];
        pose.RightArm = [-0.55, 0, -0.22];
        pose.LeftForeArm = [-1.52, 0, 0];
        pose.RightForeArm = [-1.52, 0, 0];
        this.emitPhaseCue('Rotação controlada • Pés firmes');
        break;
      }

      case 'lateral_arm_raise': {
        const raise = smooth01(2.0);
        const armAngle = 0.12 + 1.40 * raise;
        pose.LeftShoulder = [0, 0, 0.14 * raise];
        pose.RightShoulder = [0, 0, -0.14 * raise];
        pose.LeftArm = [0, 0, armAngle];
        pose.RightArm = [0, 0, -armAngle];
        pose.LeftForeArm = [-0.16, 0, 0];
        pose.RightForeArm = [-0.16, 0, 0];
        pose.LeftUpLeg = [0, 0, 0.05];
        pose.RightUpLeg = [0, 0, -0.05];
        setSpineCurve(0, 0, 0, 0);
        this.emitPhaseCue(raise > 0.6 ? 'Alinhe os braços na altura dos ombros' : 'Desça controlando');
        break;
      }

      case 'quad_stretch': {
        // Mão encostada e segurando o tornozelo/pé atrás (compensando os 11° da pose neutra: rz = -sgn * 0.35)
        const pulse = 0.012 * breath;
        const up = isLeft ? 'LeftUpLeg' : 'RightUpLeg';
        const knee = isLeft ? 'LeftLeg' : 'RightLeg';
        const foot = isLeft ? 'LeftFoot' : 'RightFoot';
        const arm = isLeft ? 'LeftArm' : 'RightArm';
        const fore = isLeft ? 'LeftForeArm' : 'RightForeArm';
        const hand = isLeft ? 'LeftHand' : 'RightHand';
        const oppArm = isLeft ? 'RightArm' : 'LeftArm';
        supportMarkers = isLeft ? [this.markers.heelR, this.markers.toeR, this.markers.toeTipR] : [this.markers.heelL, this.markers.toeL, this.markers.toeTipL];

        pose[up] = [0.25 + pulse, 0, 0];
        pose[knee] = [2.55 + pulse, 0, 0];
        pose[foot] = [0.32, 0, 0];
        setSpineCurve(0, 0, 0, 0);
        pose[arm] = [0.45, 0, -sgn * 0.35];
        pose[fore] = [-0.15, 0, 0];
        pose[hand] = [0.25, 0, -sgn * 0.15];
        pose[oppArm] = [0, 0, -sgn * 0.22];
        this.emitPhaseCue(isLeft ? 'Segure o pé esquerdo atrás • Alongue a coxa' : 'Segure o pé direito atrás • Alongue a coxa');
        break;
      }

      case 'hamstring_stretch': {
        // Perna estendida apoiada sobre o banco à frente + mãos na cintura, igual à foto de referência!
        const pulse = 0.03 * breath;
        const fUp = isLeft ? 'LeftUpLeg' : 'RightUpLeg';
        const fKnee = isLeft ? 'LeftLeg' : 'RightLeg';
        const fFoot = isLeft ? 'LeftFoot' : 'RightFoot';
        const bMarker = isLeft ? [this.markers.heelR, this.markers.toeR, this.markers.toeTipR] : [this.markers.heelL, this.markers.toeL, this.markers.toeTipL];

        pose[fUp] = [-1.005, 0, 0];
        pose[fKnee] = [0.04, 0, 0];
        pose[fFoot] = [-0.36, 0, 0]; // Ponta do pé para cima apoiando o calcanhar no banco

        setSpineCurve(0.34 + pulse, 0, 0, -0.22);
        // Mãos na cintura
        pose.LeftArm = [0, 0, 0.42];
        pose.LeftForeArm = [-0.35, 0, -0.75];
        pose.RightArm = [0, 0, -0.42];
        pose.RightForeArm = [-0.35, 0, 0.75];
        supportMarkers = bMarker;
        this.emitPhaseCue('Calcanhar apoiado no banco • Incline mantendo a coluna reta');
        break;
      }

      case 'calf_stretch': {
        // Alongamento de panturrilha: ambos os pés 100% planos no chão, perna de trás estendida
        const pulse = 0.025 * breath;
        const bUp = isLeft ? 'LeftUpLeg' : 'RightUpLeg';
        const bKnee = isLeft ? 'LeftLeg' : 'RightLeg';
        const bFoot = isLeft ? 'LeftFoot' : 'RightFoot';
        const fUp = isLeft ? 'RightUpLeg' : 'LeftUpLeg';
        const fKnee = isLeft ? 'RightLeg' : 'LeftLeg';
        const fFoot = isLeft ? 'RightFoot' : 'LeftFoot';

        pose[fUp] = [-0.62 - pulse, 0, 0];
        pose[fKnee] = [0.85 + pulse, 0, 0];
        pose[fFoot] = [-0.23, 0, 0];

        pose[bUp] = [0.42, 0, 0];
        pose[bKnee] = [0.04, 0, 0];
        pose[bFoot] = [-0.46, 0, 0];

        setSpineCurve(0.10, 0, 0, -0.08);
        pose.LeftArm = [-0.20, 0, 0.12];
        pose.RightArm = [-0.20, 0, -0.12];
        this.emitPhaseCue('Alongamento: calcanhar de trás firme no chão');
        break;
      }

      case 'hip_flexor_stretch': {
        const pulse = 0.03 * breath;
        const bUp = isLeft ? 'LeftUpLeg' : 'RightUpLeg';
        const bKnee = isLeft ? 'LeftLeg' : 'RightLeg';
        const bKneeMarker = isLeft ? this.markers.kneeL : this.markers.kneeR;
        const fUp = isLeft ? 'RightUpLeg' : 'LeftUpLeg';
        const fKnee = isLeft ? 'RightLeg' : 'LeftLeg';
        const fFoot = isLeft ? 'RightFoot' : 'LeftFoot';
        const fHeelMarker = isLeft ? this.markers.heelR : this.markers.heelL;

        pose[fUp] = [-1.62 - pulse, 0, 0];
        pose[fKnee] = [1.62 + pulse, 0, 0];
        pose[fFoot] = [0, 0, 0];
        pose[bUp] = [0.22 + pulse, 0, 0];
        pose[bKnee] = [1.35, 0, 0];

        setSpineCurve(-0.02, 0, 0, 0);
        pose.LeftArm = [0, 0, 0.28];
        pose.RightArm = [0, 0, -0.28];
        pose.LeftForeArm = [-0.45, 0, 0];
        pose.RightForeArm = [-0.45, 0, 0];
        supportY = MAT_TOP_Y;
        supportMarkers = [bKneeMarker, fHeelMarker];
        this.emitPhaseCue('Avance o quadril suavemente • Tronco ereto');
        break;
      }

      case 'chest_stretch': {
        const pulse = 0.03 * breath;
        const arm = isLeft ? 'LeftArm' : 'RightArm';
        const fore = isLeft ? 'LeftForeArm' : 'RightForeArm';
        const hand = isLeft ? 'LeftHand' : 'RightHand';
        const other = isLeft ? 'RightArm' : 'LeftArm';

        // Braço estendido na altura do ombro; pilar acompanha exatamente a palma!
        pose[arm] = [0.18, 0, sgn * 1.48];
        pose[fore] = [0, sgn * -0.4, 0];
        pose[hand] = [0, 0, sgn * 0.9]; // Palma aberta voltada para fora contra o pilar
        pose[other] = [0, 0, -sgn * 0.16];
        pose.LeftUpLeg = [0, 0, 0.07];
        pose.RightUpLeg = [0, 0, -0.07];
        setSpineCurve(0, sgn * (-0.30 - pulse), 0, 0);
        this.emitPhaseCue('Palma apoiada na parede • Abra o peitoral');
        break;
      }

      case 'rest_day':
      default: {
        pose.LeftArm = [0, 0, 0.12 + 0.025 * breath];
        pose.RightArm = [0, 0, -0.12 - 0.025 * breath];
        pose.LeftForeArm = [-0.14, 0, 0];
        pose.RightForeArm = [-0.14, 0, 0];
        pose.LeftUpLeg = [0, 0, 0.05];
        pose.RightUpLeg = [0, 0, -0.05];
        setSpineCurve(0.015 * breath, 0, 0, 0);
        this.emitPhaseCue('Recuperação ativa e hidratação');
        break;
      }
    }

    if (this.blendAlpha < 1) {
      this.blendAlpha = Math.min(1, this.blendAlpha + dt * 3.4);
    }
    const smoothBlend = this.blendAlpha * this.blendAlpha * (3 - 2 * this.blendAlpha);

    if (useSnap) {
      const blendedOffset = this._vTmp.lerpVectors(this.prevHipsOffset, this.currentHipsOffset, smoothBlend);
      if (this.bones.Hips) {
        this.bones.Hips.position.copy(this.hipsRestPos).add(blendedOffset);
      }
    } else if (this.bones.Hips) {
      this.bones.Hips.position.copy(this.hipsRestPos);
    }

    for (const name of BONE_ORDER) {
      const bone = this.bones[name];
      if (!bone || !this.neutralWorldQ[name]) continue;

      const [rx, ry, rz] = pose[name];
      this._eulerTmp.set(rx, ry, rz, 'XYZ');
      this._qTmp.setFromEuler(this._eulerTmp);

      const parentName = BONE_PARENT[name];
      if (!parentName) {
        this._qAccum[name].copy(this._qTmp);
        this._qTarget.copy(this._qAccum[name]).multiply(this.neutralWorldQ[name]);
      } else {
        this._qAccum[name].copy(this._qAccum[parentName]).multiply(this._qTmp);
        this._qParent.copy(this._qAccum[parentName]).multiply(this.neutralWorldQ[parentName]);
        this._qTarget.copy(this._qAccum[name]).multiply(this.neutralWorldQ[name]);
        this._qTarget.premultiply(this._qParent.invert());
      }

      if (this.blendAlpha < 1 && this.prevBoneLocalQ[name]) {
        bone.quaternion.copy(this.prevBoneLocalQ[name]).slerp(this._qTarget, smoothBlend);
      } else {
        bone.quaternion.copy(this._qTarget);
      }
    }

    if (useSnap) {
      this.snapToSupport(supportY, supportMarkers);
    } else {
      this.charRoot.updateMatrixWorld(true);
    }

    // Posiciona o pilar exatamente encostado na palma da mão durante Alongamento Peitoral
    if (this.animId === 'chest_stretch' && this.propPost.visible) {
      const palmMarker = isLeft ? this.markers.handL : this.markers.handR;
      if (palmMarker) {
        palmMarker.getWorldPosition(this._vTmp2);
        this.propPost.position.set(this._vTmp2.x + sgn * 0.068, 0, this._vTmp2.z);
      }
    }
  }

  animate() {
    if (this.disposed) return;
    requestAnimationFrame(() => this.animate());

    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastFrameMs) / 1000);
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

  resize() {
    if (this.disposed) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w > 0 && h > 0) {
      const aspect = w / h;
      this.camera.aspect = aspect;
      // Adapta o FOV automaticamente em telas estreitas ou muito baixas para nunca cortar os braços/equipamentos
      this.camera.fov = aspect < 1.15 ? 45 : (aspect > 1.85 ? 36 : 39);
      this.camera.updateProjectionMatrix();
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.setSize(w, h);
    }
  }

  bindResize() {
    this.resizeObserver = new ResizeObserver(() => this.resize());
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
