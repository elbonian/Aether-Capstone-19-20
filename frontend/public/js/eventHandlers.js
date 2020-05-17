/*
    CU Boulder CS Capstone - NASA/JPL Group (Aether)
    Spring 2020
    Maintainer: Aether


    This file is responsible for handling user input that excersizes the functions in checkboxDropdown.js. It is responsible for:
        1. Handling user input when they click the "Reset" button on the Sim Controls menu
            a. Uses createNewSim() in solarSystem.js
        2. Handling user input when they click the "Compare" button on the Sim Controls menu
            a. Uses createNewSim() in solarSystem.js
        3. Handling user input when they click "Zoom to body" in the right-click context menu in the Visible Bodies dropdown
            a. Uses zoomToBody() in dropdownFunctions.js
        4. Handling user input when they click "Body info" in the right-click context menu in the Visible Bodies dropdown
            a. Uses displayBodyInfo() in dropdownFunctions.js


*/



/////////////////////////////////////////////////
///////////////// EVENT HANDLERS ////////////////
/////////////////////////////////////////////////


/*------------ Simulation reset HTML and handler ------------*/

// Create an HTML form that allows the user to create a new primary simulation
const sim_form = document.getElementById('newSimForm');

/**
    Creates a new simulation with the form data when the user clicks submit
*/
sim_form.addEventListener('submit', function(e){
    e.preventDefault();

    // Get the data the user entered into the fields
    const formData = new FormData(this);

    // Convert the human-readable time into milliseconds past UNIX epoch
    const start_time =  Date.parse(formData.get('jd_start')) ;

    // Ensure each desired body has ephemeris for the desired start time
    const targets = formData.get('targets').split('+');
    for(const body_name of targets){
        if(!canLoadBody(body_name, start_time)){
            // No valid ephemeris for the desired time, print note and do nothing
            alert("Ephemeris for " + body_name + " at " + formData.get('jd_start') + " is unavailable.");
            displayError("CANNOT CREATE SIMULATION. " + body_name + " doesn't have ephemeris for " + formData.get('jd_start'));
            // Prevent simulation from being created
            return;
        }
    }


    /*-------- Simulation can be created --------*/

    // Indicate that simulations are not being compared
    comparing = false;

    // Pause the current simulation(s) if they are playing
    if(togglePlay){
        viz.stop();
        viz = null;
        if(viz1 != null){
            viz1.stop();
            viz1 = null;
        }
        togglePlay = false;
    }

    // Reset global body list for the primary simulation
    visualizer_list = [];

    // Create a new HTML div element
    var div = document.createElement('div');
    
    // Replace old simulation container div with new div
    div.id = 'new-container';
    document.body.replaceChild(div, document.getElementById('main-container'));
    div.id = 'main-container';

    var granularity = default_granularity; // two hours per step
    // See if user entered granularity
    if(formData.get('granularity')){
        // Ensure user entered a number
        if(!isNaN(formData.get('granularity'))){
            granularity = formData.get('granularity');
        }
    }

    // Creates the new simulation from data entered
    var new_viz = createNewSim(formData.get('wrt'), formData.get('targets'), granularity, start_time, [250000 / unitsPerAu, 500000 / unitsPerAu, 500000 / unitsPerAu]);
    
    // Create a new div that will hold the simulation's rate of time
    // TODO: unnecessary?
    var time_div = document.createElement("div");
    time_div.setAttribute("class","sim-time");
    const sim_time = document.createElement("h3");
    sim_time.setAttribute("id", "sim_time");
    const sim_rate = document.createElement("h4");
    sim_rate.setAttribute("id", "sim_rate");
    time_div.appendChild(sim_time);
    time_div.appendChild(sim_rate);
    document.body.replaceChild(time_div, document.getElementById("time-container"));
    time_div.setAttribute("id", "time-container");
    
    // UPDATE GLOBAL REFERENCE TO PRIMARY SIM
    viz = new_viz;
});


/*------------ Simulation comparison HTML and handler ------------*/

// Form for simulation comparison
let compare_form = document.getElementById('comparison-form');

