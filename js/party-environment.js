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
let audioSource;
let dataArray;

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
    container = document.createElement('div');
    document.body.appendChild(container);

    // Create scene
    scene = new THREE.Scene();

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
    document.getElementById('startButton').addEventListener('click', startAR);

    // Handle window resize
    window.addEventListener('resize', onWindowResize);
}

function startAR() {
    // Hide start button when entering AR
    document.getElementById('startButton').classList.add('hidden');
    
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
    if (reticle.visible) {
        // Create random party element when tapping on a surface
        const partyElementType = getRandomPartyElement();
        createPartyElement(partyElementType, reticle.matrix);
        
        // Play party music when first element is added
        if (partyElements.length === 1) {
            playPartyMusic();
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
    
    // Position the element using the reticle's matrix
    mesh.matrix.copy(matrix);
    mesh.matrix.multiply(new THREE.Matrix4().makeScale(0.5, 0.5, 0.5));
    mesh.matrixAutoUpdate = false;
    
    scene.add(mesh);
    partyElements.push({
        mesh: mesh,
        type: type,
        createdAt: Date.now()
    });
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

function playPartyMusic() {
    // Load party music
    const audioElement = document.createElement('audio');
    audioElement.src = 'sounds/party-music.mp3'; // Add your music file
    audioElement.loop = true;
    
    // Create source from audio element
    audioSource = audioContext.createMediaElementSource(audioElement);
    audioSource.connect(audioAnalyser);
    audioAnalyser.connect(audioContext.destination);
    
    // Play music
    audioElement.play().catch(error => {
        console.error('Error playing audio:', error);
    });
}

function animate() {
    renderer.setAnimationLoop(render);
}

function render(timestamp, frame) {
    if (frame) {
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
        
        // Animate party elements
        animatePartyElements(timestamp);
    }
    
    renderer.render(scene, camera);
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
