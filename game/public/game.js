import * as THREE from 'three';

// ==========================================================================
// GAME STATE & CONSTANTS
// ==========================================================================
let scene, camera, renderer;
let socket;
let myId = null;
let isJoined = false;
let myPlayerState = {
  nickname: 'Guest',
  color: '#3ddc84',
  characterType: 'android',
  x: 0,
  y: 1.0,
  z: 0,
  ry: 0,
  isJumping: false
};

// Player Entity Maps
const players = new Map(); // Store state of remote players (updated via socket)
const playerMeshes = new Map(); // Store 3D meshes of remote players
const playerTags = new Map(); // Store HTML nameplate elements of remote players
let localPlayerGroup = null; // Local player 3D group

// Animation / Physics Variables
const clock = new THREE.Clock();
const keys = { w: false, a: false, s: false, d: false, Shift: false, Space: false, e: false };
let yVelocity = 0;
const gravity = -15;
const jumpImpulse = 8;
const spawnBaseHeight = 1.0;
const arenaRadius = 24;

// Visual Effects
const pulseRings = [];
const particles = [];

// DOM References
const lobbyScreen = document.getElementById('lobby-screen');
const nicknameInput = document.getElementById('nickname-input');
const charSwatches = document.querySelectorAll('.char-swatch');
const joinBtn = document.getElementById('join-btn');
const randomNameBtn = document.getElementById('random-name-btn');
const gameHud = document.getElementById('game-hud');
const playerCountVal = document.getElementById('player-count-val');
const myNameVal = document.getElementById('my-name-val');
const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const htmlOverlay = document.getElementById('html-overlay');
const rosterList = document.getElementById('roster-list');

// Default Futuristic Name Generator
const spaceAdjectives = ['Cyber', 'Neon', 'Vortex', 'Cosmo', 'Quantum', 'Solar', 'Nova', 'Astral', 'Glitch', 'Shadow'];
const spaceNouns = ['Runner', 'Drifter', 'Nomad', 'Rider', 'Specter', 'Gridder', 'Vector', 'Seeker', 'Echo', 'Nexus'];
const generateRandomName = () => {
  const adj = spaceAdjectives[Math.floor(Math.random() * spaceAdjectives.length)];
  const noun = spaceNouns[Math.floor(Math.random() * spaceNouns.length)];
  const num = Math.floor(Math.random() * 900) + 100;
  return `${adj}${noun}_${num}`;
};

// Pre-fill nickname input
nicknameInput.value = generateRandomName();

// Handle Swatch Clicks to update active character
charSwatches.forEach(swatch => {
  swatch.addEventListener('click', (e) => {
    charSwatches.forEach(s => s.classList.remove('active'));
    swatch.classList.add('active');
    const char = swatch.getAttribute('data-char');
    myPlayerState.characterType = char;
    
    let color = '#3ddc84';
    if (char === 'sparky') color = '#ffa611';
    if (char === 'dash') color = '#02569b';
    
    document.documentElement.style.setProperty('--active-neon', color);
    myPlayerState.color = color;
  });
});

randomNameBtn.addEventListener('click', () => {
  nicknameInput.value = generateRandomName();
});

// ==========================================================================
// INITIALIZE 3D ENGINE & SCENE
// ==========================================================================
function init3D() {
  const container = document.getElementById('game-canvas');
  
  // 1. Create Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color('#05040a');
  scene.fog = new THREE.FogExp2('#05040a', 0.02);

  // 2. Setup Camera
  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  // Default camera position over the shoulders
  camera.position.set(0, 5, -8);

  // 3. Setup WebGL Renderer with Shadows & Antialiasing
  renderer = new THREE.WebGLRenderer({ canvas: container, antialias: true, alpha: false });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // 4. Elegant Lights
  const ambientLight = new THREE.AmbientLight('#0f0b24', 1.5);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight('#b500ff', 2.0);
  dirLight.position.set(10, 20, 15);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 50;
  const d = 25;
  dirLight.shadow.camera.left = -d;
  dirLight.shadow.camera.right = d;
  dirLight.shadow.camera.top = d;
  dirLight.shadow.camera.bottom = -d;
  scene.add(dirLight);

  // Subtle cyan point light in center for depth
  const centerLight = new THREE.PointLight('#00e5ff', 3, 30);
  centerLight.position.set(0, 5, 0);
  scene.add(centerLight);

  // 5. Generate Environment (Cyberpunk arena floor & pillars)
  createEnvironment();

  // Handle Window Resize
  window.addEventListener('resize', onWindowResize, false);
}

