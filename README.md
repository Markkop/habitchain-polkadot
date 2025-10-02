# ⛓️ HabitChain - Gamified Habit Tracker on Polkadot

**Build better habits with blockchain accountability!**

HabitChain is a decentralized application that uses financial commitment to help you build daily habits. Stake PAS tokens, check in daily, and earn rewards for consistency.

## 🚀 Quick Start

**Ready to deploy? Just 3 steps:**

1. **Deploy Contract**: `cd contracts && npx hardhat ignition deploy ./ignition/modules/HabitTracker.ts --network passetHubTestnet`
2. **Update Frontend**: Replace `HABIT_TRACKER_ADDRESS` in `frontend/src/hooks/useHabitTracker.ts`
3. **Launch**: `cd frontend && npm run dev`

**See [QUICK_START.md](QUICK_START.md) for detailed instructions!**

---

## 📚 Documentation

- **[QUICK_START.md](QUICK_START.md)** - 10-minute deployment guide ⚡
- **[SUMMARY.md](SUMMARY.md)** - Implementation overview 📊
- **[HABITCHAIN_README.md](HABITCHAIN_README.md)** - Complete user guide 📖
- **[BLUEPRINT.md](BLUEPRINT.md)** - Technical architecture 🏗️
- **[IMPLEMENTATION_COMPLETE.md](IMPLEMENTATION_COMPLETE.md)** - Implementation details 🔍

---

## ✨ Features

- 💰 Deposit/withdraw PAS tokens
- 📝 Create and track daily habits
- 🚀 Daily cycle: Prepare → Check-in → Settle
- 🏆 Earn rewards for successful check-ins
- 💸 Lose stakes for missed check-ins
- 📊 Beautiful, responsive UI
- 🔐 Web3Auth social login
- ⏰ UTC midnight deadline tracking

---

## 🎯 How It Works

1. Create habits (10 PAS per habit per day)
2. Prepare your day (locks funds)
3. Check in before UTC midnight
4. Settle yesterday (win/lose stakes)
5. Claim your rewards

---

## 📦 What's Included

### Smart Contracts ✅
- `HabitTracker.sol` - Main contract (450 lines)
- Comprehensive test suite (35+ tests)
- Deployment scripts

### Frontend ✅
- 6 React components
- Custom hooks for Web3
- Responsive design
- Real-time updates

### Documentation ✅
- User guides
- Deployment instructions
- Troubleshooting
- Technical specifications

---

## 🛠️ Tech Stack

- **Smart Contracts**: Solidity 0.8.28
- **Development**: Hardhat + @parity/hardhat-polkadot
- **Frontend**: React 18 + TypeScript + Vite
- **Web3**: wagmi + viem + Web3Auth
- **Network**: Paseo Asset Hub TestNet

---

## 📊 Project Status

- ✅ Smart contracts implemented and tested
- ✅ Frontend fully functional
- ✅ Documentation complete
- ✅ Ready for deployment

**All 8 implementation tasks completed!** 🎉

---

# Original Template Information

This project is built on the react-solidity-hardhat template which sets up a combination of Solidity smart contracts and a React front-end app that interacts with these smart contracts.

This template includes:

- [OpenZeppelin](https://docs.openzeppelin.com/contracts/5.x/) smart contract library.
- [hardhat](https://hardhat.org/) smart contract development tooling.
- [wagmi](https://wagmi.sh/) for smart contract interaction.
- [Tailwind CSS](https://tailwindcss.com) + [Tailwind UI](https://tailwindui.com/).
- [Vite](https://vite.dev/) for dev tooling.

The project is configured to deploy on "[Passet Hub](https://polkadot.js.org/apps/?rpc=wss%3A%2F%2Fpasset-hub-paseo.ibp.network#/accounts)" network

## Setting up environment

First, set up Metamask wallet for Passet Hub network, and get some PAS there. ([docs](https://docs.polkadot.com/develop/smart-contracts/wallets/))  
In `contracts` directory, set up private key for hardhat:

```
npx hardhat vars set PRIVATE_KEY "INSERT_PRIVATE_KEY"
```

[How to export private key from Metamask wallet](https://support.metamask.io/configure/accounts/how-to-export-an-accounts-private-key/)

## 1. Writing smart contracts

Contracts are written in `contracts/contracts`. Each smart contract has a Hardhat Ignition module counterpart in `contracts/igniton/modules`. More on that in [Hardhat Ignition docs](https://hardhat.org/ignition/docs/getting-started#overview).

1. Edit smart contracts in `contracts/contracts`
2. Edit ignition module in `contracts/igniton/modules`
3. Run `npx hardhat compile` to compile smart contracts
4. Run `npx hardhat ignition deploy ./ignition/modules/<ModuleName>.ts --network polkadotHubTestnet` to deploy them

### Note on committing `ignition/deployments`

This is a directory that contains build and deployment artifacts from `hardhat`.
They aren't ignored, becuase they are used for types generation for frontend: if there's a smart contract already deployed, you may want to keep it in git, so a fresh clone would give you a working frontend.

However, several issues with hardhat are resolved by removing `ignition/deployments` directory, to start fresh deployment. These issues include:

```
An unexpected error occurred:

Error: Could not parse row {...
```

```
[ MyTokenModule ] reconciliation failed ⛔

The module contains changes to executed futures:
...
```

In such cases, do `rm -rf ignition/deployments`, deploy the new contract, and commit the artifacts anew :)

## 2. Interacting with smart contracts from frontend app

1. Generate types from deployed smart contracts by running `npm run generate` in `frontend` directory
2. Run `npm run dev` to start `vite` environment
3. You can import contract ABI and deployed addresses from `src/generated.ts`:

```ts
import {
  myTokenModuleMyTokenAddress,
  myTokenModuleMyTokenAbi,
} from "./generated";

const contractAddress = myTokenModuleMyTokenAddress[420420422];
// ...
writeContract({
  address: contractAddress,
  abi: myTokenModuleMyTokenAbi,
  functionName: "mint",
  args: [address, BigInt(amount) * 10n ** BigInt(params.decimals)],
});
```

More info at:

- [docs on smart contracts on Polkadot](https://docs.polkadot.com/develop/smart-contracts/)
- [hardhat docs](https://hardhat.org/docs)
- [wagmi docs](https://wagmi.sh/react/getting-started)
