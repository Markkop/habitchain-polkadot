# 🚀 HabitChain Quick Start Guide

**Get your habit tracker running in 10 minutes!**

---

## ⚡ Fast Track Deployment

### Step 1: Deploy Contract (5 minutes)

```bash
# Navigate to contracts directory
cd contracts

# Set your private key (no 0x prefix)
echo "PRIVATE_KEY=paste_your_private_key_here" > .env

# Get testnet tokens
# 1. Copy your wallet address from the error message or Web3Auth
# 2. Visit: https://faucet.polkadot.io/?parachain=1111
# 3. Paste your address and request tokens
# 4. Wait 1-2 minutes

# Compile the contract
npx hardhat compile

# Run tests (optional but recommended)
npx hardhat test

# Deploy to Paseo Asset Hub TestNet
# Replace YOUR_WALLET_ADDRESS with your actual address
npx hardhat ignition deploy ./ignition/modules/HabitTracker.ts \
  --network passetHubTestnet \
  --parameters '{"HabitTrackerModule":{"treasury":"YOUR_WALLET_ADDRESS"}}'

# 📝 COPY THE DEPLOYED CONTRACT ADDRESS FROM OUTPUT!
```

**Expected Output**:
```
✅ HabitTracker deployed to: 0x1234567890abcdef...
```

### Step 2: Update Frontend (2 minutes)

```bash
# Navigate to frontend
cd ../frontend

# Open the hook file in your editor
# File: src/hooks/useHabitTracker.ts

# Find line 7:
const HABIT_TRACKER_ADDRESS = '0x0000000000000000000000000000000000000000';

# Replace with YOUR deployed address:
const HABIT_TRACKER_ADDRESS = '0x1234567890abcdef...'; // Your address here
```

### Step 3: Run Frontend (1 minute)

```bash
# Still in frontend directory
npm install  # If not done already

# Start development server
npm run dev

# Open browser to: http://localhost:5173
```

### Step 4: Test It! (2 minutes)

1. **Connect Wallet**: Click "Login" → Choose Google/Twitter
2. **Get Tokens**: Click "💰 Faucet" button → Request tokens
3. **Switch to HabitChain**: Click "⛓️ HabitChain" tab
4. **Deposit**: Enter 50 PAS → Click "Deposit"
5. **Create Habit**: Type "Test habit" → Create
6. **Prepare Day**: Click "🚀 Prepare Today"
7. **Check In**: Click "📝 Check In" on your habit

**🎉 Done! Your HabitChain is working!**

---

## 🔥 Common Issues & Fixes

### Issue: "Contract not deployed"
**Fix**: Update `HABIT_TRACKER_ADDRESS` in `useHabitTracker.ts`

### Issue: "Insufficient funds"
**Fix**: Get more PAS from faucet, wait a few minutes

### Issue: "Transaction failed"
**Fix**: Check you have enough deposit balance, day is prepared

### Issue: "Can't connect wallet"
**Fix**: Reload page, check internet connection

### Issue: npm install errors
**Fix**: 
```bash
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

---

## 📚 Full Documentation

- **Complete Guide**: See `HABITCHAIN_README.md`
- **Technical Details**: See `BLUEPRINT.md`
- **Implementation**: See `IMPLEMENTATION_COMPLETE.md`

---

## 💬 Need Help?

1. Check browser console for errors
2. Verify contract address on Blockscout
3. Make sure you're on Paseo Asset Hub TestNet (Chain ID: 420420422)
4. Ensure you have PAS tokens in your wallet

---

**Happy Habit Building! 🎯⛓️**

