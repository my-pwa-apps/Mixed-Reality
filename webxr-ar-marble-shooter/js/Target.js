import * as CANNON from 'https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.min.js';

export class Target {
    constructor(scene, physicsWorld, position) {
        this.scene = scene;
        this.physicsWorld = physicsWorld;
        this.radius = 0.1; // 10cm radius
        this.active = true;
        
        // Create different target shapes with varying difficulty
        this.createTarget(position);
        
        // Add movement to make it interesting
        this.applyRandomMovement();
    }
    
    createTarget(position) {
        // Randomly select target type
        const targetType = Math.floor(Math.random() * 3);
        
        let geometry;
        const material = new THREE.MeshStandardMaterial({
            color: 0xFFA500, // Orange
            emissive: 0xFF4500, // Red-orange glow
            emissiveIntensity: 0.3,
            roughness: 0.2,
            metalness: 0.8
        });
        
        // Create different shapes based on the target type
        switch(targetType) {
            case 0: // Sphere
                geometry = new THREE.SphereGeometry(this.radius, 16, 16);
                break;
            case 1: // Cube
                geometry = new THREE.BoxGeometry(this.radius * 1.8, this.radius * 1.8, this.radius * 1.8);
                break;
            case 2: // Torus (donut)
                geometry = new THREE.TorusGeometry(this.radius, this.radius / 3, 16, 32);
                break;
        }
        
        // Create mesh
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(position);
        this.scene.add(this.mesh);
        
        // Create physics body
        let shape;
        switch(targetType) {
            case 0: // Sphere
                shape = new CANNON.Sphere(this.radius);
                break;
            case 1: // Cube
                shape = new CANNON.Box(new CANNON.Vec3(
                    this.radius * 0.9, 
                    this.radius * 0.9, 
                    this.radius * 0.9
                ));
                break;
            case 2: // Torus - approximate with a sphere
                shape = new CANNON.Sphere(this.radius);
                break;
        }
        
        this.body = new CANNON.Body({
            mass: 0, // Mass of 0 makes it static
            shape: shape,
            material: new CANNON.Material()
        });
        
        this.body.position.copy(this.mesh.position);
        this.physicsWorld.addBody(this.body);
        
        // Store target type
        this.targetType = targetType;
        
        // Add visual effects - particle system
        this.addParticleSystem();
    }
      addParticleSystem() {
        // Use fewer particles on mobile devices for better performance
        const particleCount = 12; // Reduced from 20
        const particles = new THREE.BufferGeometry();
        
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        
        const color = new THREE.Color();
        
        for (let i = 0; i < particleCount; i++) {
            // Position particles in a small sphere around the target
            const radius = this.radius * 1.2;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;
            
            positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = radius * Math.cos(phi);
            
            // Set colors - using a more limited palette for better batching
            const hue = (i % 3) * 0.05 + 0.05; // Just a few hue variations
            color.setHSL(hue, 0.9, 0.5); // Orange-red hues
            
            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
        }
        
        particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        particles.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        
        // Create particle material with optimized settings
        const particleMaterial = new THREE.PointsMaterial({
            size: 0.01,
            vertexColors: true,
            transparent: true,
            opacity: 0.7,
            sizeAttenuation: true,
            blending: THREE.AdditiveBlending, // More visually appealing
            depthWrite: false // Better for transparent particles
        });
        
        this.particleSystem = new THREE.Points(particles, particleMaterial);
        this.mesh.add(this.particleSystem);
        
        // Animate particles with randomized rotation direction for variety
        this.particleRotationSpeed = (Math.random() > 0.5 ? 1 : -1) * 0.015;
    }
    
    applyRandomMovement() {
        // Add oscillation or rotation to the target
        this.movementType = Math.floor(Math.random() * 3);
        
        this.oscillationSpeed = 0.5 + Math.random() * 1.5; // Speed factor
        this.oscillationAmplitude = 0.2 + Math.random() * 0.3; // Movement range
        this.oscillationOffset = Math.random() * Math.PI * 2; // Random starting phase
        
        this.rotationSpeed = {
            x: (Math.random() - 0.5) * 0.05,
            y: (Math.random() - 0.5) * 0.05,
            z: (Math.random() - 0.5) * 0.05
        };
        
        // Starting time
        this.startTime = Date.now();
    }
    
    update() {
        if (!this.active) return;
        
        const elapsedTime = (Date.now() - this.startTime) / 1000;
        
        switch(this.movementType) {
            case 0: // Vertical oscillation
                this.mesh.position.y = this.body.position.y + 
                    Math.sin(elapsedTime * this.oscillationSpeed + this.oscillationOffset) * 
                    this.oscillationAmplitude;
                break;
                
            case 1: // Horizontal orbit
                const orbitRadius = this.oscillationAmplitude;
                const orbitX = Math.cos(elapsedTime * this.oscillationSpeed + this.oscillationOffset) * orbitRadius;
                const orbitZ = Math.sin(elapsedTime * this.oscillationSpeed + this.oscillationOffset) * orbitRadius;
                
                this.mesh.position.x = this.body.position.x + orbitX;
                this.mesh.position.z = this.body.position.z + orbitZ;
                break;
                
            case 2: // Self rotation
                this.mesh.rotation.x += this.rotationSpeed.x;
                this.mesh.rotation.y += this.rotationSpeed.y;
                this.mesh.rotation.z += this.rotationSpeed.z;
                break;
        }
        
        // Rotate particle system
        if (this.particleSystem) {
            this.particleSystem.rotation.y += this.particleRotationSpeed;
        }
    }
    
    checkCollision(marble) {
        if (!this.active || !marble) return false;
        
        // Calculate distance between marble and target
        const distance = marble.mesh.position.distanceTo(this.mesh.position);
        
        // Check if collision occurred based on the combined radius
        const collisionThreshold = this.radius + marble.body.shapes[0].radius;
        
        if (distance < collisionThreshold) {
            this.explode();
            return true;
        }
        
        return false;
    }
    
    explode() {
        if (!this.active) return;
        
        this.active = false;
        
        // Create explosion effect
        const explosionGeometry = new THREE.SphereGeometry(this.radius, 8, 8);
        const explosionMaterial = new THREE.MeshBasicMaterial({
            color: 0xFF4500,
            transparent: true,
            opacity: 0.8
        });
        
        const explosion = new THREE.Mesh(explosionGeometry, explosionMaterial);
        explosion.position.copy(this.mesh.position);
        this.scene.add(explosion);
        
        // Create animation for explosion
        const expandAndFade = () => {
            explosion.scale.multiplyScalar(1.1);
            explosion.material.opacity -= 0.05;
            
            if (explosion.material.opacity > 0) {
                requestAnimationFrame(expandAndFade);
            } else {
                this.scene.remove(explosion);
            }
        };
        
        requestAnimationFrame(expandAndFade);
        
        // Hide the target instead of removing immediately (smoother transition)
        this.mesh.visible = false;
    }
    
    remove() {
        if (this.mesh) {
            this.scene.remove(this.mesh);
        }
        
        if (this.body) {
            this.physicsWorld.removeBody(this.body);
        }
        
        this.active = false;
    }
}
