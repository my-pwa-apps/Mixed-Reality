import * as THREE from 'https://unpkg.com/three@0.152.0/build/three.module.js';
import { ARButton } from 'https://unpkg.com/three@0.152.0/examples/jsm/webxr/ARButton.js';

// Constants for the light beam configuration
const NUMBER_OF_BEAMS = 8;
const BEAM_HEIGHT = 1.5;
const BEAM_RADIUS = 0.05;
const CEILING_HEIGHT = 2.5; // Height above user where beams will appear

// Colors
const PURPLE_COLOR = new THREE.Color(0x8a2be2); // Bright purple
const LIGHT_PURPLE_COLOR = new THREE.Color(0xb19cd9); // Light purple

// Main variables
let scene, camera, renderer;
let lightBeams = [];
let arActive = false;
let clock = new THREE.Clock();

// Initialize the scene
function init() {
    // Hide loading overlay
    document.getElementById('loading-overlay').style.display = 'none';
    
    // Create scene
    scene = new THREE.Scene();
    
    // Create camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 3);
    
    // Create renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.xr.enabled = true;
    document.body.appendChild(renderer.domElement);
    
    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    // Add some directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(0, 10, 0);
    scene.add(directionalLight);
    
    // Create AR button
    const arButton = ARButton.createButton(renderer, {
        requiredFeatures: ['local'],
        optionalFeatures: ['dom-overlay'],
        domOverlay: { root: document.body },
        sessionInit: {
            optionalFeatures: ['light-estimation']
        }
    });
    document.body.appendChild(arButton);
    
    // Handle window resize
    window.addEventListener('resize', onWindowResize, false);
    
    // Create light beams
    createLightBeams();
    
    // Listen for AR session start/end
    renderer.xr.addEventListener('sessionstart', () => {
        console.log('AR session started');
        arActive = true;
    });
    
    renderer.xr.addEventListener('sessionend', () => {
        console.log('AR session ended');
        arActive = false;
    });
    
    // Start animation loop
    renderer.setAnimationLoop(animate);
}

