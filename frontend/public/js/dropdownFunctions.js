/*
    CU Boulder CS Capstone - NASA/JPL Group (Aether)
    Spring 2020
    Maintainer: Aether


    This file contains functions that operate on and maintain the dynamic checkbox dropdown in the Available Bodies menu. They have the following functionality:
    It also contains user-initiated functionality that operates on the simulation(s) that are managed in solarSystem.js:
        1. Maintaining the checkbox items
        2. Maintaining the dropdown items
        3. Maintaining the right-click context menu and its functionality


    NOTE:
        These functions are used by HTML event handlers in eventHandlers.js
*/



/////////////////////////////////////////////////
/////////////// CHECKBOX FUNCTIONS //////////////
/////////////////////////////////////////////////

/**
    Changes visibility of a body when the clickbox is clicked
    @param {string} checkboxId - HTML id of clicked checkbox
    @param {string} bodyName - Name of body for which checkbox was clicked
*/
function handleCheckboxClick(checkboxId, bodyName){
    let checked = document.getElementById(checkboxId).checked;
    let label = null;
    let objs = null;
    if(visualizer_list[bodyName]){
        label = visualizer_list[bodyName]._label;
        objs = visualizer_list[bodyName].get3jsObjects();
    }
    let label2 = null;
    let objs2 = null;
    if(visualizer_list2[bodyName]){
        label2 = visualizer_list2[bodyName]._label;
        objs2 = visualizer_list2[bodyName].get3jsObjects();

    }
    if(!checked){
        if(label != null){
            visualizer_list[bodyName].setLabelVisibility(false);
        }
        if(label2 != null){
            visualizer_list2[bodyName].setLabelVisibility(false);
        }
        if(visualizer_list[bodyName]){
            visualizer_list[bodyName].material.opacity = 0;
            visualizer_list[bodyName].material.transparent = true;
            visualizer_list[bodyName].material.needsUpdate = true;
            objs[0].visible = false;
        }
        if(viz1 != null && visualizer_list2[bodyName]){
            visualizer_list2[bodyName].material.opacity = 0;
            visualizer_list2[bodyName].material.transparent = true;
            visualizer_list2[bodyName].material.needsUpdate = true;
            objs2[0].visible = false;
        }
        if(visualizer_list[bodyName]){
            visualizer_list[bodyName].hidden = true;
        }
        if(visualizer_list2[bodyName]){
            visualizer_list2[bodyName].hidden = true;
        }
    } else {
        if(label != null){
            visualizer_list[bodyName].setLabelVisibility(true);
        }
        if(label2 != null){
            visualizer_list2[bodyName].setLabelVisibility(true);
        }
        if(visualizer_list[bodyName]){
            visualizer_list[bodyName].material.opacity = 1;
            visualizer_list[bodyName].material.transparent = false;
            visualizer_list[bodyName].material.needsUpdate = true;
            objs[0].visible = true;
        }
        if(viz1 != null && visualizer_list2[bodyName]){
            visualizer_list2[bodyName].material.opacity = 1;
            visualizer_list2[bodyName].material.transparent = false;
            visualizer_list2[bodyName].material.needsUpdate = true;
            objs2[0].visible = true;
        }
        if(visualizer_list[bodyName] && visualizer_list[bodyName].hidden === true){
            viz.getScene().add(visualizer_list[bodyName].line);
        }
        if(visualizer_list2[bodyName] && visualizer_list2[bodyName].hidden === true){
            viz1.getScene().add(visualizer_list2[bodyName].line);
        }
        if(visualizer_list[bodyName]){
            visualizer_list[bodyName].hidden = false;
        }
        if(visualizer_list2[bodyName]){
            visualizer_list2[bodyName].hidden = false;
        }
    }
}

