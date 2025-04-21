// Party Environment: Transforms existing room to a house party using WebXR

let container;
let camera, scene, renderer;
let controller;
let reticle;
let hitTestSource = null;
let hitTestSourceRequested = false;
let partyElements = [];
let audioAnalyser;
let audioContext;
let dataArray;
let isARMode = false;
let controls;
let mouse = new THREE.Vector2();
let raycaster = new THREE.Raycaster();
let floor;
let stats; // For performance monitoring
let debugMode = true; // Enable debug features

// Party element models
const PARTY_ELEMENTS = {
    DISCO_BALL: 'disco-ball',
    SPEAKER: 'speaker',
    LIGHTS: 'lights',
    DANCE_FLOOR: 'dance-floor',
};

// Initialize the scene
init();
// Start animation loop
animate();

function init() {
    console.log("Initializing application...");
    
    container = document.createElement('div');
    document.body.appendChild(container);

    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000); // Set black background for non-AR mode

    // Set up camera
    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

    // Set up lighting
    const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
    light.position.set(0.5, 1, 0.25);
    scene.add(light);

    // Set up renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    container.appendChild(renderer.domElement);
    
    // Set renderer clear color for non-AR mode
    renderer.setClearColor(0x222222);

    // Create reticle for placing objects
    reticle = new THREE.Mesh(
        new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial()
    );
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    scene.add(reticle);

    // Set up controller for interaction
    controller = renderer.xr.getController(0);
    controller.addEventListener('select', onSelect);
    scene.add(controller);

    // Start AR session button
    document.getElementById('startButton').addEventListener('click', checkDeviceSupport);

    // Handle window resize
    window.addEventListener('resize', onWindowResize);
    
    // Add mouse event listeners for non-AR mode
    document.addEventListener('mousedown', onMouseDown, false);

    // Initialize stats for debugging
    if (debugMode) {
        stats = new Stats();
        document.body.appendChild(stats.dom);
        
        // Add debug grid
        const gridHelper = new THREE.GridHelper(10, 10);
        scene.add(gridHelper);
        
        // Add axes helper
        const axesHelper = new THREE.AxesHelper(5);
        scene.add(axesHelper);
        
        console.log("Debug mode enabled");
    }
    
    // Automatically check device support and start appropriate mode
    setTimeout(() => {
        console.log("Auto-checking device support...");
        checkDeviceSupport(true); // Pass true for automatic mode
    }, 500);
}

function checkDeviceSupport(autoStart = false) {
    console.log("Checking device support...");
    
    // Check if XR is available with AR support
    if ('xr' in navigator) {
        navigator.xr.isSessionSupported('immersive-ar')
            .then((supported) => {
                console.log("AR supported:", supported);
                
                if (supported) {
                    document.getElementById('startButton').textContent = 'Enter AR Mode';
                    
                    if (!autoStart) {
                        document.getElementById('startButton').addEventListener('click', startAR);
                    }
                } else {
                    console.log("AR not supported, initializing non-AR mode");
                    initNonARMode(autoStart);
                }
            })
            .catch(err => {
                console.error("Error checking XR support:", err);
                initNonARMode(autoStart);
            });
    } else {
        console.log("WebXR not available in this browser");
        initNonARMode(autoStart);
    }
}

function initNonARMode(autoStart = false) {
    console.log("Initializing non-AR mode");
    document.getElementById('info').textContent = 'AR not supported. Using fallback mode.';
    document.getElementById('startButton').textContent = 'Enter Party Mode';
    
    if (!autoStart) {
        document.getElementById('startButton').addEventListener('click', startNonARMode, { once: true });
    } else {
        // Auto start non-AR mode
        console.log("Auto-starting non-AR mode");
        startNonARMode();
    }
}

