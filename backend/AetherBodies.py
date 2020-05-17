# CU Boulder CS Capstone - NASA/JPL Group (Aether)
# Spring 2020
# Maintainer: Aether


from os import walk, path, remove
from datetime import datetime
from SPKParser import SPKParser
from pprint import pprint


def toDatetime(spice_datetime_str):
    """
    AetherBodies.py -- toDatetime
        This function converts a date/time string into a datetime object and returns it. The format of the inputted
        string mirrors that of brief's output, and therefore the output of the SPKParser object.

    Params: spice_datetime_str <str>

    Returns: <datetime>
    """
    return datetime.strptime(spice_datetime_str, "%Y %b %d %H:%M:%S.%f")


def fromDatetime(dtime_obj):
    """
    AetherBodies.py -- fromDatetime
        This function converts a datetime object into a date/time string and returns it. The format of the outputted
        date string is in a standard, easily readable format.

    Params: dtime_obj <datetime>

    Returns: <str>
    """
    return dtime_obj.strftime("%Y-%m-%d %H:%M:%S.%f")


class AetherBodies:
    """
    AetherBodies class

    Purpose: This class is a store of all the known objects in the backend of Aether. A dictionary holds metadata of
        each body that trajectory data can be obtained for. A single global instance of this class is instantiated by
        the REST server. It is used for checking the validity of targets passed to the REST server from the frontend,
        keeping track of valid time ranges for ephemeris, and providing data to the available-bodies endpoint which is
        used to populate the bodies drop-down on the frontend. Each object in the dictionary represents a valid body
        stored in one or more of the SPICE kernels. These kernels are located in backend/SPICE/kernels and data
        about each body and it's valid time ranges is obtained by using the command-line utility brief. Output from
        brief is parsed using the SPKParser class.
    """

    def __init__(self):
        """
        AetherBodies -- init
            Create the AetherBodies object. No params are necessary for initialization. On initialization, the SPICE
            kernel directories (default and user_uploaded within backend/SPICE/kernels) are traversed, and the bodies
            dictionary is built based on the parsed brief output of each SPK kernel.

        Params: None

        Returns: None
        """

        # The SPK Parser object -- used for extracting data about bodies and time ranges from binary SPK kernels
        self.spk_parser = SPKParser()

        # ---------- FORMAT OF BODIES DICTIONARY ----------
        # key: NAIF ID <int>
        # value: data tuple
        #     ( name <str>, valid times list[tuple[time_start <datetime>, time_end <datetime>]],
        #       rotationData <bool>, radiusData <bool>, massData <bool>, category <int>, uploaded <bool> )

        # empty dictionary to hold body info
        self.bodies = dict()

        # mapping of names and NAIF IDs of main barycenters
        self.barycenters = [(0, "solar system barycenter"), (1, "mercury barycenter"), (2, "venus barycenter"),
                            (3, "earth barycenter"), (4, "mars barycenter"), (5, "jupiter barycenter"),
                            (6, "saturn barycenter"), (7, "uranus barycenter"), (8, "neptune barycenter"),
                            (9,"pluto barycenter")]

        # NAIF IDs of default bodies for which there is no rotation data
        # Rotation data is obtained via the pck00010.tpc kernel, which does not include info for these IDs
        self.no_rotation = (607, 632, 634, 802, 902, 903, 904, 905)

        # Similarly to self.no_rotation above, these NAIF IDs do not have radii data within the default PCK kernels
        self.no_radius = (902, 903, 904, 905)

        # NAIF IDs of default bodies for which there is no mass data
        # Mass data is obtained via the gm_de431.tpc kernel, which does not include info for these IDs
        self.no_mass = (905, 802, 808, 514, 515, 516, 612, 613, 614, 632, 634)

        # Since one of the default SPK kernels in Aether includes data for 300 asteroids and dwarf planets, it is easier
        # to specify which of those do have radius and mass data, since the vast majority do not.
        # These NAIF IDs do have either radii or mass data within the PCK kernels
        self.asteroids_with_radius = (2000001, 2000004, 2000021, 2000433, 2000511)
        self.asteroids_with_mass = (2000001, 2000002, 2000003, 2000004, 2000006, 2000007, 2000010, 2000015, 2000016,
                                    2000029, 2000052, 2000065, 2000087, 2000088, 2000433, 2000511, 2000704)

        # traverse the default kernel directory, add all the bodies from each SPK kernel to the bodies dictionary
        for root, dirs, files in walk('./SPICE/kernels/default/', topdown=True):
            for name in files:
                kern_path = path.join(root, name)
                if kern_path.endswith('.bsp'):
                    self.addFromKernel(kern_path)

        # traverse the user_uploaded kernel directory, add all the bodies from each SPK kernel to the bodies dictionary
        for root, dirs, files in walk('./SPICE/kernels/user_uploaded/', topdown=True):
            for name in files:
                kern_path = path.join(root, name)
                if kern_path.endswith('.bsp'):
                    self.addFromKernel(kern_path)

    def addFromKernel(self, kern_path, returnNewBodies=False):
        """
        AetherBodies -- addFromKernel
            This method takes a path to a binary SPK kernel, parses metadata out of it and adds that information to
            the bodies dictionary. Only one instance of each body can exist in the dictionary, so adding a duplicate
            simply updates the valid time range for that body. Optionally, specifying returnNewBodies as True will
            return the data for bodies which did not exist in the dictionary prior to running this method on the kernel.

        Params: kern_path <str> -- path to the binary SPK kernel to add bodies from
                returnNewBodies <bool> False by default -- return info on bodies which did not exist in the dictionary
                    prior to running this method on a new kernel.

        Returns: list[<dict>] -- only has a return value when returnNewBodies is declared True
        """

        # empty list to hold IDs of new bodies that were added
        newly_added_bodies = list()

        # Empty list to hold IDs of bodies that existed in the dictionary previously, but are also contained in the
        # kernel. In this case, the time ranges must be merged to form non-overlapping intervals.
        merge_time_ids = set()

        # flag specifying whether or not the kernel is default, or uploaded by a user
        uploaded = False

        # check if the kernel came from the user_uploaded directory, if so, set uploaded flag to True
        if 'user_uploaded' in kern_path.split('/'):
            uploaded = True

        # parse metadata from the kernel using the SPK Parser object
        parsed_bodies = self.spk_parser.parse(kern_path)

        # traverse the parsed output
        for bod_group in parsed_bodies:

            # Disregard barycenters
            for body_tuple in [tupe for tupe in bod_group['bodies'] if not tupe[0].endswith('BARYCENTER')]:

                # get body ID
                body_id = body_tuple[2]

                # check if the body exists in the dictionary already
                if body_id not in self.bodies:
                    # Set category based on NAIF ID
                    # categories: -1 = spacecraft, -2 = asteroids, -3 = comets, -4 = misc, positive = orbiting that body
                    category = -4

                    # negative IDs are spacecraft
                    if body_id < 0:
                        category = -1
                    # IDs greater than 2 million are asteroids/dwarf planets
                    elif body_id > 2000000:
                        category = -2
                    # IDs between 1 million and 2 million are comets
                    elif 1000000 < body_id < 2000000:
                        category = -3
                    # IDs between 100 and 1000 are planets and moons
                    elif 100 < body_id < 1000:
                        if body_id % 100 == 99:
                            category = 10
                        else:
                            category = int(str(body_id // 100) + "99")
                    # special case for the sun
                    elif body_id == 10:
                        category = 10

                    # check if kernel is uploaded or default and add info to the dictionary accordingly
                    # bodies in default kernels may have radii, mass, rotation data, so you need to check
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
                    # bodies in uploaded kernels do not have radii, mass, rotation data
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

                    # append ID to list of newly added bodies
                    newly_added_bodies.append(body_id)

                # the body already exists in the dictionary
                else:
                    # append the start and end times to the list of time ranges for that body
                    self.bodies[body_id][1].append((toDatetime(bod_group['time_start']),
                                                    toDatetime(bod_group['time_end'])))

                    # append the ID to the list of bodies that need time intervals to be merged
                    merge_time_ids.add(body_id)

        # traverse bodies that need time intervals merged
        for body_id in merge_time_ids:
            # call private class method to merge the time intervals of the specified body
            merged_times = self.__mergeTimeIntervals(self.bodies[body_id][1])

            # assign time interval list to the newly merged one
            self.bodies[body_id][1] = merged_times

        # check if newly added bodies should be returned -- this is False by default
        if returnNewBodies:
            # check if any new bodies were added
            if newly_added_bodies:
                # return a list of dictionaries from getBodies
                return self.getBodies(specific_ids=newly_added_bodies)
            else:
                # return empty list
                return list()

    def isValidID(self, bod_id):
        """
        AetherBodies -- isValidID
            Checks whether or not the given NAIF body ID exists in the dictionary or not.

        Params: bod_id <int>

        Returns: <bool>
        """

        return bod_id in self.bodies

    def isValidName(self, bod_name):
        """
        AetherBodies -- isValidName
            Checks whether or not the given body name exists in the dictionary or not.

        Params: bod_name <str>

        Returns: <bool>
        """

        # get list of all body names from the dictionary
        names = [tupe[0] for tupe in self.bodies.values()]

        # check if the name exists in the list
        return bod_name in names

    def getBodyID(self, bod_name):
        """
        AetherBodies -- getBodyID
            Gets the NAIF ID of a body by name. Note: there's also a SPICE function which does this...

        Params: bod_name <str>

        Returns: <int> or Raises KeyError if the specified name does not exist in the dictionary.
        """

        # ensure lowercase
        bod_name = bod_name.lower()

        # iterate over keys and values in the dictionary, check if name matches, return key (NAIF ID)
        for key, value in self.bodies.items():
            if value[0] == bod_name:
                return key

        raise KeyError("Body {} does not exist in the dictionary.".format(bod_name))

    def isValidRefFrame(self, ref_frame):
        """
        AetherBodies -- isValidRefFrame
            Checks whether or not the provided reference frame is valid. For it to be valid, it must either be a known
            reference frame, or a known body.

        Params: ref_frame <int> or <str>

        Returns: <bool> or Raises TypeError if the argument supplied is not a string or int
        """

        # if the reference frame is a int, check if the ID is in barycenter IDs or body IDs
        if type(ref_frame) == int:
            return ref_frame in [tupe[0] for tupe in self.barycenters] or self.isValidID(ref_frame)
        # if the reference frame is a string, check if the name is in barycenter names or body names
        elif type(ref_frame) == str:
            return ref_frame in [tupe[1] for tupe in self.barycenters] or self.isValidName(ref_frame)
        else:
            raise TypeError("Method only accepts int or str.")

    def removeUploadedKernels(self):
        """
        AetherBodies -- removeUploadedKernels
            Removes all kernels from the user_uploaded directory and then removes all uploaded bodies from the
            dictionary.

        Params: None.

        Returns: list[<str>] -- a list of body names which were removed.
        """

        # empty list to hold names of bodies that were removed
        removed_body_list = list()

        # traverse user_uploaded directory and delete each binary SPK file
        for root, dirs, files in walk('./SPICE/kernels/user_uploaded/', topdown=True):
            for name in files:
                kern_path = path.join(root, name)
                if kern_path.endswith('.bsp'):
                    remove(kern_path)

        # traverse dictionary keys, delete items where the uploaded flag is True
        for bod_id in self.bodies.keys():
            if self.bodies[bod_id][6]:
                removed_body_list.append((self.bodies[bod_id][0], bod_id))

        for body_to_remove in removed_body_list:
            del self.bodies[body_to_remove[1]]

        # return names of each body that was removed
        return [bod[0] for bod in removed_body_list]

    def hasRotationData(self, bod_id):
        """
        AetherBodies -- hasRotationData
            Checks whether or not the body specified by bod_id has rotation data.

        Params: bod_id <int>

        Returns: <bool>
        """

        # python short-circuits by default so this works even if the ID isn't valid
        return self.isValidID(bod_id) and self.bodies[bod_id][2]

    def hasRadiusData(self, bod_id):
        """
        AetherBodies -- hasRadiusData
            Checks whether or not the body specified by bod_id has radius data.

        Params: bod_id <int>

        Returns: <bool>
        """

        # python short-circuits by default so this works even if the ID isn't valid
        return self.isValidID(bod_id) and self.bodies[bod_id][3]

    def hasMassData(self, bod_id):
        """
        AetherBodies -- hasMassData
            Checks whether or not the body specified by bod_id has mass data.

        Params: bod_id <int>

        Returns: <bool>
        """

        # python short-circuits by default so this works even if the ID isn't valid
        return self.isValidID(bod_id) and self.bodies[bod_id][4]

    def getBodies(self, specific_ids=[]):
        """
        AetherBodies -- getBodies
            Gathers bodies from the dictionary and formats them into a list of dictionaries, one for each body.

        Params: specific_ids list[<int>] OPTIONAL -- if specified, only return data for these IDs

        Returns: list[<dict>] -- see available-bodies function in aether-rest-server.py for detailed output format
        """

        # if no specific ids requested, return info for all bodies
        if not specific_ids:
            return self.__flattenDict(self.bodies)
        # only return info for the specified ids -- create a new dictionary with this subset and format it
        else:
            return self.__flattenDict(dict(
                (bod_id, self.bodies[bod_id]) for bod_id in specific_ids if self.isValidID(bod_id)
            ))

    def __flattenDict(self, body_dict):
        """
        AetherBodies -- __flattenDict
            Formats a dictionary of bodies into a list of dictionaries, one for each body. This makes the data easier to
            interpret on the frontend.

        Params: body_dict <dict>

        Returns: list[<dict>]
        """

        # empty list to hold the dictionaries for each body
        ret_list = list()

        # traverse the dictionary, format tuple into a new dictionary for the body and append it to the list
        for key, value in body_dict.items():
            ret_list.append({
                'spice id': key,
                'body name': value[0],
                'has rotation data': value[2],
                'has radius data': value[3],
                'has mass data': value[4],
                'category': self.__categoryToString(value[5], key),  # convert category to a string for clarity
                'valid times': [[fromDatetime(dtime) for dtime in list(tupe)] for tupe in value[1]],  # make date a str
                'is uploaded': value[6]
            })

        # return the list at the end
        return ret_list

    def __categoryToString(self, cat_int, bod_id):
        """
        AetherBodies -- __categoryToString
            Changes the category int into a string. Possible categories are spacecraft, asteroids, comets, misc, or the
            name of a major celestial body (sun, earth, mars, etc.)

        Params: cat_int <int>, bod_id <int>

        Returns: <str>
        """

        # categories: -1 = spacecraft, -2 = asteroids, -3 = comets, -4 = misc, positive = orbiting that body
        if cat_int > 0:
            # special case for the sun, its category is itself
            if cat_int == 10:
                return self.bodies[bod_id][0]
            # the category is the name of the primary body (e.g. moon's category is earth, phobos's is mars)
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
        """
        AetherBodies -- __mergeTimeIntervals
            Merges a list of start-end time ranges into non-overlapping time ranges.

        Params: time_intervals list[tuple[<datetime>, <datetime>]]

        Returns: list[tuple[<datetime>, <datetime>]]
        """

        # Adapted from original code by Thirumalai Srinivasan
        # https://www.geeksforgeeks.org/merging-intervals/

        # return immediately -- this should never happen, but just in case
        if len(time_intervals) == 1:
            return time_intervals

        # Sorting based on the increasing order of the start intervals
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
        """
        AetherBodies -- __has_mass
            Helper function to determine if a default body with the specified NAIF ID has mass data in the PCK kernels
            or not.

        Params: bod_id <int>

        Returns: <bool>
        """

        # if ID represents the sun, a planet or a moon
        if 9 < bod_id < 1000:
            return bod_id not in self.no_mass

        # if the body is an asteroid
        elif bod_id > 2000000:
            return bod_id in self.asteroids_with_mass

        else:
            return False

    def __has_radius(self, bod_id):
        """
        AetherBodies -- __has_radius
            Helper function to determine if a default body with the specified NAIF ID has radii data in the PCK kernels
            or not.

        Params: bod_id <int>

        Returns: <bool>
        """

        # if ID represents the sun, a planet or moon
        if 9 < bod_id < 1000:
            return bod_id not in self.no_radius

        # if the ID represents an asteroid
        elif bod_id > 2000000:
            return bod_id in self.asteroids_with_radius

        else:
            return False

    def debugPrint(self):
        pprint(self.bodies)

