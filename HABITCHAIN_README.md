# HabitChain - Gamified Habit Tracker on Polkadot

**Build better habits with blockchain accountability!**

HabitChain is a decentralized application (dApp) that uses financial commitment to help you build and maintain daily habits. Stake PAS tokens, check in daily, and earn rewards for consistency.

---

## 🎯 How It Works

1. **Create Habits**: Define daily habits you want to build (e.g., "Exercise 30 minutes")
2. **Stake Tokens**: Each habit costs 10 PAS per day to track
3. **Prepare Your Day**: Lock funds every morning to commit to your habits
4. **Check In**: Complete your habits and check in before UTC midnight
5. **Settle & Earn**: After midnight, settle yesterday's results:
   - ✅ **Checked in** → Win back your 10 PAS stake
   - ❌ **Missed check-in** → Lose your 10 PAS to treasury

---

## 🚀 Deployment Guide

### Prerequisites

- Node.js 18+ and npm/yarn
- PAS tokens on Paseo Asset Hub TestNet
- Private key for deployment wallet

### Step 1: Deploy Smart Contract

```bash
cd contracts

# Set your private key (no 0x prefix)
echo "PRIVATE_KEY=your_private_key_here" > .env

# Get testnet PAS tokens
# Visit: https://faucet.polkadot.io/?parachain=1111&address=YOUR_ADDRESS

# Compile the contract
npx hardhat compile

# Verify contract size is under 100KB
# Check: artifacts/contracts/HabitTracker.sol/HabitTracker.json

# Run tests (optional but recommended)
npx hardhat test

# Deploy to Paseo Asset Hub TestNet
npx hardhat ignition deploy ./ignition/modules/HabitTracker.ts --network passetHubTestnet --parameters '{"HabitTrackerModule":{"treasury":"0xYOUR_TREASURY_ADDRESS"}}'

# Save the deployed contract address!
```

**Important**: Replace `0xYOUR_TREASURY_ADDRESS` with an address that will receive slashed stakes (failed check-ins).

### Step 2: Update Frontend Configuration

After deployment, update the contract address in the frontend:

```bash
cd frontend

# Open this file:
# src/hooks/useHabitTracker.ts

# Replace this line:
const HABIT_TRACKER_ADDRESS = '0x0000000000000000000000000000000000000000';

# With your deployed address:
const HABIT_TRACKER_ADDRESS = '0xYOUR_DEPLOYED_CONTRACT_ADDRESS';
```

### Step 3: Run Frontend

```bash
cd frontend

# Install dependencies (if not already done)
npm install

# Start development server
npm run dev

# Visit http://localhost:5173
```

### Step 4: Verify on Blockscout

Visit the Paseo Asset Hub block explorer:
```
https://blockscout-passet-hub.parity-testnet.parity.io/address/YOUR_CONTRACT_ADDRESS
```

Verify:
- Contract is deployed
- ABI is readable
- You can interact with read functions

---

## 📖 User Guide

### Getting Started

1. **Connect Wallet**
   - Click "Login" button
   - Choose your social login (Google, Twitter, etc.)
   - Web3Auth creates a wallet for you automatically

2. **Get Testnet Tokens**
   - Click "💰 Faucet" button
   - Request PAS tokens from the faucet
   - Wait 1-2 minutes for tokens to arrive

3. **Deposit Funds**
   - Go to "Wallet Actions" section
   - Enter amount (e.g., 50 PAS)
   - Click "Deposit"
   - Confirm transaction in wallet

### Daily Workflow

#### Morning Routine (Anytime before midnight UTC)

1. **Create Habits** (First time only)
   ```
   - Click "➕ Create Habit"
   - Enter habit description (3-100 characters)
   - Submit transaction
   - Each habit costs 10 PAS per day
   ```

2. **Prepare Your Day**
   ```
   - Click "🚀 Prepare Today"
   - This locks 10 PAS per active habit
   - Funds move from "Deposit" to "Blocked"
   ```

