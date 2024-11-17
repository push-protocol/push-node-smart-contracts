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
  info(`PUSH_TOKEN_ADDRESS=${pushTokenAddr}`);
  if (!pushTokenAddr) {
    console.error("PUSH_TOKEN_ADDRESS is not set in the environment variables");
    process.exit(1);
  }

  const validatorV1Proxy = await DeployerUtil.deployValidatorContract(hre, pushTokenAddr);
  log(`>>> VALIDATOR_CONTRACT_ADDRESS=${validatorV1Proxy.address}`);
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
  log(`>>> STORAGE_CONTRACT_ADDRESS=${storageProxy.address}`);
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
  log(`>>> VALIDATOR_PUSH_TOKEN_ADDRESS=${pushTokenAddress}`);
  process.env[network.toUpperCase() + '_PUSH_TOKEN_ADDRESS'] = pushTokenAddress;
  
  const validatorAddress = await deployValidator();
  process.env[network.toUpperCase() + '_VALIDATOR_CONTRACT_ADDRESS'] = validatorAddress;
  await deployStorage();
}

async function deployAllNoToken() {
  const validatorAddress = await deployValidator();
  process.env[network.toUpperCase() + '_VALIDATOR_CONTRACT_ADDRESS'] = validatorAddress;

  await deployStorage();
}

