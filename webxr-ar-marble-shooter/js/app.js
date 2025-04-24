import { MarbleShooter } from './MarbleShooter.js';
import { Target } from './Target.js';
import * as CANNON from 'https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.min.js';

// Main application class
class App {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.session = null;
        this.hitTestSource = null;
        this.hitTestSourceRequested = false;
        this.xrRefSpace = null;
        this.physicsWorld = null;
        this.marbleShooter = null;
        this.targets = [];
        this.maxTargets = 5;
        this.score = 0;
        this.frameCounter = 0;
        this.lastTargetSpawnTime = 0;
        this.initialized = false;
        this.gameActive = false;

        // DOM elements
        this.loadingOverlay = document.getElementById('loading-overlay');
        this.startButton = document.getElementById('start-button');
        this.scoreValue = document.getElementById('score-value');
        this.xrNotAvailable = document.getElementById('xr-not-available');
        this.canvas = document.getElementById('ar-canvas');

        // Bind methods
        this.onWindowResize = this.onWindowResize.bind(this);
        this.onXRSessionStarted = this.onXRSessionStarted.bind(this);
        this.onXRSessionEnded = this.onXRSessionEnded.bind(this);
        this.animate = this.animate.bind(this);
        this.onSelect = this.onSelect.bind(this);

