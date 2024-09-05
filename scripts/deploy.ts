import hre, { ethers, upgrades, run } from "hardhat";
import { config as loadEnvVariables } from "dotenv";
import {DeployerUtil, NodeType} from "../src/DeployerUtil";
import { VALIDATOR_CONTRACT_PARAMS, PROTOCOL_VERSION, STORAGE_CONTRACT_PARAMS } from "../src/constants";
import {RegisterUtil} from "../src/RegisterUtil";

const functionName = process.env.FUNCTION_NAME;
const network = process.env.NETWORK;

let info = console.log;
let log = console.log;

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
    await verifyContract(validatorV1Impl, []);
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
    await verifyContract(storageImpl, []);
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

// FOR DOCKER:
// FULL LOCALHOST DEPLOY , called from init.sh from the container internals
async function deployAllLocalhost() {

  // deploy fake token & mint for owner
  const [owner] = await hre.ethers.getSigners();
  log(`owner is ${owner.address}`);

  const pushToken = await DeployerUtil.deployPushTokenFake(hre);
  log(`=> FakePushToken.sol deployed at ${pushToken.address}`);

  const mintAmount = "100000";
  const amount = ethers.utils.parseEther(mintAmount);
  await pushToken.mint(owner.address, amount);
  let finalBalance = await pushToken.balanceOf(owner.address);
  log("owner balance is " + finalBalance);

  // deploy Validator.sol
  let validatorCt = await DeployerUtil.deployValidatorContract(hre, pushToken.address);
  log(`=> Validator.sol deployed at ${validatorCt.address}`);

  // deploy Storage.sol
  let storageCt = await DeployerUtil.deployStorageContract(hre, validatorCt.address);
  await validatorCt.setStorageContract(storageCt.address);
  log(`=> Storage.sol deployed at ${storageCt.address}`);


  // register validators
  await RegisterUtil.registerNode(hre, pushToken.address, validatorCt.address, owner,
    "8e12de12c35eabf35b56b04e53c4e468e46727e8", 101, "http://vnode1.local:4001", NodeType.VNode);

  await RegisterUtil.registerNode(hre, pushToken.address, validatorCt.address, owner,
    "fdaeaf7afcfbb4e4d16dc66bd2039fd6004cfce8", 102, "http://vnode2.local:4002", NodeType.VNode);

  await RegisterUtil.registerNode(hre, pushToken.address, validatorCt.address, owner,
    "98f9d910aef9b3b9a45137af1ca7675ed90a5355", 103, "http://vnode3.local:4003", NodeType.VNode);

  // register storage nodes
  await RegisterUtil.registerNode(hre, pushToken.address, validatorCt.address, owner,
    "3563C89b05e4dcD0edEeE0F3e93e396C128C06E2", 251, "http://snode1.local:3001", NodeType.SNode);

  await RegisterUtil.registerNode(hre, pushToken.address, validatorCt.address, owner,
    "b4d6fd1c0df9e3f427a1a8f8a8ec122396206ff7", 252, "http://snode2.local:3002", NodeType.SNode);

  log('success');

  info(`=> showing validator nodes registered in ${validatorCt.address}`);
  info(await validatorCt.getVNodes());
  info(`=> showing storage nodes registered in ${validatorCt.address}`);
  info(await validatorCt.storageContract());

}

async function verifyContract(address: string, args: any[]) {
  console.log(`Verifying contract at address: ${address}`);
  try {
    await hre.run("verify:verify", {
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
    case 'deployAllLocalhost':
      await deployAllLocalhost();
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
