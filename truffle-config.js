/* eslint-disable no-undef */
require("babel-register");
require("babel-polyfill");

const { ropsten, rinkeby } = require("./secrets.json");
const HDWalletProvider = require("@truffle/hdwallet-provider");

module.exports = {
  plugins: ["solidity-coverage", "truffle-contract-size"],
  networks: {
    test: {
      host: "127.0.0.1",
      port: 7545,
      network_id: "*",
    },
    development: {
      host: "127.0.0.1",
      port: 7545,
      network_id: "*",
    },
    ropsten: {
      provider: function () {
        // eslint-disable-next-line prettier/prettier
        return new HDWalletProvider(ropsten.mnemonic, `https://ropsten.infura.io/v3/${ropsten.projectId}`);
      },
      network_id: 3, // Ropsten's id
      gas: 5500000, // Ropsten has a lower block limit than mainnet
      confirmations: 2, // # of confs to wait between deployments. (default: 0)
      timeoutBlocks: 200, // # of blocks before a deployment times out  (minimum/default: 50)
      skipDryRun: true, // Skip dry run before migrations? (default: false for public nets )  //make sure this gas allocation isn't over 4M, which is the max
    },
    rinkeby: {
      provider: function () {
        // eslint-disable-next-line prettier/prettier
        return new HDWalletProvider(ropsten.mnemonic, `https://rinkeby.infura.io/v3/${rinkeby.projectId}`);
      },
      network_id: 4,
      gas: 5500000,
      confirmations: 2,
      timeoutBlocks: 200,
      skipDryRun: true,
    },
  },
  compilers: {
    solc: {
      version: "^0.8.0",
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  contracts_directory: "./contracts/",
  contracts_build_directory: "./abis/",
};
