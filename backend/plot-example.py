import numpy as np
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D
import spiceypy as spice

spice.furnsh("./SPICE/kernels/cumulative_metakernel.tm")

step = 10000

# we are going to get positions between these two dates

# Provided times are assumed to be UTC unless stated otherwise
# This is also valid... 'Nov 10, 2019 12:00:00 MST'
# utc = ['Nov 10, 2019 12:00:00', 'Nov 10, 2020 12:00:00']

utc = ['2019-10-10 12:00:00', '2020-10-10 12:00:00']

# get et values one and two, we could vectorize str2et
etOne = spice.str2et(utc[0])
etTwo = spice.str2et(utc[1])

# get times
times = [x*(etTwo-etOne)/step + etOne for x in range(step)]

# Coordinate transformations are done automatically!
positions_sun, _ = spice.spkpos('SUN', times, 'J2000', 'NONE', 'SOLAR SYSTEM BARYCENTER')
positions_mercury, _ = spice.spkpos('MERCURY', times, 'J2000', 'NONE', 'SOLAR SYSTEM BARYCENTER')
positions_venus, _ = spice.spkpos('VENUS', times, 'J2000', 'NONE', 'SOLAR SYSTEM BARYCENTER')
positions_earth, _ = spice.spkpos('EARTH', times, 'J2000', 'NONE', 'SOLAR SYSTEM BARYCENTER')
positions_moon, _ = spice.spkpos('MOON', times, 'J2000', 'NONE', 'SOLAR SYSTEM BARYCENTER')

spice.kclear()

# positions is a list, make it an ndarray for easier indexing
positions_sun = np.asarray(positions_sun).T
positions_mercury = np.asarray(positions_mercury).T
positions_venus = np.asarray(positions_venus).T
positions_earth = np.asarray(positions_earth).T
positions_moon = np.asarray(positions_moon).T

fig = plt.figure(figsize=(9, 9))
ax  = fig.add_subplot(111, projection='3d')

ax.plot([0], [0], [0], marker='o', label='Solar System Barycenter')
ax.plot(positions_sun[0], positions_sun[1], positions_sun[2], label='Sun')
ax.plot(positions_mercury[0], positions_mercury[1], positions_mercury[2], label='Mercury')
ax.plot(positions_venus[0], positions_venus[1], positions_venus[2], label='Venus')
ax.plot(positions_earth[0], positions_earth[1], positions_earth[2], label='Earth')
ax.plot(positions_moon[0], positions_moon[1], positions_moon[2], label='Moon')

plt.title('Inner Solar System')
plt.legend(loc='lower left')
plt.show()