        // Initialize the application
        this.init();
    }

    init() {
        // Check if WebXR is available
        if (navigator.xr === undefined) {
            this.showWebXRNotAvailable();
            return;
        }

        // Set up Three.js scene
        this.setupScene();

        // Set up physics
        this.setupPhysics();

        // Set up event listeners
        window.addEventListener('resize', this.onWindowResize, false);
        this.startButton.addEventListener('click', this.startXR.bind(this));

        // Initial render
        this.renderer.setAnimationLoop(this.animate);
        this.loadingOverlay.style.display = 'none';
        this.initialized = true;
    }

    showWebXRNotAvailable() {
        this.loadingOverlay.style.display = 'none';
        this.xrNotAvailable.style.display = 'block';
        this.startButton.disabled = true;
    }    setupScene() {
        // Create scene
        this.scene = new THREE.Scene();

        // Create camera
        this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

        // Create renderer with optimized settings
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: true,
            powerPreference: "high-performance"
        });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Limit pixel ratio for better performance
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.xr.enabled = true;
        this.renderer.outputEncoding = THREE.sRGBEncoding; // Better color accuracy

        // Add basic lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(0, 10, 0);
        this.scene.add(directionalLight);
    }    setupPhysics() {
        // Initialize Cannon.js physics world with optimized settings
        this.physicsWorld = new CANNON.World();
        this.physicsWorld.gravity.set(0, -9.82, 0); // Earth gravity
        
        // Use SAPBroadphase for better performance with many objects
        this.physicsWorld.broadphase = new CANNON.SAPBroadphase(this.physicsWorld);
        
        // Optimize solver settings
        this.physicsWorld.solver.iterations = 7; // Good balance between accuracy and performance
        this.physicsWorld.solver.tolerance = 0.1; // More forgiving tolerance for better performance
        
        // Set default contact material properties
        const defaultMaterial = new CANNON.Material('default');
        const defaultContactMaterial = new CANNON.ContactMaterial(
            defaultMaterial,
            defaultMaterial,
            {
                friction: 0.3,
                restitution: 0.7 // Slightly bouncy default
            }
        );
        this.physicsWorld.defaultContactMaterial = defaultContactMaterial;
        
        // Use time step accumulator for smoother physics at variable frame rates
        this.lastTime = performance.now();
        this.timeStep = 1/60; // Physics update at 60Hz
        this.maxSubSteps = 3; // Allow up to 3 substeps for better accuracy
    }

    startXR() {
        if (!this.initialized) return;

        navigator.xr.isSessionSupported('immersive-ar').then((supported) => {
            if (supported) {
                navigator.xr.requestSession('immersive-ar', {
                    requiredFeatures: ['hit-test', 'dom-overlay'],
                    domOverlay: { root: document.getElementById('ui-container') }
                }).then(this.onXRSessionStarted);
            } else {
                this.showWebXRNotAvailable();
            }
        });
    }

    onXRSessionStarted(session) {
        this.session = session;
        this.session.addEventListener('end', this.onXRSessionEnded);
        this.session.addEventListener('select', this.onSelect);

        // Set up XR rendering
        this.renderer.xr.setReferenceSpaceType('local');
        this.renderer.xr.setSession(this.session);
        this.xrRefSpace = null;

        // Hide start button
        this.startButton.style.display = 'none';

        // Initialize the Marble Shooter
        this.marbleShooter = new MarbleShooter(this.scene, this.physicsWorld);

        // Start game
        this.gameActive = true;
        this.score = 0;
        this.updateScoreDisplay();

        this.session.requestReferenceSpace('local').then((refSpace) => {
            this.xrRefSpace = refSpace;
        });
    }

    onXRSessionEnded() {
        this.session = null;
        this.hitTestSource = null;
        this.hitTestSourceRequested = false;
        this.gameActive = false;
        
        // Show start button again
        this.startButton.style.display = 'block';
        
        // Clean up targets and marbles
        this.cleanupScene();
    }

    cleanupScene() {
        // Remove all targets
        for (let target of this.targets) {
            target.remove();
        }
        this.targets = [];

        // Remove marble shooter
        if (this.marbleShooter) {
            this.marbleShooter.remove();
            this.marbleShooter = null;
        }
    }

    onWindowResize() {
        if (this.camera && this.renderer) {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        }
    }

    onSelect() {
        if (!this.gameActive || !this.marbleShooter) return;
        
        // Shoot a marble in the direction the camera is facing
        const camera = this.renderer.xr.getCamera();
        const direction = new THREE.Vector3(0, 0, -1);
        direction.applyQuaternion(camera.quaternion);
        
        this.marbleShooter.shoot(camera.position, direction);
        
        // Visual feedback for shooting
        this.createShootingIndicator();
    }

    createShootingIndicator() {
        const indicator = document.createElement('div');
        indicator.className = 'shooting-indicator';
        document.body.appendChild(indicator);
        
        // Remove after animation completes
        setTimeout(() => {
            document.body.removeChild(indicator);
        }, 500);
    }

    spawnTarget() {
        if (this.targets.length >= this.maxTargets) return;

        const camera = this.renderer.xr.getCamera();
        if (!camera) return;

        // Create target at a random position in front of the user
        const distance = 1.5 + Math.random() * 1.5;  // 1.5-3 meters away
        const angle = Math.random() * Math.PI * 2;   // Random angle around player
        const height = -0.5 + Math.random() * 1;    // Between -0.5 and 0.5 meters from eye level

        const position = new THREE.Vector3();
        position.x = Math.sin(angle) * distance + camera.position.x;
        position.z = Math.cos(angle) * distance + camera.position.z;
        position.y = camera.position.y + height;

        // Create the target and add to the scene
        const target = new Target(this.scene, this.physicsWorld, position);
        this.targets.push(target);
        
        return target;
    }

    checkCollisions() {
        if (!this.marbleShooter) return;

        const marbles = this.marbleShooter.getActiveMarbles();
        const targetsToRemove = [];

        for (let i = 0; i < this.targets.length; i++) {
            const target = this.targets[i];
            for (const marble of marbles) {
                if (target.checkCollision(marble)) {
                    // Target hit, mark for removal
                    targetsToRemove.push(i);
                    // Increment score
                    this.score += 10;
                    // Break out of the marbles loop, as the target is already hit
                    break;
                }
            }
        }

        // Remove hit targets (in reverse order to avoid index issues)
        for (let i = targetsToRemove.length - 1; i >= 0; i--) {
            const index = targetsToRemove[i];
            this.targets[index].remove();
            this.targets.splice(index, 1);
        }

        // Update score display if targets were hit
        if (targetsToRemove.length > 0) {
            this.updateScoreDisplay();
        }
    }

    updateScoreDisplay() {
        this.scoreValue.textContent = this.score;
    }    updatePhysics(deltaTime) {
        // Step the physics world with variable time step for smoother physics
        this.physicsWorld.step(this.timeStep, deltaTime, this.maxSubSteps);
        
        // Update marble shooter physics
        if (this.marbleShooter) {
            this.marbleShooter.update();
        }
        
        // Update targets physics
        for (let target of this.targets) {
            target.update();
        }
    }

    animate(timestamp, frame) {
        // Calculate delta time for smooth animation regardless of frame rate
        const now = performance.now();
        const deltaTime = (now - this.lastTime) / 1000; // Convert to seconds
        this.lastTime = now;
        
        // Update physics with delta time
        this.updatePhysics(deltaTime);
        
        // Check for collisions between marbles and targets
        this.checkCollisions();

        // Clean up out-of-bounds objects
        if (this.marbleShooter && this.frameCounter % 30 === 0) { // Only check cleanup every 30 frames
            this.marbleShooter.cleanupMarbles();
        }

        // Check for hit-test and spawn targets
        if (frame && this.gameActive) {
            const referenceSpace = this.renderer.xr.getReferenceSpace();
            const session = this.renderer.xr.getSession();

            // Handle hit-test for placing the shooter
            if (session && !this.hitTestSourceRequested) {
                session.requestReferenceSpace('viewer').then((referenceSpace) => {
                    session.requestHitTestSource({ space: referenceSpace }).then((source) => {
                        this.hitTestSource = source;
                    });
                });
                this.hitTestSourceRequested = true;
            }

            // Occasionally spawn new targets
            this.frameCounter++;
            if (this.frameCounter % 120 === 0) { // Every ~2 seconds (assuming 60fps)
                this.spawnTarget();
            }
        }
    }
}

// Start the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new App();
});
