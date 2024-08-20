import {RegisterUtil} from "./src/RegisterUtil";

require("@nomiclabs/hardhat-ethers");
const fs = require("fs");
// const { bytecode } = require("./Create2Deployer.json");

task(
  "deploy",
  "Deploys contract and writes address to ./.contract",
  async (taskArgs, hre) => {
     RegisterUtil.registerNode();
  },
);

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: "0.7.6",
  networks: {
    hardhat: {
      // Provide a large amount of funded accounts for large scale tests
      accounts: { count: 20 },
      chainId: 1337,
    },
  },
};