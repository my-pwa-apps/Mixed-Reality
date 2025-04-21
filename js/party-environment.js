/**
 * WebXR Party Environment
 * Transforms existing room to a house party using WebXR
 * Both AR and non-AR modes supported
 */

// Global variables
let container, camera, scene, renderer;
let controller, reticle;
let hitTestSource = null;
let hitTestSourceRequested = false;
let partyElements = [];
let audioAnalyser, audioContext, dataArray;
let isARMode = false;
let controls;
let mouse = new THREE.Vector2();
let raycaster = new THREE.Raycaster();
let floor;
let stats;
const debugMode = true;

// Party element types
const PARTY_ELEMENT = {
    DISCO_BALL: 'disco-ball',
    SPEAKER: 'speaker',
    LIGHTS: 'lights',
    DANCE_FLOOR: 'dance-floor',
};

// Performance optimization: Pre-create materials and geometries
const MATERIALS = {
    floor: new THREE.MeshStandardMaterial({ color: 0x222222 }),
    wall: new THREE.MeshStandardMaterial({ color: 0x555555 }),
    discoball: new THREE.MeshPhongMaterial({
        color: 0xffffff,
        specular: 0xffffff,
        shininess: 100
    }),
    facet: new THREE.MeshPhongMaterial({
        color: 0xffffff,
        specular: 0xffffff,
        shininess: 1000
    }),
    speaker: new THREE.MeshPhongMaterial({ color: 0x111111 }),
    speakerCone: new THREE.MeshPhongMaterial({ color: 0x999999 }),
    string: new THREE.MeshBasicMaterial({ color: 0x222222 }),
    lightBase: new THREE.MeshPhongMaterial({ color: 0x333333 }),
};

// Initialize the scene and start animation
init();
animate();

/**
 * Initialize the 3D scene and WebXR
 */
function init() {
    // Create container
    container = document.createElement('div');
    document.body.appendChild(container);

    // Set up scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    // Set up camera
    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

    // Add basic hemisphere light
    const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
    light.position.set(0.5, 1, 0.25);
    scene.add(light);

    // Set up renderer with optimized settings
    renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    renderer.setClearColor(0x222222);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // Set up AR placement reticle
    reticle = new THREE.Mesh(
        new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial()
    );
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    scene.add(reticle);

    // Set up XR controller
    controller = renderer.xr.getController(0);
    controller.addEventListener('select', onSelect);
    scene.add(controller);

    // Set event listeners
    document.getElementById('startButton').addEventListener('click', checkDeviceSupport);
    window.addEventListener('resize', onWindowResize);
    document.addEventListener('mousedown', onMouseDown, false);

    // Set up debug tools if enabled
    if (debugMode) {
        initDebugTools();
    }

    // Automatically check device support
    setTimeout(() => checkDeviceSupport(true), 500);
}

/**
 * Set up debug tools and performance monitoring
 */
function initDebugTools() {
    stats = new Stats();
    document.body.appendChild(stats.dom);
    
    const gridHelper = new THREE.GridHelper(10, 10);
    scene.add(gridHelper);
    
    const axesHelper = new THREE.AxesHelper(5);
    scene.add(axesHelper);
}

/**
 * Check if device supports AR and choose appropriate mode
 */
function checkDeviceSupport(autoStart = false) {
    if ('xr' in navigator) {
        navigator.xr.isSessionSupported('immersive-ar')
            .then((supported) => {
                if (supported) {
                    document.getElementById('startButton').textContent = 'Enter AR Mode';
                    if (!autoStart) {
                        document.getElementById('startButton').addEventListener('click', startAR);
                    }
                } else {
                    initNonARMode(autoStart);
                }
            })
            .catch(() => initNonARMode(autoStart));
    } else {
        initNonARMode(autoStart);
    }
}

/**
 * Initialize fallback non-AR mode
 */
function initNonARMode(autoStart = false) {
    document.getElementById('info').textContent = 'AR not supported. Using fallback mode.';
    document.getElementById('startButton').textContent = 'Enter Party Mode';
    
    if (!autoStart) {
        document.getElementById('startButton').addEventListener('click', startNonARMode, { once: true });
    } else {
        startNonARMode();
    }
}

