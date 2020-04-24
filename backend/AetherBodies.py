# CU Boulder CS Capstone - NASA/JPL Group (Aether)
# Spring 2020
# Maintainer: Aether


from os import walk, path
from datetime import datetime
from SPKParser import SPKParser

from pprint import pprint


def toDatetime(spice_datetime_str):
    return datetime.strptime(spice_datetime_str, "%Y %b %d %H:%M:%S.%f")

def fromDatetime(dtime_obj):
    return dtime_obj.strftime("%Y-%m-%d %H:%M:%S.%f")


class AetherBodies:

    def __init__(self):

        self.spk_parser = SPKParser()

        # name, id, [(time_start, time_end)...], rotation_data, radius_data, orbiting_body
        # default_bodies_test = {
        #     10: ("sun", [("1549 DEC 31 00:00:00.000", "2650 JAN 25 00:00:00.000")], True, True, None),
        #     199: ("mercury", [("1549 DEC 31 00:00:00.000", "2650 JAN 25 00:00:00.000")], True, True, 10),
        #     299: ("venus", [("1549 DEC 31 00:00:00.000", "2650 JAN 25 00:00:00.000")], True, True, 10),
        #     399: ("earth", [("1549 DEC 31 00:00:00.000", "2650 JAN 25 00:00:00.000")], True, True, 10),
        #     301: ("moon", [("1549 DEC 31 00:00:00.000", "2650 JAN 25 00:00:00.000")], True, True, 399),
        #     499: ("mars", [("1900 JAN 04 00:00:41.184", "2100 JAN 01 00:01:07.183")], True, True, 10),
        #     401: ("phobos", [("1900 JAN 04 00:00:41.184", "2100 JAN 01 00:01:07.183")], True, True, 499),
        #     402: ("deimos", [("1900 JAN 04 00:00:41.184", "2100 JAN 01 00:01:07.183")], True, True, 499),
        #     599: ("jupiter", [("1850 JAN 01 00:00:41.183", "2100 JAN 01 00:01:09.183")], True, True, 10),
        #     501: ("io", [("1850 JAN 01 00:00:41.183", "2100 JAN 01 00:01:09.183")], True, True, 599),
        #     502: ("europa", [("1850 JAN 01 00:00:41.183", "2100 JAN 01 00:01:09.183")], True, True, 599),
        #     503: ("ganymede", [("1850 JAN 01 00:00:41.183", "2100 JAN 01 00:01:09.183")], True, True, 599),
        #     504: ("callisto", [("1850 JAN 01 00:00:41.183", "2100 JAN 01 00:01:09.183")], True, True, 599),
        #     505: ("amalthea", [("1850 JAN 01 00:00:41.183", "2100 JAN 01 00:01:09.183")], True, True, 599),
        #     514: ("thebe", [("1850 JAN 01 00:00:41.183", "2100 JAN 01 00:01:09.183")], True, True, 599),
        #     515: ("adrastea", [("1850 JAN 01 00:00:41.183", "2100 JAN 01 00:01:09.183")], True, True, 599),
        #     516: ("metis", [("1850 JAN 01 00:00:41.183", "2100 JAN 01 00:01:09.183")], True, True, 599),
        #     699: ("saturn", [("1950 JAN 01 00:00:41.183", "2050 JAN 01 00:01:09.183")], True, True, 10),
        #     601: ("mimas", [("1950 JAN 01 00:00:41.183", "2050 JAN 01 00:01:09.183")], True, True, 699),
        #     602: ("enceladus", [("1950 JAN 01 00:00:41.183", "2050 JAN 01 00:01:09.183")], True, True, 699),
        #     603: ("tethys", [("1950 JAN 01 00:00:41.183", "2050 JAN 01 00:01:09.183")], True, True, 699),
        #     604: ("dione", [("1950 JAN 01 00:00:41.183", "2050 JAN 01 00:01:09.183")], True, True, 699),
        #     605: ("rhea", [("1950 JAN 01 00:00:41.183", "2050 JAN 01 00:01:09.183")], True, True, 699),
        #     606: ("titan", [("1950 JAN 01 00:00:41.183", "2050 JAN 01 00:01:09.183")], True, True, 699),
        #     607: ("hyperion", [("1950 JAN 01 00:00:41.183", "2050 JAN 01 00:01:09.183")], False, True, 699),
        #     608: ("iapetus", [("1950 JAN 01 00:00:41.183", "2050 JAN 01 00:01:09.183")], True, True, 699),
        #     609: ("phoebe", [("1950 JAN 01 00:00:41.183", "2050 JAN 01 00:01:09.183")], True, True, 699),
        #     612: ("helene", [("1950 JAN 01 00:00:41.183", "2050 JAN 01 00:01:09.183")], True, True, 699),
        #     613: ("telesto", [("1950 JAN 01 00:00:41.183", "2050 JAN 01 00:01:09.183")], True, True, 699),
        #     614: ("calypso", [("1950 JAN 01 00:00:41.183", "2050 JAN 01 00:01:09.183")], True, True, 699),
        #     632: ("methone", [("1950 JAN 01 00:00:41.183", "2050 JAN 01 00:01:09.183")], False, True, 699),
        #     634: ("polydeuces", [("1950 JAN 01 00:00:41.183", "2050 JAN 01 00:01:09.183")], False, True, 699),
        #     799: ("uranus", [("1900 JAN 01 00:00:41.183", "2099 DEC 24 00:01:07.183")], True, True, 10),
        #     701: ("ariel", [("1900 JAN 01 00:00:41.183", "2099 DEC 24 00:01:07.183")], True, True, 799),
        #     702: ("umbriel", [("1900 JAN 01 00:00:41.183", "2099 DEC 24 00:01:07.183")], True, True, 799),
        #     703: ("titania", [("1900 JAN 01 00:00:41.183", "2099 DEC 24 00:01:07.183")], True, True, 799),
        #     704: ("oberon", [("1900 JAN 01 00:00:41.183", "2099 DEC 24 00:01:07.183")], True, True, 799),
        #     705: ("miranda", [("1900 JAN 01 00:00:41.183", "2099 DEC 24 00:01:07.183")], True, True, 799),
        #     899: ("neptune", [("1900 JAN 01 00:00:41.183", "2100 JAN 01 00:01:07.183")], True, True, 10),
        #     801: ("triton", [("1900 JAN 01 00:00:41.183", "2100 JAN 01 00:01:07.183")], True, True, 899),
        #     802: ("nereid", [("1900 JAN 01 00:00:41.183", "2100 JAN 01 00:01:07.183")], False, True, 899),
        #     808: ("proteus", [("1900 JAN 01 00:00:41.183", "2100 JAN 01 00:01:07.183")], True, True, 899),
        #     999: ("pluto", [("1900 JAN 08 00:00:41.184", "2100 JAN 01 00:01:08.183")], True, True, 10),
        #     901: ("charon", [("1900 JAN 08 00:00:41.184", "2100 JAN 01 00:01:08.183")], True, True, 999),
        #     902: ("nix", [("1900 JAN 08 00:00:41.184", "2100 JAN 01 00:01:08.183")], False, False, 999),
        #     903: ("hydra", [("1900 JAN 08 00:00:41.184", "2100 JAN 01 00:01:08.183")], False, False, 999),
        #     904: ("kerberos", [("1900 JAN 08 00:00:41.184", "2100 JAN 01 00:01:08.183")], False, False, 999),
        #     905: ("styx", [("1900 JAN 08 00:00:41.184", "2100 JAN 01 00:01:08.183")], False, False, 999)
        # }

        ########## FORMAT OF BODIES DICTIONARY ##########
        # key: NAIF ID <int>
        # value: data tuple
        #     ( name <str>, valid times <list of tuples> (time_start <datetime>, time_end <datetime>),
        #       rotationData <bool>, radiusData <bool>, category <int>, uploaded <bool> )
        ##
        self.bodies = dict()

        self.barycenters = [(0, "solar system barycenter"), (1, "mercury barycenter"), (2, "venus barycenter"),
                            (3, "earth barycenter"), (4, "mars barycenter"), (5, "jupiter barycenter"),
                            (6, "saturn barycenter"), (7, "uranus barycenter"), (8, "neptune barycenter"),
                            (9,"pluto barycenter")]

        self.no_rotation = (607, 632, 634, 802, 902, 903, 905, 905)
        self.no_radius = (902, 903, 905, 905)

        for root, dirs, files in walk('./SPICE/kernels/default/', topdown=True):
            for name in files:
                kern_path = path.join(root, name)
                if kern_path.endswith('.bsp'):
                    self.addFromKernel(kern_path)

        for root, dirs, files in walk('./SPICE/kernels/user_uploaded/', topdown=True):
            for name in files:
                kern_path = path.join(root, name)
                if kern_path.endswith('.bsp'):
                    self.addFromKernel(kern_path)

    def addFromKernel(self, kern_path, returnNewBodies=False):

        newly_added_bodies = list()

        merge_time_ids = list()

        uploaded = False

        if 'user_uploaded' in kern_path.split('/'):
            uploaded = True

        parsed_bodies = self.spk_parser.parse(kern_path)
        for bod_group in parsed_bodies:
            # Disregard barycenters
            for body_tuple in [tupe for tupe in bod_group['bodies'] if not tupe[0].endswith('BARYCENTER')]:
                body_id = body_tuple[2]
                if body_id not in self.bodies:
                    # categories: -1 = spacecraft, -2 = asteroids, -3 = comets, -4 = misc, positive = orbiting that body
                    category = -4
                    if body_id < 0:
                        category = -1
                    elif body_id > 2000000:
                        category = -2
                    elif 1000000 < body_id < 2000000:
                        category = -3
                    elif 100 < body_id < 1000:
                        if body_id % 100 == 99:
                            category = 10
                        else:
                            category = int(str(body_id // 100) + "99")
                    elif body_id == 10:
                        category = 10
                    if not uploaded:
                        self.bodies[body_id] = [
                            body_tuple[0].lower(),
                            [(toDatetime(bod_group['time_start']), toDatetime(bod_group['time_end']))],
                            body_id not in self.no_rotation,
                            body_id not in self.no_radius,
                            category,
                            uploaded
                        ]
                    else:
                        self.bodies[body_id] = [
                            body_tuple[0].lower(),
                            [(toDatetime(bod_group['time_start']), toDatetime(bod_group['time_end']))],
                            False,
                            False,
                            category,
                            uploaded
                        ]
                    newly_added_bodies.append(body_id)
                else:
                    self.bodies[body_id][1].append((toDatetime(bod_group['time_start']),
                                                    toDatetime(bod_group['time_end'])))
                    merge_time_ids.append(body_id)

        # # TODO: merge times here
        # time_start = toDatetime(bod_group['time_start'])
        # time_end = bod_group['time_end']
        # if time_start < self.default_bodies[body_id][1][0]:
        #     if time_end > self.default_bodies[body_id][1][1]:
        #         self.default_bodies[body_id][1] = [(time_start, time_end)]
        #     elif time_end < self.default_bodies[body_id][1][0]:
        #         self.default_bodies[body_id][1].append()

        if returnNewBodies:
            return self.getBodies(specific_ids=newly_added_bodies)

    def isValidID(self, bod_id):

        return bod_id in self.bodies

    def isValidName(self, bod_name):

        # TODO: check for duplicates?
        names = [tupe[0] for tupe in self.bodies.values()]

        return bod_name in names

    def getBodyID(self, bod_name):

        # ensure lowercase
        bod_name = bod_name.lower()

        # this returns the first encountered instance if there are multiple bodies with the same name
        for key, value in self.bodies.items():
            if value[0] == bod_name:
                return key

        raise KeyError("Body {} does not exist in the dictionary.".format(bod_name))

    def isValidRefFrame(self, ref_frame):
        if type(ref_frame) == int:
            return ref_frame in [tupe[0] for tupe in self.barycenters] or self.isValidID(ref_frame)
        elif type(ref_frame) == str:
            return ref_frame in [tupe[1] for tupe in self.barycenters] or self.isValidName(ref_frame)
        else:
            raise TypeError("Method only accepts int or str.")

    def hasRotationData(self, bod_id):
        # python short-circuits by default so this works even if the ID isn't valid
        return self.isValidID(bod_id) and self.bodies[bod_id][2]

    def hasRadiusData(self, bod_id):
        # python short-circuits by default so this works even if the ID isn't valid
        return self.isValidID(bod_id) and self.bodies[bod_id][3]

    def getBodies(self, specific_ids=[]):
        if not specific_ids:
            return self.__flattenDict(self.bodies)
        else:
            return self.__flattenDict(dict(
                (bod_id, self.bodies[bod_id]) for bod_id in specific_ids if self.isValidID(bod_id)
            ))

    def __flattenDict(self, body_dict):
        ret_list = list()

        for key, value in body_dict.items():
            ret_list.append({
                'spice id': key,
                'body name': value[0],
                'has rotation data': value[2],
                'has radius data': value[3],
                'category': self.__categoryToString(value[4], key),
                'valid times': [[fromDatetime(dtime) for dtime in list(tupe)] for tupe in value[1]],
                'is uploaded': value[5]
            })

        return ret_list

    def __categoryToString(self, cat_int, bod_id):
        # categories: -1 = spacecraft, -2 = asteroids, -3 = comets, -4 = misc, positive = orbiting that body
        if cat_int > 0:
            if cat_int == 10:
                return self.bodies[bod_id][0]
            else:
                return self.bodies[self.bodies[bod_id][4]][0]
        elif cat_int == -1:
            return 'spacecraft'
        elif cat_int == -2:
            return 'asteroid'
        elif cat_int == -3:
            return 'comet'
        else:
            return 'misc'

    def debugPrint(self):
        pprint(self.bodies)