// Window resize handler
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Create light beams
function createLightBeams() {
    // Create a group to hold all beams
    const beamGroup = new THREE.Group();
    scene.add(beamGroup);
    
    for (let i = 0; i < NUMBER_OF_BEAMS; i++) {
        // Create geometry and material for beam
        const geometry = new THREE.CylinderGeometry(BEAM_RADIUS, BEAM_RADIUS * 0.7, BEAM_HEIGHT, 32);
        
        // Use MeshPhongMaterial for better performance on mobile
        const material = new THREE.MeshPhongMaterial({
            color: PURPLE_COLOR,
            emissive: PURPLE_COLOR,
            emissiveIntensity: 0.5,
            transparent: true,
            opacity: 0.8,
            shininess: 100
        });
        
        // Create mesh for beam
        const beam = new THREE.Mesh(geometry, material);
        
        // Position beams in a circular pattern
        const angle = (i / NUMBER_OF_BEAMS) * Math.PI * 2;
        const radius = 1;
        beam.position.x = Math.cos(angle) * radius;
        beam.position.z = Math.sin(angle) * radius;
        beam.position.y = CEILING_HEIGHT; // Position at ceiling height
        
        // Rotate beam to point down
        beam.rotation.x = Math.PI;
        
        // Add light source inside beam
        const pointLight = new THREE.PointLight(0x8a2be2, 1, 2);
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
    
    // Add reference objects to show floor level in non-AR mode
    const floorGeometry = new THREE.CircleGeometry(2, 32);
    const floorMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x444444,
        transparent: true,
        opacity: 0.5
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.visible = true; // Only visible in non-AR mode
    beamGroup.add(floor);
    
    // Make floor invisible in AR
    renderer.xr.addEventListener('sessionstart', () => {
        floor.visible = false;
    });
    
    renderer.xr.addEventListener('sessionend', () => {
        floor.visible = true;
    });
}

// Animation loop
function animate() {
    const time = clock.getElapsedTime();
    
    // Rotate entire scene in non-AR mode for better viewing
    if (!arActive) {
        scene.rotation.y = time * 0.1;
    } else {
        // In AR mode, make sure scene is not rotating
        scene.rotation.set(0, 0, 0);
    }
    
    // Animate light beams
    if (lightBeams.length > 0) {
        lightBeams.forEach((beam, index) => {
            // Create pulsing/flashing effect
            const intensity = beam.initialIntensity * (0.7 + 0.5 * Math.sin(time * beam.flashSpeed + beam.flashOffset));
            beam.material.emissiveIntensity = intensity;
            beam.light.intensity = intensity * 2;
            
            // Make beams sway slightly
            const swayAmount = 0.05;
            beam.mesh.rotation.z = Math.sin(time * 0.5 + index) * swayAmount;
        });
    }
    
    // Render the scene
    renderer.render(scene, camera);
}

// Start the application
init();

// Matrix utility functions
const mat4 = {
    create: function() {
        return new Float32Array([
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1
        ]);
    },
    
    perspective: function(out, fovy, aspect, near, far) {
        const f = 1.0 / Math.tan(fovy / 2);
        out[0] = f / aspect;
        out[1] = 0;
        out[2] = 0;
        out[3] = 0;
        out[4] = 0;
        out[5] = f;
        out[6] = 0;
        out[7] = 0;
        out[8] = 0;
        out[9] = 0;
        out[10] = (far + near) / (near - far);
        out[11] = -1;
        out[12] = 0;
        out[13] = 0;
        out[14] = (2 * far * near) / (near - far);
        out[15] = 0;
        return out;
    },
    
    translate: function(out, a, v) {
        const x = v[0], y = v[1], z = v[2];
        
        out[0] = a[0]; out[1] = a[1]; out[2] = a[2]; out[3] = a[3];
        out[4] = a[4]; out[5] = a[5]; out[6] = a[6]; out[7] = a[7];
        out[8] = a[8]; out[9] = a[9]; out[10] = a[10]; out[11] = a[11];
        
        out[12] = a[0] * x + a[4] * y + a[8] * z + a[12];
        out[13] = a[1] * x + a[5] * y + a[9] * z + a[13];
        out[14] = a[2] * x + a[6] * y + a[10] * z + a[14];
        out[15] = a[3] * x + a[7] * y + a[11] * z + a[15];
        
        return out;
    },
    
    rotateX: function(out, a, rad) {
        const s = Math.sin(rad);
        const c = Math.cos(rad);
        const a10 = a[4];
        const a11 = a[5];
        const a12 = a[6];
        const a13 = a[7];
        const a20 = a[8];
        const a21 = a[9];
        const a22 = a[10];
        const a23 = a[11];
        
        out[0] = a[0];
        out[1] = a[1];
        out[2] = a[2];
        out[3] = a[3];
        
        out[4] = a10 * c + a20 * s;
        out[5] = a11 * c + a21 * s;
        out[6] = a12 * c + a22 * s;
        out[7] = a13 * c + a23 * s;
        
        out[8] = a20 * c - a10 * s;
        out[9] = a21 * c - a11 * s;
        out[10] = a22 * c - a12 * s;
        out[11] = a23 * c - a13 * s;
        
        out[12] = a[12];
        out[13] = a[13];
        out[14] = a[14];
        out[15] = a[15];
        return out;
    },
    
    rotateY: function(out, a, rad) {
        const s = Math.sin(rad);
        const c = Math.cos(rad);
        const a00 = a[0];
        const a01 = a[1];
        const a02 = a[2];
        const a03 = a[3];
        const a20 = a[8];
        const a21 = a[9];
        const a22 = a[10];
        const a23 = a[11];
        
        out[0] = a00 * c - a20 * s;
        out[1] = a01 * c - a21 * s;
        out[2] = a02 * c - a22 * s;
        out[3] = a03 * c - a23 * s;
        
        out[4] = a[4];
        out[5] = a[5];
        out[6] = a[6];
        out[7] = a[7];
        
        out[8] = a00 * s + a20 * c;
        out[9] = a01 * s + a21 * c;
        out[10] = a02 * s + a22 * c;
        out[11] = a03 * s + a23 * c;
        
        out[12] = a[12];
        out[13] = a[13];
        out[14] = a[14];
        out[15] = a[15];
        return out;
    },
    
    rotateZ: function(out, a, rad) {
        const s = Math.sin(rad);
        const c = Math.cos(rad);
        const a00 = a[0];
        const a01 = a[1];
        const a02 = a[2];
        const a03 = a[3];
        const a10 = a[4];
        const a11 = a[5];
        const a12 = a[6];
        const a13 = a[7];
        
        out[0] = a00 * c + a10 * s;
        out[1] = a01 * c + a11 * s;
        out[2] = a02 * c + a12 * s;
        out[3] = a03 * c + a13 * s;
        
        out[4] = a10 * c - a00 * s;
        out[5] = a11 * c - a01 * s;
        out[6] = a12 * c - a02 * s;
        out[7] = a13 * c - a03 * s;
        
        out[8] = a[8];
        out[9] = a[9];
        out[10] = a[10];
        out[11] = a[11];
        
        out[12] = a[12];
        out[13] = a[13];
        out[14] = a[14];
        out[15] = a[15];
        return out;
    },
    
    multiply: function(out, a, b) {
        const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
        const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
        const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
        const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
        
        let b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3];
        out[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
        out[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
        out[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
        out[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
        
        b0 = b[4]; b1 = b[5]; b2 = b[6]; b3 = b[7];
        out[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
        out[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
        out[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
        out[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
        
        b0 = b[8]; b1 = b[9]; b2 = b[10]; b3 = b[11];
        out[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
        out[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
        out[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
        out[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
        
        b0 = b[12]; b1 = b[13]; b2 = b[14]; b3 = b[15];
        out[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
        out[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
        out[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
        out[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
        
        return out;
    },
    
    invert: function(out, a) {
        const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
        const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
        const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
        const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
        
        const b00 = a00 * a11 - a01 * a10;
        const b01 = a00 * a12 - a02 * a10;
        const b02 = a00 * a13 - a03 * a10;
        const b03 = a01 * a12 - a02 * a11;
        const b04 = a01 * a13 - a03 * a11;
        const b05 = a02 * a13 - a03 * a12;
        const b06 = a20 * a31 - a21 * a30;
        const b07 = a20 * a32 - a22 * a30;
        const b08 = a20 * a33 - a23 * a30;
        const b09 = a21 * a32 - a22 * a31;
        const b10 = a21 * a33 - a23 * a31;
        const b11 = a22 * a33 - a23 * a32;
        
        let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
        if (!det) {
            return null;
        }
        det = 1.0 / det;
        
        out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
        out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
        out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
        out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
        out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
        out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
        out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
        out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
        out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
        out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
        out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
        out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
        out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
        out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
        out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
        out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
        
        return out;
    }
};

// Shader code
const vertexShaderSource = `
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec2 aTexCoord;

uniform mat4 uModelMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;
uniform float uIntensity;

varying vec3 vNormal;
varying vec2 vTexCoord;
varying vec3 vPosition;
varying float vIntensity;

void main() {
    vNormal = mat3(uModelMatrix) * aNormal;
    vTexCoord = aTexCoord;
    vPosition = vec3(uModelMatrix * vec4(aPosition, 1.0));
    vIntensity = uIntensity;
    
    gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(aPosition, 1.0);
}`;

const fragmentShaderSource = `
precision highp float;

varying vec3 vNormal;
varying vec2 vTexCoord;
varying vec3 vPosition;
varying float vIntensity;

uniform vec4 uColor;

void main() {
    vec3 normal = normalize(vNormal);
    vec3 lightDir = normalize(vec3(0.0, 1.0, 0.0));
    
    // Base color calculations
    vec4 purpleColor = uColor;
    
    // Radial gradient for glow effect
    float distFromCenter = length(vTexCoord - vec2(0.5, 0.5)) * 2.0;
    float radialGradient = 1.0 - smoothstep(0.0, 0.8, distFromCenter);
    
    // Combine base color with glow
    vec4 finalColor = purpleColor;
    finalColor.rgb *= 0.5 + vIntensity * 0.5; // Apply intensity
    
    // Apply glow effect with transparency
    finalColor.a = purpleColor.a * radialGradient * vIntensity;
    
    // Add extra glow
    finalColor.rgb += 0.2 * vIntensity * purpleColor.rgb;
    
    gl_FragColor = finalColor;
}`;

// Initialize the WebGL application
function init() {
    document.getElementById('loading-overlay').style.display = 'none';
    canvas = document.getElementById('webgl-canvas');
    
    // Initialize WebGL
    gl = canvas.getContext('webgl', { alpha: true, antialias: true });
    if (!gl) {
        alert('WebGL not supported in your browser!');
        return;
    }
    
    // Set up WebGL viewport
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Initialize shaders and programs
    const shaderProgram = initShaderProgram(gl, vertexShaderSource, fragmentShaderSource);
    programInfo = {
        program: shaderProgram,
        attribLocations: {
            position: gl.getAttribLocation(shaderProgram, 'aPosition'),
            normal: gl.getAttribLocation(shaderProgram, 'aNormal'),
            texCoord: gl.getAttribLocation(shaderProgram, 'aTexCoord'),
        },
        uniformLocations: {
            projectionMatrix: gl.getUniformLocation(shaderProgram, 'uProjectionMatrix'),
            viewMatrix: gl.getUniformLocation(shaderProgram, 'uViewMatrix'),
            modelMatrix: gl.getUniformLocation(shaderProgram, 'uModelMatrix'),
            color: gl.getUniformLocation(shaderProgram, 'uColor'),
            intensity: gl.getUniformLocation(shaderProgram, 'uIntensity'),
        },
    };
    
    // Setup for regular WebGL rendering (non-AR)
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    
    // Create light beams for regular WebGL mode
    createLightBeams();
    
    // Start non-AR rendering loop
    requestAnimationFrame(renderFrame);
    
    // Check if WebXR is supported and show AR button if it is
    if (navigator.xr) {
        navigator.xr.isSessionSupported('immersive-ar').then((supported) => {
            if (supported) {
                document.getElementById('ar-button').style.display = 'block';
                document.getElementById('ar-button').addEventListener('click', startAR);
            }
        });
    }
}

// Resize canvas to match window size
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
}

// Create and compile shader
function loadShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compilation error: ' + gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    
    return shader;
}

// Initialize shader program
function initShaderProgram(gl, vsSource, fsSource) {
    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);
    
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Shader program linking error: ' + gl.getProgramInfoLog(program));
        return null;
    }
    
    return program;
}

// Start AR session
function startAR() {
    if (!navigator.xr) {
        alert('WebXR not available in your browser');
        return;
    }
    
    navigator.xr.isSessionSupported('immersive-ar').then((supported) => {
        if (!supported) {
            alert('Immersive AR not supported in this browser or device');
            return;
        }
        
        // Simplified AR session request - removed dependency on hit-test
        navigator.xr.requestSession('immersive-ar', {
            optionalFeatures: ['dom-overlay'],
            domOverlay: { root: document.body }
        }).then(onSessionStarted).catch(err => {
            console.error('Error starting AR session:', err);
            alert('Failed to start AR session: ' + err.message);
        });
    });
}

// Initialize AR session
function onSessionStarted(session) {
    xrSession = session;
    
    session.addEventListener('end', onSessionEnded);
    
    // Configure WebGL layer for the session
    const glLayer = new XRWebGLLayer(session, gl, {
        antialias: true,
        alpha: true
    });
    
    // Set up the layer as the session's baseLayer
    session.updateRenderState({
        baseLayer: glLayer
    });
    
    // Configure WebGL for XR
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    
    // Get reference space - simplified to just use the local space
    session.requestReferenceSpace('local').then((refSpace) => {
        xrReferenceSpace = refSpace;
        
        console.log("AR Session started successfully with reference space");
        
        // No need to recreate beams - they're already created
        // Just start the XR render loop
        session.requestAnimationFrame(onXRFrame);
    }).catch(err => {
        console.error("Error requesting reference space:", err);
    });
}

// Handle AR session end
function onSessionEnded() {
    xrSession = null;
    xrReferenceSpace = null;
    xrViewerSpace = null;
    if (xrHitTestSource) xrHitTestSource.cancel();
    xrHitTestSource = null;
}

// Create light beam geometry
function createCylinderGeometry(radius, height, segments) {
    const vertices = [];
    const normals = [];
    const texCoords = [];
    const indices = [];
    
    // Generate vertices for top and bottom caps and the sides
    for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        const x = Math.cos(theta) * radius;
        const z = Math.sin(theta) * radius;
        
        // Bottom cap vertex
        vertices.push(x, 0, z);
        normals.push(0, -1, 0);
        texCoords.push(i / segments, 0);
        
        // Top cap vertex
        vertices.push(x, height, z);
        normals.push(0, 1, 0);
        texCoords.push(i / segments, 1);
        
        // Side vertices
        vertices.push(x, 0, z);
        normals.push(x, 0, z);
        texCoords.push(i / segments, 0);
        
        vertices.push(x, height, z);
        normals.push(x, 0, z);
        texCoords.push(i / segments, 1);
    }
    
    // Generate indices for the sides
    for (let i = 0; i < segments; i++) {
        const start = i * 4;
        
        // Side triangles
        indices.push(start + 2, start + 3, start + 6);
        indices.push(start + 6, start + 7, start + 3);
        
        // Bottom cap
        indices.push(0, start, start + 4);
        
        // Top cap
        indices.push(1, start + 5, start + 1);
    }
    
    return {
        position: vertices,
        normal: normals,
        texCoord: texCoords,
        indices: indices
    };
}

// Create light beams
function createLightBeams() {
    cylinders = [];
    
    for (let i = 0; i < NUMBER_OF_BEAMS; i++) {
        const geometry = createCylinderGeometry(BEAM_RADIUS, BEAM_HEIGHT, 32);
        
        // Create buffers for geometry
        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geometry.position), gl.STATIC_DRAW);
        
        const normalBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geometry.normal), gl.STATIC_DRAW);
        
        const texCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geometry.texCoord), gl.STATIC_DRAW);
        
        const indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(geometry.indices), gl.STATIC_DRAW);
        
        // Position beams in a circular pattern
        const angle = (i / NUMBER_OF_BEAMS) * Math.PI * 2;
        const radius = 1;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        
        // Create model matrix for this beam
        const modelMatrix = mat4.create();
        mat4.translate(modelMatrix, modelMatrix, [x, CEILING_HEIGHT, z]);
        mat4.rotateX(modelMatrix, modelMatrix, Math.PI); // Rotate to point down
        
        // Add beam configuration
        cylinders.push({
            buffers: {
                position: positionBuffer,
                normal: normalBuffer,
                texCoord: texCoordBuffer,
                index: indexBuffer,
            },
            modelMatrix: modelMatrix,
            indexCount: geometry.indices.length,
            initialIntensity: Math.random() * 0.5 + 0.5,
            flashSpeed: Math.random() * 0.05 + 0.02,
            flashOffset: Math.random() * Math.PI * 2,
            rotationSpeed: 0.003,
            swayAmount: 0.05
        });
    }
}

// Non-AR browser render loop
function renderFrame(timestamp) {
    if (!xrSession) {
        requestAnimationFrame(renderFrame);
        
        // Clear the canvas
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        
        // Use our shader program
        gl.useProgram(programInfo.program);
        
        // Update animation timing
        const deltaTime = timestamp - lastTimestamp;
        lastTimestamp = timestamp;
        
        // Set up basic camera for browser view
        const projectionMatrix = mat4.create();
        mat4.perspective(projectionMatrix, Math.PI / 3, canvas.width / canvas.height, 0.1, 100);
        gl.uniformMatrix4fv(programInfo.uniformLocations.projectionMatrix, false, projectionMatrix);
        
        // Create camera view matrix (looking slightly down at the beams)
        const viewMatrix = mat4.create();
        mat4.translate(viewMatrix, viewMatrix, [0, -1.0, -5.0]);
        mat4.rotateX(viewMatrix, viewMatrix, 0.3); // Look down slightly
        gl.uniformMatrix4fv(programInfo.uniformLocations.viewMatrix, false, viewMatrix);
        
        // Render each light beam
        renderLightBeams(timestamp);
    }
}

// Shared function to render light beams used by both AR and non-AR modes
function renderLightBeams(timestamp) {
    for (let i = 0; i < cylinders.length; i++) {
        const cylinder = cylinders[i];
        
        // Update beam animation
        const intensity = cylinder.initialIntensity * (0.7 + 0.5 * Math.sin(timestamp * cylinder.flashSpeed + cylinder.flashOffset));
        
        // Create a temporary model matrix with animations applied
        const animatedModelMatrix = mat4.create();
        mat4.multiply(animatedModelMatrix, animatedModelMatrix, cylinder.modelMatrix);
        
        // Rotate beams slowly
        mat4.rotateY(animatedModelMatrix, animatedModelMatrix, timestamp * 0.001 * cylinder.rotationSpeed);
        
        // Make beams sway slightly
        mat4.rotateZ(animatedModelMatrix, animatedModelMatrix, Math.sin(timestamp * 0.001 + i) * cylinder.swayAmount);
        
        // Set model matrix uniform
        gl.uniformMatrix4fv(programInfo.uniformLocations.modelMatrix, false, animatedModelMatrix);
        
        // Set color uniform
        gl.uniform4fv(programInfo.uniformLocations.color, PURPLE_COLOR);
        
        // Set intensity uniform
        gl.uniform1f(programInfo.uniformLocations.intensity, intensity);
        
        // Set up attributes
        // Position
        gl.bindBuffer(gl.ARRAY_BUFFER, cylinder.buffers.position);
        gl.vertexAttribPointer(programInfo.attribLocations.position, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(programInfo.attribLocations.position);
        
        // Normal
        gl.bindBuffer(gl.ARRAY_BUFFER, cylinder.buffers.normal);
        gl.vertexAttribPointer(programInfo.attribLocations.normal, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(programInfo.attribLocations.normal);
        
        // TexCoord
        gl.bindBuffer(gl.ARRAY_BUFFER, cylinder.buffers.texCoord);
        gl.vertexAttribPointer(programInfo.attribLocations.texCoord, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(programInfo.attribLocations.texCoord);
        
        // Draw the beam
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cylinder.buffers.index);
        gl.drawElements(gl.TRIANGLES, cylinder.indexCount, gl.UNSIGNED_SHORT, 0);
    }
}

// XR render loop function
function onXRFrame(timestamp, frame) {
    const session = frame.session;
    session.requestAnimationFrame(onXRFrame);
    
    // Get pose
    const pose = frame.getViewerPose(xrReferenceSpace);
    if (!pose) {
        return;
    }
    
    // Bind WebGL to XR framebuffer
    const glLayer = session.renderState.baseLayer;
    gl.bindFramebuffer(gl.FRAMEBUFFER, glLayer.framebuffer);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    // Use our shader program
    gl.useProgram(programInfo.program);
    
    // Update animation timing
    const deltaTime = timestamp - lastTimestamp;
    lastTimestamp = timestamp;
    
    // Render for each view (left/right eye)
    for (const view of pose.views) {
        const viewport = glLayer.getViewport(view);
        gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);
        
        // Update projection matrix
        const projectionMatrix = view.projectionMatrix;
        gl.uniformMatrix4fv(programInfo.uniformLocations.projectionMatrix, false, projectionMatrix);
        
        // Update view matrix
        const viewMatrix = view.transform.inverse.matrix;
        gl.uniformMatrix4fv(programInfo.uniformLocations.viewMatrix, false, viewMatrix);
        
        // Render each light beam
        renderLightBeams(timestamp);
    }
}

// Start the application
init();