/**
    Creates a split-screen view comparing two simulations
*/
compare_form.addEventListener('submit', function(e){
    e.preventDefault();
    
    // Get the data the user entered into the fields
    const formData = new FormData(this);

    // Convert time entered entered into milliseconds past UNIX epoch
    const start_time1 =  Date.parse(formData.get('jd_start'));
    const start_time2 =  Date.parse(formData.get('jd_start2'));

    // Ensure each desired body for the primary sim has ephemeris for the desired start time
    const targets1 = formData.get('targets').split('+');
    for(const body_name of targets1){
        if(!canLoadBody(body_name, start_time1)){
            // No valid ephemeris for the desired time, print note and do nothing
            alert("Ephemeris for " + body_name + " at " + formData.get('jd_start') + " is unavailable.");
            displayError("CANNOT CREATE SIMULATION. " + body_name + " doesn't have ephemeris for " + formData.get('jd_start'));
            // Prevent simulation from being created
            return;
        }
    }

    // Ensure each desired body for the secondary sim has ephemeris for the desired start time
    const targets2 = formData.get('targets2').split('+');
    for(const body_name of targets2){
        if(!canLoadBody(body_name, start_time2)){
            // No valid ephemeris for the desired time, print note and do nothing
            alert("Ephemeris for " + body_name + " at " + formData.get('jd_start') + " is unavailable.");
            displayError("CANNOT CREATE SIMULATION. " + body_name + " doesn't have ephemeris for " + formData.get('jd_start'));
            // Prevent simulation from being created
            return;
        }
    }

    /*-------- Simulations can be created --------*/

    // Indicate that simulations are being compared
    comparing = true;

    // Pause the current simulation(s) if they are playing
    if(togglePlay){
        viz.stop();
        viz = null;
        if(viz1 != null){
            viz1.stop();
            viz1 = null;
        }
        togglePlay = false;
    }

    // Reset the global variables containing loaded bodies
    visualizer_list = [];
    visualizer_list2 = [];

    // Create new HTML div to act as a container
    var comparison_container = document.createElement('div');
    comparison_container.id = "comparison_container";

    // Create two HTML divs that are 50% of the width of their parent element
    var div1 = document.createElement('div');
    div1.id = "comparison1";
    var div2 = document.createElement('div');
    div2.id = "comparison2";

    // Add the two smaller divs to the main div container
    comparison_container.appendChild(div1);
    comparison_container.appendChild(div2);

    // Replace existing main simulation container with new container
    document.body.replaceChild(comparison_container, document.getElementById('main-container'));
    comparison_container.id = 'main-container';

    var granularity = default_granularity; // two hours per step
    // See if user entered granularity
    if(formData.get('granularity')){
        // Ensure user entered a number
        if(!isNaN(formData.get('granularity'))){
            granularity = formData.get('granularity');
        }
    }
    
    // Create two new simulations that will be compared side by side
    var new_viz1 = createNewSim(formData.get('wrt'), formData.get('targets'), granularity, start_time1, [250000 / unitsPerAu, 500000 / unitsPerAu, 500000 / unitsPerAu], "comparison1");
    var new_viz2 = createNewSim(formData.get('wrt2'), formData.get('targets2'), granularity, start_time2, [250000 / unitsPerAu, 500000 / unitsPerAu, 500000 / unitsPerAu], "comparison2", false);
    
    // Sync simulation cameras
    // Make the secondary sim's camera point to the primary camera
    new_viz2._camera = new_viz1._camera;

    // UPDATE GLOBAL REFERENCES TO SIMULATIONS
    viz = new_viz1;
    viz1 = new_viz2;

    // Create div that will contain the simulation time(s) and rate(s)
    var time_div = document.createElement("div");
    time_div.setAttribute("class","sim-time");
    time_div.setAttribute("id", "time-container");

    // Check if the times entered for the two simulations are different
    if(start_time1 != start_time2){
        // Must create another time and rate of time divs

        // Create primary simulation time divs
        const left_time = document.createElement("div");
        left_time.setAttribute("class", "left-time");
        const sim_time = document.createElement("h3");
        sim_time.setAttribute("id", "sim_time");
        const sim_rate = document.createElement("h4");
        sim_rate.setAttribute("id", "sim_rate");
        left_time.appendChild(sim_time);
        left_time.appendChild(sim_rate);
        time_div.appendChild(left_time);

        // Create secondary simulation time divs
        const right_time = document.createElement("div");
        right_time.setAttribute("class", "right-time");
        sim_time1 = document.createElement("h3");
        sim_time1.setAttribute("id", "sim_time");
        sim_rate1 = document.createElement("h4");
        sim_rate1.setAttribute("id", "sim_rate");
        right_time.appendChild(sim_time1);
        right_time.appendChild(sim_rate1);
        time_div.appendChild(right_time);

        // Set the secondary simulation's tick function
        viz1.onTick = tick1;
    }
    else{
        // Times are synched, create only one div
        // TODO: unnecessary?
        const sim_time = document.createElement("h3");
        sim_time.setAttribute("id", "sim_time");
        //sim_time.id = "sim_time";
        const sim_rate = document.createElement("h4");
        sim_rate.setAttribute("id", "sim_rate");
        time_div.appendChild(sim_time);
        time_div.appendChild(sim_rate);
        viz1.onTick = null;
    }

    // Add the time container div to the document
    document.body.replaceChild(time_div, document.getElementById("time-container"));
});


/*------------ Upload SPK HTML and handler ------------*/

// Form to submit a new spk kernel
let form = document.getElementById('myForm');
let form_submit = document.getElementById("submit_SPK");