3. **Check In to Habits**
   ```
   - Complete your habit in real life
   - Click "📝 Check In" on the habit card
   - Do this before UTC midnight!
   ```

#### Next Day Routine

4. **Settle Yesterday**
   ```
   - After UTC midnight, click "✅ Settle Yesterday"
   - This processes all habits from previous day
   - Successful check-ins: 10 PAS → Claimable
   - Missed check-ins: 10 PAS → Treasury (lost)
   ```

5. **Claim Rewards**
   ```
   - Go to "Wallet Actions"
   - Enter claimable amount
   - Click "Claim"
   - PAS tokens return to your wallet
   ```

### Pro Tips

- **Check the Timer**: The page shows time remaining until UTC midnight
- **Prepare Early**: Prepare your day in the morning to ensure funds are locked
- **Set Reminders**: Set phone alarms before midnight to check in
- **Start Small**: Begin with 1-2 habits, then add more
- **Archive Old Habits**: Click 🗑️ to archive habits you no longer track

---

## 🏗️ Architecture

### Smart Contract

**File**: `contracts/contracts/HabitTracker.sol`

**Key Features**:
- Epoch-based time (86400-second days)
- Three balance pools: Deposit, Blocked, Claimable
- Permissionless settlement (anyone can settle anyone's day)
- Idempotent operations (safe to call multiple times)
- Gas-optimized batch settlement (up to 50 habits at once)

**Core Functions**:
```solidity
deposit()                              // Add PAS to staking pool
withdraw(amount)                       // Remove available PAS
claim(amount)                          // Claim won rewards
createHabit(text)                      // Create new habit
archiveHabit(habitId)                  // Soft delete habit
prepareDay(epoch)                      // Lock funds for today
checkIn(habitId, epoch)                // Mark habit complete
settleAll(user, epoch, maxCount)       // Process yesterday's results
```

### Frontend

**Technology Stack**:
- React 18 + TypeScript
- Vite (build tool)
- wagmi (Web3 library)
- Web3Auth (social login)

**Key Components**:
- `BalanceSummary`: Display deposit/blocked/claimable balances
- `DailyCyclePanel`: Timer + prepare/settle buttons
- `WalletActions`: Deposit/withdraw/claim forms
- `HabitCard`: Individual habit with check-in button
- `HabitList`: Grid of all habits

**Custom Hooks**:
- `useHabitTracker`: Contract interactions + state management

---

## 🧪 Testing

### Run Contract Tests

```bash
cd contracts
npx hardhat test

# Run specific test file
npx hardhat test test/HabitTracker.test.ts

# With gas reporting
REPORT_GAS=true npx hardhat test
```

**Test Coverage**:
- 35+ test cases
- Balance management (deposit, withdraw, claim)
- Habit lifecycle (create, archive)
- Daily cycle (prepare, check-in, settle)
- Edge cases (epoch boundaries, archived habits, insufficient balance)

### Frontend Testing

```bash
cd frontend

# Run unit tests (if configured)
npm test

# Manual testing checklist:
# [ ] Connect wallet
# [ ] Deposit PAS
# [ ] Create habit
# [ ] Prepare day
# [ ] Check in
# [ ] Wait until next day
# [ ] Settle yesterday
# [ ] Claim rewards
```

---

## 🔐 Security Considerations

### Smart Contract

- **Reentrancy Protection**: External calls happen last in functions
- **Overflow Protection**: Solidity 0.8.28 has built-in checks
- **Access Control**: Only habit owners can check in / archive
- **Time Manipulation**: Uses `block.timestamp` (miner-resistant on L2)
- **DoS Prevention**: Batch settlement has 50-habit limit

### Frontend

- **Private Key Management**: Web3Auth handles keys securely
- **Input Validation**: Habit text limited to 3-100 characters
- **Transaction Confirmation**: User explicitly approves all transactions
- **XSS Protection**: React escapes user input by default

### Best Practices

- ✅ Never share your private key
- ✅ Start with small amounts on testnet
- ✅ Verify contract address on Blockscout
- ✅ Double-check transaction details before signing
- ❌ Don't use production funds on testnet
- ❌ Don't deploy unaudited contracts to mainnet

---

## 🐛 Troubleshooting

### Contract Deployment Issues

**Error**: "initcode is too big"
- **Cause**: Contract exceeds 100KB bytecode limit
- **Solution**: Verify no OpenZeppelin imports, optimize code

**Error**: "Insufficient funds"
- **Cause**: Not enough PAS for gas fees
- **Solution**: Get more PAS from faucet

**Error**: "Invalid treasury address"
- **Cause**: Treasury address is zero address
- **Solution**: Provide valid address in deployment parameters

### Frontend Issues

**Error**: "Contract not deployed"
- **Cause**: `HABIT_TRACKER_ADDRESS` is still default zero address
- **Solution**: Update address in `useHabitTracker.ts`

**Error**: "Transaction failed"
- **Cause**: Various reasons (insufficient balance, already checked in, etc.)
- **Solution**: Check error message, verify preconditions

**Error**: "Can't prepare day"
- **Cause**: Insufficient deposit balance
- **Solution**: Deposit more PAS tokens

**Habits not showing**
- **Cause**: Contract reads not working
- **Solution**: Check browser console for errors, verify network connection

---

## 📊 Contract Data

### Network Information

- **Network**: Paseo Asset Hub TestNet
- **Chain ID**: 420420422 (0x1911f0a6)
- **RPC**: https://testnet-passet-hub-eth-rpc.polkadot.io
- **Explorer**: https://blockscout-passet-hub.parity-testnet.parity.io
- **Faucet**: https://faucet.polkadot.io/?parachain=1111

### Constants

- **Stake Per Day**: 10 PAS (10^10 wei)
- **Seconds Per Day**: 86400
- **Max Settle Batch**: 50 habits

### Balances Explained

1. **Deposit Balance**
   - Your available staking pool
   - Can be withdrawn anytime
   - Decreased when preparing day

2. **Blocked Balance**
   - Funds locked for today's habits
   - Cannot be withdrawn
   - Decreased when settling (moved to claimable or treasury)

3. **Claimable Balance**
   - Rewards won from successful check-ins
   - Can be claimed to wallet
   - Can be redeposited for more staking

**Invariant**: `contract_balance >= deposit + blocked + claimable` (for all users combined)

---

## 🌟 Future Enhancements

### Smart Contract V2

- [ ] Reward multipliers for streaks
- [ ] Social features (public habits, friends)
- [ ] NFT achievements for milestones
- [ ] Variable staking amounts
- [ ] Community challenges

### Frontend V2

- [ ] Analytics dashboard with charts
- [ ] Habit categories/tags
- [ ] Dark mode
- [ ] Mobile app (React Native)
- [ ] Push notifications for check-ins
- [ ] Calendar view of history

### Infrastructure

- [ ] Subgraph for event indexing
- [ ] Backend API for caching
- [ ] IPFS for long-form descriptions
- [ ] Multi-chain deployment

---

## 📄 License

MIT License - See LICENSE file for details

---

## 🙏 Acknowledgments

- Built with [Hardhat](https://hardhat.org/) and [@parity/hardhat-polkadot](https://github.com/paritytech/hardhat-polkadot)
- Wallet integration via [Web3Auth](https://web3auth.io/)
- Inspired by commitment contracts and habit tracking research
- Thanks to Polkadot ecosystem for testnet infrastructure

---

## 📞 Support

- **Issues**: Open a GitHub issue
- **Discussions**: Join Polkadot Discord
- **Documentation**: See BLUEPRINT.md for implementation details

---

**Happy Habit Building! 🎯⛓️**

