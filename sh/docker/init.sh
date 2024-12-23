#!/bin/sh

# Change to the correct directory
cd /usr/src/app;

# Start hardhat node as a background process
yarn start:local &

# Wait for hardhat node to initialize and then deploy contracts
npx wait-on http://127.0.0.1:8545
# && yarn deploy:local;

echo "RUNNING DEPLOY"
export FUNCTION_NAME=deployAllLocalhost
npx hardhat run --network localhost scripts/deploy.ts

# The hardhat node process never completes
# Waiting prevents the container from pausing
wait $!