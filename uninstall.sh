#!/bin/bash


if [ "$(docker ps -a | grep Aether-Backend)" ]; then
  echo "Found Aether docker container, removing..."
  sudo docker rm Aether-Backend > /dev/null
else
  echo "Did not find Aether docker container, skipping..."
fi

# logic from: https://stackoverflow.com/questions/30543409/
sudo docker image inspect aether-backend:v1 >/dev/null 2>&1 && \
(echo "Found Aether docker image, removing..."; sudo docker rmi aether-backend:v1) || \
echo "Did not find Aether docker image, skipping..."

echo -e "Successfully uninstalled Aether.\n\nYou may delete the remaining files if you wish."

exit 0