// Generates ground platform, grid lines, and glowing obelisks
function createEnvironment() {
  // A. Metallic ground platform
  const floorGeo = new THREE.CylinderGeometry(arenaRadius + 1, arenaRadius + 1, 1, 64);
  const floorMat = new THREE.MeshStandardMaterial({
    color: '#0e0b1f',
    roughness: 0.2,
    metalness: 0.8,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.position.y = -0.5;
  floor.receiveShadow = true;
  scene.add(floor);

  // B. Glowing Neon Grid Helper
  const gridHelper = new THREE.GridHelper(arenaRadius * 2, 32, '#ff007f', '#2a1a4a');
  gridHelper.position.y = 0.01;
  scene.add(gridHelper);

  // C. Glowing circular arena boundary
  const ringGeo = new THREE.RingGeometry(arenaRadius - 0.2, arenaRadius + 0.1, 64);
  const ringMat = new THREE.MeshBasicMaterial({ color: '#ff007f', side: THREE.DoubleSide });
  const boundaryRing = new THREE.Mesh(ringGeo, ringMat);
  boundaryRing.rotation.x = Math.PI / 2;
  boundaryRing.position.y = 0.02;
  scene.add(boundaryRing);

  // D. Dynamic Glowing Pillars/Obelisks
  const pillarGeo = new THREE.BoxGeometry(1.5, 8, 1.5);
  const numPillars = 8;
  for (let i = 0; i < numPillars; i++) {
    const angle = (i / numPillars) * Math.PI * 2;
    const distance = 16;
    const px = Math.cos(angle) * distance;
    const pz = Math.sin(angle) * distance;

    const accentColor = i % 2 === 0 ? '#00e5ff' : '#b500ff';
    const pillarMat = new THREE.MeshStandardMaterial({
      color: '#090714',
      roughness: 0.1,
      metalness: 0.9,
      emissive: accentColor,
      emissiveIntensity: 0.08
    });

    const pillar = new THREE.Mesh(pillarGeo, pillarMat);
    pillar.position.set(px, 4, pz);
    pillar.castShadow = true;
    pillar.receiveShadow = true;
    scene.add(pillar);

    // Add glowing light beacon on top
    const beaconGeo = new THREE.SphereGeometry(0.4, 16, 16);
    const beaconMat = new THREE.MeshBasicMaterial({ color: accentColor });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.set(px, 8.2, pz);
    scene.add(beacon);

    // PointLight on beacons to cast glows onto characters
    const beaconLight = new THREE.PointLight(accentColor, 1.5, 8);
    beaconLight.position.set(px, 8.2, pz);
    scene.add(beaconLight);
  }
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// ==========================================================================
// CHARACTER CREATION (Futuristic Floating Hover Droids)
// ==========================================================================
function createCharacterMesh(type, colorHex) {
  if (type === 'sparky') return createSparkyMesh(colorHex);
  if (type === 'dash') return createDashMesh(colorHex);
  return createAndroidMesh(colorHex); // default
}

function addHoverEffects(group, colorHex) {
  // Orbiting Torus Rings (Futuristic Gyro)
  const ringGeo = new THREE.TorusGeometry(0.75, 0.05, 8, 48);
  const ringMat = new THREE.MeshStandardMaterial({
    color: '#363050', roughness: 0.3, metalness: 0.9, emissive: colorHex, emissiveIntensity: 0.1
  });
  const orbitRing = new THREE.Mesh(ringGeo, ringMat);
  orbitRing.rotation.x = Math.PI / 2.5;
  orbitRing.name = 'gyroRing';
  group.add(orbitRing);

  // Bottom Thrust Flame
  const flameGeo = new THREE.ConeGeometry(0.18, 0.4, 16);
  flameGeo.translate(0, -0.4, 0); // Offset geometry down
  const flameMat = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.7 });
  const flame = new THREE.Mesh(flameGeo, flameMat);
  flame.name = 'thruster';
  group.add(flame);

  // Subtle spotlight
  const spotLight = new THREE.PointLight(colorHex, 1.2, 5);
  spotLight.position.set(0, -0.5, 0);
  group.add(spotLight);
}

function createAndroidMesh(colorHex) {
  const group = new THREE.Group();

  const bodyGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.5, 32);
  const headGeo = new THREE.SphereGeometry(0.4, 32, 32, 0, Math.PI * 2, 0, Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.5, metalness: 0.3 });
  
  const body = new THREE.Mesh(bodyGeo, mat);
  body.position.y = -0.15;
  const head = new THREE.Mesh(headGeo, mat);
  head.position.y = 0.12;
  
  const eyeGeo = new THREE.SphereGeometry(0.06, 16, 16);
  const eyeMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.15, 0.25, 0.35);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeR.position.set(0.15, 0.25, 0.35);

  const antGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.2, 8);
  const antL = new THREE.Mesh(antGeo, mat);
  antL.position.set(-0.2, 0.5, 0);
  antL.rotation.z = Math.PI / 8;
  const antR = new THREE.Mesh(antGeo, mat);
  antR.position.set(0.2, 0.5, 0);
  antR.rotation.z = -Math.PI / 8;

  // Arms
  const armGeo = new THREE.CapsuleGeometry(0.08, 0.3, 16, 16);
  const armL = new THREE.Mesh(armGeo, mat);
  armL.position.set(-0.55, -0.1, 0);
  const armR = new THREE.Mesh(armGeo, mat);
  armR.position.set(0.55, -0.1, 0);
  
  group.add(body, head, eyeL, eyeR, antL, antR, armL, armR);
  addHoverEffects(group, colorHex);
  return group;
}

