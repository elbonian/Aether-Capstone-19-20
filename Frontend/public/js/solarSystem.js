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

var listPopulated = false;


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
const viz = new Spacekit.Simulation(document.getElementById('main-container'), {
  basePath: 'https://typpo.github.io/spacekit/src',
  jdPerSecond: realTimeRate,
  startDate: Date.now(),
  startPaused: true,
  unitsPerAu: 1.0,
  debug: {
  	showAxes: true,
  	showGrid: true
  }
});

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

var body;

//Retrieve DEFAULT position data of sun and eight planets with 1000 steps
getPositionData('solar system barycenter', 'sun+mercury+venus+earth+mars+jupiter+saturn+uranus+neptune', '2010-02-15', '2020-12-16', '1000').then(data => {

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
		body = viz.createSphere(property, {
			labelText: bodyName,
			textureUrl: body_textures[property],
			position: allAdjustedVals[index],
			radius: 0.15,
			particleSize: -1,
			rotation: true
		});

		// console.log(viz.getJd());
		// console.log(allAdjustedTimes[index]);
		// console.log(viz.getDate());

		// Update global variables
		visualizer_list[bodyName] = body;
		adjusted_positions[bodyName] = allAdjustedVals;
		adjusted_times[bodyName] = allAdjustedTimes;
	}
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
// function tick(){

// 	var dif = adjusted_times[]
// 	for(body of Object.value(visualizer_list)){

// 	}
// 	//console.log(default_data.prototypes);
// }

//viz.onTick = tick;


var expanded = false;

viz.setCameraDrift(false);

viz.createStars();

//This loop adds checkbox elements for each visualized object. This allowed for every visualized element to be togglable. It also adds an event listener for each element to toggle each object.

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
	if(!listPopulated){
		for(let i of Object.keys(visualizer_list)){
			console.log(i);
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
	}
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