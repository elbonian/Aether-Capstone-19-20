# CU Boulder CS Capstone - NASA/JPL Group (Aether)
# Spring 2020
# Maintainer: Aether

from flask import Flask, Response, request
from flask_cors import CORS
from werkzeug.utils import secure_filename
from datetime import datetime, timedelta
from signal import signal, SIGINT
from argparse import ArgumentParser
#import re
import jsonpickle
import numpy as np
import spiceypy as spice
from AetherBodies import AetherBodies
from MetakernelWriter import MetakernelWriter


# Initialize the Flask application
app = Flask(__name__)

# Enable Cross Origin Resource Sharing (CORS) for the rest server
CORS(app)

# Global variable to hold information about the bodies/objects a user can get data for
aether_bodies = AetherBodies()


def exitNicely(sig, frame):
    """
    aether-rest-server.py -- exitNicely:
        This function is called when the program receives a SIGINT signal.
        It simply clears the furnished kernels within the SPICE subsystem and exits.

    Params: sig, frame. Both are unused, but are required by the signal package since the function is a callback.

    Returns: None.
    """

    spice.kclear()
    print("\nCleared loaded kernels.\nExiting...")
    exit(0)


def get_min_max_speed(bod_id, time_range_list, wrt):
    """
    aether-rest-server.py -- get_min_max_speed
        The purpose of this function is to calculate the approx min and max speeds of a specific object w.r.t another.
        It is used by the available-bodies endpoint and, in turn, determines the range of speeds used for trajectory
        gradients on the frontend. The comments below detail the procedure of the algorithm...

    Params: bod_id <str> -- the NAIF ID of the body for which min and max speeds shall be obtained. Optionally, a valid
                body name may be passed instead.
            time_range_list list[tuple[<str>, <str>]] -- a list of tuples holding the starting and ending times for
                    which the body (specified by bod_id) has valid ephemeris. Typically this list is only of length 1,
                    but it may be more if the target is valid over multiple non-overlapping time ranges.
            wrt <str> -- The observing body for which target speeds are calculated against. This may be either a NAIF ID
                    or body name. (e.g. "0" or "solar system barycenter")

    Returns: tuple[<float>, <float>]  -- the approx min (0 index in tuple) and max (1 index in tuple) speed of the body.
    """

    # PROCEDURE #
    #
    #   For each time range
    #       Do a uniform sample within the time range
    #       For each time in the sample, create another time 1 minute after
    #       Get positions for each time tuple from the sample and figure out the speed based on 1 minute offset
    #       Get the min and max speeds across all time ranges for the body

    # empty list to hold speeds of the body
    speed_list = list()

    # iterate over time ranges
    for time_tupe in time_range_list:

        # this try-except only goes into the except clause when the date is in 1 A.D. or before
        try:
            # convert the starting date into a datetime object
            t_start = datetime.strptime(time_tupe[0], "%Y-%m-%d %H:%M:%S.%f")
        except ValueError:
            # handle B.C. dates... This could be a lot more elegant
            t_start = datetime(year=1, month=1, day=1)

        # convert the ending date into a datetime object
        t_end = datetime.strptime(time_tupe[1], "%Y-%m-%d %H:%M:%S.%f")

        # start - end results in a timedelta object
        # get total seconds of the interval and do integer division by 60 to get lower bound on total minutes
        t_delta_minutes = int((t_end - t_start).total_seconds() // 60)

        # uniformly sample 10 offsets from the range
        sampled_offsets = list(range(0, t_delta_minutes - 1, (t_delta_minutes - 1) // 9))

        # iterate over each of the sampled offsets
        for offset in sampled_offsets:

            # generate ET from the starting datetime and offset
            etStart = spice.datetime2et(t_start + timedelta(minutes=offset))

            # generate an end time that is 1 minute after the start
            etEnd = spice.datetime2et(t_start + timedelta(minutes=offset + 1))

            # get positions of target w.r.t. observer at both times.
            # this could be refactored to use spkez, although both bod_id and wrt would need to be ints always.
            target_positions, _ = spice.spkpos(bod_id, [etStart, etEnd], 'J2000', 'NONE', wrt)

            # get distance between starting and ending positions
            # logic from: https://stackoverflow.com/questions/20184992/
            squared_dist = np.sum((target_positions[1] - target_positions[0]) ** 2, axis=0)

            # dist is in km -- distance traveled by obj in one minute
            dist = np.sqrt(squared_dist)

            # dist is km traveled in one minute. Divide by 60 to get km/sec
            speed = dist / 60

            # append speed to the list
            speed_list.append(speed)

    # return the min and max speed from the speeds list
    return float(np.min(speed_list)), float(np.max(speed_list))


def get_radius(bod_id):
    """
    aether-rest-server.py -- get_radius
        This function simply gets the radii of the body specified by bod_id.

    Params: bod_id <str> -- the NAIF ID of the body for which min and max speeds shall be obtained. Optionally, a valid
                body name may be passed instead.

    Returns: list[<float>, <float>, <float>]  -- TODO
    """

    try:
        # get radii from SPICE
        return spice.bodvrd(bod_id, "RADII", 3)[1].tolist()
    # This should never be hit, since this function is only called on bodies which have radius data, but just in case...
    except:
        return "NO RADIUS DATA AVAILABLE"


def get_mass(bod_id):
    """
    aether-rest-server.py -- get_mass
        This function simply gets the mass in kg of the body specified by bod_id.

    Params: bod_id <str> -- the NAIF ID of the body for which min and max speeds shall be obtained. Optionally, a valid
                body name may be passed instead.

    Returns: <float> the mass of the body in kg
    """

    # the gravitational constant
    G = 6.67430e-11

    try:
        # return mass from SPICE -- G is divided so the result is in kg
        return float(spice.bodvrd(bod_id, "GM", 1)[1][0] / (G/1000000000))
    # This should never be hit, since this function is only called on bodies which have mass data, but just in case...
    except:
        return "NO MASS DATA AVAILABLE"


def get_rotation_data(bod_id, bod_name):
    """
    aether-rest-server.py -- get_rotation_data
        This function gets any and all rotation info for a body. There are four different possibilities:
            1: The object has no rotation data. In this case a string will be returned. However, this function is only
               called on objects that have some rotation data, so this is an edge case that should never occur.
            2: The object only has POLE_RA, POLE_DEC and PM (and deltas of each). A dictionary containing this data is
               returned.
            3: In addition to the data mentioned in #2, the object also has nutation/precession info, specifically
               NUT_PREC_RA and NUT_PREC_DEC. A dictionary containing all this data is returned.
            4. In addition to the data mentioned in #3, the object also has nutation/precession angles. As you might
               imagine, a dictionary containing an extra key with this data is returned in this case.

    Params: bod_id <str> -- the NAIF ID of the body for which min and max speeds shall be obtained.
            bod_name <str> -- the body name corresponding to the NAIF ID passed for bod_id. This could be refactored to
                use the bodc2s function instead if so desired.

    Returns: <dict> -- a dictionary containing all the available rotation data
    """

    # try to get POLE_RA, POLE_DEC and PM (plus deltas for each)
    try:
        # get basic rotation data and convert to list
        target_RA_all = spice.bodvrd(bod_id, "POLE_RA", 3)[1].tolist()
        target_DEC_all = spice.bodvrd(bod_id, "POLE_DEC", 3)[1].tolist()
        target_PM_all = spice.bodvrd(bod_id, "PM", 3)[1].tolist()

        # get the initial values
        target_RA_j2000 = target_RA_all[0]
        target_DEC_j2000 = target_DEC_all[0]
        target_PM_j2000 = target_PM_all[0]

        # get the deltas
        target_RA_delta = target_RA_all[1]
        target_DEC_delta = target_DEC_all[1]
        target_PM_delta = target_PM_all[1]

        # add each value to a dictionary
        ret_dict = {
            "ra": target_RA_j2000,
            "ra_delta": target_RA_delta,
            "dec": target_DEC_j2000,
            "dec_delta": target_DEC_delta,
            "pm": target_PM_j2000,
            "pm_delta": target_PM_delta
        }
    # this except should never be hit since this function is only called on bodies that have some rotation data,
    # but just in case...
    except:
        ret_dict = "NO ROTATION DATA AVAILABLE"
        return ret_dict

    # get NUT_PREC_RA, NUT_PREC_DEC and NUT_PREC_ANGLES
    try:

        # get nutation/precession info... max of 20 values
        target_NUT_PREC_RA = spice.bodvrd(bod_id, "NUT_PREC_RA", 20)
        target_NUT_PREC_DEC = spice.bodvrd(bod_id, "NUT_PREC_DEC", 20)

        # slice the list based on the first arg which specifies the number of legitimate data points returned
        ret_dict['nut_prec_ra'] = target_NUT_PREC_RA[1].tolist()[:target_NUT_PREC_RA[0]]
        ret_dict['nut_prec_dec'] = target_NUT_PREC_DEC[1].tolist()[:target_NUT_PREC_DEC[0]]

        # try to get nutation/precession angles for the body... max of 72 values, sliced the same way as before
        try:
            target_NUT_PREC_ANGLES = spice.bodvrd(bod_name + " BARYCENTER", "NUT_PREC_ANGLES", 72)
            ret_dict['nut_prec_angles'] = target_NUT_PREC_ANGLES[1].tolist()[:target_NUT_PREC_ANGLES[0]]
        # the case where there are no nutation-precession angles for the body
        except:
            # do nothing, just go onto the next iteration
            pass
    # the case where there is no nutation-precession info for the body -- go on to the next loop iteration
    except:
        pass

    # return the accumulated rotation info
    return ret_dict


def returnResponse(response, status):
    """
    aether-rest-server.py -- returnResponse
        Simple function to encode and package data into a response that is sent to the frontend by the calling function.

    Params: response <list> or <dict> -- really anything that can be serialized into JSON format.
            status <int> -- the status code of the response (typically either 200, or 40X).

    Returns: a Flask response object with the payload being the JSON-encoded data.
    """
    response_pickled = jsonpickle.encode(response)

    return Response(response=response_pickled, status=status, mimetype="application/json")


def parse_args():

    parser = ArgumentParser(description="The backend REST server for Aether, a CU - Boulder computer science senior "
                                        "capstone project sponsored by NASA/JPL.")

    parser.add_argument('--debug', help="If specified, run the server using the built in Flask WSGI server.",
                        action="store_true", default=False)

    parsed_args = parser.parse_args()

    return parsed_args


@app.route('/api/positions/<string:ref_frame>/<string:targets>/<string:curVizJd>/<string:curVizJdDelta>/<string:tailLenJd>/<int:validSeconds>', methods=['GET'])
def get_object_positions(ref_frame, targets, curVizJd, curVizJdDelta, tailLenJd, validSeconds):
    """
    aether-rest-server.py -- get_object_positions
        This function serves position and time data to the frontend for visualization. It is called when the frontend
        makes a GET request to the above URL using specified params. This function can return data for either a single
        body/target or multiple. In the case of multiple targets, they should be passed as either names or NAIF IDs
        separated by a '+' (e.g. "sun+earth+499+jupiter+europa+pluto+904"). Case does not matter since each target is
        converted to lower case within this function.

        Main idea: The frontend needs position data both before and after the current simulation time. It needs data
            before the current sim time because trajectory tails must be drawn. It needs data after the current sim time
            so that the frontend has some data for the future and does not need to make API calls constantly. curVizJd
            represents the initial time, curVizJdDelta specifies the granularity in JD between each position coordinate,
            tailLenJd specifies the amount of data to gather before curVizJd (also in JD), validSeconds specifies the
            amount of data to gather past curVizJd. validSeconds assumes a framerate of 60 fps, and uses that, along
            with curVizJdDelta to determine how many positions past curVizJd to obtain. Note, however, that the frontend
            always passes 1/12 as curVizJdDelta, so validSeconds is slightly misleading. Still, the functionality to
            support any rate of time/position granularity from the frontend exists.

    Params: ref_frame <str> -- the name or NAIF ID of the observing body for which target positions reference. This
                basically represents the origin of the coordinate system on the frontend (e.g. solar system barycenter,
                mars barycenter, 0, earth, etc.)
            targets <str> -- names or NAIF IDs of the desired targets for which position data will be obtained. This may
                be either a single target, or multiple separated by '+' signs. See above for an example.
            curVizJd <str> -- a time in Julian days (often a float) representing the an initial time. This is often the
                current time in the frontend visualization. The beginning and ending times are calculated based on this
                value as well as curVizJdDelta, tailLenJd and validSeconds.
            curVizJdDelta <str> -- a time delta in Julian days (often a float) representing the granularity between each
                position coordinate. Initially this was meant to be the rate of time on the frontend (the time between
                ticks, which usually occur 60 times per second, or whatever the fps of the viz is). However, to avoid
                making a new API call every time a user changes the rate of time, the frontend simply changes the rate
                at which the positions list is traversed. Currently, the frontend always uses 1/12 (2 hours) as this
                value, though any granularity is supported by this endpoint.
            tailLenJd <str> -- the length of the trajectory tail (amount of JD prior to curVizJd). This determines the
                beginning positions/times in the returned data. See Main idea above for more info.
            validSeconds <int> -- the amount of position data to gather past curVizJd. Higher values provide more future
                data, so the frontend won't need to update as much, and vice versa. See Main idea above for more detail.

    Returns: Flask Response object with a dictionary containing position lists (x, y, z) w.r.t. the specified observer,
        times corresponding to each position, and the current index (index of lists for curVizJd) for each target.
    """

    # convert string of targets into a list -- ensure lower case for consistency
    targets_list = [target.lower() for target in targets.split('+')]

    # convert ref frame to lower case for consistency
    ref_frame = ref_frame.lower()

    # check to make sure the reference frame is valid
    if not aether_bodies.isValidRefFrame(ref_frame): #ref_frame not in valid_targets:
        return returnResponse({'error': '{} is not a valid reference frame.'.format(ref_frame)}, 400)

    # check to make sure all targets are valid
    for target in targets_list:
        if (not aether_bodies.isValidID(target)) and (not aether_bodies.isValidName(target)):
            return returnResponse({'error': '{} is not a known target.'.format(target)}, 401)

    # convert all JD string arguments into floats... maybe they could be specified as floats instead...
    try:
        curVizJd = float(curVizJd)
        curVizJdDelta = float(curVizJdDelta)
        tailLenJd = float(tailLenJd)
    except ValueError:
        return returnResponse({'error': 'curVizJd, curVizJdDelta, tailLenJd must all be floats.'}, 402)

    # assume 60 fps as an upper bound -- this ensures that the data is valid for at least validSeconds
    # validSeconds specifies the amount of real time the returned data will be valid for in the frontend.
    # This has changed slightly, see the docstring for details...
    jd_end = curVizJd + (curVizJdDelta * 60 * validSeconds)

    # subtract tail len from cur JD to get the start time in JD
    jd_start = curVizJd - tailLenJd

    # ensure jd_end is a multiple of the current JD delta
    if tailLenJd % curVizJdDelta > 0.00000001:  # value is small enough to account for round off error in most cases
        return returnResponse({'error': 'tailLenJd must be evenly divisible by curVizJdDelta.'}, 403)

    # Convert back to string and add 'jd ' to the front for SPICE
    startDate = 'jd ' + str(jd_start)
    # endDate = 'jd ' + str(jd_end)

    # ----- REMEMBER: ET (ephemeris time) is simply seconds past J2000 epoch. J2000 epoch is JD 2451545.0 -----

    # calculate ET times from date/time strings
    try:
        etStart = spice.str2et(startDate)
        etDelta = curVizJdDelta * 86400  # Since JD is in days and ET is in seconds, simply multiply by seconds in a day
    except Exception as error:

        return returnResponse({'error': error}, 405)

    # calculate the number of necessary steps...
    total_steps = round((jd_end - jd_start) / curVizJdDelta)
    cur_idx = round((curVizJd - jd_start) / curVizJdDelta)
    times = [etStart + (etDelta * x) for x in range(total_steps + 1)]

    # DEBUGGING
    # if etStart not in times:
    #     print("Times list does not contain etStart")
    # if spice.str2et('jd ' + str(curVizJd)) not in times:
    #     print("Times list does not contain curVizJd")
    # if etEnd not in times:
    #     print("Times list does not contain etEnd")

    # empty dictionary to hold return data
    response_data = dict()

    # gather data for each target
    for i, target in enumerate(targets_list):

        # second variable returned is light times, which we may disregard for this purpose
        target_positions, _ = spice.spkpos(target, times, 'J2000', 'NONE', ref_frame)

        response_data[target] = {
            'info': 'Positions (x,y,z) and times (JD) of {} w.r.t. {}'.format(target.capitalize(),
                                                                              ref_frame.capitalize()),
            'positions': [coord.tolist() for coord in target_positions],  # target_positions is a numpy.ndarray
            'times': [float(spice.et2utc(etTime, "J", 8)[3:]) for etTime in times],
            # convert times to JD, slice off "JD " and convert to float
            'cur_time_idx': cur_idx
        }

    # return the response to the frontend -- 200 code for success
    return returnResponse(response_data, 200)


# NOTE: This endpoint is unused and is left in only as a reference
# @app.route('/api/positions-legacy/<string:ref_frame>/<string:targets>/<string:startDate>/<string:endDate>/<string:steps>', methods=['GET'])
# def get_object_positions_legacy(ref_frame, targets, startDate, endDate, steps):
#
#     valid_targets = ('solar system barycenter', 'sun', 'mercury barycenter', 'mercury', 'venus barycenter', 'venus',
#                      'earth barycenter', 'mars barycenter', 'jupiter barycenter', 'saturn barycenter',
#                      'uranus barycenter', 'neptune barycenter', 'pluto barycenter', 'earth', 'moon', 'mars', 'phobos',
#                      'deimos', 'jupiter', 'io', 'europa', 'ganymede', 'callisto', 'amalthea', 'thebe', 'adrastea',
#                      'metis', 'saturn', 'mimas', 'enceladus', 'tethys', 'dione', 'rhea', 'titan', 'hyperion', 'iapetus',
#                      'phoebe', 'helene', 'telesto', 'calypso', 'methone', 'polydeuces', 'uranus', 'ariel', 'umbriel',
#                      'titania', 'oberon', 'miranda', 'neptune', 'triton', 'nereid', 'proteus', 'pluto', 'charon', 'nix',
#                      'hydra', 'kerberos', 'styx')
#
#     # convert string of targets into a list -- ensure lower case for consistency
#     targets_list = [target.lower() for target in targets.split('+')]
#
#     ref_frame = ref_frame.lower()
#
#     # check to make sure the reference frame and targets are valid
#     if ref_frame not in valid_targets:
#         return returnResponse({'error': '{} is not a valid reference frame.'.format(ref_frame)}, 400)
#
#     for target in targets_list:
#         if target not in valid_targets:
#             return returnResponse({'error': '{} is not a known target.'.format(target)}, 400)
#
#     # steps is a string representing either a single int, or a list of ints (same len as targets) separated by +
#     try:
#         steps_list = [int(steps_str) for steps_str in steps.split('+')]
#     except ValueError:
#         return returnResponse({'error': 'One or more steps value is not an integer.'}, 400)
#
#     # if only a single step value given, expand the list to match the number of values in targets_list
#     if len(steps_list) == 1:
#         steps_list = steps_list * len(targets_list)
#
#     # ensure targets and steps are the same length
#     if len(targets_list) != len(steps_list):
#         return returnResponse({'error': 'Provide either a single step value, or one for each target.'}, 400)
#
#     # ensure all step sizes are valid
#     for steps in steps_list:
#         if steps < 1:
#             return returnResponse({'error': 'All steps must be greater than 0.'}, 400)
#
#     # REGEX pattern to ensure date/time format is correct
#     # yyyy-mm-dd OR yyyy-mm-ddThh:mm:ss
#     time_format = '^\d\d\d\d-\d\d-\d\d(T\d\d:\d\d:\d\d)?$'
#
#     format_check_start = re.search(time_format, startDate)
#     format_check_end = re.search(time_format, endDate)
#
#     # ensure correct format for both dates
#     if (format_check_start is None) or (format_check_end is None):
#         return returnResponse({'error': 'One or more date/time format is invalid.'}, 400)
#
#     # TODO: Make sure that dates/times are within allowable range (e.g. 01-12 for months, 01-24 for hours)
#     #       Try/except block below is a stand-in solution.
#
#     # calculate ET times from date/time strings
#     try:
#         etStart = spice.str2et(startDate)
#         etEnd = spice.str2et(endDate)
#     except Exception as error:
#
#         return returnResponse({'error': error}, 400)
#
#     # ensure start is before end
#     if etStart >= etEnd:
#         return returnResponse({'error': 'Start date/time must be earlier than end date/time.'}, 400)
#
#     response_data = dict()
#
#     # gather data for each target
#     for i, target in enumerate(targets_list):
#         # create a list of times based on ET start, ET end and number of steps for current target
#         times = [x * (etEnd - etStart) / steps_list[i] + etStart for x in range(steps_list[i])]
#
#         # second variable returned is light times, which we may disregard for this purpose
#         target_positions, _ = spice.spkpos(target, times, 'J2000', 'NONE', ref_frame)
#
#         response_data[target] = {
#             'info': 'Positions (x,y,z) and times (J2000) of {} w.r.t. {}'.format(target.capitalize(),
#                                                                                  ref_frame.capitalize()),
#             'positions': [coord.tolist() for coord in target_positions],  # times is a numpy.ndarray
#             'times': times
#         }
#
#     return returnResponse(response_data, 200)


@app.route('/api/available-bodies/<string:ref_frame>', methods=['GET'])
def get_available_bodies(ref_frame):
    """
    aether-rest-server.py -- get_available_bodies
        This function serves metadata about the bodies that the backend has loaded. It is called when the frontend makes
        a GET request to the above URL with the specified param. This endpoint is called by the frontend whenever a new
        simulation is created. It returns a list of dictionaries (one for each body). Each dictionary specifies the body
        name, NAIF ID, valid time ranges, whether or not it is default or uploaded by the user and the body's approx
        minimum and maximum speeds. Along with that data it also specifies whether or not the body has mass, rotation
        and radius data. If any of these are true for a body, the dictionary contains keys for each.

    Params: ref_frame <str> -- the name or NAIF ID of the observing body for which min and max speeds for each object
        are calculated against. This determines the range of speeds which the frontend uses for trajectory gradients. It
        is necessary because the min and max speeds of an object are different for different observers.

    Returns: a Flask response object with a list of dictionaries. Each dictionary in the list provides metadata for a
        single body that the backend has loaded in it's SPICE kernel set. See the above description for more info. Below
        is an example of a single dictionary in the list for reference...

    {
    'body name': 'mars',
    'category': 'mars',
    'has mass data': True,
    'has radius data': True,
    'has rotation data': True,
    'is uploaded': False,
    'mass': 6.416908682663215e+23,
    'max speed': 26.409686994581353,
    'min speed': 21.974733146673085,
    'radius': [3396.19, 3396.19, 3376.2],
    'rotation data': {'dec': 52.8865,
                      'dec_delta': -0.0609,
                      'pm': 176.63,
                      'pm_delta': 350.89198226,
                      'ra': 317.68143,
                      'ra_delta': -0.1061},
    'spice id': 499,
    'valid times': [['1900-01-04 00:00:41.184000',
                     '2100-01-01 00:01:07.183000']]
    }
    """

    # convert reference frame to lower case for consistency
    ref_frame = ref_frame.lower()

    # check to make sure the reference frame is valid
    if not aether_bodies.isValidRefFrame(ref_frame):
        return returnResponse({'error': '{} is not a valid reference frame.'.format(ref_frame)}, 400)

    # get all body info from AetherBodies class
    known_bodies = aether_bodies.getBodies()

    # get rotation, mass, radii, min-max speeds for each body

    # traverse list of known bodies
    for bod_dict in known_bodies:

        # convert body's NAIF ID to a string so that it is recognized by spice functions
        bod_id = str(bod_dict['spice id'])

        # get the min and max speeds for each body
        min_max_speeds = get_min_max_speed(bod_id, bod_dict['valid times'], ref_frame)

        # add min and max speeds to the dictionary
        bod_dict['min speed'] = min_max_speeds[0]
        bod_dict['max speed'] = min_max_speeds[1]

        # check if body has radius data -- if so, get that data and add it to the dictionary
        if bod_dict['has radius data']:
            bod_dict['radius'] = get_radius(bod_id)

        # check if body has mass data -- if so, get that data and add it to the dictionary
        if bod_dict['has mass data']:
            bod_dict['mass'] = get_mass(bod_id)

        # check if body has rotation data -- if so, get that data and add it to the dictionary
        if bod_dict['has rotation data']:
            bod_dict['rotation data'] = get_rotation_data(bod_id, bod_dict['body name'])

    # create the response and return it to the frontend
    return returnResponse(known_bodies, 200)


@app.route('/api/spk-upload/<string:ref_frame>', methods=['POST'])
def spk_upload(ref_frame):
    """
    aether-rest-server.py -- spk_upload
        This function allows users to upload new SPICE SPK kernels to the backend. It is called when the frontend makes
        a POST request to the above URL with the specified param. This function simply obtains the uploaded file, makes
        sure it's valid, and then registers it with the SPICE subsystem and AetherBodies.

    Params: ref_frame <str> -- the name or NAIF ID of the observing body for which min and max speeds for each object
        are calculated against. This determines the range of speeds which the frontend uses for trajectory gradients. It
        is necessary because the min and max speeds of an object are different for different observers. To avoid calling
        available-bodies again, which would be redundant, simply perform the same computation for the new bodies in the
        uploaded kernel.

    Returns: a Flask response object with a list of dictionaries. Each dictionary in the list provides metadata for a
        single body that was newly added from the uploaded kernel. This response is identical in format to
        available-bodies, the difference is that the only items returned are the new bodies in the uploaded kernel.

    """

    # this function modifies aether_bodies, so it needs to be declared global
    global aether_bodies

    # convert ref_frame to lower case for consistency
    ref_frame = ref_frame.lower()

    # check to make sure the reference frame is valid
    if not aether_bodies.isValidRefFrame(ref_frame):
        return returnResponse({'error': '{} is not a valid reference frame.'.format(ref_frame)}, 400)

    # file extension for binary spk kernels
    spk_extension = '.bsp'

    # check if the post request has a file part
    if 'file' not in request.files:
        return returnResponse({'error': 'No file part in the request.'}, 400)

    # get the file object from the request
    file = request.files['file']

    # ensure file exists
    if file.filename == '':
        return returnResponse({'error': 'No file selected for uploading'}, 400)

    # get filename via secure_filename -- ensures no tricks (e.g. having ../ in the filename) can mess up the system
    filename = secure_filename(file.filename)

    # make sure the file is a binary spk kernel
    if not filename.endswith(spk_extension):

        return returnResponse({'error': 'Only .bsp files are allowed.'}, 400)

    else:
        # set file path to the user_uploaded directory
        file_path = 'SPICE/kernels/user_uploaded/' + filename

        # save the file
        file.save(file_path)

        # furnish the kernel into the SPICE subsystem
        spice.furnsh(file_path)

        # add the bodies in the kernel into the AetherBodies object
        new_bodies = aether_bodies.addFromKernel(file_path, returnNewBodies=True)

        # if no new bodies were added, the file may be a duplicate, or there were no new bodies in it...
        # in this case, return a special code that the frontend will catch
        if not new_bodies:
            return returnResponse([], 409)

        # traverse the new bodies and get mass, radii, min-max speeds, rotations -- same logic as available-bodies
        for bod_dict in new_bodies:

            bod_id = str(bod_dict['spice id'])

            min_max_speeds = get_min_max_speed(bod_id, bod_dict['valid times'], ref_frame)
            bod_dict['min speed'] = min_max_speeds[0]
            bod_dict['max speed'] = min_max_speeds[1]

            if bod_dict['has radius data']:
                bod_dict['radius'] = get_radius(bod_id)

            if bod_dict['has mass data']:
                bod_dict['mass'] = get_mass(bod_id)

            if bod_dict['has rotation data']:
                bod_dict['rotation data'] = get_rotation_data(bod_id, bod_dict['body name'])

        # DEBUG
        # print(new_bodies)

        # make the response and return it to the frontend
        return returnResponse(new_bodies, 200)


@app.route('/api/spk-clear/', methods=['GET'])
def clear_uploaded_kernels():
    """
    aether-rest-server.py -- spk_clear
        This function allows users to clear all the uploaded kernels.

    Params: None

    Returns: a Flask response object with a list of strings. Each string in the list is the name of a body which was
        removed.

    """

    # this function modifies the aether_bodies object so it must be declared global.
    global aether_bodies

    removed_bod_names = aether_bodies.removeUploadedKernels()

    spice.kclear()

    mkw.write()

    spice.furnsh("./SPICE/kernels/cumulative_metakernel.tm")

    return returnResponse(removed_bod_names, 200)


# -------------------- MAIN --------------------

# create metakernel file
mkw = MetakernelWriter()
mkw.write()

# load the kernels
spice.furnsh("./SPICE/kernels/cumulative_metakernel.tm")

signal(SIGINT, exitNicely)

# args = parse_args()
#
# if args.debug:
#     # start the server
#     app.run(host="0.0.0.0", port=5000, threaded=False)