/**
    Initialized checkbox dropdown with boxes enabled for elements in the sim
*/
function initCheckboxes(){
    let checkboxes = document.getElementById("content1").getElementsByTagName('input');
    let planetKeys = Object.keys(visualizer_list);
    let planetKeys2 = Object.keys(visualizer_list2);
    for(let x = 0; x < checkboxes.length; x++){
        let checkbox = checkboxes[x];
        let checkBoxId = checkboxes[x].id;
        let checkBoxBody = checkboxes[x].id.split("-")[0];
        if(planetKeys.includes(checkBoxBody)){
            if(visualizer_list[checkBoxBody].hidden === true){
                checkbox.checked = false;
            }
            else {
                checkbox.checked = true;
            }
            //checkbox.checked = true;
            checkbox.removeAttribute("disabled");
            checkbox.removeAttribute("class");
            let bodyLabel = document.getElementById(checkBoxBody + "-label1");
            bodyLabel.removeAttribute("class");
        }
        else{
            checkbox.disabled = true;
        }
    }
    if(comparing){
        for(let x = 0; x < checkboxes.length; x++){
            let checkbox = checkboxes[x];
            let checkBoxId = checkboxes[x].id;
            let checkBoxBody = checkboxes[x].id.split("-")[0];
            if(planetKeys2.includes(checkBoxBody)){
                checkbox.checked = true;
                // if(visualizer_list[checkBoxBody].hidden === true){
                //     checkbox.checked = false;
                // }
                // else {
                //     checkbox.checked = true;
                // }
                checkbox.removeAttribute("disabled");
                checkbox.removeAttribute("class");
                let bodyLabel = document.getElementById(checkBoxBody + "-label1");
                bodyLabel.removeAttribute("class");
            }
        }
    }
    addPlusToCheckboxes();
}

/**
    Add a clicked plus sign of a body to the current sim
    @param {string} bodyName - name of body to add to the sim
*/
function addClickedBody(bodyName){
    let lowerName =  bodyName.charAt(0).toLowerCase() + bodyName.slice(1);
    const body_data = body_meta_data.find(x => x["body name"] === lowerName);
    const validTimes = body_data["valid times"];
    let currSimDate = viz.getDate();
    for(let index in validTimes){
        let date1 = new Date(validTimes[index][0]);
        let date2 = new Date(validTimes[index][1]);
        if(date1 > currSimDate || currSimDate > date2){
            alert("Simulation time not valid to display " + bodyName);
            displayError("Simulation time not valid to display " + bodyName);
            return;
        }
    }
    getPositionData(viz.wrt, lowerName, viz.getJd().toString(), viz.getJdDelta(), (viz.getJdDelta()*60*10*4).toString(), "20").then(data => {createBodiesFromData(data, viz, true)}).catch(error => {
        removeLoading();
        console.error(error);
    });
        
    let plus = document.getElementById(lowerName.charAt(0).toUpperCase() + lowerName.slice(1) + "-plus");
    plus.remove(); 
}

/**
    Add plus sign to add elements not in current sim
*/
function addPlusToCheckboxes(){
    if(!comparing){
        let checkboxes = document.getElementById("content1").getElementsByTagName('input');
        for(let x = 0; x < checkboxes.length; x++){
            if(checkboxes[x].disabled){

                let checkboxName = checkboxes[x].id.split("-")[0];

                // CHECK IF BODY NAME CONTAINS A "-", if so ensure the checkbox name isn't stripped of its "-" character
                if(checkboxes[x].id.split("-")[2]){
                    checkboxName = "-" + checkboxes[x].id.split("-")[1];
                }
                
                //check to see if plus exists so we dont add it again
                if(document.getElementById(checkboxName + "-plus")){
                    return;
                }
                let labelId = checkboxName + "-label1";
                let addButton = document.createElement("i");
                addButton.setAttribute("class", "plus");
                addButton.setAttribute("id", checkboxName + "-plus");
                addButton.setAttribute("name", checkboxName);
                addButton.setAttribute("value", checkboxName);
                addButton.addEventListener("click", function(){
                    if(!visualizer_list[checkboxName]){
                        if(togglePlay){
                            viz.stop();
                            togglePlay = false;
                        }
                        addClickedBody(checkboxName);
                    }
                });
                let bodyLabel = document.getElementById(labelId);
                bodyLabel.appendChild(addButton);
            }
        }
    }
}

/**
    Hides the right-click menu in the bodies menu
*/
function hideContextMenu() {
    let contextMenu = document.getElementsByClassName("context-menu")[0];
    contextMenu.style.display = "none";
}


