import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.144.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.144.0/examples/jsm/loaders/GLTFLoader.js';
import { Enemy } from './Enemy.js';
import { Player } from './Player.js';
import { Projectile } from './Projectile.js';
import { RoomScanner } from './RoomScanner.js';

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
        this.player = null;
        this.enemies = [];
        this.projectiles = [];
        this.maxEnemies = 20;
        this.enemiesPerWave = 5;
        this.enemyWaveCount = 0;
        this.score = 0;
        this.level = 1;
        this.lives = 3;
        this.frameCounter = 0;
        this.lastEnemySpawnTime = 0;
        this.initialized = false;
        this.gameActive = false;
        this.roomScanned = false;
        this.roomGeometry = null;
        
        // Formation patterns for enemies (Galaga-style)
        this.formationPatterns = [
            // Pattern 1: Classic arc
            [
                {x: -0.4, y: 0.5, z: -1.0},
                {x: -0.2, y: 0.5, z: -1.0},
                {x: 0, y: 0.5, z: -1.0},
                {x: 0.2, y: 0.5, z: -1.0},
                {x: 0.4, y: 0.5, z: -1.0}
            ],
            // Pattern 2: V formation
            [
                {x: -0.4, y: 0.3, z: -1.0},
                {x: -0.2, y: 0.4, z: -1.0},
                {x: 0, y: 0.5, z: -1.0},
                {x: 0.2, y: 0.4, z: -1.0},
                {x: 0.4, y: 0.3, z: -1.0}
            ],
            // Pattern 3: Double row
            [
                {x: -0.4, y: 0.5, z: -1.0},
                {x: -0.2, y: 0.5, z: -1.0},
                {x: 0, y: 0.5, z: -1.0},
                {x: 0.2, y: 0.5, z: -1.0},
                {x: 0.4, y: 0.5, z: -1.0},
                {x: -0.3, y: 0.3, z: -1.0},
                {x: -0.1, y: 0.3, z: -1.0},
                {x: 0.1, y: 0.3, z: -1.0},
                {x: 0.3, y: 0.3, z: -1.0}
            ]
        ];

        // DOM elements
        this.loadingOverlay = document.getElementById('loading-overlay');
        this.startButton = document.getElementById('start-button');
        this.scoreValue = document.getElementById('score-value');
        this.levelValue = document.getElementById('level-value');
        this.livesValue = document.getElementById('lives-value');
        this.xrNotAvailable = document.getElementById('xr-not-available');
        this.canvas = document.getElementById('ar-canvas');

        // Bind methods
        this.onWindowResize = this.onWindowResize.bind(this);
        this.onXRSessionStarted = this.onXRSessionStarted.bind(this);
        this.onXRSessionEnded = this.onXRSessionEnded.bind(this);
        this.animate = this.animate.bind(this);
        this.onSelect = this.onSelect.bind(this);

        // Audio setup
        this.setupAudio();

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

        // Create room scanner
        this.roomScanner = new RoomScanner(this.scene);

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
    }

    setupScene() {
        // Create scene
        this.scene = new THREE.Scene();

        // Create camera
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.01, 20);

        // Create renderer with optimized settings for Quest 3
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
        const ambientLight = new THREE.AmbientLight(0x404040, 1);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(0, 10, 0);
        this.scene.add(directionalLight);

        // Add some distant stars as a backdrop
        this.createStarfield();
    }

    setupAudio() {
        // Create audio context
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.sounds = {};
        
        // Define sound URLs
        const soundUrls = {
            shoot: 'sounds/laser.mp3',
            explosion: 'sounds/explosion.mp3',
            enemyAppear: 'sounds/enemy_appear.mp3',
            playerHit: 'sounds/player_hit.mp3',
            levelUp: 'sounds/level_up.mp3',
            gameStart: 'sounds/game_start.mp3'
        };
        
        // Preload sounds
        Object.entries(soundUrls).forEach(([name, url]) => {
            fetch(url)
                .then(response => response.arrayBuffer())
                .then(arrayBuffer => this.audioContext.decodeAudioData(arrayBuffer))
                .then(audioBuffer => {
                    this.sounds[name] = audioBuffer;
                })
                .catch(error => console.error('Error loading sound:', error));
        });
    }

    playSound(name) {
        if (this.sounds[name] && this.audioContext.state === 'running') {
            const source = this.audioContext.createBufferSource();
            source.buffer = this.sounds[name];
            source.connect(this.audioContext.destination);
            source.start(0);
        }
    }

    createStarfield() {
        // Create a starfield for background ambience
        const starGeometry = new THREE.BufferGeometry();
        const starCount = 1000;
        
        const positions = new Float32Array(starCount * 3);
        const colors = new Float32Array(starCount * 3);
        const sizes = new Float32Array(starCount);
        
        for (let i = 0; i < starCount; i++) {
            // Position stars in a large sphere around the play area
            const radius = 10 + Math.random() * 10;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;
            
            positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = radius * Math.cos(phi);
            
            // Random colors for stars
            const r = 0.8 + Math.random() * 0.2;
            const g = 0.8 + Math.random() * 0.2;
            const b = 0.9 + Math.random() * 0.1;
            
            colors[i * 3] = r;
            colors[i * 3 + 1] = g;
            colors[i * 3 + 2] = b;
            
            // Random sizes
            sizes[i] = Math.random() * 0.05 + 0.01;
        }
        
        starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        starGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        starGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        
        const starMaterial = new THREE.PointsMaterial({
            size: 0.05,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            sizeAttenuation: true
        });
        
        this.stars = new THREE.Points(starGeometry, starMaterial);
        this.scene.add(this.stars);
    }

    startXR() {
        if (!this.initialized) return;

        // Resume audio context on user gesture
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        // Request XR session with room scanning capabilities
        navigator.xr.isSessionSupported('immersive-ar').then((supported) => {
            if (supported) {
                navigator.xr.requestSession('immersive-ar', {
                    requiredFeatures: ['hit-test', 'dom-overlay', 'mesh-detection'],
                    optionalFeatures: ['anchors', 'plane-detection'],
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

        // Play game start sound
        this.playSound('gameStart');

        // Start game
        this.gameActive = true;
        this.score = 0;
        this.level = 1;
        this.lives = 3;
        this.updateScoreDisplay();
        this.updateLevelDisplay();
        this.updateLivesDisplay();

        // Initialize player
        this.session.requestReferenceSpace('local').then((refSpace) => {
            this.xrRefSpace = refSpace;
            
            // Scan the room before starting gameplay
            this.scanRoom();
        });
    }

    onXRSessionEnded() {
        this.session = null;
        this.hitTestSource = null;
        this.hitTestSourceRequested = false;
        this.gameActive = false;
        
        // Show start button again
        this.startButton.style.display = 'block';
        
        // Clean up game entities
        this.cleanupScene();
    }

    scanRoom() {
        // Use RoomScanner to analyze the environment
        this.loadingOverlay.style.display = 'flex';
        this.loadingOverlay.querySelector('#loading-text').textContent = 'Scanning room...';
        
        this.roomScanner.startScanning().then(roomGeometry => {
            this.roomGeometry = roomGeometry;
            this.roomScanned = true;
            
            // Hide loading overlay
            this.loadingOverlay.style.display = 'none';
            
            // Create player after room is scanned
            const camera = this.renderer.xr.getCamera();
            this.player = new Player(this.scene, camera);
            
            // Spawn initial wave of enemies based on room layout
            this.spawnEnemyWave();
        }).catch(error => {
            console.error('Room scanning error:', error);
            // Fallback in case room scanning fails
            this.roomScanned = true;
            this.loadingOverlay.style.display = 'none';
            
            const camera = this.renderer.xr.getCamera();
            this.player = new Player(this.scene, camera);
            this.spawnEnemyWave();
        });
    }

    cleanupScene() {
        // Remove all enemies
        for (let enemy of this.enemies) {
            enemy.remove();
        }
        this.enemies = [];

        // Remove all projectiles
        for (let projectile of this.projectiles) {
            projectile.remove();
        }
        this.projectiles = [];

        // Remove player
        if (this.player) {
            this.player.remove();
            this.player = null;
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
        if (!this.gameActive || !this.player) return;
        
        // Fire player weapon
        const camera = this.renderer.xr.getCamera();
        const direction = new THREE.Vector3(0, 0, -1);
        direction.applyQuaternion(camera.quaternion);
        
        this.player.shoot(direction);
        this.playSound('shoot');
        
        const projectile = new Projectile(this.scene, camera.position, direction, 'player');
        this.projectiles.push(projectile);
    }
    
    spawnEnemyWave() {
        // Don't spawn more than max enemies
        if (this.enemies.length >= this.maxEnemies) return;

        const camera = this.renderer.xr.getCamera();
        if (!camera) return;

        // Select a formation pattern based on level
        const patternIndex = (this.level - 1) % this.formationPatterns.length;
        const pattern = this.formationPatterns[patternIndex];
        
        // Find surfaces in the room to place enemies
        const surfaces = this.roomScanner.getDetectedSurfaces();
        
        // Play enemy appear sound
        this.playSound('enemyAppear');

        // Create enemies based on formation pattern and room layout
        for (let i = 0; i < Math.min(pattern.length, this.enemiesPerWave); i++) {
            // Calculate spawn position
            let spawnPosition;
            
            if (surfaces.length > 0) {
                // Use detected surfaces if available
                const surface = surfaces[Math.floor(Math.random() * surfaces.length)];
                spawnPosition = surface.getRandomPoint();
                
                // Adjust height to make enemy visible
                spawnPosition.y += 1.0 + Math.random() * 0.5;
            } else {
                // Default spawning in front of player if no surfaces are detected
                const basePos = camera.position.clone();
                const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
                
                // Calculate spawn position from pattern and camera
                spawnPosition = basePos.clone().add(
                    forward.clone().multiplyScalar(3 + Math.random())
                );
                
                // Add pattern offset
                spawnPosition.x += pattern[i].x * 2;
                spawnPosition.y += pattern[i].y * 2;
                spawnPosition.z += pattern[i].z * 0.5;
            }

            // Create an enemy with higher difficulty based on level
            const enemy = new Enemy(this.scene, spawnPosition, this.level);
            this.enemies.push(enemy);
        }
        
        this.enemyWaveCount++;
    }

    checkCollisions() {
        if (!this.player) return;

        const projectilesToRemove = [];
        const enemiesToRemove = [];

        // Check projectiles against enemies
        for (let i = 0; i < this.projectiles.length; i++) {
            const projectile = this.projectiles[i];
            
            if (projectile.owner === 'player') {
                // Player projectiles hit enemies
                for (let j = 0; j < this.enemies.length; j++) {
                    const enemy = this.enemies[j];
                    if (projectile.checkCollision(enemy.getPosition(), enemy.getRadius())) {
                        // Enemy hit
                        enemy.hit();
                        if (enemy.isDead()) {
                            enemiesToRemove.push(j);
                            
                            // Play explosion sound
                            this.playSound('explosion');
                            
                            // Increase score
                            this.score += 100 * this.level;
                            this.updateScoreDisplay();
                        }
                        projectilesToRemove.push(i);
                        break;
                    }
                }
            } else {
                // Enemy projectiles hit player
                if (this.player && projectile.checkCollision(this.player.getPosition(), this.player.getRadius())) {
                    // Player hit
                    this.playerHit();
                    projectilesToRemove.push(i);
                }
            }
            
            // Check if projectile has exceeded its lifetime
            if (projectile.hasExpired()) {
                projectilesToRemove.push(i);
            }
        }

        // Remove hit projectiles (in reverse order to avoid index issues)
        for (let i = projectilesToRemove.length - 1; i >= 0; i--) {
            const index = projectilesToRemove[i];
            this.projectiles[index].remove();
            this.projectiles.splice(index, 1);
        }

        // Remove dead enemies (in reverse order to avoid index issues)
        for (let i = enemiesToRemove.length - 1; i >= 0; i--) {
            const index = enemiesToRemove[i];
            this.enemies[index].remove();
            this.enemies.splice(index, 1);
        }
    }

    playerHit() {
        if (!this.player) return;
        
        // Play hit sound
        this.playSound('playerHit');
        
        // Reduce lives
        this.lives--;
        this.updateLivesDisplay();
        
        // Show hit effect
        this.player.showHitEffect();
        
        // Check for game over
        if (this.lives <= 0) {
            this.gameOver();
        }
    }

    gameOver() {
        // End the game
        this.gameActive = false;
        
        // Show game over message
        const gameOverMsg = document.createElement('div');
        gameOverMsg.className = 'game-over';
        gameOverMsg.innerHTML = `
            <h1>GAME OVER</h1>
            <p>Final Score: ${this.score}</p>
            <p>Level Reached: ${this.level}</p>
            <button id="restart-button">Restart</button>
        `;
        document.body.appendChild(gameOverMsg);
        
        // Add restart functionality
        document.getElementById('restart-button').addEventListener('click', () => {
            document.body.removeChild(gameOverMsg);
            this.cleanupScene();
            this.session.end();
        });
    }

    checkLevelAdvance() {
        // If all enemies are defeated, advance level
        if (this.enemies.length === 0 && this.enemyWaveCount > 0) {
            this.level++;
            this.updateLevelDisplay();
            
            // Play level up sound
            this.playSound('levelUp');
            
            // Show level up message
            this.showLevelUpMessage();
            
            // Increase enemy count for next wave
            this.enemiesPerWave = Math.min(5 + this.level, this.maxEnemies);
            
            // Reset wave counter for new level
            this.enemyWaveCount = 0;
            
            // Spawn new wave of enemies after a delay
            setTimeout(() => this.spawnEnemyWave(), 3000);
        }
    }

    showLevelUpMessage() {
        const levelUpMsg = document.createElement('div');
        levelUpMsg.className = 'level-up-message';
        levelUpMsg.textContent = `LEVEL ${this.level}`;
        document.body.appendChild(levelUpMsg);
        
        // Remove after animation
        setTimeout(() => {
            document.body.removeChild(levelUpMsg);
        }, 2000);
    }

    updateScoreDisplay() {
        this.scoreValue.textContent = this.score;
    }

    updateLevelDisplay() {
        this.levelValue.textContent = this.level;
    }

    updateLivesDisplay() {
        this.livesValue.textContent = this.lives;
    }

    animate(timestamp, frame) {
        this.frameCounter++;

        if (frame && this.gameActive) {
            // Update player
            if (this.player) {
                this.player.update();
            }
            
            // Update projectiles
            for (let projectile of this.projectiles) {
                projectile.update();
            }
            
            // Update enemies
            for (let enemy of this.enemies) {
                enemy.update();
                
                // Enemies can fire at random intervals
                if (Math.random() < 0.001 * this.level && enemy.canFire()) {
                    const targetDir = this.player ? 
                        new THREE.Vector3().subVectors(this.player.getPosition(), enemy.getPosition()).normalize() : 
                        new THREE.Vector3(0, -1, 0);
                    
                    const projectile = new Projectile(this.scene, enemy.getPosition(), targetDir, 'enemy');
                    this.projectiles.push(projectile);
                    enemy.onFire();
                }
            }
            
            // Check for collisions
            this.checkCollisions();
            
            // Check if level should advance
            this.checkLevelAdvance();
            
            // Spawn new enemies periodically based on level
            if (this.roomScanned && this.frameCounter % (240 - this.level * 10) === 0) {
                // Make sure we have a minimum number of enemies on screen
                if (this.enemies.length < Math.min(3 + this.level, this.maxEnemies)) {
                    this.spawnEnemyWave();
                }
            }
            
            // Continue room scanning and updating
            if (this.roomScanner) {
                this.roomScanner.update();
            }
        }
    }
}

// Start the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new App();
});
