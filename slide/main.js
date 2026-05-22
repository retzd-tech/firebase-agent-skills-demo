import * as THREE from 'three';

// Slide Content Data
const slidesData = [
  {
    image: 'assets/slide1.png',
    title: 'Build with AI Bandung',
    desc: ''
  },
  {
    image: 'assets/slide2.png',
    title: 'Build with AI Bandung',
    desc: ''
  },
  {
    image: 'assets/slide3.png',
    title: 'Build with AI Bandung',
    desc: ''
  },
  {
    image: 'assets/slide4.png',
    title: 'Build with AI Bandung',
    desc: 'Agent skills act as an Implementation standard for the AI Agent'
  },
  {
    image: 'assets/slide5.png',
    title: 'Build with AI Bandung',
    desc: 'Firebase Agent Skill makes our AI to become the Expert of its domain!'
  },
  {
    image: 'assets/slide6.png',
    title: 'Build with AI Bandung',
    desc: 'Our roadmap today!'
  },
  {
    image: 'assets/slide7.png',
    title: 'Build with AI Bandung',
    desc: ''
  },
  {
    image: 'assets/slide8.png',
    title: 'Build with AI Bandung',
    desc: ''
  },
  {
    image: 'assets/slide9.png',
    title: 'Build with AI Bandung',
    desc: ''
  },
  {
    image: 'assets/slide10.png',
    title: 'Build with AI Bandung',
    desc: ''
  },
  {
    image: 'assets/slide11.png',
    title: 'Build with AI Bandung',
    desc: ''
  },
  {
    image: 'assets/slide12.png',
    title: 'Build with AI Bandung',
    desc: ''
  },
  {
    image: 'assets/slide13.png',
    title: 'Build with AI Bandung',
    desc: ''
  },
  {
    image: 'assets/slide14.png',
    title: 'Build with AI Bandung',
    desc: ''
  }
];

// --------------------------------------------------------
// Three.js Setup (White / Grey Theme + Alive World)
// --------------------------------------------------------
const canvas = document.getElementById('presentation-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);

// Light grey / white background to match the template
const bgColor = 0xf8f9fa;
renderer.setClearColor(bgColor, 1);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(bgColor, 0.015); // Lighter fog so we can see deeper

// Camera Setup
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 200);
const CAMERA_START_Z = 12;
camera.position.set(0, 0, CAMERA_START_Z);

// Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
scene.add(ambientLight);

// --------------------------------------------------------
// Particle System (The Alive World in Google Colors)
// --------------------------------------------------------
const particleCount = 3000;
const geometry = new THREE.BufferGeometry();
const positions = new Float32Array(particleCount * 3);
const colors = new Float32Array(particleCount * 3);

// Google Brand Colors
const googleBlue = new THREE.Color(0x4285F4);
const googleRed = new THREE.Color(0xEA4335);
const googleYellow = new THREE.Color(0xFBBC05);
const googleGreen = new THREE.Color(0x34A853);
const palette = [googleBlue, googleRed, googleYellow, googleGreen];

for (let i = 0; i < particleCount * 3; i += 3) {
  // Spread particles widely around the camera and slides
  positions[i] = (Math.random() - 0.5) * 120;     // x
  positions[i+1] = (Math.random() - 0.5) * 120;   // y
  positions[i+2] = (Math.random() - 0.5) * 150 + 20; // z

  // Assign random Google color
  const c = palette[Math.floor(Math.random() * palette.length)];
  colors[i] = c.r;
  colors[i+1] = c.g;
  colors[i+2] = c.b;
}

geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

// Since background is light, we use standard alpha blending, not additive
const particleMaterial = new THREE.PointsMaterial({
  size: 0.25,
  vertexColors: true,
  transparent: true,
  opacity: 0.8,
});

const particleSystem = new THREE.Points(geometry, particleMaterial);
scene.add(particleSystem);

// --------------------------------------------------------
// Create 3D Slides
// --------------------------------------------------------
const textureLoader = new THREE.TextureLoader();

// --------------------------------------------------------
// Background Flying Mascots
// --------------------------------------------------------
const mascots = [];
function createTransparentMascot(url) {
  const img = new Image();
  img.src = url;
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] > 240 && data[i+1] > 240 && data[i+2] > 240) {
        data[i+3] = 0; // Make white pixels transparent
      }
    }
    ctx.putImageData(imgData, 0, 0);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    
    const mat = new THREE.SpriteMaterial({ 
      map: texture, 
      transparent: true,
      opacity: 0.8 // Slightly faded so they aren't the main focus
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(6, 6, 1);
    scene.add(sprite);
    mascots.push(sprite);
  };
}

createTransparentMascot('assets/firebase.png');

const slideSpacing = -30; // Deep spacing
const planes = [];

const slideWidth = 14;
const slideHeight = 14 / (16/9);

