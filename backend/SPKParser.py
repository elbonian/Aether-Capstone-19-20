# CU Boulder CS Capstone - NASA/JPL Group (Aether)
# Spring 2020
# Maintainer: Aether

import os
import re
from datetime import datetime

class SPKParser:
    
    
    
    def parse(self, path_to_kernel):
        #Input: path_to_kernel: the path of the kernel that needs to parse, under /SPICE/kernels/
        #
        #Output: Dictionary of bodies infomation, start time nd end time of the time interval of the kernel.
        #
        #Output formate: {'bodies':[(body_name:str, wrt:str, naif_id:int),...],
        #                 'time_start': %Y-%m-%d %H:%M:%S.%f, 
        #                 'time_end': %Y-%m-%d %H:%M:%S.%f}

        # Stdout of brief
        output = os.popen("./SPICE/tools/brief -c " + path_to_kernel).read()
        
        
        lines = output.split('\n')

        bodies = list()
        time_start = ''
        time_end = ''

        for i in range(len(lines)):
            
            # Removing the word "Bodies:"
            
            if 'Bodies:' in lines[i]:
                lines[i] = lines[i][6:]
                
                
                
            # For each body
            
            if 'w.r.t.' in lines[i]:
                line = lines[i]
                name_str, wrt_str = line.split('w.r.t.')
                
                # Bodies that have both name and naif_id
                if '(' in name_str:
                    naif_id = int(name_str[name_str.find('(')+1:name_str.find(')')])
                    name = ''.join(e for e in name_str[:name_str.find('(')] if e.isalnum() or e == ' ').strip()
                
                # Bodies that have only naif_id
                else:
                    name = ''.join(e for e in name_str if e.isalnum() or e ==' ').strip()
                    naif_id = int(name)
                


                # get w.r.t. of the body
                # w.r.t. that has both name and naif_id
                if '(' in wrt_str:
                    wrt = ''.join(e for e in wrt_str[:wrt_str.find('(')] if e.isalnum() or e == ' ').strip()
                # w.r.t. that has only naif_id
                else:
                    wrt = ''.join(e for e in wrt_str if e.isalnum() or e == ' ').strip()

                bodies.append((name, wrt, naif_id))

                
            # Get Start time and End time of the Kernel
            elif 'Start of Interval' in lines[i]:

                line = lines[i+2]
                
                # Transfer time format
                time_start = datetime.strptime(line[8:32], "%Y %b %d %H:%M:%S.%f").strftime("%Y-%m-%d %H:%M:%S.%f")
                time_end = datetime.strptime(line[44:], "%Y %b %d %H:%M:%S.%f").strftime("%Y-%m-%d %H:%M:%S.%f")

        return {'bodies': bodies, 'start_date': time_start[:-3], 'end_date': time_end[:-3]}
