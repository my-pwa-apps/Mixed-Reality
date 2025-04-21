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

// AR-specific variables
let xrReferenceSpace = null;
let xrHitTestSource = null;
let arViewerSpace = null;
let arSessionAttempts = 0; // Track number of session start attempts

// Party element types
const PARTY_ELEMENT = {
    DISCO_BALL: 'disco-ball',
    SPEAKER: 'speaker',
    LIGHTS: 'lights',
    DANCE_FLOOR: 'dance-floor',
};

/**
 * Performance optimization: Pre-create materials and geometries
 */
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
    console.log("Checking WebXR AR support...");
    
    // First check if WebXR is available at all
    if (!navigator.xr) {
        console.log("WebXR not available");
        document.getElementById('debugInfo').textContent = "WebXR not available on this browser";
        initNonARMode(autoStart);
        return;
    }
    
    // Then check for AR support
    navigator.xr.isSessionSupported('immersive-ar')
        .then((supported) => {
            console.log("AR support check result:", supported);
            
            if (supported) {
                document.getElementById('startButton').textContent = 'Enter AR Mode';
                document.getElementById('startButton').removeEventListener('click', startNonARMode);
                document.getElementById('startButton').addEventListener('click', startAR);
                
                // Check for required features
                checkARFeatures();
                
                if (autoStart) {
                    // On auto-start, we'll default to non-AR mode to ensure something displays
                    initNonARMode(autoStart);
                }
            } else {
                document.getElementById('debugInfo').textContent = "AR not supported on this device";
                initNonARMode(autoStart);
            }
        })
        .catch(error => {
            console.error("Error checking AR support:", error);
            document.getElementById('debugInfo').textContent = 
                "Error checking AR support: " + error.message;
            initNonARMode(autoStart);
        });
}

/**
 * Check for required AR features
 */