function createSparkyMesh(colorHex) {
  const group = new THREE.Group();
  
  const mat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.4, emissive: colorHex, emissiveIntensity: 0.2 });
  const baseGeo = new THREE.SphereGeometry(0.45, 32, 32);
  const base = new THREE.Mesh(baseGeo, mat);
  base.position.y = -0.1;

  const tipGeo = new THREE.ConeGeometry(0.45, 0.8, 32);
  const tip = new THREE.Mesh(tipGeo, mat);
  tip.position.y = 0.2;
  
  const eyeGeo = new THREE.SphereGeometry(0.08, 16, 16);
  const eyeMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.18, 0.1, 0.4);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeR.position.set(0.18, 0.1, 0.4);

  group.add(base, tip, eyeL, eyeR);
  addHoverEffects(group, colorHex);
  return group;
}

function createDashMesh(colorHex) {
  const group = new THREE.Group();
  
  const mat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.8, metalness: 0.1 });
  const bodyGeo = new THREE.SphereGeometry(0.5, 32, 32);
  const body = new THREE.Mesh(bodyGeo, mat);
  
  const wingGeo = new THREE.BoxGeometry(0.1, 0.4, 0.5);
  const wingL = new THREE.Mesh(wingGeo, mat);
  wingL.position.set(-0.55, 0, 0);
  const wingR = new THREE.Mesh(wingGeo, mat);
  wingR.position.set(0.55, 0, 0);

  const beakGeo = new THREE.ConeGeometry(0.15, 0.3, 16);
  const beakMat = new THREE.MeshStandardMaterial({ color: '#fbbc05' });
  const beak = new THREE.Mesh(beakGeo, beakMat);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.1, 0.5);

  const eyeGeo = new THREE.SphereGeometry(0.08, 16, 16);
  const eyeMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.2, 0.25, 0.4);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeR.position.set(0.2, 0.25, 0.4);
  
  group.add(body, wingL, wingR, beak, eyeL, eyeR);
  addHoverEffects(group, colorHex);
  return group;
}

// Create a HTML floating tag above the 3D player mesh
function createHTMLNameplate(id, nickname, colorHex) {
  const wrapper = document.createElement('div');
  wrapper.id = `tag-${id}`;
  wrapper.className = 'player-nameplate';
  wrapper.style.setProperty('--player-accent', colorHex);

  const tag = document.createElement('div');
  tag.className = 'nameplate-tag';
  tag.textContent = nickname;

  wrapper.appendChild(tag);
  htmlOverlay.appendChild(wrapper);
  return wrapper;
}

// Add a floating chat bubble above player name tag
function triggerHTMLChatBubble(tagElement, text) {
  // Remove existing bubble in this tag if present
  const oldBubble = tagElement.querySelector('.player-chat-bubble');
  if (oldBubble) {
    tagElement.removeChild(oldBubble);
  }

  const bubble = document.createElement('div');
  bubble.className = 'player-chat-bubble';
  bubble.textContent = text;

  // Insert chat bubble *above* name tag
  tagElement.insertBefore(bubble, tagElement.firstChild);

  // Auto remove after 4.5 seconds
  setTimeout(() => {
    if (bubble.parentNode === tagElement) {
      bubble.style.transition = 'all 0.3s ease';
      bubble.style.transform = 'scale(0.8) translateY(-10px)';
      bubble.style.opacity = '0';
      setTimeout(() => {
        if (bubble.parentNode === tagElement) {
          tagElement.removeChild(bubble);
        }
      }, 300);
    }
  }, 4500);
}

