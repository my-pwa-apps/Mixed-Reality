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

// Memory management constants
const MAX_PARTY_ELEMENTS = 10;  // Maximum number of elements allowed
const ELEMENT_CLEANUP_INTERVAL = 60000;  // Check for cleanup every minute
let lastCleanupTime = 0;  // Track last cleanup time

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
 * Handle selection in AR mode
 * This function is called when the user triggers a selection event in AR
 * (e.g., by tapping the screen or clicking a controller button)
 */
function onSelect() {
    if (isARMode) {
        updateDebugInfo("AR select event triggered");
        const session = renderer.xr.getSession();
        const isMetaQuest = /oculus|quest|vr|meta/i.test(navigator.userAgent);
        const isHitTestSupported = hitTestSource && !hitTestSource.fake;
        
        // Place object if reticle is visible or if we're in simplified mode for Quest
        if (reticle.visible || (!isHitTestSupported && isMetaQuest)) {
            const partyElementType = getRandomPartyElement();
            updateDebugInfo(`Creating ${partyElementType}`);
            
            let element;
            
            // For devices with hit-test, place at reticle position
            if (reticle.visible) {
                element = createPartyElement(partyElementType, reticle.matrix);
            } 
            // For Quest without hit-test, place at a reasonable distance in front of user
            else {
                element = createPartyElement(partyElementType);
                
                // Position in front of camera at fixed distance
                const cameraDirection = new THREE.Vector3(0, 0, -1);
                cameraDirection.applyQuaternion(camera.quaternion);
                
                // Place at a reasonable distance from the user
                const placementDistance = 1.5;
                const placementPosition = new THREE.Vector3();
                placementPosition.copy(camera.position)
                    .add(cameraDirection.multiplyScalar(placementDistance));
                
                // Adjust height to be slightly lower than camera height
                placementPosition.y = Math.max(0.5, camera.position.y - 0.3);
                
                element.position.copy(placementPosition);
                element.lookAt(camera.position.x, element.position.y, camera.position.z);
            }
            
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
            
            // Provide feedback
            const feedbackMessage = `Placed ${partyElementType.replace('-', ' ')}!`;
            
            if (session && session.enabledFeatures.includes('dom-overlay') && 
                document.getElementById('info').style.display !== 'none') {
                document.getElementById('info').textContent = feedbackMessage;
                setTimeout(() => {
                    document.getElementById('info').textContent = 'Tap to place more elements';
                }, 2000);
            } else {
                // Use floating text instead
                createFloatingText(feedbackMessage);
                setTimeout(() => {
                    createFloatingText('Tap to place more objects');
                }, 2000);
            }
        } else {
            updateDebugInfo("Select event but reticle not visible");
            
            // Provide guidance
            if (session && session.enabledFeatures.includes('dom-overlay') && 
                document.getElementById('info').style.display !== 'none') {
                document.getElementById('info').textContent = 'Point at a surface first';
            } else {
                createFloatingText('Point at a surface first');
            }
        }
    }
}

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
    scene.add(light);    // Set up renderer with optimized settings for XR devices
    const isMetaQuest = /oculus|quest|vr|meta/i.test(navigator.userAgent);
    
    renderer = new THREE.WebGLRenderer({ 
        antialias: !isMetaQuest, // Disable expensive antialias on Quest
        alpha: true,
        powerPreference: 'high-performance',
        precision: isMetaQuest ? 'mediump' : 'highp', // Lower precision on Quest for better performance
        depth: true,
        stencil: false // Don't need stencil buffer for this scene
    });
    
    // Optimize pixel ratio for Quest (use 0.75 scale for better performance)
    const pixelRatio = isMetaQuest ? 
        Math.min(window.devicePixelRatio, 1.5) * 0.75 : 
        window.devicePixelRatio;
    
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    renderer.setClearColor(0x222222);
    
    // Only enable shadows in non-AR mode or on powerful devices
    renderer.shadowMap.enabled = !isMetaQuest;
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
    arSessionAttempts++;    // Check if this is a Meta Quest device
    const isMetaQuest = /oculus|quest|vr|meta/i.test(navigator.userAgent);
    updateDebugInfo(`Device detection: Meta Quest = ${isMetaQuest}`);
    
    // Define session initialization options based on device
    let sessionInit;
    
    if (isMetaQuest) {
        // For Meta Quest, use the most minimal configuration possible
        sessionInit = {
            // Don't require hit-test, make it optional for Quest
            requiredFeatures: [],
            optionalFeatures: ['hit-test']
        };
        updateDebugInfo("Using ultra-minimal config for Meta Quest");
        
        // Meta Quest Browser has issues with elements in the DOM that use z-index or fixed position
        // Hide the info element when in AR mode on Quest
        document.getElementById('info').style.display = 'none';
    } else {
        // For other devices, use standard configuration with dom-overlay
        sessionInit = {
            requiredFeatures: ['hit-test'],
            optionalFeatures: ['dom-overlay']
        };
        
        // Configure DOM overlay for non-Quest devices
        sessionInit.domOverlay = { root: document.getElementById('info') };
        updateDebugInfo("Standard WebXR config with DOM overlay");
    }
    
    // Show user we're trying to start AR
    if (typeof updateARStatus === 'function') {
        updateARStatus('Starting AR mode...');
    }
    
    console.log(`AR session attempt #${arSessionAttempts} with options:`, sessionInit);    // Clear potentially problematic cached data (specific issue on some Quest browsers)
    if (isMetaQuest) {
        hitTestSource = null;
        hitTestSourceRequested = false;
        xrReferenceSpace = null;
        arViewerSpace = null;
        updateDebugInfo("Reset XR state for Quest");
    }
    
    // Request AR permission first if needed (for browsers that require it)
    tryRequestPermissions()
        .then(() => {
            // Log what we're about to request for debugging
            updateDebugInfo(`Requesting session with: ${JSON.stringify(sessionInit)}`);
            
            // For Meta Quest, we use a longer timeout and a special approach
            if (isMetaQuest) {
                return new Promise((resolve) => {
                    // Release any input focus that might interfere with XR session
                    if (document.activeElement) document.activeElement.blur();
                    
                    // Force UI refresh before attempting to start session
                    setTimeout(() => {
                        try {
                            updateDebugInfo("Attempting Quest AR session...");
                            resolve(navigator.xr.requestSession('immersive-ar', sessionInit));
                        } catch (err) {
                            updateDebugInfo(`Direct attempt error: ${err.message}`);
                            reject(err);
                        }
                    }, 500); // Longer timeout for Quest
                });
            } else {
                // Standard approach for other devices
                return navigator.xr.requestSession('immersive-ar', sessionInit);
            }
        })
        .then(onSessionStarted)
        .catch(error => {
            // Better error logging
            updateDebugInfo(`Session request error: ${error.name} - ${error.message}`);
            
            // If this is our first attempt, try a more basic configuration
            if (arSessionAttempts < 2) {
                updateDebugInfo("Retrying with ultra-minimal features");
                arSessionAttempts++;
                
                // Try the absolute minimum configuration - no required features at all
                const fallbackInit = {
                    requiredFeatures: [],
                    optionalFeatures: [] // Remove all features for maximum compatibility
                };
                
                updateDebugInfo(`Fallback attempt with: ${JSON.stringify(fallbackInit)}`);
                
                // Try fallback with a more significant delay for Quest
                setTimeout(() => {
                    try {
                        navigator.xr.requestSession('immersive-ar', fallbackInit)
                            .then(onSessionStarted)
                            .catch(secondError => {
                                updateDebugInfo(`Fallback attempt failed: ${secondError.name}`);
                                handleARSessionError(secondError);
                            });
                    } catch (err) {
                        handleARSessionError(err);
                    }
                }, isMetaQuest ? 1000 : 300); // Longer timeout for Quest
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

/**
 * Memory management function to limit the number of elements
 * and prevent performance degradation over time
 */
function manageMemory(timestamp) {
    // Only run cleanup check periodically
    if (!lastCleanupTime || (timestamp - lastCleanupTime) > ELEMENT_CLEANUP_INTERVAL) {
        lastCleanupTime = timestamp;
        
        // If we have too many elements, remove the oldest ones
        if (partyElements.length > MAX_PARTY_ELEMENTS) {
            // Sort by creation time
            partyElements.sort((a, b) => a.createdAt - b.createdAt);
            
            // Calculate how many to remove
            const elementsToRemove = partyElements.length - MAX_PARTY_ELEMENTS;
            
            // Remove oldest elements
            for (let i = 0; i < elementsToRemove; i++) {
                const element = partyElements[i];
                
                // Remove from scene
                if (element && element.mesh) {
                    scene.remove(element.mesh);
                    
                    // Properly dispose of geometries and materials to free GPU memory
                    if (element.mesh.geometry) element.mesh.geometry.dispose();
                    
                    if (element.mesh.material) {
                        if (Array.isArray(element.mesh.material)) {
                            element.mesh.material.forEach(material => material.dispose());
                        } else {
                            element.mesh.material.dispose();
                        }
                    }
                    
                    // Handle child meshes (like the disco ball facets)
                    if (element.mesh.children) {
                        element.mesh.children.forEach(child => {
                            if (child.geometry) child.geometry.dispose();
                            if (child.material) {
                                if (Array.isArray(child.material)) {
                                    child.material.forEach(material => material.dispose());
                                } else {
                                    child.material.dispose();
                                }
                            }
                        });
                    }
                }
            }
            
            // Update the array to remove old elements
            partyElements = partyElements.slice(elementsToRemove);
            
            // Force garbage collection hint
            if (window.gc) window.gc();
            
            updateDebugInfo(`Memory cleanup: removed ${elementsToRemove} oldest elements`);
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
 * Initialize audio context and analyser
 */
function initAudio() {
    // Check if AudioContext is already initialized
    if (audioContext) return;
    
    try {
        // Create audio context with fallbacks for different browsers
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        audioAnalyser = audioContext.createAnalyser();
        audioAnalyser.fftSize = 256;
        
        // Set up data array for frequency analysis
        const bufferLength = audioAnalyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
        
        updateDebugInfo("Audio system initialized");
    } catch (error) {
        console.error('Error initializing audio:', error);
        updateDebugInfo("Failed to initialize audio system");
    }
}

/**
 * Start microphone input for audio analysis
 */
function startMicrophoneInput() {
    if (!audioContext || !audioAnalyser) {
        initAudio();
    }
    
    navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        .then(stream => {
            // Create source from microphone stream
            const micSource = audioContext.createMediaStreamSource(stream);
            micSource.connect(audioAnalyser);
            
            // Show success message
            if (document.getElementById('info').style.display !== 'none') {
                document.getElementById('info').textContent = 'Party mode active! Make some noise!';
            } else {
                createFloatingText('Party mode active! Make some noise!');
            }
            
            updateDebugInfo("Microphone connected successfully");
        })
        .catch(error => {
            console.error('Error accessing microphone:', error);
            
            // Show error message
            if (document.getElementById('info').style.display !== 'none') {
                document.getElementById('info').textContent = 'Could not access microphone';
            } else {
                createFloatingText('Could not access microphone');
            }
            
            updateDebugInfo("Microphone access error: " + error.message);
        });
}