function checkARFeatures() {
    // List of features to check - make hit-test the only required feature
    const requiredFeatures = ['hit-test'];
    const optionalFeatures = ['dom-overlay', 'light-estimation', 'anchors', 'plane-detection'];
    
    console.log("Checking AR features...");
    
    // Create temporary session to check feature support
    if (typeof navigator.xr.requestSession === 'function') {
        navigator.xr.requestSession('immersive-ar', {
            optionalFeatures: [...requiredFeatures, ...optionalFeatures]
        }).then(session => {
            const supportedFeatures = session.enabledFeatures;
            console.log("Supported features:", Array.from(supportedFeatures));
            
            // Check for missing required features
            let missingFeatures = requiredFeatures.filter(
                feature => !supportedFeatures.includes(feature)
            );
            
            if (missingFeatures.length > 0) {
                console.warn("Missing required features:", missingFeatures);
                document.getElementById('debugInfo').textContent = 
                    "Warning: Missing required AR features: " + missingFeatures.join(", ");
            }
            
            // Check for optional features
            const hasDOMOverlay = supportedFeatures.includes('dom-overlay');
            updateDebugInfo(`DOM Overlay supported: ${hasDOMOverlay}`);
            
            // End this temporary session
            session.end();
        }).catch(error => {
            console.error("Error checking AR features:", error);
        });
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
    document.getElementById('info').textContent = 'Starting AR session...';
    updateDebugInfo('Attempting to start AR session');
    isARMode = true;
    arSessionAttempts++;
    
    // Check if this is a Meta Quest device
    const isMetaQuest = navigator.userAgent.includes('Quest');
    updateDebugInfo(`Device detection: Meta Quest = ${isMetaQuest}`);
    
    // Define required features - only hit-test is truly required
    const sessionInit = {
        requiredFeatures: ['hit-test'],
        optionalFeatures: ['dom-overlay']
    };
    
    // Add DOM overlay differently based on device type
    if (sessionInit.optionalFeatures.includes('dom-overlay')) {
        // On Meta Quest, some versions need specific configuration
        sessionInit.domOverlay = { root: document.getElementById('info') };
        updateDebugInfo("DOM overlay configured with info element");
    }
    
    // Show user we're trying to start AR
    if (typeof updateARStatus === 'function') {
        updateARStatus('Starting AR mode...');
    }
    
    console.log(`AR session attempt #${arSessionAttempts} with options:`, sessionInit);
    
    // Request AR permission first if needed (for browsers that require it)
    tryRequestPermissions()
        .then(() => {
            // Now request the AR session
            return navigator.xr.requestSession('immersive-ar', sessionInit);
        })
        .then(onSessionStarted)
        .catch(error => {
            // If failed with dom-overlay, try again without it
            if ((error.message && error.message.includes('dom-overlay') || 
                 error.name === 'NotSupportedError') && arSessionAttempts < 2) {
                updateDebugInfo("Retrying without dom-overlay feature");
                
                // Remove dom-overlay from features and try again
                const simplifiedInit = {
                    requiredFeatures: ['hit-test'],
                    optionalFeatures: []
                };
                
                // Try simplified request
                navigator.xr.requestSession('immersive-ar', simplifiedInit)
                    .then(onSessionStarted)
                    .catch(secondError => {
                        handleARSessionError(secondError);
                    });
            } else {
                handleARSessionError(error);
            }
        });
}

/**
 * Try to request necessary permissions first
 */
function tryRequestPermissions() {
    // Request camera permission explicitly on some browsers
    if (navigator.permissions && navigator.permissions.query) {
        return navigator.permissions.query({ name: 'camera' })
            .then(permissionStatus => {
                console.log(`Camera permission status: ${permissionStatus.state}`);
                
                if (permissionStatus.state === 'prompt') {
                    // Show message to user that they need to accept the prompt
                    document.getElementById('info').textContent = 'Please allow camera access when prompted';
                    if (typeof updateARStatus === 'function') {
                        updateARStatus('Accept camera permission when prompted', false);
                    }
                    
                    // We can't force permission request, but we can try accessing getUserMedia first
                    return navigator.mediaDevices.getUserMedia({ video: true })
                        .then(stream => {
                            // Stop all tracks to release camera
                            stream.getTracks().forEach(track => track.stop());
                            console.log('Camera permission granted');
                            return Promise.resolve();
                        });
                }
                
                return Promise.resolve();
            })
            .catch(() => {
                // If permission query fails, just continue (some browsers don't support this)
                console.log('Permission query not supported, continuing');
                return Promise.resolve();
            });
    }
    
    return Promise.resolve();
}

/**
 * Handle AR session errors
 */
function handleARSessionError(error) {
    console.error('Error starting AR session:', error);
    
    let errorMessage = 'Failed to start AR mode';
    let detailedError = '';
    
    // Format user-friendly error messages based on common errors
    if (error.name === 'SecurityError') {
        errorMessage = 'Camera permission denied';
        detailedError = 'Please allow camera access to use AR mode';
    } else if (error.name === 'NotSupportedError') {
        errorMessage = 'AR not supported on this device';
        detailedError = 'Your device may not support AR or WebXR';
    } else if (error.message && error.message.includes('hit-test')) {
        errorMessage = 'Hit testing not supported';
        detailedError = 'Your device does not support the required AR features';
    } else {
        detailedError = error.message || 'Unknown error';
    }
    
    document.getElementById('info').textContent = errorMessage;
    updateDebugInfo(`AR Error: ${detailedError}`);
    
    if (typeof updateARStatus === 'function') {
        updateARStatus(errorMessage, true);
    }
    
    document.getElementById('startButton').classList.remove('hidden');
    isARMode = false;
    
    // If we've tried multiple times without success, offer non-AR mode
    if (arSessionAttempts >= 2) {
        setTimeout(() => {
            if (confirm('AR mode is not working on your device. Would you like to try non-AR mode instead?')) {
                initNonARMode(true);
            } else {
                // Reset attempt counter if user wants to try again
                arSessionAttempts = 0;
            }
        }, 1000);
    }
}

/**
 * Update debug info display
 */
function updateDebugInfo(message) {
    const debugEl = document.getElementById('debugInfo');
    if (debugEl) {
        debugEl.innerHTML += `<br>${message}`;
        debugEl.scrollTop = debugEl.scrollHeight;
    }
}

/**
 * Set up XR session
 */
function onSessionStarted(session) {
    console.log("AR session started successfully");
    updateDebugInfo("AR session started successfully");
    
    // Check if dom-overlay is enabled in this session
    const hasDOMOverlay = session.enabledFeatures.includes('dom-overlay');
    updateDebugInfo(`Session has DOM overlay: ${hasDOMOverlay}`);
    
    if (typeof updateARStatus === 'function') {
        updateARStatus('AR session started!');
    }
    
    // Set up session event listeners
    session.addEventListener('end', onSessionEnded);
    session.addEventListener('visibilitychange', (event) => {
        updateDebugInfo(`AR visibility: ${session.visibilityState}`);
    });
    
    try {
        // Set up scene for AR
        renderer.xr.enabled = true;
        renderer.xr.setReferenceSpaceType('local');
        renderer.xr.setSession(session);
        
        // Show user feedback - using either DOM overlay or console
        if (hasDOMOverlay) {
            document.getElementById('info').textContent = 'Initializing AR tracking...';
        } else {
            // If no DOM overlay, we'll use floating text in the scene instead
            createFloatingText('Initializing AR tracking...');
        }
        
        // Reset AR-specific variables
        xrReferenceSpace = null;
        arViewerSpace = null;
        hitTestSource = null;
        hitTestSourceRequested = false;
        
        // Request reference spaces - needed for hit testing
        getXRReferenceSpaces(session);
    } catch (error) {
        console.error("Error during AR session setup:", error);
        updateDebugInfo(`AR setup error: ${error.message}`);
        session.end();
    }
}

/**
 * Create floating text for feedback when DOM overlay isn't available
 */
function createFloatingText(message) {
    // Remove any existing floating text
    scene.children.forEach(child => {
        if (child.userData && child.userData.isFloatingText) {
            scene.remove(child);
        }
    });
    
    // Check for Meta Quest for better positioning
    const isMetaQuest = navigator.userAgent.includes('Quest');
    
    // Use a simple sprite as fallback since font loading takes time
    const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
            map: createTextTexture(message, isMetaQuest),
            color: 0xffffff,
            transparent: true,
            opacity: 0.9,
            depthTest: false // Ensure visible through objects
        })
    );
    
    // Adjust scale and position based on device
    if (isMetaQuest) {
        sprite.scale.set(0.6, 0.3, 1); // Larger for better visibility on Quest
        sprite.position.set(0, 0, -0.8); // Closer to improve readability
    } else {
        sprite.scale.set(0.5, 0.25, 1);
        sprite.position.set(0, 0, -1);
    }
    
    sprite.userData.isFloatingText = true;
    sprite.userData.createdAt = Date.now();
    sprite.renderOrder = 9999; // Ensure it renders on top
    scene.add(sprite);
    
    // Text will follow camera
    sprite.onBeforeRender = function() {
        if (camera) {
            // Position sprite to face camera and stay in view
            this.position.copy(camera.position);
            
            // Different z-distance based on device
            if (isMetaQuest) {
                this.position.z -= 0.8;
            } else {
                this.position.z -= 1;
            }
            
            this.quaternion.copy(camera.quaternion);
            
            // Fade out after 5 seconds
            const age = Date.now() - this.userData.createdAt;
            if (age > 5000) {
                this.material.opacity = Math.max(0, 0.9 - (age - 5000) / 2000);
                
                // Remove when completely faded
                if (this.material.opacity <= 0) {
                    scene.remove(this);
                }
            }
        }
    };
    
    return sprite;
}

