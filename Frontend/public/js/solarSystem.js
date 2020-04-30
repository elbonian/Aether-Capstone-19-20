/*
	Custom simulation object to allow for creation of AetherObjects
	Inherits: Simulation
*/

class AetherSimulation extends Spacekit.Simulation {
	constructor(simulationElt, options) {
        super(simulationElt, options);
        this.mult = options.mult || 1;
        this.tail_length = options.tail_length || 1;
		this.wrt = options.wrt || "solar system baryncenter";
		this.xy_grid = this.createGrid(); // TODO: bad to do this inside constructor
	}

	/*
		Creates new AetherObject
		@param optional parameters for AetherObject
		@return AetherObject
	*/
	createAetherObject(...args){
		return new AetherObject(...args, this);
	}

	/*
		Creates a grid on the xy plane that represents the ecliptic plane
	*/
	createGrid(){
		var grid = new Spacekit.THREE.GridHelper(1000.0 * 60, 60, 0x040404, 0x040404);
		grid.rotation.x = Math.PI/2;
		//grid.setColors( new Spacekit.THREE.Color(0x808080), new Spacekit.THREE.Color(0x808080) );
		this.getScene().add(grid);
		return grid;
	}

	/*
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

    /*
    	Removes the simulation's xy grid from the scene
    */
    hideGrid(){
    	if(this.xy_grid != null){
    		this.getScene().remove(this.xy_grid);
    	}
    }

    /*
    	Adds the simulation's xy grid back to the scene
    */
    showGrid(){
    	if(this.xy_grid != null){
    		this.getScene().add(this.xy_grid);
    	}
    }

    /*
    	Tune camera control speed
    */
    tuneCameraControls(rotate_speed, zoom_speed, pan_speed, key_pan_speed){
		this.getViewer().get3jsCameraControls().rotateSpeed = rotate_speed;
		this.getViewer().get3jsCameraControls().zoomSpeed = zoom_speed;
		this.getViewer().get3jsCameraControls().panSpeed = pan_speed;
		this.getViewer().get3jsCameraControls().keyPanSpeed = key_pan_speed;
    }

	/*
	@private
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
			this._jd += this._jdDelta;
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

/*
	Custom AetherObject that changes some parameters for SphereObject
	Inherits: SphereObject
*/
class AetherObject extends Spacekit.SphereObject {
	//constructor adds position and index variables
    constructor(id, options, contextOrSimulation) {
		super(id, options, contextOrSimulation, false);
		this.sim = contextOrSimulation;
		this.currIndex = 0;
		this.tailStartIndex = 0;
		this.tail_length = 0;
		this.positionVectors = [];
		this.jdTimeData = [];
		this.geometry = null;
		this.material = null;
		this.line = null;
		this.previousLineId = null;
		this.ephemUpdate = null; // function reference to the getPositions2 request
		this.isUpdating = false;
		this.name = "newBody";
		this.update_threshold = 0;
		this.update_threshold2 = 0;
		this.wrt = null;
		this.ra = 0;
		this.dec = 0;
		this.pm = 0;
		this.ra_delta = 0;
		this.dec_delta = 0;
		this.pm_delta = 0;
		this.nut_prec_angles = null;
		this.nut_prec_ra = null;
		this.nut_prec_dec = null;
		this.axis_of_rotation_vector = null;
		this.radius_polar = 0;
		this.colorGradient = null;
		this.hidden = false;
		this.sprite = null;
		this.minSpeed = null;
		this.maxSpeed = null;
        this.initAetherObj();
	}

	/*
	  Initialize function. Mostly the same as SphereObject with minor changes
	*/
	initAetherObj(){
        let map;
        if (this._options.textureUrl) {
          map = new Spacekit.THREE.TextureLoader().load(this._options.textureUrl);
		}

		//Level of detail segments changed to (can be changed)
        const detailedObj = new Spacekit.THREE.LOD();
        const levelsOfDetail = this._options.levelsOfDetail || [
          { radii: 0, segments: 48 },
        ];

        this.radius = this._options.radius;
        this.radius_polar = this._options.radius_polar;
		this.name = this._options.name;
		console.log(this.name);

         // Check if body has radius data
        if(this.radius == -1){
			console.log(this.name + " here");
        	// Create a  sprite to represent the body
        	var material = new Spacekit.THREE.SpriteMaterial( { map: map, color: 0xffffff, fog: true , sizeAttenuation: false, } ); // Size attenuation set to false so that the sprite is always a constant size to the viewer
        	var sprite = new Spacekit.THREE.Sprite( material );
        	Object.defineProperty( material, 'needsUpdate', {
				value: true,
				writable: true
			});

			this.sprite = sprite;
			sprite.scale.set(10/1000.0, 10/1000.0, 1) // TODO: scale sprite according to simulation scale factor
			this._obj.add(sprite);
        	this._renderMethod = 'SPRITE';
        }
        else{
			console.log(this.name + " here2");
        	// Create a sphere to represent the body
        	const radius = this.radius_polar * 1000.0; // TODO: replace 1000.0 with simulation scale factor

        	// Create multiple spheres for the object, each of differing level of detail
			for (let i = 0; i < levelsOfDetail.length; i += 1) {
				const level = levelsOfDetail[i];
				var sphereGeometry = new THREE.SphereGeometry(
					radius,
					level.segments,
					level.segments,
				);
				// HANDLE TRIAXIAL ELLIPSOID GEOMETRY
				if(this.radius != this.radius_polar){

					const matrix = new THREE.Matrix4().makeScale( this.radius/this.radius_polar, 1.0, this.radius/this.radius_polar );
					sphereGeometry.applyMatrix( matrix ); // Squash length in Z direction

					// Recalculate bounding box
					var min = new Spacekit.THREE.Vector3( this.radius*0.5, this.radius*0.5, this.radius*0.5 );
					var max = min.clone().negate();
					sphereGeometry.boundingBox = new Spacekit.THREE.Box3( min, max );
				}

				let material;
				if (this._simulation.isUsingLightSources()) {
					const uniforms = {
					sphereTexture: { value: null },
					lightPos: { value: new Spacekit.THREE.Vector3() },
					};
					uniforms.sphereTexture.value = map;
					uniforms.lightPos.value.copy(this._simulation.getLightPosition());
					material = new Spacekit.THREE.ShaderMaterial({
					uniforms,
					vertexShader: Spacekit.SPHERE_SHADER_VERTEX,
					fragmentShader: Spacekit.SPHERE_SHADER_FRAGMENT,
					transparent: true,
					});
				}
				else {
					//mesh material changed to transparent and opacity to 0 to not see weird meshes
					material = new Spacekit.THREE.MeshBasicMaterial({
						transparent: true, 
						opacity: 0,
					});
				}
				Object.defineProperty( material, 'needsUpdate', {
					value: true,
					writable: true
				});
				const mesh = new Spacekit.THREE.Mesh(sphereGeometry, material);
				mesh.receiveShadow = true;
				mesh.castShadow = true;
				// Change the coordinate system to have Z-axis pointed up.
				// TODO: change mesh rotation
				mesh.rotation.x = Math.PI / 2;
				// Show this number of segments at distance >= radii * level.radii.
				detailedObj.addLevel(mesh, radius * level.radii);
			}
			// Add to the parent base object.
			this._obj.add(detailedObj);
			this._renderMethod = 'SPHERE';
		}
     
     	// set current index
        this.currIndex = this._options.currIndex;

        // set position data
        this.positionVectors = this._options.positionVectors;

        if (this._options.atmosphere && this._options.atmosphere.enable) {
          this._obj.add(this.renderFullAtmosphere());
        }
     
        if (this._options.axialTilt) {
          this._obj.rotation.y += rad(this._options.axialTilt);
        }
     
		
        if (this._simulation) {
          // Add it all to visualization.
         this._simulation.addObject(this, false /* noUpdate */);
        }

        // set object's initial position
        this._obj.position.set(this.positionVectors[this.currIndex].x, this.positionVectors[this.currIndex].y, this.positionVectors[this.currIndex].z);

		//init trajectory tail
		this.updateColorGradient();
        this.geometry = new Spacekit.THREE.BufferGeometry();
		//this.material = new Spacekit.THREE.LineBasicMaterial({color: new Spacekit.THREE.Color(0x6495ED)});
		this.geometry.attributes['color'] = new Spacekit.THREE.BufferAttribute( this.colorGradient, 3);																				
		this.material = new Spacekit.THREE.LineBasicMaterial({vertexColors: THREE.VertexColors});
		this.material.needsUpdate = true;

		// 1D array describing the vertices of the line
		// i.e. [x1,y1,z1,x2,y2,z2,...,xn,yn,zn]
		var positions = new Float32Array( this.positionVectors.length * 3);
		//this.geometry.addAttribute( 'position', new Spacekit.THREE.BufferAttribute( positions, 3) );																								
		this.geometry.attributes['position'] = new Spacekit.THREE.BufferAttribute( positions, 3);																				
		//this.geometry.vertices = this.positionVectors;
		//this.geometry.verticesNeedUpdate = true;
		this.geometry.setDrawRange( this.tailStartIndex, this.currIndex);
		let line = new Spacekit.THREE.Line(
			this.geometry,
			this.material,
		);
		line.geometry.attributes[ "color" ].needsUpdate = true;
		line.frustumCulled = false;
		line.computeLineDistances();

		// reference to positions
		var positions2 = line.geometry.attributes.position.array;
		var index = 0;

		// set 1D array according to positionVectors
		for(var i = 0; i < this.positionVectors.length; i++){
			positions2[index ++] = this.positionVectors[i].x;
			positions2[index ++] = this.positionVectors[i].y;
			positions2[index ++] = this.positionVectors[i].z;
		}

		// add line to the scene
		let scene = this._simulation.getScene();
		scene.add(line);
		this.line = line;
		this.previousLineId = line.id;
		// set default tail length
		this.tail_length = this.currIndex - this.tailStartIndex + 1;

		this.jdTimeData = this._options.jdTimeData;
		this.name = this._options.name;
		this.ephemUpdate = this._options.ephemUpdate;

		this.update_threshold = Math.ceil(this.positionVectors.length * (2/3));
		this.update_threshold2 = this.positionVectors.length - this.update_threshold;

		this.ra = this._options.ra;
		this.dec = this._options.dec;
		this.pm = this._options.pm;
		this.ra_delta = this._options.ra_delta;
		this.dec_delta = this._options.dec_delta;
		this.pm_delta = this._options.pm_delta;
		this.nut_prec_angles = this._options.nut_prec_angles;
		this.nut_prec_ra = this._options.nut_prec_ra;
		this.nut_prec_dec = this._options.nut_prec_dec;
		this.axis_of_rotation_vector = new Spacekit.THREE.Vector3(0,0,1);
		//this.radius_polar = this._options.radius_polar;
		console.log(this._renderMethod);
	}

