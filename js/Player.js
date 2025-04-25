import * as THREE from 'three';

export class Player {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.radius = 0.1; // Collision radius
        this.lastFireTime = 0;
        this.fireRate = 300; // milliseconds between shots
        this.invulnerable = false;
        
        // Create player ship model
        this.createShipModel();
    }
    
    createShipModel() {
        // Create a simple ship model for now (could be replaced with a GLTF model)
        const geometry = new THREE.ConeGeometry(0.03, 0.08, 3);
        geometry.rotateX(Math.PI / 2); // Rotate to point forward
        
        const material = new THREE.MeshStandardMaterial({
            color: 0x00ffff,
            emissive: 0x00aaaa,
            metalness: 0.7,
            roughness: 0.2
        });
        
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.set(0, 0, -0.15); // Slightly in front of the camera
        
        // Add engine glow
        const engineGlow = new THREE.PointLight(0x00ffff, 0.5, 0.1);
        engineGlow.position.set(0, 0, 0.04);
        this.mesh.add(engineGlow);
        
        // Add to scene as child of camera
        this.camera.add(this.mesh);
    }
    
    shoot(direction) {
        const now = Date.now();
        
        // Check fire rate
        if (now - this.lastFireTime < this.fireRate) {
            return false;
        }
        
        this.lastFireTime = now;
        
        // Visual feedback for shooting
        this.createMuzzleFlash();
        
        return true;
    }
    
    createMuzzleFlash() {
        // Visual effect for muzzle flash
        const flashGeometry = new THREE.PlaneGeometry(0.05, 0.05);
        const flashMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 1,
            side: THREE.DoubleSide
        });
        
        const flash = new THREE.Mesh(flashGeometry, flashMaterial);
        flash.position.set(0, 0, -0.2); // Position in front of ship
        flash.rotation.x = Math.PI / 2;
        
        this.camera.add(flash);
        
        // Animate the flash
        const fadeOut = () => {
            flash.material.opacity -= 0.1;
            
            if (flash.material.opacity > 0) {
                requestAnimationFrame(fadeOut);
            } else {
                this.camera.remove(flash);
            }
        };
        
        requestAnimationFrame(fadeOut);
    }
    
    showHitEffect() {
        if (this.invulnerable) return;
        
        // Make player invulnerable for a short time
        this.invulnerable = true;
        
        // Flash red to indicate hit
        const originalMaterial = this.mesh.material.clone();
        const hitMaterial = new THREE.MeshStandardMaterial({
            color: 0xff0000,
            emissive: 0xff0000,
            metalness: 0.7,
            roughness: 0.2
        });
        
        // Flash between hit and normal appearance
        const flashInterval = setInterval(() => {
            this.mesh.material = this.mesh.material === hitMaterial ? originalMaterial : hitMaterial;
        }, 100);
        
        // End invulnerability after a short time
        setTimeout(() => {
            clearInterval(flashInterval);
            this.mesh.material = originalMaterial;
            this.invulnerable = false;
        }, 2000);
    }
    
    getPosition() {
        // Get world position of ship
        const position = new THREE.Vector3();
        this.mesh.getWorldPosition(position);
        return position;
    }
    
    getRadius() {
        return this.radius;
    }
    
    update() {
        // Handle any player updates here
        // The player ship moves with the camera in AR, so no movement updates needed
    }
    
    remove() {
        if (this.mesh && this.camera) {
            this.camera.remove(this.mesh);
        }
    }
}