// ==========================================================================
// RADIAL EMOTE SHOCKWAVES & PARTICLES
// ==========================================================================
function spawnRadialWave(x, y, z, colorHex) {
  // Create circular wave ring
  const ringGeo = new THREE.RingGeometry(0.1, 0.15, 32);
  const ringMat = new THREE.MeshBasicMaterial({
    color: colorHex,
    transparent: true,
    opacity: 1.0,
    side: THREE.DoubleSide
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  // Lay flat on ground relative to player's center
  ring.rotation.x = Math.PI / 2;
  ring.position.set(x, 0.05, z);
  scene.add(ring);

  pulseRings.push({
    mesh: ring,
    scale: 0.1,
    maxScale: 6.0,
    speed: 7.0,
    material: ringMat
  });

  // Spawn dynamic explosive particle debris
  const particleCount = 18;
  const debrisGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
  for (let i = 0; i < particleCount; i++) {
    const debrisMat = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 1.0 });
    const p = new THREE.Mesh(debrisGeo, debrisMat);
    p.position.set(x, y, z);
    
    // Random spherical velocity direction
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 4;
    const vy = 1 + Math.random() * 4;
    
    particles.push({
      mesh: p,
      vx: Math.cos(angle) * speed,
      vy: vy,
      vz: Math.sin(angle) * speed,
      material: debrisMat,
      age: 0,
      maxAge: 0.8 + Math.random() * 0.5
    });
    
    scene.add(p);
  }
}

// Update rings and particles frame-by-frame
function updateVfx(dt) {
  // 1. Ring waves expansion
  for (let i = pulseRings.length - 1; i >= 0; i--) {
    const ring = pulseRings[i];
    ring.scale += ring.speed * dt;
    ring.mesh.scale.set(ring.scale, ring.scale, 1);
    
    // Fade out as it expands
    const lifeRatio = ring.scale / ring.maxScale;
    ring.material.opacity = Math.max(0, 1.0 - lifeRatio);
    
    if (ring.scale >= ring.maxScale) {
      scene.remove(ring.mesh);
      ring.mesh.geometry.dispose();
      ring.material.dispose();
      pulseRings.splice(i, 1);
    }
  }

  // 2. Physical particle debris explosions
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.age += dt;
    
    // Apply velocity & physics
    p.mesh.position.x += p.vx * dt;
    p.mesh.position.y += p.vy * dt;
    p.mesh.position.z += p.vz * dt;
    
    p.vy -= 9.8 * dt; // Gravity pull

    // Spin particle
    p.mesh.rotation.x += 3 * dt;
    p.mesh.rotation.y += 3 * dt;

    // Fade out
    const lifeRatio = p.age / p.maxAge;
    p.material.opacity = Math.max(0, 1.0 - lifeRatio);

    if (p.age >= p.maxAge || p.mesh.position.y <= 0) {
      scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.material.dispose();
      particles.splice(i, 1);
    }
  }
}

// ==========================================================================
// CONTROLS & LOCAL PHYSICS UPDATER
// ==========================================================================
function setupControls() {
  window.addEventListener('keydown', (e) => {
    if (document.activeElement === chatInput) {
      if (e.key === 'Escape') {
        chatInput.blur();
      }
      return; // Stop game keys when writing chat messages
    }

    if (e.key === 'w' || e.key === 'ArrowUp') keys.w = true;
    if (e.key === 's' || e.key === 'ArrowDown') keys.s = true;
    if (e.key === 'a' || e.key === 'ArrowLeft') keys.a = true;
    if (e.key === 'd' || e.key === 'ArrowRight') keys.d = true;
    if (e.key === 'Shift') keys.Shift = true;
    
    if (e.key === ' ') {
      e.preventDefault(); // Prevent spacebar from clicking focused buttons
      if (!myPlayerState.isJumping) {
        keys.Space = true;
        myPlayerState.isJumping = true;
        yVelocity = jumpImpulse;
      }
    }

    // Ping shockwave trigger
    if (e.key.toLowerCase() === 'e') {
      triggerInteraction();
    }

    // Focus chat
    if (e.key === 'Enter') {
      e.preventDefault();
      chatInput.focus();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.key === 'w' || e.key === 'ArrowUp') keys.w = false;
    if (e.key === 's' || e.key === 'ArrowDown') keys.s = false;
    if (e.key === 'a' || e.key === 'ArrowLeft') keys.a = false;
    if (e.key === 'd' || e.key === 'ArrowRight') keys.d = false;
    if (e.key === 'Shift') keys.Shift = false;
    if (e.key === ' ') keys.Space = false;
  });

  // Clicking on canvas triggers wave emote
  renderer.domElement.addEventListener('mousedown', (e) => {
    if (isJoined && document.activeElement !== chatInput) {
      triggerInteraction();
    }
  });
}

