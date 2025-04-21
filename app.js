import * as THREE from 'https://cdn.skypack.dev/three@0.136.0';
import { ARButton } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/webxr/ARButton.js';

// Initialize variables
let scene, camera, renderer;
let lightBeams = [];
const NUMBER_OF_BEAMS = 8;
const BEAM_HEIGHT = 1.5;
const BEAM_RADIUS = 0.05;
const CEILING_HEIGHT = 2.5; // Height above user where beams will appear

// Colors
const PURPLE_COLOR = new THREE.Color(0x8a2be2); // Bright purple
const LIGHT_PURPLE_COLOR = new THREE.Color(0xb19cd9); // Light purple

// Initialize the scene
function init() {
    // Remove loading overlay
    document.getElementById('loading-overlay').style.display = 'none';
    
    // Create scene
    scene = new THREE.Scene();
    
    // Create camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    
    // Create renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    document.body.appendChild(renderer.domElement);
    
    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    // Create AR button
    const arButton = ARButton.createButton(renderer, {
        requiredFeatures: ['hit-test'],
        optionalFeatures: ['dom-overlay'],
        domOverlay: { root: document.body }
    });
    document.body.appendChild(arButton);
    
    // Handle window resize
    window.addEventListener('resize', onWindowResize, false);
    
    // Create light beams when AR session starts
    renderer.xr.addEventListener('sessionstart', () => {
        createLightBeams();
    });
    
    // Start animation loop
    renderer.setAnimationLoop(render);
}

// Create light beams
function createLightBeams() {
    // Create a group to hold all beams
    const beamGroup = new THREE.Group();
    beamGroup.position.y = CEILING_HEIGHT; // Position above user
    scene.add(beamGroup);
    
    for (let i = 0; i < NUMBER_OF_BEAMS; i++) {
        // Create geometry and material for beam
        const geometry = new THREE.CylinderGeometry(BEAM_RADIUS, BEAM_RADIUS * 0.7, BEAM_HEIGHT, 32);
        const material = new THREE.MeshStandardMaterial({
            color: PURPLE_COLOR,
            emissive: PURPLE_COLOR,
            emissiveIntensity: 0.5,
            transparent: true,
            opacity: 0.8
        });
        
        // Create mesh for beam
        const beam = new THREE.Mesh(geometry, material);
        
        // Position beams in a circular pattern
        const angle = (i / NUMBER_OF_BEAMS) * Math.PI * 2;
        const radius = 1;
        beam.position.x = Math.cos(angle) * radius;
        beam.position.z = Math.sin(angle) * radius;
        beam.position.y = -BEAM_HEIGHT / 2; // Adjust to hang down from ceiling
        
        // Rotate beam to point down
        beam.rotation.x = Math.PI;
        
        // Add light source inside beam
        const pointLight = new THREE.PointLight(PURPLE_COLOR, 1, 2);
        pointLight.position.set(0, -BEAM_HEIGHT * 0.5, 0);
        beam.add(pointLight);
        
        // Add to beam group and array
        beamGroup.add(beam);
        lightBeams.push({
            mesh: beam,
            light: pointLight,
            material: material,
            initialIntensity: Math.random() * 0.5 + 0.5,
            flashSpeed: Math.random() * 0.05 + 0.02,
            flashOffset: Math.random() * Math.PI * 2
        });
    }
}

// Window resize handler
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Animation loop
function render(timestamp) {
    // Animate light beams
    if (lightBeams.length > 0) {
        lightBeams.forEach((beam, index) => {
            // Create pulsing/flashing effect
            const intensity = beam.initialIntensity * (0.7 + 0.5 * Math.sin(timestamp * beam.flashSpeed + beam.flashOffset));
            beam.material.emissiveIntensity = intensity;
            beam.light.intensity = intensity * 2;
            
            // Rotate beams slowly
            beam.mesh.rotation.y += 0.003;
            
            // Make beams sway slightly
            const swayAmount = 0.05;
            beam.mesh.rotation.z = Math.sin(timestamp * 0.001 + index) * swayAmount;
        });
    }
    
    renderer.render(scene, camera);
}

// Start the application
init();
