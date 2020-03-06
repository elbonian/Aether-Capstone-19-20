/*
	Custom simulation object to allow for creation of AetherObjects
	Inherits: Simulation
*/

class AetherSimulation extends Spacekit.Simulation {
	constructor(simulationElt, options) {
        super(simulationElt, options);
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
}

/*
	Custom AetherObject that changes some parameters for SphereObject
	Inherits: SphereObject
*/
class AetherObject extends Spacekit.SphereObject {
	//constructor adds position and index variables
    constructor(id, options, contextOrSimulation) {
		super(id, options, contextOrSimulation, false);
		this.updateIndex = 0;
		this.currPos = [0,0,0];
		this.newPos = [0,0,0];
		this.positionData = [];
		this.lines = [];
		this.points = [];
		this.geometry = null;
		this.material = null;
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
		  //Object.defineProperty( material, 'needsUpdate', {
			//value: true,
  			//writable: true
			//} );
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
		
        super.init();
	  }

	  /*
		  Sets class position variable
		  @param adjusted_positions Position data from API
	  */
	  setPositionData(adjusted_positions){
		  this.positionData = adjusted_positions;
		  console.log(adjusted_positions);
		  this.currPos = this.positionData[0];
	  }
	  
	  /*
		  Returns current position for a body
		  @return this.currPos current position of body
	  */
	  getCurrPos(){
		  console.log(this.currPos);
		  return this.currPos;
	  }

	  /*
		  Sets next position of where body will be and updates index
	  */
	  setCurrPos(){
		  this.updateIndex++;
		  this.currPos = this.positionData[this.updateIndex];
	  }

	  drawLineSegment(){
			this.geometry = new THREE.Geometry();
			this.material = new THREE.LineBasicMaterial({color: new THREE.Color(0x6495ED)});
			//this.geometry.vertices.needsUpdate = true;
			Object.defineProperty( this.material, 'needsUpdate', {
				value: true,
				writable: true
			} );
			const pos = this.getCurrPos();
			const vector = new THREE.Vector3(pos[0], pos[1], pos[2]);
			this.points.push(vector);
			this.geometry.vertices = this.points;
			let line = new THREE.Line(
				this.geometry,
				this.material,
			);
			this.lines.push(line);
			let scene = viz.getScene();
			scene.add(line);
	  }

