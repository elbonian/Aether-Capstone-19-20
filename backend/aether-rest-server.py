# CU Boulder CS Capstone - NASA/JPL Group (Aether)
# Spring 2020
# Maintainer: Aether

from flask import Flask, Response
import jsonpickle
import re
# import numpy as np
import spiceypy as spice

# Initialize the Flask application
app = Flask(__name__)


def returnResponse(response, status):
    response_pickled = jsonpickle.encode(response)

    return Response(response=response_pickled, status=status, mimetype="application/json")


@app.route('/api/positions/<string:ref_frame>/<string:targets>/<string:startDate>/<string:endDate>/<string:steps>', methods=['GET'])
def get_object_positions(ref_frame, targets, startDate, endDate, steps):

    # TODO: put this info (and more) into a sqlite database to make it more dynamic
    # valid_targets = {
    #     'solar system barycenter': ['sun', 'mercury barycenter', 'mercury', 'venus barycenter', 'venus',
    #                                 'earth barycenter', 'mars barycenter', 'jupiter barycenter', 'saturn barycenter',
    #                                 'uranus barycenter', 'neptune barycenter', 'pluto barycenter'],
    #     'mercury barycenter': [],
    #     'venus barycenter': [],
    #     'earth barycenter': ['earth', 'moon'],
    #     'mars barycenter': ['mars', 'phobos', 'deimos'],
    #     'jupiter barycenter': ['jupiter', 'io', 'europa', 'ganymede', 'callisto', 'amalthea', 'thebe', 'adrastea',
    #                            'metis'],
    #     'saturn barycenter': ['saturn', 'mimas', 'enceladus', 'tethys', 'dione', 'rhea', 'titan', 'hyperion', 'iapetus',
    #                           'phoebe', 'helene', 'telesto', 'calypso', 'methone', 'polydeuces'],
    #     'uranus barycenter': ['uranus', 'ariel', 'umbriel', 'titania', 'oberon', 'miranda'],
    #     'neptune barycenter': ['neptune', 'triton', 'nereid', 'proteus'],
    #     'pluto barycenter': ['pluto', 'charon', 'nix', 'hydra', 'kerberos', 'styx']
    # }

    valid_targets = ('solar system barycenter', 'sun', 'mercury barycenter', 'mercury', 'venus barycenter', 'venus',
                     'earth barycenter', 'mars barycenter', 'jupiter barycenter', 'saturn barycenter',
                     'uranus barycenter', 'neptune barycenter', 'pluto barycenter', 'earth', 'moon', 'mars', 'phobos',
                     'deimos', 'jupiter', 'io', 'europa', 'ganymede', 'callisto', 'amalthea', 'thebe', 'adrastea',
                     'metis', 'saturn', 'mimas', 'enceladus', 'tethys', 'dione', 'rhea', 'titan', 'hyperion', 'iapetus',
                     'phoebe', 'helene', 'telesto', 'calypso', 'methone', 'polydeuces', 'uranus', 'ariel', 'umbriel',
                     'titania', 'oberon', 'miranda', 'neptune', 'triton', 'nereid', 'proteus', 'pluto', 'charon', 'nix',
                     'hydra', 'kerberos', 'styx')

    # convert string of targets into a list -- ensure lower case for consistency
    targets_list = [target.lower() for target in targets.split('+')]

    ref_frame = ref_frame.lower()

    # check to make sure the reference frame and targets are valid
    if ref_frame not in valid_targets:
        return returnResponse({'error': '{} is not a valid reference frame.'.format(ref_frame)}, 400)

    for target in targets_list:
        if target not in valid_targets:
            return returnResponse({'error': '{} is not a known target.'.format(target)}, 400)

    # steps is a string representing either a single int, or a list of ints (same len as targets) separated by +
    try:
        steps_list = [int(steps_str) for steps_str in steps.split('+')]
    except ValueError:
        return returnResponse({'error': 'One or more steps value is not an integer.'}, 400)

    # if only a single step value given, expand the list to match the number of values in targets_list
    if len(steps_list) == 1:
        steps_list = steps_list * len(targets_list)

    # ensure targets and steps are the same length
    if len(targets_list) != len(steps_list):
        return returnResponse({'error': 'Provide either a single step value, or one for each target.'}, 400)

    # ensure all step sizes are valid
    for steps in steps_list:
        if steps < 1:
            return returnResponse({'error': 'All steps must be greater than 0.'}, 400)

    # REGEX pattern to ensure date/time format is correct
    # yyyy-mm-dd OR yyyy-mm-ddThh:mm:ss
    time_format = '^\d\d\d\d-\d\d-\d\d(T\d\d:\d\d:\d\d)?$'

    format_check_start = re.search(time_format, startDate)
    format_check_end = re.search(time_format, endDate)

    # ensure correct format for both dates
    if (format_check_start is None) or (format_check_end is None):
        return returnResponse({'error': 'One or more date/time format is invalid.'}, 400)

    # TODO: Make sure that dates/times are within allowable range (e.g. 01-12 for months, 01-24 for hours)
    #       Try/except block below is a stand-in solution.

    # TODO: put this outside the function so that it does not execute on every api call
    # load the kernels
    spice.furnsh("./SPICE/kernels/cumulative_metakernel.tm")

    # calculate ET times from date/time strings
    try:
        etStart = spice.str2et(startDate)
        etEnd = spice.str2et(endDate)
    except Exception as error:

        return returnResponse({'error': error}, 400)

    # ensure start is before end
    if etStart >= etEnd:
        return returnResponse({'error': 'Start date/time must be earlier than end date/time.'}, 400)

    response_data = dict()

    # gather data for each target
    for i, target in enumerate(targets_list):
        # create a list of times based on ET start, ET end and number of steps for current target
        times = [x * (etEnd - etStart) / steps_list[i] + etStart for x in range(steps_list[i])]

        # second variable returned is light times, which we may disregard for this purpose
        target_positions, _ = spice.spkpos(target, times, 'J2000', 'NONE', ref_frame)

        response_data[target] = {
            'info': 'Positions (x,y,z) and times (J2000) of {} w.r.t. {}'.format(target.capitalize(), ref_frame.capitalize()),
            'positions': [coord.tolist() for coord in target_positions],  # times is a numpy.ndarray
            'times': times
        }

    # clear the kernels
    spice.kclear()

    return returnResponse(response_data, 200)


app.run(host="0.0.0.0", port=5000)
