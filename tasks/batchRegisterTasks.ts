import {task, types} from "hardhat/config";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import {Wallet} from "ethers";
import {FileUtil} from "../src/utilz/FileUtil";
import {KeyUtil} from "../src/utilz/KeyUtil";
import {StrUtil} from "../src/utilz/strUtil";
// import * as path from "node:path";

// todo const DEFAULT_DIR = '../push-vnode/docker';
const DEFAULT_DIR = '../push-vnode/docker';
const NETWORK_LOCALHOST = 'localhost';
const NETWORK_SEPOLIA = 'sepolia';

/*

Generate node keys (node_key.json) for every validator from 1 to 15:
>npx hardhat --network localhost generateNodeKeys "../push-vnode/docker/_local" "test" "v" "15"

Generate console commands to register these keys in a smart contract:
(you should execute them manually because sometimes evm operations fail or timeout)
>npx hardhat --network localhost generateRegisterScript "../push-vnode/docker/_local" "v"

Generates .yml file (see push-vnode/docker/v.yml) for all node keys found:
(re-writes v.yml! , provide file param if needed)
>npx hardhat --network localhost generateYml "../push-vnode/docker/_local" "v"



 */
task("generateNodeKeys", "")
  .addPositionalParam("keyDir", 'dir with v1..vN /node_key.json', DEFAULT_DIR, types.string, true)
  .addPositionalParam("keyPassword", 'keys are encrypted by default', 'test', types.string, true)
  .addPositionalParam("nodeType", 'node type, one of V,S,A (validator, storage, archival)', 'v', types.string, true)
  .addPositionalParam("nodeCount", 'node type, one of V,S,A (validator, storage, archival)', 10, types.int, true)
  .setAction(async (args, hre) => {
    // validate input
    let nodeType = args.nodeType.toString();
    let nodeTypeAsText = nodeType.toLowerCase();
    switch (nodeType) {
      case 'v':
        nodeTypeAsText = 'validator node'
        break;
      case 's':
        nodeTypeAsText = 'storage node'
        break;
      case 'a':
        nodeTypeAsText = 'archival node'
        break;
      default:
        throw new Error('invalid node type; valid options: v, s, a')
    }

    let nodeCount: number = args.nodeCount;
    if (!(nodeCount >= 1 && nodeCount <= 100)) {
      throw new Error('invalid node count, 1..100 is valid range');
    }

    let keyDir = args.keyDir;
    keyDir = FileUtil.resolvePath(keyDir);
    if (!await FileUtil.existsDir(keyDir)) {
      throw new Error('invalid keyDir');
    }

    let keyPassword = args.keyPassword;
    if(StrUtil.isEmpty(keyPassword)) {
      throw new Error('invalid keyPassword');
    }
    // end validate input
    console.log(`generating node keys [1..${nodeCount - 1}] in dir [${keyDir}], node type: ${nodeType}`)

    for (let index = 1; index <= nodeCount; index++) {
      const nodeWithIndex = `${nodeType}${index}`;
      const keyPath = path.join(keyDir, `${nodeWithIndex}/node_key.json`);
      if (await FileUtil.existsFile(keyPath)) {
        console.log(`[${nodeWithIndex}] key file ${keyPath} exists, skipping`);
        continue;
      }
      console.log(`[${nodeWithIndex}] creating key file  : ${keyPath} `);

      const nodeKeyDir = path.join(keyDir, nodeWithIndex);
      if (!await FileUtil.mkDir(nodeKeyDir)) {
        throw new Error(`failed to create dir ${nodeKeyDir} `);
      }
      let key = await KeyUtil.createEthPrivateKeyAsFile(keyPassword, keyPath);
      console.log(`OK pubKey: ${key.addr}`);
    }
  });


