import hre, { ethers, upgrades, run } from "hardhat";
import { config as loadEnvVariables } from "dotenv";
import { DeployerUtil } from "../src/DeployerUtil";
import { VALIDATOR_CONTRACT_PARAMS, PROTOCOL_VERSION, STORAGE_CONTRACT_PARAMS } from "../src/constants";

const functionName = process.env.FUNCTION_NAME;
const network = process.env.NETWORK;

let info = console.log;

function loadNetworkEnv() {
  loadEnvVariables();
  const prefix = network ? network.toUpperCase() + '_' : '';
  const envVars = {
    RPC_URL: process.env[prefix + 'RPC_URL'],
    PRIVATE_KEY: process.env[prefix + 'PRIVATE_KEY'],
    VALIDATOR_CONTRACT_ADDRESS: process.env[prefix + 'VALIDATOR_CONTRACT_ADDRESS'],
    STORAGE_CONTRACT_ADDRESS: process.env[prefix + 'STORAGE_CONTRACT_ADDRESS'],
    PUSH_TOKEN_ADDRESS: process.env[prefix + 'PUSH_TOKEN_ADDRESS'],
    ETHERSCAN_API_KEY: process.env[prefix + 'ETHERSCAN_API_KEY']
  };

  // If the network is not localhost, check for required variables
  if (network !== 'localhost') {
    if (!envVars.RPC_URL || !envVars.PRIVATE_KEY) {
      console.error("Missing required environment variables for network:", network);
      process.exit(1);
    }
  }

  return envVars;
}

async function deployPushToken() {
  const pushToken = await DeployerUtil.deployPushTokenFake(hre);
  const [owner] = await ethers.getSigners();

  await pushToken.mint(owner.address, ethers.utils.parseEther("10000"));
  info("owner ", owner.address);

  if (network !== 'localhost') {
    await verifyContract(pushToken.address, []);
  }

  return pushToken.address;
}

async function deployValidator() {
  const env = loadNetworkEnv();
  
  const pushTokenAddr = env.PUSH_TOKEN_ADDRESS;
  info(pushTokenAddr);
  if (!pushTokenAddr) {
    console.error("PUSH_TOKEN_ADDRESS is not set in the environment variables");
    process.exit(1);
  }

  const validatorV1Proxy = await DeployerUtil.deployValidatorContract(hre, pushTokenAddr);

  const { 
    valPerBlockTarget, 
    nodeRandomMinCount, 
    nodeRandomPingCount, 
    REPORTS_BEFORE_SLASH_V, 
    REPORTS_BEFORE_SLASH_S, 
    SLASHES_BEFORE_BAN_V, 
    SLASHES_BEFORE_BAN_S, 
    SLASH_PERCENT, 
    BAN_PERCENT
  } = VALIDATOR_CONTRACT_PARAMS;

  const validatorV1Impl = await upgrades.erc1967.getImplementationAddress(validatorV1Proxy.address);

  if (network !== 'localhost') {
    await verifyContract(validatorV1Proxy.address, [
      PROTOCOL_VERSION, pushTokenAddr, valPerBlockTarget,
      nodeRandomMinCount, nodeRandomPingCount,
      REPORTS_BEFORE_SLASH_V, REPORTS_BEFORE_SLASH_S,
      SLASHES_BEFORE_BAN_V, SLASHES_BEFORE_BAN_S,
      SLASH_PERCENT, BAN_PERCENT
    ]);

    await verifyContract(validatorV1Impl, [
      PROTOCOL_VERSION, pushTokenAddr, valPerBlockTarget,
      nodeRandomMinCount, nodeRandomPingCount,
      REPORTS_BEFORE_SLASH_V, REPORTS_BEFORE_SLASH_S,
      SLASHES_BEFORE_BAN_V, SLASHES_BEFORE_BAN_S,
      SLASH_PERCENT, BAN_PERCENT
    ]);
  }

  info('done');
  return validatorV1Proxy.address; // Return the address of the deployed validator
}

async function deployStorage() {
  const env = loadNetworkEnv();

  const validatorAddress = env.VALIDATOR_CONTRACT_ADDRESS;
  if (!validatorAddress) {
    console.error("VALIDATOR_CONTRACT_ADDRESS is not set in the environment variables");
    process.exit(1);
  }

  const storageProxy = await DeployerUtil.deployStorageContract(hre, validatorAddress);
  const storageImpl = await upgrades.erc1967.getImplementationAddress(storageProxy.address);
  const { rfTarget } = STORAGE_CONTRACT_PARAMS;

  // Verify the StorageV1 contract
  if (network !== 'localhost') {
    await verifyContract(storageProxy.address, [
      PROTOCOL_VERSION, validatorAddress, rfTarget
    ]);
    await verifyContract(storageImpl, [
      PROTOCOL_VERSION, validatorAddress, rfTarget
    ]);
  }
}

/// @notice: Make sure to deploy new validator contract and update the address in env
async function upgradeValidator() {
  const env = loadNetworkEnv();

  const validatorAddress = env.VALIDATOR_CONTRACT_ADDRESS;
  if (!validatorAddress) {
    console.error("VALIDATOR_CONTRACT_ADDRESS is not set in the environment variables");
    process.exit(1);
  }

  await DeployerUtil.updateValidatorContract(hre, validatorAddress);
}

/// @notice: Make sure to deploy new storage contract and update the address in env
async function upgradeStorage() {
  const env = loadNetworkEnv();

  const storageAddress = env.STORAGE_CONTRACT_ADDRESS;
  if (!storageAddress) {
    console.error("STORAGE_CONTRACT_ADDRESS is not set in the environment variables");
    process.exit(1);
  }

  await DeployerUtil.updateValidatorContract(hre, storageAddress);
}

async function deployAll() {
  const pushTokenAddress = await deployPushToken();
  process.env[network.toUpperCase() + '_PUSH_TOKEN_ADDRESS'] = pushTokenAddress;
  
  const validatorAddress = await deployValidator();
  process.env[network.toUpperCase() + '_VALIDATOR_CONTRACT_ADDRESS'] = validatorAddress;
  
  await deployStorage();
}

async function verifyContract(address: string, args: any[]) {
  console.log(`Verifying contract at address: ${address}`);
  try {
    await run("verify:verify", {
      address: address,
      constructorArguments: args
    });
  } catch (error) {
    console.error("Verification failed:", error);
  }
}

async function main() {
  switch (functionName) {
    case 'deployPushToken':
      await deployPushToken();
      break;
    case 'deployValidator':
      await deployValidator();
      break;
    case 'deployStorage':
      await deployStorage();
      break;
    case 'upgradeValidator':
      await upgradeValidator();
      break;
    case 'upgradeStorage':
      await upgradeStorage();
      break;
    case 'deployAll':
      await deployAll();
      break;
    default:
      console.error("Invalid function name provided:", functionName);
      process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
