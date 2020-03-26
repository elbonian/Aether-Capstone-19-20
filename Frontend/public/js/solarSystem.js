/*
	Custom simulation object to allow for creation of AetherObjects
	Inherits: Simulation
*/

class AetherSimulation extends Spacekit.Simulation {
	constructor(simulationElt, options) {
        super(simulationElt, options);
        this.mult = options.mult || 1;
        this.tail_length = options.tail_length || 1;
	}

	/*
		Creates new AetherObject
		@param optional parameters for AetherObject
		@return AetherObject
	*/
	createAetherObject(...args){
		return new AetherObject(...args, this);
	}

	renderObject() {
        if (this._renderMethod !== 'SPHERE') {
   
          // Create a stationary sprite.
          this._object3js = this.createSprite();
          if (this._simulation) {
            // Add it all to visualization.
            this._simulation.addObject(this, true /* noUpdate */);
          }
          this._renderMethod = 'SPRITE';
        }
      }

      /**
   * @private
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
    //this._composer.render(0.1);
 
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
        this.init();
      }

	  /*
		  Initialize function. Mostly the same as SphereObject with minor changes
	  */
      init(){
        let map;
        if (this._options.textureUrl) {
          map = new THREE.TextureLoader().load(this._options.textureUrl);
        }
	 
		//Level of detail segments changed to (can be changed)
        const detailedObj = new THREE.LOD();
        const levelsOfDetail = this._options.levelsOfDetail || [
          { radii: 0, segments: 48 },
        ];
        const radius = this.getScaledRadius();
     
        for (let i = 0; i < levelsOfDetail.length; i += 1) {
          const level = levelsOfDetail[i];
          const sphereGeometry = new THREE.SphereGeometry(
            radius,
            level.segments,
            level.segments,
          );
     
          let material;
          if (this._simulation.isUsingLightSources()) {
            const uniforms = {
              sphereTexture: { value: null },
              lightPos: { value: new THREE.Vector3() },
            };
            // TODO(ian): Handle if no map
            uniforms.sphereTexture.value = map;
            uniforms.lightPos.value.copy(this._simulation.getLightPosition());
            material = new THREE.ShaderMaterial({
              uniforms,
              vertexShader: SPHERE_SHADER_VERTEX,
              fragmentShader: SPHERE_SHADER_FRAGMENT,
              transparent: true,
            });
          } else {
			//mesh material changed to transparent and opacity to 0 to not see weird meshes
            material = new THREE.MeshBasicMaterial({
                transparent: true, 
                opacity: 0,
            });
          }
		  Object.defineProperty( material, 'needsUpdate', {
			value: true,
  			writable: true
			} );
          const mesh = new THREE.Mesh(sphereGeometry, material);
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
     
     	// set current index
        this.currIndex = this._options.currIndex;

        // set position data
        this.positionVectors = this._options.positionVectors;
        //this.jdTimeData = this._options.jdTimeData;


        if (this._options.atmosphere && this._options.atmosphere.enable) {
          this._obj.add(this.renderFullAtmosphere());
        }
     
        if (this._options.axialTilt) {
          this._obj.rotation.y += rad(this._options.axialTilt);
        }
     
        this._renderMethod = 'SPHERE';
     
        if (this._simulation) {
          // Add it all to visualization.
          this._simulation.addObject(this, false /* noUpdate */);
        }

        // set object's initial position
        this._obj.position.set(this.positionVectors[this.currIndex].x, this.positionVectors[this.currIndex].y, this.positionVectors[this.currIndex].z);


        //init trajectory tail
        this.geometry = new THREE.BufferGeometry();
		this.material = new THREE.LineBasicMaterial({color: new THREE.Color(0x6495ED)});
		//this.geometry.vertices.needsUpdate = true;
		Object.defineProperty( this.material, 'needsUpdate', {
			value: true,
			writable: true
		} );


		// 1D array describing the vertices of the line
		// i.e. [x1,y1,z1,x2,y2,z2,...,xn,yn,zn]
		var positions = new Float32Array( this.positionVectors.length * 3);
		this.geometry.addAttribute( 'position', new THREE.BufferAttribute( positions, 3) );																								
		//this.geometry.vertices = this.positionVectors;
		//this.geometry.verticesNeedUpdate = true;
		this.geometry.setDrawRange( this.tailStartIndex, this.currIndex);
		let line = new THREE.Line(
			this.geometry,
			this.material,
		);

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

        super.init();
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
		  this.currIndex += this._simulation.mult;
		  const currPos = this.positionVectors[this.currIndex];
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
		@param positions List of THREE.Vector3() objects representing new (or old) position coordinates
		@param prepend Boolean indicating whether the positions need to be prepended or put on the end
	  */
	  addPositionData(positions, prepend=false){
	  	if(prepend){
	  		this.currIndex += position_vectors.length;
	  		this.tailStartIndex += position_vectors.length
	  		this.positionVectors = positions.concat(this.positionVectors);
	  	}
	  	else{
	  		this.positionVectors = this.positionVectors.concat(positions.slice(1, positions.length - 1));
	  	}
	  }


	  /*
		Add more time data to the object's jd time list
		@param times List of jd times (string) representing new (or old) jd times
		@param prepend Boolean indicating whether the times need to be prepended or put on the end
	  */
	  addTimeData(times, prepend=false){
	  	if(prepend){
	  		this.currIndex += position_vectors.length;
	  		this.tailStartIndex += position_vectors.length
	  		this.positionVectors = positions.concat(this.positionVectors);
	  	}
	  	else{
	  		this.jdTimeData = this.jdTimeData.concat(times.slice(1, times.length - 1));
	  	}
	  }

	  /*
		Update object's internal THREE.Line object that displays its trajectory
		Uses this.positionVectors, this.currentIndex, and this.tailStartIndex to determine line vertices and drawRange
	  */
	  updateLineData(){
	  	var position_array = new Float32Array( this.positionVectors.length * 3);
	  	// create 1D array of form [x1,y1,z1,x2,y2,z2,...,xn,yn,zn]
		this.geometry.addAttribute( 'position', new THREE.BufferAttribute( position_array, 3) );																								
		// set drawrange to start at tailStartIndex and draw this.currIndex many vertices
		this.geometry.setDrawRange( this.tailStartIndex, this.currIndex); // todo: might break when time rate is negative
		let line = new THREE.Line(
			this.geometry,
			this.material,
		);

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
		// remove old line
		//scene.remove(scene.getObjectById(this.previousLineId));
		scene.add(line);
		this.line = line;
		this.previousLineId = line.id;
	  }


	  /*
		  Updates the position of the body according to postionVectors
	  */
      update(jd){
      	// update the object's tail beginning
      	this.setNextTailStart();
      	this.drawLineSegment();
      	// check if object is 2/3 of the way through its available data
      	if(this.currIndex >= (this.positionVectors.length * (2/3)) && !this.isUpdating){
      		this.isUpdating = true;
      		this.ephemUpdate("solar system barycenter", this.name, (this.jdTimeData[this.jdTimeData.length - 1]).toString(), 1, "0", "10").then(data => {
     
      			// adjust results to be in km and in ecliptic plane
      			var position_vectors = data[this.name].positions.map(function(pos){
			  		var adjusted_val = pos.map(Spacekit.kmToAu);//[Spacekit.kmToAu(pos[0]), Spacekit.kmToAu(pos[1]), Spacekit.kmToAu(pos[2])];
			  		//console.log(adjusted_val);
			  		var adjusted_val2 = Spacekit.equatorialToEcliptic_Cartesian(adjusted_val[0], adjusted_val[1], adjusted_val[2], Spacekit.getObliquity());
			  		
			  		return new THREE.Vector3(adjusted_val2[0], adjusted_val2[1], adjusted_val2[2]);
			  	});
			  	//console.log(position_vectors);
      			this.addPositionData(position_vectors);
      			this.addTimeData(data[this.name].times);
      			this.updateLineData();
      			this.isUpdating = false; //  signal that object is done updating
      		});
      		
      	}

		// ensure we don't go out of bounds on the position list
		if(this.currIndex >= 0 && this.currIndex < this.positionVectors.length-1){

			// only update object position if not paused
      		if(!this._simulation._isPaused){
      			// update object's location
      			this.setNextPos()
			}
      	}
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


// Dictionary of bodies in the visualization
// e.x. "body name" : body object
var visualizer_list = {};

// Dictionary of ecliptic cartesian (x,y,z) coordinates in AU
// e.x. "body name" : [[x1,y1,z1],...,[xn,yn,zn]]
var adjusted_positions = {};

// Dictionary of Julian Days corresponding to each [x,y,z] coordinate in adjusted_positions
// e.x. "body name" : [2451545.094,...,2451560..43]
var adjusted_times = {};


/////////////////////////////////
/////// Utility Functions ///////
/////////////////////////////////

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}



/////////////////////////////////
///// Default Visualization /////
/////////////////////////////////


// Main visualization object
const viz = new AetherSimulation(document.getElementById('main-container'), {
  basePath: 'https://typpo.github.io/spacekit/src',
  //jdPerTick : 1/60,
  jdDelta: 1,
  //jdPerSecond: 7,
  startDate: Date.now(),
  startPaused: true,
  unitsPerAu: 1.0,
  camera: {
  	//initialPosition: [-10,-20,5],
  	enableDrift: false,
  },
  debug: {
  	showAxes: true,
	showGrid: true,
	showStats: true,  
  }
});

//function tick(){
	// console.log(viz._fps);
	// console.log(viz._jdPerSecond);
	// console.log(viz.getJdDelta());
	//console.log(viz.getJdPerSecond());
	//console.log(viz.tail_length);
//}

//viz.onTick = tick;

//async function to get data from API
async function getPositionData(ref_frame, targets, start_date, end_date, steps){
	//returns a promise containing the response from server
	let response = await fetch('http://0.0.0.0:5000/api/positions/' + ref_frame + '/' + targets + '/' + start_date + '/' + end_date + '/' + steps);
	let data = await response.json();
	return data;
}

async function getPositionData2(ref_frame, targets, cur_jd, jd_rate, tail_length, valid_time){
	let response = await fetch('http://0.0.0.0:5000/api/positions2/' + ref_frame + '/' + targets + '/' + cur_jd + '/' + jd_rate + '/' + tail_length + '/' + valid_time);
	let data = await response.json();
	return data;
}

async function getAvailableBodies(){
	let response = await fetch('http://0.0.0.0:5000/api/body-list/');
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
	"pluto" : '/js/textures/plu0rss1.jpg',
	"moon" : '/js/textures/2k_moon.jpg'
};

// getAvailableBodies().then(data =>{
// 	//console.log(document.getElementById("Moon-checkbox").parentElement.parentElement.parentElement.parentElement.parentElement.parentElement.nodeName);
// 	var ul_element = document.createElement("UL");
// 	var checkboxes = document.getElementById("checkboxes");
// 	for(let body in data){
// 		ul_element.appendChild(createSubElements(body , data[body]));
// 	}
// 	checkboxes.appendChild(ul_element);
// });

function createSubElements(name , sublist){
	var li_element = document.createElement("LI");
	var label_element = document.createElement("LABEL");
	var name2 = name[0].toUpperCase().concat(name.slice(1,name.length).toLowerCase());
	var checkbox_name = name2.concat("-checkbox");
	label_element.setAttribute("for" , checkbox_name);
	var input_element = document.createElement("INPUT");
	input_element.setAttribute("type" , "checkbox");
	input_element.setAttribute("id" , checkbox_name);
	var text_node = document.createTextNode(name2);
	label_element.appendChild(input_element);
	label_element.appendChild(text_node);
	li_element.appendChild(label_element);
	if(isEmpty(sublist)) return li_element
	var ul_element = document.createElement("UL");
	for(let body in sublist){
		ul_element.appendChild(createSubElements(body, sublist[body]));
	}
	li_element.appendChild(ul_element);
	return li_element;
}

function isEmpty(obj) {
    for(var key in obj) {
        if(obj.hasOwnProperty(key))
            return false;
    }
    return true;
}






function renderPointData(adjusted_positions, adjusted_times){ // todo: consider removing?
	const points = [];
	let lines = [];
	for(const property in adjusted_positions){
	
		for(let time = 0; time < adjusted_positions[property].length; time++){
			const vector = new THREE.Vector3(adjusted_positions[property][time][0], adjusted_positions[property][time][1], adjusted_positions[property][time][2]);
			points.push(vector);
			if(time != 0 && time != adjusted_times[property].length-1){
				points.push(vector);
			};
		}
		const pts = new THREE.Geometry();
		pts.vertices = points;
		
		let material = new THREE.LineBasicMaterial({color: new THREE.Color(0x6495ED)});
		Object.defineProperty( material, 'needsUpdate', {
			value: true,
  			writable: true
		} );
		lines.push(new THREE.LineSegments(
			pts,
			material,
		));
	}
}


getPositionData2('solar system barycenter', 'sun+mercury+venus+earth+moon+mars+jupiter+saturn+uranus+neptune+pluto', viz.getJd().toString(), viz.getJdDelta(), (viz.getJdDelta()*60*10).toString(), "10").then(data => {
	// iterate over each body returned by the API call
	for(const property in data){
		// Array of [x,y,z] coords in AU
		var allAdjustedVals = [];
		// Array of Julian Dates corresponding to each position
		var allAdjustedTimes = [];
		// Current Julian Date
		var cur_jd = viz.getJd();

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
			let vector = new THREE.Vector3(adjustedVals2[0], adjustedVals2[1], adjustedVals2[2]);
			
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
		}
		else if(bodyName == "Moon"){
			radius = 0.0005;
		}
		else{
			radius = .08;
		}
		let body = viz.createAetherObject(property, {
			labelText: bodyName,
			name: property,
			textureUrl: body_textures[property],
			currIndex: cur_idx,
			radius: radius,
			particleSize: -1,
			rotation: true,
			hideOrbit: true,
			positionVectors: allAdjustedVals,
			ephemUpdate: getPositionData2,
			jdTimeData: allAdjustedTimes,
			levelsOfDetail: [{
				threshold: 0,
				segments: 40,
			}]
		});

		//console.log(body.ephemUpdate);
		//console.log(body.positionVectors.length);
		// Update global variables
		visualizer_list[bodyName] = body;
		adjusted_positions[bodyName] = allAdjustedVals;
		adjusted_times[bodyName] = allAdjustedTimes;
	}
	viz.start();
});


var expanded = false;

viz.setCameraDrift(false);

//viz.createStars();

//This loop adds checkbox elements for each visualized object. This allowed for every visualized element to be togglable. It also adds an event listener for each element to toggle each object.
var checkboxes = document.getElementById("checkboxes");
for(let i of Object.keys(visualizer_list)){
	appendCheckboxElement(checkboxes , i);
	let checkbox_element = i.concat("-checkbox");
	document.getElementById(checkbox_element).addEventListener("click" , function(){
		let checked = document.getElementById(checkbox_element).checked;
		let label = visualizer_list[i]._label;
		if(!checked){
			if(label != null){
				visualizer_list[i].setLabelVisibility(false);
			}
			viz.removeObject(visualizer_list[i]);
		} else {
			if(label != null){
				visualizer_list[i].setLabelVisibility(true);
			}
			viz.addObject(visualizer_list[i]);
		}
	});
}

document.addEventListener('mousedown', onDocumentMouseDown, false );

var time_slider = document.getElementById("time-rate");
time_slider.oninput = function() {
	if(this.value == 1){
		viz.setJdDelta(-1);
		viz.mult = -1;
	}
	else if(this.value == 2){
		viz.setJdDelta(1);
		viz.mult = 1;
	}
	else if(this.value == 3){
		viz.setJdDelta(2);
		viz.mult = 2;
	}
	else if(this.value == 4){
		viz.setJdDelta(4);
		viz.mult = 4;
	}
	else{
		viz.setJdDelta(1);
		viz.mult = 1;
	}
	
}

var tail_slider = document.getElementById("tail-length");
tail_slider.oninput = function() {
	viz.tail_length = this.value / 100;
}

document.getElementById("real-time").addEventListener("click", function() {
	viz.setDate(Date.now());
	viz.setJdPerSecond(realTimeRate);
});

document.getElementById("start-button").addEventListener("click", function() {
	viz.start();
});

document.getElementById("stop-button").addEventListener("click", function() {
	viz.stop();
});

document.getElementById("submit-button").addEventListener("click", function(){
	let planetZoomChoice = document.getElementById("zoom-dropdown");
	let choiceStr = planetZoomChoice.options[planetZoomChoice.selectedIndex].value;
	//console.log(choiceStr);
	viz.getViewer().followObject(visualizer_list[choiceStr] , [-0.75 , -0.75 , -0.75]);
	viz.getViewer().get3jsCamera().zoom = 10;
	viz.getViewer().get3jsCamera().updateProjectionMatrix();
});


document.getElementById("reset-button").addEventListener("click", function(){
	window.location.reload();
});


/*
	This function is used to append a checkbox element to a checkbox menu
	@param parent_element This is the checkbox menu that we want to add the new checkbox element to
	@param child_element_name This is the name of the checkbox element that we want to create
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

//This function Toggles the checkbox menu when the menu is clicked
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

function onDocumentMouseDown(event) {
	//console.log(event);
	var viewer = viz.getViewer();
	viewer.update();
}

document.querySelectorAll('.vis-controls__set-date').forEach(
       function(elt){elt.onclick=function(){viz.setDate(
               new Date(prompt('Enter a date in the format YYYY-mm-dd.','2000-01-01')));};});
		   