	updateColorGradient(){
		const body_data = body_meta_data.find(x => x["body name"] === this.name);
		//console.log(body_data);
		this.minSpeed = body_data["min speed"];
		this.maxSpeed = body_data["max speed"];
		this.colorGradient = new Float32Array(this.positionVectors.length * 3);
		let kmPosX = this.positionVectors.map(pos => Spacekit.auToKm(pos.x));
		let kmPosY = this.positionVectors.map(pos => Spacekit.auToKm(pos.y));
		let kmPosZ = this.positionVectors.map(pos => Spacekit.auToKm(pos.z));
		let kmPerSecList = [];
		let adjKmPerSec = [];
		//get max and min kmpersec and scale them between the max and min
		for(let i = 0; i < kmPosX.length-1; i++){
			let kmPerSec = Math.sqrt(Math.pow((kmPosX[i+1] - kmPosX[i]),2) + Math.pow((kmPosY[i+1] - kmPosY[i]),2) + Math.pow((kmPosZ[i+1] - kmPosZ[i]),2)) / secondsPerDay / 1000;
			kmPerSecList.push(kmPerSec);
		}
		for (var i = 0; i < kmPerSecList.length; i++) {
			var unscaled = kmPerSecList[i];
			var scaled = 0;
			// Bodies with larger orbit will have less accurate max and min, so +/- 0.5 on scaled speed 
			if(this.name === "saturn" || this.name === "jupiter" || this.name === "neptune" || this.name === "pluto" || this.name === "uranus"){
				scaled = scaleBetween(unscaled, 0.0, 1.0, this.minSpeed-0.5, this.maxSpeed+0.5);
			}
			else{
				scaled = scaleBetween(unscaled, 0.0, 1.0, this.minSpeed, this.maxSpeed);
			}
			
			adjKmPerSec.push(parseFloat(scaled.toFixed(2)));
		}
		for(let i = 0; i < adjKmPerSec.length; i++){
			if(adjKmPerSec[i] >= 0.75){
				this.colorGradient[ i * 3 ] = adjKmPerSec[i];
    			this.colorGradient[ i * 3 + 1 ] = 1-adjKmPerSec[i];
				this.colorGradient[ i * 3 + 2 ] = 1-adjKmPerSec[i];
			}
			else if(adjKmPerSec[i] > 0.5){
				this.colorGradient[ i * 3 ] = adjKmPerSec[i] + 0.25;
    			this.colorGradient[ i * 3 + 1 ] = adjKmPerSec[i];
				this.colorGradient[ i * 3 + 2 ] = 1-adjKmPerSec[i];
			}
			else if(adjKmPerSec[i] > 0.25){
				this.colorGradient[ i * 3 ] = adjKmPerSec[i] + 0.5;
    			this.colorGradient[ i * 3 + 1 ] = adjKmPerSec[i] + 0.5;
				this.colorGradient[ i * 3 + 2 ] = 1-adjKmPerSec[i];
			}
			else{
				this.colorGradient[ i * 3 ] = adjKmPerSec[i];
    			this.colorGradient[ i * 3 + 1 ] = adjKmPerSec[i];
				this.colorGradient[ i * 3 + 2 ] = Math.abs(adjKmPerSec[i] - 1);
			}
		}
	  }


	  updateAxisOfRotation(jd){
	  	const old_axis = this.axis_of_rotation_vector;
	  	
	  	const centuries_passed_j2000 = (jd - j2000) / 36525; // If jd > j2000, centuries passed will be positive, else negative
	  	// if(this.name == "earth"){
	  	// 	console.log(centuries_passed_j2000);
	  	// }
	  	const days_passed_j2000 = (jd - j2000);
	  	// this.ra += this._simulation.mult * 36525 * this.ra_delta;
	  	// this.dec += this._simulation.mult * 36525 * this.dec_delta;
	  	var ra_T = this.ra + (this.ra_delta * centuries_passed_j2000);//Spacekit.rad(this.rotation_functions["pole_ra"](centuries_passed_j2000));
	  	var dec_T = this.dec + (this.dec_delta * centuries_passed_j2000);//Spacekit.rad(this.rotation_functions["pole_dec"](centuries_passed_j2000));
	  	

	  	// Incorporate nutation and precession if possible
	  	if(this.nut_prec_angles && this.nut_prec_ra && this.nut_prec_dec){
	  		// console.log(this.name);
	  		for(var i = 0; i < (this.nut_prec_angles.length / 2); i++){
	  			ra_T += this.nut_prec_ra[i] * Math.sin(this.nut_prec_angles[i*2] + (this.nut_prec_angles[(i*2) + 1] * centuries_passed_j2000));
	  			dec_T += this.nut_prec_dec[i] * Math.cos(this.nut_prec_angles[i*2] + (this.nut_prec_angles[(i*2) + 1] * centuries_passed_j2000))
	  		}
	  	}
	  	ra_T = Spacekit.rad(ra_T);
	  	dec_T = Spacekit.rad(dec_T);

	  	const axis_of_rotation_eq = Spacekit.sphericalToCartesian(ra_T, dec_T, 1);//[ Math.cos(ra_T) * Math.cos(dec_T), Math.sin(ra_T) * Math.cos(dec_T), Math.sin(dec_T), Spacekit.getObliquity() ];// Spacekit.equatorialToEcliptic_Cartesian( Math.cos(ra_T) * Math.cos(dec_T), Math.sin(ra_T) * Math.cos(dec_T), Math.sin(ra_T), Spacekit.getObliquity() );
	  	const axis_of_rotation_ec = Spacekit.equatorialToEcliptic_Cartesian(axis_of_rotation_eq[0], axis_of_rotation_eq[1], axis_of_rotation_eq[2], Spacekit.getObliquity());
	  	
	  	//const axis_of_rotation_ec = [0,0,1];
	  	var axis_of_rotation_vector = new Spacekit.THREE.Vector3(axis_of_rotation_ec[0], axis_of_rotation_ec[1], axis_of_rotation_ec[2]);
	  	this.axis_of_rotation_vector = axis_of_rotation_vector.normalize();
	  	var quaternion = new Spacekit.THREE.Quaternion();
	  	quaternion.setFromUnitVectors(old_axis, this.axis_of_rotation_vector);
	  	this._obj.applyQuaternion(quaternion);
	  }