function startNonARMode() {
    console.log("Starting non-AR mode");
    isARMode = false;
    document.getElementById('startButton').classList.add('hidden');
    document.getElementById('info').textContent = 'Click to place party elements';

    // Create a room-like environment
    createFallbackEnvironment();

    // Initialize audio
    initAudio();
    
    // Add a test element for debugging
    if (debugMode) {
        console.log("Adding test disco ball");
        const discoBall = createDiscoBall();
        discoBall.position.set(0, 1.5, -3);
        scene.add(discoBall);
        partyElements.push({
            mesh: discoBall,
            type: PARTY_ELEMENTS.DISCO_BALL,
            createdAt: Date.now()
        });
        
        const lights = createPartyLights();
        lights.position.set(1, 1.5, -3);
        scene.add(lights);
        partyElements.push({
            mesh: lights,
            type: PARTY_ELEMENTS.LIGHTS,
            createdAt: Date.now()
        });
    }
    
    // Start microphone input
    startMicrophoneInput();

    // Add orbit controls for camera movement
    try {
        // First try dynamic import (for ES modules)
        import('https://cdn.jsdelivr.net/npm/three@0.132.2/examples/jsm/controls/OrbitControls.js')
            .then((module) => {
                console.log("Loaded OrbitControls via import()");
                const OrbitControls = module.OrbitControls;
                setupOrbitControls(OrbitControls);
            })
            .catch(e => {
                console.warn("Dynamic import failed:", e);
                
                // Fallback: try using THREE.OrbitControls if available
                if (typeof THREE.OrbitControls !== 'undefined') {
                    console.log("Using global THREE.OrbitControls");
                    setupOrbitControls(THREE.OrbitControls);
                } else {
                    console.error("OrbitControls not available");
                }
            });
    } catch(e) {
        console.error("Error setting up controls:", e);
    }
}

function setupOrbitControls(OrbitControlsClass) {
    controls = new OrbitControlsClass(camera, renderer.domElement);
    controls.target.set(0, 1, -3);
    controls.update();
    console.log("Orbit controls initialized");
}

function createFallbackEnvironment() {
    console.log("Creating fallback environment");
    
    // Create floor
    const floorGeometry = new THREE.PlaneGeometry(10, 10);
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x222222 });
    floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Create walls
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x555555 });
    
    // Back wall
    const backWallGeometry = new THREE.PlaneGeometry(10, 4);
    const backWall = new THREE.Mesh(backWallGeometry, wallMaterial);
    backWall.position.set(0, 2, -5);
    scene.add(backWall);
    
    // Left wall
    const leftWallGeometry = new THREE.PlaneGeometry(10, 4);
    const leftWall = new THREE.Mesh(leftWallGeometry, wallMaterial);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-5, 2, 0);
    scene.add(leftWall);
    
    // Right wall
    const rightWallGeometry = new THREE.PlaneGeometry(10, 4);
    const rightWall = new THREE.Mesh(rightWallGeometry, wallMaterial);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.set(5, 2, 0);
    scene.add(rightWall);

    // Better lights for non-AR mode
    const ambientLight = new THREE.AmbientLight(0x404040, 2);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(1, 3, 2);
    directionalLight.castShadow = true;
    scene.add(directionalLight);
    
    // Add a spotlight for dramatic effect
    const spotlight = new THREE.SpotLight(0xffffff, 1);
    spotlight.position.set(0, 5, 0);
    spotlight.angle = Math.PI / 4;
    spotlight.penumbra = 0.1;
    spotlight.decay = 2;
    spotlight.distance = 10;
    spotlight.castShadow = true;
    scene.add(spotlight);

    // Position camera for non-AR mode
    camera.position.set(0, 1.6, 2);
    camera.lookAt(0, 1, -3);
}

function onMouseDown(event) {
    if (!isARMode) {
        // Normalize mouse coordinates
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        // Set up the raycaster
        raycaster.setFromCamera(mouse, camera);
        
        // Find intersections with the floor
        const intersects = raycaster.intersectObject(floor);
        
        if (intersects.length > 0) {
            const point = intersects[0].point;
            
            // Create random party element
            const partyElementType = getRandomPartyElement();
            const element = createPartyElement(partyElementType);
            
            // Position at the intersection point
            element.position.copy(point);
            element.position.y += 0.01; // Lift slightly above floor
            element.matrixAutoUpdate = true;
            
            scene.add(element);
            partyElements.push({
                mesh: element,
                type: partyElementType,
                createdAt: Date.now()
            });
        }
    }
}

