# Aether-Capstone-19-20
This repository is for the 2019-2020 CU Boulder Computer Science Capstone project sponsored by NASA/JPL.

## About Aether
Aether is an interactive 3D rendition of the solar system which runs inside your web browser. 
Aether is built using the SPICE system from JPL/NAIF, allowing it to visualize object trajectories 
over time with high scientific accuracy. In addition, it also visualizes the rotations and radii of 
major celestial bodies.

The motivation behind our project is to give NASA mission designers an easy way to visualize and 
compare the trajectories of different celestial bodies and spacecraft. Therefore, Aether’s core 
design is centered around flexibility and extensibility. Users may create custom simulations with 
any origin (e.g Solar System Barycenter, Pluto Barycenter, Mars, etc.) In addition, users may upload 
new binary SPK kernels to Aether, allowing for custom trajectories to be visualized.

Aether has two main components, the backend and frontend. The backend consists of a REST 
server which provides data (positions for trajectories, mass/radii, rotation equations, etc. from 
SPICE kernels) to the frontend for visualization. The frontend consists of a web-based 3D visualization 
written in Javascript using the Spacekit.js and THREE.js frameworks.

## Recommended System Requirements
- At least 4 GB free space on the filesystem (default SPICE kernel set is ~3 GB)
- 8 GB RAM (recommended)
- Dedicated GPU (highly recommended for smooth frame-rate, but not required)

## Installation
To install Aether on your computer, first clone the repository or obtain an archive of the source 
code.

### Backend Dependencies
Installation of the backend requires the docker commandline interface. Installing docker depends on 
your OS. 

_Note that docker requires virtualization is enabled within the BIOS._

#### Installing Docker

##### Debian/Ubuntu
On Debian-based Linux distros, docker can be easily installed via `apt`. Run the following commands 
to install it...

    sudo apt install docker.io
    sudo systemctl start docker
    sudo systemctl enable docker
    
This installs docker and enables the docker daemon so that it runs by default.

##### Windows, Mac, other Linux distributions 

For Windows and Mac, Docker Desktop may be installed by following the provided instructions 
[here](https://docs.docker.com/engine/install/).

For non-Debian-based Linux distros, docker provides package files for installation, which can 
be found [here](https://docs.docker.com/engine/install/).

### Frontend Dependencies
Installing the frontend requires both `node` and `npm` to be installed first.

#### Installing Node.js and Node package manager
To install Node.js and npm on both Windows and Mac, download the installer 
[here](https://nodejs.org/en/download/)

For Linux, install Node.js and npm via snap or a package manager. Instructions can be found 
[here](https://nodejs.org/en/download/package-manager/).


**LINUX AND MAC USERS, READ THIS:**

**The rest of the installation has been automated. Run `install.sh` in your 
terminal to automatically build the backend docker image, create the docker container and 
install required Node.js packages. After running this script, skip to "Running the Application" 
below.**

**WINDOWS USERS, we're sorry but you'll have to do this manually. Please follow the instructions in 
the next two sections.**

#### Building the Docker Image and Container
Once docker has been installed on your machine, open a terminal and navigate to the 
`Aether-Capstone-19-20` directory. Run the following commands to build the backend docker image...

    cd backend/
    sudo docker build -t aether-backend:v1 .

_Note: Building the docker image may take ~15 minutes depending on your internet speed. This is 
because the docker must download approximately 3 GB of SPICE kernels from JPL/NAIF._

After the image is finished being built, run the following command to create the container...

    sudo docker create -it --name="Aether-Backend" -p 5000:5000 aether-backend:v1

#### Installing Frontend Node Packages
Once Node.js and npm are installed on your computer, once again open a terminal and navigate to 
the `Aether-Capstone-19-20` directory. Run the following commands to install the frontend 
dependencies...

    cd frontend/
    npm install

    
## Running the Application
**LINUX AND MAC USERS, READ THIS:**

**Running the application has been automated. Run `run.sh` in your terminal to start the 
application, then connect to localhost:8080 from your web browser.**

**WINDOWS USERS, the application must be run manually, please continue reading this section**

### Start the backend
To run the backend, use the following command to star the docker container you built 
previously...

    sudo docker start Aether-Backend

### Start the frontend
From the `Aether-Capstone-19-20` directory, run the following command to start the frontend...

    node frontend/server.js
    
Now that both the backend and frontend are both running, connect to localhost:8080 from your web 
browser.

### Stopping the application
To stop the backend docker container, run the following command...

    sudo docker stop Aether-Backend
    
To stop the Node.js web server, simply use `Ctrl+C` from the terminal where the Node server is 
running.

### Aside - backend debug mode
If you wish to view a log of API requests or modify files on the container, read on.
Perform actions in this section at your own risk, modifying files within the backend container 
may break the application. A familiarity with docker is strongly recommended for debugging.

To view the current log of API requests within the backend, run the following command from a 
separate terminal...

    sudo docker attach Aether-Backend

To modify files on the backend, you must rebuild the image and container after modifying the files 
locally. See installation instructions above for the corresponding commands.

## Tutorials

### Add new objects to the current simulation
After the simulation initially loads, you will see a box on the left titled "Visible Bodies." Within 
this menu, you can toggle object visibility, zoom to objects, and load new objects into the simulation. 
Click on a category (e.g Sun, Mercury, Spacecraft) to expand it. In this drop-down, any name in black 
text is already loaded in the simulation. Any name that is grayed out is available from the backend, 
but is not currently loaded into the simulation. Click the '+' on the object you would like to add. 
The name should change to black text once the data has been retrieved. At this point you can view and 
interact with the object.

### Changing the rate of time and tail length
The simulation's rate of time is displayed at the top-center of the screen underneath the current date. 
The rate of time is 0 when the simulation is paused. Within the "Time Controls" menu on the left, either 
adjust the slider to change the rate of time, or enter a value in JD/sec manually. This will not resume 
the simulation if it is paused.

Similarly, to change the tail length (length of trajectory line for each object, represented in JD prior
to current date). Use the corresponding slider/input form on the "Time Controls" menu.

### Zooming to objects and viewing object info
Within the "Visible Bodies" menu, you may right click on any object that is loaded in the current 
simulation (i.e. if the name's text is black, see the tutorial on adding new objects above). Here 
you should see options to zoom to the object, or view its info.

### Uploading new binary SPK SPICE kernels
Within the "Visible Bodies" menu on the left, there is a button titled "Upload New SPK Kernel." 
Clicking this button will open a prompt. Selecting "Browse" will open a file explorer where you can 
select a file for uploading. Only binary SPK SPICE kernels (.bsp) may be uploaded, otherwise a 
warning will appear. Once the file has been uploaded, the new bodies contained in that kernel will 
be automatically added to the "Visible Bodies" drop-down in the appropriate category. For example, 
if the kernel contains a spacecraft, that object will appear in the Spacecraft drop-down. If an object 
is a moon of Jupiter, it will appear in the Jupiter drop-down.


- Creating a new sim
- Creating a compare sim
	- bspidmod info

## Code Walkthrough
**TODO**

- backend
- frontend