/**
 * Create a canvas texture with text
 * @param {string} text - The text to display
 * @param {boolean} isMetaQuest - Whether the device is Meta Quest
 */
function createTextTexture(text, isMetaQuest = false) {
    const canvas = document.createElement('canvas');
    // Higher resolution for Meta Quest to ensure readability
    canvas.width = isMetaQuest ? 512 : 256;
    canvas.height = isMetaQuest ? 256 : 128;
    
    const context = canvas.getContext('2d');
    
    // Different background style for Meta Quest
    if (isMetaQuest) {
        // Gradient background for better visibility
        const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, 'rgba(0,0,20,0.7)');
        gradient.addColorStop(1, 'rgba(0,0,60,0.7)');
        context.fillStyle = gradient;
    } else {
        context.fillStyle = 'rgba(0,0,0,0.5)';
    }
    
    // Draw rounded rectangle background
    const radius = 15;
    roundRect(context, 0, 0, canvas.width, canvas.height, radius);
    
    // Add purple border for better visibility on Quest
    if (isMetaQuest) {
        context.strokeStyle = 'rgba(143, 68, 255, 0.8)';
        context.lineWidth = 4;
        context.stroke();
    }
    
    // Use larger, bolder text for Meta Quest
    if (isMetaQuest) {
        context.font = 'bold 36px Arial, Helvetica, sans-serif';
    } else {
        context.font = '24px Arial';
    }
    context.fillStyle = 'white';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    
    // Support multi-line text
    const lines = text.split('\n');
    const lineHeight = isMetaQuest ? 40 : 28;
    const startY = canvas.height/2 - (lineHeight * (lines.length - 1)) / 2;
    
    lines.forEach((line, i) => {
        context.fillText(line, canvas.width / 2, startY + i * lineHeight);
    });
    
    const texture = new THREE.CanvasTexture(canvas);
    // Improve texture quality
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return texture;
}

