import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { PhoneCall, Zap, ShieldAlert, Camera, RotateCcw, Users, CheckCircle2 } from 'lucide-react';
import { BYSTANDERS_DATA } from '../data/anatomyDatabase';

/**
 * src/components/Scene3DViewport.jsx
 * זירת תאונה תלת-ממדית אינטראקטיבית מלאה באמצעות Three.js טהור בתוך useEffect:
 * - כביש לילה עירוני, רכב פגוע עם פנסים, מהבהבי מצוקה ורסיסי זכוכית
 * - פצוע ראשי עם נשימה חיה ושלולית דם דינמית המתרחבת לפי איבוד הדם
 * - 3 עוברי אורח אינטראקטיביים (Raycaster): הזעקת מד"א 101, הבאת AED, הרחקת סקרנים
 */
export default function Scene3DViewport({
  gender,
  bodyRegionId,
  physiologyRef,
  interventionsRef,
  bystanders,
  onActivateBystander,
  expanded,
  onToggleExpand,
}) {
  const mountRef = useRef(null);
  const cameraTargetPresetRef = useRef('overview');
  const bystandersRef = useRef(bystanders);
  const onActivateRef = useRef(onActivateBystander);

  const [hoveredId, setHoveredId] = useState(null);
  const [cameraPreset, setCameraPreset] = useState('overview');
  const [projectedLabels, setProjectedLabels] = useState({});

  useEffect(() => {
    bystandersRef.current = bystanders;
  }, [bystanders]);

  useEffect(() => {
    onActivateRef.current = onActivateBystander;
  }, [onActivateBystander]);

  const setPreset = (preset) => {
    setCameraPreset(preset);
    cameraTargetPresetRef.current = preset;
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070c18);
    scene.fog = new THREE.FogExp2(0x070c18, 0.036);

    const width = Math.max(280, container.clientWidth);
    const height = Math.max(200, container.clientHeight);
    const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 100);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 2. Lighting (Streetlamp + Moonlight + Hazard Glow)
    const ambient = new THREE.AmbientLight(0xa3c0f0, 0.92);
    scene.add(ambient);

    const moonLight = new THREE.DirectionalLight(0xb8d4ff, 1.05);
    moonLight.position.set(10, 16, 10);
    moonLight.castShadow = true;
    moonLight.shadow.mapSize.width = 1024;
    moonLight.shadow.mapSize.height = 1024;
    moonLight.shadow.camera.near = 1;
    moonLight.shadow.camera.far = 40;
    moonLight.shadow.camera.left = -14;
    moonLight.shadow.camera.right = 14;
    moonLight.shadow.camera.top = 14;
    moonLight.shadow.camera.bottom = -14;
    scene.add(moonLight);

    const streetSpot = new THREE.SpotLight(0xffe1a8, 32, 26, Math.PI / 3.4, 0.55, 1.3);
    streetSpot.position.set(-4.5, 7.6, -3.4);
    streetSpot.target.position.set(0.5, 0, 0.5);
    streetSpot.castShadow = true;
    scene.add(streetSpot);
    scene.add(streetSpot.target);

    // Car headlight warm spill
    const headLightSpot = new THREE.SpotLight(0xfff4d6, 18, 18, Math.PI / 4.2, 0.6, 1.4);
    headLightSpot.position.set(-1.3, 0.9, -1.35);
    headLightSpot.target.position.set(2.8, 0, -2.5);
    scene.add(headLightSpot);
    scene.add(headLightSpot.target);

    // Blinking hazard amber point light
    const hazardPoint = new THREE.PointLight(0xff8c00, 3.2, 7.5);
    hazardPoint.position.set(-1.5, 1.0, -0.5);
    scene.add(hazardPoint);

    // 3. Road, Sidewalks, Curb & Streetlamp
    const roadGeo = new THREE.PlaneGeometry(36, 12);
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x1a1f2c, roughness: 0.88, metalness: 0.08 });
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.rotation.x = -Math.PI / 2;
    road.receiveShadow = true;
    scene.add(road);

    // Sidewalks
    const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0x2d3546, roughness: 0.92 });
    const sidewalkBack = new THREE.Mesh(new THREE.BoxGeometry(36, 0.22, 6), sidewalkMat);
    sidewalkBack.position.set(0, 0.11, -7.8);
    sidewalkBack.receiveShadow = true;
    scene.add(sidewalkBack);

    const sidewalkFront = new THREE.Mesh(new THREE.BoxGeometry(36, 0.22, 6), sidewalkMat);
    sidewalkFront.position.set(0, 0.11, 7.8);
    sidewalkFront.receiveShadow = true;
    scene.add(sidewalkFront);

    // Dashed road lane markings
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xdbe3f0 });
    for (let x = -14; x <= 14; x += 3.2) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.14), lineMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(x, 0.015, 0);
      scene.add(dash);
    }

    // Streetlamp pole
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.7, roughness: 0.35 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.15, 7.8, 12), poleMat);
    pole.position.set(-5.2, 3.9, -5.2);
    pole.castShadow = true;
    scene.add(pole);
    const lampArm = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.14), poleMat);
    lampArm.position.set(-4.5, 7.75, -4.7);
    lampArm.rotation.y = -0.5;
    scene.add(lampArm);
    const lampBulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xffe8b6 })
    );
    lampBulb.position.set(-4.35, 7.58, -4.2);
    scene.add(lampBulb);

    // Background urban clinic/building (where AED runner goes!)
    const building = new THREE.Mesh(
      new THREE.BoxGeometry(7.5, 4.6, 3.4),
      new THREE.MeshStandardMaterial({ color: 0x162033, roughness: 0.85 })
    );
    building.position.set(5.6, 2.3, -8.5);
    scene.add(building);

    // Lit AED Green Sign on Building
    const aedSign = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.65, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x059669, emissiveIntensity: 0.75 })
    );
    aedSign.position.set(4.6, 2.5, -6.75);
    scene.add(aedSign);

    // 4. Crashed Vehicle (Detailed Low-Poly Stylized Sedan)
    const carGroup = new THREE.Group();
    carGroup.position.set(-2.9, 0, -1.75);
    carGroup.rotation.y = 0.24;

    const carBodyMat = new THREE.MeshStandardMaterial({ color: 0x334e70, metalness: 0.55, roughness: 0.35 });
    const darkGlassMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.85, roughness: 0.12 });
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x111318, roughness: 0.9 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.2 });

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.72, 1.82), carBodyMat);
    chassis.position.set(0, 0.62, 0);
    chassis.castShadow = true;
    chassis.receiveShadow = true;
    carGroup.add(chassis);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.64, 1.56), darkGlassMat);
    cabin.position.set(-0.22, 1.24, 0);
    cabin.castShadow = true;
    carGroup.add(cabin);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 1.48), carBodyMat);
    roof.position.set(-0.22, 1.58, 0);
    carGroup.add(roof);

    // Open passenger/driver door angled outward near victim
    const openDoor = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.66, 0.1), carBodyMat);
    openDoor.position.set(0.45, 0.72, 1.32);
    openDoor.rotation.y = -0.82;
    openDoor.castShadow = true;
    carGroup.add(openDoor);

    // Wheels
    const wheelOffsets = [
      [-1.25, 0.35, 0.92],
      [1.25, 0.35, 0.92],
      [-1.25, 0.35, -0.92],
      [1.25, 0.35, -0.92],
    ];
    wheelOffsets.forEach(([wx, wy, wz]) => {
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.24, 18), tireMat);
      tire.rotation.x = Math.PI / 2;
      tire.position.set(wx, wy, wz);
      tire.castShadow = true;
      carGroup.add(tire);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.26, 12), rimMat);
      rim.rotation.x = Math.PI / 2;
      rim.position.set(wx, wy, wz);
      carGroup.add(rim);
    });

    // Headlights & Blinking Hazard Lights
    const headLightMat = new THREE.MeshBasicMaterial({ color: 0xfff8dc });
    const hazardMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xff7b00,
      emissiveIntensity: 1.5,
    });
    [-0.64, 0.64].forEach((z) => {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.34), headLightMat);
      hl.position.set(2.06, 0.72, z);
      carGroup.add(hl);
      const hzFront = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.18), hazardMat);
      hzFront.position.set(2.07, 0.56, z * 1.15);
      carGroup.add(hzFront);
      const hzRear = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.22), hazardMat);
      hzRear.position.set(-2.07, 0.68, z * 1.05);
      carGroup.add(hzRear);
    });
    scene.add(carGroup);

    // Scattered shattered glass shards near casualty
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0xbfe9ff,
      metalness: 0.4,
      roughness: 0.1,
      transparent: true,
      opacity: 0.72,
    });
    for (let i = 0; i < 18; i++) {
      const shard = new THREE.Mesh(new THREE.ConeGeometry(0.055 + (i % 3) * 0.02, 0.03, 3), glassMat);
      shard.position.set(
        -0.4 + Math.cos(i * 1.9) * 1.15,
        0.02,
        0.55 + Math.sin(i * 2.3) * 0.85
      );
      shard.rotation.y = i * 0.7;
      scene.add(shard);
    }

    // 5. Primary Casualty — Realistic Anatomically Sculpted Male / Female 3D Human Body
    const isFemale = gender === 'female';
    const casualtyGroup = new THREE.Group();
    casualtyGroup.position.set(0.25, 0, 1.05);
    casualtyGroup.rotation.y = -0.22;

    const skinMat = new THREE.MeshStandardMaterial({ color: 0xe6b595, roughness: 0.58 });
    const shirtMat = new THREE.MeshStandardMaterial({ color: isFemale ? 0x0d9488 : 0x2563eb, roughness: 0.78 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85 });
    const hairMat = new THREE.MeshStandardMaterial({ color: isFemale ? 0x4a2c1a : 0x261d17, roughness: 0.85 });

    // Sculpted Upper Thorax / Ribcage (broader shoulders for male, anatomical waist & bust contour for female)
    const torso = new THREE.Group();
    torso.position.set(0, 0.17, -0.05);

    const upperChest = new THREE.Mesh(
      new THREE.CylinderGeometry(isFemale ? 0.21 : 0.27, isFemale ? 0.17 : 0.22, 0.52, 18),
      shirtMat
    );
    upperChest.rotation.x = Math.PI / 2;
    upperChest.scale.set(1.25, 1.0, 0.58);
    upperChest.position.set(0, 0.02, -0.16);
    upperChest.castShadow = true;
    torso.add(upperChest);

    // Sculpted Waist & Pelvis (wider anatomical pelvic flare for female)
    const pelvis = new THREE.Mesh(
      new THREE.CylinderGeometry(isFemale ? 0.18 : 0.21, isFemale ? 0.26 : 0.23, 0.36, 18),
      pantsMat
    );
    pelvis.rotation.x = Math.PI / 2;
    pelvis.scale.set(1.25, 1.0, 0.62);
    pelvis.position.set(0, 0, 0.26);
    pelvis.castShadow = true;
    torso.add(pelvis);

    if (isFemale) {
      // Subtle anatomical thorax contour for female torso
      [-0.1, 0.1].forEach((bx) => {
        const bust = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 14), shirtMat);
        bust.scale.set(1.0, 0.75, 1.05);
        bust.position.set(bx, 0.11, -0.2);
        torso.add(bust);
      });
    }
    casualtyGroup.add(torso);

    // Neck & Sculpted Head with Jaw/Nose/Hair tailored to Male vs Female
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(isFemale ? 0.068 : 0.085, isFemale ? 0.075 : 0.095, 0.16, 14), skinMat);
    neck.rotation.x = Math.PI / 2;
    neck.position.set(0, 0.17, -0.49);
    casualtyGroup.add(neck);

    const head = new THREE.Mesh(new THREE.SphereGeometry(isFemale ? 0.175 : 0.19, 18, 18), skinMat);
    head.scale.set(0.92, 0.96, 1.12);
    head.position.set(0, 0.21, -0.69);
    head.castShadow = true;
    casualtyGroup.add(head);

    const hairCap = new THREE.Mesh(new THREE.SphereGeometry(isFemale ? 0.186 : 0.196, 16, 14, 0, Math.PI * 2, 0, Math.PI * 0.6), hairMat);
    hairCap.position.set(0, 0.22, -0.71);
    hairCap.rotation.x = -Math.PI * 0.45;
    casualtyGroup.add(hairCap);
    if (isFemale) {
      const longHair = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.34, 14), hairMat);
      longHair.rotation.x = Math.PI / 2;
      longHair.scale.set(1.1, 1, 0.45);
      longHair.position.set(0, 0.12, -0.64);
      casualtyGroup.add(longHair);
    }

    // Articulated Thighs, Knees, Calves & Feet
    const hipSpread = isFemale ? 0.175 : 0.16;
    const isLegInjury = bodyRegionId === 'thigh' || bodyRegionId === 'lowerLeg';
    const injuredLimbPivot = new THREE.Group();

    [-hipSpread, hipSpread].forEach((lx) => {
      const isRightLeg = lx > 0;
      const legGrp = new THREE.Group();
      legGrp.position.set(lx, 0.14, 0.4);
      const thigh = new THREE.Mesh(new THREE.CylinderGeometry(isFemale ? 0.115 : 0.12, 0.09, 0.54, 14), pantsMat);
      thigh.rotation.x = Math.PI / 2;
      thigh.position.set(0, 0, 0.26);
      thigh.castShadow = true;
      const knee = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 12), skinMat);
      knee.position.set(0, 0, 0.54);
      const calf = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.062, 0.52, 14), skinMat);
      calf.rotation.x = Math.PI / 2;
      calf.position.set(0, -0.01, 0.8);
      calf.castShadow = true;
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.18, 0.09), skinMat);
      foot.position.set(0, 0.04, 1.07);
      legGrp.add(thigh, knee, calf, foot);
      if (isRightLeg && isLegInjury) {
        injuredLimbPivot.position.copy(legGrp.position);
        legGrp.position.set(0, 0, 0);
        injuredLimbPivot.add(legGrp);
        casualtyGroup.add(injuredLimbPivot);
      } else {
        casualtyGroup.add(legGrp);
      }
    });

    // Left resting arm (articulated)
    const shOff = isFemale ? 0.29 : 0.35;
    const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.056, 0.78, 12), skinMat);
    leftArm.rotation.z = Math.PI / 2.25;
    leftArm.position.set(-shOff - 0.24, 0.12, -0.14);
    casualtyGroup.add(leftArm);

    // Right arm (extended outward — injured limb when arm/forearm selected!)
    const rightArmGrp = new THREE.Group();
    const upperA = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.068, 0.42, 12), skinMat);
    upperA.rotation.z = -Math.PI / 2;
    upperA.position.set(0.21, 0, 0.04);
    const forearmA = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.052, 0.44, 12), skinMat);
    forearmA.rotation.z = -Math.PI / 2;
    forearmA.position.set(0.61, 0, 0.14);
    forearmA.rotation.y = -0.24;
    const handA = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.045, 0.09), skinMat);
    handA.position.set(0.86, 0, 0.21);
    rightArmGrp.add(upperA, forearmA, handA);

    if (!isLegInjury) {
      injuredLimbPivot.position.set(shOff, 0.16, -0.24);
      injuredLimbPivot.add(rightArmGrp);
      casualtyGroup.add(injuredLimbPivot);
    } else {
      rightArmGrp.position.set(shOff, 0.16, -0.24);
      casualtyGroup.add(rightArmGrp);
    }

    // Visible 3D Wound, Gauze & CAT positioned dynamically on the chosen Body Region!
    const isCentralInjury = bodyRegionId === 'neck' || bodyRegionId === 'chest' || bodyRegionId === 'abdomen';
    const woundPos =
      bodyRegionId === 'thigh'
        ? [0, 0.11, 0.3]
        : bodyRegionId === 'lowerLeg'
        ? [0, 0.08, 0.76]
        : bodyRegionId === 'upperArm'
        ? [0.25, 0.07, 0.05]
        : bodyRegionId === 'neck'
        ? [0.06, 0.24, -0.49]
        : bodyRegionId === 'chest'
        ? [0.1, 0.3, -0.22]
        : bodyRegionId === 'abdomen'
        ? [0.02, 0.28, 0.08]
        : [0.56, 0.07, 0.13];

    const catPos =
      bodyRegionId === 'thigh'
        ? [0, 0, 0.12]
        : bodyRegionId === 'lowerLeg'
        ? [0, 0, 0.58]
        : bodyRegionId === 'upperArm'
        ? [0.1, 0, 0.02]
        : [0.34, 0, 0.08];

    const woundParent = isCentralInjury ? casualtyGroup : injuredLimbPivot;

    const woundMark = new THREE.Mesh(
      new THREE.BoxGeometry(0.17, 0.04, 0.09),
      new THREE.MeshStandardMaterial({ color: 0xb91c1c, emissive: 0x7f1d1d, emissiveIntensity: 0.48 })
    );
    woundMark.position.set(...woundPos);
    woundParent.add(woundMark);

    const gauze3D = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.12, 0.18),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.9 })
    );
    gauze3D.position.set(woundPos[0], woundPos[1] - 0.01, woundPos[2]);
    gauze3D.visible = false;
    woundParent.add(gauze3D);

    const cat3D = new THREE.Mesh(
      new THREE.CylinderGeometry(isLegInjury ? 0.125 : 0.092, isLegInjury ? 0.125 : 0.092, 0.11, 14),
      new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.6 })
    );
    if (isLegInjury) cat3D.rotation.x = Math.PI / 2;
    else cat3D.rotation.z = Math.PI / 2;
    cat3D.position.set(...catPos);
    cat3D.visible = false;
    if (!isCentralInjury) injuredLimbPivot.add(cat3D);

    const injuredArmPivot = injuredLimbPivot;
    scene.add(casualtyGroup);

    // Dynamic 3D Glossy Blood Pool expanding in real time beneath injured region!
    const bloodPoolMat = new THREE.MeshStandardMaterial({
      color: 0x9b0a18,
      emissive: 0x380308,
      emissiveIntensity: 0.35,
      roughness: 0.12,
      metalness: 0.18,
      transparent: true,
      opacity: 0.92,
    });
    const bloodPool = new THREE.Mesh(new THREE.CircleGeometry(1, 32), bloodPoolMat);
    bloodPool.rotation.x = -Math.PI / 2;
    bloodPool.position.set(
      isCentralInjury ? 0.32 : isLegInjury ? 0.58 : 0.92,
      0.018,
      isCentralInjury ? 0.95 : isLegInjury ? 1.85 : 0.85
    );
    bloodPool.scale.set(0.28, 0.24, 1);
    scene.add(bloodPool);

    // 6. Deployable Scene Security Props (Warning Triangle & Traffic Cones - revealed by Bystander 3)
    const securityGroup = new THREE.Group();
    securityGroup.visible = false;
    const coneMat = new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0x7c2d12, emissiveIntensity: 0.35 });
    [
      [3.8, 0, 2.7],
      [4.9, 0, 0.7],
      [4.2, 0, -1.5],
    ].forEach(([cx, cy, cz]) => {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.62, 12), coneMat);
      cone.position.set(cx, 0.31, cz);
      cone.castShadow = true;
      securityGroup.add(cone);
    });
    const triMesh = new THREE.Mesh(
      new THREE.ConeGeometry(0.38, 0.55, 3),
      new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xdc2626, emissiveIntensity: 0.75 })
    );
    triMesh.position.set(5.4, 0.28, 1.8);
    securityGroup.add(triMesh);
    scene.add(securityGroup);

    // 7. 3D AED Kit Prop (carried & placed by Bystander 2!)
    const aedKit = new THREE.Group();
    const aedBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.14, 0.32),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0x854d0e, emissiveIntensity: 0.35, roughness: 0.35 })
    );
    const aedCross = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.02, 0.06),
      new THREE.MeshBasicMaterial({ color: 0xdc2626 })
    );
    aedCross.position.y = 0.08;
    const aedCross2 = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.02, 0.16),
      new THREE.MeshBasicMaterial({ color: 0xdc2626 })
    );
    aedCross2.position.y = 0.08;
    aedKit.add(aedBody, aedCross, aedCross2);
    aedKit.position.set(1.38, 0.08, 1.75);
    aedKit.visible = false;
    scene.add(aedKit);

    // 8. Build 3 Interactive 3D Bystanders
    function buildBystanderMesh(id, shirtHex, startPos) {
      const grp = new THREE.Group();
      grp.position.set(startPos.x, 0, startPos.z);
      grp.userData.bystanderId = id;

      const sMat = new THREE.MeshStandardMaterial({ color: shirtHex, roughness: 0.72 });
      const pMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85 });
      const hMat = new THREE.MeshStandardMaterial({ color: 0xe6b595, roughness: 0.65 });

      // Legs
      const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.08, 0.82, 10), pMat);
      legL.position.set(-0.13, 0.41, 0);
      legL.castShadow = true;
      const legR = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.08, 0.82, 10), pMat);
      legR.position.set(0.13, 0.41, 0);
      legR.castShadow = true;

      // Body
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.66, 0.28), sMat);
      body.position.set(0, 1.12, 0);
      body.castShadow = true;

      // Head
      const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 14), hMat);
      headMesh.position.set(0, 1.66, 0);
      headMesh.castShadow = true;

      // Arms (pivoted at shoulder for animation!)
      const armLPivot = new THREE.Group();
      armLPivot.position.set(-0.3, 1.38, 0);
      const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.6, 10), sMat);
      armL.position.set(0, -0.28, 0);
      armLPivot.add(armL);

      const armRPivot = new THREE.Group();
      armRPivot.position.set(0.3, 1.38, 0);
      const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.6, 10), sMat);
      armR.position.set(0, -0.28, 0);
      armRPivot.add(armR);

      // Glowing phone for Caller 101
      if (id === 'caller101') {
        const phone = new THREE.Mesh(
          new THREE.BoxGeometry(0.07, 0.14, 0.02),
          new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
        );
        phone.position.set(0, -0.58, 0.06);
        armRPivot.add(phone);
      }

      // Interactive Selection Ground Ring
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.72,
      });
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.38, 0.5, 28), ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.03;

      // Invisible generous click hitbox for super reliable raycasting
      const hitBox = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.55, 2.0, 10),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hitBox.position.y = 1.0;
      hitBox.userData.bystanderId = id;

      grp.add(legL, legR, body, headMesh, armLPivot, armRPivot, ring, hitBox);
      grp.traverse((obj) => {
        obj.userData.bystanderId = id;
      });
      scene.add(grp);

      return {
        id,
        group: grp,
        armLPivot,
        armRPivot,
        legL,
        legR,
        ring,
        ringMat,
        startPos,
        aedProgress: 0,
      };
    }

    const bystanderActors = {
      caller101: buildBystanderMesh('caller101', 0x2563eb, { x: -1.35, z: 3.1 }),
      aedRunner: buildBystanderMesh('aedRunner', 0x059669, { x: 2.85, z: -2.5 }),
      crowdController: buildBystanderMesh('crowdController', 0xd97706, { x: 3.3, z: 2.3 }),
    };

    // Face casualty initially
    Object.values(bystanderActors).forEach((actor) => {
      actor.group.lookAt(casualtyGroup.position.x, 0, casualtyGroup.position.z);
    });

    // 9. Smooth Orbit & Preset Camera State
    const camSpherical = { theta: 0.42, phi: 0.92, radius: 10.6 };
    const camTarget = new THREE.Vector3(0.4, 0.55, 0.35);
    const desiredSpherical = { ...camSpherical };
    const desiredTarget = camTarget.clone();

    const PRESETS = {
      overview: { theta: 0.42, phi: 0.92, radius: 10.6, target: new THREE.Vector3(0.4, 0.55, 0.35) },
      casualty: { theta: 0.28, phi: 0.72, radius: 4.5, target: new THREE.Vector3(0.5, 0.3, 1.0) },
      bystanders: { theta: 0.72, phi: 1.04, radius: 12.2, target: new THREE.Vector3(1.1, 0.7, 0.5) },
    };

    let isDragging = false;
    let pointerStart = { x: 0, y: 0 };
    let prevPointer = { x: 0, y: 0 };
    let manualOrbit = false;
    let lastPresetApplied = 'overview';

    const raycaster = new THREE.Raycaster();
    const mouseNdc = new THREE.Vector2();
    const clickTargets = Object.values(bystanderActors).map((a) => a.group);

    function getHitBystander(clientX, clientY) {
      const rect = renderer.domElement.getBoundingClientRect();
      mouseNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      mouseNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouseNdc, camera);
      const hits = raycaster.intersectObjects(clickTargets, true);
      if (hits.length > 0) {
        return hits[0].object.userData.bystanderId || null;
      }
      return null;
    }

    const onPointerDown = (e) => {
      isDragging = true;
      pointerStart = { x: e.clientX, y: e.clientY };
      prevPointer = { x: e.clientX, y: e.clientY };
    };

    const onPointerMove = (e) => {
      if (isDragging) {
        const dx = e.clientX - prevPointer.x;
        const dy = e.clientY - prevPointer.y;
        prevPointer = { x: e.clientX, y: e.clientY };
        if (Math.hypot(e.clientX - pointerStart.x, e.clientY - pointerStart.y) > 4) {
          manualOrbit = true;
          desiredSpherical.theta -= dx * 0.007;
          desiredSpherical.phi = Math.max(0.32, Math.min(1.38, desiredSpherical.phi - dy * 0.006));
        }
        return;
      }
      const hitId = getHitBystander(e.clientX, e.clientY);
      setHoveredId(hitId);
      renderer.domElement.style.cursor = hitId ? 'pointer' : 'grab';
    };

    const onPointerUp = (e) => {
      const moved = Math.hypot(e.clientX - pointerStart.x, e.clientY - pointerStart.y);
      isDragging = false;
      if (moved < 6) {
        const hitId = getHitBystander(e.clientX, e.clientY);
        if (hitId) {
          onActivateRef.current?.(hitId);
        }
      }
    };

    const onWheel = (e) => {
      e.preventDefault();
      manualOrbit = true;
      desiredSpherical.radius = Math.max(3.6, Math.min(16.5, desiredSpherical.radius + e.deltaY * 0.008));
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

    // ResizeObserver for crisp layout transitions (e.g., Expand/Collapse)
    const ro = new ResizeObserver(() => {
      const w = Math.max(260, container.clientWidth);
      const h = Math.max(180, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    ro.observe(container);

    // 10. Main Three.js Animation Loop
    let rafId = 0;
    let clockTime = 0;
    let lastTs = 0;
    let labelTick = 0;

    const projVec = new THREE.Vector3();

    const animate = (ts) => {
      rafId = requestAnimationFrame(animate);
      if (!lastTs) lastTs = ts;
      const dt = Math.min(0.05, (ts - lastTs) / 1000);
      lastTs = ts;
      clockTime += dt;

      // Apply camera preset change
      if (cameraTargetPresetRef.current !== lastPresetApplied) {
        lastPresetApplied = cameraTargetPresetRef.current;
        manualOrbit = false;
        const p = PRESETS[lastPresetApplied] || PRESETS.overview;
        desiredSpherical.theta = p.theta;
        desiredSpherical.phi = p.phi;
        desiredSpherical.radius = p.radius;
        desiredTarget.copy(p.target);
      }

      // Smoothly damp camera
      const damp = Math.min(1, dt * 6);
      camSpherical.theta += (desiredSpherical.theta - camSpherical.theta) * damp;
      camSpherical.phi += (desiredSpherical.phi - camSpherical.phi) * damp;
      camSpherical.radius += (desiredSpherical.radius - camSpherical.radius) * damp;
      camTarget.lerp(desiredTarget, damp);

      camera.position.set(
        camTarget.x + camSpherical.radius * Math.sin(camSpherical.phi) * Math.sin(camSpherical.theta),
        camTarget.y + camSpherical.radius * Math.cos(camSpherical.phi),
        camTarget.z + camSpherical.radius * Math.sin(camSpherical.phi) * Math.cos(camSpherical.theta)
      );
      camera.lookAt(camTarget);

      // Blinking amber car hazard lights
      const blinkOn = Math.sin(clockTime * 7.2) > 0;
      hazardMat.emissiveIntensity = blinkOn ? 2.2 : 0.12;
      hazardPoint.intensity = blinkOn ? 3.8 : 0.3;

      // Sync with live Physiology & Interventions!
      const phys = physiologyRef.current;
      const interv = interventionsRef.current;
      const byst = bystandersRef.current;

      if (phys) {
        // Chest breathing motion synced to live Respiratory Rate (RR)
        const breathHz = Math.max(0.15, phys.rr / 60);
        const breathScale = 1 + Math.sin(clockTime * Math.PI * 2 * breathHz) * 0.08;
        torso.scale.y = breathScale;

        // Dynamic blood pool grows proportionally to bloodLostMl (0..2200 mL)
        const poolBase = 0.24 + Math.min(1.35, (phys.bloodLostMl / 1600) * 1.25);
        const pulseShimmer = phys.arterialRate > 0.5 ? 1 + Math.sin(phys.pulsePhase * Math.PI * 2) * 0.035 : 1;
        bloodPool.scale.set(poolBase * pulseShimmer, poolBase * 0.85 * pulseShimmer, 1);

        // Arterial vs Venous blood pool color nuance
        if (phys.arterialRate > phys.venousRate) {
          bloodPoolMat.color.setHex(0xb80e1e);
        } else if (phys.venousRate > 0.2) {
          bloodPoolMat.color.setHex(0x630616);
        }
      }

      if (interv) {
        // Elevate injured limb in 3D when elevation is active!
        const targetLift = interv.elevated ? (isLegInjury ? -0.45 : 0.52) : 0;
        if (isLegInjury) {
          injuredArmPivot.rotation.x += (targetLift - injuredArmPivot.rotation.x) * Math.min(1, dt * 5);
        } else {
          injuredArmPivot.rotation.z += (targetLift - injuredArmPivot.rotation.z) * Math.min(1, dt * 5);
        }
        gauze3D.visible = interv.gauzeLayers > 0 || interv.personalBandageOn;
        gauze3D.material.color.setHex(interv.personalBandageOn ? 0x7c8b6a : 0xf8fafc);
        cat3D.visible = interv.catPlaced;
      }

      // Animate 3 Interactive Bystanders
      // 1. Caller 101
      const c101 = bystanderActors.caller101;
      if (byst.caller101) {
        c101.armRPivot.rotation.x += (-2.25 - c101.armRPivot.rotation.x) * Math.min(1, dt * 6);
        c101.armRPivot.rotation.z += (0.28 - c101.armRPivot.rotation.z) * Math.min(1, dt * 6);
        c101.ringMat.color.setHex(0x10b981);
      } else {
        c101.armRPivot.rotation.x = Math.sin(clockTime * 2) * 0.08;
        c101.ringMat.color.setHex(0x38bdf8);
      }

      // 2. AED Runner (sprints to clinic building, retrieves AED kit, returns to casualty!)
      const aedA = bystanderActors.aedRunner;
      if (byst.aedRunner) {
        aedA.aedProgress = Math.min(1, aedA.aedProgress + dt * 0.26);
        const p = aedA.aedProgress;
        if (p < 0.48) {
          const t = p / 0.48;
          aedA.group.position.x = THREE.MathUtils.lerp(2.85, 4.4, t);
          aedA.group.position.z = THREE.MathUtils.lerp(-2.5, -5.8, t);
          aedA.group.lookAt(4.4, 0, -6.2);
          aedA.legL.rotation.x = Math.sin(clockTime * 14) * 0.65;
          aedA.legR.rotation.x = -Math.sin(clockTime * 14) * 0.65;
        } else if (p < 0.96) {
          const t = (p - 0.48) / 0.48;
          aedA.group.position.x = THREE.MathUtils.lerp(4.4, 1.9, t);
          aedA.group.position.z = THREE.MathUtils.lerp(-5.8, 1.7, t);
          aedA.group.lookAt(1.38, 0, 1.75);
          aedA.legL.rotation.x = Math.sin(clockTime * 14) * 0.65;
          aedA.legR.rotation.x = -Math.sin(clockTime * 14) * 0.65;
        } else {
          aedA.legL.rotation.x = 0;
          aedA.legR.rotation.x = 0;
          aedA.group.lookAt(casualtyGroup.position.x, 0, casualtyGroup.position.z);
          aedKit.visible = true;
        }
        aedA.ringMat.color.setHex(0x10b981);
      } else {
        aedA.ringMat.color.setHex(0x38bdf8);
      }

      // 3. Crowd Controller & Scene Security
      const crowd = bystanderActors.crowdController;
      if (byst.crowdController) {
        securityGroup.visible = true;
        crowd.group.position.x += (4.35 - crowd.group.position.x) * Math.min(1, dt * 3);
        crowd.group.position.z += (1.1 - crowd.group.position.z) * Math.min(1, dt * 3);
        crowd.group.lookAt(8, 0, 1.1);
        crowd.armLPivot.rotation.z = -2.2 + Math.sin(clockTime * 7) * 0.42;
        crowd.armRPivot.rotation.z = 2.2 - Math.sin(clockTime * 7) * 0.42;
        crowd.ringMat.color.setHex(0x10b981);
      } else {
        crowd.armLPivot.rotation.z = -0.1;
        crowd.armRPivot.rotation.z = 0.1;
        crowd.ringMat.color.setHex(0xf59e0b);
      }

      // Subtle pulse on inactive bystander selection rings
      Object.values(bystanderActors).forEach((actor) => {
        const active = byst[actor.id];
        const s = active ? 1.0 : 1.0 + Math.sin(clockTime * 4) * 0.12;
        actor.ring.scale.set(s, s, 1);
      });

      renderer.render(scene, camera);

      // Update projected 2D HTML tag positions every ~100ms for silky UI without React spam
      labelTick += dt;
      if (labelTick >= 0.09) {
        labelTick = 0;
        const rect = renderer.domElement.getBoundingClientRect();
        const nextLabels = {};
        Object.values(bystanderActors).forEach((actor) => {
          projVec.set(actor.group.position.x, 2.18, actor.group.position.z);
          projVec.project(camera);
          if (projVec.z < 1) {
            nextLabels[actor.id] = {
              x: (projVec.x * 0.5 + 0.5) * rect.width,
              y: (-projVec.y * 0.5 + 0.5) * rect.height,
            };
          }
        });
        setProjectedLabels(nextLabels);
      }
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('wheel', onWheel);
      renderer.dispose();
    };
  }, [physiologyRef, interventionsRef, gender, bodyRegionId]);

  const icons = {
    caller101: PhoneCall,
    aedRunner: Zap,
    crowdController: ShieldAlert,
  };

  return (
    <div className={`scene3d-panel ${expanded ? 'expanded' : ''}`}>
      <div className="panel-header">
        <div className="panel-title">
          <Users size={16} className="text-sky" />
          <span>זירת תאונה תלת-ממדית (Three.js) — לחץ על עוברי האורח להפעלתם</span>
        </div>
        <div className="scene3d-header-actions">
          <button
            className={`mini-chip ${cameraPreset === 'overview' ? 'on' : ''}`}
            onClick={() => setPreset('overview')}
          >
            <Camera size={12} /> זירה מלאה
          </button>
          <button
            className={`mini-chip ${cameraPreset === 'casualty' ? 'on' : ''}`}
            onClick={() => setPreset('casualty')}
          >
            פצוע
          </button>
          <button
            className={`mini-chip ${cameraPreset === 'bystanders' ? 'on' : ''}`}
            onClick={() => setPreset('bystanders')}
          >
            עוברי אורח
          </button>
          <button className="mini-chip" onClick={onToggleExpand} title="הגדל/הקטן זירה תלת-ממדית">
            <RotateCcw size={12} /> {expanded ? 'תצוגה משולבת' : 'הרחב 3D'}
          </button>
        </div>
      </div>

      <div className="scene3d-stage">
        <div ref={mountRef} className="scene3d-canvas-host" />

        {/* Projected 3D Interactive Floating Tags above each Bystander */}
        {BYSTANDERS_DATA.map((b) => {
          const pos = projectedLabels[b.id];
          if (!pos) return null;
          const active = bystanders[b.id];
          const IconComp = icons[b.id];
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => onActivateBystander(b.id)}
              className={`bystander-3d-tag ${active ? 'activated' : ''} ${hoveredId === b.id ? 'hovered' : ''}`}
              style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
              title={b.actionDesc}
            >
              {active ? <CheckCircle2 size={12} /> : <IconComp size={12} />}
              <span>{active ? `${b.shortLabel} ✓` : b.shortLabel}</span>
            </button>
          );
        })}

        {/* Compact Bottom Legend / Quick-Activate Strip */}
        <div className="scene3d-footer-strip">
          <span className="scene3d-hint">🖱️ גרור לסיבוב מצלמה • גלגלת לזום • לחץ על דמות להפעלה:</span>
          <div className="scene3d-quick-pills">
            {BYSTANDERS_DATA.map((b) => {
              const active = bystanders[b.id];
              const IconComp = icons[b.id];
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => onActivateBystander(b.id)}
                  className={`bystander-quick-btn ${active ? 'done' : ''}`}
                >
                  <IconComp size={13} />
                  <span>{b.role}</span>
                  {active && <span className="ok-mark">✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