function triggerInteraction() {
  if (!isJoined) return;
  // Visual pulse on local client
  spawnRadialWave(myPlayerState.x, myPlayerState.y, myPlayerState.z, myPlayerState.color);
  // Send socket broadcast
  sendPacket('interact', { action: 'pulse' });
}

function updateLocalPlayer(dt) {
  if (!localPlayerGroup) return;

  // 1. Rotation control (Left / Right rotating player)
  let rotSpeed = 3.2 * dt;
  if (keys.a) {
    myPlayerState.ry += rotSpeed;
  }
  if (keys.d) {
    myPlayerState.ry -= rotSpeed;
  }
  localPlayerGroup.rotation.y = myPlayerState.ry;

  // 2. Translational Movement (W/S moves relative to facing angle)
  let currentSpeed = keys.Shift ? 9.5 : 5.8;
  let moveDirection = new THREE.Vector3(0, 0, 0);

  if (keys.w) {
    moveDirection.z = 1;
  }
  if (keys.s) {
    moveDirection.z = -1;
  }

  if (moveDirection.lengthSq() > 0) {
    moveDirection.normalize();
    // Rotate movement vector relative to local character orientation
    moveDirection.applyAxisAngle(new THREE.Vector3(0, 1, 0), myPlayerState.ry);
    
    // Apply translations
    myPlayerState.x += moveDirection.x * currentSpeed * dt;
    myPlayerState.z += moveDirection.z * currentSpeed * dt;
  }

  // 3. Jump and Hover Physics (vertical gravity)
  if (myPlayerState.isJumping) {
    yVelocity += gravity * dt;
    myPlayerState.y += yVelocity * dt;

    if (myPlayerState.y <= spawnBaseHeight) {
      myPlayerState.y = spawnBaseHeight;
      myPlayerState.isJumping = false;
      yVelocity = 0;
    }
  }

  // 4. Prevent escaping the outer circular boundaries (Physics wall collision)
  const playerDistFromCenter = Math.sqrt(myPlayerState.x * myPlayerState.x + myPlayerState.z * myPlayerState.z);
  if (playerDistFromCenter > arenaRadius) {
    const ratio = arenaRadius / playerDistFromCenter;
    myPlayerState.x *= ratio;
    myPlayerState.z *= ratio;
  }

  // 5. Update local 3D group positioning
  localPlayerGroup.position.x = myPlayerState.x;
  localPlayerGroup.position.z = myPlayerState.z;
  
  // Hovering drone movement float effect (sine wave)
  const hoverOffset = myPlayerState.isJumping ? 0 : Math.sin(clock.getElapsedTime() * 5) * 0.08;
  localPlayerGroup.position.y = myPlayerState.y + hoverOffset;

  // Gyro spinning animation (for aesthetics)
  const gyro = localPlayerGroup.getObjectByName('gyroRing');
  if (gyro) {
    gyro.rotation.z += 1.5 * dt;
    gyro.rotation.y += 0.5 * dt;
  }

  // Thruster flame pulse scale
  const thruster = localPlayerGroup.getObjectByName('thruster');
  if (thruster) {
    const speedScale = keys.w || keys.s ? 1.4 : 1.0;
    thruster.scale.set(
      1.0 + Math.sin(clock.getElapsedTime() * 25) * 0.15,
      speedScale + Math.sin(clock.getElapsedTime() * 25) * 0.25,
      1.0 + Math.sin(clock.getElapsedTime() * 25) * 0.15
    );
  }

  // 6. Camera Follow System (interpolating third-person camera)
  const idealOffset = new THREE.Vector3(0, 3.8, -6.5); // Back & Up
  idealOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), myPlayerState.ry); // Rotate with player
  
  const idealLookAt = new THREE.Vector3(myPlayerState.x, myPlayerState.y + 0.6, myPlayerState.z);
  const targetCamPos = new THREE.Vector3(
    myPlayerState.x + idealOffset.x,
    myPlayerState.y + idealOffset.y,
    myPlayerState.z + idealOffset.z
  );

  // Smoothly blend camera movements to eliminate motion stiffness
  camera.position.lerp(targetCamPos, 0.12);
  camera.lookAt(idealLookAt);
}

