<h1 align="center">
    <a href="https://push.org/#gh-light-mode-only">
    <img width='20%' height='10%' src="https://res.cloudinary.com/drdjegqln/image/upload/v1686227557/Push-Logo-Standard-Dark_xap7z5.png">
    </a>
    <a href="https://push.org/#gh-dark-mode-only">
    <img width='20%' height='10%' src="https://res.cloudinary.com/drdjegqln/image/upload/v1686227558/Push-Logo-Standard-White_dlvapc.png">
    </a>
</h1>

<p align="center">
  <i align="center">Push protocol is evolving to Push Chain, a shared-state L1 designed to deliver universal app experiences (Any Chain. Any User. Any App).🚀</i>
</p>

<h4 align="center">

  <a href="https://discord.com/invite/pushprotocol">
    <img src="https://img.shields.io/badge/discord-7289da.svg?style=flat-square" alt="discord">
  </a>
  <a href="https://twitter.com/pushprotocol">
    <img src="https://img.shields.io/badge/twitter-18a1d6.svg?style=flat-square" alt="twitter">
  </a>
  <a href="https://www.youtube.com/@pushprotocol">
    <img src="https://img.shields.io/badge/youtube-d95652.svg?style=flat-square&" alt="youtube">
  </a>
</h4>

# Push Node Smart Contracts

## Getting Started

### Installation

1. Clone the push-node-smart-contracts repository:

```sh
git clone https://github.com/ethereum-push-notification-service/push-node-smart-contracts
```

2. Change to the project directory:

```sh
cd push-node-smart-contracts
```

3. Install the dependencies:

```sh
npm install
```

---

### Running EVM

#### Option1: Sepolia

Use Sepolia
Edit .env: SEPOLIA_RPC_URL, SEPOLIA_PRIVATE_KEY, SEPOLIA_ETHERSCAN_API_KEY , SEPOLIA_PUSH_TOKEN_ADDRESS

#### Option2: Dockerized pre-configured hardhat for 5 nodes

You will get a docker image with HardHat
with deployed contracts: PushToken(mock), Validator.sol, Storage.sol
with deployed nodes: v1,v2,v3,s1,s2

calls `deploy.sh -n localhost -f deployAllLocalhost` internally

```bash
docker build . -t hardhat
docker run -it -d -p 8545:8545 --name hardhat hardhat
docker logs --follow hardhat
# TO REMOVE:
docker rm -f hardhat
```

#### Option3: Hardhat VM

Run an empty local hardhat EVM as a DEDICATED SEPARATE PROCESS

```shell
export PRIVATE_KEY=[YOUR KEY]
npx hardhat node
```

### Deployment Instructions

#### Deploy on local Hardhat network

- all contracts (no properties needed)

```bash
bash sh/deploy.sh -n localhost -f deployAll
```

- all contracts except the Push Token
  edit XXXXXX_PUSH_TOKEN_ADDRESS variable in .env

```bash
bash sh/deploy.sh -n localhost -f deployAllNoToken
```

#### Deploy on Sepolia

same as for local; use `-n sepolia`

#### Old manual deploy script

```bash
export PUSH_CT=# PUT TOKEN HERE
npx hardhat --network sepolia v:deployValidatorCt $PUSH_CT
export VAL_CT= # PUT PROXY HERE
npx hardhat verify --network sepolia $VAL_CT

npx hardhat --network sepolia v:deployStorageCt $VAL_CT
export STORAGE_CT= # PUT PROXY HERE
npx hardhat verify --network sepolia $STORAGE_CT
```

### Registering nodes (sepolia example)

edit .env
SEPOLIA_RPC_URL
SEPOLIA_PRIVATE_KEY

declare env vars in the shell

```shell
export PUSH_CT=# PUT TOKEN HERE
export VAL_CT= # PUT PROXY HERE
export STORAGE_CT= # PUT PROXY HERE
```

#### to get sepolia eth (if needed)

https://www.alchemy.com/faucets/ethereum-sepolia

#### to get push token (if needed)

go to https://sepolia.etherscan.io/token/0x37c779a1564DCc0e3914aB130e0e787d93e21804#writeContract
connect web3 wallet
mint to get tokens (x18 zeroes)

```shell
#v1
npx hardhat --network sepolia v:registerValidator --validator-proxy-ct $VAL_CT --push-ct $PUSH_CT 8e12de12c35eabf35b56b04e53c4e468e46727e8 "https://vv1.dev.push.org" 101
#v2
npx hardhat --network sepolia v:registerValidator --validator-proxy-ct $VAL_CT --push-ct $PUSH_CT fdaeaf7afcfbb4e4d16dc66bd2039fd6004cfce8 "https://vv2.dev.push.org" 102
#v3
npx hardhat --network sepolia v:registerValidator --validator-proxy-ct $VAL_CT --push-ct $PUSH_CT 98f9d910aef9b3b9a45137af1ca7675ed90a5355 "https://vv3.dev.push.org" 103

#s1
npx hardhat --network sepolia v:registerStorage --validator-proxy-ct $VAL_CT --push-ct $PUSH_CT 3563C89b05e4dcD0edEeE0F3e93e396C128C06E2 "http://ss1.dev.push.org" 250
#s2
npx hardhat --network sepolia v:registerStorage --validator-proxy-ct $VAL_CT --push-ct $PUSH_CT b4d6fd1c0df9e3f427a1a8f8a8ec122396206ff7 "http://ss2.dev.push.org" 260
```

#### Info commands

```shell
# show balance in PUSH tokens for Validator contract
npx hardhat --network localhost push:balanceOf --push-ct $PUSH_CT $VAL_CT
# show registered validator nodes
npx hardhat --network localhost v:listNodes --validator-proxy-ct $VAL_CT
```

---

### Running Tests (uses embedded EVM, it resets for every test case)

#### all tests

```shell
npx hardhat test
```

#### Storage.sol tests

```shell
# for normal tests
npx hardhat test --grep StorageTestAutoRf
npx hardhat test --grep StorageTestNoAutoRf
# for fuzzy tests (takes 5-15min)
StorageTestBig=true npx hardhat test --grep StorageTestBig
```

## Licenses

All crates of this repository are licensed under either of

- Apache License, Version 2.0, ([LICENSE-APACHE](LICENSE-APACHE) or http://www.apache.org/licenses/LICENSE-2.0)
- MIT license ([LICENSE-MIT](LICENSE-MIT) or http://opensource.org/licenses/MIT)

at your option.
