import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const canvas = document.querySelector('.cyber-world');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const reveals = document.querySelectorAll('.reveal');

document.documentElement.classList.add('motion-ready');
reveals.forEach((item, index) => {
  item.style.setProperty('--reveal-delay', `${Math.min(index, 8) * 65}ms`);
});
if ('IntersectionObserver' in window && !reducedMotion.matches) {
  const observer = new IntersectionObserver((entries, currentObserver) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        currentObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  reveals.forEach((item) => observer.observe(item));
} else {
  reveals.forEach((item) => item.classList.add('is-visible'));
}

if (canvas) startCity(canvas);

function startCity(canvas) {
  const random = seededRandom(2077);
  let renderer;
  let composer;
  let frame = 0;
  let lastFrame = 0;
  const pointer = { x: 0, y: 0 };
  const cameraTarget = new THREE.Vector3(0, 4.3, -20);
  const movingDashes = [];
  const animatedNeons = [];
  let bike;

  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: false, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 700 ? 1 : 1.25));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x080b12, 1);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x080b12);
    scene.fog = new THREE.FogExp2(0x0a0e17, 0.016);

    const camera = new THREE.PerspectiveCamera(47, window.innerWidth / window.innerHeight, 0.1, 115);
    camera.position.set(0, 6.2, 20);
    camera.lookAt(cameraTarget);

    const hemisphere = new THREE.HemisphereLight(0x9bb8c7, 0x10121b, 1.55);
    scene.add(hemisphere);
    const moon = new THREE.DirectionalLight(0xb7d5df, 2.2);
    moon.position.set(-10, 22, 8);
    moon.castShadow = true;
    moon.shadow.mapSize.set(1024, 1024);
    moon.shadow.camera.left = -24;
    moon.shadow.camera.right = 24;
    moon.shadow.camera.top = 24;
    moon.shadow.camera.bottom = -10;
    moon.shadow.bias = -0.00035;
    scene.add(moon);

    const cityGlow = new THREE.PointLight(0x08d8ea, 95, 56, 1.8);
    cityGlow.position.set(-12, 10, -28);
    scene.add(cityGlow);
    const signGlow = new THREE.PointLight(0xff276f, 78, 44, 1.7);
    signGlow.position.set(11, 9, -13);
    scene.add(signGlow);

    createSkyHaze(scene);
    createStreet(scene, movingDashes);
    createBuildings(scene, random, animatedNeons);
    const taxi = createStreetFurniture(scene);
    bike = createMotorcycle(scene);
    composer = createComposer(renderer, scene, camera);

    function resize() {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const ratio = Math.min(window.devicePixelRatio || 1, width < 700 ? 1 : 1.25);
      renderer.setPixelRatio(ratio);
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
      composer.setPixelRatio(ratio);
      composer.setSize(width, height);
      composer.render();
    }

    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('pointermove', (event) => {
      pointer.x = (event.clientX / Math.max(window.innerWidth, 1) - 0.5) * 2;
      pointer.y = (event.clientY / Math.max(window.innerHeight, 1) - 0.5) * 2;
    }, { passive: true });

    function draw(time) {
      const delta = Math.min((time - lastFrame) / 1000 || 0.016, 0.035);
      lastFrame = time;
      const t = time * 0.001;

      camera.position.x += (pointer.x * 0.62 + Math.sin(t * 0.12) * 0.12 - camera.position.x) * 0.018;
      camera.position.y += (6.2 - pointer.y * 0.18 + Math.sin(t * 0.16) * 0.035 - camera.position.y) * 0.018;
      cameraTarget.x += (pointer.x * 0.3 - cameraTarget.x) * 0.018;
      cameraTarget.y += (4.3 - pointer.y * 0.08 - cameraTarget.y) * 0.018;
      camera.lookAt(cameraTarget);

      movingDashes.forEach((dash) => {
        dash.position.z += delta * dash.userData.speed;
        if (dash.position.z > 17) dash.position.z -= 104;
      });
      animatedNeons.forEach((neon, index) => {
        neon.intensity = neon.userData.base + Math.max(0, Math.sin(t * neon.userData.rate + index * 1.9)) * neon.userData.depth;
      });
      taxi.position.z += delta * 1.5;
      if (taxi.position.z > 12) taxi.position.z = -53;
      taxi.userData.headlight.position.z = taxi.position.z + 3.5;
      bike.root.position.y = -0.02 + Math.sin(t * 1.35) * 0.018;
      bike.root.rotation.z = Math.sin(t * 0.75) * 0.008;

      composer.render();
      if (!reducedMotion.matches && !document.hidden) frame = window.requestAnimationFrame(draw);
    }

    function animate() {
      window.cancelAnimationFrame(frame);
      if (reducedMotion.matches || document.hidden) {
        camera.position.set(0, 6.2, 20);
        cameraTarget.set(0, 4.3, -20);
        camera.lookAt(cameraTarget);
        composer.render();
        return;
      }
      lastFrame = performance.now();
      frame = window.requestAnimationFrame(draw);
    }

    document.addEventListener('visibilitychange', animate);
    reducedMotion.addEventListener?.('change', animate);
    resize();
    animate();
    canvas.dataset.ready = 'true';
  } catch (error) {
    window.cancelAnimationFrame(frame);
    renderer?.dispose();
    console.error('Cyber Sort 3D scene failed to start.', error);
  }
}

