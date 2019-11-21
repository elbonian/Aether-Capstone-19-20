# Basic SPK REST Server

CU Capstone - NASA/JPL

Fall 2019

### Dependencies

Make sure to use Python3 when running the app
**Server**
  - flask
  - jsonpickle
  - numpy
  - spiceypy

Additionally, make sure you download the kernel files used by `genericMetaK.txt`

Time Kernel: https://naif.jpl.nasa.gov/pub/naif/generic_kernels/lsk/latest_leapseconds.tls

SPK Kernel: https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de435.bsp

**Client**
  - requests

_All of these packages can be installed with pip3_

### Usage

**Server**

    python3 planet-traj-rest-server.py
    
The server will run on localhost

**Client**

    usage: planet-traj-rest-client.py [-h]
                                      ip planet start_date_time end_date_time
                                      steps
    
    A script to test the planet-traj-rest-server.
    
    positional arguments:
      ip               IP of the machine to test.
      planet           Planet to get positions for.
      start_date_time  Beginning date/time. Format: YYYY-MM-DD OR YYYY-MM-
                       DDThh:mm:ss
      end_date_time    Ending date/time. Format: YYYY-MM-DD OR YYYY-MM-DDThh:mm:ss
      steps            Number of data points (within the date range) to collect.
    
    optional arguments:
      -h, --help       show this help message and exit

Example

    python3 planet-traj-rest-client.py localhost saturn 2019-11-21 2019-11-25T10:11:12 50
    
This will return 50 coordinates representing the position of Saturn between Nov 21, 2019 at 00:00:00 UTC and Nov 25, 2019 at 10:11:12 UTC.
