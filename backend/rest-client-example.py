import requests
import json
import argparse
from pprint import pprint


def get_solar_target_positions(ip, ref_frame, target_list, startDate, endDate, steps_list):

	targets = '+'.join(target_list)

	steps = '+'.join(steps_list)

	# REST server uses port 5000
	addr = 'http://{}:5000/api/positions/{}/{}/{}/{}/{}'.format(ip, ref_frame, targets, startDate, endDate, steps)

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
	steps_list = ['5', '10', '15', '20', '25', '30', '35', '40']

	args = parser.parse_args()

	pprint("Response: {}".format(get_solar_target_positions(args.ip, ref_frame, target_list, args.start_date_time, args.end_date_time, steps_list)))