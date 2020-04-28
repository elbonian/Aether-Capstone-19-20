# CU Boulder CS Capstone - NASA/JPL Group (Aether)
# Spring 2020
# Maintainer: Aether

import os


class MetakernelWriter:

    def write(self):

        kernel_paths_to_write = list()

        valid_kernel_extensions = ('bsp', 'bpc', 'tls', 'tpc', 'tf')

        # traverse default kernels directory and add each path to the list
        for root, dirs, files in os.walk('./SPICE/kernels/default/', topdown=True):
            for name in files:
                kern_path = os.path.join(root, name)

                if kern_path.split('.')[-1] in valid_kernel_extensions:
                    # add single quotes around path and comma at the end so that it gets written to file correctly
                    kernel_paths_to_write.append("'" + kern_path + "',\n")

        # same thing here, except for the user_uploaded directory
        for root, dirs, files in os.walk('./SPICE/kernels/user_uploaded/', topdown=True):
            for name in files:
                kern_path = os.path.join(root, name)
                if kern_path.split('.')[-1] in valid_kernel_extensions:
                    kernel_paths_to_write.append("'" + kern_path + "',\n")

        # remove the comma from the end of the last kernel path and change it to a ) instead
        kernel_paths_to_write[-1] = kernel_paths_to_write[-1][:-2] + ')\n'

        # open the metakernel file for writing
        with open('./SPICE/kernels/cumulative_metakernel.tm', mode='w') as METAKERNEL_FILE:

            # write the first two lines
            METAKERNEL_FILE.write('\\begindata\nKERNELS_TO_LOAD=(\n')

            # write all the lines for each kernel
            METAKERNEL_FILE.writelines(kernel_paths_to_write)

            # write the last line
            METAKERNEL_FILE.write('\\begintext')

        # close the file once everything is written
        METAKERNEL_FILE.close()
