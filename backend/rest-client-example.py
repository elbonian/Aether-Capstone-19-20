import requests
import json
import argparse
from pprint import pprint
import time


def get_solar_target_positions(ip, ref_frame, target_list, startDate, endDate, steps_list):

	targets = '+'.join(target_list)

	steps = '+'.join(steps_list)

	# REST server uses port 5000
	addr = 'http://{}:5000/api/positions/{}/{}/{}/{}/{}'.format(ip, ref_frame, targets, startDate, endDate, steps)

	# make the request and get the response
	response = requests.get(addr)

	# decode response
	return response, json.loads(response.text)


def get_body_info(ip):

	addr = 'http://{}:5000/api/available-bodies/'.format(ip)

	# make the request and get the response
	response = requests.get(addr)

	# decode response
	return response, json.loads(response.text)

def get_rotation_info(ip, targets):

	all_targets = '+'.join(targets)

	addr = 'http://{}:5000/api/rotations/{}'.format(ip, all_targets)

	# make the request and get the response
	response = requests.get(addr)

	# decode response
	return response, json.loads(response.text)

def get_radius(ip, targets):

	all_targets = '+'.join(targets)

	addr = 'http://{}:5000/api/body-info/{}'.format(ip, all_targets)

	# make the request and get the response
	response = requests.get(addr)

	# decode response
	return response, json.loads(response.text)

if __name__ == '__main__':
	parser = argparse.ArgumentParser(
	    description='A script to test the planet-traj-rest-server.',
	    formatter_class=argparse.RawDescriptionHelpFormatter)

	parser.add_argument('ip', help='IP of the machine to test.')
	# parser.add_argument('planet', help='Planet to get positions for.')
	parser.add_argument('start_date_time', help='Beginning date/time. Format: YYYY-MM-DD OR YYYY-MM-DDThh:mm:ss')
	parser.add_argument('end_date_time', help='Ending date/time. Format: YYYY-MM-DD OR YYYY-MM-DDThh:mm:ss')
	# parser.add_argument('steps', type=int, help='Number of data points (within the date range) to collect.')

	ref_frame = 'solar system barycenter'

	target_list = ['mercury', 'venus', 'earth', 'mars', 'europa', 'charon', 'titan', 'moon']

	# steps_list = ['5']
	steps_list = ['1', '1', '1', '1', '1', '1', '1', '1']

	args = parser.parse_args()

	pprint("Response: {}".format(get_solar_target_positions(args.ip, ref_frame, target_list, args.start_date_time, args.end_date_time, steps_list)))
	# print('-------------------------------------------------')
	time_start = time.time()

	bod_info_resp = get_body_info(args.ip)

	time_end = time.time()
	print("Response:", bod_info_resp[0])
	pprint(bod_info_resp[1])

	print("Time taken:", time_end - time_start)
	#
	# valid_targets = ['SUN', 'MERCURY', 'VENUS', 'MOON', 'EARTH', 'IO', 'EUROPA', 'GANYMEDE', 'CALLISTO', 'AMALTHEA',
	# 				 'THEBE', 'ADRASTEA', 'METIS', 'JUPITER', 'PHOBOS', 'DEIMOS', 'MARS', 'TRITON', 'NEREID', 'PROTEUS',
	# 				 'NEPTUNE', 'CHARON', 'NIX', 'HYDRA','KERBEROS', 'STYX', 'PLUTO', 'MIMAS', 'ENCELADUS', 'TETHYS',
	# 				 'DIONE', 'RHEA', 'TITAN', 'HYPERION', 'IAPETUS', 'PHOEBE', 'HELENE', 'TELESTO', 'CALYPSO', 'METHONE',
	# 				 'POLYDEUCES', 'SATURN', 'ARIEL', 'UMBRIEL', 'TITANIA', 'OBERON', 'MIRANDA', 'URANUS']
	#
	# radii_resp = get_radius(args.ip, valid_targets)
	# print("Response:", radii_resp[0])
	# pprint(radii_resp[1])
	#
	# rotation_resp = get_rotation_info(args.ip, valid_targets)
	# print("Response:", rotation_resp[0])
	# pprint(rotation_resp[1])

