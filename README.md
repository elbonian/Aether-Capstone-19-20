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

Aether consists of two main components, the backend and frontend. The backend consists of a REST 
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

### Backend
Installation of the backend requires the docker commandline interface. Installing docker depends on 
your OS. Note that docker requires virtualization is enabled within the BIOS.

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

#### Building the Docker Image
Once docker has been installed on your machine, open a terminal and navigate to the 
`Aether-Capstone-19-20` directory. Run the following commands to build the backend docker image...

    cd backend/
    sudo docker build -t aether-backend .

_Note: Building the docker image may take ~15 minutes depending on your internet speed. This is 
because the docker must download approximately 3 GB of SPICE kernels from JPL/NAIF._

### Frontend
Installing the frontend requires both `node` and `npm` to be installed first.

#### Installing Node.js and Node package manager
To install Node.js and npm on both Windows and Mac, download the installer 
[here](https://nodejs.org/en/download/)

For Linux, install Node.js and npm via snap or a package manager. Instructions can be found 
[here](https://nodejs.org/en/download/package-manager/).

#### Installing Frontend Dependencies
Once Node.js and npm are installed on your computer, once again open a terminal and navigate to 
the `Aether-Capstone-19-20` directory. Run the following commands to install the frontend 
dependencies...

    cd frontend/
    npm install
    
## Running the Application
**TODO**

- frontend
- backend
    - debug mode


## UI Overview
**TODO**

## Tutorials
**TODO**

- Adding objects to the current sim
- Changing rate of time and tail length
- Zooming to bodies and viewing body info
- Uploading new BSP kernels
- Creating a new sim
- Creating a compare sim
	- bspidmod info

## Code Walkthrough
**TODO**

- backend
- frontend