import * as THREE from 'three';

export class Projectile {
    constructor(scene, position, direction, owner) {
        this.scene = scene;
        this.direction = direction.normalize();
        this.speed = owner === 'player' ? 0.15 : 0.08; // Player projectiles are faster
        this.owner = owner; // 'player' or 'enemy'
        this.lifespan = 2000; // Projectiles disappear after 2 seconds
        this.creationTime = Date.now();
        this.active = true;
        this.radius = 0.02; // Collision radius
        
        // Create projectile mesh
        this.createProjectileMesh(position);
    }
    
    createProjectileMesh(position) {
        // Different appearance based on owner
        let geometry, material;
        
        if (this.owner === 'player') {
            // Player projectiles are blue lasers
            geometry = new THREE.CylinderGeometry(0.01, 0.01, 0.15, 8);
            geometry.rotateX(Math.PI / 2); // Align with direction
            
            material = new THREE.MeshBasicMaterial({
                color: 0x00ffff,
                emissive: 0x00aaaa,
                transparent: true,
                opacity: 0.8
            });
            
            // Add glow effect
            const glowMaterial = new THREE.MeshBasicMaterial({
                color: 0x00ffff,
                transparent: true,
                opacity: 0.4,
                side: THREE.BackSide
            });
            
            const glowMesh = new THREE.Mesh(
                new THREE.CylinderGeometry(0.02, 0.02, 0.17, 8),
                glowMaterial
            );
            glowMesh.rotateX(Math.PI / 2);
            
            this.mesh = new THREE.Group();
            this.mesh.add(new THREE.Mesh(geometry, material));
            this.mesh.add(glowMesh);
        } else {
            // Enemy projectiles are red energy balls
            geometry = new THREE.SphereGeometry(0.03, 8, 8);
            
            material = new THREE.MeshBasicMaterial({
                color: 0xff0000,
                emissive: 0xaa0000,
                transparent: true,
                opacity: 0.8
            });
            
            this.mesh = new THREE.Mesh(geometry, material);
            
            // Add point light for glow effect
            const light = new THREE.PointLight(0xff0000, 0.5, 0.2);
            this.mesh.add(light);
        }
        
        // Position the projectile
        this.mesh.position.copy(position);
        
        // Add to scene
        this.scene.add(this.mesh);
        
        // Add trail effect
        this.createTrailEffect();
    }
    
    createTrailEffect() {
        // Skip trail for enemy projectiles to save performance
        if (this.owner !== 'player') return;
        
        const trailLength = 10;
        const trailPositions = new Float32Array(trailLength * 3);
        const trailColors = new Float32Array(trailLength * 3);
        
        // Initialize all positions to the starting point
        for (let i = 0; i < trailLength; i++) {
            trailPositions[i * 3] = this.mesh.position.x;
            trailPositions[i * 3 + 1] = this.mesh.position.y;
            trailPositions[i * 3 + 2] = this.mesh.position.z;
            
            // Fade out color along the trail
            const intensity = 1 - (i / trailLength);
            trailColors[i * 3] = 0; // R
            trailColors[i * 3 + 1] = 1 * intensity; // G
            trailColors[i * 3 + 2] = 1 * intensity; // B
        }
        
        const trailGeometry = new THREE.BufferGeometry();
        trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
        trailGeometry.setAttribute('color', new THREE.BufferAttribute(trailColors, 3));
        
        const trailMaterial = new THREE.LineBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: 0.4,
            blending: THREE.AdditiveBlending
        });
        
        this.trail = new THREE.Line(trailGeometry, trailMaterial);
        this.scene.add(this.trail);
        
        // Store trail positions history
        this.trailPositions = [];
        for (let i = 0; i < trailLength; i++) {
            this.trailPositions.push(this.mesh.position.clone());
        }
    }
    
    update() {
        if (!this.active) return;
        
        // Move projectile in direction
        this.mesh.position.add(this.direction.clone().multiplyScalar(this.speed));
        
        // Update trail if exists
        if (this.trail) {
            // Shift positions along the trail
            this.trailPositions.pop(); // Remove oldest
            this.trailPositions.unshift(this.mesh.position.clone()); // Add newest at front
            
            // Update trail geometry
            const positions = this.trail.geometry.attributes.position.array;
            for (let i = 0; i < this.trailPositions.length; i++) {
                const pos = this.trailPositions[i];
                positions[i * 3] = pos.x;
                positions[i * 3 + 1] = pos.y;
                positions[i * 3 + 2] = pos.z;
            }
            this.trail.geometry.attributes.position.needsUpdate = true;
        }
        
        // Add rotation animation for enemy projectiles
        if (this.owner === 'enemy' && this.mesh) {
            this.mesh.rotation.x += 0.1;
            this.mesh.rotation.y += 0.15;
        }
    }
    
    checkCollision(targetPosition, targetRadius) {
        if (!this.active) return false;
        
        const distance = this.mesh.position.distanceTo(targetPosition);
        return distance < (this.radius + targetRadius);
    }
    
    hasExpired() {
        return Date.now() - this.creationTime > this.lifespan;
    }
    
    remove() {
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh = null;
        }
        
        if (this.trail) {
            this.scene.remove(this.trail);
            this.trail = null;
        }
        
        this.active = false;
    }
}