// FOR DOCKER:
// FULL LOCALHOST DEPLOY , called from init.sh from the container internals
async function deployAllLocalhost() {

  // deploy fake token & mint for owner
  const [owner] = await hre.ethers.getSigners();
  log(`version 2`);
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
  // localhost: Validator.sol deployed at 0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9
  //            Storage.sol deployed at 0x0165878A594ca255338adfa4d48449f69242Eb8F
  await RegisterUtil.registerNode(hre, pushToken.address, validatorCt.address, owner,
    "8e12de12c35eabf35b56b04e53c4e468e46727e8", 101, "http://vnode1.local:4001", NodeType.VNode);

  await RegisterUtil.registerNode(hre, pushToken.address, validatorCt.address, owner,
    "fdaeaf7afcfbb4e4d16dc66bd2039fd6004cfce8", 102, "http://vnode2.local:4002", NodeType.VNode);

  await RegisterUtil.registerNode(hre, pushToken.address, validatorCt.address, owner,
    "98f9d910aef9b3b9a45137af1ca7675ed90a5355", 103, "http://vnode3.local:4003", NodeType.VNode);

  // NEW V4
  await RegisterUtil.registerNode(hre, pushToken.address, validatorCt.address, owner,
    "bb7db9b012a5732210e4e110286fb2f89851b433", 104, "http://vnode4.local:4004", NodeType.VNode);

  // NEW V5
  await RegisterUtil.registerNode(hre, pushToken.address, validatorCt.address, owner,
    "BDd307CFC6d8739AB0632b70dC219e32EEE3b732", 105, "http://vnode5.local:4005", NodeType.VNode);

  // NEW V6
  await RegisterUtil.registerNode(hre, pushToken.address, validatorCt.address, owner,
    "11cebdb517009b8f6d80aae543722bd5231eb504", 106, "http://vnode6.local:4006", NodeType.VNode);


  // NEW V7
  await RegisterUtil.registerNode(hre, pushToken.address, validatorCt.address, owner,
    "e2eef32ef910441cee7b3b923f91187138d036f9", 107, "http://vnode7.local:4007", NodeType.VNode);

  // NEW V8
  await RegisterUtil.registerNode(hre, pushToken.address, validatorCt.address, owner,
    "06558efa0d4c0a2db822fd5d59ec0d8756542e3a", 108, "http://vnode8.local:4008", NodeType.VNode);

  // NEW V9
  await RegisterUtil.registerNode(hre, pushToken.address, validatorCt.address, owner,
    "a329618c37913285d6e53cab22c779f890bf8c30", 109, "http://vnode9.local:4009", NodeType.VNode);


  // NEW V10
  await RegisterUtil.registerNode(hre, pushToken.address, validatorCt.address, owner,
    "ed908ebe20640288e51e2a9824fa8b5f9ebaeb0e", 110, "http://vnode10.local:4010", NodeType.VNode);



  // register storage nodes
  await RegisterUtil.registerNode(hre, pushToken.address, validatorCt.address, owner,
    "3563C89b05e4dcD0edEeE0F3e93e396C128C06E2", 251, "http://snode1.local:3001", NodeType.SNode);

  await RegisterUtil.registerNode(hre, pushToken.address, validatorCt.address, owner,
    "b4d6fd1c0df9e3f427a1a8f8a8ec122396206ff7", 252, "http://snode2.local:3002", NodeType.SNode);

  // NEW S3
  await RegisterUtil.registerNode(hre, pushToken.address, validatorCt.address, owner,
    "a5626035183c3bce663ceef16436d6bf5ef58937", 253, "http://snode3.local:3003", NodeType.SNode);

  // NEW S4
  await RegisterUtil.registerNode(hre, pushToken.address, validatorCt.address, owner,
    "fc59f70cc94edea0e90693ab9ae5937d09ea568e", 254, "http://snode4.local:3004", NodeType.SNode);

  // NEW S5
  await RegisterUtil.registerNode(hre, pushToken.address, validatorCt.address, owner,
    "2710e64db240fc361c03d85a38d1874569271f80", 255, "http://snode5.local:3005", NodeType.SNode);

  // NEW S6
  await RegisterUtil.registerNode(hre, pushToken.address, validatorCt.address, owner,
    "f3c3568d91987a81c43e426a90e33d634c73800c", 256, "http://snode6.local:3006", NodeType.SNode);

  // NEW S7
  await RegisterUtil.registerNode(hre, pushToken.address, validatorCt.address, owner,
    "230ade48b51463fcc3aa4d541a371aa5ecaf6f89", 257, "http://snode7.local:3007", NodeType.SNode);

  // NEW S8
  await RegisterUtil.registerNode(hre, pushToken.address, validatorCt.address, owner,
    "3365a1354609f40925f148d3ff2b2bf8dbc69c56", 258, "http://snode8.local:3008", NodeType.SNode);

  // register archival nodes

  // NEW A1
  await RegisterUtil.registerNode(hre, pushToken.address, validatorCt.address, owner,
    "155eb2b395a94b9d41e8624100534564c5b43eff", 201, "http://anode1.local:5001", NodeType.ANode);

  // NEW A2
  await RegisterUtil.registerNode(hre, pushToken.address, validatorCt.address, owner,
    "6d2e186f2f3392b2e878e42b00fc641367da21e0", 202, "http://anode2.local:5002", NodeType.ANode);

  // NEW A3
  await RegisterUtil.registerNode(hre, pushToken.address, validatorCt.address, owner,
    "5ddebc175fe4d8cd07952f069dfa0be70f6ef28b", 203, "http://anode3.local:5003", NodeType.ANode);

  // NEW A4
  await RegisterUtil.registerNode(hre, pushToken.address, validatorCt.address, owner,
    "cf61ce9623d76ba400f72de363700cd83d87fa67", 204, "http://anode4.local:5004", NodeType.ANode);

  // NEW A5
  await RegisterUtil.registerNode(hre, pushToken.address, validatorCt.address, owner,
    "411306ba81ef161671aafaec0fa6668e7c376556", 205, "http://anode5.local:5005", NodeType.ANode);

  log('success');

  info(`=> showing validator nodes registered in ${validatorCt.address}`);
  info(await validatorCt.getVNodes());
  info(`=> showing storage nodes registered in ${validatorCt.address}`);
  info(await validatorCt.getSNodes());
  info(`=> showing archival nodes registered in ${validatorCt.address}`);
  info(await validatorCt.getANodes());



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
    case 'deployAllNoToken':
      await deployAllNoToken();
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