task("generateRegisterScript", "")
  .addPositionalParam("keyDir", 'dir with v1..vN /node_key.json', DEFAULT_DIR, types.string, true)
  .addPositionalParam("nodeType", 'node type, one of V,S,A (validator, storage, archival)', 'v', types.string, true)
  .setAction(async (args, hre) => {
    // validate input
    let nodeType = args.nodeType.toLowerCase();
    let nodeTypeAsText = nodeType.toLowerCase();
    switch (nodeType) {
      case 'v':
        nodeTypeAsText = 'validator node'
        break;
      case 's':
        nodeTypeAsText = 'storage node'
        break;
      case 'a':
        nodeTypeAsText = 'archival node'
        break;
      default:
        throw new Error('invalid node type; valid options: v, s, a')
    }

    let keyDir = args.keyDir;
    keyDir = FileUtil.resolvePath(keyDir);
    if (!await FileUtil.existsDir(keyDir)) {
      throw new Error('invalid keyDir');
    }

    let networkName = hre.network.name;
    if (!(networkName == NETWORK_LOCALHOST || networkName == NETWORK_SEPOLIA)) {
      throw new Error('invalid network name: only localhost or sepolia are supported');
    }
    // end validate input

    await processDirectories(keyDir, nodeType, networkName)
  });

// Function to process directories and generate commands
async function processDirectories(dir: string, nodeType: string, networkName: string): Promise<void> {
  // Regular expression to match "a" + number, "v" + number, "s" + number
  const dirPattern = new RegExp(`^[${nodeType}](\\d+)$`);

  // Read the input directory
  const subDirs = fs.readdirSync(dir).filter((subDir) => {
    const fullPath = path.join(dir, subDir);
    return fs.statSync(fullPath).isDirectory() && dirPattern.test(subDir);
  }).sort((a, b) => {
    let aVal = parseDir(a);
    let bVal = parseDir(b);
    return aVal.dirNumber - bVal.dirNumber;
  });;
  console.log("found subdirs: %o", subDirs);
  for (const subDir of subDirs) {
    const match = dirPattern.exec(subDir);
    if (!match) continue;

    const dirLetter = subDir[0]; // "a", "v", or "s"
    const dirNumber = parseInt(match[1], 10); // Extract number
    const keyPath = path.join(dir, subDir, "node_key.json");

    // Check if the JSON file exists
    if (!fs.existsSync(keyPath)) {
      console.warn(`JSON file not found: ${keyPath}`);
      continue;
    }

    // Read and parse the JSON file
    const address = await KeyUtil.readEthPrivateKeyAddress(keyPath);

    if (!address) {
      console.warn(`Address not found in file: ${keyPath}`);
      continue;
    }

    // Generate dynamic values
    let portOnLocalhost: number;
    let baseStake: number;
    let cmd: string;
    let nodeApiUrl = null;
    if (dirLetter === "v") {
      baseStake = 100;
      portOnLocalhost = 4000;
      cmd = "registerValidator";
    } else if (dirLetter === "s") {
      baseStake = 200;
      portOnLocalhost = 3000;
      cmd = "registerStorage";
    } else if (dirLetter === "a") {
      baseStake = 300;
      portOnLocalhost = 5000;
      cmd = "registerArchival";
    } else {
      throw new Error();
    }
    const calculatedPort = portOnLocalhost + dirNumber;

    if(networkName == NETWORK_LOCALHOST) {
      nodeApiUrl = `http://localhost${dirNumber}:${portOnLocalhost + dirNumber}`;
    } else if(networkName == NETWORK_SEPOLIA) {
      nodeApiUrl = `https://${dirLetter}${dirLetter}${dirNumber}.dev.push.org`;
    } else {
      throw new Error('unsupported network name');
    }

    const line = `npx hardhat --network ${networkName} v:${cmd} ${address} "${nodeApiUrl}" ${baseStake + dirNumber}`;

    // Print the generated command
    console.log(line);
  }
}