/**
 * Start non-AR party mode
 */
function startNonARMode() {
    isARMode = false;
    document.getElementById('startButton').classList.add('hidden');
    document.getElementById('info').textContent = 'Click to place party elements';

    createFallbackEnvironment();
    initAudio();
    
    // Add sample elements for preview
    addSampleElements();
    
    // Start microphone input
    startMicrophoneInput();

    // Add orbit controls
    loadOrbitControls();
}

/**
 * Add sample party elements to the scene in non-AR mode
 */
function addSampleElements() {
    // Add disco ball
    const discoBall = createDiscoBall();
    discoBall.position.set(0, 1.5, -3);
    scene.add(discoBall);
    partyElements.push({
        mesh: discoBall,
        type: PARTY_ELEMENT.DISCO_BALL,
        createdAt: Date.now()
    });
    
    // Add party lights
    const lights = createPartyLights();
    lights.position.set(1, 1.5, -3);
    scene.add(lights);
    partyElements.push({
        mesh: lights,
        type: PARTY_ELEMENT.LIGHTS,
        createdAt: Date.now()
    });
    
    // Add dance floor
    const danceFloor = createDanceFloor();
    danceFloor.position.set(0, 0.005, -3);
    scene.add(danceFloor);
    partyElements.push({
        mesh: danceFloor,
        type: PARTY_ELEMENT.DANCE_FLOOR,
        createdAt: Date.now()
    });
}

/**
 * Load orbit controls with fallback options
 */
function loadOrbitControls() {
    // Try loading OrbitControls with several fallback methods
    try {
        if (typeof THREE.OrbitControls !== 'undefined') {
            setupOrbitControls(THREE.OrbitControls);
        } else {
            // Dynamic import as fallback
            import('https://cdn.jsdelivr.net/npm/three@0.132.2/examples/jsm/controls/OrbitControls.js')
                .then((module) => {
                    setupOrbitControls(module.OrbitControls);
                })
                .catch(() => console.error("OrbitControls not available"));
        }
    } catch(e) {
        console.error("Error setting up controls:", e);
    }
}

/**
 * Initialize orbit controls for camera
 */
function setupOrbitControls(OrbitControlsClass) {
    controls = new OrbitControlsClass(camera, renderer.domElement);
    controls.target.set(0, 1, -3);
    controls.update();
}

/**
 * Create a virtual environment for non-AR mode
 */
function createFallbackEnvironment() {
    // Create floor
    const floorGeometry = new THREE.PlaneGeometry(10, 10);
    floor = new THREE.Mesh(floorGeometry, MATERIALS.floor);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Create walls
    createWalls();

    // Add enhanced lighting
    createLighting();

    // Position camera
    camera.position.set(0, 1.6, 2);
    camera.lookAt(0, 1, -3);
}

/**
 * Create walls for the virtual room
 */
function createWalls() {
    // Reuse wall geometry for performance
    const wallGeometry = new THREE.PlaneGeometry(10, 4);
    
    // Back wall
    const backWall = new THREE.Mesh(wallGeometry, MATERIALS.wall);
    backWall.position.set(0, 2, -5);
    scene.add(backWall);
    
    // Left wall
    const leftWall = new THREE.Mesh(wallGeometry, MATERIALS.wall);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-5, 2, 0);
    scene.add(leftWall);
    
    // Right wall
    const rightWall = new THREE.Mesh(wallGeometry, MATERIALS.wall);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.set(5, 2, 0);
    scene.add(rightWall);
}

/**
 * Create lighting for the virtual room
 */
function createLighting() {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0x404040, 2);
    scene.add(ambientLight);

    // Main directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(1, 3, 2);
    directionalLight.castShadow = true;
    
    // Optimize shadow settings
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 10;
    directionalLight.shadow.bias = -0.001;
    
    scene.add(directionalLight);
    
    // Add spotlight for dramatic effect
    const spotlight = new THREE.SpotLight(0xffffff, 1);
    spotlight.position.set(0, 5, 0);
    spotlight.angle = Math.PI / 4;
    spotlight.penumbra = 0.1;
    spotlight.decay = 2;
    spotlight.distance = 10;
    spotlight.castShadow = true;
    scene.add(spotlight);
}

