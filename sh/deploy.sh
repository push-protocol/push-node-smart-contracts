#!/bin/bash

while getopts ":n:k:v:f:" opt; do
  case $opt in
    n) network="$OPTARG"
    ;;
    f) function_name="$OPTARG"
    ;;
    \?) echo "Invalid option -$OPTARG" >&2
    exit 1
    ;;
  esac

  case $OPTARG in
    -*) echo "Option $opt needs a valid argument" >&2
    exit 1
    ;;
  esac
done

if [ -z ${network+x} ]; then
    echo "network (-n) is unset" >&2
    exit 1
fi

if [ -z ${function_name+x} ]; then
    echo "function name (-f) is unset" >&2
    exit 1
fi

set -euo pipefail

ROOT=$(dirname $0)
ENV=$ROOT/.env

# Set the necessary environment variables
export FUNCTION_NAME=$function_name
export NETWORK=$network

# Execute the command
npx hardhat run --network $network scripts/deploy.ts