task("generateYml", "")
  .addPositionalParam("dockerDir", 'dir with v1..vN', DEFAULT_DIR, types.string, true)
  .addPositionalParam("nodeType", 'node type, one of V,S,A (validator, storage, archival)', 'v', types.string, true)
  .addPositionalParam("ymlFile", 'output file name', '', types.string, true)
  .setAction(async (args, hre) => {
    // validate input
    let nodeType = args.nodeType.toLowerCase();
    let nodeTypeAsText = nodeType.toLowerCase();
    switch (nodeType) {
      case 'v':
        nodeTypeAsText = 'validator node'
        break;
      case 's':
        nodeTypeAsText = 'storage node'
        break;
      case 'a':
        nodeTypeAsText = 'archival node'
        break;
      default:
        throw new Error('invalid node type; valid options: v, s, a')
    }

    let dockerDir = args.dockerDir;
    dockerDir = FileUtil.resolvePath(dockerDir);
    if (!await FileUtil.existsDir(dockerDir)) {
      throw new Error('invalid dockerDir');
    }

    let ymlFile = args.ymlFile;
    if (StrUtil.isEmpty(ymlFile)) {
      ymlFile = path.join(dockerDir, `${nodeType}.yml`);
    } else {
      ymlFile = path.join(dockerDir, ymlFile);
    }
    // end validate input

    console.log(`generating yml for node keys in dir [${dockerDir}], node type: ${nodeType}`)
    const dirPattern = new RegExp(`^[${nodeType}](\\d+)$`);

    // Read the input directory
    const subDirs = fs.readdirSync(dockerDir).filter((subDir) => {
      const fullPath = path.join(dockerDir, subDir);
      return fs.statSync(fullPath).isDirectory() && dirPattern.test(subDir);
    }).sort((a, b) => {
      let aVal = parseDir(a);
      let bVal = parseDir(b);
      return aVal.dirNumber - bVal.dirNumber;
    });
    console.log("found subdirs: %o", subDirs);
    let buf =
`version: '3'
services:
`;
    for(const subDir of subDirs) {
      let {dirLetter, dirNumber} = parseDir(subDir);

      let portOnLocalhost;
      let entryPointScript = "";
      if (dirLetter === "v") {
        portOnLocalhost = 4000 + dirNumber;
      } else if (dirLetter === "s") {
        portOnLocalhost = 3000 + dirNumber;
      } else if (dirLetter === "a") {
        portOnLocalhost = 5000 + dirNumber;
        entryPointScript = `
    entrypoint: ['sh', '/entrypoint.sh']`;
      } else {
        throw new Error('dirLetter is ' + dirLetter);
      }

      // DO NOT REFORMAT
      buf += `
  ${nodeType}node${dirNumber}:
    image: ${nodeType}node-main
    container_name: ${nodeType}node${dirNumber}
    networks:
      push-dev-network:
        aliases:
          - ${nodeType}node${dirNumber}.local
    environment:
      DB_NAME: ${nodeType}node${dirNumber}
      PORT: ${portOnLocalhost}
    env_file:
      - .env
      - common.env
      - ${nodeType}-specific.env
    ports:
      - "${portOnLocalhost}:${portOnLocalhost}"${entryPointScript}
    volumes:
      - ./${nodeType}${dirNumber}:/config
      - ./${nodeType}${dirNumber}/log:/log
      - ./_abi/:/config/abi/
      
      `;

    }
    buf += `

networks:
  push-dev-network:
    external: true
`;

    console.log('yaml: ------------------ \n\n%s', buf);
    console.log('\n\n writing to %s', ymlFile)
    await FileUtil.writeFileUtf8(ymlFile, buf);
  });


function parseDir(dirName: string) : {dirLetter: string, dirNumber: number} {
  const dirPattern = new RegExp(`^[vsa](\\d+)$`);;
  const match = dirPattern.exec(dirName);
  if (!match) {
    throw new Error('Invalid directory name format');
  }
  const dirLetter = dirName[0].toLowerCase();
  const dirNumber = parseInt(match[1], 10);
  return { dirLetter, dirNumber };
}