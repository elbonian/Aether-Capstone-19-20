# CU Boulder CS Capstone - NASA/JPL Group (Aether)
# Spring 2020
# Maintainer: Aether

from flask import Flask, Response, request
from werkzeug.utils import secure_filename
import jsonpickle
from signal import signal, SIGINT
import re
import numpy as np
import spiceypy as spice
from flask_cors import CORS
from datetime import datetime, timedelta
from AetherBodies import AetherBodies
from MetakernelWriter import MetakernelWriter


# Initialize the Flask application
app = Flask(__name__)
CORS(app)
aether_bodies = AetherBodies()


def exitNicely(sig, frame):
    spice.kclear()
    print("\nCleared loaded kernels.\nExiting...")
    exit(0)


def get_min_max_speed(bod_id, time_range_list):

    #   For each body
    #       For each time range
    #           Do a uniform sample within the time range
    #           For each time in the sample, create another time 1 minute after
    #           Get positions for each time tuple from the sample and figure out the speed based on 1 minute offset
    #       Get the min and max speeds across all time ranges for the body

    speed_list = list()

    # TODO: change this to iterate over each time range once time range merging is implemented
    for time_tupe in time_range_list:
        # start - end results in a timedelta object
        try:
            t_start = datetime.strptime(time_tupe[0], "%Y-%m-%d %H:%M:%S.%f")
        except ValueError:
            # handle B.C. dates... This could be a lot more elegant
            t_start = datetime(year=1, month=1, day=1)

        t_end = datetime.strptime(time_tupe[1], "%Y-%m-%d %H:%M:%S.%f")

        t_delta_minutes = int((t_end - t_start).total_seconds() // 60)

        # print(t_delta_minutes)
        # print(bod_id)

        # uniformly sample 10 offsets from the range
        sampled_offsets = list(range(0, t_delta_minutes - 1, (t_delta_minutes - 1) // 9))

        for offset in sampled_offsets:
            etStart = spice.datetime2et(t_start + timedelta(seconds=offset))
            # generate an end time that is 1 minute after the start
            etEnd = spice.datetime2et(t_start + timedelta(seconds=offset + 60))

            target_positions, _ = spice.spkpos(bod_id, [etStart, etEnd], 'J2000', 'NONE', 'solar system barycenter')

            # logic from: https://stackoverflow.com/questions/20184992/
            squared_dist = np.sum((target_positions[1] - target_positions[0]) ** 2, axis=0)
            # dist is in km -- distance traveled by obj in one minute
            dist = np.sqrt(squared_dist)

            # dist in km traveled in one minute. Divide by 60 to get km/sec
            speed = dist / 60

            speed_list.append(speed)

    return float(np.min(speed_list)), float(np.max(speed_list))


def get_radius(bod_id):
    try:
        return spice.bodvrd(bod_id, "RADII", 3)[1].tolist()
    # This should never be hit, but just in case...
    except:
        return "NO RADIUS DATA AVAILABLE"


def get_mass(bod_id):

    # returns the mass of a body in kg

    G = 6.67430e-11

    try:
        return float(spice.bodvrd(bod_id, "GM", 1)[1][0] / (G/1000000000))
    # This should never be hit, but just in case...
    except:
        return "NO MASS DATA AVAILABLE"


def get_rotation_data(bod_id, bod_name):

    try:
        target_RA_all = spice.bodvrd(bod_id, "POLE_RA", 3)[1].tolist()
        target_DEC_all = spice.bodvrd(bod_id, "POLE_DEC", 3)[1].tolist()
        target_PM_all = spice.bodvrd(bod_id, "PM", 3)[1].tolist()

        target_RA_j2000 = target_RA_all[0]
        target_DEC_j2000 = target_DEC_all[0]
        target_PM_j2000 = target_PM_all[0]

        # Get right ascension and declination polynomial coefficients
        target_RA_delta = target_RA_all[1]
        target_DEC_delta = target_DEC_all[1]
        target_PM_delta = target_PM_all[1]

        ret_dict = {
            "ra": target_RA_j2000,
            "ra_delta": target_RA_delta,
            "dec": target_DEC_j2000,
            "dec_delta": target_DEC_delta,
            "pm": target_PM_j2000,
            "pm_delta": target_PM_delta
        }
    # this except should never be hit, but just in case...
    except:
        ret_dict = "NO ROTATION DATA AVAILABLE"
        return ret_dict

    # get NUT_PREC_RA, NUT_PREC_DEC and NUT_PREC_ANGLES
    try:
        target_NUT_PREC_RA = spice.bodvrd(bod_id, "NUT_PREC_RA", 20)
        target_NUT_PREC_DEC = spice.bodvrd(bod_id, "NUT_PREC_DEC", 20)

        ret_dict['nut_prec_ra'] = target_NUT_PREC_RA[1].tolist()[:target_NUT_PREC_RA[0]]
        ret_dict['nut_prec_dec'] = target_NUT_PREC_DEC[1].tolist()[:target_NUT_PREC_DEC[0]]

        try:
            target_NUT_PREC_ANGLES = spice.bodvrd(bod_name + " BARYCENTER", "NUT_PREC_ANGLES", 72)
            ret_dict['nut_prec_angles'] = target_NUT_PREC_ANGLES[1].tolist()[:target_NUT_PREC_ANGLES[0]]
        # the case where there are no nutation-precession angles for the body
        except:
            pass
    # the case where there is no nutation-precession info for the body -- go on to the next loop iteration
    except:
        pass

    return ret_dict


def returnResponse(response, status):
    response_pickled = jsonpickle.encode(response)

    return Response(response=response_pickled, status=status, mimetype="application/json")


@app.route('/api/positions2/<string:ref_frame>/<string:targets>/<string:curVizJd>/<string:curVizJdDelta>/<string:tailLenJd>/<int:validSeconds>', methods=['GET'])
def get_object_positions2(ref_frame, targets, curVizJd, curVizJdDelta, tailLenJd, validSeconds):

    # convert string of targets into a list -- ensure lower case for consistency
    targets_list = [target.lower() for target in targets.split('+')]

    ref_frame = ref_frame.lower()

    # check to make sure the reference frame and targets are valid
    if not aether_bodies.isValidRefFrame(ref_frame): #ref_frame not in valid_targets:
        return returnResponse({'error': '{} is not a valid reference frame.'.format(ref_frame)}, 400)

    for target in targets_list:
        if (not aether_bodies.isValidID(target)) and (not aether_bodies.isValidName(target)): #target not in valid_targets:
            return returnResponse({'error': '{} is not a known target.'.format(target)}, 401)

    # TODO: consider modifying api params to only accept floats instead of strings
    try:
        curVizJd = float(curVizJd)
        curVizJdDelta = float(curVizJdDelta)
        tailLenJd = float(tailLenJd)
    except ValueError:
        return returnResponse({'error': 'curVizJd, curVizJdDelta, tailLenJd must all be floats.'}, 402)

    # assume 60 fps as an upper bound -- this ensures that the data is valid for at least validSeconds
    # validSeconds specifies the amount of real time the returned data will be valid for in the frontend
    jd_end = curVizJd + (curVizJdDelta * 60 * validSeconds)

    jd_start = curVizJd - tailLenJd

    # ensure jd_end is a multiple of the current JD delta
    if tailLenJd % curVizJdDelta > 0.00000001:  # TODO: is this value small enough to account for round off error
        return returnResponse({'error': 'tailLenJd must be evenly divisible by curVizJdDelta.'}, 403)

    # Convert back to string and add 'jd ' to the front for SPICE
    startDate = 'jd ' + str(jd_start)
    # endDate = 'jd ' + str(jd_end)

    # ----- REMEMBER: ET (ephemeris time) is simply seconds past J2000 epoch. J2000 epoch is JD 2451545.0 -----

    # calculate ET times from date/time strings
    try:
        etStart = spice.str2et(startDate)
        etDelta = curVizJdDelta * 86400  # Since JD is in days and ET is in seconds, simply multiply by seconds in a day
        # etEnd = spice.str2et(endDate)  # todo: consider removing
    except Exception as error:

        return returnResponse({'error': error}, 405)

    # TODO: logic for creating more steps (i.e. more than one coord per tick) when curVizJdDelta is exceptionally large

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

    response_data = dict()

    # gather data for each target
    for i, target in enumerate(targets_list):
        # create a list of times based on ET start, ET end and number of steps for current target
        # times = [x * (etEnd - etStart) / steps_list[i] + etStart for x in range(steps_list[i])]

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

    return returnResponse(response_data, 200)


@app.route('/api/positions/<string:ref_frame>/<string:targets>/<string:startDate>/<string:endDate>/<string:steps>', methods=['GET'])
def get_object_positions(ref_frame, targets, startDate, endDate, steps):

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
            'info': 'Positions (x,y,z) and times (J2000) of {} w.r.t. {}'.format(target.capitalize(),
                                                                                 ref_frame.capitalize()),
            'positions': [coord.tolist() for coord in target_positions],  # times is a numpy.ndarray
            'times': times
        }

    return returnResponse(response_data, 200)


@app.route('/api/available-bodies/', methods=['GET'])
def get_available_bodies():

    known_bodies = aether_bodies.getBodies()

    # get rotation, mass, radius, min-max speeds for each body
    # print(len(known_bodies))

    for bod_dict in known_bodies:

        # print(bod_dict)

        bod_id = str(bod_dict['spice id'])

        min_max_speeds = get_min_max_speed(bod_id, bod_dict['valid times'])
        bod_dict['min speed'] = min_max_speeds[0]
        bod_dict['max speed'] = min_max_speeds[1]

        if bod_dict['has radius data']:
            bod_dict['radius'] = get_radius(bod_id)

        if bod_dict['has mass data']:
            bod_dict['mass'] = get_mass(bod_id)

        if bod_dict['has rotation data']:
            bod_dict['rotation data'] = get_rotation_data(bod_id, bod_dict['body name'])

    return returnResponse(known_bodies, 200)


@app.route('/api/spk-upload/', methods=['POST'])
def spk_upload():
    global aether_bodies

    spk_extension = '.bsp'

    # check if the post request has the file part
    if 'file' not in request.files:
        return returnResponse({'error': 'No file part in the request.'}, 400)

    file = request.files['file']

    if file.filename == '':
        return returnResponse({'error': 'No file selected for uploading'}, 400)

    filename = secure_filename(file.filename)

    if not filename.endswith(spk_extension):

        return returnResponse({'error': 'Only .bsp files are allowed.'})

    else:

        file_path = 'SPICE/kernels/user_uploaded/' + filename

        file.save(file_path)

        spice.furnsh(file_path)

        new_bodies = aether_bodies.addFromKernel(file_path, returnNewBodies=True)

        for bod_dict in new_bodies:

            bod_id = str(bod_dict['spice id'])

            min_max_speeds = get_min_max_speed(bod_id, bod_dict['valid times'])
            bod_dict['min speed'] = min_max_speeds[0]
            bod_dict['max speed'] = min_max_speeds[1]

            if bod_dict['has radius data']:
                bod_dict['radius'] = get_radius(bod_id)

            if bod_dict['has rotation data']:
                bod_dict['rotation data'] = get_rotation_data(bod_id, bod_dict['body name'])

        # DEBUG
        # print(new_bodies)

        spice.furnsh(file_path)

        return returnResponse(new_bodies, 200)


@app.route('/api/spk-clear/', methods=['GET'])
def clear_uploaded_kernels():

    global aether_bodies

    removed_bod_names = aether_bodies.removeUploadedKernels()

    return returnResponse(removed_bod_names, 200)


# TODO: remove these two endpoints
@app.route('/api/body-radius/<string:targets>', methods=['GET'])
def get_body_info(targets):

    # valid_targets = ('SUN','MERCURY','VENUS','MOON','EARTH','IO','EUROPA','GANYMEDE','CALLISTO','AMALTHEA','THEBE',
    #                  'ADRASTEA','METIS','JUPITER','PHOBOS','DEIMOS','MARS','TRITON','NEREID','PROTEUS','NEPTUNE','CHARON',
    #                  'PLUTO','MIMAS','ENCELADUS','TETHYS','DIONE','RHEA','TITAN','HYPERION','IAPETUS','PHOEBE','HELENE',
    #                  'TELESTO','CALYPSO','METHONE','POLYDEUCES','SATURN','ARIEL','UMBRIEL','TITANIA','OBERON','MIRANDA','URANUS')

    targets_list = [target.lower() for target in targets.split('+')]

    response_data = dict()

    for target in targets_list:

        # TODO: remove when all calls are based on key
        target_id = aether_bodies.getBodyID(target)

        if not aether_bodies.hasRadiusData(target_id): #target not in valid_targets:
            response_data[target] = "NO RADIUS DATA AVAILABLE"

        else:
            try:
                response_data[target] = spice.bodvrd(target, "RADII", 3)[1].tolist()
            except:
                response_data[target] = "NO RADIUS DATA AVAILABLE"

    # print(type(response_data[target][0]))
    return returnResponse(response_data, '200')


@app.route('/api/rotations/<string:targets>', methods=['GET'])
def get_object_rotation(targets):

    # valid_targets = ('SUN', 'MERCURY', 'VENUS', 'MOON', 'EARTH', 'IO', 'EUROPA', 'GANYMEDE', 'CALLISTO', 'AMALTHEA',
    #                  'THEBE', 'ADRASTEA', 'METIS', 'JUPITER', 'PHOBOS', 'DEIMOS', 'MARS', 'TRITON', 'PROTEUS', 'NEPTUNE',
    #                  'CHARON', 'PLUTO', 'MIMAS', 'ENCELADUS', 'TETHYS', 'DIONE', 'RHEA', 'TITAN', 'IAPETUS', 'PHOEBE',
    #                  'HELENE', 'TELESTO', 'CALYPSO', 'SATURN', 'ARIEL', 'UMBRIEL', 'TITANIA', 'OBERON', 'MIRANDA', 'URANUS')

    targets_list = [target.lower() for target in targets.split('+')]

    response_data = dict()

    for target in targets_list:

        # TODO: remove when all calls are based on key
        target_id = aether_bodies.getBodyID(target)

        if not aether_bodies.hasRotationData(target_id): #target not in valid_targets:
            response_data[target] = "NO ROTATION DATA AVAILABLE"
        else:
            try:
                target_RA_all = spice.bodvrd(target, "POLE_RA", 3)[1].tolist()
                target_DEC_all = spice.bodvrd(target, "POLE_DEC", 3)[1].tolist()
                target_PM_all = spice.bodvrd(target, "PM", 3)[1].tolist()

                target_RA_j2000 = target_RA_all[0]
                target_DEC_j2000 = target_DEC_all[0]
                target_PM_j2000 = target_PM_all[0]

                # Get right ascension and declination polynomial coefficients
                target_RA_delta = target_RA_all[1]
                target_DEC_delta = target_DEC_all[1]
                target_PM_delta = target_PM_all[1]

                response_data[target] = {
                    "ra": target_RA_j2000,
                    "ra_delta": target_RA_delta,
                    "dec": target_DEC_j2000,
                    "dec_delta": target_DEC_delta,
                    "pm": target_PM_j2000,
                    "pm_delta": target_PM_delta
                }
            # this except should never be hit, but just in case...
            except:
                response_data[target] = "NO ROTATION DATA AVAILABLE"
                continue

            # get NUT_PREC_RA, NUT_PREC_DEC and NUT_PREC_ANGLES
            try:
                target_NUT_PREC_RA = spice.bodvrd(target, "NUT_PREC_RA", 20)
                target_NUT_PREC_DEC = spice.bodvrd(target, "NUT_PREC_DEC", 20)

                response_data[target]["nut_prec_ra"] = target_NUT_PREC_RA[1].tolist()[:target_NUT_PREC_RA[0]]
                response_data[target]["nut_prec_dec"] = target_NUT_PREC_DEC[1].tolist()[:target_NUT_PREC_DEC[0]]
            # the case where there is no nutation-precession info for the body -- go on to the next loop iteration
            except:
                continue

            try:
                target_NUT_PREC_ANGLES = spice.bodvrd(target + " BARYCENTER", "NUT_PREC_ANGLES", 72)
                response_data[target]["nut_prec_angles"] = target_NUT_PREC_ANGLES[1].tolist()[:target_NUT_PREC_ANGLES[0]]
            # the case where there are no nutation-precession angles for the body
            except:
                continue

    return returnResponse(response_data, 200)



if __name__ == '__main__':
    # create metakernel file
    mkw = MetakernelWriter()
    mkw.write()

    # load the kernels
    spice.furnsh("./SPICE/kernels/cumulative_metakernel.tm")

    signal(SIGINT, exitNicely)

    # start the server
    app.run(host="0.0.0.0", port=5000, threaded=False)