	  /*
	  	Rotates the object about its axis of rotation according to its prime meridian delta angle
		No date is needed because the object's pm delta angle is for a change in time of one day, simply rotates the object according to its simulation's rate
	  */
	  rotate(jd){
	  	const angle_of_rotation = Spacekit.rad(this.pm_delta);
	  	this._obj.rotateOnWorldAxis(this.axis_of_rotation_vector, angle_of_rotation * this._simulation.mult);
	  	
	  }


	  /*
		  Sets class position variable
		  @param adjusted_positions Position data from API
	  */
	  setpositionVectors(adjusted_positions){
		  this.positionVectors = adjusted_positions;
		}

	  /*
		  Sets class time variable
		  @param adjusted_times List of JDs corresponding to each position
	  */
	  setTimeData(adjusted_times){
	  	this.jdTimeData = adjusted_times;
	  }
	  
	  /*
		  Returns current position for a body
		  @return this.currPos current position of body
	  */
	  getCurrPos(){
		  return this.positionVectors[this.currIndex];
	  }

	  /*
		  Sets next position of where body will be and updates index
	  */
	  setNextPos(){
		  this.currIndex += this._simulation.mult * 1;
		  const currPos = this.positionVectors[Math.floor(this.currIndex)];
		  this._obj.position.set(currPos.x, currPos.y, currPos.z);
	  }


	  /*
		  Updates the object's tail's starting index
	  */
	  setNextTailStart(){
	  	this.tailStartIndex = this.currIndex - Math.floor(this._simulation.tail_length * this.tail_length) + 1;
	  	if(!this._simulation._isPaused){
	  		// if not paused, then add a multiple of the simulation's rate of time
	  		this.tailStartIndex += 1 * this._simulation.mult;
	  	}
	  }

	  /*
		  Updates the length of the object's tail according to its indexes
	  */
	  updateTailLength(){
	  	this.tail_length = this.currIndex - this.tailStartIndex + 1;
	  }
 	  
	  /*
		  Update the object's line object according to its position indexes
	  */
	  drawLineSegment(){ // todo: consider renaming

	  	// get the parent simulation's threejs scene
		let scene = this._simulation.getScene();

		// ensure object has a line object
		if(this.line != null){
			// update the line's draw range to only display from the end of the tail to the object's position
			this.line.geometry.setDrawRange(this.tailStartIndex, this.currIndex - this.tailStartIndex + 1);
		}
	  }

	  /*
		Add more position data to the object's position list
		@param positions List of Spacekit.THREE.Vector3() objects representing new (or old) position coordinates
		@param prepend Boolean indicating whether the positions need to be prepended or put on the end
	  */
	  addPositionData(positions, prepend=false){
	  	if(prepend){
	  		this.currIndex += positions.length;
	  		this.tailStartIndex += positions.length
	  		this.positionVectors = positions.concat(this.positionVectors.slice(1, this.positionVectors.length));
	  	}
	  	else{
	  		this.positionVectors = this.positionVectors.concat(positions.slice(1, positions.length));
	  	}
	  }


	  /*
		Add more time data to the object's jd time list
		@param times List of jd times (string) representing new (or old) jd times
		@param prepend Boolean indicating whether the times need to be prepended or put on the end
	  */
	  addTimeData(times, prepend=false){
	  	if(prepend){
	  		this.jdTimeData = times.concat(this.jdTimeData.slice(1, this.jdTimeData.length));
	  	}
	  	else{
	  		this.jdTimeData = this.jdTimeData.concat(times.slice(1, times.length));
	  	}
	  }



	  // TODO:
	  //	1. Establish an upper limit on how much data an object can have at any one time
	  //	2. Modify updateLineData() to update values in this.line.geometry.position.array 
	  //	   instead of creating a new line every time

	  /*
		Update object's internal Spacekit.THREE.Line object that displays its trajectory
		Uses this.positionVectors, this.currentIndex, and this.tailStartIndex to determine line vertices and drawRange
	  */
	  updateLineData(){
		let scene = this._simulation.getScene();
		scene.remove(this.line);
	  	var position_array = new Float32Array( this.positionVectors.length * 3);

		// create 1D array of form [x1,y1,z1,x2,y2,z2,...,xn,yn,zn]
		this.geometry.attributes['position'] = new Spacekit.THREE.BufferAttribute( position_array, 3);
		this.updateColorGradient();
		this.material = new Spacekit.THREE.LineBasicMaterial({vertexColors: Spacekit.THREE.VertexColors});
		this.material.needsUpdate = true;
		this.geometry.attributes['color'] = new Spacekit.THREE.BufferAttribute( this.colorGradient, 3);	
		// set drawrange to start at tailStartIndex and draw this.currIndex many vertices
		this.geometry.setDrawRange( this.tailStartIndex, this.currIndex); // todo: might break when time rate is negative
		let line = new Spacekit.THREE.Line(
			this.geometry,
			this.material,
		);
		line.computeLineDistances();
		line.frustumCulled = false;
		// reference to positions
		var positions2 = line.geometry.attributes.position.array;
		var index = 0;

		// set 1D array according to positionVectors
		for(var i = 0; i < this.positionVectors.length; i++){
			positions2[index ++] = this.positionVectors[i].x;
			positions2[index ++] = this.positionVectors[i].y;
			positions2[index ++] = this.positionVectors[i].z;
		}

		// add line to the scene
		//let scene = this._simulation.getScene();
		// remove old line
		if(!this.hidden){
			scene.add(line);
		}
		this.line = line;
		this.previousLineId = line.id;
	  }

	  /*
	  	Perform an API Get request for new positions and times. Default params return 10 simulation seconds worth of position data with no tail. Updates object's positionVectors, jdTimeData, and line.
	  	@param {string} [wrt="solar system barycenter"] - (With Respect To) The object from which the positions are computed in reference to
	  	@param {string} [obj_name=this.name] - This object's name
	  	@param {string} [start_date_jd=(this.jdTimeData[this.jdTimeData.length - 1]).toString()] - The position start date
	  	@param {float} [jd_delta=1] - The change in time between each position returned
	  	@param {string} [tail_length_jd="0"] - The length of the position tail in JD
	  	@param {string} [valid_time_seconds="10"] - The length of time in seconds the object will be able to animate from the data returned
	  	@param {boolean} [old_data=false] - flag indicating whether the data returned is old or not
	  */
	  positionGetRequest(wrt = this._simulation.wrt, obj_name = this.name, start_date_jd = (this.jdTimeData[this.jdTimeData.length - 1]).toString(), jd_delta = 1, tail_length_jd = "0", valid_time_seconds = "10", old_data = false){
	  	this.ephemUpdate(wrt, obj_name, start_date_jd, jd_delta, tail_length_jd, valid_time_seconds).then(data => {  
			// adjust results to be in km and in ecliptic plane
      			var position_vectors = data[this.name].positions.map(function(pos){
			  		var adjusted_val = pos.map(Spacekit.kmToAu);//[Spacekit.kmToAu(pos[0]), Spacekit.kmToAu(pos[1]), Spacekit.kmToAu(pos[2])];
			  		var adjusted_val2 = Spacekit.equatorialToEcliptic_Cartesian(adjusted_val[0], adjusted_val[1], adjusted_val[2], Spacekit.getObliquity());
			  		return new Spacekit.THREE.Vector3(adjusted_val2[0] * 1000, adjusted_val2[1] * 1000, adjusted_val2[2] * 1000);
			  	});
				
			  	// update position list, time list, and line
      			this.addPositionData(position_vectors, old_data);
      			this.addTimeData(data[obj_name].times, old_data);
      			this.updateLineData();
      			this.isUpdating = false; // signal that object is done updating
  		});
	  }