/**
 * Helper function to draw a rounded rectangle
 */
function roundRect(ctx, x, y, width, height, radius) {
    if (radius === 0) {
        ctx.fillRect(x, y, width, height);
        return;
    }
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
}

/**
 * Get XR reference spaces needed for AR
 */
function getXRReferenceSpaces(session) {
    // First get viewer space
    session.requestReferenceSpace('viewer')
        .then(viewerSpace => {
            arViewerSpace = viewerSpace;
            updateDebugInfo("Got viewer reference space");
            
            // Then get local space
            return session.requestReferenceSpace('local');
        })
        .then(localSpace => {
            xrReferenceSpace = localSpace;
            updateDebugInfo("Got local reference space");
            
            // Use appropriate feedback method
            const hasDOMOverlay = session.enabledFeatures.includes('dom-overlay');
            if (hasDOMOverlay) {
                document.getElementById('info').textContent = 'Look around to detect surfaces';
            } else {
                createFloatingText('Look around to detect surfaces');
            }
            
            // Initialize audio when spaces are ready
            initAudio();
            
            // For some devices, need to explicitly request hit test source here
            // rather than in render loop
            return createHitTestSource(session);
        })
        .catch(error => {
            console.error("Error getting reference spaces:", error);
            updateDebugInfo(`Reference space error: ${error.message}`);
            session.end();
        });
}

/**
 * Create hit test source for AR surface detection
 */
