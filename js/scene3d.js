// Motor 3D com Personal Trainer Humana Real (GLB SkinnedMesh) + Estúdio PBR + Biomecânica Fluida

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

    // Estado do rig humano GLB
    this.modelReady = false;
    this.bones = {};
    this.restWorldQ = {};
    this.neutralWorldQ = {};
    this.hipsRestPos = new THREE.Vector3(0, 0.953, -0.005);
    this.markers = {};
    this.muscleRings = {};

    // Estado de interpolação suave (quaternion slerp entre poses)
    this.currentBoneLocalQ = {};
    this.prevBoneLocalQ = {};
    this.blendAlpha = 1;
    this.currentHipsOffset = new THREE.Vector3();
    this.prevHipsOffset = new THREE.Vector3();

    // Objetos temporários reutilizáveis (zero GC por frame)
    this._qAccum = {};
    for (const b of BONE_ORDER) this._qAccum[b] = new THREE.Quaternion();
    this._qTmp = new THREE.Quaternion();
    this._qParent = new THREE.Quaternion();
    this._qTarget = new THREE.Quaternion();
    this._eulerTmp = new THREE.Euler(0, 0, 0, 'XYZ');
    this._vTmp = new THREE.Vector3();

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

    // Iluminação suave de estúdio para pele e tecido naturais
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
    // Textura procedural para piso de academia sem superfícies coplanares (zero Z-fighting!)
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

    // Piso principal bem separado abaixo da plataforma (-0.025m)
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
    floor.position.y = -0.025;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Plataforma circular elevada com topo exatamente em Y = 0.000
    const platform = new THREE.Mesh(
      new THREE.CylinderGeometry(1.38, 1.44, 0.022, 64),
      new THREE.MeshStandardMaterial({
        color: '#14213a',
        roughness: 0.68,
        metalness: 0.16,
        envMapIntensity: 0.35
      })
    );
    platform.position.y = -0.011;
    platform.receiveShadow = true;
    this.scene.add(platform);

    // Anel luminoso sutil acima da plataforma (sem Z-fighting)
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.34, 1.38, 64),
      new THREE.MeshBasicMaterial({
        color: '#10b981',
        transparent: true,
        opacity: 0.42,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.003;
    this.scene.add(ring);

    // Fundo curvo arquitetônico distante em -Z
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

    // 1. Tapete de exercício (base em Y=0.002 para não colidir com a plataforma)
    const matGroup = new THREE.Group();
    const matMat = new THREE.MeshStandardMaterial({ color: '#0f766e', roughness: 0.82, metalness: 0.05, envMapIntensity: 0.22 });
    const matTrimMat = new THREE.MeshStandardMaterial({ color: '#2dd4bf', roughness: 0.55, envMapIntensity: 0.35 });

    const matThickness = MAT_TOP_Y - 0.002;
    const matBody = new THREE.Mesh(new THREE.BoxGeometry(0.84, matThickness, 1.94), matMat);
    matBody.position.y = 0.002 + matThickness / 2;
    matBody.receiveShadow = true;
    matBody.castShadow = true;
    matGroup.add(matBody);

    for (const ez of [-0.97, 0.97]) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(matThickness / 2, matThickness / 2, 0.84, 12), matTrimMat);
      cap.rotation.z = Math.PI / 2;
      cap.position.set(0, 0.002 + matThickness / 2, ez);
      matGroup.add(cap);
    }

    const centerLine = new THREE.Mesh(new THREE.PlaneGeometry(0.016, 1.82), matTrimMat);
    centerLine.rotation.x = -Math.PI / 2;
    centerLine.position.y = MAT_TOP_Y + 0.002;
    matGroup.add(centerLine);

    matGroup.visible = false;
    this.propsGroup.add(matGroup);
    this.propMat = matGroup;

    // 2. Parede de apoio (Flexão na parede)
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

    // 2b. Pilar lateral (Alongamento Peitoral)
    const postGroup = new THREE.Group();
    const postMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 2.28, 0.2),
      new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.55, metalness: 0.2, envMapIntensity: 0.4 })
    );
    postMesh.position.set(-0.78, 1.142, -0.04);
    postMesh.castShadow = true;
    postMesh.receiveShadow = true;
    postGroup.add(postMesh);

    const postAccent = new THREE.Mesh(new THREE.BoxGeometry(0.02, 2.1, 0.21), new THREE.MeshBasicMaterial({ color: '#10b981' }));
    postAccent.position.set(-0.71, 1.1, -0.04);
    postGroup.add(postAccent);

    postGroup.visible = false;
    this.propsGroup.add(postGroup);
    this.propPost = postGroup;

    // 3. Cadeira ergonômica (Agachamento com cadeira)
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
      [-0.2, 0.215, -0.26],
      [0.2, 0.215, -0.26],
      [-0.2, 0.215, -0.64],
      [0.2, 0.215, -0.64]
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
      if (obj.isBone || BONE_ORDER.includes(obj.name) || /Hand(Thumb|Index|Middle|Ring|Pinky)/.test(obj.name)) {
        this.bones[obj.name] = obj;
      }
    });

    this.charRoot.updateMatrixWorld(true);
    const bbox = new THREE.Box3().setFromObject(this.trainerScene);
    const soleY = Number.isFinite(bbox.min.y) ? bbox.min.y : 0.0;

    // Captura orientações mundiais de repouso (T-pose) e constrói pose neutra em pé
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
      this.currentBoneLocalQ[name] = bone.quaternion.clone();
    }

    if (this.bones.Hips) {
      this.hipsRestPos.copy(this.bones.Hips.position);
    }

    // Relaxa suavemente os dedos das mãos (evita mãos rígidas em T-pose)
    this.relaxFingers();

    // Cria marcadores anatômicos de contato usando worldToLocal sobre a pose T-pose inicial
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
    const pRFoot = getWorldPos('RightFoot');
    const pRToe = getWorldPos('RightToeBase');
    const pLKnee = getWorldPos('LeftLeg');
    const pRKnee = getWorldPos('RightLeg');
    const pLHand = getWorldPos('LeftHand');
    const pRHand = getWorldPos('RightHand');
    const pLFore = getWorldPos('LeftForeArm');
    const pRFore = getWorldPos('RightForeArm');
    const pHips = getWorldPos('Hips');
    const pSpine2 = getWorldPos('Spine2');

    this.markers = {
      heelL: addWorldMarker('LeftFoot', new THREE.Vector3(pLFoot.x, soleY, pLFoot.z - 0.04)),
      toeL: addWorldMarker('LeftToeBase', new THREE.Vector3(pLToe.x, soleY, pLToe.z + 0.05)),
      heelR: addWorldMarker('RightFoot', new THREE.Vector3(pRFoot.x, soleY, pRFoot.z - 0.04)),
      toeR: addWorldMarker('RightToeBase', new THREE.Vector3(pRToe.x, soleY, pRToe.z + 0.05)),
      kneeL: addWorldMarker('LeftLeg', new THREE.Vector3(pLKnee.x, pLKnee.y, pLKnee.z + 0.055)),
      kneeR: addWorldMarker('RightLeg', new THREE.Vector3(pRKnee.x, pRKnee.y, pRKnee.z + 0.055)),
      handL: addWorldMarker('LeftHand', new THREE.Vector3(pLHand.x + 0.09, pLHand.y, pLHand.z)),
      palmL: addWorldMarker('LeftHand', new THREE.Vector3(pLHand.x + 0.04, pLHand.y - 0.018, pLHand.z)),
      handR: addWorldMarker('RightHand', new THREE.Vector3(pRHand.x - 0.09, pRHand.y, pRHand.z)),
      palmR: addWorldMarker('RightHand', new THREE.Vector3(pRHand.x - 0.04, pRHand.y - 0.018, pRHand.z)),
      backPelvis: addWorldMarker('Hips', new THREE.Vector3(0, pHips.y, pHips.z - 0.11)),
      backChest: addWorldMarker('Spine2', new THREE.Vector3(0, pSpine2.y + 0.06, pSpine2.z - 0.12)),
      forearmL: addWorldMarker('LeftForeArm', new THREE.Vector3(pLFore.x + 0.11, pLFore.y, pLFore.z - 0.036)),
      forearmR: addWorldMarker('RightForeArm', new THREE.Vector3(pRFore.x - 0.11, pRFore.y, pRFore.z - 0.036)),
      sideAnkleL: addWorldMarker('LeftFoot', new THREE.Vector3(pLFoot.x + 0.045, soleY + 0.032, pLFoot.z + 0.03)),
      sideAnkleR: addWorldMarker('RightFoot', new THREE.Vector3(pRFoot.x - 0.045, soleY + 0.032, pRFoot.z + 0.03))
    };

    // Halos anatômicos sutis de foco muscular (sem pintar a pele humana)
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
      // Como os ossos internos têm scale=0.01 (unidades em cm), multiplicamos por 100 em local!
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
        if (active) {
          mesh.material.opacity = pulse;
        }
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

    // Inicializa deltas de pose em radianos (espaço do personagem: +X esquerda, +Y cima, +Z frente)
    const pose = {};
    for (const b of BONE_ORDER) pose[b] = [0, 0, 0];

    this.charRoot.position.set(0, 0, 0);
    this.currentHipsOffset.set(0, 0, 0);

    const isLeft = this.activeSide === 'left';
    const sgn = isLeft ? 1 : -1;

    // Curvas fluidas biomecânicas (C¹ contínuas com breve pausa natural nos extremos)
    const smooth01 = (freq = 1.0, phase = 0) => {
      const r = 0.5 - 0.5 * Math.cos(t * freq + phase);
      return r * r * (3 - 2 * r);
    };
    const wave11 = (freq = 1.0, phase = 0) => Math.sin(t * freq + phase);
    const breath = Math.sin(t * 2.1);

    // Helper para distribuir flexão/rotação suavemente pela coluna (lombar -> torácica -> pescoço)
    const setSpineCurve = (rx, ry = 0, rz = 0, headCounterX = 0) => {
      pose.Spine = [rx * 0.30, ry * 0.30, rz * 0.30];
      pose.Spine1 = [rx * 0.35, ry * 0.35, rz * 0.35];
      pose.Spine2 = [rx * 0.35 + breath * 0.015, ry * 0.35, rz * 0.35];
      pose.Neck = [headCounterX * 0.5, -ry * 0.35, 0];
      pose.Head = [headCounterX * 0.5, -ry * 0.25, 0];
    };

    let supportY = 0;
    let supportMarkers = [this.markers.heelL, this.markers.heelR, this.markers.toeL, this.markers.toeR];

    switch (this.animId) {
      case 'ankle_rotation': {
        const up = isLeft ? 'LeftUpLeg' : 'RightUpLeg';
        const knee = isLeft ? 'LeftLeg' : 'RightLeg';
        const foot = isLeft ? 'LeftFoot' : 'RightFoot';
        supportMarkers = isLeft ? [this.markers.heelR, this.markers.toeR] : [this.markers.heelL, this.markers.toeL];

        pose[up] = [-0.36, 0, 0];
        pose[knee] = [0.28, 0, 0];
        pose[foot] = [0.25 + 0.26 * Math.sin(t * 3.4), 0.32 * Math.cos(t * 3.4), 0.16 * Math.sin(t * 3.4)];
        pose.LeftArm = [0, 0, 0.14];
        pose.RightArm = [0, 0, -0.14];
        pose.LeftForeArm = [-0.18, 0, 0];
        pose.RightForeArm = [-0.18, 0, 0];
        setSpineCurve(0.03, 0, 0, -0.03);
        this.emitPhaseCue(isLeft ? 'Gire o tornozelo esquerdo' : 'Gire o tornozelo direito');
        break;
      }

      case 'hip_rotation': {
        const ang = t * 2.2;
        this.currentHipsOffset.set(7.5 * Math.cos(ang), 0, 6.5 * Math.sin(ang));
        pose.Hips = [0.08 * Math.sin(ang), 0, -0.1 * Math.cos(ang)];
        setSpineCurve(-0.08 * Math.sin(ang), 0, 0.1 * Math.cos(ang));
        pose.LeftArm = [0, 0, 0.42];
        pose.LeftForeArm = [-0.35, 0, -0.75];
        pose.RightArm = [0, 0, -0.42];
        pose.RightForeArm = [-0.35, 0, 0.75];
        pose.LeftUpLeg = [0, 0, 0.1];
        pose.RightUpLeg = [0, 0, -0.1];
        this.emitPhaseCue('Círculos amplos e contínuos com o quadril');
        break;
      }

      case 'leg_swing': {
        const swing = 0.66 * wave11(2.5);
        const up = isLeft ? 'LeftUpLeg' : 'RightUpLeg';
        const knee = isLeft ? 'LeftLeg' : 'RightLeg';
        supportMarkers = isLeft ? [this.markers.heelR, this.markers.toeR] : [this.markers.heelL, this.markers.toeL];
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
        pose.LeftArm = [0.22 * Math.cos(ang), 0, Math.PI / 2 - 0.08 + 0.16 * Math.sin(ang)];
        pose.RightArm = [0.22 * Math.cos(ang), 0, -(Math.PI / 2 - 0.08 + 0.16 * Math.sin(ang))];
        pose.LeftForeArm = [-0.1, 0, 0];
        pose.RightForeArm = [-0.1, 0, 0];
        pose.LeftUpLeg = [0, 0, 0.06];
        pose.RightUpLeg = [0, 0, -0.06];
        setSpineCurve(0, 0, 0, 0);
        this.emitPhaseCue('Ombros relaxados • Rotações amplas');
        break;
      }

      case 'high_knees': {
        const phase = t * 4.2;
        const liftL = Math.pow(Math.max(0, Math.sin(phase)), 0.85);
        const liftR = Math.pow(Math.max(0, -Math.sin(phase)), 0.85);
        pose.Hips = [0, 0.06 * Math.sin(phase), 0.03 * Math.sin(phase)];
        pose.LeftUpLeg = [-1.42 * liftL + 0.12 * liftR, 0, 0];
        pose.LeftLeg = [1.55 * liftL + 0.08, 0, 0];
        pose.RightUpLeg = [-1.42 * liftR + 0.12 * liftL, 0, 0];
        pose.RightLeg = [1.55 * liftR + 0.08, 0, 0];
        pose.LeftForeArm = [-1.25, 0, 0];
        pose.RightForeArm = [-1.25, 0, 0];
        pose.LeftArm = [-0.75 * liftR + 0.28 * liftL, 0, 0.08];
        pose.RightArm = [-0.75 * liftL + 0.28 * liftR, 0, -0.08];
        setSpineCurve(0.06, -0.08 * Math.sin(phase), 0, -0.06);
        supportMarkers = [this.markers.toeL, this.markers.toeR];
        this.emitPhaseCue('Eleve os joelhos na linha do quadril');
        break;
      }

      case 'treadmill': {
        const kmh = this.treadmillSpeedKmh || 4.5;
        const isJog = kmh >= 5.3;
        const freq = isJog ? 6.5 : 3.1 + (kmh - 3.0) * 0.85;
        const stride = isJog ? 0.62 : 0.34 + (kmh - 3.0) * 0.08;
        const p = t * freq;

        const swingL = Math.sin(p) * stride;
        const swingR = Math.sin(p + Math.PI) * stride;
        const kneeL = Math.max(0, -Math.cos(p)) * (isJog ? 1.18 : 0.56);
        const kneeR = Math.max(0, -Math.cos(p + Math.PI)) * (isJog ? 1.18 : 0.56);

        pose.Hips = [0, 0.06 * Math.sin(p), 0.03 * Math.cos(p)];
        pose.LeftUpLeg = [swingL, 0, 0];
        pose.LeftLeg = [0.12 + kneeL, 0, 0];
        pose.LeftFoot = [-0.18 * Math.cos(p), 0, 0];
        pose.RightUpLeg = [swingR, 0, 0];
        pose.RightLeg = [0.12 + kneeR, 0, 0];
        pose.RightFoot = [0.18 * Math.cos(p), 0, 0];

        setSpineCurve(isJog ? 0.14 : 0.06, -0.09 * Math.sin(p), 0, isJog ? -0.1 : -0.04);
        pose.LeftForeArm = [isJog ? -1.42 : -0.88, 0, 0];
        pose.RightForeArm = [isJog ? -1.42 : -0.88, 0, 0];
        pose.LeftArm = [-swingL * 0.92, 0, 0.08];
        pose.RightArm = [-swingR * 0.92, 0, -0.08];

        this.charRoot.position.z = -0.06;
        const bounce = isJog ? Math.abs(Math.sin(p)) * 0.032 : Math.abs(Math.sin(p)) * 0.008;
        supportY = TREADMILL_BELT_Y + bounce;
        supportMarkers = [this.markers.toeL, this.markers.heelL, this.markers.toeR, this.markers.heelR];
        this.emitPhaseCue(`${isJog ? 'Trote' : 'Caminhada'} • ${String(kmh).replace('.', ',')} km/h`);
        break;
      }

      case 'squat':
      case 'chair_squat': {
        const d = smooth01(2.0);
        pose.LeftUpLeg = [-1.42 * d, 0.12 * d, 0.1];
        pose.RightUpLeg = [-1.42 * d, -0.12 * d, -0.1];
        pose.LeftLeg = [1.56 * d, 0, 0];
        pose.RightLeg = [1.56 * d, 0, 0];
        pose.LeftFoot = [-0.22 * d, 0, 0];
        pose.RightFoot = [-0.22 * d, 0, 0];
        setSpineCurve(0.36 * d, 0, 0, -0.32 * d);
        pose.LeftArm = [-1.25 * d - 0.15, 0, 0.08];
        pose.RightArm = [-1.25 * d - 0.15, 0, -0.08];
        pose.LeftForeArm = [-0.32 + 0.18 * d, 0, 0];
        pose.RightForeArm = [-0.32 + 0.18 * d, 0, 0];
        if (this.animId === 'chair_squat') this.charRoot.position.z = -0.04;
        this.emitPhaseCue(d > 0.55 ? 'Desça com quadril para trás' : 'Empurre pelos calcanhares');
        break;
      }

      case 'wall_pushup': {
        const press = smooth01(2.2);
        const lean = 0.26 + 0.18 * press;
        this.charRoot.position.z = -0.03;
        pose.Hips = [lean, 0, 0];
        pose.LeftFoot = [-lean * 0.85, 0, 0];
        pose.RightFoot = [-lean * 0.85, 0, 0];
        pose.LeftUpLeg = [0, 0, 0.06];
        pose.RightUpLeg = [0, 0, -0.06];
        setSpineCurve(0.03, 0, 0, -0.18);

        pose.LeftShoulder = [0, 0.18 * press, 0];
        pose.RightShoulder = [0, -0.18 * press, 0];
        pose.LeftArm = [-1.48 - 0.22 * press, 0, 0.18 * press + 0.08];
        pose.RightArm = [-1.48 - 0.22 * press, 0, -0.18 * press - 0.08];
        pose.LeftForeArm = [-0.14 - 1.18 * press, -1.1, 0];
        pose.RightForeArm = [-0.14 - 1.18 * press, 1.1, 0];
        pose.LeftHand = [-0.75 + 0.25 * press, 0, 0];
        pose.RightHand = [-0.75 + 0.25 * press, 0, 0];
        supportMarkers = [this.markers.toeL, this.markers.toeR];
        this.emitPhaseCue(press > 0.55 ? 'Aproxime o peito da parede' : 'Empurre com controle');
        break;
      }

      case 'glute_bridge': {
        const lift = smooth01(2.0);
        pose.Hips = [-Math.PI / 2 - 0.34 * lift, 0, 0];
        setSpineCurve(0.34 * lift, 0, 0, 0.15);
        pose.LeftUpLeg = [-0.95 + 0.55 * lift, 0, 0.06];
        pose.RightUpLeg = [-0.95 + 0.55 * lift, 0, -0.06];
        pose.LeftLeg = [1.88 - 0.4 * lift, 0, 0];
        pose.RightLeg = [1.88 - 0.4 * lift, 0, 0];
        pose.LeftFoot = [0.4, 0, 0];
        pose.RightFoot = [0.4, 0, 0];
        pose.LeftArm = [0.1, 0, 0.22];
        pose.RightArm = [0.1, 0, -0.22];
        this.charRoot.position.z = -0.22;
        supportY = MAT_TOP_Y;
        supportMarkers = [this.markers.backChest, this.markers.heelL, this.markers.heelR];
        this.emitPhaseCue(lift > 0.6 ? 'Contraia os glúteos no alto' : 'Desça devagar até o tapete');
        break;
      }

      case 'bird_dog': {
        const cycle = (t * 0.8) % 2;
        const activeLeftArm = cycle < 1;
        const p = cycle % 1;
        // Curva suave com breve sustentação no topo da extensão
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
        pose.Hips = [Math.PI / 2 - 0.32 + breath * 0.012, 0, 0];
        setSpineCurve(0, 0, 0, -0.34);
        pose.LeftArm = [-(Math.PI / 2 - 0.32), 0, 0];
        pose.RightArm = [-(Math.PI / 2 - 0.32), 0, 0];
        pose.LeftForeArm = [0, -1.15, 0];
        pose.RightForeArm = [0, 1.15, 0];
        pose.LeftHand = [-Math.PI / 2, 0, 0];
        pose.RightHand = [-Math.PI / 2, 0, 0];
        pose.LeftLeg = [1.05, 0, 0];
        pose.RightLeg = [1.05, 0, 0];
        pose.LeftUpLeg = [0, 0, 0.05];
        pose.RightUpLeg = [0, 0, -0.05];
        supportY = MAT_TOP_Y;
        supportMarkers = [
          this.markers.handL, this.markers.handR,
          this.markers.palmL, this.markers.palmR,
          this.markers.kneeL, this.markers.kneeR
        ];
        this.emitPhaseCue('Core ativado • Corpo alinhado');
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
        const tilt = 0.175;
        if (!isLeft) {
          pose.Hips = [0, 0, Math.PI / 2 - tilt + breath * 0.01];
          setSpineCurve(0, 0, -0.02, 0);
          pose.RightArm = [0, 0, -(Math.PI / 2 - tilt)];
          pose.RightForeArm = [-Math.PI / 2, 0, 0];
          pose.LeftArm = [0, 0, 0.24];
          pose.LeftForeArm = [-0.65, 0, 0];
          supportMarkers = [this.markers.forearmR, this.markers.sideAnkleR];
          this.emitPhaseCue('Prancha lateral direita • Quadril elevado');
        } else {
          pose.Hips = [0, 0, -(Math.PI / 2 - tilt + breath * 0.01)];
          setSpineCurve(0, 0, 0.02, 0);
          pose.LeftArm = [0, 0, Math.PI / 2 - tilt];
          pose.LeftForeArm = [-Math.PI / 2, 0, 0];
          pose.RightArm = [0, 0, -0.24];
          pose.RightForeArm = [-0.65, 0, 0];
          supportMarkers = [this.markers.forearmL, this.markers.sideAnkleL];
          this.emitPhaseCue('Prancha lateral esquerda • Quadril elevado');
        }
        supportY = MAT_TOP_Y;
        break;
      }

      case 'lateral_leg_raise': {
        const lift = smooth01(2.2);
        const up = isLeft ? 'LeftUpLeg' : 'RightUpLeg';
        supportMarkers = isLeft ? [this.markers.heelR, this.markers.toeR] : [this.markers.heelL, this.markers.toeL];
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
        const rise = smooth01(2.4);
        pose.LeftFoot = [0.46 * rise, 0, 0];
        pose.RightFoot = [0.46 * rise, 0, 0];
        pose.LeftUpLeg = [0, 0, 0.05];
        pose.RightUpLeg = [0, 0, -0.05];
        pose.LeftArm = [0, 0, 0.12];
        pose.RightArm = [0, 0, -0.12];
        setSpineCurve(0, 0, 0, 0);
        supportMarkers = [this.markers.toeL, this.markers.toeR];
        this.emitPhaseCue(rise > 0.6 ? 'Sustente na ponta dos pés' : 'Desça suavemente');
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
        supportMarkers = [this.markers.toeL, this.markers.toeR];
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
        this.emitPhaseCue('Rotação controlada • Quadril estável');
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
        const pulse = 0.025 * breath;
        const up = isLeft ? 'LeftUpLeg' : 'RightUpLeg';
        const knee = isLeft ? 'LeftLeg' : 'RightLeg';
        const arm = isLeft ? 'LeftArm' : 'RightArm';
        const fore = isLeft ? 'LeftForeArm' : 'RightForeArm';
        const oppArm = isLeft ? 'RightArm' : 'LeftArm';
        supportMarkers = isLeft ? [this.markers.heelR, this.markers.toeR] : [this.markers.heelL, this.markers.toeL];

        pose[up] = [0.26 + pulse, 0, 0];
        pose[knee] = [2.32 + pulse, 0, 0];
        setSpineCurve(0.06, 0, 0, -0.06);
        pose[arm] = [0.68, 0, sgn * 0.08];
        pose[fore] = [-0.18, 0, 0];
        pose[oppArm] = [0, 0, -sgn * 0.28];
        this.emitPhaseCue(isLeft ? 'Alongue o quadríceps esquerdo' : 'Alongue o quadríceps direito');
        break;
      }

      case 'hamstring_stretch': {
        const pulse = 0.025 * breath;
        const fUp = isLeft ? 'LeftUpLeg' : 'RightUpLeg';
        const fKnee = isLeft ? 'LeftLeg' : 'RightLeg';
        const fFoot = isLeft ? 'LeftFoot' : 'RightFoot';
        const bUp = isLeft ? 'RightUpLeg' : 'LeftUpLeg';
        const bKnee = isLeft ? 'RightLeg' : 'LeftLeg';

        pose[fUp] = [-0.62, 0, 0];
        pose[fKnee] = [0.04, 0, 0];
        pose[fFoot] = [-0.25, 0, 0];
        pose[bUp] = [0.26, 0, 0];
        pose[bKnee] = [0.44, 0, 0];

        setSpineCurve(0.76 + pulse, 0, 0, -0.35);
        pose.LeftArm = [-0.92, 0, 0.05];
        pose.RightArm = [-0.92, 0, -0.05];
        this.emitPhaseCue('Incline a partir do quadril • Coluna alinhada');
        break;
      }

      case 'calf_stretch': {
        const pulse = 0.03 * breath;
        const bUp = isLeft ? 'LeftUpLeg' : 'RightUpLeg';
        const bKnee = isLeft ? 'LeftLeg' : 'RightLeg';
        const bFoot = isLeft ? 'LeftFoot' : 'RightFoot';
        const fUp = isLeft ? 'RightUpLeg' : 'LeftUpLeg';
        const fKnee = isLeft ? 'RightLeg' : 'LeftLeg';
        const fFoot = isLeft ? 'RightFoot' : 'LeftFoot';

        pose[fUp] = [-0.64 - pulse, 0, 0];
        pose[fKnee] = [0.74 + pulse, 0, 0];
        pose[fFoot] = [-0.12, 0, 0];

        pose[bUp] = [0.46, 0, 0];
        pose[bKnee] = [0.04, 0, 0];
        pose[bFoot] = [-0.45, 0, 0];

        setSpineCurve(0.12, 0, 0, -0.1);
        pose.LeftArm = [-0.24, 0, 0.1];
        pose.RightArm = [-0.24, 0, -0.1];
        this.emitPhaseCue('Calcanhar de trás pressionado no chão');
        break;
      }

      case 'hip_flexor_stretch': {
        const pulse = 0.03 * breath;
        const bUp = isLeft ? 'LeftUpLeg' : 'RightUpLeg';
        const bKnee = isLeft ? 'LeftLeg' : 'RightLeg';
        const bKneeMarker = isLeft ? this.markers.kneeL : this.markers.kneeR;
        const fUp = isLeft ? 'RightUpLeg' : 'LeftUpLeg';
        const fKnee = isLeft ? 'RightLeg' : 'LeftLeg';
        const fHeelMarker = isLeft ? this.markers.heelR : this.markers.heelL;

        pose[fUp] = [-1.62 - pulse, 0, 0];
        pose[fKnee] = [1.62 + pulse, 0, 0];
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
        const pulse = 0.035 * breath;
        this.propPost.position.x = isLeft ? 1.54 : 0;
        const arm = isLeft ? 'LeftArm' : 'RightArm';
        const other = isLeft ? 'RightArm' : 'LeftArm';

        pose[arm] = [0.24 + pulse, 0, sgn * 1.50];
        pose[other] = [0, 0, -sgn * 0.16];
        pose.LeftUpLeg = [0, 0, 0.07];
        pose.RightUpLeg = [0, 0, -0.07];
        setSpineCurve(0, sgn * (-0.34 - pulse), 0, 0);
        this.emitPhaseCue('Abra o peitoral respirando profundamente');
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

    // Aplica cadeia de quatérnios top-down preservando eixos anatômicos exatos do GLB
    if (this.blendAlpha < 1) {
      this.blendAlpha = Math.min(1, this.blendAlpha + dt * 3.4);
    }
    const smoothBlend = this.blendAlpha * this.blendAlpha * (3 - 2 * this.blendAlpha);

    // Posição de Hips com suavização
    const blendedOffset = this._vTmp.lerpVectors(this.prevHipsOffset, this.currentHipsOffset, smoothBlend);
    if (this.bones.Hips) {
      this.bones.Hips.position.copy(this.hipsRestPos).add(blendedOffset);
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

    this.snapToSupport(supportY, supportMarkers);
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
