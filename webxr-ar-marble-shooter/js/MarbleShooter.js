import * as CANNON from 'https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.min.js';

export class MarbleShooter {
    constructor(scene, physicsWorld) {
        this.scene = scene;
        this.physicsWorld = physicsWorld;
        this.marbles = [];
        this.maxMarbles = 20; // Maximum number of marbles before recycling
        this.marbleRadius = 0.02; // 2cm radius
        this.shootingForce = 15; // Force to apply when shooting
        this.marbleLifetime = 10000; // Marbles disappear after 10 seconds
        
        // Material for marbles with random colors
        this.marbleMaterials = [
            new THREE.MeshStandardMaterial({ color: 0xff0000 }), // Red
            new THREE.MeshStandardMaterial({ color: 0x00ff00 }), // Green
            new THREE.MeshStandardMaterial({ color: 0x0000ff }), // Blue
            new THREE.MeshStandardMaterial({ color: 0xffff00 }), // Yellow
            new THREE.MeshStandardMaterial({ color: 0xff00ff }), // Magenta
            new THREE.MeshStandardMaterial({ color: 0x00ffff })  // Cyan
        ];
        
        // Create marble geometry (reused for all marbles)
        this.marbleGeometry = new THREE.SphereGeometry(this.marbleRadius, 16, 16);
    }
    
    // Shoot a marble from a position in a direction
    shoot(position, direction) {
        // Create or reuse a marble
        const marble = this.createMarble();
        
        // Position the marble slightly in front of the camera to avoid collisions
        const offset = direction.clone().multiplyScalar(0.1);
        marble.mesh.position.copy(position).add(offset);
        
        // Update physics body position
        marble.body.position.copy(marble.mesh.position);
        
        // Apply force in the direction the camera is facing
        const force = direction.clone().multiplyScalar(this.shootingForce);
        marble.body.applyImpulse(
            new CANNON.Vec3(force.x, force.y, force.z),
            new CANNON.Vec3(0, 0, 0)
        );
        
        // Set creation time for lifetime tracking
        marble.creationTime = Date.now();
    }
    
    // Create a new marble or reuse an old one
    createMarble() {
        // If we already have max marbles, reuse the oldest one
        if (this.marbles.length >= this.maxMarbles) {
            const oldestMarble = this.marbles.shift(); // Remove the oldest marble
            
            // Reset its position and velocity
            oldestMarble.body.velocity.set(0, 0, 0);
            oldestMarble.body.angularVelocity.set(0, 0, 0);
            
            // Change its color for variety
            const randomMaterial = this.marbleMaterials[Math.floor(Math.random() * this.marbleMaterials.length)];
            oldestMarble.mesh.material = randomMaterial;
            
            return oldestMarble;
        }
        
        // Create a new marble with random material
        const randomMaterial = this.marbleMaterials[Math.floor(Math.random() * this.marbleMaterials.length)];
        const marbleMesh = new THREE.Mesh(this.marbleGeometry, randomMaterial);
        
        // Add to scene
        this.scene.add(marbleMesh);
        
        // Create physics body for the marble
        const marbleShape = new CANNON.Sphere(this.marbleRadius);
        const marbleBody = new CANNON.Body({
            mass: 0.1, // 100 grams
            shape: marbleShape,
            material: new CANNON.Material({
                friction: 0.3,
                restitution: 0.7 // Bouncy marbles
            })
        });
        
        // Add to physics world
        this.physicsWorld.addBody(marbleBody);
        
        // Create marble object and add to array
        const marble = {
            mesh: marbleMesh,
            body: marbleBody,
            creationTime: Date.now()
        };
        
        this.marbles.push(marble);
        return marble;
    }
    
    // Update all marbles (position sync between physics and rendering)
    update() {
        for (const marble of this.marbles) {
            // Update mesh position based on physics body
            marble.mesh.position.copy(marble.body.position);
            marble.mesh.quaternion.copy(marble.body.quaternion);
        }
    }
    
    // Remove marbles that have lived too long or fallen too far
    cleanupMarbles() {
        const now = Date.now();
        const marblesToRemove = [];
        
        for (let i = 0; i < this.marbles.length; i++) {
            const marble = this.marbles[i];
            
            // Check if marble has lived too long
            if (now - marble.creationTime > this.marbleLifetime) {
                marblesToRemove.push(i);
                continue;
            }
            
            // Check if marble has fallen too far
            if (marble.body.position.y < -10) {
                marblesToRemove.push(i);
                continue;
            }
        }
        
        // Remove marbles (in reverse order to avoid index issues)
        for (let i = marblesToRemove.length - 1; i >= 0; i--) {
            const index = marblesToRemove[i];
            const marble = this.marbles[index];
            
            // Remove from scene and physics world
            this.scene.remove(marble.mesh);
            this.physicsWorld.removeBody(marble.body);
            
            // Remove from array
            this.marbles.splice(index, 1);
        }
    }
    
    // Get all active marbles
    getActiveMarbles() {
        return this.marbles;
    }
    
    // Clean up all resources
    remove() {
        for (const marble of this.marbles) {
            this.scene.remove(marble.mesh);
            this.physicsWorld.removeBody(marble.body);
        }
        
        this.marbles = [];
    }
}