// ==========================================================================
// WEBSOCKETS NETWORKING CLIENT
// ==========================================================================
function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const serverUrl = `${protocol}//${window.location.host}`;
  console.log(`[WS] Connecting to server at: ${serverUrl}`);

  socket = new WebSocket(serverUrl);

  socket.onopen = () => {
    console.log('[WS] Socket link online.');
  };

  socket.onmessage = (event) => {
    try {
      const packet = JSON.parse(event.data);
      const { type, data } = packet;

      switch (type) {
        case 'handshake':
          myId = data.playerId;
          console.log(`[WS] Handshake approved. Session ID: ${myId}`);
          break;

        case 'sync': {
          // Synchronize initial list of other players
          data.forEach(p => {
            if (p.id !== myId) {
              spawnRemotePlayer(p);
            }
          });
          updateHUD();
          break;
        }

        case 'playerJoin': {
          if (data.id !== myId) {
            spawnRemotePlayer(data);
            addSystemMessage(`User "${data.nickname}" spawned into the matrix.`);
            updateHUD();
          }
          break;
        }

        case 'playerMove': {
          if (data.id !== myId) {
            // Update cached positioning coordinates. 
            // Remote players are smoothly animated using interpolation (lerp) inside render loop.
            const playerState = players.get(data.id);
            if (playerState) {
              playerState.x = data.x;
              playerState.y = data.y;
              playerState.z = data.z;
              playerState.ry = data.ry;
              playerState.isJumping = data.isJumping;
            }
          }
          break;
        }

        case 'playerChat': {
          appendChatMessage(data.nickname, data.text, data.id === myId);
          
          // Trigger floating 3D overhead bubble
          if (data.id === myId && localPlayerGroup) {
            const myTag = document.getElementById(`tag-local`);
            if (myTag) triggerHTMLChatBubble(myTag, data.text);
          } else {
            const tag = playerTags.get(data.id);
            if (tag) triggerHTMLChatBubble(tag, data.text);
          }
          break;
        }

        case 'playerInteract': {
          if (data.id !== myId) {
            // Spawn shockwave for remote player
            const pState = players.get(data.id);
            if (pState) {
              spawnRadialWave(pState.x, pState.y, pState.z, data.color);
            }
          }
          break;
        }

        case 'playerCustomize': {
          if (data.id !== myId) {
            const pState = players.get(data.id);
            if (pState) {
              pState.nickname = data.nickname;
              pState.color = data.color;

              // Re-build or paint mesh color
              const oldMesh = playerMeshes.get(data.id);
              if (oldMesh) scene.remove(oldMesh);

              const newMesh = createCharacterMesh(data.characterType, data.color);
              scene.add(newMesh);
              playerMeshes.set(data.id, newMesh);

              // Update nameplate HTML
              const tag = playerTags.get(data.id);
              if (tag) {
                tag.style.setProperty('--player-accent', data.color);
                const span = tag.querySelector('.nameplate-tag');
                if (span) span.textContent = data.nickname;
              }

              addSystemMessage(`User "${data.nickname}" updated their configuration.`);
              updateHUD();
            }
          }
          break;
        }

        case 'playerLeave': {
          removeRemotePlayer(data.id);
          updateHUD();
          break;
        }
      }
    } catch (err) {
      console.error('[WS] Message packet parsing exception:', err);
    }
  };

  socket.onclose = () => {
    console.warn('[WS] Socket offline. Reconnecting in 3 seconds...');
    addSystemMessage('Connection lost. Reconnecting...');
    setTimeout(connectWebSocket, 3000);
  };
}

function sendPacket(type, data) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type, data }));
  }
}