	  /*
		  Updates the position of the body according to postionVectors
	  */
      update(jd){

      	////////////////////////////////////////////////////////////////////////////////////////
      	//////// DEAL WITH FETCHING NEW/OLD POSITION DATA
      	////////////////////////////////////////////////////////////////////////////////////////


      	if(!this.isUpdating){ // ensure object is not currently updating
      		// check if object is 2/3 of the way through its available data
	      	const positive_rate_of_time = this._simulation.mult > 0;
	      	// TODO: optimize when and how get requests are made
	      	//		1. take into account the simulation rate-of-time in valid
	      	//		2. do testing to see the avg. rest call response time. new call should return at least 2-3 seconds before obj runs out of data
	      	//		3. tune the parameters of the rest call to be optimally performant
	      	//		4. choose something better than 2/3 the positionVectors.length
	      	//      5. balance frequency and size of rest call
	      	const need_new_data = (this.currIndex >= this.positionVectors.length * (2/3)) && positive_rate_of_time; // simulation rate of time is positive and object is near the end of its pos list
	      	const need_old_data = (this.tailStartIndex <= this.positionVectors.length * (1/3)) && !positive_rate_of_time // simulation rate of time is negative and object is near beginning of pos list	
      		
      		if(need_new_data){
      			// console.log("newdata");
      			this.isUpdating = true;
	      		this.positionGetRequest(); // Default get request, 10 simulation seconds worth of future data
      		}
      		else if(need_old_data){
      			this.isUpdating = true;
      			this.positionGetRequest( this._simulation.wrt, this.name, this.jdTimeData[0].toString(), 1, (1*60*10).toString(), "0", true);
			  }
			  
      	}
      	

      	////////////////////////////////////////////////////////////////////////////////////////
      	//////// DEAL WITH UPDATING POSITION DATA AND ROTATING OBJECT
      	////////////////////////////////////////////////////////////////////////////////////////
      	

		// ensure we don't go out of bounds on the position list
		if(this.currIndex >= 1 && this.currIndex < this.positionVectors.length-1){


			if(this._simulation._isPaused){// update the object's tail beginning, regardless of whether sim is paused
	      		this.setNextTailStart();
	      		this.drawLineSegment();
	      	}  	
	      	
			// only update object position if not paused
      		if(!this._simulation._isPaused){

      			// rotate object
      			if (
			      this._obj &&
			      this._objectIsRotatable &&
			      this._options.rotation &&
			      this._options.rotation.enable
			    ) {
			    	this.updateAxisOfRotation(jd);
      				this.rotate(jd);
      			}


      			// update object's location
      			this.setNextPos()
      			// update the object's tail beginning after updating the object's position
		      	this.setNextTailStart();
		      	this.drawLineSegment();   	
			}
      	}
      	// Update label position
      	super.updateLabelPosition([this.positionVectors[Math.floor(this.currIndex)].x, this.positionVectors[Math.floor(this.currIndex)].y, this.positionVectors[Math.floor(this.currIndex)].z]);
    }

}

/////////////////////////////////
/////////// Globals	/////////////
/////////////////////////////////
 
// Julian Date of the J2000 epoch
const j2000 = 2451545.0;

// Seconds in a day
const secondsPerDay = 86400;

// (Julian) Days per second
// Repeating decimal, not physically accurate due to precision constraints
// TODO: figure out a different way to make the time accurate
const realTimeRate = 1 / secondsPerDay;

// Max julian-date-per-second for the simulation
// One year per simulation second
const maxJdPerSecond = 365;

// Minimum julian-date-per-second for the simulation
// 1 minute per simulation second
const minJdPerSecond = 1 / 1440;

// Day per second
const dayPerSecond = 1;

// Week per second
const weekPerSecond = 7;

const monthPerSecond = 30;


const unitsPerAu = 1000.0;


// Dictionary of bodies in the visualization
// e.x. "body name" : body object
var visualizer_list = {};

// Dictionary of ecliptic cartesian (x,y,z) coordinates in AU
// e.x. "body name" : [[x1,y1,z1],...,[xn,yn,zn]]
var adjusted_positions = {};

// Dictionary of Julian Days corresponding to each [x,y,z] coordinate in adjusted_positions
// e.x. "body name" : [2451545.094,...,2451560..43]
var adjusted_times = {};


var simulation_stack = []; // stack of simulations
var viz; // pointer to active simulation
var viz1;

var togglePlay = false;


var body_meta_data = [];

/////////////////////////////////
/////// Utility Functions ///////
/////////////////////////////////

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

/*
	Sets the rate of the simulation
*/
function tick(){
	const date = this.getDate().toString();
	sim_time.innerHTML = date.slice(4, date.length);

	if(this._isPaused){
		sim_rate.innerHTML = "JD/Sec: " + 0;
	}
	else{
		const rate = "JD/Sec: " + this.getJdDelta()*60;
		sim_rate.innerHTML = rate;
	}
}

function displayError(error){
	if(error.error){
		let li = document.createElement("LI"); 
		let err = document.createTextNode("Error: " + error.error);
		li.appendChild(err);
		li.setAttribute("style", "color: red;");
		document.getElementById("error-list").appendChild(li);
	}
	else{
		let li = document.createElement("LI"); 
		let err = document.createTextNode("Error: " + error);
		li.appendChild(err);
		li.setAttribute("style", "color: red;");
		document.getElementById("error-list").appendChild(li);
	}
}

function scaleBetween(unscaledNum, minAllowed, maxAllowed, min, max) {
	return (maxAllowed - minAllowed) * (unscaledNum - min) / (max - min) + minAllowed;
} 

function handleCheckboxClick(checkboxId, bodyName){
	let checked = document.getElementById(checkboxId).checked;
	let label = visualizer_list[bodyName]._label;
	let objs = visualizer_list[bodyName].get3jsObjects();
	if(!checked){
		console.log(objs);
		if(label != null){
			visualizer_list[bodyName].setLabelVisibility(false);
		}
		visualizer_list[bodyName].material.opacity = 0;
		visualizer_list[bodyName].material.transparent = true;
		visualizer_list[bodyName].material.needsUpdate = true;
		objs[0].visible = false;
		if(viz1 != null){
			viz1.removeObject(visualizer_list[bodyName]);
			viz1.getScene().remove(visualizer_list[bodyName].line);
		}
		visualizer_list[bodyName].hidden = true;
	} else {
		console.log(objs);
		if(label != null){
			visualizer_list[bodyName].setLabelVisibility(true);
		}
		visualizer_list[bodyName].material.opacity = 1;
		visualizer_list[bodyName].material.transparent = false;
		visualizer_list[bodyName].material.needsUpdate = true;
		objs[0].visible = true;
		if(viz1 != null){
			viz1.addObject(visualizer_list[bodyName]);
			viz1.getScene().add(visualizer_list[bodyName].line);
		}
		if(visualizer_list[bodyName].hidden === true){
			viz.getScene().add(visualizer_list[bodyName].line);
		}
		visualizer_list[bodyName].hidden = false;
	}
}

function initCheckboxes(){
	let checkboxes = document.getElementById("content1").getElementsByTagName('input');
	let planetKeys = Object.keys(visualizer_list);
	for(let x = 0; x < checkboxes.length; x++){
		let checkbox = checkboxes[x];
		let checkBoxId = checkboxes[x].id;
		let checkBoxBody = checkboxes[x].id.split("-")[0];
		if(planetKeys.includes(checkBoxBody)){
			checkbox.checked = true;
		}
		else{
			checkbox.disabled = true;
		}
	}
}

/*
	async function to get data from API
	@param {string} ref_frame - Reference from to retrieve the data from
	@param {string} targets - Target bodies in which to retrieve data
	@param {string} start_date - Beginning date for data
	@param {string} end_date - End date for data
	@param {string} steps - Number of postions to be retrieved in the time frame
*/
async function getPositionData(ref_frame, targets, start_date, end_date, steps){
	//returns a promise containing the response from server
	let response = await fetch('http://0.0.0.0:5000/api/positions/' + ref_frame + '/' + targets + '/' + start_date + '/' + end_date + '/' + steps);
	let data = await response.json();
	return data;
}

/*
	async function to get body data from API
	@param {string} ref_frame - Reference from to retrieve the data from
	@param {string} targets - Target bodies in which to retrieve data
	@param {string} cur_jd - Current Julian date of the simulation
	@param {float}  jd_rate - Rate of change of jd
	@param {string} tail_length - The length of the position tail in JD
	@param {string} valid_time - The length of time in seconds the object will be able to animate from the data returned
	@return {json} data - JSON of body data
*/
async function getPositionData2(ref_frame, targets, cur_jd, jd_rate, tail_length, valid_time){
	let response = await fetch('http://0.0.0.0:5000/api/positions2/' + ref_frame + '/' + targets + '/' + cur_jd + '/' + jd_rate + '/' + tail_length + '/' + valid_time);
	let data = await response.json();
	return data;
}

/*
	async function to get which bodies are in the db
	@return {json} data - JSON of available bodies
*/
async function getAvailableBodies(){
	let response = await fetch('http://0.0.0.0:5000/api/body-list/');
	let data = await response.json();
	return data;
}

/*
	async function to get which bodies are in the db
	@return {json} data - JSON of available bodies
*/
async function getAvailableBodies2(){
	let response = await fetch('http://0.0.0.0:5000/api/available-bodies/');
	let data = await response.json();
	return data;
}

/*
	async function to get info for bodies
	@return {json} data - JSON of body info such as radius, mass, etc.
*/
async function getRadii(targets){
	let response = await fetch('http://0.0.0.0:5000/api/body-radius/' + targets);
	let data = await response.json();
	return data;
}

async function getRotationData(targets){
	let response = await fetch('http://0.0.0.0:5000/api/rotations/' + targets );
	let data = await response.json();
	return data;
}

// Mapping of the Sun and the planet's texture paths
let body_textures = {
	"sun" : '/js/textures/2k_sun.jpg',
	"mercury" : '/js/textures/2k_mercury.jpg',
	"venus" : '/js/textures/2k_venus_surface.jpg',
	"earth" : '/js/textures/2k_earth_daymap.jpg',
	"mars" : '/js/textures/2k_mars.jpg',
	"jupiter" : '/js/textures/jupiter2_4k.jpg',
	"saturn" : '/js/textures/2k_saturn.jpg',
	"uranus" : '/js/textures/2k_uranus.jpg',
	"neptune" : '/js/textures/2k_neptune.jpg',
	"pluto" : '/js/textures/plutomap2k.jpg',
	"moon" : '/js/textures/2k_moon.jpg',
};


/*
	Hides the right-click menu in the bodies menu
*/
function hideContextMenu() {
	let contextMenu = document.getElementsByClassName("context-menu")[0];
	contextMenu.style.display = "none";
}


/*
	Creates a child elements in nested checkbox for bodies
	@param {string} name - Name of the body
	@param {array} sublist - List of bodies that are 'sub-bodies' of the added body e.g Earth -> Moon
	@return {documentElement} li_element - New dropdown element
*/
function createSubElements(lower_name, sublist){

	// CHECK IF RESULTS IS A PLANET OR MOON
	// if(results["category"] != "asteroid" && results["category"] != "comet" && results["category"] != "misc"){

	// 	// CHECK IF RESULTS IS A PRIMARY BODY
	// 	if(results["category"] == results["body name"]);{

	// 	}
	const name = capitalizeFirstLetter(lower_name);
	// Create outermost div
	var planet_box_div = document.createElement("div");
	const box_id = name + "-box";
	planet_box_div.setAttribute("id", box_id);
	planet_box_div.setAttribute("class", "body-box");

	// Create next innermost div
	var body_label_div = document.createElement("div");
	body_label_div.setAttribute("id", name);
	body_label_div.setAttribute("class", "checkbox_and_label");

	// Create planet body input and label
	var planet_input = document.createElement("input");
	planet_input.setAttribute("id", name + "-body");
	planet_input.setAttribute("type", "checkbox");
	planet_input.setAttribute("disabled", "disabled");
	//planet_input.setAttribute("readonly", "readonly");
	planet_input.setAttribute("class", "readonly");
	planet_input.setAttribute("name", name + "-body");
	planet_input.setAttribute("value", name);
	planet_input.setAttribute("onClick" , "handleCheckboxClick(id, value)");

	var planet_label = document.createElement("label");
	planet_label.setAttribute("for", name + "-body");
	planet_label.setAttribute("class", "readonlylabel");
	planet_label.setAttribute("id", name + "-label");
	planet_label.innerHTML = name;
	var br = document.createElement("br");
	// Add input and label to innermost div
	body_label_div.appendChild(planet_input);
	body_label_div.appendChild(planet_label);
	body_label_div.appendChild(br);

	// Add inner div as child of outermost div
	planet_box_div.appendChild(body_label_div);
	// If sublist has bodies in it, add sublist of bodies to outermost div
	if(sublist.size > 0){
		// Create a nested div
		var nested_div = document.createElement("div");
		nested_div.setAttribute("id", "nested" + name);
		nested_div.setAttribute("style", "display:none");
		nested_div.setAttribute("class", "nested_list");

		// Add nested div to the outermost div
		planet_box_div.appendChild(nested_div);

		// Iterate over bodies in sublist
				//console.log(sublist.values());

		for(const i of sublist.values()){
			//console.log(i)
			const upper_name = capitalizeFirstLetter(i);
			// Create an inner div
			var inner_nested_div = document.createElement("div");
			inner_nested_div.setAttribute("id", upper_name); // IS ID OKAY?
			inner_nested_div.setAttribute("class", "checkbox_and_label");
			//inner_nested_div.setAttribute("value", sublist[i]); // IS VALUE OKAY?

			// Add inner nested div to outer nested div
			nested_div.appendChild(inner_nested_div);

			// Create an input and label
			var inner_input = document.createElement("input");
			inner_input.setAttribute("id", upper_name + "-body");
			inner_input.setAttribute("type", "checkbox");
			inner_input.setAttribute("disabled", "disabled");
			inner_input.setAttribute("class", "readonly");
			//inner_input.setAttribute("readonly", "readonly");
			inner_input.setAttribute("name", upper_name + "-body");
			inner_input.setAttribute("value", upper_name);
			inner_input.setAttribute("onClick" , "handleCheckboxClick(id, value)");

			var inner_label = document.createElement("label");
			inner_label.setAttribute("for", upper_name + "-body");
			inner_label.setAttribute("class", "readonlylabel");
			inner_label.setAttribute("id", upper_name + "-label");
			inner_label.innerHTML = upper_name;
			var br1 = document.createElement("br");

			// Add input and label to inner nested div
			inner_nested_div.appendChild(inner_input);
			inner_nested_div.appendChild(inner_label);
			inner_nested_div.appendChild(br1);
		}
		
		planet_input.addEventListener("click", function() {
			var nested = document.getElementById("nested" + name);
			if(nested.getAttribute("style") == "display:none"){
				nested.setAttribute("style", "display:content");
			}
			else{
				nested.setAttribute("style", "display:none");
			}
		});
	}
	return planet_box_div;
}

/*
	Check if object has any properties
	@param {Object} obj - Javascript object
	@return {Boolean} true/false - whether the object has a property
*/
function isEmpty(obj) {
    for(var key in obj) {
        if(obj.hasOwnProperty(key))
            return false;
    }
    return true;
}

var radii = {};

var expanded = false;

/*
	This function is used to append a checkbox element to a checkbox menu
	@param parent_element - This is the checkbox menu that we want to add the new checkbox element to
	@param child_element_name - This is the name of the checkbox element that we want to create
*/
function appendCheckboxElement(parent_element , child_element_name){
	var id = child_element_name.concat("-checkbox");
	var element = document.createElement("input");
	var element_label = document.createElement("label");
	element.setAttribute("type" , "checkbox");
	element.setAttribute("id" , id);
	element_label.setAttribute("for" , id);
	element_label.appendChild(element);
	element_label.append(child_element_name);
	parent_element.appendChild(element_label);
	element.checked = true;
}

/*
	Toggles the checkbox menu when the menu is clicked
*/

//Either Unneccessary or need to be updated
/*
function showCheckboxes() {
	var checkboxes = document.getElementById("checkboxes");
	if (!expanded) {
		checkboxes.style.display = "block";
		expanded = true;
	} else {
		checkboxes.style.display = "none";
		expanded = false;
  	}
}
*/

/*
	Sets the date of the visualization
*/
document.querySelectorAll('.vis-controls__set-date').forEach(
	function(elt){elt.onclick=function(){
		viz.setDate( new Date(prompt('Enter a date in the format YYYY-mm-dd.','2000-01-01')));

	};
});

// Form for a new simulation
let sim_form = document.getElementById('newSimForm');

/*
	Creates a new simulation with the form data when the user selects submit
*/
sim_form.addEventListener('submit', function(e){
	e.preventDefault();
	// Data user entered in form
	const formData = new FormData(this);
	viz.stop();
	viz = null;
	if(viz1 != null){
		viz1.stop();
		viz1 = null;
	}

	visualizer_list = [];

	// Create a new div element
	var div = document.createElement('div');
	
	div.id = 'new-container';
	document.body.replaceChild(div, document.getElementById('main-container'));
	div.id = 'main-container';

	// convert time entered entered into milliseconds passed UNIX epoch
	const start_time =  Date.parse(formData.get('jd_start')) ;

	// Creates the new simulation from data entered
	var new_viz = createNewSim(formData.get('wrt'), formData.get('targets'), 1, start_time, [2500 / unitsPerAu, 5000 / unitsPerAu, 5000 / unitsPerAu]);

	// Push the simulation on the stack
	simulation_stack.push[new_viz];
	viz = new_viz;
	// console.log(viz);
	// viz.start();
	console.log(document.getElementById('main-container').children);
});

// Form for trajectory comparison
let compare_form = document.getElementById('comparison-form');

/*
	Creates a split-scrren view comparing the simulations
*/
compare_form.addEventListener('submit', function(e){
	e.preventDefault();
	const formData = new FormData(this);
	viz.stop();
	viz = null;
	if(viz1 != null){
		viz1.stop();
		viz1 = null;
	}

	visualizer_list = [];

	var comparison_container = document.createElement('div');
	comparison_container.id = "comparison_container";
	var div1 = document.createElement('div');
	div1.id = "comparison1";
	var div2 = document.createElement('div');
	div2.id = "comparison2";
	comparison_container.appendChild(div1);
	comparison_container.appendChild(div2);
	document.body.replaceChild(comparison_container, document.getElementById('main-container'));
	comparison_container.id = 'main-container';
	// convert time entered entered into milliseconds passed UNIX epoch
	const start_time =  Date.parse(formData.get('jd_start')) ;

	// TODO: check if both start times are the same
	//		 if both times are identical, display the simulation time once on the top of the page
	//		 if not, display two separate times on each mini div
	
	// Create two new simulations that will be compared side by side
	var new_viz1 = createNewSim(formData.get('wrt'), formData.get('targets'), 1, start_time, [2500 / unitsPerAu, 5000 / unitsPerAu, 5000 / unitsPerAu], "comparison1");
	var new_viz2 = createNewSim(formData.get('wrt2'), formData.get('targets2'), 1, start_time, [2500 / unitsPerAu, 5000 / unitsPerAu, 5000 / unitsPerAu], "comparison2", false);
	new_viz2._camera = new_viz1._camera;
	
	viz = new_viz1;
	viz1 = new_viz2;
	viz1.onTick = null;
	// viz.start();
	// viz1.start();
});

// Form to submit a new spk kernel
let form = document.getElementById('myForm');
let form_submit = document.getElementById("submit_SPK");
/*
	Calls API endpoint to upload a kernel
*/


form.addEventListener('submit', function(event){
	event.preventDefault();
	const formData = new FormData(this);
	// Call API endpoint that will submit the new file
	fetch('http://0.0.0.0:5000/api/spk-upload', {
		method: 'POST',
		body: formData
	})
	.then(response => {
		if(response.status === 400){
			console.log(response);
			displayError("File not valid");
			return response;
		}
		else{
			console.log(response);
		}
	})
	.catch(error => {
    	console.error(error);
  	});
  	this.style.display = "none";
})

/*
	Create an AetherSimulation and add the bodies to the simulation
	@param {string} wrt - (With Respect To) The object from which the positions are computed in reference to
	@param {string} targets - Target bodies that will be simulated
	@param {Number} jd_delta - The rate the jd for simulation to change
	@param {float} jd_start - Jd for simulation to start
	@param {array[Number]} camera_start - Position for the camera to start, default=[2500,5000,5000]
	@param {string} container - div to place the simulation in, default=main-container
*/
function createNewSim(wrt, targets, jd_delta=1, unix_epoch_start, camera_start=[2500,5000,5000], container='main-container', primary_sim=true){

	////////////////////////////////////////////////////////////////////////////////////////////
	////////////////////// GET AVAILABLE BODY DETAILS FROM THE BACKEND /////////////////////////
	////////////////////////////////////////////////////////////////////////////////////////////

	// Only get available body detail if this will be a primary sim, prevents two sims from issuing the API request if comparing sims
	if(primary_sim){
		getAvailableBodies2().then(data =>{
			// Create new div to house nested checklist drodown menu
		 	var div = document.createElement('div');
			div.id = 'new-content1';

			// Replace existing checklist dropdown with new div
			document.getElementById("mySidebar1").replaceChild(div, document.getElementById("content1"));
			div.id = 'content1'; // important
			document.getElementById("content1").setAttribute("class", "content1");

			// Mapping of planet bodies and their natural satellites
			// i.e. categories["mars"] = ["deimos", "phobos"]
		 	var categories = {
		 		"sun" : new Set(),
		 		"mercury" : new Set(),
		 		"venus" : new Set(),
		 		"earth" : new Set(),
		 		"mars" : new Set(),
		 		"jupiter" : new Set(),
		 		"saturn" : new Set(),
		 		"uranus" : new Set(),
		 		"neptune" : new Set(),
		 		"pluto" : new Set(),
		 		"spacecraft": new Set(),
		 		"asteroid" : new Set(),
		 		"comet" : new Set(),
		 		"misc" : new Set(),
		 	};

		 	// Iterate over API results in order to populate the above mapping
		 	for(let index in data){
		 		// Prevent a planet from adding itself to its natural satellite list
		 		// i.e. categories["mars"] = ["mars", deimos", "phobos"] would be bad
		 		if(!(data[index]["body name"] in categories)){
			 		categories[data[index]["category"]].add(data[index]["body name"]);
			 	}
		 	}
		 	console.log(categories);

		 	// Add the html for the nested checkbox list for each overarching category of body
		 	for(const primary_body in categories){

		 		div.appendChild(createSubElements(primary_body, categories[primary_body]));
			 }
		 	
		 	// Set up the right-click context menu for the dropdown items
			let boxes = document.querySelectorAll(".checkbox_and_label");
			boxes.forEach(function(item){
			  let itemID = item.id;
			  // Add the event listener
			  item.addEventListener("contextmenu" , function(e){
			    e.preventDefault();
			    let contextMenu = document.getElementsByClassName("context-menu")[0];
			    contextMenu.style.top = e.clientY + "px";
			    contextMenu.style.left = e.clientX + "px";
			    contextMenu.style.display = "block";
			    contextMenu.id = itemID + "-context-menu";
			    contextMenu.name = itemID;
			  });
			});
			// Allow the context menu to be hidden
			// TODO: Improve this behavior
			//let checkbox = document.getElementById("toggleView");
			//checkbox.addEventListener("change" , function(){
			//  hideContextMenu();
			  //Todo, add functionality to hide bodies
			//});

			// SET GLOBAL VARIABLE FOR BODY METADATA
			// i.e. body name, category, has radius data, has rotation data, is user-uploaded, spice id, range(s) of valid ephemeris times
			body_meta_data = data;
		});
	}


	////////////////////////////////////////////////////////////////////////////////////////////
	///////////////////////// CREATE THE SIMULATION OBJECT /////////////////////////////////////
	////////////////////////////////////////////////////////////////////////////////////////////

	var new_viz = new AetherSimulation(document.getElementById(container), {
	  basePath: 'https://typpo.github.io/spacekit/src',
	  jdDelta: jd_delta,
	  startDate: unix_epoch_start,
	  startPaused: true,
	  unitsPerAu: unitsPerAu,
	  camera: {
	  	initialPosition: camera_start,
	  	enableDrift: false,
	  },
	  wrt: wrt
	});


	////////////////////////////////////////////////////////////////////////////////////////////
	///////////////////////// GET RADII, ROATION, AND POSITION DATA ////////////////////////////
	////////////////////////////////////////////////////////////////////////////////////////////

	// TODO: use body_meta_data to avoid unneccesarily passing bodies to radii and rotation endpoints

	// Get radius info for bodys in simulation
	getRadii(targets).then(data => {
		console.log(data);
		for(const property in data){
			if(data[property] === "NO RADIUS DATA AVAILABLE"){
				displayError(property + " HAS " + data[property]);
				radii[property] = [-1, -1]; // If the call didn't return a radius, set radius to -1
				body_textures[property.toUpperCase()] = '/js/textures/smallparticle.png';
			}
			else{
				radii[property] = [data[property].map(Spacekit.kmToAu)[0], data[property].map(Spacekit.kmToAu)[2]]; // Keep track of equatorial radius and polar radius
			}
		}

		// get body rotation data
		var rotation_data = {};

		getRotationData(targets).then(data => {
			for(const property in data){

				// If call didn't return rotation data for a body, set its parameters to null
				if(data[property] == "NO ROTATION DATA AVAILABLE"){
					rotation_data[property] = {
						"ra": null,
						"dec": null,
						"pm": null,
						"ra_delta": null,
						"dec_delta": null,
						"pm_delta": null,
						"nut_prec_angles": null,
						"nut_prec_ra": null,
						"nut_prec_dec": null,
					};
					displayError(property + " HAS " + data[property]);
				}
				else{
					rotation_data[property] = data[property]; // Keep track of rotation details
				}
			}

			// Retrieve the position data with the specified parameters
			getPositionData2(wrt, targets, new_viz.getJd().toString(), new_viz.getJdDelta(), (new_viz.getJdDelta()*60*10).toString(), "10").then(data => {
				if(data.error){
					displayError(data);
					return data;
				}
				// iterate over each body returned by the API call
				for(const property in data){
					// Array of [x,y,z] coords in AU
					var allAdjustedVals = [];
					// Array of Julian Dates corresponding to each position
					var allAdjustedTimes = [];
					// Current Julian Date
					var cur_jd = new_viz.getJd();

					// set tail indexes
					var cur_idx = data[property].cur_time_idx;
					const tail_start_idx = 0;
					var tail_end_idx;
					if(data[property].times.length % 2 == 0){
						tail_end_idx = data[property].times.length / 2;
					}
					else {
						tail_end_idx = Math.ceil(data[property].times.length / 2);
					}

					// iterate over the data for the current body
					var i = 0;
					for(pos of data[property].positions){
						// convert coordinates in km to au
						adjustedVals = pos.map(Spacekit.kmToAu);
						// convert coords to ecliptic
						adjustedVals2 = Spacekit.equatorialToEcliptic_Cartesian(adjustedVals[0], adjustedVals[1], adjustedVals[2], Spacekit.getObliquity());
						let vector = new Spacekit.THREE.Vector3(adjustedVals2[0]*unitsPerAu, adjustedVals2[1]*unitsPerAu, adjustedVals2[2]*unitsPerAu);
						
						// push positions and their corresponding times to arrays
						allAdjustedVals.push(vector);
						allAdjustedTimes.push(parseFloat(data[property].times[i]));
						i++;
					}
					
					// Create object
					var bodyName = capitalizeFirstLetter(property)
					var radius;
					if(bodyName == "Sun"){
						radius = 0.17;
						//new_viz.createLight(allAdjustedVals[cur_idx]);
					}
					else if(bodyName == "Moon"){
						radius = 0.0005;
					}
					else{
						radius = .08;
					}

					// Check rotation data for body
					var is_rotating = true;
					if(rotation_data[property].ra == null){
						is_rotating = false; // disable the object's rotation if no rotation data
					}
					let body = null;
					// Create a new space object
					if(radii[property][0] === -1){
						body = new_viz.createAetherObject(property, {
							labelText: bodyName,
							name: property,
							currIndex: cur_idx,
							radius: 0.03,
							particleSize: 1,
							rotation: true,
							hideOrbit: true,
							positionVectors: allAdjustedVals,
							ephemUpdate: getPositionData2,
							jdTimeData: allAdjustedTimes,
							levelsOfDetail: [{
								threshold: 0,
								segments: 40,
							}],
							rotation: {
								enable: is_rotating,
							},
							ra: rotation_data[property].ra,
							dec: rotation_data[property].dec,
							pm: rotation_data[property].pm,
							ra_delta: rotation_data[property].ra_delta,
							dec_delta: rotation_data[property].dec_delta,
							pm_delta: rotation_data[property].pm_delta,
							nut_prec_angles: rotation_data[property].nut_prec_angles,
							nut_prec_ra: rotation_data[property].nut_prec_ra,
							nut_prec_dec: rotation_data[property].nut_prec_dec,
						});
					}
					else{
						body = new_viz.createAetherObject(property, {
							labelText: bodyName,
							name: property,
							textureUrl: body_textures[property],
							currIndex: cur_idx,
							radius: radii[property][0],
							radius_polar: radii[property][1],
							rotation: true,
							hideOrbit: true,
							positionVectors: allAdjustedVals,
							ephemUpdate: getPositionData2,
							jdTimeData: allAdjustedTimes,
							levelsOfDetail: [{
								threshold: 0,
								segments: 40,
							}],
							rotation: {
								enable: is_rotating,
							},
							ra: rotation_data[property].ra,
							dec: rotation_data[property].dec,
							pm: rotation_data[property].pm,
							ra_delta: rotation_data[property].ra_delta,
							dec_delta: rotation_data[property].dec_delta,
							pm_delta: rotation_data[property].pm_delta,
							nut_prec_angles: rotation_data[property].nut_prec_angles,
							nut_prec_ra: rotation_data[property].nut_prec_ra,
							nut_prec_dec: rotation_data[property].nut_prec_dec,
						});
					}
					// Update global variables
					if(bodyName in visualizer_list){
						visualizer_list[bodyName + '1'] = body;
					}
					else{
						visualizer_list[bodyName] = body;
					}
					initCheckboxes();
					// Set globals
					adjusted_positions[bodyName] = allAdjustedVals;
					adjusted_times[bodyName] = allAdjustedTimes;

					// Activate the checkboxes for bodies that are currently loaded into the simulation
					document.getElementById(bodyName + "-label").removeAttribute("class");
					document.getElementById(bodyName + "-body").removeAttribute("class");
					document.getElementById(bodyName + "-body").removeAttribute("disabled");
					document.getElementById("Asteroid-label").removeAttribute("class");
					document.getElementById("Asteroid-body").removeAttribute("class");
					document.getElementById("Asteroid-body").removeAttribute("disabled");
					document.getElementById("Asteroid-body").removeAttribute("input");
					document.getElementById("Spacecraft-label").removeAttribute("class");
					document.getElementById("Spacecraft-body").removeAttribute("class");
					document.getElementById("Spacecraft-body").removeAttribute("disabled");
					document.getElementById("Comet-label").removeAttribute("class");
					document.getElementById("Comet-body").removeAttribute("class");
					document.getElementById("Comet-body").removeAttribute("disabled");
					document.getElementById("Misc-label").removeAttribute("class");
					document.getElementById("Misc-body").removeAttribute("class");
					document.getElementById("Misc-body").removeAttribute("disabled");
				}
				//console.log(visualizer_list);
				
			})
			.catch(error => {
				console.error(error);
			});
		})
		.catch(error => {
			console.error(error);
	  	});
	});

	
	// make camera controls more fine-grained
	new_viz.tuneCameraControls(0.75, 1, 2, 14);
	
	new_viz.onTick = tick;
	return new_viz;
}

/*
	Main function to begin the application
*/
function runApp(){
	/////////////////////////////////
	///// Default Visualization /////
	/////////////////////////////////

	// Main visualization object
	//viz = createNewSim('solar system barycenter', 'sun+mercury+venus+earth+mars+jupiter+saturn+uranus+neptune+pluto+moon+2000003+2000005+2000006+2000426', 1, Date.now()); // todo: change last parameter to be in JD
	//viz = createNewSim('solar system barycenter', '2000003', 1, Date.now()); // todo: change last parameter to be in JD
	viz = createNewSim('solar system barycenter', 'sun+mercury+venus+earth+mars+jupiter+saturn+uranus+neptune+pluto+moon', 1, Date.now()); // todo: change last parameter to be in JD
	//saturn+titan+mimas+enceladus+tethys+dione+rhea+hyperion+iapetus+phoebe+helene+telesto+calypso+methone+polydeuces
	//viz = createNewSim('saturn barycenter', 'saturn+titan+mimas+enceladus+tethys+dione+rhea+hyperion+iapetus+phoebe+helene+telesto+calypso+methone+polydeuces', 1, Date.now());
	document.getElementById('sim_time').innerHTML = viz.getDate();
	const sim_time = document.getElementById('sim_time');

	const sim_rate = document.getElementById("sim_rate");
  
	// A time slider that changes the rate of time for the simulation
	var time_slider = document.getElementById("myRange");
	time_slider.oninput = function() {
		let speed = Math.floor(this.value / 25) + 1;
		//console.log(speed);
		if(speed == 1){
			viz.setJdDelta(-1);
			viz.mult = -1;
			if(viz1 != null){
				viz1.setJdDelta(-1);
				viz1.mult = -1;
			}
		}
		else if(speed == 2){
			viz.setJdDelta(1.0/60);
			viz.mult = 1.0/60;
			if(viz1 != null){
				viz1.setJdDelta(1.0/60);
				viz1.mult = 1.0/60;
			}
		}
		else if(speed == 3){
			viz.setJdDelta(1);
			viz.mult = 1;
			if(viz1 != null){
				viz1.setJdDelta(1);
				viz1.mult = 1;
			}
		}
		else if(speed == 4){
			viz.setJdDelta(2);
			viz.mult = 2;
			if(viz1 != null){
				viz1.setJdDelta(2);
				viz1.mult = 2;
			}
		}
		else if(speed == 5){
			viz.setJdDelta(4);
			viz.mult = 4;
			if(viz1 != null){
				viz1.setJdDelta(4);
				viz1.mult = 4;
			}
		}
		else{
			viz.setJdDelta(1);
			viz.mult = 1;
			if(viz1 != null){
				viz1.setJdDelta(1);
				viz1.mult = 1;
			}
		}
		
	}

	// A slider that changes the length of the tail of a body
	var tail_slider = document.getElementById("myRange2");
	tail_slider.oninput = function() {
		viz.tail_length = this.value / 100;
		if(viz1 != null){
			viz1.tail_length = this.value / 100;
		}
	}

	// A button that will set the simulation to real time
	document.getElementById("real_time").addEventListener("click", function() {
		viz.setDate(Date.now());
		viz.setJdPerSecond(realTimeRate);
	});

	// A button that starts and pauses the simulation
	document.getElementById("start-button").addEventListener("click", function() {
		togglePlay = !togglePlay;
		if(togglePlay){
			viz.start();
			if(viz1 != null){
				viz1.start();
			}
		} else {
			viz.stop();
			if(viz1 != null){
				viz1.stop();
			}
		}
	});

	document.getElementById("input_time_set").addEventListener("click" , function(){
		let input = document.getElementById("input_time").value;
		//This pulls the value input from the time set field

		//Todo, do something with this
		console.log(input);
	});

	document.getElementById("input_length_set").addEventListener("click" , function(){
		let input = document.getElementById("input_length").value;
		//This pulls the value input from the time set field

		//Todo, do something with this
		viz.tail_length = input / 100;
		if(viz1 != null){
			viz1.tail_length = input / 100;
		}
		console.log(input);
	});

	document.getElementById("infoButton").addEventListener("click", function(){
		let bodyName = document.getElementsByClassName("context-menu")[0].id.replace("-context-menu" , "");
		hideContextMenu();
		displayBodyInfo(bodyName);
	});

	function displayBodyInfo(name){
		let info_panel = document.getElementById("info_panel1");
		let body = visualizer_list[name];
		info_panel.style.display = "block";

		//remove the children
		let children = info_panel.children;
		while(children.length != 0) children.item(0).remove();

		//Give it a title
		let title = document.createElement("H1");
		title.innerText = name;
		info_panel.appendChild(title);

		//Display the Equatorial radius in Km
		let radius = Spacekit.auToKm(body.radius).toFixed(2);
		let radiusE = document.createElement("H4");
		radiusE.innerText = "Equatorial Radius: " + radius + " Km";
		info_panel.appendChild(radiusE);

		//Display the polar radius in Km
		let pradius = Spacekit.auToKm(body.radius_polar).toFixed(2);
		let pradiusE = document.createElement("H4");
		pradiusE.innerText = "Polar Radius: " + pradius + " Km";
		info_panel.appendChild(pradiusE);

		let closebtn = document.createElement("button");
		closebtn.id = "info_close";
		closebtn.innerText = "\x2D";
		closebtn.style.display = "block";
		closebtn.title = "close";
		closebtn.addEventListener("click", function() {
			document.getElementById("info_panel1").style.display = "none";
		})
		info_panel.appendChild(closebtn);
		console.log(body);
	}

	document.getElementById("zoomToBody").addEventListener("click" , function(){
		let bodyName = document.getElementsByClassName("context-menu")[0].id.replace("-context-menu" , "");
	    //console.log(bodyName);
	    hideContextMenu();
	    ZoomToBody(bodyName);
	});

	function ZoomToBody(body){
		viz.getViewer().get3jsCameraControls().reset();
		viz.getViewer().followObject(visualizer_list[body] , [0, 0, 0]);
		viz.getViewer().get3jsCamera().position.set(0,0,1.5);//visualizer_list[body]._obj.position.x, visualizer_list[body]._obj.position.y, visualizer_list[body]._obj.position.z);
		viz.getViewer().get3jsCameraControls().update();
	}

	function hideContextMenu() {
        let contextMenu = document.getElementsByClassName("context-menu")[0];
        contextMenu.style.display = "none";
    }
	
	//viz.start();

}

// START THE APP
runApp();