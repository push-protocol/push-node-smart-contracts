import {PushToken, StorageV1, ValidatorV1} from "../typechain-types";
import {HardhatRuntimeEnvironment} from "hardhat/types";
import { PROTOCOL_VERSION, VALIDATOR_CONTRACT_PARAMS, STORAGE_CONTRACT_PARAMS } from "./constants";

let log = console.log;


export namespace DeployerUtil {

  export async function deployPushTokenFake(hre: HardhatRuntimeEnvironment): Promise<PushToken> {
    log('deploying PushToken');
    const ptFactory = await hre.ethers.getContractFactory("PushToken");
    const pushContract = <PushToken>await ptFactory.deploy();
    log(`deployed impl: ${pushContract.address}`);
    log('done');
    return pushContract;
  }

  export async function deployValidatorContract(hre: HardhatRuntimeEnvironment, pushCt: string): Promise<ValidatorV1> {
    log('deploying SigUtil library');
    const suFactory = await hre.ethers.getContractFactory("SigUtil");
    const suLibrary = await suFactory.deploy();
    await suLibrary.deployed();
    log('deployed SigUtil at ', suLibrary.address)

    log('deploying ValidatorV1');
    const validatorV1Factory = await hre.ethers.getContractFactory("ValidatorV1",
      {libraries: {SigUtil: suLibrary.address}});
    const { 
      valPerBlockTarget, 
      nodeRandomMinCount, 
      nodeRandomPingCount, 
      REPORTS_BEFORE_SLASH_V, 
      REPORTS_BEFORE_SLASH_S_A, 
      SLASHES_BEFORE_BAN_V, 
      SLASHES_BEFORE_BAN_S_A, 
      SLASH_PERCENT, 
      BAN_PERCENT
    } = VALIDATOR_CONTRACT_PARAMS;

    const validatorV1Proxy = await upgrades.deployProxy(validatorV1Factory,
      [PROTOCOL_VERSION, pushCt, valPerBlockTarget, nodeRandomMinCount, nodeRandomPingCount,
        REPORTS_BEFORE_SLASH_V, REPORTS_BEFORE_SLASH_S_A, SLASHES_BEFORE_BAN_V, SLASHES_BEFORE_BAN_S_A,
        SLASH_PERCENT, BAN_PERCENT],
      {
        kind: "uups",
        unsafeAllowLinkedLibraries: true
      });
    await validatorV1Proxy.deployed();
    log(`deployed proxy: ${validatorV1Proxy.address}`);

    let validatorV1Impl = await upgrades.erc1967.getImplementationAddress(validatorV1Proxy.address);
    log(`deployed impl: ${validatorV1Impl}`);
    log('done');
    return validatorV1Proxy;
  }

  export async function updateValidatorContract(hre: HardhatRuntimeEnvironment, validatorProxyCt: string) {
    const ethers = hre.ethers;
    const [owner] = await hre.ethers.getSigners();
    log(`owner is ${owner.address}`);
    log(`proxy is ${validatorProxyCt}`);
    const validatorV1Factory = await ethers.getContractFactory("ValidatorV1");
    const abi = await upgrades.upgradeProxy(validatorProxyCt, validatorV1Factory, {kind: 'uups'});
    log(`updated proxy at address: ${abi.address}`);
  }

  export async function deployStorageContract(hre: HardhatRuntimeEnvironment, valCt: string): Promise<StorageV1> {
    log('deploying StorageV1')
    const { rfTarget } = STORAGE_CONTRACT_PARAMS;
    const factory = await hre.ethers.getContractFactory("StorageV1");
    const proxyCt = await upgrades.deployProxy(factory,
      [PROTOCOL_VERSION, valCt, rfTarget],
      {kind: "uups"});
    await proxyCt.deployed();
    log(`deployed proxy: ${proxyCt.address}`);
    let implCt = await upgrades.erc1967.getImplementationAddress(proxyCt.address);
    log(`deployed impl: ${implCt}`);
    log('done');
    return proxyCt;
  }

  export async function updateStorageContract(hre: HardhatRuntimeEnvironment, storageProxyCt: string) {
    const ethers = hre.ethers;
    const [owner] = await hre.ethers.getSigners();
    log(`owner is ${owner.address}`);
    log(`proxy is ${storageProxyCt}`);
    const storageV1Factory = await ethers.getContractFactory("StorageV1");
    const abi = await upgrades.upgradeProxy(storageProxyCt, storageV1Factory, {kind: 'uups'});
    log(`updated proxy at address: ${abi.address}`);
  }
}

export enum NodeType {
  VNode = 0, // validator 0
  SNode = 1, // storage 1
  ANode = 2 // anode 2
}