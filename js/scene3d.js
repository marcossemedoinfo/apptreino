// Motor 3D de Biomecânica e Demonstração de Treinos (Three.js)

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const CAMERA_PRESETS = {
  threeQuarter: { pos: [2.15, 1.55, 2.55], target: [0, 0.86, 0] },
  front: { pos: [0, 1.38, 3.15], target: [0, 0.88, 0] },
  side: { pos: [3.05, 1.25, 0.2], target: [0, 0.82, 0] },
  top: { pos: [0.1, 3.5, 1.35], target: [0, 0.7, 0] }
};

const MAT_TOP_Y = 0.024;
const TREADMILL_BELT_Y = 0.145;

export class WorkoutScene3D {
  constructor(container) {
    this.container = container;
    this.animId = 'squat';
    this.playing = true;
    this.speedMultiplier = 1.0;
    this.treadmillSpeedKmh = 4.5;
    this.treadmillIncline = 0;
    this.activeSide = 'right'; // 'right' | 'left'
    this.highlightMuscles = true;
    this.activeMuscles = [];
    this.simTime = 0;
    this.lastFrameMs = performance.now();
    this.beltOffset = 0;
    this.disposed = false;

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
    this.scene.background = new THREE.Color('#0c1322');
    this.scene.fog = new THREE.Fog('#0c1322', 7, 16);

    this.camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 40);
    this.camera.position.set(...CAMERA_PRESETS.threeQuarter.pos);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;

    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 1.4;
    this.controls.maxDistance = 6.0;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.target.set(...CAMERA_PRESETS.threeQuarter.target);
    this.controls.update();

    // Iluminação de estúdio balanceada
    const hemi = new THREE.HemisphereLight('#dbeafe', '#1e293b', 0.85);
    this.scene.add(hemi);