/**
    Creates a child elements in nested checkbox for bodies
    @param {string} name - Name of the body
    @param {array} sublist - List of bodies that are 'sub-bodies' of the added body e.g Earth -> Moon
    @return {documentElement} li_element - New dropdown element
*/
function createSubElements(lower_name, sublist){

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
    
    var planet_label = document.createElement("label");
    var arrownIcon = document.createElement("i");
    arrownIcon.setAttribute("class", "arrow down");
    planet_label.setAttribute("id", name + "-label");
    planet_label.setAttribute("value", name);
    planet_label.innerHTML = name;
    planet_label.appendChild(arrownIcon);
    var br = document.createElement("br");
    
    // Add input and label to innermost div
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
        for(const i of sublist.values()){
            const upper_name = capitalizeFirstLetter(i);
            // Create an inner div
            var inner_nested_div = document.createElement("div");
            inner_nested_div.setAttribute("id", upper_name);
            inner_nested_div.setAttribute("class", "checkbox_and_label");

            // Add inner nested div to outer nested div
            nested_div.appendChild(inner_nested_div);

            // Create an input and label
            var inner_input = document.createElement("input");
            inner_input.setAttribute("id", upper_name + "-body");
            inner_input.setAttribute("type", "checkbox");
            inner_input.setAttribute("disabled", "disabled");
            inner_input.setAttribute("class", "readonly");
            inner_input.setAttribute("name", upper_name + "-body");
            inner_input.setAttribute("value", upper_name);
            inner_input.setAttribute("onClick" , "handleCheckboxClick(id, value)");

            var inner_label = document.createElement("label");
            inner_label.setAttribute("for", upper_name + "-body");
            inner_label.setAttribute("class", "readonlylabel");
            inner_label.setAttribute("id", upper_name + "-label1");
            inner_label.innerHTML = upper_name;
            var br1 = document.createElement("br");

            // Add input and label to inner nested div
            inner_nested_div.appendChild(inner_input);
            inner_nested_div.appendChild(inner_label);
            inner_nested_div.appendChild(br1);
        }
        
        planet_label.addEventListener("click", function() {
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

/**
    Adds a new checkbox for bodies within uploaded file
    @param {Object} newData - Body data from uploaded bsp file
*/
function addCheckboxFromUpload(newData){
    for(let index in newData){
        const need_to_add = visualizer_list[newData[index]["body_name"]];
        let catergory = newData[index]["category"];
        catergory = capitalizeFirstLetter(catergory);
        let nested_div = document.getElementById("nested" + catergory);
        if(nested_div == null){
            let name = capitalizeFirstLetter(newData[index]["body name"]);
            nested_div = document.createElement("div");
            nested_div.setAttribute("id", "nested" + name);
            nested_div.setAttribute("style", "display:none");
            nested_div.setAttribute("class", "nested_list");
            let planet_box_div = document.getElementById(catergory + "-box");
            planet_box_div.appendChild(nested_div);
            let planet_label = document.getElementById(catergory + "-label");
            planet_label.addEventListener("click", function() {
                if(nested_div.getAttribute("style") == "display:none"){
                    nested_div.setAttribute("style", "display:content");
                }
                else{
                    nested_div.setAttribute("style", "display:none");
                }
            });
        }
        let upper_name = capitalizeFirstLetter(newData[index]["body name"]);
        let inner_nested_div = document.createElement("div");
        inner_nested_div.setAttribute("id", upper_name);
        inner_nested_div.setAttribute("class", "checkbox_and_label");
        nested_div.appendChild(inner_nested_div);
        // Create an input and label
        let inner_input = document.createElement("input");
        inner_input.setAttribute("id", upper_name + "-body");
        inner_input.setAttribute("type", "checkbox");
        inner_input.setAttribute("disabled", "disabled");
        inner_input.setAttribute("class", "readonly");
        inner_input.setAttribute("name", upper_name + "-body");
        inner_input.setAttribute("value", upper_name);
        inner_input.setAttribute("onClick" , "handleCheckboxClick(id, value)");

        let inner_label = document.createElement("label");
        inner_label.setAttribute("for", upper_name + "-body");
        inner_label.setAttribute("class", "readonlylabel");
        inner_label.setAttribute("id", upper_name + "-label1");
        inner_label.innerHTML = upper_name;
        let br1 = document.createElement("br");

        // Add input and label to inner nested div
        inner_nested_div.appendChild(inner_input);
        inner_nested_div.appendChild(inner_label);
        inner_nested_div.appendChild(br1);
        let addButton = document.createElement("i");
        addButton.setAttribute("class", "plus");
        addButton.setAttribute("id", upper_name + "-plus");
        addButton.setAttribute("name", upper_name);
        addButton.setAttribute("value", upper_name);
        addButton.addEventListener("click", function(){
            if(!visualizer_list[upper_name]){
                if(togglePlay){
                    viz.stop();
                    togglePlay = false;
                }
                addClickedBody(upper_name);
            }
        });
        inner_label.appendChild(addButton);
        body_meta_data.push(newData[index]);


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
    }
}

/*
    Updates the dropdown checklist items grayed-out status, checked status. Updates the body_meta_data global variable
*/
function updateBodyChecklist(data){
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
        categories[data[index]["category"]].add(data[index]["body name"]);
    }

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

    // SET GLOBAL VARIABLE FOR BODY METADATA
    // i.e. body name, category, has radius data, has rotation data, is user-uploaded, spice id, range(s) of valid ephemeris times
    body_meta_data = data;
}


/*
    Displays the info panel for a given body
    @param {string} name - The name of the body that you would like to display information for
*/
function displayBodyInfo(name){
    let info_panel = document.getElementById("info_panel1");
    let body = body_meta_data.find( x => x["body name"] === name.toLowerCase());
    //console.log(body);
    if(body == undefined) return;
    //if(!body["is uploaded"]) return;
    info_panel.style.display = "block";

    //remove the children
    let children = info_panel.children;
    while(children.length != 0) children.item(0).remove();

    //Give it a title
    let title = document.createElement("H1");
    title.innerText = name;
    info_panel.appendChild(title);

    if(body["has mass data"]){
        let mass = body["mass"].toExponential(3);
        let massE = document.createElement("H4");
        massE.innerText = "Mass: " + mass + " Kg";
        info_panel.appendChild(massE);
    }

    //Check for radius info, then print
    if(body["has radius data"]){
            //Display the Equatorial radius in Km
        let radius = body.radius[0].toExponential(3);
        let radiusE = document.createElement("H4");
        radiusE.innerText = "Equatorial Radius: " + radius + " Km";
        info_panel.appendChild(radiusE);

        //Display the polar radius in Km
        let pradius = body.radius[2].toExponential(3);
        let pradiusE = document.createElement("H4");
        pradiusE.innerText = "Polar Radius: " + pradius + " Km";
        info_panel.appendChild(pradiusE);
    }

    //Display valid time range
    let time_range = body["valid times"];
    let time_rangeE = document.createElement("H4");
    let start_time = time_range[0][0].split(".");
    let end_time = time_range[0][1].split(".");
    time_rangeE.innerText = "Start Time: " + start_time[0] + "\n\nEnd Time: " + end_time[0];
    info_panel.appendChild(time_rangeE);
    
    let closebtn = document.createElement("button");
    closebtn.id = "info_close";
    closebtn.innerText = "\x2D";
    closebtn.style.display = "block";
    closebtn.title = "close";
    closebtn.addEventListener("click", function() {
        document.getElementById("info_panel1").style.display = "none";
    })
    info_panel.appendChild(closebtn);
}

/**
    Moves the primary camera to the position of a particular body
    @param {string} - The name of a body
*/
function ZoomToBody(body){
    viz.getViewer().get3jsCameraControls().reset();
    viz.getViewer().followObject(visualizer_list[body] , [0, 0, 0]);
    viz.getViewer().get3jsCamera().position.set(0,0,(unitsPerAu / 150));//visualizer_list[body]._obj.position.x, visualizer_list[body]._obj.position.y, visualizer_list[body]._obj.position.z);
    viz.getViewer().get3jsCameraControls().update();
    viz.tuneCameraControls(0.75, 1, 2, 14);
}