slidesData.forEach((data, index) => {
  const texture = textureLoader.load(data.image);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;

  const planeGeo = new THREE.PlaneGeometry(slideWidth, slideHeight);
  // MeshBasicMaterial keeps the images bright and clear like the template
  const planeMat = new THREE.MeshBasicMaterial({ 
    map: texture
  });

  const plane = new THREE.Mesh(planeGeo, planeMat);
  plane.position.z = index * slideSpacing;
  
  // Dynamic tilt
  if (index > 0) {
    plane.rotation.y = (Math.random() - 0.5) * 0.15;
    plane.rotation.x = (Math.random() - 0.5) * 0.15;
  }

  scene.add(plane);
  planes.push(plane);
});

// Add colorful glowing borders around slides to tie in the alive theme
planes.forEach((plane, index) => {
  const edges = new THREE.EdgesGeometry(plane.geometry);
  const color = palette[index % palette.length];
  const lineMat = new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: 0.7, linewidth: 2 });
  const outline = new THREE.LineSegments(edges, lineMat);
  // Slightly scale the outline so it doesn't z-fight with the plane
  outline.scale.set(1.01, 1.01, 1.01);
  plane.add(outline);
});

// --------------------------------------------------------
// State & Animation Logic
// --------------------------------------------------------
let currentSlideIndex = 0;
let targetCameraZ = CAMERA_START_Z;
let targetCameraX = 0;
let targetCameraY = 0;
let isTransitioning = true; // Start transitioning to the first slide

const uiTitle = document.getElementById('slide-title');
const uiDesc = document.getElementById('slide-text');
const uiCounter = document.getElementById('slide-counter');
const btnPrev = document.getElementById('prev-btn');
const btnNext = document.getElementById('next-btn');
const descBox = document.getElementById('slide-description');

// Initial state - hide description immediately until transition finishes
descBox.classList.add('hidden');

function updateUI() {
  const data = slidesData[currentSlideIndex];
  
  uiTitle.innerText = data.title;
  uiDesc.innerText = data.desc;
  uiCounter.innerText = `${currentSlideIndex + 1} / ${slidesData.length}`;

  btnPrev.disabled = currentSlideIndex === 0;
  btnNext.disabled = currentSlideIndex === slidesData.length - 1;

  const targetPlane = planes[currentSlideIndex];
  targetCameraZ = targetPlane.position.z + CAMERA_START_Z;
  
  // Keep camera perfectly centered on the slide
  targetCameraX = 0;
  targetCameraY = 0;

  // Set transition state and hide description box while moving
  isTransitioning = true;
  descBox.classList.add('hidden');
}

function goToNextSlide() {
  if (currentSlideIndex < slidesData.length - 1) {
    currentSlideIndex++;
    updateUI();
  }
}

function goToPrevSlide() {
  if (currentSlideIndex > 0) {
    currentSlideIndex--;
    updateUI();
  }
}

btnNext.addEventListener('click', goToNextSlide);
btnPrev.addEventListener('click', goToPrevSlide);

window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goToNextSlide();
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') goToPrevSlide();
});

// --------------------------------------------------------
// Raycaster (Click Image to Go To Next Slide)
// --------------------------------------------------------
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

window.addEventListener('pointerdown', (event) => {
  // Prevent raycasting on UI elements
  if(event.target.closest('#ui-overlay') && !event.target.closest('.description-box.hidden')) {
      if (event.target.tagName === 'BUTTON') return;
  }

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  const currentPlane = planes[currentSlideIndex];
  const intersects = raycaster.intersectObject(currentPlane);

  if (intersects.length > 0) {
    // We clicked the image, go to next slide automatically
    goToNextSlide();
  }
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --------------------------------------------------------
// Render Loop
// --------------------------------------------------------
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  
  const delta = clock.getDelta();
  const time = clock.getElapsedTime();
  
  // Smoothly damp camera
  camera.position.z = THREE.MathUtils.damp(camera.position.z, targetCameraZ, 3, delta);
  camera.position.x = THREE.MathUtils.damp(camera.position.x, targetCameraX, 3, delta);
  camera.position.y = THREE.MathUtils.damp(camera.position.y, targetCameraY, 3, delta);
  
  // Check if camera has reached its target destination
  if (isTransitioning) {
    const distZ = Math.abs(camera.position.z - targetCameraZ);
    if (distZ < 0.1) {
      isTransitioning = false; // Transition complete
      
      const data = slidesData[currentSlideIndex];
      // Only show the description if it exists and is not empty
      if (data.desc && data.desc.trim() !== '') {
        descBox.classList.remove('hidden');
      }
    }
  }

  // Slowly rotate the particle universe (The Alive World)
  particleSystem.rotation.y = time * 0.03;
  particleSystem.rotation.x = time * 0.015;

  // Floating effect for planes (very slow and subtle)
  planes.forEach((plane, index) => {
    plane.position.y = Math.sin(time * 0.2 + index * 2) * 0.05;
  });

  // Animate the flying mascots
  mascots.forEach((sprite, i) => {
    // Offset their flight paths so they don't overlap
    const offset = i * Math.PI * 0.6;
    sprite.position.x = Math.sin(time * 0.5 + offset) * 25;
    sprite.position.y = Math.cos(time * 0.3 + offset) * 12 + 5;
    sprite.position.z = camera.position.z - 40 + Math.sin(time * 0.2 + offset) * 15;
  });

  renderer.render(scene, camera);
}

updateUI();
animate();
