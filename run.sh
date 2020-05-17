#!/bin/bash


# this function is called when Ctrl-C is sent
function trap_ctrlc ()
{

    echo "Ctrl-C caught...performing clean up"

    echo "Stopping backend..."
    sudo docker stop Aether-Backend
    sleep 1

    echo "Stopping frontend..."
    # kill -INT "$NODE_PID"
    if ps -p "$NODE_PID" > /dev/null
	then
   		echo "$NODE_PID -- node server is running"
   		kill -INT "$NODE_PID"
   		echo "$NODE_PID -- node server stopped"
   	else
   		echo "$NODE_PID -- node server already stopped."
	fi

    exit 0

}

# initialise trap to call trap_ctrlc function
# when signal 2 (SIGINT) is received
trap "trap_ctrlc" 2

echo "Starting backend..."
sudo docker start Aether-Backend
sleep 1

echo "Starting frontend..."
node frontend/server.js > /dev/null &
NODE_PID=$!

while :
do
	read -rsp $'Press Ctrl+C to exit...' -n1 key
done