function createHitTestSource(session) {
    if (!arViewerSpace || hitTestSourceRequested) {
        return Promise.resolve();
    }
    
    updateDebugInfo("Creating hit test source");
    hitTestSourceRequested = true;
    
    return session.requestHitTestSource({ space: arViewerSpace })
        .then(source => {
            hitTestSource = source;
            updateDebugInfo("Hit test source created successfully");
            document.getElementById('info').textContent = 'Tap detected surfaces to place objects';
        })
        .catch(error => {
            console.error("Error creating hit test source:", error);
            updateDebugInfo(`Hit test source error: ${error.message}`);
            hitTestSourceRequested = false; // Allow retry
        });
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
        const session = renderer.xr.getSession();
        
        // Ensure reference spaces are set up
        if (xrReferenceSpace) {
            // Create hit test source if not already created
            if (!hitTestSource && !hitTestSourceRequested) {
                updateDebugInfo("Requesting hit test source from render loop");
                createHitTestSource(session);
            }
            
            // Process hit test results if source is available
            if (hitTestSource) {
                try {
                    const hitTestResults = frame.getHitTestResults(hitTestSource);
                    
                    if (hitTestResults.length > 0) {
                        const hit = hitTestResults[0];
                        const pose = hit.getPose(xrReferenceSpace);
                        
                        if (pose) {
                            // Show reticle at hit position
                            reticle.visible = true;
                            reticle.matrix.fromArray(pose.transform.matrix);
                            
                            // Make reticle more visible
                            if (reticle.material) {
                                reticle.material.color = new THREE.Color(0x00ff00);
                                reticle.material.opacity = 0.8;
                            }
                        } else {
                            reticle.visible = false;
                        }
                    } else {
                        // No hit test results
                        reticle.visible = false;
                    }
                } catch (error) {
                    console.error("Error during hit test:", error);
                    updateDebugInfo(`Hit test error: ${error.message}`);
                    reticle.visible = false;
                }
            }
        } else if (session && !xrReferenceSpace) {
            // Try to get reference spaces again if they failed earlier
            updateDebugInfo("Retrying to get reference spaces");
            getXRReferenceSpaces(session);
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
        const session = renderer.xr.getSession();
        
        // Ensure reference spaces are set up
        if (xrReferenceSpace) {
            // Create hit test source if not already created
            if (!hitTestSource && !hitTestSourceRequested) {
                updateDebugInfo("Requesting hit test source from render loop");
                createHitTestSource(session);
            }
            
            // Process hit test results if source is available
            if (hitTestSource) {
                try {
                    const hitTestResults = frame.getHitTestResults(hitTestSource);
                    
                    if (hitTestResults.length > 0) {
                        const hit = hitTestResults[0];
                        const pose = hit.getPose(xrReferenceSpace);
                        
                        if (pose) {
                            // Show reticle at hit position
                            reticle.visible = true;
                            reticle.matrix.fromArray(pose.transform.matrix);
                            
                            // Make reticle more visible
                            if (reticle.material) {
                                reticle.material.color = new THREE.Color(0x00ff00);
                                reticle.material.opacity = 0.8;
                            }
                        } else {
                            reticle.visible = false;
                        }
                    } else {
                        // No hit test results
                        reticle.visible = false;
                    }
                } catch (error) {
                    console.error("Error during hit test:", error);
                    updateDebugInfo(`Hit test error: ${error.message}`);
                    reticle.visible = false;
                }
            }
        } else if (session && !xrReferenceSpace) {
            // Try to get reference spaces again if they failed earlier
            updateDebugInfo("Retrying to get reference spaces");
            getXRReferenceSpaces(session);
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

/**
 * Handle selection in AR mode
 */
function onSelect() {
    if (isARMode) {
        updateDebugInfo("AR select event triggered");
        
        if (reticle.visible) {
            const partyElementType = getRandomPartyElement();
            updateDebugInfo(`Creating ${partyElementType} at reticle position`);
            
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
            
            // Provide feedback - check if DOM overlay is available
            const session = renderer.xr.getSession();
            if (session && session.enabledFeatures.includes('dom-overlay')) {
                document.getElementById('info').textContent = `Placed ${partyElementType.replace('-', ' ')}!`;
                setTimeout(() => {
                    document.getElementById('info').textContent = 'Tap surfaces to place more elements';
                }, 2000);
            } else {
                // Use floating text instead
                createFloatingText(`Placed ${partyElementType.replace('-', ' ')}!`);
                setTimeout(() => {
                    createFloatingText('Tap surfaces to place more objects');
                }, 2000);
            }
        } else {
            updateDebugInfo("Select event but reticle not visible");
            const session = renderer.xr.getSession();
            if (session && session.enabledFeatures.includes('dom-overlay')) {
                document.getElementById('info').textContent = 'Point at a surface first';
            } else {
                createFloatingText('Point at a surface first');
            }
        }
    }
}

/**
 * Handle window resize events
 * Adjusts camera and renderer to new window size
 */
function onWindowResize() {
    if (!renderer) return;
    
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    
    // Update debug info
    if (debugMode) {
        updateDebugInfo("Window resized: " + window.innerWidth + "x" + window.innerHeight);
    }
}

/**
 * Clean up after XR session ends
 */
function onSessionEnded() {
    console.log("AR session ended");
    document.getElementById('startButton').classList.remove('hidden');
    document.getElementById('info').textContent = 'AR session ended';
    
    // Reset AR-specific variables
    xrReferenceSpace = null;
    xrHitTestSource = null;
    arViewerSpace = null;
    hitTestSource = null;
    hitTestSourceRequested = false;
    
    // Re-check device support in case user wants to start again
    setTimeout(() => {
        checkDeviceSupport();
    }, 1000);
}
