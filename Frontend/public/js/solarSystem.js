const viz = new Spacekit.Simulation(document.getElementById('main-container'), {
  basePath: 'https://typpo.github.io/spacekit/src',
  jdPerSecond: .00001157407407407407407407407407407407407,
  startDate: Date.now(),
});

var expanded = false;


let sun = viz.createSphere('sun', {
	//labelText: 'Sun', 
	textureUrl: '/js/textures/2k_sun.jpg',
	position: [0,0,0],
	radius: 0.05
});

let mercury = viz.createSphere('mercury', {
	labelText: 'Mercury',
	textureUrl: '/js/textures/2k_mercury.jpg',
	theme: {
		//color: 0x913cee,
	},
	ephem: Spacekit.EphemPresets.MERCURY,
	radius: 0.03
});

let venus = viz.createSphere('venus', {
	labelText: "Venus",
	textureUrl: '/js/textures/2k_venus_surface.jpg',
	theme:{
		//color: 0x913cee,
	},
	ephem: Spacekit.EphemPresets.VENUS,
	radius: 0.035
});

let earth = viz.createSphere('earth', {
	labelText: "Earth",
	textureUrl: '/js/textures/2k_earth_daymap.jpg',
	theme: {
		//color: 0x913cee,
	},
	ephem: Spacekit.EphemPresets.EARTH,
	radius: 0.035
});

let mars = viz.createSphere('mars', {
	labelText: "Mars",
	textureUrl: '/js/textures/2k_mars.jpg',
	theme:{
		//color: 0x913cee,
	},
	ephem: Spacekit.EphemPresets.MARS,
	radius: 0.03
});

let jupiter = viz.createSphere('jupiter', {
	labelText: "Jupiter",
	textureUrl: '/js/textures/jupiter2_4k.jpg',
	theme:{
		//color: 0x913cee,
	},
	ephem: Spacekit.EphemPresets.JUPITER,
	radius: 0.045
});

let saturn = viz.createSphere('saturn', {
	labelText: "Saturn",
	textureUrl: '/js/textures/2k_saturn.jpg',
	theme:{
		//color: 0x913cee,
	},
	ephem: Spacekit.EphemPresets.SATURN,
	radius: 0.041
});

let uranus = viz.createSphere('uranus', {
	labelText: "Uranus",
	textureUrl: '/js/textures/2k_uranus.jpg',
	theme:{
		//color: 0x913cee,
	},
	ephem: Spacekit.EphemPresets.URANUS,
	radius: 0.039
});

let neptune = viz.createSphere('neptune', {
	labelText: 'Neptune',
	textureUrl: '/js/textures/2k_neptune.jpg',
	theme:{
		//color: 0x913cee,
	},
	ephem: Spacekit.EphemPresets.NEPTUNE,
	radius: 0.039
});

//This is a list of visualized elements in the simulation. They are grouped by name as the key and the object. Simply add an object to this list ("name" : object) to contibute to the simulation.
let visualizer_list = {
	"Sun" : sun, 
	"Mercury" : mercury, 
	"Venus" : venus, 
	"Earth" : earth, 
	"Mars" : mars, 
	"Jupiter" : jupiter, 
	"Saturn" : saturn, 
	"Neptune" : neptune, 
	"Uranus" : uranus
};

viz.setCameraDrift(false);

viz.createStars();

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
	viz.setJdPerSecond(.00001157407407407407407407407407407407407);
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

//async function to get data from API
async function getPositionData(ref_frame, targets, start_date, end_date, steps){
	//returns a promise containing the response from server
	let response = await fetch('http://0.0.0.0:5000/api/positions/' + ref_frame + '/' + targets + '/' + start_date + '/' + end_date + '/' + steps);
	let data = await response.json();
	return data;
}

//Retrieve position data of sun and eight planets with 10000 steps
getPositionData('solar system barycenter', 'sun+mercury+venus+earth+mars+jupiter+saturn+uranus+neptune', '2019-10-10', '2020-10-10', '10000').then(data => {
	console.log(data);
	for(const property in data){
		console.log(property);
		//log position arrays
		console.log(data[property].positions);
		// TODO: use position arrays to change positions of these bodies and show the trajectory
	}
});

