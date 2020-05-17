#!/bin/bash


# this function is called when Ctrl-C is sent
function trap_ctrlc ()
{

    echo
    echo "Ctrl-C caught... performing clean-up."

    sudo docker stop Aether-Backend > /dev/null
    echo "Backend docker container stopped."
    
    if ps -p "$NODE_PID" > /dev/null; then
   		kill -INT "$NODE_PID"
   		echo "Node server stopped"
   	else
   		echo "Node server stopped."
    fi

    exit 0

}

# initialise trap to call trap_ctrlc function
# when signal 2 (SIGINT) is received
trap "trap_ctrlc" 2

echo "Starting backend..."
sudo docker start Aether-Backend > /dev/null
sleep 1

echo "Starting frontend..."
node frontend/server.js > /dev/null &
NODE_PID=$!

echo "Aether is running, connect to localhost:8080 from your web browser."


read -rsp $'Press Ctrl+C to exit...' -n1 key