function startAR() {
    // Hide start button when entering AR
    document.getElementById('startButton').classList.add('hidden');
    isARMode = true;
    
    // Check if XR is available with AR support
    navigator.xr.isSessionSupported('immersive-ar')
        .then((supported) => {
            if (supported) {
                navigator.xr.requestSession('immersive-ar', {
                    requiredFeatures: ['hit-test', 'dom-overlay'],
                    domOverlay: { root: document.getElementById('info') }
                }).then(onSessionStarted);
            } else {
                document.getElementById('info').textContent = 'AR not supported on your device';
            }
        });
}

function onSessionStarted(session) {
    // Set up XR session
    session.addEventListener('end', onSessionEnded);
    renderer.xr.setReferenceSpaceType('local');
    renderer.xr.setSession(session);
    
    document.getElementById('info').textContent = 'Tap to place party elements';
    
    // Initialize audio when session starts
    initAudio();
}

function onSessionEnded() {
    document.getElementById('startButton').classList.remove('hidden');
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onSelect() {
    if (isARMode && reticle.visible) {
        // Create random party element when tapping on a surface
        const partyElementType = getRandomPartyElement();
        createPartyElement(partyElementType, reticle.matrix);
        
        // Start microphone input when first element is added
        if (partyElements.length === 1) {
            startMicrophoneInput();
        }
    }
}

function getRandomPartyElement() {
    const elements = Object.values(PARTY_ELEMENTS);
    return elements[Math.floor(Math.random() * elements.length)];
}

function createPartyElement(type, matrix) {
    let mesh;
    
    switch (type) {
        case PARTY_ELEMENTS.DISCO_BALL:
            mesh = createDiscoBall();
            break;
        case PARTY_ELEMENTS.SPEAKER:
            mesh = createSpeaker();
            break;
        case PARTY_ELEMENTS.LIGHTS:
            mesh = createPartyLights();
            break;
        case PARTY_ELEMENTS.DANCE_FLOOR:
            mesh = createDanceFloor();
            break;
        default:
            mesh = createDiscoBall();
    }
    
    // Position the element using the reticle's matrix if in AR mode
    if (matrix) {
        mesh.matrix.copy(matrix);
        mesh.matrix.multiply(new THREE.Matrix4().makeScale(0.5, 0.5, 0.5));
        mesh.matrixAutoUpdate = false;
    }
    
    return mesh;
}

function createDiscoBall() {
    const group = new THREE.Group();
    
    // Create disco ball sphere
    const ballGeometry = new THREE.SphereGeometry(0.15, 16, 16);
    const ballMaterial = new THREE.MeshPhongMaterial({
        color: 0xffffff,
        specular: 0xffffff,
        shininess: 100,
        flatShading: false,
    });
    
    const ball = new THREE.Mesh(ballGeometry, ballMaterial);
    
    // Add mirror-like facets
    const facetSize = 0.02;
    const facetGeometry = new THREE.PlaneGeometry(facetSize, facetSize);
    const facetMaterial = new THREE.MeshPhongMaterial({
        color: 0xffffff,
        specular: 0xffffff,
        shininess: 1000
    });
    
    for (let i = 0; i < 100; i++) {
        const facet = new THREE.Mesh(facetGeometry, facetMaterial);
        // Position facets randomly on the sphere
        const phi = Math.random() * Math.PI * 2;
        const theta = Math.random() * Math.PI;
        
        const radius = 0.16;
        facet.position.x = radius * Math.sin(theta) * Math.cos(phi);
        facet.position.y = radius * Math.sin(theta) * Math.sin(phi);
        facet.position.z = radius * Math.cos(theta);
        
        // Orient facets to face outward
        facet.lookAt(0, 0, 0);
        ball.add(facet);
    }
    
    // Add a string to hang the disco ball
    const stringGeometry = new THREE.CylinderGeometry(0.002, 0.002, 0.3);
    const stringMaterial = new THREE.MeshBasicMaterial({ color: 0x222222 });
    const string = new THREE.Mesh(stringGeometry, stringMaterial);
    string.position.y = 0.15;
    
    group.add(ball);
    group.add(string);
    
    // Position the disco ball above the floor
    group.position.y = 0.5;
    
    return group;
}

function createSpeaker() {
    const group = new THREE.Group();
    
    // Speaker body
    const bodyGeometry = new THREE.BoxGeometry(0.2, 0.4, 0.2);
    const bodyMaterial = new THREE.MeshPhongMaterial({ color: 0x111111 });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    
    // Speaker cone
    const coneGeometry = new THREE.CircleGeometry(0.08, 32);
    const coneMaterial = new THREE.MeshPhongMaterial({ color: 0x999999 });
    const cone = new THREE.Mesh(coneGeometry, coneMaterial);
    cone.position.z = 0.101;
    
    // Tweeter
    const tweeterGeometry = new THREE.CircleGeometry(0.02, 32);
    const tweeterMaterial = new THREE.MeshPhongMaterial({ color: 0xcccccc });
    const tweeter = new THREE.Mesh(tweeterGeometry, tweeterMaterial);
    tweeter.position.z = 0.102;
    tweeter.position.y = 0.12;
    
    group.add(body);
    group.add(cone);
    group.add(tweeter);
    
    group.position.y = 0.2;
    
    return group;
}

function createPartyLights() {
    const group = new THREE.Group();
    
    // Create base for lights
    const baseGeometry = new THREE.BoxGeometry(0.2, 0.05, 0.2);
    const baseMaterial = new THREE.MeshPhongMaterial({ color: 0x333333 });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    
    // Create light beams
    const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff];
    
    for (let i = 0; i < 5; i++) {
        const spotGeometry = new THREE.ConeGeometry(0.05, 0.1, 16);
        // Make the cone open-ended and hollow
        spotGeometry.openEnded = true;
        
        const spotMaterial = new THREE.MeshBasicMaterial({ 
            color: colors[i],
            transparent: true,
            opacity: 0.7,
            side: THREE.DoubleSide
        });
        
        const spot = new THREE.Mesh(spotGeometry, spotMaterial);
        spot.rotation.x = Math.PI; // Point downward
        spot.position.y = 0.05;
        
        // Position in a circle
        const angle = (i / 5) * Math.PI * 2;
        spot.position.x = Math.cos(angle) * 0.07;
        spot.position.z = Math.sin(angle) * 0.07;
        
        // Add light source
        const light = new THREE.PointLight(colors[i], 0.5, 1);
        light.position.copy(spot.position);
        
        group.add(spot);
        group.add(light);
    }
    
    group.add(base);
    group.position.y = 0.5; // Position above floor
    
    return group;
}

