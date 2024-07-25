import { ethers, upgrades, run } from "hardhat";
import { config as loadEnvVariables } from "dotenv";

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
  const [owner] = await ethers.getSigners();
  const pushTokenFactory = await ethers.getContractFactory("PushToken");
  const pushToken = await pushTokenFactory.deploy();
  await pushToken.deployed();

  info("VALIDATOR_PUSH_TOKEN_ADDRESS=", pushToken.address);

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
  if (!pushTokenAddr) {
    console.error("PUSH_TOKEN_ADDRESS is not set in the environment variables");
    process.exit(1);
  }

  // Deploy SigUtil library
  info('deploying SigUtil library');
  const suFactory = await ethers.getContractFactory("SigUtil");
  const suLibrary = await suFactory.deploy();
  await suLibrary.deployed();
  info('deployed SigUtil at ', suLibrary.address);

  // Deploy ValidatorV1
  info('deploying ValidatorV1');
  const validatorV1Factory = await ethers.getContractFactory("ValidatorV1", {
    libraries: { SigUtil: suLibrary.address }
  });

  const protocolVersion = 1;
  const valPerBlockTarget = 5;
  const nodeRandomMinCount = 1;
  const nodeRandomPingCount = 1;
  const REPORTS_BEFORE_SLASH_V = 2; // 10 for prod
  const REPORTS_BEFORE_SLASH_S = 2; // 50 for prod
  const SLASHES_BEFORE_BAN_V = 2;
  const SLASHES_BEFORE_BAN_S = 2;
  const SLASH_PERCENT = 10;
  const BAN_PERCENT = 10;

  const validatorV1Proxy = await upgrades.deployProxy(validatorV1Factory, [
    protocolVersion,
    pushTokenAddr,
    valPerBlockTarget,
    nodeRandomMinCount,
    nodeRandomPingCount,
    REPORTS_BEFORE_SLASH_V,
    REPORTS_BEFORE_SLASH_S,
    SLASHES_BEFORE_BAN_V,
    SLASHES_BEFORE_BAN_S,
    SLASH_PERCENT,
    BAN_PERCENT
  ], {
    kind: "uups",
    unsafeAllowLinkedLibraries: true
  });

  await validatorV1Proxy.deployed();
  info(`deployed proxy: ${validatorV1Proxy.address}`);

  const validatorV1Impl = await upgrades.erc1967.getImplementationAddress(validatorV1Proxy.address);
  info(`deployed impl: ${validatorV1Impl}`);

  if (network !== 'localhost') {
    await verifyContract(validatorV1Proxy.address, [
      protocolVersion, pushTokenAddr, valPerBlockTarget,
      nodeRandomMinCount, nodeRandomPingCount,
      REPORTS_BEFORE_SLASH_V, REPORTS_BEFORE_SLASH_S,
      SLASHES_BEFORE_BAN_V, SLASHES_BEFORE_BAN_S,
      SLASH_PERCENT, BAN_PERCENT
    ]);

    await verifyContract(validatorV1Impl, [
      protocolVersion, pushTokenAddr, valPerBlockTarget,
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

  let protocolVersion = 1;
  let rfTarget = 5;

  // Deploy StorageV1
  info('deploying StorageV1');
  const storageFactory = await ethers.getContractFactory("StorageV1");
  const storageProxy = await upgrades.deployProxy(storageFactory,
    [protocolVersion, validatorAddress, rfTarget],
    { kind: "uups" });
  await storageProxy.deployed();

  info(`deployed proxy: ${storageProxy.address}`);

  const storageImpl = await upgrades.erc1967.getImplementationAddress(storageProxy.address);
  info(`deployed impl: ${storageImpl}`);

  // Verify the StorageV1 contract
  if (network !== 'localhost') {
    await verifyContract(storageProxy.address, [
      protocolVersion, validatorAddress, rfTarget
    ]);
    await verifyContract(storageImpl, [
      protocolVersion, validatorAddress, rfTarget
    ]);
  }

  info('done');
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
