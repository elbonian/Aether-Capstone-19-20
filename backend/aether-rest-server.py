# CU Boulder CS Capstone - NASA/JPL Group (Aether)
# Spring 2020
# Maintainer: Aether

from flask import Flask, Response, request
from werkzeug.utils import secure_filename
import jsonpickle
from signal import signal, SIGINT
import re
# import numpy as np
import spiceypy as spice
from flask_cors import CORS
from db_connect import Database
# from SPKParser import SPKParser
from AetherBodies import AetherBodies
from MetakernelWriter import MetakernelWriter
# from os import stat

# Initialize the Flask application
app = Flask(__name__)
CORS(app)
aether_bodies = AetherBodies()


def exitNicely(sig, frame):
    spice.kclear()
    print("\nCleared loaded kernels.\nExiting...")
    exit(0)


def returnResponse(response, status):
    response_pickled = jsonpickle.encode(response)

    return Response(response=response_pickled, status=status, mimetype="application/json")


@app.route('/api/positions2/<string:ref_frame>/<string:targets>/<string:curVizJd>/<string:curVizJdDelta>/<string:tailLenJd>/<int:validSeconds>', methods=['GET'])
def get_object_positions2(ref_frame, targets, curVizJd, curVizJdDelta, tailLenJd, validSeconds):
    # valid_targets = ('solar system barycenter', 'sun', 'mercury barycenter', 'mercury', 'venus barycenter', 'venus',
    #                  'earth barycenter', 'mars barycenter', 'jupiter barycenter', 'saturn barycenter',
    #                  'uranus barycenter', 'neptune barycenter', 'pluto barycenter', 'earth', 'moon', 'mars', 'phobos',
    #                  'deimos', 'jupiter', 'io', 'europa', 'ganymede', 'callisto', 'amalthea', 'thebe', 'adrastea',
    #                  'metis', 'saturn', 'mimas', 'enceladus', 'tethys', 'dione', 'rhea', 'titan', 'hyperion', 'iapetus',
    #                  'phoebe', 'helene', 'telesto', 'calypso', 'methone', 'polydeuces', 'uranus', 'ariel', 'umbriel',
    #                  'titania', 'oberon', 'miranda', 'neptune', 'triton', 'nereid', 'proteus', 'pluto', 'charon', 'nix',
    #                  'hydra', 'kerberos', 'styx', '-31', '-32')

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

    # TODO: put this outside the function so that it does not execute on every api call
    # load the kernels
    # spice.furnsh("./SPICE/kernels/cumulative_metakernel.tm")

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


# TODO: cookies?
@app.route('/api/body-list/', methods=['GET'])
def get_available_bodies():
    top_level_dropdown_elems = ('mercury', 'venus', 'earth', 'mars', 'asteroids', 'jupiter', 'saturn', 'uranus',
                                'neptune', 'pluto')

    db = Database('aether_backend_data.db')

    results = {
        'SUN': {}
    }

    for elem in top_level_dropdown_elems:

        # convert to upper case since DB values are all upper case # todo consider changing set so this isn't needed
        elem = elem.upper()

        if elem != 'ASTEROIDS':

            # group by name to remove duplicates
            sql = "SELECT name FROM Body WHERE wrt LIKE '{}%' GROUP BY name".format(elem)

            query_res = db.executeQuery(sql, variables=[])

            body_list = [body['name'] for body in query_res]

            results[elem] = {}

            for body in body_list:
                # make sure we're not searching for sub-bodies in a circle
                if body != elem:
                    sql = "SELECT name FROM Body WHERE wrt LIKE '{}%' GROUP BY name".format(body)
                    query_res = db.executeQuery(sql, variables=[])
                    sub_body_list = [sub_body['name'] for sub_body in query_res]
                    results[elem][body] = {}
                    for sub_body in sub_body_list:
                        results[elem][body][sub_body] = {}
        else:
            sql = "SELECT name FROM Body WHERE path = ? GROUP BY name"

            query_res = db.executeQuery(sql, variables=['SPICE/kernels/Sun/codes_300ast_20100725.bsp'])

            body_list = [body['name'] for body in query_res]

            results[elem] = {}

            for body in body_list:
                results[elem][body] = {}

    db.closeDatabase()

    return returnResponse(results, 200)

@app.route('/api/available-bodies/', methods=['GET'])
def get_available_bodies2():
    return returnResponse(aether_bodies.getBodies(), 200)


# consider changing name to get-body-radius and refactoring
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


@app.route('/api/spk-upload', methods=['POST'])
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

        # spk_parser = SPKParser()
        #
        # # TODO: wrap this in a try-except and have the parser class raise an exception if the file is bad
        # uploaded_spk_info = spk_parser.parse(file_path)
        # # keys: bodies -> [(body name, wrt, naif id)], start_date, end_date
        #
        # spk_size_bytes = stat(file_path).st_size
        #
        # db = Database('aether_backend_data.db')
        #
        # sql = "INSERT INTO Kernel (path, start_date, end_date, size) VALUES (?, ?, ?, ?)"
        #
        # db.executeNonQuery(sql, variables=[file_path, uploaded_spk_info['time_start'], uploaded_spk_info['time_end'],
        #                                    spk_size_bytes])
        #
        # for body_tuple in uploaded_spk_info['bodies']:
        #     sql = "INSERT INTO Body (path, name, wrt, naif_id) VALUES (?, ?, ?, ?)"
        #
        #     db.executeNonQuery(sql, variables=[file_path, body_tuple[0], body_tuple[1], body_tuple[2]])
        #
        # db.closeDatabase()

        new_bodies = aether_bodies.addFromKernel(file_path, returnNewBodies=True)

        # DEBUG
        # print(new_bodies)

        spice.furnsh(file_path)

        return returnResponse(new_bodies, 200)


if __name__ == '__main__':
    # create metakernel file
    mkw = MetakernelWriter()
    mkw.write()

    # load the kernels
    spice.furnsh("./SPICE/kernels/cumulative_metakernel.tm")

    signal(SIGINT, exitNicely)

    # start the server
    app.run(host="0.0.0.0", port=5000, threaded=False)