// Periodic broadcast of local coordinates to other peers (30Hz)
function setupNetworkSyncLoop() {
  setInterval(() => {
    if (isJoined && localPlayerGroup) {
      sendPacket('update', {
        x: myPlayerState.x,
        y: myPlayerState.y,
        z: myPlayerState.z,
        ry: myPlayerState.ry,
        isJumping: myPlayerState.isJumping
      });
    }
  }, 1000 / 30); // 30 updates per second (standard latency threshold)
}

// ==========================================================================
// MULTIPLAYER ROOM ENTITY SPAWNERS & REMOVERS
// ==========================================================================
function spawnRemotePlayer(state) {
  console.log(`[Game] Spawning remote peer character: ${state.nickname}`);
  
  // Save position states
  players.set(state.id, state);

  // Generate 3D Droid Mesh
  const mesh = createCharacterMesh(state.characterType, state.color);
  mesh.position.set(state.x, state.y, state.z);
  mesh.rotation.y = state.ry;
  scene.add(mesh);
  playerMeshes.set(state.id, mesh);

  // Create HTML nameplate overlay
  const tag = createHTMLNameplate(state.id, state.nickname, state.color);
  playerTags.set(state.id, tag);
}

function removeRemotePlayer(id) {
  const state = players.get(id);
  if (state) {
    addSystemMessage(`User "${state.nickname}" returned to orbit.`);
    players.delete(id);
  }

  // Remove 3D Mesh
  const mesh = playerMeshes.get(id);
  if (mesh) {
    scene.remove(mesh);
    playerMeshes.delete(id);
  }

  // Remove HTML Nameplate
  const tag = playerTags.get(id);
  if (tag) {
    if (tag.parentNode) tag.parentNode.removeChild(tag);
    playerTags.delete(id);
  }
}

// ==========================================================================
// HUD & CHAT GUI COMPONENT ROUTER
// ==========================================================================
function updateHUD() {
  // Update scoreboard numbers
  playerCountVal.textContent = players.size + 1;

  // Build active player roster list
  rosterList.innerHTML = '';

  // Local user first
  const localItem = document.createElement('div');
  localItem.className = 'roster-item self';
  localItem.style.setProperty('--roster-color', myPlayerState.color);
  localItem.innerHTML = `
    <span class="roster-name">${myPlayerState.nickname}</span>
    <span class="roster-self-badge" style="background: ${myPlayerState.color}">YOU</span>
  `;
  rosterList.appendChild(localItem);

  // Other peers
  players.forEach(p => {
    const item = document.createElement('div');
    item.className = 'roster-item';
    item.style.setProperty('--roster-color', p.color);
    item.innerHTML = `<span class="roster-name">${p.nickname}</span>`;
    rosterList.appendChild(item);
  });
}

function appendChatMessage(sender, text, isSelf) {
  const item = document.createElement('div');
  item.className = 'chat-item';
  
  const senderSpan = document.createElement('span');
  senderSpan.className = 'chat-sender';
  senderSpan.textContent = sender;
  senderSpan.style.color = isSelf ? '#ffea00' : '#00e5ff';

  const textSpan = document.createElement('span');
  textSpan.className = 'chat-msg';
  textSpan.textContent = `: ${text}`;

  item.appendChild(senderSpan);
  item.appendChild(textSpan);
  chatMessages.appendChild(item);

  // Scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addSystemMessage(text) {
  const item = document.createElement('div');
  item.className = 'system-message';
  item.textContent = `[System] ${text}`;
  chatMessages.appendChild(item);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Handle Chat input submit
chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (text.length > 0) {
    sendPacket('chat', { text });
    chatInput.value = '';
  }
  chatInput.blur();
});

// ==========================================================================
// SPAWN BUTTON ACTION (Transition from Lobby to 3D World)
// ==========================================================================
joinBtn.addEventListener('click', () => {
  joinBtn.blur(); // Remove focus to prevent accidental spacebar re-clicks
  const nick = nicknameInput.value.trim();
  if (nick.length > 0) {
    myPlayerState.nickname = nick;
  }

  // 1. Initialize local character mesh group in 3D
  localPlayerGroup = createCharacterMesh(myPlayerState.characterType, myPlayerState.color);
  // Spawn in a randomized radius position
  myPlayerState.x = (Math.random() * 8 - 4);
  myPlayerState.z = (Math.random() * 8 - 4);
  myPlayerState.y = spawnBaseHeight;
  localPlayerGroup.position.set(myPlayerState.x, myPlayerState.y, myPlayerState.z);
  scene.add(localPlayerGroup);

  // 2. Create local tag element
  createHTMLNameplate('local', myPlayerState.nickname, myPlayerState.color);

  // 3. Send JOIN signal to servers
  sendPacket('join', myPlayerState);

  // 4. Update HUD tags & display HUD Layer
  myNameVal.textContent = myPlayerState.nickname;
  updateHUD();

  isJoined = true;
  lobbyScreen.classList.add('hidden');
  gameHud.classList.remove('hidden');

  // Trigger spawn visual burst
  spawnRadialWave(myPlayerState.x, myPlayerState.y, myPlayerState.z, myPlayerState.color);
  addSystemMessage('Welcome to Neon Matrix. Move with WASD, jump with Space, pulse with E.');
});

