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
		Adds a new object to the simulation
	*/
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
        this.init();
      }

	  /*
		  Initialize function. Mostly the same as SphereObject with minor changes
	  */
      init(){
        let map;
        if (this._options.textureUrl) {
          map = new Spacekit.THREE.TextureLoader().load(this._options.textureUrl);
        }
	 
		//Level of detail segments changed to (can be changed)
        const detailedObj = new Spacekit.THREE.LOD();
        const levelsOfDetail = this._options.levelsOfDetail || [
          { radii: 0, segments: 48 },
        ];
        const radius = this.getScaledRadius();
     
        for (let i = 0; i < levelsOfDetail.length; i += 1) {
          const level = levelsOfDetail[i];
          const sphereGeometry = new Spacekit.THREE.SphereGeometry(
            radius,
            level.segments,
            level.segments,
          );
     
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
              vertexShader: SPHERE_SHADER_VERTEX,
              fragmentShader: SPHERE_SHADER_FRAGMENT,
              transparent: true,
            });
          } else {
			//mesh material changed to transparent and opacity to 0 to not see weird meshes
            material = new Spacekit.THREE.MeshBasicMaterial({
                transparent: true, 
				opacity: 0,
			});
          }
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
     
        this._renderMethod = 'SPHERE';
     
        if (this._simulation) {
          // Add it all to visualization.
          this._simulation.addObject(this, false /* noUpdate */);
        }

        // set object's initial position
        this._obj.position.set(this.positionVectors[this.currIndex].x, this.positionVectors[this.currIndex].y, this.positionVectors[this.currIndex].z);


        //init trajectory tail
        this.geometry = new Spacekit.THREE.BufferGeometry();
		this.material = new Spacekit.THREE.LineBasicMaterial({color: new Spacekit.THREE.Color(0x6495ED)});
		//this.geometry.vertices.needsUpdate = true;

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
		@param positions List of THREE.Vector3() objects representing new (or old) position coordinates
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
		Update object's internal THREE.Line object that displays its trajectory
		Uses this.positionVectors, this.currentIndex, and this.tailStartIndex to determine line vertices and drawRange
	  */
	  updateLineData(){
	  	var position_array = new Float32Array( this.positionVectors.length * 3);
	  	// create 1D array of form [x1,y1,z1,x2,y2,z2,...,xn,yn,zn]
		//this.geometry.setAttribute( 'position', new Spacekit.THREE.BufferAttribute( position_array, 3) );																								
		this.geometry.attributes['position'] = new Spacekit.THREE.BufferAttribute( position_array, 3);
		// set drawrange to start at tailStartIndex and draw this.currIndex many vertices
		this.geometry.setDrawRange( this.tailStartIndex, this.currIndex); // todo: might break when time rate is negative
		let line = new Spacekit.THREE.Line(
			this.geometry,
			this.material,
		);
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
		let scene = this._simulation.getScene();
		// remove old line
		scene.add(line);
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
      	

		// ensure we don't go out of bounds on the position list
		if(this.currIndex >= 1 && this.currIndex < this.positionVectors.length-1){


			if(this._simulation._isPaused){// update the object's tail beginning, regardless of whether sim is paused
	      		this.setNextTailStart();
	      		this.drawLineSegment();
	      	}  	
	      	
			// only update object position if not paused
      		if(!this._simulation._isPaused){
      			// update object's location
      			this.setNextPos()
      			// update the object's tail beginning after updating the object's position
		      	this.setNextTailStart();
		      	this.drawLineSegment();   	
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
	let li = document.createElement("LI"); 
	let err = document.createTextNode("Error: " + error.error);
	li.appendChild(err);
	li.setAttribute("style", "color: red;");
	document.getElementById("error-list").appendChild(li);
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
	async function to get info for bodies
	@return {json} data - JSON of body info such as radius, mass, etc.
*/
async function getRadii(){
	let response = await fetch('http://0.0.0.0:5000/api/body-info/');
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

/*
	Calls async function to handle data retrieved
*/
/*
getAvailableBodies().then(data =>{
 	//console.log(document.getElementById("Moon-checkbox").parentElement.parentElement.parentElement.parentElement.parentElement.parentElement.nodeName);
 	var ul_element = document.createElement("UL");
 	var checkboxes = document.getElementById("checkboxes");
 	for(let body in data){
 		ul_element.appendChild(createSubElements(body , data[body]));
 	}
 	checkboxes.appendChild(ul_element);
});
*/

/*
	Creates a child elements in nested checkbox for bodies
	@param {string} name - Name of the body
	@param {array} sublist - List of bodies that are 'sub-bodies' of the added body e.g Earth -> Moon
	@return {documentElement} li_element - New dropdown element
*/
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

	// Create a new div element
	var div = document.createElement('div');
	
	div.id = 'new-container';
	document.body.replaceChild(div, document.getElementById('main-container'));
	div.id = 'main-container';

	// Creates the new simulation from data entered
	var new_viz = createNewSim(formData.get('wrt'), formData.get('targets'), 1, formData.get('jd_start'), [2500 / unitsPerAu, 5000 / unitsPerAu, 5000 / unitsPerAu]);

	// Push the simulation on the stack
	simulation_stack.push[new_viz];
	viz = new_viz;
	console.log(viz);
	viz.start();
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

	var comparison_container = document.createElement('div');
	comparison_container.id = "comparison_container";
	var div1 = document.createElement('div');
	div1.id = "comparison1";
	var div2 = document.createElement('div');
	div2.id = "comparison2";
	comparison_container.appendChild(div1);
	comparison_container.appendChild(div2);
	document.body.replaceChild(comparison_container, document.getElementById('main-container'));

	for (var member in visualizer_list) delete visualizer_list[member];
	const checkboxes = document.getElementById('checkboxes');
	checkboxes.innerHTML = '';
	// Create two new simulations that will be compared side by side
	var new_viz1 = createNewSim(formData.get('wrt'), formData.get('targets'), 1, formData.get('jd_start'), [2500 / unitsPerAu, 5000 / unitsPerAu, 5000 / unitsPerAu], "comparison1");
	var new_viz2 = createNewSim(formData.get('wrt2'), formData.get('targets2'), 1, formData.get('jd_start2'), [2500 / unitsPerAu, 5000 / unitsPerAu, 5000 / unitsPerAu], "comparison2");
	console.log(visualizer_list);
	new_viz2._camera = new_viz1._camera;
	
	viz = new_viz1;
	viz1 = new_viz2;
	viz1.onTick = null;
	viz.start();
	viz1.start();
});

// Form to submit a new spk kernel
let form = document.getElementById('myForm');

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
	})
	.catch(error => {
    	console.error(error);
  	});
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
function createNewSim(wrt, targets, jd_delta=1, jd_start, camera_start=[2500,5000,5000], container='main-container'){

	// Create a new simulation
	var new_viz = new AetherSimulation(document.getElementById(container), {
	  basePath: 'https://typpo.github.io/spacekit/src',
	  jdDelta: jd_delta,
	  startDate: jd_start,
	  startPaused: true,
	  unitsPerAu: unitsPerAu,
	  camera: {
	  	initialPosition: camera_start,
	  	enableDrift: false,
	  },
	  debug: {
	  	showAxes: false,
		showGrid: false,
		showStats: false,  
	  },
	  wrt: wrt
	});

	// Visualization's main

	// Get body info for simulation
	getRadii().then(data => {
		console.log(data);
		if(data.error){
			displayError(data);
			return data;
		}
		for(const property in data){
			radii[property] = data[property].map(Spacekit.kmToAu)[0];
		}
	})
	.catch(error => {
    	console.error(error);
  	});

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
			}
			else if(bodyName == "Moon"){
				radius = 0.0005;
			}
			else{
				radius = .08;
			}

			// Create a new space object
			let body = new_viz.createAetherObject(property, {
				//labelText: bodyName,
				_id: cur_idx,
				name: property,
				textureUrl: body_textures[property],
				currIndex: cur_idx,
				radius: radius, //(radii[property] * 10),
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
			//let camera =new_viz.getViewer().get3jsCamera();
			//camera.aspect = camera.aspect * 1.001;
			//camera.updateProjectionMatrix();
			// Update global variables
			if(bodyName in visualizer_list){
				visualizer_list[bodyName + '1'] = body;
			}
			else{
				visualizer_list[bodyName] = body;
			}
			//console.log(visualizer_list);
			adjusted_positions[bodyName] = allAdjustedVals;
			adjusted_times[bodyName] = allAdjustedTimes;
		}
	})
	.catch(error => {
		console.error(error);
	});
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
	viz = createNewSim('solar system barycenter', 'sun+mercury+venus+earth+mars+jupiter+saturn+uranus+neptune+pluto+moon+titan', 1, Date.now()); // todo: change last parameter to be in JD
	//simulation_stack.push(viz);

	document.getElementById('sim_time').innerHTML = viz.getDate();
	const sim_time = document.getElementById('sim_time');

	const sim_rate = document.getElementById("sim_rate");

	// A time slider that changes the rate of time for the simulation
	var time_slider = document.getElementById("time-rate");
	time_slider.oninput = function() {
		if(this.value == 1){
			viz.setJdDelta(-1);
			viz.mult = -1;
			if(viz1 != null){
				viz1.setJdDelta(-1);
				viz1.mult = -1;
			}
		}
		else if(this.value == 2){
			viz.setJdDelta(1/60);
			viz.mult = 1/60;
			if(viz1 != null){
				viz1.setJdDelta(1/60);
				viz1.mult = 1/60;
			}
		}
		else if(this.value == 3){
			viz.setJdDelta(1);
			viz.mult = 1;
			if(viz1 != null){
				viz1.setJdDelta(1);
				viz1.mult = 1;
			}
		}
		else if(this.value == 4){
			viz.setJdDelta(2);
			viz.mult = 2;
			if(viz1 != null){
				viz1.setJdDelta(2);
				viz1.mult = 2;
			}
		}
		else if(this.value == 5){
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
	var tail_slider = document.getElementById("tail-length");
	tail_slider.oninput = function() {
		viz.tail_length = this.value / 100;
		if(viz1 != null){
			viz1.tail_length = this.value / 100;
		}
	}

	// A button that will set the simulation to real time
	document.getElementById("real-time").addEventListener("click", function() {
		viz.setDate(Date.now());
		viz.setJdPerSecond(realTimeRate);
	});

	// A button that starts the simulation
	document.getElementById("start-button").addEventListener("click", function() {
		viz.start();
		if(viz1 != null){
			viz1.start();
		}
	});

	// A button that stops the simulation
	document.getElementById("stop-button").addEventListener("click", function() {
		viz.stop();
		if(viz1 != null){
			viz1.stop();
		}
	});

	// Dropdown that lets the user zoom to a planet
	document.getElementById("submit-button").addEventListener("click", function(){
		let planetZoomChoice = document.getElementById("zoom-dropdown");
		let choiceStr = planetZoomChoice.options[planetZoomChoice.selectedIndex].value;

		viz.getViewer().followObject(visualizer_list[choiceStr] , [0, 0, 0]);
		viz.getViewer().get3jsCamera().zoom = 10;
		viz.getViewer().get3jsCamera().updateProjectionMatrix();
	});


	// Resets the simulation to default state
	document.getElementById("reset-button").addEventListener("click", function(){
		window.location.reload();
	});


	viz.start();

}

// START THE APP
runApp();