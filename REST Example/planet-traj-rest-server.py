# Matthew Menten
# Fall 2019

# Example REST server for getting planet positions b/t two dates


from flask import Flask, request, Response
import jsonpickle
import re
import numpy as np
import spiceypy as spice


# Initialize the Flask application
app = Flask(__name__)


def returnResponse(response, status):
    
    response_pickled = jsonpickle.encode(response)
    
    return Response(response=response_pickled, status=status, mimetype="application/json")


# route http GET requests to this method
@app.route('/api/planets/<string:planet>/<string:startDate>/<string:endDate>/<int:steps>', methods=['GET'])
def store_image(planet, startDate, endDate, steps):
    
	# a set of planets for which position data can be obtained
	planets = ('mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto')

	planet = planet.lower()

	
	# ensure planet is valid
	if planet not in planets:
			    
	    return returnResponse({'error': 'Given planet is invalid.'}, 400)

	
	# REGEX pattern to ensure date/time format is correct
	# yyyy-mm-dd OR yyyy-mm-ddThh:mm:ss
	time_format = time_format = '^\d\d\d\d-\d\d-\d\d(T\d\d:\d\d:\d\d)?$'

	format_check_start = re.search(time_format, startDate)
	format_check_end = re.search(time_format, endDate)

	# ensure correct format for both dates
	if (format_check_start is None) or (format_check_end is None):
	    
	    return returnResponse({'error' : 'One or more date/time format is invalid.'}, 400)

	
	# extract year from the dates
	start_year = int(startDate.split('-')[0])
	end_year = int(endDate.split('-')[0])


	# ensure dates are within the allowable range for the SPK kernel
	if start_year < 1550 or end_year > 2649:

	    return returnResponse({'error' : 'Years must be between 1550 and 2649 (inclusive).'}, 400)

	# TODO: Make sure that dates/times are within allowable range (e.g. 01-12 for months, 01-24 for hours)
	#       Try except block below is a stand-in solution
	
	# you must have at least one step
	if steps < 1:
			    
	    return returnResponse({'error' : 'Number of steps must be greater than 0.'}, 400)

	
	# load the kernels
	spice.furnsh("./genericMetaK.txt")


	# calculate ET times from date/time strings
	try:

		etStart = spice.str2et(startDate)
		etEnd = spice.str2et(endDate)
	
	except Exception as error:

		return returnResponse({'error': error}, 400)


	# ensure start is before end	
	if etStart >= etEnd:
	    
	    return returnResponse({'error' : 'Start date/time must be earlier than end date/time.'}, 400)

    
    # create a list of times based on ET start, ET end and number of steps
	times = [x*(etEnd-etStart)/steps + etStart for x in range(steps)]


    # second variable returned is light times, which we may disregard for this purpose
	planet_positions, _ = spice.spkpos(planet + ' barycenter', times, 'J2000', 'NONE', 'Solar System Barycenter')


    # clear the kernels
	spice.kclear()

	# print(type(planet_positions[0]))


	response = {
		'info' : 'Positions (x,y,z) of {} w.r.t. solar system barycenter'.format(planet.capitalize()),
		'data' : [coord.tolist() for coord in planet_positions]
	}

	return returnResponse(response, 200)



app.run(host="0.0.0.0", port=5000)