    const keyLight = new THREE.DirectionalLight('#ffffff', 1.45);
    keyLight.position.set(2.8, 4.6, 3.2);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 14;
    const d = 2.6;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    this.scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight('#38bdf8', 0.6);
    rimLight.position.set(-3.0, 2.4, -2.8);
    this.scene.add(rimLight);
  }

  buildStudioEnvironment() {
    // Piso do estúdio
    const floorGeo = new THREE.CircleGeometry(6.5, 48);
    const floorMat = new THREE.MeshStandardMaterial({
      color: '#111a2e',
      roughness: 0.78,
      metalness: 0.08
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Anel luminoso sutil no piso
    const ringGeo = new THREE.RingGeometry(1.18, 1.22, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: '#10b981',
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.002;
    this.scene.add(ring);

    const grid = new THREE.GridHelper(10, 20, '#1e3a5f', '#17253e');
    grid.position.y = 0.001;
    this.scene.add(grid);
  }

  buildProps() {
    this.propsGroup = new THREE.Group();
    this.scene.add(this.propsGroup);

    // 1. Tapete de exercício (Mat)
    const matGroup = new THREE.Group();
    const matBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.86, MAT_TOP_Y, 1.98),
      new THREE.MeshStandardMaterial({ color: '#0f766e', roughness: 0.85, metalness: 0.05 })
    );
    matBody.position.y = MAT_TOP_Y / 2;
    matBody.receiveShadow = true;
    matBody.castShadow = true;
    matGroup.add(matBody);

    const matBorder = new THREE.Mesh(
      new THREE.BoxGeometry(0.88, 0.004, 2.0),
      new THREE.MeshStandardMaterial({ color: '#2dd4bf', roughness: 0.6 })
    );
    matBorder.position.y = 0.003;
    matGroup.add(matBorder);
    matGroup.visible = false;
    this.propsGroup.add(matGroup);
    this.propMat = matGroup;

    // 2. Parede de apoio (Wall) - posicionada em +Z
    const wallGroup = new THREE.Group();
    const wallMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.9, 2.25, 0.1),
      new THREE.MeshStandardMaterial({
        color: '#334155',
        roughness: 0.7,
        metalness: 0.1,
        transparent: true,
        opacity: 0.88
      })
    );
    wallMesh.position.set(0, 1.125, 0.72);
    wallMesh.receiveShadow = true;
    wallMesh.castShadow = true;
    wallGroup.add(wallMesh);

    const wallTrim = new THREE.Mesh(
      new THREE.BoxGeometry(1.92, 0.08, 0.12),
      new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.6 })
    );
    wallTrim.position.set(0, 0.04, 0.72);
    wallGroup.add(wallTrim);
    wallGroup.visible = false;
    this.propsGroup.add(wallGroup);
    this.propWall = wallGroup;

    // 2b. Pilar / Batente lateral para alongamento de peitoral (sem obstruir câmera frontal)
    const postGroup = new THREE.Group();
    const postMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 2.25, 0.18),
      new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.65, metalness: 0.15 })
    );
    postMesh.position.set(-0.74, 1.125, -0.08);
    postMesh.castShadow = true;
    postMesh.receiveShadow = true;
    postGroup.add(postMesh);
    postGroup.visible = false;
    this.propsGroup.add(postGroup);
    this.propPost = postGroup;

    // 3. Cadeira (Chair) - posicionada atrás (-Z) para Agachamento com cadeira
    const chairGroup = new THREE.Group();
    const chairFrameMat = new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.4, metalness: 0.5 });
    const chairPadMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.65 });

    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.05, 0.44), chairPadMat);
    seat.position.set(0, 0.44, -0.44);
    seat.castShadow = true;
    seat.receiveShadow = true;
    chairGroup.add(seat);

    const backrest = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.42, 0.045), chairPadMat);
    backrest.position.set(0, 0.68, -0.64);
    backrest.castShadow = true;
    chairGroup.add(backrest);

    const legPositions = [
      [-0.2, 0.21, -0.25],
      [0.2, 0.21, -0.25],
      [-0.2, 0.21, -0.63],
      [0.2, 0.21, -0.63]
    ];
    for (const [lx, ly, lz] of legPositions) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.014, 0.42, 12), chairFrameMat);
      leg.position.set(lx, ly, lz);
      leg.castShadow = true;
      chairGroup.add(leg);
    }
    chairGroup.visible = false;
    this.propsGroup.add(chairGroup);
    this.propChair = chairGroup;

    // 4. Esteira (Treadmill)
    const tmGroup = new THREE.Group();
    const tmDark = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.45, metalness: 0.55 });
    const tmAccent = new THREE.MeshStandardMaterial({ color: '#10b981', roughness: 0.4, emissive: '#064e3b', emissiveIntensity: 0.35 });

    // Base lateral rails
    const deckFrame = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.11, 1.66), tmDark);
    deckFrame.position.set(0, 0.08, 0.05);
    deckFrame.castShadow = true;
    deckFrame.receiveShadow = true;
    tmGroup.add(deckFrame);

    // Canvas texture animada para a lona da esteira
    const beltCanvas = document.createElement('canvas');
    beltCanvas.width = 256;
    beltCanvas.height = 512;
    const bCtx = beltCanvas.getContext('2d');
    bCtx.fillStyle = '#0f172a';
    bCtx.fillRect(0, 0, 256, 512);
    bCtx.fillStyle = '#1e293b';
    for (let y = 0; y < 512; y += 32) {
      bCtx.fillRect(14, y, 228, 6);
    }
    bCtx.fillStyle = '#10b981';
    bCtx.fillRect(20, 0, 6, 512);
    bCtx.fillRect(230, 0, 6, 512);

    this.beltTexture = new THREE.CanvasTexture(beltCanvas);
    this.beltTexture.wrapS = THREE.RepeatWrapping;
    this.beltTexture.wrapT = THREE.RepeatWrapping;
    this.beltTexture.repeat.set(1, 2.5);

    const beltMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.56, 1.54),
      new THREE.MeshStandardMaterial({ map: this.beltTexture, roughness: 0.85 })
    );
    beltMesh.rotation.x = -Math.PI / 2;
    beltMesh.position.set(0, TREADMILL_BELT_Y, 0.02);
    beltMesh.receiveShadow = true;
    tmGroup.add(beltMesh);

    // Colunas frontais + corrimãos
    for (const side of [-1, 1]) {
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.038, 1.12, 16), tmDark);
      mast.position.set(side * 0.34, 0.62, 0.68);
      mast.rotation.x = -0.18;
      mast.castShadow = true;
      tmGroup.add(mast);

      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.44, 12), tmDark);
      handle.position.set(side * 0.34, 0.96, 0.45);
      handle.rotation.x = Math.PI / 2 - 0.1;
      handle.castShadow = true;
      tmGroup.add(handle);
    }

    // Painel console
    const consoleBox = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.24, 0.22), tmDark);
    consoleBox.position.set(0, 1.14, 0.62);
    consoleBox.rotation.x = -0.45;
    consoleBox.castShadow = true;
    tmGroup.add(consoleBox);

    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.13), tmAccent);
    screen.position.set(0, 1.19, 0.52);
    screen.rotation.x = -0.45;
    tmGroup.add(screen);

    tmGroup.visible = false;
    this.propsGroup.add(tmGroup);
    this.propTreadmill = tmGroup;
  }

  buildCharacterRig() {
    // Materiais com mapeamento por grupo muscular para destaque didático
    this.mats = {
      skin: new THREE.MeshStandardMaterial({ color: '#e6b89c', roughness: 0.62 }),
      hair: new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.7 }),
      eyes: new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.3 }),
      shirt: new THREE.MeshStandardMaterial({ color: '#0f766e', roughness: 0.65 }),
      shorts: new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.75 }),
      shoe: new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.5 }),
      shoeAccent: new THREE.MeshStandardMaterial({ color: '#10b981', roughness: 0.45 }),
      joints: new THREE.MeshStandardMaterial({ color: '#d8a488', roughness: 0.6 })
    };

    // Materiais dedicados por grupo para poder pulsar emissive quando ativo
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

    // PELVIS (pivô central do corpo)
    this.pelvis = new THREE.Group();
    this.pelvis.position.set(0, 0.94, 0);
    this.charRoot.add(this.pelvis);

    const pelvisMesh = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.15, 0.18), mm.glutes);
    pelvisMesh.castShadow = true;
    this.pelvis.add(pelvisMesh);

    const beltBand = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.035, 0.19), mm.hips);
    beltBand.position.y = 0.065;
    this.pelvis.add(beltBand);

    // SPINE -> CHEST -> NECK -> HEAD
    this.spine = new THREE.Group();
    this.spine.position.set(0, 0.08, 0);
    this.pelvis.add(this.spine);

    const waistMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.135, 0.2, 16), mm.core);
    waistMesh.position.y = 0.1;
    waistMesh.castShadow = true;
    this.spine.add(waistMesh);

    this.chest = new THREE.Group();
    this.chest.position.set(0, 0.2, 0);
    this.spine.add(this.chest);

    const chestMesh = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.26, 0.19), mm.chest);
    chestMesh.position.y = 0.13;
    chestMesh.castShadow = true;
    this.chest.add(chestMesh);

    // Marcador sutil nas costas e no peito
    const backPanel = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.22, 0.03), mm.back);
    backPanel.position.set(0, 0.13, -0.09);
    this.chest.add(backPanel);

    const shoulderBar = new THREE.Mesh(new THREE.CapsuleGeometry(0.068, 0.30, 8, 14), mm.shoulders);
    shoulderBar.rotation.z = Math.PI / 2;
    shoulderBar.position.y = 0.23;
    shoulderBar.castShadow = true;
    this.chest.add(shoulderBar);

    // PESCOÇO & CABEÇA
    this.neck = new THREE.Group();
    this.neck.position.set(0, 0.27, 0);
    this.chest.add(this.neck);

    const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.054, 0.08, 12), m.skin);
    neckMesh.position.y = 0.04;
    this.neck.add(neckMesh);

    this.head = new THREE.Group();
    this.head.position.set(0, 0.14, 0);
    this.neck.add(this.head);

    const headSphere = new THREE.Mesh(new THREE.SphereGeometry(0.102, 20, 18), m.skin);
    headSphere.scale.set(0.92, 1.08, 0.98);
    headSphere.castShadow = true;
    this.head.add(headSphere);

    // Cabelo & rosto (olhos + nariz para deixar frente +Z inconfundível)
    const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.106, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.56), m.hair);
    hairCap.scale.set(0.93, 1.07, 1.0);
    hairCap.rotation.x = -0.22;
    this.head.add(hairCap);

    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.026, 0.025), m.joints);
    nose.position.set(0, -0.005, 0.1);
    this.head.add(nose);

    for (const sx of [-0.036, 0.036]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), m.eyes);
      eye.position.set(sx, 0.018, 0.092);
      this.head.add(eye);
    }

    // BRAÇOS (Esquerdo +X, Direito -X)
    const buildArm = (sideSign) => {
      const shoulder = new THREE.Group();
      shoulder.position.set(sideSign * 0.215, 0.23, 0);
      this.chest.add(shoulder);

      const sJoint = new THREE.Mesh(new THREE.SphereGeometry(0.055, 14, 12), mm.shoulders);
      sJoint.castShadow = true;
      shoulder.add(sJoint);

      const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.038, 0.25, 14), mm.arms);
      upperArm.position.y = -0.13;
      upperArm.castShadow = true;
      shoulder.add(upperArm);

      const elbow = new THREE.Group();
      elbow.position.set(0, -0.26, 0);
      shoulder.add(elbow);

      const eJoint = new THREE.Mesh(new THREE.SphereGeometry(0.038, 12, 10), m.joints);
      elbow.add(eJoint);

      const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.037, 0.029, 0.24, 14), mm.arms);
      forearm.position.y = -0.12;
      forearm.castShadow = true;
      elbow.add(forearm);

      const wrist = new THREE.Group();
      wrist.position.set(0, -0.24, 0);
      elbow.add(wrist);

      const hand = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.09, 0.068), m.skin);
      hand.position.y = -0.045;
      hand.castShadow = true;
      wrist.add(hand);

      const handContact = new THREE.Object3D();
      handContact.position.set(0, -0.09, 0);
      wrist.add(handContact);

      const palmContact = new THREE.Object3D();
      palmContact.position.set(0, -0.045, -0.035);
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

    // PERNAS (Esquerda +X, Direita -X)
    const buildLeg = (sideSign) => {
      const hip = new THREE.Group();
      hip.position.set(sideSign * 0.095, -0.04, 0);
      this.pelvis.add(hip);

      const shortLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.062, 0.16, 14), m.shorts);
      shortLeg.position.y = -0.08;
      shortLeg.castShadow = true;
      hip.add(shortLeg);

      const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.064, 0.052, 0.26, 14), mm.quads);
      thigh.position.y = -0.27;
      thigh.castShadow = true;
      hip.add(thigh);

      const hamStrip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.22, 0.03), mm.hamstrings);
      hamStrip.position.set(0, -0.27, -0.045);
      hip.add(hamStrip);

      const knee = new THREE.Group();
      knee.position.set(0, -0.41, 0);
      hip.add(knee);

      const kneeJoint = new THREE.Mesh(new THREE.SphereGeometry(0.05, 14, 12), m.joints);
      knee.add(kneeJoint);

      const kneeFrontContact = new THREE.Object3D();
      kneeFrontContact.position.set(0, -0.01, 0.05);
      knee.add(kneeFrontContact);

      const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.037, 0.39, 14), mm.calves);
      shin.position.y = -0.20;
      shin.castShadow = true;
      knee.add(shin);

      const ankle = new THREE.Group();
      ankle.position.set(0, -0.40, 0);
      knee.add(ankle);

      const ankleJoint = new THREE.Mesh(new THREE.SphereGeometry(0.036, 12, 10), m.joints);
      ankle.add(ankleJoint);

      const shoeUpper = new THREE.Mesh(new THREE.BoxGeometry(0.088, 0.062, 0.19), m.shoe);
      shoeUpper.position.set(0, -0.035, 0.045);
      shoeUpper.castShadow = true;
      ankle.add(shoeUpper);

      const shoeSole = new THREE.Mesh(new THREE.BoxGeometry(0.094, 0.022, 0.205), m.shoeAccent);
      shoeSole.position.set(0, -0.068, 0.045);
      ankle.add(shoeSole);

      const heelContact = new THREE.Object3D();
      heelContact.position.set(0, -0.079, -0.04);
      ankle.add(heelContact);

      const toeContact = new THREE.Object3D();
      toeContact.position.set(0, -0.079, 0.14);
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

    // Marcadores traseiros para apoio supino (costas/ombros/pelve)
    this.backPelvisContact = new THREE.Object3D();
    this.backPelvisContact.position.set(0, 0, -0.09);
    this.pelvis.add(this.backPelvisContact);

    this.backChestContact = new THREE.Object3D();
    this.backChestContact.position.set(0, 0.14, -0.105);
    this.chest.add(this.backChestContact);

    this.sideElbowContactL = new THREE.Object3D();
    this.sideElbowContactL.position.set(0.038, 0, 0);
    this.elbowL.add(this.sideElbowContactL);

    this.sideElbowContactR = new THREE.Object3D();
    this.sideElbowContactR.position.set(-0.038, 0, 0);
    this.elbowR.add(this.sideElbowContactR);

    this.sideForearmContactL = new THREE.Object3D();
    this.sideForearmContactL.position.set(0, -0.12, -0.038);
    this.elbowL.add(this.sideForearmContactL);

    this.sideForearmContactR = new THREE.Object3D();
    this.sideForearmContactR.position.set(0, -0.12, -0.038);
    this.elbowR.add(this.sideForearmContactR);

    this.sideAnkleContactL = new THREE.Object3D();
    this.sideAnkleContactL.position.set(0.047, -0.068, 0.045);
    this.ankleL.add(this.sideAnkleContactL);

    this.sideAnkleContactR = new THREE.Object3D();
    this.sideAnkleContactR.position.set(-0.047, -0.068, 0.045);
    this.ankleR.add(this.sideAnkleContactR);

    this.allJoints = [
      this.pelvis, this.spine, this.chest, this.neck, this.head,
      this.shoulderL, this.elbowL, this.wristL,
      this.shoulderR, this.elbowR, this.wristR,
      this.hipL, this.kneeL, this.ankleL,
      this.hipR, this.kneeR, this.ankleR
    ];
  }

  setExercise({ anim, prop, defaultCamera, muscles = [], speedKmh = 4.5, incline = 0 }) {
    const changedAnim = this.animId !== anim;
    this.animId = anim || 'squat';
    this.activeMuscles = muscles || [];
    this.treadmillSpeedKmh = speedKmh || 4.5;
    this.treadmillIncline = incline || 0;

    if (changedAnim) {
      this.simTime = 0;
    }

    this.propMat.visible = prop === 'mat';
    this.propWall.visible = prop === 'wall';
    this.propPost.visible = prop === 'doorframe';
    this.propChair.visible = prop === 'chair';
    this.propTreadmill.visible = prop === 'treadmill';

    if (prop === 'treadmill') {
      // Inclinação visual sutil da esteira (0–1% = 0 a ~1.5° visual legível)
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
    this.activeSide = side === 'left' ? 'left' : 'right';
  }

  setPlaying(playing) {
    this.playing = Boolean(playing);
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

  updateMuscleHighlights(nowSec) {
    const pulse = 0.35 + 0.25 * Math.sin(nowSec * 4.5);
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

  applyPose(t) {
    this.resetPose();
    const isLeft = this.activeSide === 'left';
    const sgn = isLeft ? 1 : -1;

    // Helpers de oscilação suave (0..1 e -1..1)
    const wave01 = (freq = 1.0, phase = 0) => 0.5 - 0.5 * Math.cos(t * freq + phase);
    const wave11 = (freq = 1.0, phase = 0) => Math.sin(t * freq + phase);

    switch (this.animId) {
      case 'ankle_rotation': {
        const leg = isLeft
          ? { hip: this.hipL, knee: this.kneeL, ankle: this.ankleL }
          : { hip: this.hipR, knee: this.kneeR, ankle: this.ankleR };
        const standSupport = isLeft
          ? [this.heelContactR, this.toeContactR]
          : [this.heelContactL, this.toeContactL];

        leg.hip.rotation.x = -0.32;
        leg.knee.rotation.x = 0.22;
        leg.ankle.rotation.x = 0.28 + 0.28 * Math.sin(t * 3.6);
        leg.ankle.rotation.y = 0.35 * Math.cos(t * 3.6);
        leg.ankle.rotation.z = 0.18 * Math.sin(t * 3.6);
        this.shoulderL.rotation.z = 0.18;
        this.shoulderR.rotation.z = -0.18;
        this.snapToSupport(0, standSupport);
        break;
      }

      case 'hip_rotation': {
        const ang = t * 2.4;
        this.pelvis.position.x = 0.09 * Math.cos(ang);
        this.pelvis.position.z = 0.08 * Math.sin(ang);
        this.pelvis.rotation.z = -0.12 * Math.cos(ang);
        this.pelvis.rotation.x = 0.1 * Math.sin(ang);
        this.spine.rotation.z = 0.1 * Math.cos(ang);
        this.spine.rotation.x = -0.08 * Math.sin(ang);
        // Mãos na cintura
        this.shoulderL.rotation.z = 0.45;
        this.elbowL.rotation.x = -0.3;
        this.elbowL.rotation.z = -0.75;
        this.shoulderR.rotation.z = -0.45;
        this.elbowR.rotation.x = -0.3;
        this.elbowR.rotation.z = 0.75;
        this.hipL.rotation.z = 0.12;
        this.hipR.rotation.z = -0.12;
        this.snapToSupport(0, [this.heelContactL, this.heelContactR]);
        break;
      }

      case 'leg_swing': {
        const swing = 0.68 * wave11(2.8);
        const leg = isLeft ? { hip: this.hipL, knee: this.kneeL } : { hip: this.hipR, knee: this.kneeR };
        const supportMarkers = isLeft ? [this.heelContactR, this.toeContactR] : [this.heelContactL, this.toeContactL];
        leg.hip.rotation.x = swing;
        leg.knee.rotation.x = 0.08;
        this.shoulderL.rotation.z = 0.32;
        this.shoulderR.rotation.z = -0.32;
        this.shoulderL.rotation.x = -swing * 0.35;
        this.shoulderR.rotation.x = swing * 0.35;
        this.snapToSupport(0, supportMarkers);
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
        this.snapToSupport(0, [this.heelContactL, this.heelContactR]);
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

        // Braços alternando em 90 graus
        this.elbowL.rotation.x = -1.3;
        this.elbowR.rotation.x = -1.3;
        this.shoulderL.rotation.x = -0.75 * liftR + 0.25 * liftL;
        this.shoulderR.rotation.x = -0.75 * liftL + 0.25 * liftR;

        this.snapToSupport(0, [this.toeContactL, this.toeContactR]);
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
        const bounce = isJog ? Math.abs(Math.sin(p)) * 0.035 : 0;
        this.snapToSupport(TREADMILL_BELT_Y + bounce, [this.toeContactL, this.heelContactL, this.toeContactR, this.heelContactR]);
        break;
      }

      case 'squat':
      case 'chair_squat': {
        const d = wave01(2.2);
        this.hipL.rotation.x = -1.48 * d;
        this.hipR.rotation.x = -1.48 * d;
        this.hipL.rotation.z = 0.1;
        this.hipR.rotation.z = -0.1;
        this.kneeL.rotation.x = 1.62 * d;
        this.kneeR.rotation.x = 1.62 * d;
        this.ankleL.rotation.x = -0.25 * d;
        this.ankleR.rotation.x = -0.25 * d;
        this.spine.rotation.x = 0.34 * d;
        // Braços estendem à frente durante a descida
        this.shoulderL.rotation.x = -1.25 * d - 0.15;
        this.shoulderR.rotation.x = -1.25 * d - 0.15;
        this.elbowL.rotation.x = -0.35 + 0.25 * d;
        this.elbowR.rotation.x = -0.35 + 0.25 * d;

        if (this.animId === 'chair_squat') {
          this.charRoot.position.z = -0.04;
        }
        this.snapToSupport(0, [this.heelContactL, this.heelContactR, this.toeContactL, this.toeContactR]);
        break;
      }

      case 'wall_pushup': {
        const press = wave01(2.4); // 0 = estendido longe da parede, 1 = peito perto da parede
        const lean = 0.26 + 0.18 * press;
        this.charRoot.position.z = -0.02;
        this.pelvis.rotation.x = lean;
        this.ankleL.rotation.x = -lean * 0.85;
        this.ankleR.rotation.x = -lean * 0.85;
        this.hipL.rotation.z = 0.06;
        this.hipR.rotation.z = -0.06;

        // Braços apontam para a parede (+Z), cotovelos flexionam durante a descida
        this.shoulderL.rotation.x = -1.45 - 0.25 * press;
        this.shoulderR.rotation.x = -1.45 - 0.25 * press;
        this.shoulderL.rotation.z = 0.16 * press;
        this.shoulderR.rotation.z = -0.16 * press;
        this.elbowL.rotation.x = -0.12 - 1.25 * press;
        this.elbowR.rotation.x = -0.12 - 1.25 * press;
        this.wristL.rotation.x = -0.9 + 0.3 * press;
        this.wristR.rotation.x = -0.9 + 0.3 * press;

        this.snapToSupport(0, [this.toeContactL, this.toeContactR]);
        break;
      }

      case 'glute_bridge': {
        const lift = wave01(2.1);
        // Deitado de costas no tapete (pelve rotacionada -90° em X)
        this.pelvis.rotation.x = -Math.PI / 2 - 0.36 * lift;
        this.spine.rotation.x = 0.36 * lift; // Mantém parte superior das costas apoiada
        this.hipL.rotation.x = -0.95 + 0.56 * lift;
        this.hipR.rotation.x = -0.95 + 0.56 * lift;
        this.kneeL.rotation.x = 1.9 - 0.42 * lift;
        this.kneeR.rotation.x = 1.9 - 0.42 * lift;
        this.ankleL.rotation.x = 0.42;
        this.ankleR.rotation.x = 0.42;
        this.shoulderL.rotation.z = 0.22;
        this.shoulderR.rotation.z = -0.22;
        this.charRoot.position.z = -0.22;
        this.snapToSupport(MAT_TOP_Y, [this.backChestContact, this.heelContactL, this.heelContactR]);
        break;
      }

      case 'bird_dog': {
        // Ciclo de 2 tempos: estende lado ativo (ou alterna)
        const cycle = (t * 0.9) % 2;
        const activeLeftArm = cycle < 1;
        const ext = Math.sin(Math.min(1, (cycle % 1)) * Math.PI);

        // Quatro apoios: peito voltado para o chão (+90° em X)
        this.pelvis.rotation.x = Math.PI / 2;
        this.neck.rotation.x = -0.55;

        // Posição neutra de quatro apoios
        this.shoulderL.rotation.x = -Math.PI / 2;
        this.shoulderR.rotation.x = -Math.PI / 2;
        this.hipL.rotation.x = -Math.PI / 2;
        this.hipR.rotation.x = -Math.PI / 2;
        this.kneeL.rotation.x = Math.PI / 2;
        this.kneeR.rotation.x = Math.PI / 2;

        if (activeLeftArm) {
          // Estende braço esquerdo à frente + perna direita para trás
          this.shoulderL.rotation.x = -Math.PI / 2 - (Math.PI / 2) * ext;
          this.hipR.rotation.x = -Math.PI / 2 + (Math.PI / 2) * ext;
          this.kneeR.rotation.x = (Math.PI / 2) * (1 - ext);
          this.snapToSupport(MAT_TOP_Y, [this.handContactR, this.kneeContactL]);
        } else {
          // Estende braço direito à frente + perna esquerda para trás
          this.shoulderR.rotation.x = -Math.PI / 2 - (Math.PI / 2) * ext;
          this.hipL.rotation.x = -Math.PI / 2 + (Math.PI / 2) * ext;
          this.kneeL.rotation.x = (Math.PI / 2) * (1 - ext);
          this.snapToSupport(MAT_TOP_Y, [this.handContactL, this.kneeContactR]);
        }
        break;
      }

      case 'dead_bug': {
        const cycle = (t * 0.95) % 2;
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
        this.snapToSupport(MAT_TOP_Y, [this.backPelvisContact, this.backChestContact]);
        break;
      }

      case 'knee_plank': {
        const breath = 0.015 * Math.sin(t * 2.5);
        // Corpo inclinado: ombros mais altos que joelhos (PI/2 - 0.32)
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

        this.snapToSupport(MAT_TOP_Y, [
          this.handContactL, this.handContactR,
          this.palmContactL, this.palmContactR,
          this.kneeContactL, this.kneeContactR
        ]);
        break;
      }

      case 'crunch': {
        const up = wave01(2.4);
        this.pelvis.rotation.x = -Math.PI / 2;
        this.hipL.rotation.x = -0.95;
        this.hipR.rotation.x = -0.95;
        this.kneeL.rotation.x = 1.85;
        this.kneeR.rotation.x = 1.85;
        this.ankleL.rotation.x = 0.45;
        this.ankleR.rotation.x = 0.45;

        this.spine.rotation.x = 0.52 * up;
        this.neck.rotation.x = 0.18 * up;
        // Mãos atrás da cabeça
        this.shoulderL.rotation.x = -2.25;
        this.shoulderL.rotation.z = 0.65;
        this.elbowL.rotation.x = -1.7;
        this.shoulderR.rotation.x = -2.25;
        this.shoulderR.rotation.z = -0.65;
        this.elbowR.rotation.x = -1.7;

        this.charRoot.position.z = -0.18;
        this.snapToSupport(MAT_TOP_Y, [this.backPelvisContact, this.heelContactL, this.heelContactR]);
        break;
      }

      case 'side_plank': {
        const breath = 0.012 * Math.sin(t * 2.5);
        const tilt = 0.177;
        if (!isLeft) {
          // Prancha lateral direita (ombro e antebraço direito apoiados)
          this.pelvis.rotation.z = Math.PI / 2 - tilt + breath;
          this.shoulderR.rotation.z = -(Math.PI / 2 - tilt);
          this.elbowR.rotation.x = -Math.PI / 2;
          this.shoulderL.rotation.z = 0.24;
          this.elbowL.rotation.x = -0.65;
          this.snapToSupport(MAT_TOP_Y, [this.sideForearmContactR, this.sideAnkleContactR]);
        } else {
          // Prancha lateral esquerda (ombro e antebraço esquerdo apoiados)
          this.pelvis.rotation.z = -(Math.PI / 2 - tilt + breath);
          this.shoulderL.rotation.z = Math.PI / 2 - tilt;
          this.elbowL.rotation.x = -Math.PI / 2;
          this.shoulderR.rotation.z = -0.24;
          this.elbowR.rotation.x = -0.65;
          this.snapToSupport(MAT_TOP_Y, [this.sideForearmContactL, this.sideAnkleContactL]);
        }
        break;
      }

      case 'lateral_leg_raise': {
        const lift = wave01(2.4);
        const legHip = isLeft ? this.hipL : this.hipR;
        const supportMarkers = isLeft ? [this.heelContactR, this.toeContactR] : [this.heelContactL, this.toeContactL];
        legHip.rotation.z = sgn * (0.06 + 0.68 * lift);
        this.shoulderL.rotation.z = 0.55;
        this.shoulderR.rotation.z = -0.55;
        this.snapToSupport(0, supportMarkers);
        break;
      }

      case 'calf_raise': {
        const rise = wave01(2.6);
        this.ankleL.rotation.x = 0.45 * rise;
        this.ankleR.rotation.x = 0.45 * rise;
        this.hipL.rotation.z = 0.05;
        this.hipR.rotation.z = -0.05;
        this.shoulderL.rotation.z = 0.12;
        this.shoulderR.rotation.z = -0.12;
        this.snapToSupport(0, [this.toeContactL, this.toeContactR]);
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
        this.snapToSupport(0, [this.toeContactL, this.toeContactR]);
        break;
      }

      case 'torso_twist': {
        const twist = 0.58 * wave11(2.5);
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
        this.snapToSupport(0, [this.heelContactL, this.heelContactR]);
        break;
      }

      case 'lateral_arm_raise': {
        const raise = wave01(2.2);
        const armAngle = 0.12 + 1.42 * raise;
        this.shoulderL.rotation.z = armAngle;
        this.shoulderR.rotation.z = -armAngle;
        this.elbowL.rotation.x = -0.14;
        this.elbowR.rotation.x = -0.14;
        this.hipL.rotation.z = 0.06;
        this.hipR.rotation.z = -0.06;
        this.snapToSupport(0, [this.heelContactL, this.heelContactR]);
        break;
      }

      case 'quad_stretch': {
        const pulse = 0.05 * Math.sin(t * 2.0);
        const leg = isLeft ? { hip: this.hipL, knee: this.kneeL } : { hip: this.hipR, knee: this.kneeR };
        const arm = isLeft
          ? { shoulder: this.shoulderL, elbow: this.elbowL, zSign: 1 }
          : { shoulder: this.shoulderR, elbow: this.elbowR, zSign: -1 };
        const oppArm = isLeft ? this.shoulderR : this.shoulderL;
        const supportMarkers = isLeft ? [this.heelContactR, this.toeContactR] : [this.heelContactL, this.toeContactL];

        leg.hip.rotation.x = 0.14 + pulse;
        leg.knee.rotation.x = 2.15 + pulse;
        arm.shoulder.rotation.x = 0.52;
        arm.shoulder.rotation.z = arm.zSign * 0.12;
        arm.elbow.rotation.x = -0.35;
        oppArm.rotation.z = -arm.zSign * 0.28;
        this.snapToSupport(0, supportMarkers);
        break;
      }

      case 'hamstring_stretch': {
        const pulse = 0.04 * Math.sin(t * 1.8);
        const frontLeg = isLeft
          ? { hip: this.hipL, knee: this.kneeL, ankle: this.ankleL }
          : { hip: this.hipR, knee: this.kneeR, ankle: this.ankleR };
        const backLeg = isLeft
          ? { hip: this.hipR, knee: this.kneeR, ankle: this.ankleR }
          : { hip: this.hipL, knee: this.kneeL, ankle: this.ankleL };

        frontLeg.hip.rotation.x = -0.58;
        frontLeg.knee.rotation.x = 0.05;
        frontLeg.ankle.rotation.x = -0.25;

        backLeg.hip.rotation.x = 0.25;
        backLeg.knee.rotation.x = 0.42;

        this.spine.rotation.x = 0.65 + pulse;
        this.shoulderL.rotation.x = -0.55;
        this.shoulderR.rotation.x = -0.55;
        this.snapToSupport(0, [this.heelContactL, this.heelContactR]);
        break;
      }

      case 'calf_stretch': {
        const pulse = 0.04 * Math.sin(t * 1.8);
        const backLeg = isLeft
          ? { hip: this.hipL, knee: this.kneeL, ankle: this.ankleL }
          : { hip: this.hipR, knee: this.kneeR, ankle: this.ankleR };
        const frontLeg = isLeft
          ? { hip: this.hipR, knee: this.kneeR, ankle: this.ankleR }
          : { hip: this.hipL, knee: this.kneeL, ankle: this.ankleL };

        frontLeg.hip.rotation.x = -0.62 - pulse;
        frontLeg.knee.rotation.x = 0.72 + pulse;
        frontLeg.ankle.rotation.x = -0.12;

        backLeg.hip.rotation.x = 0.46;
        backLeg.knee.rotation.x = 0.04;
        backLeg.ankle.rotation.x = -0.45;

        this.spine.rotation.x = 0.12;
        this.shoulderL.rotation.x = -0.25;
        this.shoulderR.rotation.x = -0.25;
        this.snapToSupport(0, [this.heelContactL, this.heelContactR, this.toeContactL, this.toeContactR]);
        break;
      }

      case 'hip_flexor_stretch': {
        const pulse = 0.04 * Math.sin(t * 1.8);
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
        this.snapToSupport(MAT_TOP_Y, [backLeg.kneeContact, frontLeg.heel]);
        break;
      }

      case 'chest_stretch': {
        const pulse = 0.05 * Math.sin(t * 1.8);
        this.propPost.position.x = isLeft ? 1.48 : 0;
        const arm = isLeft ? { sh: this.shoulderL, z: 1 } : { sh: this.shoulderR, z: -1 };
        const other = isLeft ? { sh: this.shoulderR, z: -1 } : { sh: this.shoulderL, z: 1 };

        arm.sh.rotation.z = arm.z * 1.54;
        arm.sh.rotation.x = 0.25 + pulse;
        other.sh.rotation.z = other.z * 0.16;
        this.spine.rotation.y = arm.z * (-0.34 - pulse);
        this.hipL.rotation.z = 0.08;
        this.hipR.rotation.z = -0.08;
        this.snapToSupport(0, [this.heelContactL, this.heelContactR]);
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
        this.snapToSupport(0, [this.heelContactL, this.heelContactR]);
        break;
      }
    }
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

    this.applyPose(this.simTime);
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
    this.renderer?.dispose();
  }
}
