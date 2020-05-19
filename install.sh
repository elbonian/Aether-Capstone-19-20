#!/bin/bash


if [ -x "$(command -v docker)" ]; then
  echo "Found docker"
else
  echo "Could not locate docker!"
  exit 1
fi


if [ -x "$(command -v node)" ]; then
  echo "Found Node.js"
else
  echo "Could not locate Node.js!"
  exit 2
fi


if [ -x "$(command -v npm)" ]; then
  echo "Found Node package manager (npm)"
else
  echo "Could not locate Node package manager (npm)!"
  exit 3
fi

echo "Installing Aether will download ~3 GB of data."
echo "This may take 10-15 mins depending on your internet speed..."


# logic from https://stackoverflow.com/questions/1885525
read -p "Are you sure? (y/n)" -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  sudo docker build -t aether-backend:v1 ./backend
  
  sudo docker create -it --name="Aether-Backend" -p 5000:5000 aether-backend:v1
  
  npm --prefix ./frontend install
  
  echo "Successfully installed Aether..."
fi

exit 0