// Support join game via pressing Enter key in nickname input
nicknameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    joinBtn.click();
  }
});

// ==========================================================================
// FRAME ANIMATE RENDER LOOP (60FPS WebGL + Interp + Camera Project)
// ==========================================================================
const tempV = new THREE.Vector3();

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.1); // Cap dt to avoid large physics steps on tab switch

  if (isJoined) {
    // 1. Update active player controls and camera
    updateLocalPlayer(dt);

    // 2. Project local player nameplate
    const localTag = document.getElementById('tag-local');
    if (localTag && localPlayerGroup) {
      localPlayerGroup.getWorldPosition(tempV);
      tempV.y += 1.0; // Height offset above floating droid
      
      // Project 3D vector to 2D normalized Device Coordinates (NDC)
      tempV.project(camera);
      
      // Map back to screen pixel coordinates
      const x = (tempV.x * 0.5 + 0.5) * window.innerWidth;
      const y = (tempV.y * -0.5 + 0.5) * window.innerHeight;
      
      localTag.style.left = `${x}px`;
      localTag.style.top = `${y}px`;
      localTag.style.opacity = tempV.z > 1 ? '0' : '1';
    }

    // 3. Update & Interpolate remote peers (smooth position lerping)
    players.forEach((state, id) => {
      const mesh = playerMeshes.get(id);
      const tag = playerTags.get(id);

      if (mesh) {
        // Linear Interpolate (lerp) coordinates to remove jitter and slide smoothly
        mesh.position.x = THREE.MathUtils.lerp(mesh.position.x, state.x, 0.15);
        
        // Remote hovering drone float effect
        const hoverOffset = state.isJumping ? 0 : Math.sin(clock.getElapsedTime() * 5 + id.charCodeAt(0)) * 0.08;
        mesh.position.y = THREE.MathUtils.lerp(mesh.position.y, state.y + hoverOffset, 0.15);
        
        mesh.position.z = THREE.MathUtils.lerp(mesh.position.z, state.z, 0.15);
        
        // Lerp rot y
        mesh.rotation.y = THREE.MathUtils.lerp(mesh.rotation.y, state.ry, 0.15);

        // Gyro rotation
        const gyro = mesh.getObjectByName('gyroRing');
        if (gyro) {
          gyro.rotation.z += 1.5 * dt;
          gyro.rotation.y += 0.5 * dt;
        }

        // Thruster scale
        const thruster = mesh.getObjectByName('thruster');
        if (thruster) {
          thruster.scale.set(
            1.0 + Math.sin(clock.getElapsedTime() * 25) * 0.15,
            1.0 + Math.sin(clock.getElapsedTime() * 25) * 0.25,
            1.0 + Math.sin(clock.getElapsedTime() * 25) * 0.15
          );
        }
      }

      // Project remote nameplate
      if (tag && mesh) {
        mesh.getWorldPosition(tempV);
        tempV.y += 1.0;
        tempV.project(camera);

        const x = (tempV.x * 0.5 + 0.5) * window.innerWidth;
        const y = (tempV.y * -0.5 + 0.5) * window.innerHeight;

        tag.style.left = `${x}px`;
        tag.style.top = `${y}px`;
        tag.style.opacity = tempV.z > 1 ? '0' : '1';
      }
    });
  }

  // 4. Update Particle Explosions and ring waves
  updateVfx(dt);

  // 5. Render Scene
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}

// ==========================================================================
// SYSTEM ENTRYPOINT STARTUP
// ==========================================================================
function start() {
  init3D();
  setupControls();
  connectWebSocket();
  setupNetworkSyncLoop();
  
  // Launch render loop
  requestAnimationFrame(animate);
}

start();