function createDanceFloor() {
    const size = 0.7;
    const segments = 8;
    const group = new THREE.Group();
    
    // Create grid of light-up tiles
    const tileSize = size / segments;
    
    for (let x = 0; x < segments; x++) {
        for (let z = 0; z < segments; z++) {
            const tileGeometry = new THREE.BoxGeometry(tileSize, 0.01, tileSize);
            
            // Alternate colors in a checkerboard pattern
            const isEven = (x + z) % 2 === 0;
            const color = isEven ? 0xff55ff : 0x5555ff;
            
            const tileMaterial = new THREE.MeshPhongMaterial({ 
                color: color,
                transparent: true,
                opacity: 0.8,
                emissive: color,
                emissiveIntensity: 0.3
            });
            
            const tile = new THREE.Mesh(tileGeometry, tileMaterial);
            
            // Position within the grid
            tile.position.x = (x - segments/2) * tileSize + tileSize/2;
            tile.position.z = (z - segments/2) * tileSize + tileSize/2;
            
            group.add(tile);
        }
    }
    
    // Position slightly above the floor to avoid z-fighting
    group.position.y = 0.005;
    
    return group;
}

function initAudio() {
    // Create audio context
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Create analyzer
    audioAnalyser = audioContext.createAnalyser();
    audioAnalyser.fftSize = 256;
    
    // Set up data array for analysis
    const bufferLength = audioAnalyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);
}