/**
 * Handle mouse click in non-AR mode
 */
function onMouseDown(event) {
    if (!isARMode) {
        // Calculate mouse position and raycast to floor
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObject(floor);
        
        if (intersects.length > 0) {
            placeElementAtPoint(intersects[0].point);
        }
    }
}

/**
 * Place a party element at the specified point
 */
function placeElementAtPoint(point) {
    const partyElementType = getRandomPartyElement();
    const element = createPartyElement(partyElementType);
    
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

/**
 * Start AR mode
 */
function startAR() {
    document.getElementById('startButton').classList.add('hidden');
    isARMode = true;
    
    navigator.xr.requestSession('immersive-ar', {
        requiredFeatures: ['hit-test', 'dom-overlay'],
        domOverlay: { root: document.getElementById('info') }
    }).then(onSessionStarted);
}

/**
 * Set up XR session
 */
function onSessionStarted(session) {
    session.addEventListener('end', onSessionEnded);
    renderer.xr.setReferenceSpaceType('local');
    renderer.xr.setSession(session);
    
    document.getElementById('info').textContent = 'Tap to place party elements';
    
    // Initialize audio when session starts
    initAudio();
}

/**
 * Clean up after XR session ends
 */
function onSessionEnded() {
    document.getElementById('startButton').classList.remove('hidden');
}

/**
 * Handle window resize events
 */
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

/**
 * Handle selection in AR mode
 */
function onSelect() {
    if (isARMode && reticle.visible) {
        const partyElementType = getRandomPartyElement();
        const element = createPartyElement(partyElementType, reticle.matrix);
        
        scene.add(element);
        partyElements.push({
            mesh: element,
            type: partyElementType,
            createdAt: Date.now()
        });
        
        // Start microphone input when first element is added
        if (partyElements.length === 1) {
            startMicrophoneInput();
        }
    }
}

/**
 * Get a random party element type
 */
function getRandomPartyElement() {
    const elements = Object.values(PARTY_ELEMENT);
    return elements[Math.floor(Math.random() * elements.length)];
}

/**
 * Create a party element of the specified type
 */
function createPartyElement(type, matrix) {
    let mesh;
    
    switch (type) {
        case PARTY_ELEMENT.DISCO_BALL:
            mesh = createDiscoBall();
            break;
        case PARTY_ELEMENT.SPEAKER:
            mesh = createSpeaker();
            break;
        case PARTY_ELEMENT.LIGHTS:
            mesh = createPartyLights();
            break;
        case PARTY_ELEMENT.DANCE_FLOOR:
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

/**
 * Create a disco ball object
 * Optimized version with instanced facets for better performance
 */
function createDiscoBall() {
    const group = new THREE.Group();
    
    // Create disco ball sphere - reduced polygon count
    const ballGeometry = new THREE.SphereGeometry(0.15, 12, 12);
    const ball = new THREE.Mesh(ballGeometry, MATERIALS.discoball);
    
    // Use instanced geometry for mirror facets
    const facetSize = 0.02;
    const facetGeometry = new THREE.PlaneGeometry(facetSize, facetSize);
    const instancedFacets = new THREE.InstancedMesh(
        facetGeometry, 
        MATERIALS.facet,
        50 // Reduced count but still looks good
    );
    
    const dummy = new THREE.Object3D();
    const radius = 0.16;
    
    // Position facets
    for (let i = 0; i < 50; i++) {
        const phi = Math.random() * Math.PI * 2;
        const theta = Math.random() * Math.PI;
        
        dummy.position.x = radius * Math.sin(theta) * Math.cos(phi);
        dummy.position.y = radius * Math.sin(theta) * Math.sin(phi);
        dummy.position.z = radius * Math.cos(theta);
        
        // Orient facets to face outward
        dummy.lookAt(0, 0, 0);
        dummy.updateMatrix();
        
        instancedFacets.setMatrixAt(i, dummy.matrix);
    }
    
    ball.add(instancedFacets);
    
    // Add a string to hang the disco ball
    const stringGeometry = new THREE.CylinderGeometry(0.002, 0.002, 0.3);
    const string = new THREE.Mesh(stringGeometry, MATERIALS.string);
    string.position.y = 0.15;
    
    group.add(ball);
    group.add(string);
    
    group.position.y = 0.5;
    
    return group;
}

/**
 * Create a speaker object
 */
function createSpeaker() {
    const group = new THREE.Group();
    
    // Speaker body
    const bodyGeometry = new THREE.BoxGeometry(0.2, 0.4, 0.2);
    const body = new THREE.Mesh(bodyGeometry, MATERIALS.speaker);
    
    // Speaker cone
    const coneGeometry = new THREE.CircleGeometry(0.08, 32);
    const cone = new THREE.Mesh(coneGeometry, MATERIALS.speakerCone);
    cone.position.z = 0.101;
    
    // Tweeter
    const tweeterGeometry = new THREE.CircleGeometry(0.02, 16); // Reduced segments
    const tweeter = new THREE.Mesh(tweeterGeometry, MATERIALS.speakerCone);
    tweeter.position.z = 0.102;
    tweeter.position.y = 0.12;
    
    group.add(body);
    group.add(cone);
    group.add(tweeter);
    
    group.position.y = 0.2;
    
    return group;
}

/**
 * Create party lights object
 * Optimized for better performance
 */
function createPartyLights() {
    const group = new THREE.Group();
    
    // Create base for lights
    const baseGeometry = new THREE.BoxGeometry(0.2, 0.05, 0.2);
    const base = new THREE.Mesh(baseGeometry, MATERIALS.lightBase);
    group.add(base);
    
    // Create light beams
    const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff];
    const spotGeometry = new THREE.ConeGeometry(0.05, 0.1, 16);
    spotGeometry.openEnded = true;
    
    for (let i = 0; i < colors.length; i++) {
        // Create material for this specific color
        const spotMaterial = new THREE.MeshBasicMaterial({ 
            color: colors[i],
            transparent: true,
            opacity: 0.7,
            side: THREE.DoubleSide
        });
        
        const spot = new THREE.Mesh(spotGeometry, spotMaterial);
        spot.rotation.x = Math.PI;
        spot.position.y = 0.05;
        
        // Position in a circle
        const angle = (i / colors.length) * Math.PI * 2;
        spot.position.x = Math.cos(angle) * 0.07;
        spot.position.z = Math.sin(angle) * 0.07;
        
        // Add light source
        const light = new THREE.PointLight(colors[i], 0.5, 1);
        light.position.copy(spot.position);
        
        group.add(spot);
        group.add(light);
    }
    
    group.position.y = 0.5;
    
    return group;
}

/**
 * Create dance floor object
 * Optimized version with instanced meshes for better performance
 */
function createDanceFloor() {
    const size = 0.7;
    const segments = 8; // Keep 8×8 grid
    const group = new THREE.Group();
    
    // Use two instanced meshes (one for each color) instead of 64 individual meshes
    const tileSize = size / segments;
    const tileGeometry = new THREE.BoxGeometry(tileSize, 0.01, tileSize);
    
    // Create two instance meshes for the two colors
    const color1 = 0xff55ff;
    const color2 = 0x5555ff;
    
    const material1 = new THREE.MeshPhongMaterial({ 
        color: color1, 
        transparent: true,
        opacity: 0.8,
        emissive: color1,
        emissiveIntensity: 0.3
    });
    
    const material2 = new THREE.MeshPhongMaterial({ 
        color: color2, 
        transparent: true,
        opacity: 0.8,
        emissive: color2,
        emissiveIntensity: 0.3
    });
    
    // Create instanced meshes - one for each color
    const evenTiles = new THREE.InstancedMesh(tileGeometry, material1, 32);
    const oddTiles = new THREE.InstancedMesh(tileGeometry, material2, 32);
    
    // Position the tiles
    const dummy = new THREE.Object3D();
    let evenIndex = 0;
    let oddIndex = 0;
    
    for (let x = 0; x < segments; x++) {
        for (let z = 0; z < segments; z++) {
            dummy.position.x = (x - segments/2) * tileSize + tileSize/2;
            dummy.position.z = (z - segments/2) * tileSize + tileSize/2;
            dummy.updateMatrix();
            
            // Alternate between even and odd tiles
            if ((x + z) % 2 === 0) {
                evenTiles.setMatrixAt(evenIndex, dummy.matrix);
                evenIndex++;
            } else {
                oddTiles.setMatrixAt(oddIndex, dummy.matrix);
                oddIndex++;
            }
        }
    }
    
    group.add(evenTiles);
    group.add(oddTiles);
    
    // Store references for audio reactivity
    evenTiles.userData = { material: material1 };
    oddTiles.userData = { material: material2 };
    
    // Position slightly above the floor to avoid z-fighting
    group.position.y = 0.005;
    
    return group;
}

/**
 * Initialize audio context and analyser
 */
function initAudio() {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    audioAnalyser = audioContext.createAnalyser();
    audioAnalyser.fftSize = 256;
    
    // Set up data array for analysis
    const bufferLength = audioAnalyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);
}

/**
 * Start microphone input for audio analysis
 */
function startMicrophoneInput() {
    navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        .then(stream => {
            // Create source from microphone stream
            const micSource = audioContext.createMediaStreamSource(stream);
            micSource.connect(audioAnalyser);
            
            document.getElementById('info').textContent = 'Party mode active! Make some noise!';
        })
        .catch(error => {
            console.error('Error accessing microphone:', error);
            document.getElementById('info').textContent = 'Could not access microphone';
        });
}

/**
 * Animation loop
 */
function animate() {
    renderer.setAnimationLoop(render);
}

/**
 * Render the scene
 */
function render(timestamp, frame) {
    if (debugMode && stats) {
        stats.begin();
    }
    
    // AR hit testing
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

/**
 * Apply audio-reactive effects to party elements
 */
function animatePartyElements(timestamp) {
    // Process audio data
    if (audioAnalyser) {
        audioAnalyser.getByteFrequencyData(dataArray);
        
        // Calculate average frequency value for visual effects
        let avg = 0;
        for (let i = 0; i < dataArray.length; i++) {
            avg += dataArray[i];
        }
        avg = avg / dataArray.length;
        
        // Normalized intensity
        const intensity = Math.min(avg / 255, 1);
        
        // Apply effects
        applyAudioVisualEffects(intensity);
    }
    
    // Animate all elements based on time
    partyElements.forEach(element => {
        const mesh = element.mesh;
        
        switch(element.type) {
            case PARTY_ELEMENT.DISCO_BALL:
                // Rotate disco ball
                if (mesh.children[0]) {
                    mesh.children[0].rotation.y = timestamp * 0.001;
                }
                break;
                
            case PARTY_ELEMENT.LIGHTS:
                // Rotate party lights
                mesh.rotation.y = timestamp * 0.0005;
                break;
                
            case PARTY_ELEMENT.DANCE_FLOOR:
                // Dance floor animations handled in applyAudioVisualEffects
                break;
        }
    });
}

/**
 * Apply audio-reactive visual effects to elements
 */
function applyAudioVisualEffects(intensity) {
    partyElements.forEach(element => {
        switch(element.type) {
            case PARTY_ELEMENT.SPEAKER:
                // Speaker cone pulsing
                if (element.mesh.children[1]) {
                    const cone = element.mesh.children[1];
                    const scale = 1 + intensity * 0.3;
                    cone.scale.set(scale, scale, 1);
                }
                break;
                
            case PARTY_ELEMENT.LIGHTS:
                // Light intensity
                for (let i = 1; i < element.mesh.children.length; i += 2) {
                    if (element.mesh.children[i].isLight) {
                        element.mesh.children[i].intensity = 0.3 + intensity * 0.7;
                    }
                }
                break;
                
            case PARTY_ELEMENT.DANCE_FLOOR:
                // Handle instanced meshes for dance floor
                element.mesh.children.forEach(instancedMesh => {
                    if (instancedMesh.userData && instancedMesh.userData.material) {
                        instancedMesh.userData.material.emissiveIntensity = 0.2 + intensity * 0.8;
                    }
                });
                break;
        }
    });
}
