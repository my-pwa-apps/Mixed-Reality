// filepath: c:\Users\bartm\OneDrive - Microsoft\Documents\Git Repos\Mixed Reality\webxr-ar-marble-shooter\js\RoomScanner.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.144.0/build/three.module.js';

export class RoomScanner {
    constructor(scene) {
        this.scene = scene;
        this.detectedSurfaces = [];
        this.meshes = [];
        this.scanning = false;
        this.scanComplete = false;
        
        // Visual representation of detected surfaces
        this.surfaceMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.2,
            side: THREE.DoubleSide,
            wireframe: true
        });
        
        // Bounding box for the room
        this.boundingBox = new THREE.Box3();
        this.roomMesh = null;
    }
    
    startScanning() {
        this.scanning = true;
        
        // Promise that resolves when enough of the room has been scanned
        return new Promise((resolve) => {
            // In a real WebXR app, this would use the mesh detection API
            // For now, we'll simulate room scanning with a timeout and generated geometry
            setTimeout(() => {
                const roomGeometry = this.generateRoomGeometry();
                this.scanComplete = true;
                this.scanning = false;
                
                resolve(roomGeometry);
            }, 2000); // Simulate 2 second scan
        });
    }
    
    generateRoomGeometry() {
        // Simulate detecting planes in the room (floor, walls, ceiling)
        // In a real app, this would come from the WebXR mesh detection API
        
        // Create floor
        const floorWidth = 5;
        const floorDepth = 5;
        const floorGeometry = new THREE.PlaneGeometry(floorWidth, floorDepth);
        floorGeometry.rotateX(-Math.PI / 2); // Make it horizontal
        
        const floorMesh = new THREE.Mesh(floorGeometry, this.surfaceMaterial.clone());
        floorMesh.position.set(0, -0.5, 0); // Positioned below the player
        
        this.scene.add(floorMesh);
        this.meshes.push(floorMesh);
        
        const floorSurface = {
            type: 'floor',
            mesh: floorMesh,
            getRandomPoint: () => {
                return new THREE.Vector3(
                    (Math.random() - 0.5) * floorWidth,
                    floorMesh.position.y,
                    (Math.random() - 0.5) * floorDepth
                );
            }
        };
        
        this.detectedSurfaces.push(floorSurface);
        
        // Create walls 
        const wallHeight = 2.5;
        
        // Wall 1 (front)
        const wall1Geometry = new THREE.PlaneGeometry(floorWidth, wallHeight);
        const wall1Mesh = new THREE.Mesh(wall1Geometry, this.surfaceMaterial.clone());
        wall1Mesh.position.set(0, wallHeight/2, -floorDepth/2);
        this.scene.add(wall1Mesh);
        this.meshes.push(wall1Mesh);
        
        // Wall 2 (back)
        const wall2Geometry = new THREE.PlaneGeometry(floorWidth, wallHeight);
        const wall2Mesh = new THREE.Mesh(wall2Geometry, this.surfaceMaterial.clone());
        wall2Mesh.position.set(0, wallHeight/2, floorDepth/2);
        wall2Mesh.rotation.y = Math.PI;
        this.scene.add(wall2Mesh);
        this.meshes.push(wall2Mesh);
        
        // Wall 3 (left)
        const wall3Geometry = new THREE.PlaneGeometry(floorDepth, wallHeight);
        const wall3Mesh = new THREE.Mesh(wall3Geometry, this.surfaceMaterial.clone());
        wall3Mesh.position.set(-floorWidth/2, wallHeight/2, 0);
        wall3Mesh.rotation.y = Math.PI / 2;
        this.scene.add(wall3Mesh);
        this.meshes.push(wall3Mesh);
        
        // Wall 4 (right)
        const wall4Geometry = new THREE.PlaneGeometry(floorDepth, wallHeight);
        const wall4Mesh = new THREE.Mesh(wall4Geometry, this.surfaceMaterial.clone());
        wall4Mesh.position.set(floorWidth/2, wallHeight/2, 0);
        wall4Mesh.rotation.y = -Math.PI / 2;
        this.scene.add(wall4Mesh);
        this.meshes.push(wall4Mesh);
        
        // Add walls as surfaces
        const wallSurfaces = [wall1Mesh, wall2Mesh, wall3Mesh, wall4Mesh].map((mesh, i) => {
            const wallNum = i + 1;
            return {
                type: 'wall',
                id: `wall${wallNum}`,
                mesh: mesh,
                getRandomPoint: () => {
                    let x, y, z;
                    
                    // Calculate random point on the wall
                    if (wallNum === 1) {
                        x = (Math.random() - 0.5) * floorWidth;
                        y = Math.random() * wallHeight;
                        z = -floorDepth/2;
                    } else if (wallNum === 2) {
                        x = (Math.random() - 0.5) * floorWidth;
                        y = Math.random() * wallHeight;
                        z = floorDepth/2;
                    } else if (wallNum === 3) {
                        x = -floorWidth/2;
                        y = Math.random() * wallHeight;
                        z = (Math.random() - 0.5) * floorDepth;
                    } else {
                        x = floorWidth/2;
                        y = Math.random() * wallHeight;
                        z = (Math.random() - 0.5) * floorDepth;
                    }
                    
                    return new THREE.Vector3(x, y, z);
                }
            };
        });
        
        this.detectedSurfaces.push(...wallSurfaces);
        
        // Ceiling
        const ceilingGeometry = new THREE.PlaneGeometry(floorWidth, floorDepth);
        ceilingGeometry.rotateX(Math.PI / 2);
        
        const ceilingMesh = new THREE.Mesh(ceilingGeometry, this.surfaceMaterial.clone());
        ceilingMesh.position.set(0, wallHeight, 0);
        this.scene.add(ceilingMesh);
        this.meshes.push(ceilingMesh);
        
        const ceilingSurface = {
            type: 'ceiling',
            mesh: ceilingMesh,
            getRandomPoint: () => {
                return new THREE.Vector3(
                    (Math.random() - 0.5) * floorWidth,
                    ceilingMesh.position.y,
                    (Math.random() - 0.5) * floorDepth
                );
            }
        };
        
        this.detectedSurfaces.push(ceilingSurface);
        
        // Create bounding box for the room
        this.boundingBox.set(
            new THREE.Vector3(-floorWidth/2, floorMesh.position.y, -floorDepth/2),
            new THREE.Vector3(floorWidth/2, wallHeight, floorDepth/2)
        );
        
        // Store combined geometry
        const roomGeometry = new THREE.BufferGeometry();
        roomGeometry.boundingBox = this.boundingBox;
        
        // After scanning, make wireframes invisible
        setTimeout(() => {
            this.hideWireframes();
        }, 5000);
        
        return roomGeometry;
    }
    
    hideWireframes() {
        this.meshes.forEach(mesh => {
            mesh.material.opacity = 0;
            
            // After fade out, remove them from the scene
            setTimeout(() => {
                this.scene.remove(mesh);
            }, 1000);
        });
    }
    
    getDetectedSurfaces() {
        return this.detectedSurfaces;
    }
    
    getRoomBoundingBox() {
        return this.boundingBox;
    }
    
    isScanComplete() {
        return this.scanComplete;
    }
    
    // Update method called from main loop
    update() {
        if (!this.scanning) return;
        
        // In a real implementation, this would update the meshes
        // based on newly detected surfaces from the WebXR mesh detection API
        
        // For now, just rotate the wireframe meshes slightly to show activity
        this.meshes.forEach(mesh => {
            if (mesh.name !== 'floor' && mesh.name !== 'ceiling') {
                mesh.material.opacity = 0.2 + 0.1 * Math.sin(Date.now() / 200);
            }
        });
    }
    
    // Clean up resources
    destroy() {
        this.meshes.forEach(mesh => {
            this.scene.remove(mesh);
        });
        this.meshes = [];
        this.detectedSurfaces = [];
    }
}