/**
    Calls API endpoint to upload a kernel
*/
form.addEventListener('submit', function(event){
    event.preventDefault();

    // Get data from the form
    const formData = new FormData(this);
    // Bring up a loading screen
    showLoading();

    // Call API endpoint that will submit the new file
    fetch('http://0.0.0.0:5000/api/spk-upload/' + viz.wrt, {
        method: 'POST',
        body: formData
    })
    .then(response => {
        // Clear the loading screen
        removeLoading();
        // Parse json response
        response.json().then(function(parsedJson) {
            if(response.status === 400){
                // Error, alert the user
                alert(parsedJson.error);
                displayError(parsedJson.error);
                return response;
            }
            else if(response.status === 404){
                // Error, alert the user
                alert("404, Endpoint not found!");
                displayError("404, Endpoint not found!");
                return response;
            }
            else if(response.status === 500){
                // Error, alert the user
                alert("Server Error");
                displayError("Server Error");
                return response;
            }
            else{
                // SUCCESS
                alert("File uploaded successfully!");
                console.log(parsedJson);
                addCheckboxFromUpload(parsedJson);
            }
        });
    })
    .catch(error => {
        console.error(error);
    });

    // Hide form
    this.style.display = "none";
});





// A slider that changes the rate of time for the simulation(s)
// TODO: rename from 'myRange'
var time_slider = document.getElementById("myRange");
time_slider.oninput = function() {
    let speed = Math.floor(this.value / 25) + 1;
    if(speed == 1){
        viz.mult = -1;
        if(viz1 != null){
            viz1.mult = -1;
        }
    }
    else if(speed == 2){
        viz.mult = 1.0/60;
        if(viz1 != null){
            viz1.mult = 1.0/60;
        }
    }
    else if(speed == 3){
        viz.mult = 1;
        if(viz1 != null){
            viz1.mult = 1;
        }
    }
    else if(speed == 4){
        viz.mult = 2;
        if(viz1 != null){
            viz1.mult = 2;
        }
    }
    else if(speed == 5){
        viz.mult = 4;
        if(viz1 != null){
            viz1.mult = 4;
        }
    }
    else{
        viz.mult = 1;
        if(viz1 != null){
            viz1.mult = 1;
        }
    }
}

// A slider that changes the length of the tail of a body
// TODO: rename from "myRange2"
var tail_slider = document.getElementById("myRange2");
tail_slider.oninput = function() {
    viz.tail_length = this.value / 100;
    if(viz1 != null){
        viz1.tail_length = this.value / 100;
    }
}

// Handler for the "Real Time" button
document.getElementById("real_time").addEventListener("click", function() {
    viz.mult = (1 / 86400) / 60 / viz.getJdDelta();
});

// Handler for the button that toggles 'pretty mode'
document.getElementById("pretty_button").addEventListener("click", function() {
    if(stars){
        viz.removeObject(stars);
        if(viz1){
            viz1.removeObject(stars1);
        }
        stars = null;
        stars1 = null;
    }
    else{
        stars = new Spacekit.Stars({}, viz);
        if(viz1){
            stars1 = new Spacekit.Stars({}, viz1);
        }
    }

    //console.log(visualizer_list);

    // if(visualizer_list.Sun){
    //  //console.log("hie?");
    //  if(!viz.isUsingLightSources){

    //  }
    //  else{
    //      viz.createLight(visualizer_list.Sun.position);
    //      //console.log(viz);
    //  }
    // }
    
});

// A handler for the button that toggles the simulation(s) xy grid
document.getElementById("grid_button").addEventListener("click" , function() {
    if(grid_visible){
        viz.hideGrid();
        if(viz1){
            viz1.hideGrid();
        }
        grid_visible = false;
    } else {
        viz.showGrid();
        if(viz1){
            viz1.showGrid();
        }
        grid_visible = true;
    }
});

// Handler for the button that toggles the simulation(s) animation
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

// Handler for the rate-of-time user input field
document.getElementById("input_time_set").addEventListener("click" , function(){
    let input = document.getElementById("input_time").value;
    //This pulls the value input from the time set field

    if(isNaN(input)){
        displayError("Must enter a number");
    }
    else{
        if(input > 20){
            displayError("Rate of time must be no more than 20 days per second");
        }
        else if(input == 0){
            displayError("Rate of time cannot be 0");
        }
        else if(input < -10){
            displayError("Rate of time must be greater than -10 days per second");
        }
        else{
            viz.mult = input / 60 / viz.getJdDelta();
            if(viz1){
                viz1.mult = input / 60 / viz1.getJdDelta();
            }
        }
    }
});

// Handler for the tail-length user input field
document.getElementById("input_length_set").addEventListener("click" , function(){
    let input = document.getElementById("input_length").value;
    //This pulls the value input from the time set field
    
    if(Number.isInteger(input)){
        displayError("Must enter an integer");
    }
    else if(input < 0){
        displayError("Tail length cannot be negative")
    }
    else{
        document.getElementById("myRange2").setAttribute("max", input);
        viz.tail_length = input / 100;
        if(viz1 != null){
            viz1.tail_length = input / 100;
        }
    }
});

// Handler for the "Show body info" option for the right-click context menu
document.getElementById("infoButton").addEventListener("click", function(){
    const bodyName = document.getElementsByClassName("context-menu")[0].id.replace("-context-menu" , "");
    hideContextMenu();
    displayBodyInfo(bodyName);
});

// Handler for the "Zoom to body" option on the right-click context menu
document.getElementById("zoomToBody").addEventListener("click" , function(){
    const bodyName = document.getElementsByClassName("context-menu")[0].id.replace("-context-menu" , "");
    hideContextMenu();
    ZoomToBody(bodyName);
});