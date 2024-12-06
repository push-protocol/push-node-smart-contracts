import {task} from "hardhat/config";
import {RegisterUtil} from "../src/RegisterUtil";
import {HardhatRuntimeEnvironment} from "hardhat/types";
import {NodeType} from "../src/DeployerUtil";
import {EnvLoader} from "../src/utilz/envLoader";
import * as fs from "fs";
import * as path from "path";
import type {BigNumber} from "ethers";
import {ValidatorV1} from "../typechain-types";

let info = console.log;
EnvLoader.loadEnvOrFail();

/*
ex:

npx hardhat --network localhost v:registerValidator 0xdD2FD4581271e230360230F9337D5c0430Bf44C0 "https://vv1.dev.push.org" 101

npx hardhat --network localhost v:registerStorage 0xbDA5747bFD65F08deb54cb465eB87D40e51B197E "https://ss1.dev.push.org" 201

npx hardhat --network localhost v:registerArchival 0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199 "https://aa1.dev.push.org" 301

npx hardhat --network localhost v:listNodes

ex:
npx hardhat --network localhost generateRegisterScript

can generate the same script above from push-vnode/docker/a*,v*,s* keys
 */

task("v:registerValidator", "adds a new validator node")
  .addPositionalParam("nodeAddress", "")
  .addPositionalParam("nodeUrl", "")
  .addPositionalParam("nodeAmount", "")
  .setAction(async (args, hre) => {
    let {validatorProxyCt, pushCt} = getConfig(hre);
    const [nodeOwner] = await hre.ethers.getSigners();
    info(`nodeOwner is ${nodeOwner.address}`);

    const nodeAddress = args.nodeAddress;
    const nodeUrl = args.nodeUrl;
    const nodeAmount = args.nodeAmount;
    info(`nodeAddress=${nodeAddress}, nodeUrl=${nodeUrl}, nodeAmount=${nodeAmount}`);
    await RegisterUtil.registerNode(hre, pushCt, validatorProxyCt, nodeOwner, nodeAddress, nodeAmount, nodeUrl, 0);
    info(`success`);
  });

task("v:registerArchival", "adds a new archival node")
  .addPositionalParam("nodeAddress", "")
  .addPositionalParam("nodeUrl", "")
  .addPositionalParam("nodeAmount", "")
  .setAction(async (args, hre) => {
    let {validatorProxyCt, pushCt} = getConfig(hre);
    const [nodeOwner] = await hre.ethers.getSigners();
    info(`nodeOwner is ${nodeOwner.address}`);

    const nodeAddress = args.nodeAddress;
    const nodeUrl = args.nodeUrl;
    const nodeAmount = args.nodeAmount;
    info(`nodeAddress=${nodeAddress}, nodeUrl=${nodeUrl}, nodeAmount=${nodeAmount}`);
    await RegisterUtil.registerNode(hre, pushCt, validatorProxyCt, nodeOwner, nodeAddress, nodeAmount, nodeUrl, NodeType.ANode);
    info(`success`);
  });

task("v:registerStorage", "adds a new storage node")
  .addPositionalParam("nodeAddress", "")
  .addPositionalParam("nodeUrl", "")
  .addPositionalParam("nodeAmount", "")
  .setAction(async (args, hre) => {
    let {validatorProxyCt, pushCt} = getConfig(hre);
    const [nodeOwner] = await hre.ethers.getSigners();
    info(`nodeOwner is ${nodeOwner.address}`);

    const nodeAddress = args.nodeAddress;
    const nodeUrl = args.nodeUrl;
    const nodeAmount = args.nodeAmount;
    info(`nodeAddress=${nodeAddress}, nodeUrl=${nodeUrl}, nodeAmount=${nodeAmount}`);
    await RegisterUtil.registerNode(hre, pushCt, validatorProxyCt, nodeOwner, nodeAddress, nodeAmount, nodeUrl, NodeType.SNode);
    info(`success`);
  });


task("push:balanceOf", "prints account balance @ PUSH token")
  .addPositionalParam("address")
  .setAction(async (args, hre) => {
      let {validatorProxyCt, pushCt} = getConfig(hre);
      await printBalance(hre, pushCt, args.address);
  });

task("v:listActive", "shows validator nodes registered")
  .setAction(async (args, hre) => {
    let {validatorProxyCt, pushCt} = getConfig(hre);
    const validator = await hre.ethers.getContractAt("ValidatorV1", validatorProxyCt)

    let activeVs = await validator.getActiveVNodes();
    for (let i = 0; i < activeVs.length; i++){
      const activeV = activeVs[i];
      info("active validator # %d :%o", i, removeIndexedProperties(activeV));
    }
  });

