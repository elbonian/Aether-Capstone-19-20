# CU Boulder CS Capstone - NASA/JPL Group (Aether)
# Spring 2020
# Maintainer: Aether


from os import walk, path, remove
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

        ########## FORMAT OF BODIES DICTIONARY ##########
        # key: NAIF ID <int>
        # value: data tuple
        #     ( name <str>, valid times <list of tuples> (time_start <datetime>, time_end <datetime>),
        #       rotationData <bool>, radiusData <bool>, massData <bool>, category <int>, uploaded <bool> )
        ##
        self.bodies = dict()

        self.barycenters = [(0, "solar system barycenter"), (1, "mercury barycenter"), (2, "venus barycenter"),
                            (3, "earth barycenter"), (4, "mars barycenter"), (5, "jupiter barycenter"),
                            (6, "saturn barycenter"), (7, "uranus barycenter"), (8, "neptune barycenter"),
                            (9,"pluto barycenter")]

        self.no_rotation = (607, 632, 634, 802, 902, 903, 904, 905)
        self.no_radius = (902, 903, 904, 905)
        self.no_mass = (905, 802, 808, 514, 515, 516, 612, 613, 614, 632, 634)
        self.asteroids_with_radius = (2000001, 2000004, 2000021, 2000433, 2000511)
        self.asteroids_with_mass = (2000001, 2000002, 2000003, 2000004, 2000006, 2000007, 2000010, 2000015, 2000016,
                                    2000029, 2000052, 2000065, 2000087, 2000088, 2000433, 2000511, 2000704)

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

        merge_time_ids = set()

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
                            body_id not in self.no_rotation and 9 < body_id < 1000,
                            self.__has_radius(body_id),
                            self.__has_mass(body_id),
                            category,
                            uploaded
                        ]
                    else:
                        self.bodies[body_id] = [
                            body_tuple[0].lower(),
                            [(toDatetime(bod_group['time_start']), toDatetime(bod_group['time_end']))],
                            False,
                            False,
                            False,
                            category,
                            uploaded
                        ]
                    newly_added_bodies.append(body_id)
                else:
                    self.bodies[body_id][1].append((toDatetime(bod_group['time_start']),
                                                    toDatetime(bod_group['time_end'])))
                    merge_time_ids.add(body_id)

        for body_id in merge_time_ids:
            merged_times = self.__mergeTimeIntervals(self.bodies[body_id][1])
            self.bodies[body_id][1] = merged_times

        if returnNewBodies:
            if newly_added_bodies:
                return self.getBodies(specific_ids=newly_added_bodies)
            else:
                return list()

    def isValidID(self, bod_id):

        return bod_id in self.bodies

    def isValidName(self, bod_name):

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

    def removeUploadedKernels(self):

        removed_body_list = list()

        for root, dirs, files in walk('./SPICE/kernels/user_uploaded/', topdown=True):
            for name in files:
                kern_path = path.join(root, name)
                if kern_path.endswith('.bsp'):
                    remove(kern_path)

        for bod_id in self.bodies.keys():
            if self.bodies[bod_id][6]:
                removed_body_list.append((self.bodies[bod_id][0], bod_id))

        for body_to_remove in removed_body_list:
            del self.bodies[body_to_remove[1]]

        return [bod[0] for bod in removed_body_list]

    def hasRotationData(self, bod_id):
        # python short-circuits by default so this works even if the ID isn't valid
        return self.isValidID(bod_id) and self.bodies[bod_id][2]

    def hasRadiusData(self, bod_id):
        # python short-circuits by default so this works even if the ID isn't valid
        return self.isValidID(bod_id) and self.bodies[bod_id][3]

    def hasMassData(self, bod_id):
        # python short-circuits by default so this works even if the ID isn't valid
        return self.isValidID(bod_id) and self.bodies[bod_id][4]

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
                'has mass data': value[4],
                'category': self.__categoryToString(value[5], key),
                'valid times': [[fromDatetime(dtime) for dtime in list(tupe)] for tupe in value[1]],
                'is uploaded': value[6]
            })

        return ret_list

    def __categoryToString(self, cat_int, bod_id):
        # categories: -1 = spacecraft, -2 = asteroids, -3 = comets, -4 = misc, positive = orbiting that body
        if cat_int > 0:
            if cat_int == 10:
                return self.bodies[bod_id][0]
            else:
                return self.bodies[self.bodies[bod_id][5]][0]
        elif cat_int == -1:
            return 'spacecraft'
        elif cat_int == -2:
            return 'asteroid'
        elif cat_int == -3:
            return 'comet'
        else:
            return 'misc'

    def __mergeTimeIntervals(self, time_intervals):

        # Adapted from original code by Thirumalai Srinivasan
        # https://www.geeksforgeeks.org/merging-intervals/

        # return immediately -- this should never happen, but just in case
        if len(time_intervals) == 1:
            return time_intervals

        # Sorting based on the increasing order
        # of the start intervals
        time_intervals.sort(key=lambda x: x[0])

        # list to hold the merged intervals
        merged = list()

        start = datetime.min
        max_val = datetime.min

        for i in range(len(time_intervals)):
            interval = time_intervals[i]
            if interval[0] > max_val:
                if i != 0:
                    merged.append([start, max_val])
                max_val = interval[1]
                start = interval[0]
            else:
                if interval[1] >= max_val:
                    max_val = interval[1]

        if max_val != datetime.min and [start, max_val] not in merged:
            merged.append([start, max_val])

        return merged

    def __has_mass(self, bod_id):
        if 9 < bod_id < 1000:
            return bod_id not in self.no_mass
        elif bod_id > 2000000:
            return bod_id in self.asteroids_with_mass
        else:
            return False

    def __has_radius(self, bod_id):
        if 9 < bod_id < 1000:
            return bod_id not in self.no_radius
        elif bod_id > 2000000:
            return bod_id in self.asteroids_with_radius
        else:
            return False

    def debugPrint(self):
        pprint(self.bodies)