function startMicrophoneInput() {
    // Request microphone access
    navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        .then(stream => {
            // Create source from microphone stream
            const micSource = audioContext.createMediaStreamSource(stream);
            micSource.connect(audioAnalyser);
            
            // No need to connect to destination as we don't want to output the microphone audio
            // Only analyze it for visualization
            
            document.getElementById('info').textContent = 'Party mode active! Make some noise!';
        })
        .catch(error => {
            console.error('Error accessing microphone:', error);
            document.getElementById('info').textContent = 'Could not access microphone';
        });
}

function animate() {
    renderer.setAnimationLoop(render);
}

function render(timestamp, frame) {
    if (debugMode && stats) {
        stats.begin();
    }
    
    if (frame && isARMode) {
        const referenceSpace = renderer.xr.getReferenceSpace();
        const session = renderer.xr.getSession();
        
        // Perform hit test to place objects on real surfaces
        if (hitTestSourceRequested === false) {
            session.requestReferenceSpace('viewer').then(function (referenceSpace) {
                session.requestHitTestSource({ space: referenceSpace }).then(function (source) {
                    hitTestSource = source;
                });
            });
            
            hitTestSourceRequested = true;
        }
        
        if (hitTestSource) {
            const hitTestResults = frame.getHitTestResults(hitTestSource);
            
            if (hitTestResults.length) {
                const hit = hitTestResults[0];
                reticle.visible = true;
                reticle.matrix.fromArray(hit.getPose(referenceSpace).transform.matrix);
            } else {
                reticle.visible = false;
            }
        }
    }
    
    // Animate party elements
    animatePartyElements(timestamp);
    
    renderer.render(scene, camera);
    
    if (debugMode && stats) {
        stats.end();
    }
}

function animatePartyElements(timestamp) {
    // Get audio data if available
    if (audioAnalyser) {
        audioAnalyser.getByteFrequencyData(dataArray);
        
        // Calculate average frequency value for visual effects
        let avg = 0;
        for (let i = 0; i < dataArray.length; i++) {
            avg += dataArray[i];
        }
        avg = avg / dataArray.length;
        
        // Normalize the value between 0 and 1
        const intensity = avg / 255;
        
        // Apply visual effects based on audio
        applyAudioVisualEffects(intensity);
    }
    
    // Animate individual elements
    partyElements.forEach(element => {
        if (element.type === PARTY_ELEMENTS.DISCO_BALL) {
            // Rotate disco ball
            const discoBall = element.mesh.children[0];
            discoBall.rotation.y = timestamp * 0.001;
        } else if (element.type === PARTY_ELEMENTS.LIGHTS) {
            // Rotate party lights
            element.mesh.rotation.y = timestamp * 0.0005;
        } else if (element.type === PARTY_ELEMENTS.DANCE_FLOOR) {
            // Pulse dance floor
            const pulseIntensity = (Math.sin(timestamp * 0.003) + 1) / 2;
            
            element.mesh.children.forEach((tile, index) => {
                // Different phases for different tiles
                const phase = index * 0.1;
                const tileIntensity = (Math.sin(timestamp * 0.003 + phase) + 1) / 2;
                
                if (tile.material) {
                    tile.material.emissiveIntensity = 0.3 + tileIntensity * 0.7;
                }
            });
        }
    });
}

function applyAudioVisualEffects(intensity) {
    partyElements.forEach(element => {
        if (element.type === PARTY_ELEMENTS.SPEAKER) {
            // Make speaker cone pulse with music
            const cone = element.mesh.children[1];
            const scale = 1 + intensity * 0.3;
            cone.scale.set(scale, scale, 1);
        } else if (element.type === PARTY_ELEMENTS.LIGHTS) {
            // Adjust light intensity with music
            for (let i = 1; i < element.mesh.children.length; i += 2) {
                if (element.mesh.children[i].isLight) {
                    element.mesh.children[i].intensity = 0.3 + intensity * 0.7;
                }
            }
        } else if (element.type === PARTY_ELEMENTS.DANCE_FLOOR) {
            // Make dance floor respond to music
            element.mesh.children.forEach(tile => {
                if (tile.material) {
                    tile.material.emissiveIntensity = 0.2 + intensity * 0.8;
                }
            });
        }
    });
}
