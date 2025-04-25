// filepath: c:\Users\bartm\OneDrive - Microsoft\Documents\Git Repos\Mixed Reality\webxr-ar-marble-shooter\js\Enemy.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.144.0/build/three.module.js';

export class Enemy {
    constructor(scene, position, level = 1) {
        this.scene = scene;
        this.position = position;
        this.level = level;
        this.health = Math.ceil(level / 3); // Higher levels have more health
        this.radius = 0.1; // Collision radius
        this.speed = 0.01 + (level * 0.002); // Speed increases with level
        this.lastFireTime = 0;
        this.fireRate = 3000 - (level * 200); // Time between shots, faster at higher levels
        this.active = true;
        
        // Enemy behavior patterns
        this.behaviorTypes = ['circler', 'diver', 'zigzag', 'formation'];
        this.behavior = this.behaviorTypes[Math.floor(Math.random() * this.behaviorTypes.length)];
        
        // Create the enemy model
        this.createEnemyModel();
        
        // Movement pattern variables
        this.moveTime = 0;
        this.targetPosition = null;
        this.originalPosition = position.clone();
        this.movePhase = 0;
    }
    
    createEnemyModel() {
        // Different enemy types based on behavior
        let geometry;
        const enemyType = Math.floor(Math.random() * 3);
        
        switch (enemyType) {
            case 0: // Classic Galaga bee-type enemy
                geometry = new THREE.ConeGeometry(0.07, 0.14, 5);
                geometry.rotateX(-Math.PI / 2); // Point downwards
                break;
            case 1: // Boss-type enemy (butterfly)
                geometry = new THREE.BoxGeometry(0.15, 0.04, 0.08);
                // Add wings
                const wingGeometry = new THREE.BoxGeometry(0.05, 0.02, 0.03);
                const wing1 = new THREE.Mesh(wingGeometry, 
                    new THREE.MeshStandardMaterial({ color: 0xff00ff, emissive: 0x330033 }));
                const wing2 = wing1.clone();
                wing1.position.set(0.1, 0, 0);
                wing2.position.set(-0.1, 0, 0);
                
                // Create merged geometry using BufferGeometryUtils
                const mergedGeometry = new THREE.BufferGeometry();
                const boxGeo = new THREE.BoxGeometry(0.15, 0.04, 0.08);
                
                // Create instances of the geometries at the right positions
                const boxMesh = new THREE.Mesh(boxGeo);
                const wing1Mesh = new THREE.Mesh(wingGeometry);
                const wing2Mesh = new THREE.Mesh(wingGeometry);
                
                wing1Mesh.position.set(0.1, 0, 0);
                wing2Mesh.position.set(-0.1, 0, 0);
                
                // Apply transforms to the meshes
                wing1Mesh.updateMatrix();
                wing2Mesh.updateMatrix();
                
                // Clone and transform the geometries
                const wing1Geo = wingGeometry.clone().applyMatrix4(wing1Mesh.matrix);
                const wing2Geo = wingGeometry.clone().applyMatrix4(wing2Mesh.matrix);
                
                // Manually create merged geometry since BufferGeometryUtils might not be available
                geometry = boxGeo;
                break;
            case 2: // Scorpion-type enemy
                geometry = new THREE.SphereGeometry(0.06, 8, 8);
                break;
        }
        
        // Colors based on enemy level
        let color, emissive;
        if (this.level <= 3) {
            color = 0xff0000; // Red for early levels
            emissive = 0x330000;
        } else if (this.level <= 6) {
            color = 0xff00ff; // Magenta for mid levels
            emissive = 0x330033;
        } else {
            color = 0xffff00; // Yellow for high levels
            emissive = 0x333300;
        }
        
        const material = new THREE.MeshStandardMaterial({
            color: color,
            emissive: emissive,
            metalness: 0.7,
            roughness: 0.2
        });
        
        // Create mesh and position
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(this.position);
        this.scene.add(this.mesh);
        
        // For type 1 (butterfly), manually add wings since we couldn't use BufferGeometryUtils
        if (enemyType === 1) {
            const wingMat = new THREE.MeshStandardMaterial({ color: 0xff00ff, emissive: 0x330033 });
            const leftWing = new THREE.Mesh(wingGeometry, wingMat);
            const rightWing = new THREE.Mesh(wingGeometry, wingMat);
            leftWing.position.set(0.1, 0, 0);
            rightWing.position.set(-0.1, 0, 0);
            this.mesh.add(leftWing);
            this.mesh.add(rightWing);
        }
        
        // For type 2 (scorpion), manually add appendages
        if (enemyType === 2) {
            const appendageGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.08);
            const appendageMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0x330000 });
            const appendage1 = new THREE.Mesh(appendageGeo, appendageMat);
            const appendage2 = new THREE.Mesh(appendageGeo, appendageMat);
            appendage1.position.set(0.05, 0, 0.05);
            appendage2.position.set(-0.05, 0, 0.05);
            appendage1.rotation.x = Math.PI / 4;
            appendage2.rotation.x = Math.PI / 4;
            this.mesh.add(appendage1);
            this.mesh.add(appendage2);
        }
        
        // Add particle effect for engine
        this.addEngineEffect();
    }
    
    addEngineEffect() {
        const particleCount = 8;
        const particles = new THREE.BufferGeometry();
        
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        
        const color = this.mesh.material.color;
        
        for (let i = 0; i < particleCount; i++) {
            // Position particles in a small area behind the enemy
            positions[i * 3] = (Math.random() - 0.5) * 0.03;
            positions[i * 3 + 1] = (Math.random() - 0.5) * 0.03;
            positions[i * 3 + 2] = 0.05 + Math.random() * 0.05;
            
            // Set colors based on enemy color with some variation
            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
        }
        
        particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        particles.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        
        const particleMaterial = new THREE.PointsMaterial({
            size: 0.01,
            vertexColors: true,
            transparent: true,
            opacity: 0.7,
            blending: THREE.AdditiveBlending
        });
        
        this.engineParticles = new THREE.Points(particles, particleMaterial);
        this.mesh.add(this.engineParticles);
    }
    
    getRandomPositionInRoom(roomGeometry = null) {
        if (roomGeometry && roomGeometry.boundingBox) {
            // Use room boundaries if available
            const box = roomGeometry.boundingBox;
            const x = box.min.x + Math.random() * (box.max.x - box.min.x);
            const y = box.min.y + 1 + Math.random(); // Keep above floor
            const z = box.min.z + Math.random() * (box.max.z - box.min.z);
            return new THREE.Vector3(x, y, z);
        } else {
            // Default positioning logic
            const distance = 2 + Math.random() * 3;
            const angle = Math.random() * Math.PI * 2;
            const height = 1 + Math.random() * 2;
            
            return new THREE.Vector3(
                Math.sin(angle) * distance,
                height,
                Math.cos(angle) * distance
            );
        }
    }
    
    update() {
        if (!this.active) return;
        
        this.moveTime += 0.01;
        
        // Different movement patterns based on behavior type
        switch (this.behavior) {
            case 'circler':
                // Circle around initial position
                const circleRadius = 0.5;
                const circleX = this.originalPosition.x + Math.sin(this.moveTime) * circleRadius;
                const circleZ = this.originalPosition.z + Math.cos(this.moveTime) * circleRadius;
                this.mesh.position.x = circleX;
                this.mesh.position.z = circleZ;
                
                // Slight bobbing motion
                this.mesh.position.y = this.originalPosition.y + Math.sin(this.moveTime * 2) * 0.1;
                
                // Always face movement direction
                this.mesh.lookAt(
                    circleX + Math.sin(this.moveTime + 0.1) * circleRadius,
                    this.mesh.position.y,
                    circleZ + Math.cos(this.moveTime + 0.1) * circleRadius
                );
                break;
                
            case 'diver':
                // Periodically dive toward player position
                if (!this.targetPosition || this.movePhase > 2) {
                    // Reset dive cycle
                    this.targetPosition = this.originalPosition.clone();
                    this.movePhase = 0;
                }
                
                if (this.movePhase === 0) {
                    // Move back to original position
                    this.mesh.position.lerp(this.originalPosition, this.speed);
                    
                    // When close to original position, prepare to dive
                    if (this.mesh.position.distanceTo(this.originalPosition) < 0.1) {
                        this.movePhase = 1;
                        // Wait here for a moment
                        setTimeout(() => {
                            this.movePhase = 2;
                            // Set a dive target position (simulating diving at player)
                            this.targetPosition = new THREE.Vector3(
                                this.originalPosition.x,
                                this.originalPosition.y - 1.5,
                                this.originalPosition.z
                            );
                        }, 1000 + Math.random() * 2000);
                    }
                } else if (this.movePhase === 2) {
                    // Dive toward target
                    this.mesh.position.lerp(this.targetPosition, this.speed * 1.5);
                    
                    // When dive complete, return to original position
                    if (this.mesh.position.distanceTo(this.targetPosition) < 0.1) {
                        this.movePhase = 3;
                        setTimeout(() => this.movePhase = 0, 500);
                    }
                }
                
                // Always look in movement direction
                const lookTarget = new THREE.Vector3(
                    this.mesh.position.x,
                    this.mesh.position.y - 1,
                    this.mesh.position.z
                );
                this.mesh.lookAt(lookTarget);
                break;
                
            case 'zigzag':
                // Zigzag movement pattern
                const zigzagAmplitude = 0.5;
                const zigzagSpeed = 1.5;
                
                this.mesh.position.x = this.originalPosition.x + 
                    Math.sin(this.moveTime * zigzagSpeed) * zigzagAmplitude;
                    
                this.mesh.position.y = this.originalPosition.y + 
                    Math.sin(this.moveTime * zigzagSpeed * 2) * 0.2;
                    
                // Rotate to face movement direction
                const lookAhead = new THREE.Vector3(
                    this.mesh.position.x + Math.cos(this.moveTime * zigzagSpeed) * 0.1,
                    this.mesh.position.y,
                    this.mesh.position.z
                );
                this.mesh.lookAt(lookAhead);
                break;
                
            case 'formation':
            default:
                // Stay in formation, subtle movement
                this.mesh.position.y = this.originalPosition.y + 
                    Math.sin(this.moveTime * 2) * 0.1;
                    
                // Slight rotation animation
                this.mesh.rotation.z = Math.sin(this.moveTime) * 0.2;
                this.mesh.rotation.x = Math.cos(this.moveTime * 0.5) * 0.1;
                break;
        }
        
        // Update particle effect
        if (this.engineParticles) {
            this.engineParticles.rotation.y = this.moveTime * 2;
        }
    }
    
    hit() {
        this.health--;
        
        // Flash effect on hit
        const originalMaterial = this.mesh.material;
        const hitMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: 0xffffff,
            metalness: 0.7,
            roughness: 0.2
        });
        
        this.mesh.material = hitMaterial;
        
        // Revert to original material after flash
        setTimeout(() => {
            if (this.mesh) {
                this.mesh.material = originalMaterial;
            }
        }, 100);
        
        // If dead, show explosion
        if (this.health <= 0) {
            this.explode();
        }
    }
    
    explode() {
        if (!this.active) return;
        
        this.active = false;
        
        // Create explosion effect
        const explosionGeometry = new THREE.SphereGeometry(0.15, 8, 8);
        const explosionMaterial = new THREE.MeshBasicMaterial({
            color: 0xff9900,
            transparent: true,
            opacity: 0.8
        });
        
        const explosion = new THREE.Mesh(explosionGeometry, explosionMaterial);
        explosion.position.copy(this.mesh.position);
        this.scene.add(explosion);
        
        // Create particles for explosion
        const particleCount = 20;
        const explosionParticles = new THREE.BufferGeometry();
        
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        const sizes = new Float32Array(particleCount);
        
        const color1 = new THREE.Color(0xff5500);
        const color2 = new THREE.Color(0xffaa00);
        
        for (let i = 0; i < particleCount; i++) {
            // Randomize positions in sphere
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;
            const radius = 0.05 + Math.random() * 0.1;
            
            positions[i * 3] = this.mesh.position.x + radius * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = this.mesh.position.y + radius * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = this.mesh.position.z + radius * Math.cos(phi);
            
            // Interpolate between two colors
            const mixFactor = Math.random();
            const particleColor = new THREE.Color().lerpColors(color1, color2, mixFactor);
            
            colors[i * 3] = particleColor.r;
            colors[i * 3 + 1] = particleColor.g;
            colors[i * 3 + 2] = particleColor.b;
            
            // Random sizes
            sizes[i] = Math.random() * 0.03 + 0.01;
        }
        
        explosionParticles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        explosionParticles.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        explosionParticles.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        
        const particleMaterial = new THREE.PointsMaterial({
            size: 0.05,
            vertexColors: true,
            transparent: true,
            opacity: 1,
            sizeAttenuation: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        
        const particleSystem = new THREE.Points(explosionParticles, particleMaterial);
        this.scene.add(particleSystem);
        
        // Animate explosion
        const startTime = Date.now();
        const expandAndFade = () => {
            const elapsed = Date.now() - startTime;
            const duration = 1000; // 1 second explosion
            
            if (elapsed < duration) {
                const progress = elapsed / duration;
                
                // Expand explosion
                explosion.scale.set(1 + progress * 2, 1 + progress * 2, 1 + progress * 2);
                explosion.material.opacity = 1 - progress;
                
                // Expand and fade particles
                particleMaterial.opacity = 1 - progress;
                
                // Move particles outward
                const positions = explosionParticles.attributes.position.array;
                for (let i = 0; i < particleCount; i++) {
                    const idx = i * 3;
                    const dirX = positions[idx] - this.mesh.position.x;
                    const dirY = positions[idx + 1] - this.mesh.position.y;
                    const dirZ = positions[idx + 2] - this.mesh.position.z;
                    
                    positions[idx] += dirX * 0.03;
                    positions[idx + 1] += dirY * 0.03;
                    positions[idx + 2] += dirZ * 0.03;
                }
                explosionParticles.attributes.position.needsUpdate = true;
                
                requestAnimationFrame(expandAndFade);
            } else {
                // Remove explosion objects
                this.scene.remove(explosion);
                this.scene.remove(particleSystem);
            }
        };
        
        requestAnimationFrame(expandAndFade);
        
        // Hide enemy mesh
        this.scene.remove(this.mesh);
    }
    
    canFire() {
        const now = Date.now();
        return now - this.lastFireTime > this.fireRate;
    }
    
    onFire() {
        this.lastFireTime = Date.now();
    }
    
    getPosition() {
        return this.mesh.position.clone();
    }
    
    getRadius() {
        return this.radius;
    }
    
    isDead() {
        return this.health <= 0;
    }
    
    remove() {
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh = null;
        }
        this.active = false;
    }
}