task("listNodes", "shows validator nodes registered")
  .setAction(async (args, hre) => {
    let {validatorProxyCt, pushCt} = getConfig(hre);
    const validator = await hre.ethers.getContractAt("ValidatorV1", validatorProxyCt)


    info(`registered storage contract is`);
    info(await validator.storageContract())

    {
      info(`---------------------------------------------------------`);
      info(`showing validator nodes registered in ${validatorProxyCt}`);
      let addresses = await validator.getVNodes();
      for (let i = 0; i < addresses.length; i++) {
        const address = addresses[i];
        let ni = await validator.getNodeInfo(address);
        info(`${i} nodeWallet: ${ni.nodeWallet}, 
                 OwnerWallet: ${ni.ownerWallet}, 
                 nodeType: ${ni.nodeType},
                 nodeTokens:  ${ni.nodeTokens},
                 nodeApiBaseUrl: ${ni.nodeApiBaseUrl},
                 status:  ${ni.status}`);
      }
    }

    {
      info(`---------------------------------------------------------`);
      info(`showing storage nodes registered in ${validatorProxyCt}`);
      let addresses = await validator.getSNodes();
      for (let i = 0; i < addresses.length; i++) {
        const address = addresses[i];
        let ni = await validator.getNodeInfo(address);
        info(`${i} nodeWallet: ${ni.nodeWallet}, 
                 OwnerWallet: ${ni.ownerWallet}, 
                 nodeType: ${ni.nodeType},
                 nodeTokens:  ${ni.nodeTokens},
                 nodeApiBaseUrl: ${ni.nodeApiBaseUrl},
                 status:  ${ni.status}`);
      }
    }

    {
      info(`---------------------------------------------------------`);
      info(`showing archival nodes registered in ${validatorProxyCt}`);
      let addresses = await validator.getANodes();
      for (let i = 0; i < addresses.length; i++) {
        const address = addresses[i];
        let ni = await validator.getNodeInfo(address);
        info(`${i} nodeWallet: ${ni.nodeWallet}, 
                 OwnerWallet: ${ni.ownerWallet}, 
                 nodeType: ${ni.nodeType},
                 nodeTokens:  ${ni.nodeTokens},
                 nodeApiBaseUrl: ${ni.nodeApiBaseUrl},
                 status:  ${ni.status}`);
      }
    }

  });


async function printBalance(hre: HardhatRuntimeEnvironment, pushCt: string, balanceAddr: string) {
  const push = await hre.ethers.getContractAt("IERC20", pushCt);
  info(`checking balance of ${balanceAddr} in IERC20 ${pushCt}`);
  info(await push.balanceOf(balanceAddr));
}

task("generateRegisterScript", "")
  .setAction(async (args, hre) => {
      await processDirectories("/Users/w/chain/push-vnode/docker")
  });

// Function to process directories and generate commands
async function processDirectories(dir: string): Promise<void> {
    // Regular expression to match "a" + number, "v" + number, "s" + number
    const dirPattern = /^[avs](\d+)$/;

    // Read the input directory
    const subDirs = fs.readdirSync(dir).filter((subDir) => {
        const fullPath = path.join(dir, subDir);
        return fs.statSync(fullPath).isDirectory() && dirPattern.test(subDir);
    });

    for (const subDir of subDirs) {
        const match = dirPattern.exec(subDir);
        if (!match) continue;

        const dirLetter = subDir[0]; // "a", "v", or "s"
        const dirNumber = parseInt(match[1], 10); // Extract number
        const fullPath = path.join(dir, subDir);
        const jsonFilePath = path.join(fullPath, "node_key.json");

        // Check if the JSON file exists
        if (!fs.existsSync(jsonFilePath)) {
            console.warn(`JSON file not found: ${jsonFilePath}`);
            continue;
        }

        // Read and parse the JSON file
        const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, "utf8"));
        const address = jsonData.address;

        if (!address) {
            console.warn(`Address not found in file: ${jsonFilePath}`);
            continue;
        }

        // Generate dynamic values
        let basePort: number;
        let baseStake: number;
        let cmd:string;
        if (dirLetter === "v") {
            baseStake = 100;
            basePort = 4000;
            cmd = "registerValidator";
        } else if (dirLetter === "s") {
            baseStake = 200;
            basePort = 3000;
            cmd = "registerStorage";
        } else if (dirLetter === "a") {
            baseStake = 300;
            basePort = 5000;
            cmd = "registerArchival";
        } else {
            throw new Error();
        }
        const calculatedPort = basePort + dirNumber;
        const line = `npx hardhat --network sepolia v:${cmd} ${address} "https://${dirLetter}${dirLetter}${dirNumber}.dev.push.org" ${baseStake + dirNumber}`;

        // Print the generated command
        console.log(line);
    }
}


function getConfig(hre: HardhatRuntimeEnvironment): { storageProxyCt: string; validatorProxyCt: string; pushCt: string } {
  let network = hre.network.name.toUpperCase();
  let validatorProxyCt = EnvLoader.getPropertyOrFail(`${network}_VALIDATOR_CONTRACT_ADDRESS`);
  let storageProxyCt = EnvLoader.getPropertyOrFail(`${network}_STORAGE_CONTRACT_ADDRESS`);
  let pushCt = EnvLoader.getPropertyOrFail(`${network}_PUSH_TOKEN_ADDRESS`);
  info(`validatorProxyCt is ${validatorProxyCt}`);
  info(`pushCt is ${pushCt}`);
  return {validatorProxyCt, pushCt, storageProxyCt};
}

function removeIndexedProperties<T extends object>(obj: T): Partial<T> {
  const result = {} as Partial<T>;
  for (const key of Object.keys(obj)) {
    // Check if the key is not a numeric index
    if (isNaN(Number(key))) {
      result[key as keyof T] = obj[key];
    }
  }
  return result;
}