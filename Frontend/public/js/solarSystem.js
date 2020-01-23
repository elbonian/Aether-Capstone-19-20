
const viz = new Spacekit.Simulation(document.getElementById('main-container'), {
  basePath: 'https://typpo.github.io/spacekit/src',
});

viz.createStars();

const sun = viz.createSphere('sun', {
	//labelText: 'Sun', 
	textureUrl: '/js/textures/2k_sun.jpg',
	position: [0,0,0],
	radius: 0.05
});

const mercury = viz.createSphere('mercury', {
	labelText: 'Mercury',
	textureUrl: '/js/textures/2k_mercury.jpg',
	theme: {
		//color: 0x913cee,
	},
	ephem: Spacekit.EphemPresets.MERCURY,
	radius: 0.03
});


const venus = viz.createSphere('venus', {
	labelText: "Venus",
	textureUrl: '/js/textures/2k_venus_surface.jpg',
	theme:{
		//color: 0x913cee,
	},
	ephem: Spacekit.EphemPresets.VENUS,
	radius: 0.035
});

const earth = viz.createSphere('earth', {
	labelText: "Earth",
	textureUrl: '/js/textures/2k_earth_daymap.jpg',
	theme: {
		//color: 0x913cee,
	},
	ephem: Spacekit.EphemPresets.EARTH,
	radius: 0.035
});

const mars = viz.createSphere('mars', {
	labelText: "Mars",
	textureUrl: '/js/textures/2k_mars.jpg',
	theme:{
		//color: 0x913cee,
	},
	ephem: Spacekit.EphemPresets.MARS,
	radius: 0.03
});

const jupiter = viz.createSphere('jupiter', {
	labelText: "Jupiter",
	textureUrl: '/js/textures/jupiter2_4k.jpg',
	theme:{
		//color: 0x913cee,
	},
	ephem: Spacekit.EphemPresets.JUPITER,
	radius: 0.045
});

const saturn = viz.createSphere('saturn', {
	labelText: "Saturn",
	textureUrl: '/js/textures/2k_saturn.jpg',
	theme:{
		//color: 0x913cee,
	},
	ephem: Spacekit.EphemPresets.SATURN,
	radius: 0.041
});

const uranus = viz.createSphere('uranus', {
	labelText: "Uranus",
	textureUrl: '/js/textures/2k_uranus.jpg',
	theme:{
		//color: 0x913cee,
	},
	ephem: Spacekit.EphemPresets.URANUS,
	radius: 0.039
});

const neptune = viz.createSphere('neptune', {
	labelText: 'Neptune',
	textureUrl: '/js/textures/2k_neptune.jpg',
	theme:{
		//color: 0x913cee,
	},
	ephem: Spacekit.EphemPresets.NEPTUNE,
	radius: 0.039
});

//viz.zoomToFit(sun);

viz.setCameraDrift(true);

document.addEventListener('mousedown', onDocumentMouseDown, false );

document.getElementById("start-button").addEventListener("click", function() {
	viz.start();
});

document.getElementById("stop-button").addEventListener("click", function() {
	viz.stop();
});

document.getElementById("submit-button").addEventListener("click", function(){
	let planetZoomChoice = document.getElementById("zoom-dropdown");
	let choiceStr = planetZoomChoice.options[planetZoomChoice.selectedIndex].value;
	console.log(choiceStr);
	switch(choiceStr){
		case "Sun":
			console.log(choiceStr);
			viz.zoomToFit(sun);
		case "Mercury":
			viz.zoomToFit(mercury);
		case "Venus":
			viz.zoomToFit(venus);
		case "Earth":
			viz.zoomToFit(earth);
		case "Mars":
			viz.zoomToFit(mars);
		case "Jupiter":
			viz.zoomToFit(jupiter);
		case "Saturn":
			viz.zoomToFit(saturn);
		case "Neptune":
			viz.zoomToFit(neptune);
		case "Uranus":
			viz.zoomToFit(uranus);
	}
});

function onDocumentMouseDown(event) {
	console.log(event);
	var viewer = viz.getViewer();
	viewer.update();
}