import requests
import json
import argparse


def request_planet(ip, planet, startDate, endDate, steps):

	# REST server uses port 5000
	addr = 'http://{}:5000/api/planets/{}/{}/{}/{}'.format(ip, planet, startDate, endDate, steps)

	# make the request and get the response
	response = requests.get(addr)

	# decode response
	return response, json.loads(response.text)



if __name__ == '__main__':
	parser = argparse.ArgumentParser(
	    description='A script to test the planet-traj-rest-server.',
	    formatter_class=argparse.RawDescriptionHelpFormatter)
	parser.add_argument('ip', help='IP of the machine to test.')
	parser.add_argument('planet', help='Planet to get positions for.')
	parser.add_argument('start_date_time', help='Beginning date/time. Format: YYYY-MM-DD OR YYYY-MM-DDThh:mm:ss')
	parser.add_argument('end_date_time', help='Ending date/time. Format: YYYY-MM-DD OR YYYY-MM-DDThh:mm:ss')
	parser.add_argument('steps', type=int, help='Number of data points (within the date range) to collect.')


	args = parser.parse_args()

	print("Response: {}".format(request_planet(args.ip, args.planet, args.start_date_time, args.end_date_time, args.steps)))