	  /*
		  Updates the position of the body according to postionData
		  TODO: Make bodies move according to correct time
		  TODO: Bodies stop moving at the end of position array and app freazes
	  */
      update(jd){
		const newpos = this.getCurrPos();
		console.log(newpos);
		this._obj.position.set(newpos[0], newpos[1], newpos[2]);
		this.drawLineSegment();
		this.setCurrPos();
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
  jdPerSecond: realTimeRate,
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


let camera = viz.getContext().objects.camera.get3jsCamera();
console.log(camera);
//viz.getContext().objects.camera.get3jsCamera().far = 400;
//viz.getContext().objects.camera.get3jsCamera().fov = 50;
//viz.getContext().objects.camera.get3jsCamera().updateProjectionMatrix();

//viz.renderOnlyInViewport();

//async function to get data from API
async function getPositionData(ref_frame, targets, start_date, end_date, steps){
	//returns a promise containing the response from server
	let response = await fetch('http://0.0.0.0:5000/api/positions/' + ref_frame + '/' + targets + '/' + start_date + '/' + end_date + '/' + steps);
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
	"neptune" : '/js/textures/2k_neptune.jpg'
};


function renderPointData(adjusted_positions, adjusted_times){
	//console.log(adjusted_positions)
	const points = [];
	let lines = [];
	for(const property in adjusted_positions){
		//visualizer_list[property].update();
		//console.log(property);
		
		for(let time = 0; time < adjusted_positions[property].length; time++){
			//visualizer_list[property].setPosition(adjusted_positions[property][time][0], adjusted_positions[property][time][1], adjusted_positions[property][time][2]);
			//console.log(adjusted_positions[property][time]);
			const vector = new THREE.Vector3(adjusted_positions[property][time][0], adjusted_positions[property][time][1], adjusted_positions[property][time][2]);
			points.push(vector);
			if(time != 0 && time != adjusted_times[property].length-1){
				points.push(vector);
			}
			
			//visualizer_list[property].update(adjusted_times[property][time]);
		}
		const pts = new THREE.Geometry();
		pts.vertices = points;
		console.log(pts)
		
		//points.vertices.forEach(vertex => {
		//geometry.vertices.push(vertex);
		//geometry.vertices.push(new THREE.Vector3(vertex.x, vertex.y, 0));
		//});
	
		//lines.push(new THREE.LineSegments(
		//geometry,
		//new THREE.LineBasicMaterial({
		//	color: 0x333333,
		//}),
		//THREE.LineStrip,
		//));
		
		let material = new THREE.LineBasicMaterial({color: new THREE.Color(0x6495ED)});
		Object.defineProperty( material, 'needsUpdate', {
			value: true,
  			writable: true
		} );
		//material.side = THREE.DoubleSide;
		console.log(material);
		lines.push(new THREE.LineSegments(
			pts,
			material,
		));
		//pts.computeBoundingSphere();
	}

	let scene = viz.getScene();
	//const pts = new THREE.Geometry();
	//console.log(viz._renderer.properties);
	//lines[0].geometry.attributes.position.needsUpdate = false;
	for(let i = 0; i < lines.length; i++){
		lines[i].material.needsUpdate = true;
		//lines[i].frustumCulled = false;
		//viz.getContext().objects.camera.get3jsCamera().add(lines[i]);
		//console.log(viz.getContext().objects.camera.get3jsCamera());
		scene.add(lines[i]);
		//lines[i].geometry.computeBoundingSphere();
		console.log(lines[i]);
	}

	//lines[0].material.needsUpdate = true;
	//console.log(lines[0].material.needsUpdate);
	//console.log(lines[0]);
	//scene.add(lines[0]);
	console.log(lines);
	console.log(scene);
	//for(let time = 0; time < adjusted_times.length; time++){
		//const vector = new THREE.vector()
	//}
}

//Retrieve DEFAULT position data of sun and eight planets with 1000 steps
getPositionData('solar system barycenter', 'sun+mercury+venus+earth+mars+jupiter+saturn+uranus+neptune', '2010-02-15', '2020-12-16', '2000').then(data => {

	// iterate over each body returned by the API call
	for(const property in data){
		// Array of [x,y,z] coords in AU
		var allAdjustedVals = [];
		// Array of Julian Dates corresponding to each position
		var allAdjustedTimes = [];
		// Current Julian Date
		var cur_jd = viz.getJd();

		// iterate over the data for the current body
		var index = -1;
		var min_dif = 9999999999999;
		var i = 0;
		for(pos of data[property].positions){
			// convert coordinates in km to au
			adjustedVals = pos.map(Spacekit.kmToAu);
			// convert coords to ecliptic
			adjustedVals2 = Spacekit.equatorialToEcliptic_Cartesian(adjustedVals[0], adjustedVals[1], adjustedVals[2], Spacekit.getObliquity());
			allAdjustedVals.push(adjustedVals2);

			// Convert time returned by API call (seconds past J2000 epoch) to Julian Date
			result_time = (data[property].times[i] /  secondsPerDay) + j2000;
			allAdjustedTimes.push(result_time);

			// check if Julian Date is closest to the current viz date
			var dif = Math.abs(result_time - cur_jd);
			if(dif <= min_dif){
				min_dif = dif;
				index = i;
			}
			i = i + 1;
		}

		// TODO: use position arrays to change positions of these bodies and show the trajectory
		
		//console.log(property);
		//console.log(allAdjustedVals[index]);
		
		// Create object
		var bodyName = capitalizeFirstLetter(property)
		var radius;
		if(bodyName == "Sun"){
			radius = 0.20;
		}
		else{
			radius = .10;
		}
		let body = viz.createAetherObject(property, {
			labelText: bodyName,
			textureUrl: body_textures[property],
			position: allAdjustedVals[index],
			radius: radius,
			particleSize: -1,
			rotation: true,
			hideOrbit: true,
			levelsOfDetail: [{
				threshold: 0,
				segments: 40,
			}]
		});
		body.setPositionData(allAdjustedVals);
		console.log(body);

		// console.log(viz.getJd());
		// console.log(allAdjustedTimes[index]);
		// console.log(viz.getDate());
		console.log(bodyName);
		// Update global variables
		visualizer_list[bodyName] = body;
		adjusted_positions[bodyName] = allAdjustedVals;
		//body.setPositionData(allAdjustedVals);
		adjusted_times[bodyName] = allAdjustedTimes;
	}
	//const scene - viz.getScene();
	//renderPointData(adjusted_positions, adjusted_times);
	//console.log(bodyName);
	//console.log(visualizer_list[bodyName].get3jsObjects());
	
	for(const property in visualizer_list){
		//console.log(property);
		for(let i = 0; i < adjusted_times[property].length; i++){
			//console.log(adjusted_times[property][i]);
			//visualizer_list[bodyName].update(adjusted_times[property][i]);
		}
	}
	/*
	viz.createSphere("nothin", {
		position: [-50000,-500000,-500000],
		radius: .01,
		particleSize: 1,

	});
	*/
});



/////////////////////////////////
/// Potential pos update code ///
/////////////////////////////////

// function updatePos(bodyname, position){
// 	visualizer_list[bodyName].setPosition(position);
// 	console.log(visualizer_list[bodyName].getPosition());
// }

// function closestTime(jd, index, times){
// 	return jd > viz.getJd();
// }

// var startDate = viz.getJd();

// var cur_index = 0;
function tick(){
	for(object of viz.getScene().children){
		if(object.hasOwnProperty("geometry")){
			//console.log(object);
			object.geometry.computeBoundingSphere();
		}
	}
}

//viz.onTick = tick;


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

var slider = document.getElementById("time-rate");
slider.oninput = function() {
	viz.setJdPerSecond(this.value);
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
	console.log(event);
	var viewer = viz.getViewer();
	viewer.update();
}

document.querySelectorAll('.vis-controls__set-date').forEach(
       function(elt){elt.onclick=function(){viz.setDate(
               new Date(prompt('Enter a date in the format YYYY-mm-dd.','2000-01-01')));};});
		   