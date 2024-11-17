// noinspection SpellCheckingInspection

import {HardhatUserConfig, task} from "hardhat/config";

require('@openzeppelin/hardhat-upgrades');
import "@nomicfoundation/hardhat-toolbox";
import {HardhatRuntimeEnvironment} from "hardhat/types";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";

require("dotenv").config();

const config: HardhatUserConfig = {
    solidity: {
        version: "0.8.20",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
            },
        },
    },
    // defaultNetwork: "polygon_mumbai",

    networks: {
        hardhat: {
            gas: 30000000
        },
        sepolia : {
            url: process.env.SEPOLIA_RPC_URL,
            accounts: [process.env.SEPOLIA_PRIVATE_KEY]
        },
    },

    etherscan: {
        apiKey: {
            sepolia: process.env.SEPOLIA_ETHERSCAN_API_KEY
        }
    }
};

export default config;

/* TASKS */
import "./tasks/deployTasks"
import "./tasks/keyTasks"
import "./tasks/registerTasks"