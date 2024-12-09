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
EnvLoader.loadEnv();

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