function createComposer(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.72, 0.68, 0.2);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  return composer;
}

function createSkyHaze(scene) {
  const geometry = new THREE.PlaneGeometry(140, 72);
  const material = new THREE.ShaderMaterial({
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `
      varying vec2 vUv;
      void main(){
        vec3 upper=vec3(0.025,0.04,0.075);
        vec3 horizon=vec3(0.11,0.23,0.28);
        vec3 color=mix(upper,horizon,pow(1.0-vUv.y,2.2));
        float cyanGlow=exp(-pow((vUv.x-.34)*5.2,2.0))*exp(-pow((vUv.y-.43)*3.2,2.0));
        float pinkGlow=exp(-pow((vUv.x-.76)*4.3,2.0))*exp(-pow((vUv.y-.49)*3.6,2.0));
        color+=vec3(.015,.22,.28)*cyanGlow*.7;
        color+=vec3(.28,.018,.12)*pinkGlow*.55;
        gl_FragColor=vec4(color,1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(geometry, material);
  sky.position.set(0, 19, -67);
  scene.add(sky);
}

function createStreet(scene, movingDashes) {
  const asphalt = new THREE.MeshStandardMaterial({ color: 0x171b22, roughness: 0.34, metalness: 0.55, emissive: 0x070a0e, emissiveIntensity: 0.26 });
  const concrete = new THREE.MeshStandardMaterial({ color: 0x242830, roughness: 0.86, metalness: 0.08 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(180, 160), concrete);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.18, -29);
  ground.receiveShadow = true;
  scene.add(ground);

  const road = new THREE.Mesh(new THREE.PlaneGeometry(10.2, 132), asphalt);
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, -0.105, -32);
  road.receiveShadow = true;
  scene.add(road);

  const sidewalkMaterial = new THREE.MeshStandardMaterial({ color: 0x25272c, roughness: 0.72, metalness: 0.18 });
  [-1, 1].forEach((side) => {
    const sidewalk = new THREE.Mesh(new THREE.PlaneGeometry(2.35, 132), sidewalkMaterial);
    sidewalk.rotation.x = -Math.PI / 2;
    sidewalk.position.set(side * 6.28, -0.045, -32);
    sidewalk.receiveShadow = true;
    scene.add(sidewalk);

    const curb = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.23, 132), concrete);
    curb.position.set(side * 5.12, 0.015, -32);
    curb.receiveShadow = true;
    scene.add(curb);
  });

  addRoadStrip(scene, -4.98, 0xff416f, 0.8);
  addRoadStrip(scene, 4.98, 0x31dbe7, 0.82);
  addRoadStrip(scene, -1.65, 0x9da9ad, 0.34, true);
  addRoadStrip(scene, 1.65, 0x9da9ad, 0.34, true);

  const dashGeometry = new THREE.BoxGeometry(0.11, 0.035, 2.8);
  const dashMaterial = new THREE.MeshStandardMaterial({ color: 0x9aa5a8, emissive: 0x253840, emissiveIntensity: 0.35, roughness: 0.48, metalness: 0.25 });
  for (let i = 0; i < 24; i += 1) {
    const dash = new THREE.Mesh(dashGeometry, dashMaterial);
    dash.position.set(i % 2 ? -0.82 : 0.82, -0.065, 17 - i * 4.9);
    dash.userData.speed = 6.2 + (i % 3) * 0.4;
    scene.add(dash);
    movingDashes.push(dash);
  }

  createWetReflections(scene);
}

function addRoadStrip(scene, x, color, intensity, broken = false) {
  const geometry = new THREE.BoxGeometry(broken ? 0.035 : 0.055, 0.025, broken ? 2.6 : 118);
  const material = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.27, metalness: 0.48 });
  if (broken) {
    for (let i = 0; i < 20; i += 1) {
      const strip = new THREE.Mesh(geometry, material);
      strip.position.set(x, -0.05, 13 - i * 6.2);
      scene.add(strip);
    }
  } else {
    const strip = new THREE.Mesh(geometry, material);
    strip.position.set(x, -0.065, -32);
    scene.add(strip);
  }
}

function createWetReflections(scene) {
  const reflectionMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { color: { value: new THREE.Color(0x00bed7) }, opacity: { value: 0.16 } },
    vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `
      varying vec2 vUv; uniform vec3 color; uniform float opacity;
      void main(){
        float edge=smoothstep(0.0,.22,vUv.x)*(1.0-smoothstep(.72,1.0,vUv.x));
        float broken=step(.18,fract(vUv.y*11.0))*step(.38,fract(vUv.x*5.0+vUv.y*2.0));
        float alpha=edge*broken*opacity*(.35+.65*sin(vUv.y*52.0));
        gl_FragColor=vec4(color,alpha);
      }
    `,
  });
  const puddles = [
    { x: -1.2, z: -7, w: 2.2, l: 10, color: 0x0bc3dc, opacity: 0.18 },
    { x: 1.3, z: -17, w: 2.3, l: 14, color: 0xed257f, opacity: 0.15 },
    { x: -2.3, z: 2, w: 1.2, l: 5, color: 0xff9a52, opacity: 0.11 },
    { x: 2.2, z: -28, w: 2.1, l: 12, color: 0x0bc3dc, opacity: 0.12 },
  ];
  puddles.forEach((puddle) => {
    const material = reflectionMaterial.clone();
    material.uniforms = THREE.UniformsUtils.clone(reflectionMaterial.uniforms);
    material.uniforms.color.value.setHex(puddle.color);
    material.uniforms.opacity.value = puddle.opacity;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(puddle.w, puddle.l), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(puddle.x, -0.055, puddle.z);
    scene.add(mesh);
  });
}

function createBuildings(scene, random, animatedNeons) {
  const facades = [0, 1, 2, 3].map((seed) => makeFacade(seed + 19));
  const rows = [-47, -38, -29, -20, -11, -2, 7, 15];
  const wallMaterials = facades.map(({ albedo, glow }) => new THREE.MeshStandardMaterial({
    map: albedo,
    emissiveMap: glow,
    emissive: 0xffffff,
    emissiveIntensity: 0.82,
    metalness: 0.48,
    roughness: 0.48,
  }));
  const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x1a2029, roughness: 0.62, metalness: 0.35 });

  rows.forEach((z, row) => {
    [-1, 1].forEach((side) => {
      const width = 4.2 + random() * 4.3;
      const depth = 5 + random() * 5.2;
      const height = 12 + random() * 21;
      const x = side * (7.3 + random() * 6.7 + (row % 2) * 1.5);
      const facade = wallMaterials[Math.floor(random() * wallMaterials.length)];
      const building = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, depth),
        [facade, facade, roofMaterial, roofMaterial, facade, facade],
      );
      building.position.set(x, height / 2 - 0.18, z);
      building.castShadow = true;
      building.receiveShadow = true;
      scene.add(building);

      addBuildingStructure(scene, { x, z, width, depth, height, side, random, roofMaterial });
      if (row % 2 === 0 || (row === 3 && side < 0)) {
        const neon = addVerticalSign(scene, x, z, width, depth, height, side, random);
        animatedNeons.push(neon);
      }
    });
  });
}

function makeFacade(seed) {
  const random = seededRandom(seed);
  const width = 512;
  const height = 1024;
  const albedoCanvas = document.createElement('canvas');
  const glowCanvas = document.createElement('canvas');
  albedoCanvas.width = glowCanvas.width = width;
  albedoCanvas.height = glowCanvas.height = height;
  const albedo = albedoCanvas.getContext('2d');
  const glow = glowCanvas.getContext('2d');

  const baseHue = 205 + Math.floor(random() * 28);
  const base = albedo.createLinearGradient(0, 0, width, height);
  base.addColorStop(0, `hsl(${baseHue}, 19%, 14%)`);
  base.addColorStop(0.52, `hsl(${baseHue + 9}, 16%, 8%)`);
  base.addColorStop(1, `hsl(${baseHue - 8}, 20%, 12%)`);
  albedo.fillStyle = base;
  albedo.fillRect(0, 0, width, height);
  glow.fillStyle = '#000';
  glow.fillRect(0, 0, width, height);

  const floors = 22;
  const columns = 8;
  const cellWidth = width / columns;
  const cellHeight = height / floors;
  for (let floor = 0; floor < floors; floor += 1) {
    const y = floor * cellHeight;
    albedo.fillStyle = floor % 3 === 0 ? 'rgba(145,174,184,.12)' : 'rgba(2,5,10,.22)';
    albedo.fillRect(0, y, width, 8);
    albedo.fillStyle = 'rgba(2,4,8,.8)';
    albedo.fillRect(0, y + cellHeight - 5, width, 5);
    for (let column = 0; column < columns; column += 1) {
      const x = column * cellWidth + 8;
      const w = cellWidth - 16;
      const h = cellHeight - 19;
      const lit = random() > 0.34;
      const tone = random();
      const color = tone < 0.22 ? '#e8ad6b' : (tone < 0.58 ? '#63d0dc' : '#d880aa');
      albedo.fillStyle = lit ? 'rgba(4,10,17,.88)' : 'rgba(4,7,12,.97)';
      albedo.fillRect(x - 3, y + 10, w + 6, h + 5);
      if (lit) {
        const windowGradient = albedo.createLinearGradient(x, y + 12, x + w, y + h + 12);
        windowGradient.addColorStop(0, color);
        windowGradient.addColorStop(1, 'rgba(33,49,58,.75)');
        albedo.globalAlpha = 0.5 + random() * 0.42;
        albedo.fillStyle = windowGradient;
        albedo.fillRect(x, y + 12, w, h);
        albedo.globalAlpha = 1;
        glow.fillStyle = color;
        glow.globalAlpha = 0.58 + random() * 0.4;
        glow.fillRect(x + 2, y + 13, w - 4, h - 2);
        glow.globalAlpha = 1;
        albedo.fillStyle = 'rgba(220,240,245,.18)';
        albedo.fillRect(x, y + 12, 2, h);
      }
      albedo.fillStyle = 'rgba(130,155,165,.14)';
      albedo.fillRect(x - 3, y + 10, w + 6, 2);
    }
    if (random() > 0.7) {
      const panelX = Math.floor(random() * width * 0.8);
      albedo.fillStyle = 'rgba(20,32,41,.9)';
      albedo.fillRect(panelX, y + 10, 12, cellHeight - 18);
    }
  }
  for (let i = 0; i < 1700; i += 1) {
    const x = random() * width;
    const y = random() * height;
    const light = random() > 0.5;
    albedo.fillStyle = light ? 'rgba(210,225,230,.025)' : 'rgba(0,0,0,.05)';
    albedo.fillRect(x, y, random() * 2 + 0.5, random() * 5 + 1);
  }
  albedo.fillStyle = 'rgba(110,155,170,.28)';
  for (let x = 0; x < width; x += 64) albedo.fillRect(x, 0, 2, height);

  const albedoTexture = new THREE.CanvasTexture(albedoCanvas);
  albedoTexture.colorSpace = THREE.SRGBColorSpace;
  albedoTexture.anisotropy = 4;
  const glowTexture = new THREE.CanvasTexture(glowCanvas);
  glowTexture.colorSpace = THREE.SRGBColorSpace;
  glowTexture.anisotropy = 4;
  return { albedo: albedoTexture, glow: glowTexture };
}

function addBuildingStructure(scene, { x, z, width, depth, height, side, random, roofMaterial }) {
  const concrete = new THREE.MeshStandardMaterial({ color: 0x252a32, roughness: 0.78, metalness: 0.18 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x38444a, roughness: 0.33, metalness: 0.82 });
  const floors = Math.floor(height / 4.8);
  for (let floor = 1; floor < floors; floor += 1) {
    if (floor % 2 !== 0) continue;
    const ledge = new THREE.Mesh(new THREE.BoxGeometry(width + 0.14, 0.15, depth + 0.14), concrete);
    ledge.position.set(x, floor * 4.8, z);
    ledge.castShadow = true;
    scene.add(ledge);
  }

  [-1, 1].forEach((sideX) => {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, height + 0.4, 8), steel);
    pipe.position.set(x + sideX * (width / 2 + 0.06), height / 2, z + depth / 2 + 0.09);
    pipe.castShadow = true;
    scene.add(pipe);
  });

  for (let unit = 0; unit < 2 + Math.floor(random() * 3); unit += 1) {
    const unitWidth = 0.55 + random() * 0.45;
    const unitHeight = 0.42 + random() * 0.35;
    const aircon = new THREE.Mesh(new THREE.BoxGeometry(unitWidth, unitHeight, 0.38), steel);
    aircon.position.set(
      x + (random() - 0.5) * width * 0.76,
      2 + random() * Math.max(2, height - 4),
      z + depth / 2 + 0.22,
    );
    aircon.castShadow = true;
    scene.add(aircon);
    const grille = new THREE.Mesh(new THREE.BoxGeometry(unitWidth * 0.65, unitHeight * 0.55, 0.018), roofMaterial);
    grille.position.set(aircon.position.x, aircon.position.y, aircon.position.z + 0.2);
    scene.add(grille);
  }

  if (random() > 0.34) {
    const rooftopHeight = 1.4 + random() * 3.5;
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.1, rooftopHeight, 7), steel);
    antenna.position.set(x + (random() - 0.5) * width * 0.65, height + rooftopHeight / 2, z);
    scene.add(antenna);
    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 10, 8),
      new THREE.MeshBasicMaterial({ color: side < 0 ? 0x50edf7 : 0xff3b88, toneMapped: false }),
    );
    beacon.position.set(antenna.position.x, height + rooftopHeight, z);
    scene.add(beacon);
  }
}

function addVerticalSign(scene, x, z, width, depth, height, side, random) {
  const signCanvas = document.createElement('canvas');
  signCanvas.width = 192;
  signCanvas.height = 640;
  const context = signCanvas.getContext('2d');
  const hue = side < 0 ? 184 : 332;
  context.fillStyle = 'rgba(5,9,16,.94)';
  context.fillRect(0, 0, signCanvas.width, signCanvas.height);
  context.strokeStyle = `hsla(${hue},95%,65%,.9)`;
  context.lineWidth = 6;
  context.strokeRect(9, 9, signCanvas.width - 18, signCanvas.height - 18);
  context.shadowColor = `hsl(${hue},100%,60%)`;
  context.shadowBlur = 28;
  context.fillStyle = `hsl(${hue},95%,72%)`;
  context.font = 'bold 56px sans-serif';
  context.textAlign = 'center';
  context.fillText(['夜市', '新宿', '光', '2049'][Math.floor(random() * 4)], 96, 115);
  context.fillText(['街', '電気', '市', '未来'][Math.floor(random() * 4)], 96, 205);
  context.shadowBlur = 0;
  context.fillStyle = 'rgba(218,234,238,.84)';
  context.font = '20px monospace';
  context.fillText('SECTOR // 07', 96, 574);
  const texture = new THREE.CanvasTexture(signCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({ map: texture, color: 0xffffff, toneMapped: false, side: THREE.DoubleSide });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 4.2), material);
  sign.position.set(x - side * width * 0.28, Math.min(height - 3.5, 9 + random() * 5), z + depth / 2 + 0.08);
  scene.add(sign);
  const neon = new THREE.PointLight(side < 0 ? 0x0bcfe5 : 0xff287f, 8, 15, 2);
  neon.position.copy(sign.position);
  scene.add(neon);
  neon.userData.base = 6.5;
  neon.userData.rate = 1.7 + random() * 1.2;
  neon.userData.depth = 2;
  return neon;
}

function createStreetFurniture(scene) {
  const poleMaterial = new THREE.MeshStandardMaterial({ color: 0x28323a, roughness: 0.35, metalness: 0.8 });
  const lampMaterial = new THREE.MeshBasicMaterial({ color: 0xd8fbff, toneMapped: false });
  [-1, 1].forEach((side) => {
    [-31, -13, 5].forEach((z, index) => {
      const x = side * (5.7 + index * 0.18);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.11, 7.5, 9), poleMaterial);
      pole.position.set(x, 3.65, z);
      pole.castShadow = true;
      scene.add(pole);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 1.45, 8), poleMaterial);
      arm.rotation.z = side > 0 ? Math.PI / 2 : -Math.PI / 2;
      arm.position.set(x - side * 0.6, 7.25, z);
      scene.add(arm);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.13, 0.28), lampMaterial);
      lamp.position.set(x - side * 1.28, 7.12, z);
      scene.add(lamp);
      const glow = new THREE.SpotLight(0x82dce7, 34, 19, Math.PI / 5, 0.65, 1.2);
      glow.position.copy(lamp.position);
      glow.target.position.set(x - side * 1.7, 0, z - 4);
      scene.add(glow, glow.target);
    });
  });

  // A distant autonomous taxi gives the street a moving scale reference.
  const taxi = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.65, 3.2),
    new THREE.MeshPhysicalMaterial({ color: 0x15242b, metalness: 0.72, roughness: 0.28, clearcoat: 0.8, emissive: 0x06202a, emissiveIntensity: 0.45 }),
  );
  body.position.y = 0.58;
  body.castShadow = true;
  taxi.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.35, 0.62, 1.6),
    new THREE.MeshPhysicalMaterial({ color: 0x1f3c47, metalness: 0.3, roughness: 0.14, transparent: true, opacity: 0.78, clearcoat: 0.9 }),
  );
  cabin.position.set(0, 1.16, -0.12);
  taxi.add(cabin);
  const tireMaterial = new THREE.MeshStandardMaterial({ color: 0x08090b, roughness: 0.86, metalness: 0.08 });
  const hubMaterial = new THREE.MeshStandardMaterial({ color: 0x71848a, roughness: 0.24, metalness: 0.88 });
  for (const side of [-1, 1]) {
    for (const longitudinal of [-1, 1]) {
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.18, 20), tireMaterial);
      tire.rotation.z = Math.PI / 2;
      tire.position.set(side * 0.91, 0.34, longitudinal * 1.0);
      taxi.add(tire);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.2, 16), hubMaterial);
      hub.rotation.z = Math.PI / 2;
      hub.position.copy(tire.position);
      taxi.add(hub);
    }
  }
  [-1, 1].forEach((side) => {
    const headlight = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.08), lampMaterial);
    headlight.position.set(side * 0.58, 0.59, 1.64);
    taxi.add(headlight);
  });
  taxi.position.set(1.3, -0.02, -27);
  scene.add(taxi);
  const taxiLight = new THREE.PointLight(0x83f5ff, 20, 16, 2);
  taxiLight.position.set(1.3, 0.72, -23.5);
  scene.add(taxiLight);
  taxi.userData.headlight = taxiLight;
  return taxi;
}

function createMotorcycle(scene) {
  const root = new THREE.Group();
  root.position.set(-4.15, -0.02, 2.2);
  root.scale.setScalar(1.12);
  scene.add(root);

  const bodyMat = new THREE.MeshPhysicalMaterial({ color: 0x172128, metalness: 0.82, roughness: 0.24, clearcoat: 0.95, clearcoatRoughness: 0.16, emissive: 0x03151c, emissiveIntensity: 0.7 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x87969a, metalness: 0.92, roughness: 0.2 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x080a0c, roughness: 0.87, metalness: 0.05 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x75dce5, metalness: 0.92, roughness: 0.22, emissive: 0x06424b, emissiveIntensity: 0.3 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x11171b, metalness: 0.72, roughness: 0.36 });
  const cyanLight = new THREE.MeshBasicMaterial({ color: 0x93faff, toneMapped: false });

  function rod(start, end, radius, material = trimMat, parent = root) {
    const a = new THREE.Vector3(...start);
    const b = new THREE.Vector3(...end);
    const delta = new THREE.Vector3().subVectors(b, a);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.82, radius, delta.length(), 10), material);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function makeWheel(x) {
    const wheel = new THREE.Group();
    wheel.position.set(x, 0.55, 0.04);
    root.add(wheel);
    const tire = new THREE.Mesh(new THREE.TorusGeometry(0.53, 0.105, 16, 56), tireMat);
    tire.castShadow = true;
    wheel.add(tire);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.405, 0.034, 10, 48), rimMat);
    rim.position.z = 0.014;
    wheel.add(rim);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.045, 32), trimMat);
    disc.rotation.x = Math.PI / 2;
    disc.position.z = 0.035;
    wheel.add(disc);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.16, 20), darkMat);
    hub.rotation.x = Math.PI / 2;
    wheel.add(hub);
    for (let i = 0; i < 12; i += 1) {
      const angle = (i / 12) * Math.PI * 2;
      rod([0, 0, 0.075], [Math.cos(angle) * 0.39, Math.sin(angle) * 0.39, 0.075], 0.012, trimMat, wheel);
    }
    return wheel;
  }

  makeWheel(-1.17);
  makeWheel(1.14);

  const fairing = new THREE.Shape();
  fairing.moveTo(-1.38, 0.99);
  fairing.quadraticCurveTo(-1.39, 1.26, -1.16, 1.42);
  fairing.quadraticCurveTo(-0.86, 1.52, -0.57, 1.38);
  fairing.quadraticCurveTo(-0.2, 1.26, 0.12, 1.32);
  fairing.quadraticCurveTo(0.52, 1.39, 0.8, 1.78);
  fairing.quadraticCurveTo(1.01, 1.98, 1.25, 1.81);
  fairing.quadraticCurveTo(1.51, 1.58, 1.42, 1.25);
  fairing.quadraticCurveTo(1.36, 1.03, 1.06, 0.92);
  fairing.quadraticCurveTo(0.65, 0.82, 0.31, 0.99);
  fairing.quadraticCurveTo(-0.13, 0.78, -0.62, 0.86);
  fairing.quadraticCurveTo(-1.09, 0.83, -1.38, 0.99);
  fairing.closePath();
  const shell = new THREE.Mesh(
    new THREE.ExtrudeGeometry(fairing, { depth: 0.48, bevelEnabled: true, bevelSegments: 4, steps: 1, bevelSize: 0.055, bevelThickness: 0.06, curveSegments: 10 }),
    bodyMat,
  );
  shell.position.z = -0.24;
  shell.castShadow = true;
  root.add(shell);

  // Trellis frame, swing arm, fork, exhaust and engine block.
  rod([-1.16, 0.58, 0.16], [-0.68, 1.02, 0.14], 0.045, trimMat);
  rod([-0.68, 1.02, 0.14], [0.4, 0.94, 0.14], 0.05, trimMat);
  rod([0.4, 0.94, 0.14], [1.14, 0.58, 0.14], 0.047, trimMat);
  rod([-0.68, 1.02, -0.12], [-0.35, 0.58, -0.12], 0.04, trimMat);
  rod([-0.35, 0.58, -0.12], [0.4, 0.94, -0.12], 0.04, trimMat);
  rod([0.93, 1.62, 0.16], [1.14, 0.63, 0.16], 0.052, trimMat);
  rod([1.04, 1.58, -0.12], [1.14, 0.63, -0.12], 0.04, darkMat);
  rod([-0.95, 1.39, 0.05], [-0.34, 1.45, 0.05], 0.085, darkMat);
  rod([-0.8, 1.37, 0.07], [-0.36, 1.41, 0.07], 0.025, trimMat);

  const engine = new THREE.Mesh(new THREE.BoxGeometry(0.63, 0.58, 0.55), darkMat);
  engine.position.set(-0.07, 0.9, 0.02);
  engine.rotation.z = -0.12;
  engine.castShadow = true;
  root.add(engine);
  const engineCover = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.26, 0.58, 24), trimMat);
  engineCover.rotation.x = Math.PI / 2;
  engineCover.position.set(-0.08, 0.93, 0.31);
  root.add(engineCover);

  const exhaustCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.32, 0.79, -0.1),
    new THREE.Vector3(-0.02, 0.55, -0.22),
    new THREE.Vector3(0.52, 0.59, -0.22),
    new THREE.Vector3(0.94, 0.74, -0.22),
  ]);
  const exhaust = new THREE.Mesh(new THREE.TubeGeometry(exhaustCurve, 32, 0.052, 10, false), trimMat);
  exhaust.castShadow = true;
  root.add(exhaust);
  const muffler = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.13, 0.58, 18), darkMat);
  muffler.rotation.z = Math.PI / 2;
  muffler.position.set(-0.75, 0.59, -0.25);
  root.add(muffler);

  // Windscreen, cockpit and brake controls add realistic scale cues to the silhouette.
  const windscreen = new THREE.Mesh(
    new THREE.SphereGeometry(0.52, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshPhysicalMaterial({ color: 0x163342, metalness: 0.18, roughness: 0.12, transparent: true, opacity: 0.72, clearcoat: 1 }),
  );
  windscreen.scale.set(0.9, 0.64, 0.7);
  windscreen.rotation.z = -0.48;
  windscreen.position.set(0.83, 1.74, 0.05);
  root.add(windscreen);
  rod([0.92, 1.63, 0.08], [1.15, 1.71, 0.08], 0.035, trimMat);
  rod([1.15, 1.71, 0.08], [1.4, 1.68, 0.08], 0.026, darkMat);

  const headlamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), cyanLightMaterial());
  headlamp.scale.set(1.25, 0.7, 0.42);
  headlamp.position.set(1.39, 1.35, 0.3);
  root.add(headlamp);
  const tailLamp = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.07, 0.14), new THREE.MeshBasicMaterial({ color: 0xff255a, toneMapped: false }));
  tailLamp.position.set(-1.36, 1.28, 0.08);
  root.add(tailLamp);

  const lamp = new THREE.SpotLight(0x88efff, 28, 24, Math.PI / 8, 0.45, 1.5);
  lamp.position.set(1.42, 1.34, 0.25);
  lamp.target.position.set(6, 0.2, 0.25);
  root.add(lamp, lamp.target);
  const tailGlow = new THREE.PointLight(0xff1a60, 8, 5, 2);
  tailGlow.position.set(-1.5, 1.23, 0.15);
  root.add(tailGlow);

  const floorShadow = new THREE.Mesh(
    new THREE.CircleGeometry(1.4, 40),
    new THREE.MeshBasicMaterial({ color: 0x010205, transparent: true, opacity: 0.52, depthWrite: false }),
  );
  floorShadow.rotation.x = -Math.PI / 2;
  floorShadow.scale.set(1.7, 0.64, 1);
  floorShadow.position.set(0, -0.095, 0);
  root.add(floorShadow);
  return { root };
}

function cyanLightMaterial() {
  return new THREE.MeshPhysicalMaterial({ color: 0xc7fbff, emissive: 0x82f4ff, emissiveIntensity: 3.2, metalness: 0.25, roughness: 0.15, clearcoat: 1 });
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
