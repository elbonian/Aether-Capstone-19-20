/** 
    Custom simulation object to allow for creation of AetherObjects
    Inherits: Spacekit.Simulation()

    This file uses globals defined in solarSystem.js
*/

class AetherSimulation extends Spacekit.Simulation {
    constructor(simulationElt, options) {
        super(simulationElt, options);
        this.mult = options.mult || 1;
        this.tail_length = options.tail_length || 1;
        this.wrt = options.wrt || "solar system barycenter";
        this.xy_grid = this.createGrid(); // TODO: bad to do this inside constructor
    }

    /**
        Creates new AetherObject
        @param optional parameters for AetherObject
        @return AetherObject
    */
    createAetherObject(...args){
        return new AetherObject(...args, this);
    }

    /**
        Creates a grid on the xy plane that represents the ecliptic plane
    */
    createGrid(){
        var grid = new Spacekit.THREE.GridHelper(this._options.unitsPerAu * 60, 60, 0x040404, 0x040404);
        grid.rotation.x = Math.PI/2;
        //grid.setColors( new Spacekit.THREE.Color(0x808080), new Spacekit.THREE.Color(0x808080) );
        this.getScene().add(grid);
        return grid;
    }

    /**
        Adds a new object to the simulation
    */
    renderObject() {
        if (this._renderMethod !== 'SPHERE') {
   
          // Create a stationary sprite.
          this._object3js = this.createSprite();
          if (this._simulation) {
            // Add it all to visualization.
            this._simulation.addObject(this, true);
          }
          this._renderMethod = 'SPRITE';
        }
    }

    /**
        Removes the simulation's xy grid from the scene
    */
    hideGrid(){
        if(this.xy_grid != null){
            this.getScene().remove(this.xy_grid);
        }
    }

    /**
        Adds the simulation's xy grid back to the scene
    */
    showGrid(){
        if(this.xy_grid != null){
            this.getScene().add(this.xy_grid);
        }
    }

    /**
        Tune camera control speed
    */
    tuneCameraControls(rotate_speed, zoom_speed, pan_speed, key_pan_speed){
        this.getViewer().get3jsCameraControls().rotateSpeed = rotate_speed;
        this.getViewer().get3jsCameraControls().zoomSpeed = zoom_speed;
        this.getViewer().get3jsCameraControls().panSpeed = pan_speed;
        this.getViewer().get3jsCameraControls().keyPanSpeed = key_pan_speed;
    }

    /**
        Animates the simulation
    */
    animate() {
        if (!this._renderEnabled) {
        return;
        }
    
        window.requestAnimationFrame(this.animate);
    
        if (this._stats) {
        this._stats.begin();
        }
    
        // CHANGED FROM DEFAULT SPACEKIT FUNCTION
        if (!this._isPaused) {
        if (this._jdDelta) {
            this._jd += this.mult * this.getJdDelta();
        } else {
            console.log("jd delta is undefined");
        }
    
        const timeDelta = (Date.now() - this._lastUpdatedTime) / 1000;
        this._lastUpdatedTime = Date.now();
        this._fps = 1 / timeDelta || 1;
        }
    
        // Update objects in this simulation
        this.update();
    
        // Update camera drifting, if applicable
        if (this._enableCameraDrift) {
        this.doCameraDrift();
        }
        this._camera.update();
        
        // Update three.js scene
        this._renderer.render(this._scene, this._camera.get3jsCamera());
    
        if (this.onTick) {
        this.onTick();
        }
    
        if (this._stats) {
        this._stats.end();
        }
    }
}