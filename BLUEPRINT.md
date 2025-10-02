# Habit Tracker dApp - Polkadot Implementation Blueprint

**Project**: HabitChain  
**Target Network**: Paseo Asset Hub TestNet (Chain ID: 420420422)  
**Tech Stack**: Hardhat + Solidity 0.8.28 + React + Vite + wagmi + Web3Auth  
**Goal**: Implement gamified habit tracking with staking mechanism on Polkadot EVM

---

## 📋 Executive Summary

Adapt the Starknet Habit Tracker dApp to Polkadot Asset Hub using your existing infrastructure:
- **Smart Contracts**: Replace Cairo with Solidity 0.8.28 (minimal implementations, no OpenZeppelin)
- **Frontend**: Leverage existing React + Vite + wagmi + Web3Auth setup
- **Token**: Use PAS (native) or deploy HabitToken (ERC-20)
- **Timeline**: 4-6 weeks for MVP (3 phases)

---

## 🏗️ Architecture Mapping

### Original (Starknet) → Target (Polkadot Asset Hub)

| Component | Starknet | Polkadot Asset Hub |
|-----------|----------|---------------------|
| **Smart Contract Language** | Cairo 2.0 | Solidity 0.8.28 |
| **Blockchain** | Starknet L2 | Paseo Asset Hub (EVM-compatible) |
| **Token Standard** | ERC20 (STRK) | ERC20 (PAS or custom HabitToken) |
| **Frontend** | Next.js + starknet-react | React + Vite + wagmi |
| **Wallet** | ArgentX, Braavos | Web3Auth (social login) + MetaMask |
| **Development Tool** | Starknet Foundry | Hardhat + @parity/hardhat-polkadot |
| **Testing** | scarb test | Hardhat test + Mocha/Chai |
| **Network RPC** | Starknet RPC | https://testnet-passet-hub-eth-rpc.polkadot.io |
| **Block Explorer** | Starkscan | Blockscout |

---

## 🎯 Phase 1: Smart Contract Development (Week 1-2)

### 1.1 Contract Architecture

**Core Contracts** (avoid size bloat - stay under 100KB):
1. **HabitTracker.sol** (~400-500 lines) - Main contract
2. **HabitToken.sol** (~100 lines) - Simplified ERC-20 (or use PAS native)

**Design Decision**: 
- Option A: Use PAS native token (simpler, no token deployment)
- Option B: Deploy custom HabitToken (better branding, more control)

**Recommended**: Start with Option A (PAS), migrate to Option B later.

---

### 1.2 HabitTracker.sol Implementation

**File Location**: `/contracts/contracts/HabitTracker.sol`

#### Core Data Structures

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title HabitTracker
 * @notice Gamified habit tracking with financial commitment
 * @dev Uses epoch-based time (86400-second days) for daily cycles
 */
contract HabitTracker {
    // Constants
    uint256 public constant STAKE_PER_DAY = 10 ether; // 10 PAS per habit per day
    uint256 private constant SECONDS_PER_DAY = 86400;
    
    // State variables
    address public treasury; // Receives slashed stakes
    uint256 public totalTreasuryReceived;
    
    // User state mapping
    struct UserState {
        uint256 depositBalance;    // Available funds for staking
        uint256 blockedBalance;    // Funds locked for today
        uint256 claimableBalance;  // Won funds (withdrawable)
        uint32 activeHabitCount;   // Non-archived habits
    }
    mapping(address => UserState) public userStates;
    
    // Habit struct
    struct Habit {
        uint32 id;              // User-scoped ID
        address owner;
        string text;            // Description (max 100 chars)
        uint64 createdAtEpoch;  // Day of creation
        bool archived;
    }
    
    // Storage: user => habitId => Habit
    mapping(address => mapping(uint32 => Habit)) public habits;
    mapping(address => uint32) public userHabitCounters; // Next available ID
    
    // Daily status struct
    struct DailyStatus {
        bool funded;    // Had sufficient balance at day start
        bool checked;   // User checked in during the day
        bool settled;   // Day has been settled
    }
    
    // Storage: user => epoch => habitId => DailyStatus
    mapping(address => mapping(uint64 => mapping(uint32 => DailyStatus))) public dailyStatuses;
    
    // Events (for frontend indexing)
    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event Claimed(address indexed user, uint256 amount);
    event RedepositedFromClaimable(address indexed user, uint256 amount);
    
    event HabitCreated(address indexed user, uint32 indexed habitId, string text);
    event HabitArchived(address indexed user, uint32 indexed habitId);
    
    event DayPrepared(address indexed user, uint64 indexed epoch, uint32 fundedCount, uint32 insufficientCount);
    event CheckedIn(address indexed user, uint32 indexed habitId, uint64 indexed epoch);
    
    event SettledSuccess(address indexed user, uint32 indexed habitId, uint64 indexed epoch, uint256 reward);
    event SettledFail(address indexed user, uint32 indexed habitId, uint64 indexed epoch, uint256 slashed);
    
    // Modifiers
    modifier onlyHabitOwner(uint32 habitId) {
        require(habits[msg.sender][habitId].owner == msg.sender, "Not habit owner");
        _;
    }
    
    // Constructor
    constructor(address _treasury) {
        require(_treasury != address(0), "Invalid treasury");
        treasury = _treasury;
    }
    
    // Helper: Get current epoch (civil day)
    function epochNow() public view returns (uint64) {
        return uint64(block.timestamp / SECONDS_PER_DAY);
    }
    
    // [IMPLEMENTATION CONTINUES BELOW...]
}
```

#### Key Functions to Implement

**Balance Management** (~50 lines each):
```solidity
function deposit() external payable
function withdraw(uint256 amount) external
function claim(uint256 amount) external
function redepositFromClaimable(uint256 amount) external
function getUserState(address user) external view returns (UserState memory)
```

**Habit Management** (~30 lines each):
```solidity
function createHabit(string calldata text) external returns (uint32)
function archiveHabit(uint32 habitId) external
function getHabit(address user, uint32 habitId) external view returns (Habit memory)
function getAllHabits(address user) external view returns (Habit[] memory)
```

**Daily Cycle** (~80 lines each):
```solidity
function prepareDay(uint64 epoch) external
function checkIn(uint32 habitId, uint64 epoch) external
function settle(address user, uint64 epoch, uint32 habitId) external
function settleAll(address user, uint64 epoch, uint32 maxCount) external
function getDailyStatus(address user, uint64 epoch, uint32 habitId) external view returns (DailyStatus memory)
```

---

### 1.3 Critical Implementation Details

#### Balance Blocking Mechanism
```solidity
function prepareDay(uint64 epoch) external {
    UserState storage state = userStates[msg.sender];
    require(epoch == epochNow(), "Can only prepare current day");
    
    uint32 fundedCount = 0;
    uint32 insufficientCount = 0;
    
    // Loop through all habits
    for (uint32 i = 1; i <= userHabitCounters[msg.sender]; i++) {
        Habit storage habit = habits[msg.sender][i];
        
        // Skip archived or non-existent habits
        if (habit.archived || habit.owner == address(0)) continue;
        
        DailyStatus storage status = dailyStatuses[msg.sender][epoch][i];
        
        // Skip already prepared habits
        if (status.funded) continue;
        
        // Check if sufficient balance
        if (state.depositBalance >= STAKE_PER_DAY) {
            state.depositBalance -= STAKE_PER_DAY;
            state.blockedBalance += STAKE_PER_DAY;
            status.funded = true;
            fundedCount++;
        } else {
            status.funded = false;
            insufficientCount++;
        }
    }
    
    emit DayPrepared(msg.sender, epoch, fundedCount, insufficientCount);
}
```

#### Settlement Logic (Success vs Failure)
```solidity
function settle(address user, uint64 epoch, uint32 habitId) public {
    require(epoch < epochNow(), "Cannot settle current day");
    
    Habit storage habit = habits[user][habitId];
    require(habit.owner != address(0), "Habit does not exist");
    
    DailyStatus storage status = dailyStatuses[user][epoch][habitId];
    require(status.funded, "Day was not funded");
    require(!status.settled, "Already settled");
    
    UserState storage state = userStates[user];
    
    status.settled = true;
    
    if (status.checked) {
        // SUCCESS: Move from blocked -> claimable
        state.blockedBalance -= STAKE_PER_DAY;
        state.claimableBalance += STAKE_PER_DAY;
        emit SettledSuccess(user, habitId, epoch, STAKE_PER_DAY);
    } else {
        // FAILURE: Transfer to treasury
        state.blockedBalance -= STAKE_PER_DAY;
        totalTreasuryReceived += STAKE_PER_DAY;
        
        (bool success, ) = treasury.call{value: STAKE_PER_DAY}("");
        require(success, "Treasury transfer failed");
        
        emit SettledFail(user, habitId, epoch, STAKE_PER_DAY);
    }
}
```

#### Gas-Optimized Batch Settlement
```solidity
function settleAll(address user, uint64 epoch, uint32 maxCount) external {
    require(epoch < epochNow(), "Cannot settle current day");
    require(maxCount > 0 && maxCount <= 50, "Invalid maxCount"); // Prevent gas exhaustion
    
    uint32 settled = 0;
    
    for (uint32 i = 1; i <= userHabitCounters[user] && settled < maxCount; i++) {
        Habit storage habit = habits[user][i];
        if (habit.owner == address(0) || habit.archived) continue;
        
        DailyStatus storage status = dailyStatuses[user][epoch][i];
        if (status.funded && !status.settled) {
            settle(user, epoch, i); // Reuse single settlement logic
            settled++;
        }
    }
}
```

---

### 1.4 Contract Size Optimization

**Critical**: Polkadot Asset Hub has ~100KB bytecode limit.

**Strategies**:
1. **Avoid OpenZeppelin**: Custom minimal implementations
2. **String optimization**: Use `string` instead of `felt252` (natural for Solidity)
3. **Remove debugging code**: No `console.log` imports in production
4. **Optimize loops**: Use `unchecked` for counters where safe
5. **External functions**: Prefer `external` over `public` where possible

**Size Check**:
```bash
npx hardhat compile
# Check artifacts/contracts/HabitTracker.sol/HabitTracker.json
# Look for "bytecode" field length (should be < 100KB)
```

---

### 1.5 Deployment Scripts

**File**: `/contracts/ignition/modules/HabitTracker.ts`

```typescript
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const HabitTrackerModule = buildModule("HabitTrackerModule", (m) => {
  // Treasury address (use your own wallet or create dedicated treasury)
  const treasury = m.getParameter(
    "treasury",
    "0xYourTreasuryAddressHere" // REPLACE THIS
  );

  const habitTracker = m.contract("HabitTracker", [treasury]);

  return { habitTracker };
});

export default HabitTrackerModule;
```

**Deploy Command**:
```bash
npx hardhat ignition deploy ./ignition/modules/HabitTracker.ts --network passetHubTestnet
```

---

### 1.6 Testing Strategy

**File**: `/contracts/test/HabitTracker.ts`

**Test Scenarios** (15-20 tests):
```typescript
describe("HabitTracker", function () {
  // Setup
  describe("Deployment", function () {
    it("Should set the correct treasury");
    it("Should initialize with zero balances");
  });
  
  // Balance management
  describe("Deposits & Withdrawals", function () {
    it("Should deposit PAS correctly");
    it("Should withdraw available balance");
    it("Should prevent withdrawing blocked funds");
    it("Should claim rewards after settlement");
    it("Should redeposit from claimable");
  });
  
  // Habit lifecycle
  describe("Habit Management", function () {
    it("Should create habit with auto-incrementing ID");
    it("Should archive habit and decrement counter");
    it("Should prevent archiving non-owned habits");
    it("Should retrieve all user habits");
  });
  
  // Daily cycle
  describe("Daily Cycle", function () {
    it("Should prepare day and block funds");
    it("Should handle insufficient balance during prepare");
    it("Should allow check-in during current day");
    it("Should prevent check-in for past days");
    it("Should prevent check-in without funding");
    it("Should settle successful day (checked)");
    it("Should settle failed day (not checked)");
    it("Should transfer slashed funds to treasury");
    it("Should batch settle multiple habits");
  });
  
  // Edge cases
  describe("Edge Cases", function () {
    it("Should handle epoch boundary correctly");
    it("Should prevent double settlement");
    it("Should handle archived habits in prepare/settle");
  });
});
```

**Run Tests**:
```bash
cd contracts
npx hardhat test
npx hardhat test test/HabitTracker.ts --network hardhat
```

---

## 🎨 Phase 2: Frontend Integration (Week 3-4)

### 2.1 Contract Integration Setup

**File**: `/frontend/src/generated.ts`

After deploying, run:
```bash
# This will update generated.ts with deployed contract addresses and ABIs
npx hardhat ignition deploy ./ignition/modules/HabitTracker.ts --network passetHubTestnet
```

Manually add to `generated.ts` if needed:
```typescript
export const habitTrackerModuleHabitTrackerAddress = {
  420420422: "0xYourDeployedContractAddress", // Paseo Asset Hub
} as const;

export const habitTrackerAbi = [
  // ABI from artifacts/contracts/HabitTracker.sol/HabitTracker.json
] as const;
```

---

### 2.2 Custom Hook for Contract Interactions

**File**: `/frontend/src/hooks/useHabitTracker.ts`

```typescript
import { useAccount, useReadContract, useWriteContract, useWatchContractEvent } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { habitTrackerModuleHabitTrackerAddress, habitTrackerAbi } from '../generated';
import { passetHub } from '../wagmi-config';
import { useState, useEffect } from 'react';

export interface UserState {
  depositBalance: bigint;
  blockedBalance: bigint;
  claimableBalance: bigint;
  activeHabitCount: number;
}

export interface Habit {
  id: number;
  owner: string;
  text: string;
  createdAtEpoch: bigint;
  archived: boolean;
}

export interface DailyStatus {
  funded: boolean;
  checked: boolean;
  settled: boolean;
}

export const useHabitTracker = () => {
  const { address, isConnected } = useAccount();
  const [refetchTrigger, setRefetchTrigger] = useState(0);
  
  const contractAddress = habitTrackerModuleHabitTrackerAddress[
    passetHub.id as keyof typeof habitTrackerModuleHabitTrackerAddress
  ];

  // Read contract data
  const { data: userState, refetch: refetchUserState } = useReadContract({
    address: contractAddress,
    abi: habitTrackerAbi,
    functionName: 'getUserState',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && isConnected,
      refetchInterval: 10000, // Poll every 10s
    },
  });

  const { data: currentEpoch } = useReadContract({
    address: contractAddress,
    abi: habitTrackerAbi,
    functionName: 'epochNow',
    query: {
      refetchInterval: 60000, // Poll every minute
    },
  });

  const { data: allHabits, refetch: refetchHabits } = useReadContract({
    address: contractAddress,
    abi: habitTrackerAbi,
    functionName: 'getAllHabits',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && isConnected,
    },
  });

  // Write contract functions
  const { writeContractAsync, isPending } = useWriteContract();

  // Helper to refetch all data
  const refetchAll = async () => {
    await Promise.all([
      refetchUserState(),
      refetchHabits(),
    ]);
    setRefetchTrigger((prev) => prev + 1);
  };

  // Write functions with automatic refetch
  const deposit = async (amountInPAS: string) => {
    if (!contractAddress) throw new Error('Contract not deployed');
    
    const hash = await writeContractAsync({
      address: contractAddress,
      abi: habitTrackerAbi,
      functionName: 'deposit',
      value: parseEther(amountInPAS),
    });
    
    await refetchAll();
    return hash;
  };

  const withdraw = async (amountInPAS: string) => {
    if (!contractAddress) throw new Error('Contract not deployed');
    
    const hash = await writeContractAsync({
      address: contractAddress,
      abi: habitTrackerAbi,
      functionName: 'withdraw',
      args: [parseEther(amountInPAS)],
    });
    
    await refetchAll();
    return hash;
  };

  const claim = async (amountInPAS: string) => {
    if (!contractAddress) throw new Error('Contract not deployed');
    
    const hash = await writeContractAsync({
      address: contractAddress,
      abi: habitTrackerAbi,
      functionName: 'claim',
      args: [parseEther(amountInPAS)],
    });
    
    await refetchAll();
    return hash;
  };

  const createHabit = async (text: string) => {
    if (!contractAddress) throw new Error('Contract not deployed');
    
    const hash = await writeContractAsync({
      address: contractAddress,
      abi: habitTrackerAbi,
      functionName: 'createHabit',
      args: [text],
    });
    
    await refetchAll();
    return hash;
  };

  const archiveHabit = async (habitId: number) => {
    if (!contractAddress) throw new Error('Contract not deployed');
    
    const hash = await writeContractAsync({
      address: contractAddress,
      abi: habitTrackerAbi,
      functionName: 'archiveHabit',
      args: [habitId],
    });
    
    await refetchAll();
    return hash;
  };

  const prepareDay = async (epoch: bigint) => {
    if (!contractAddress) throw new Error('Contract not deployed');
    
    const hash = await writeContractAsync({
      address: contractAddress,
      abi: habitTrackerAbi,
      functionName: 'prepareDay',
      args: [epoch],
    });
    
    await refetchAll();
    return hash;
  };

  const checkIn = async (habitId: number, epoch: bigint) => {
    if (!contractAddress) throw new Error('Contract not deployed');
    
    const hash = await writeContractAsync({
      address: contractAddress,
      abi: habitTrackerAbi,
      functionName: 'checkIn',
      args: [habitId, epoch],
    });
    
    await refetchAll();
    return hash;
  };

  const settleAll = async (epoch: bigint, maxCount: number = 50) => {
    if (!contractAddress || !address) throw new Error('Not connected');
    
    const hash = await writeContractAsync({
      address: contractAddress,
      abi: habitTrackerAbi,
      functionName: 'settleAll',
      args: [address, epoch, maxCount],
    });
    
    await refetchAll();
    return hash;
  };

  const getDailyStatus = async (epoch: bigint, habitId: number): Promise<DailyStatus | null> => {
    if (!contractAddress || !address) return null;
    
    const status = await readContract({
      address: contractAddress,
      abi: habitTrackerAbi,
      functionName: 'getDailyStatus',
      args: [address, epoch, habitId],
    });
    
    return status as DailyStatus;
  };

  // Listen to events
  useWatchContractEvent({
    address: contractAddress,
    abi: habitTrackerAbi,
    eventName: 'CheckedIn',
    onLogs: () => {
      refetchAll();
    },
  });

  return {
    // State
    userState: userState as UserState | undefined,
    allHabits: allHabits as Habit[] | undefined,
    currentEpoch,
    contractAddress,
    isPending,
    refetchTrigger,
    
    // Actions
    deposit,
    withdraw,
    claim,
    createHabit,
    archiveHabit,
    prepareDay,
    checkIn,
    settleAll,
    getDailyStatus,
    refetchAll,
  };
};
```

---

### 2.3 Component Structure

**File Structure**:
```
frontend/src/
├── components/
│   ├── HabitTracker/
│   │   ├── BalanceSummary.tsx      # Show deposit/blocked/claimable
│   │   ├── DailyCyclePanel.tsx     # Timer + Prepare/Settle buttons
│   │   ├── WalletActions.tsx       # Deposit/Withdraw/Claim forms
│   │   ├── HabitList.tsx           # List all habits
│   │   ├── HabitCard.tsx           # Individual habit with check-in
│   │   ├── CreateHabitForm.tsx     # New habit input
│   │   └── index.ts                # Export all components
│   └── [existing components...]
├── hooks/
│   └── useHabitTracker.ts          # Contract interaction hook
├── utils/
│   ├── time.ts                     # Epoch calculations
│   └── formatters.ts               # Balance formatting
└── pages/
    └── HabitTrackerPage.tsx        # Main page
```

---

### 2.4 Key Components Implementation

#### BalanceSummary.tsx
```typescript
import { formatEther } from 'viem';
import { useHabitTracker } from '../../hooks/useHabitTracker';

export const BalanceSummary = () => {
  const { userState } = useHabitTracker();

  if (!userState) return <div>Loading balances...</div>;

  return (
    <div className="balance-summary">
      <div className="balance-card">
        <h3>💰 Deposit Balance</h3>
        <p>{formatEther(userState.depositBalance)} PAS</p>
        <span>Available for staking</span>
      </div>
      
      <div className="balance-card">
        <h3>🔒 Blocked Balance</h3>
        <p>{formatEther(userState.blockedBalance)} PAS</p>
        <span>Locked for today</span>
      </div>
      
      <div className="balance-card">
        <h3>🏆 Claimable Balance</h3>
        <p>{formatEther(userState.claimableBalance)} PAS</p>
        <span>Ready to withdraw</span>
      </div>
      
      <div className="balance-card">
        <h3>📊 Active Habits</h3>
        <p>{userState.activeHabitCount}</p>
        <span>Currently tracking</span>
      </div>
    </div>
  );
};
```

#### DailyCyclePanel.tsx
```typescript
import { useState, useEffect } from 'react';
import { useHabitTracker } from '../../hooks/useHabitTracker';
import { getTimeUntilMidnightUTC } from '../../utils/time';

export const DailyCyclePanel = () => {
  const { currentEpoch, prepareDay, settleAll, isPending } = useHabitTracker();
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(getTimeUntilMidnightUTC());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handlePrepareDay = async () => {
    if (!currentEpoch) return;
    try {
      await prepareDay(currentEpoch);
      alert('Day prepared successfully!');
    } catch (error) {
      console.error(error);
      alert('Failed to prepare day');
    }
  };

  const handleSettleYesterday = async () => {
    if (!currentEpoch) return;
    const yesterday = currentEpoch - 1n;
    try {
      await settleAll(yesterday, 50);
      alert('Yesterday settled successfully!');
    } catch (error) {
      console.error(error);
      alert('Failed to settle yesterday');
    }
  };

  return (
    <div className="daily-cycle-panel">
      <h2>⏰ Daily Cycle</h2>
      
      <div className="timer">
        <p>Time until UTC midnight:</p>
        <h3>{timeLeft}</h3>
      </div>
      
      <div className="actions">
        <button 
          onClick={handlePrepareDay} 
          disabled={isPending}
          className="btn-primary"
        >
          {isPending ? 'Preparing...' : '🚀 Prepare Today'}
        </button>
        
        <button 
          onClick={handleSettleYesterday} 
          disabled={isPending}
          className="btn-secondary"
        >
          {isPending ? 'Settling...' : '✅ Settle Yesterday'}
        </button>
      </div>
      
      <div className="info">
        <p>Current Epoch: {currentEpoch?.toString()}</p>
        <p className="help-text">
          Prepare: Lock funds for today's habits<br/>
          Settle: Process yesterday's results
        </p>
      </div>
    </div>
  );
};
```

#### HabitCard.tsx
```typescript
import { useState, useEffect } from 'react';
import { useHabitTracker } from '../../hooks/useHabitTracker';
import type { Habit } from '../../hooks/useHabitTracker';

interface HabitCardProps {
  habit: Habit;
}

export const HabitCard = ({ habit }: HabitCardProps) => {
  const { currentEpoch, checkIn, archiveHabit, getDailyStatus, isPending } = useHabitTracker();
  const [todayStatus, setTodayStatus] = useState<any>(null);
  const [yesterdayStatus, setYesterdayStatus] = useState<any>(null);

  useEffect(() => {
    const loadStatuses = async () => {
      if (!currentEpoch) return;
      
      const today = await getDailyStatus(currentEpoch, habit.id);
      const yesterday = await getDailyStatus(currentEpoch - 1n, habit.id);
      
      setTodayStatus(today);
      setYesterdayStatus(yesterday);
    };
    
    loadStatuses();
  }, [currentEpoch, habit.id]);

  const handleCheckIn = async () => {
    if (!currentEpoch) return;
    try {
      await checkIn(habit.id, currentEpoch);
      alert('Checked in successfully! ✅');
    } catch (error) {
      console.error(error);
      alert('Failed to check in');
    }
  };

  const handleArchive = async () => {
    if (!confirm(`Archive habit "${habit.text}"?`)) return;
    try {
      await archiveHabit(habit.id);
      alert('Habit archived');
    } catch (error) {
      console.error(error);
      alert('Failed to archive habit');
    }
  };

  return (
    <div className="habit-card">
      <div className="habit-header">
        <h3>{habit.text}</h3>
        <button onClick={handleArchive} className="btn-archive">🗑️</button>
      </div>
      
      <div className="habit-status">
        <div className="status-section">
          <h4>Today</h4>
          {todayStatus?.funded ? (
            <div>
              {todayStatus.checked ? (
                <span className="badge-success">✅ Checked In</span>
              ) : (
                <button 
                  onClick={handleCheckIn} 
                  disabled={isPending || !todayStatus?.funded}
                  className="btn-checkin"
                >
                  📝 Check In
                </button>
              )}
            </div>
          ) : (
            <span className="badge-warning">⚠️ Not Funded</span>
          )}
        </div>
        
        <div className="status-section">
          <h4>Yesterday</h4>
          {yesterdayStatus?.settled ? (
            yesterdayStatus.checked ? (
              <span className="badge-success">🏆 Won 10 PAS</span>
            ) : (
              <span className="badge-error">💸 Lost 10 PAS</span>
            )
          ) : yesterdayStatus?.funded ? (
            <span className="badge-pending">⏳ Needs Settlement</span>
          ) : (
            <span className="badge-neutral">➖ Not Active</span>
          )}
        </div>
      </div>
      
      <div className="habit-meta">
        <p>ID: {habit.id} • Created: Day {habit.createdAtEpoch.toString()}</p>
      </div>
    </div>
  );
};
```

#### CreateHabitForm.tsx
```typescript
import { useState } from 'react';
import { useHabitTracker } from '../../hooks/useHabitTracker';

export const CreateHabitForm = () => {
  const [habitText, setHabitText] = useState('');
  const { createHabit, isPending } = useHabitTracker();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (habitText.length < 3 || habitText.length > 100) {
      alert('Habit must be 3-100 characters');
      return;
    }
    
    try {
      await createHabit(habitText);
      setHabitText('');
      alert('Habit created successfully! 🎉');
    } catch (error) {
      console.error(error);
      alert('Failed to create habit');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="create-habit-form">
      <h3>➕ Create New Habit</h3>
      <div className="form-group">
        <input
          type="text"
          value={habitText}
          onChange={(e) => setHabitText(e.target.value)}
          placeholder="e.g., Exercise 30 minutes"
          maxLength={100}
          disabled={isPending}
          className="input-text"
        />
        <button type="submit" disabled={isPending || !habitText} className="btn-primary">
          {isPending ? 'Creating...' : 'Create Habit'}
        </button>
      </div>
      <p className="help-text">Costs 10 PAS per day to track</p>
    </form>
  );
};
```

---

### 2.5 Main Page Integration

**File**: `/frontend/src/pages/HabitTrackerPage.tsx`

```typescript
import { useAccount } from 'wagmi';
import { useHabitTracker } from '../hooks/useHabitTracker';
import { BalanceSummary } from '../components/HabitTracker/BalanceSummary';
import { DailyCyclePanel } from '../components/HabitTracker/DailyCyclePanel';
import { WalletActions } from '../components/HabitTracker/WalletActions';
import { CreateHabitForm } from '../components/HabitTracker/CreateHabitForm';
import { HabitList } from '../components/HabitTracker/HabitList';

export const HabitTrackerPage = () => {
  const { isConnected } = useAccount();
  const { contractAddress, allHabits } = useHabitTracker();

  if (!isConnected) {
    return (
      <div className="connect-prompt">
        <h1>🔗 Connect Wallet to Start</h1>
        <p>Use Web3Auth to login with your social accounts</p>
      </div>
    );
  }

  if (!contractAddress) {
    return (
      <div className="error-message">
        <h1>❌ Contract Not Deployed</h1>
        <p>Deploy HabitTracker contract to Paseo Asset Hub first</p>
      </div>
    );
  }

  return (
    <div className="habit-tracker-page">
      <header>
        <h1>⛓️ HabitChain</h1>
        <p>Build better habits with blockchain accountability</p>
      </header>

      <section className="summary-section">
        <BalanceSummary />
      </section>

      <section className="cycle-section">
        <DailyCyclePanel />
      </section>

      <section className="wallet-section">
        <WalletActions />
      </section>

      <section className="habits-section">
        <CreateHabitForm />
        <HabitList habits={allHabits || []} />
      </section>

      <footer>
        <a 
          href={`https://blockscout-passet-hub.parity-testnet.parity.io/address/${contractAddress}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          View Contract on Explorer →
        </a>
      </footer>
    </div>
  );
};
```

**Update App.tsx**:
```typescript
// Add route to HabitTrackerPage
import { HabitTrackerPage } from './pages/HabitTrackerPage';

// In your router or component tree:
{isConnected ? <HabitTrackerPage /> : unloggedInView}
```

---

### 2.6 Utility Functions

**File**: `/frontend/src/utils/time.ts`

```typescript
/**
 * Get current epoch (civil day since Unix epoch)
 */
export const getCurrentEpoch = (): bigint => {
  return BigInt(Math.floor(Date.now() / 1000 / 86400));
};

/**
 * Get time remaining until UTC midnight
 */
export const getTimeUntilMidnightUTC = (): string => {
  const now = new Date();
  const midnight = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0, 0, 0
  ));
  
  const diff = midnight.getTime() - now.getTime();
  
  const hours = Math.floor(diff / 1000 / 60 / 60);
  const minutes = Math.floor((diff / 1000 / 60) % 60);
  const seconds = Math.floor((diff / 1000) % 60);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

/**
 * Convert epoch to readable date
 */
export const epochToDate = (epoch: bigint): string => {
  const timestamp = Number(epoch) * 86400 * 1000;
  return new Date(timestamp).toLocaleDateString();
};
```

---

## 🎯 Phase 3: Testing & Deployment (Week 5-6)

### 3.1 Local Testing Flow

```bash
# Terminal 1: Start local Hardhat node
cd contracts
npx hardhat node

# Terminal 2: Deploy contracts locally
npx hardhat ignition deploy ./ignition/modules/HabitTracker.ts --network localhost

# Terminal 3: Start frontend
cd frontend
npm run dev
```

**Test Scenarios**:
1. Connect wallet via Web3Auth
2. Deposit 100 PAS
3. Create 3 habits
4. Prepare day (should lock 30 PAS)
5. Check in to 2 habits
6. Wait until next day (or manipulate time in Hardhat)
7. Settle yesterday
8. Verify 2 habits won (20 PAS claimable), 1 habit lost (10 PAS to treasury)
9. Claim rewards
10. Archive 1 habit

---

### 3.2 Testnet Deployment Checklist

**Pre-deployment**:
- [ ] Contract compiles without errors
- [ ] Contract size < 100KB
- [ ] All tests pass (15+ tests)
- [ ] Treasury address configured
- [ ] PRIVATE_KEY set in `.env`
- [ ] PAS tokens in deployer wallet (get from faucet)

**Deploy Contract**:
```bash
cd contracts

# Get testnet PAS tokens
# Visit: https://faucet.polkadot.io/?parachain=1111&address=YOUR_ADDRESS

# Set private key
echo "PRIVATE_KEY=your_private_key_without_0x" > .env

# Deploy
npx hardhat ignition deploy ./ignition/modules/HabitTracker.ts --network passetHubTestnet

# Save deployed address (shown in output)
```

**Update Frontend**:
```bash
cd frontend

# Update src/generated.ts with deployed address
# Replace placeholder with actual address from deployment output

# Test connection
npm run dev
# Visit http://localhost:5173
```

**Verify Contract**:
- Visit Blockscout: https://blockscout-passet-hub.parity-testnet.parity.io
- Search for your contract address
- Verify ABI matches

---

### 3.3 User Acceptance Testing (UAT)

**Test Users**: 3-5 people (not developers)

**Test Script**:
1. **Onboarding**
   - Visit dApp URL
   - Login with Web3Auth (Google/Twitter)
   - Get testnet PAS from faucet
   - Deposit 50 PAS

2. **Create Habits**
   - Create habit: "Drink 8 glasses of water"
   - Create habit: "Read 30 minutes"
   - Verify habits appear in list

3. **Daily Flow (Day 1)**
   - Click "Prepare Today"
   - Check deposit decreased by 20 PAS
   - Check blocked increased by 20 PAS
   - Check in to "Drink water" habit (success)
   - Don't check in to "Read" habit (failure)
   - Wait for next day

4. **Settlement (Day 2)**
   - Click "Settle Yesterday"
   - Verify "Drink water" shows "Won 10 PAS"
   - Verify "Read" shows "Lost 10 PAS"
   - Check claimable balance = 10 PAS

5. **Claim Rewards**
   - Enter 10 PAS in claim form
   - Submit transaction
   - Verify wallet balance increased

**Feedback Collection**:
- What was confusing?
- Did transactions succeed?
- Was the timer accurate?
- Any bugs or errors?

---

### 3.4 Production Deployment (Future)

**When ready for mainnet**:

1. **Deploy to Polkadot Asset Hub Mainnet**
   - Change network in `hardhat.config.ts`:
   ```typescript
   polkadotAssetHub: {
     polkavm: true,
     url: "https://polkadot-asset-hub-eth-rpc.polkadot.io", // Mainnet RPC
     accounts: [process.env.MAINNET_PRIVATE_KEY],
   }
   ```

2. **Security Audit** (Recommended)
   - Review by Polkadot security firms
   - Bug bounty program
   - Test with small amounts first

3. **Frontend Deployment**
   - Deploy to Vercel/Netlify
   - Configure custom domain
   - Set up analytics (Plausible, Mixpanel)

---

## 📊 Key Differences from Original (Starknet)

| Aspect | Starknet (Original) | Polkadot Asset Hub (This Project) |
|--------|---------------------|-----------------------------------|
| **Smart Contract Language** | Cairo 2.0 | Solidity 0.8.28 |
| **String Handling** | `felt252` (31 chars) | `string` (unlimited) |
| **Token Transfer** | `IERC20Dispatcher` | Native `payable` + `call` |
| **Epoch Calculation** | `get_block_timestamp() / 86400` | `block.timestamp / 86400` |
| **Storage** | `Map<(user, id), Habit>` | `mapping(address => mapping(uint => Habit))` |
| **Events** | `#[event]` decorator | `event` keyword + `emit` |
| **Testing** | `scarb test` | `npx hardhat test` |
| **Frontend Library** | `starknet-react` | `wagmi` |
| **Wallet** | ArgentX, Braavos | Web3Auth (social login) |
| **Network** | Starknet Sepolia | Paseo Asset Hub TestNet |

---

## 🚀 Implementation Timeline

### Week 1: Contract Core
- Day 1-2: Implement data structures + balance functions
- Day 3-4: Implement habit management functions
- Day 5-7: Implement daily cycle functions (prepare/check/settle)

### Week 2: Contract Testing
- Day 1-3: Write 15+ comprehensive tests
- Day 4-5: Test locally and optimize gas
- Day 6-7: Deploy to testnet and verify

### Week 3: Frontend Setup
- Day 1-2: Create `useHabitTracker` hook
- Day 3-4: Build `BalanceSummary` + `DailyCyclePanel`
- Day 5-7: Build habit components (`HabitCard`, `CreateHabitForm`, `HabitList`)

### Week 4: Frontend Integration
- Day 1-2: Build `WalletActions` component
- Day 3-4: Assemble `HabitTrackerPage`
- Day 5-7: Styling + responsiveness

### Week 5: Testing
- Day 1-3: Local integration testing
- Day 4-5: Testnet testing with real PAS
- Day 6-7: UAT with test users

### Week 6: Polish & Launch
- Day 1-2: Fix bugs from UAT
- Day 3-4: Write user documentation
- Day 5: Deploy frontend to production
- Day 6-7: Marketing + community launch

---

## 🔐 Security Considerations

### Smart Contract
1. **Reentrancy**: All external calls happen last (after state changes)
2. **Integer Overflow**: Solidity 0.8.28 has built-in overflow checks
3. **Access Control**: Functions validate ownership via modifiers
4. **Denial of Service**: `settleAll` has `maxCount` limit (50)
5. **Time Manipulation**: Uses `block.timestamp` (miner-resistant on L2)

### Frontend
1. **Private Key Exposure**: Web3Auth handles key management
2. **XSS Protection**: React escapes user input by default
3. **Input Validation**: Validate habit text length (3-100 chars)
4. **Transaction Signing**: User explicitly approves via wallet

### Testing Requirements
- [ ] Test with insufficient balance
- [ ] Test epoch boundary conditions
- [ ] Test archived habit edge cases
- [ ] Test double settlement prevention
- [ ] Test batch settlement gas limits

---

## 📈 Future Enhancements (Post-MVP)

### Smart Contract Features
1. **Reward Multipliers**: Increase rewards for consecutive days (streaks)
2. **Social Features**: Share habits publicly, follow friends
3. **NFT Achievements**: Mint NFTs for milestones (100 days, etc.)
4. **Variable Staking**: Let users choose stake amount per habit
5. **Community Challenges**: Group habits with shared treasury pool

### Frontend Features
1. **Analytics Dashboard**: Charts for success rate, streaks, earnings
2. **Habit Categories**: Filter by fitness, productivity, learning, etc.
3. **Dark Mode**: Theme toggle
4. **Mobile App**: React Native version
5. **Notifications**: Push notifications for check-in reminders
6. **Calendar View**: Visual history of past check-ins

### Infrastructure
1. **Subgraph**: Index events for faster queries (The Graph)
2. **Backend API**: Cache frequently accessed data
3. **IPFS Storage**: Store long-form habit descriptions
4. **Multi-chain**: Deploy to other Polkadot parachains

---

## 🛠️ Troubleshooting Guide

### Contract Deployment Issues

**Error**: "initcode is too big"
- **Cause**: Contract exceeds 100KB bytecode limit
- **Solution**: Remove unused functions, optimize storage, avoid OpenZeppelin

**Error**: "CodeRejected"
- **Cause**: Missing `polkavm: true` in network config
- **Solution**: Ensure `hardhat.config.ts` has correct network settings

**Error**: "Insufficient funds"
- **Cause**: Not enough PAS for gas
- **Solution**: Get PAS from faucet: https://faucet.polkadot.io/?parachain=1111

### Frontend Issues

**Error**: "Contract not found"
- **Cause**: Wrong contract address in `generated.ts`
- **Solution**: Update address from deployment output

**Error**: "User rejected transaction"
- **Cause**: User cancelled wallet signature
- **Solution**: Retry transaction

**Error**: "Execution reverted"
- **Cause**: Contract requirement failed (e.g., insufficient balance)
- **Solution**: Check error message, verify preconditions

### Web3Auth Issues

**Error**: "Provider not ready"
- **Cause**: Web3Auth not initialized
- **Solution**: Wait for `providerReady` state, check `web3AuthContextConfig`

**Error**: "Chain not supported"
- **Cause**: Paseo Asset Hub not configured
- **Solution**: Verify `wagmi-config.ts` has correct chain ID (420420422)

---

## 📚 Resources & References

### Documentation
- **Polkadot Asset Hub**: https://wiki.polkadot.network/docs/build-protocol-info
- **Hardhat**: https://hardhat.org/hardhat-runner/docs/getting-started
- **wagmi**: https://wagmi.sh/react/getting-started
- **Web3Auth**: https://web3auth.io/docs/

### Tools
- **Paseo Faucet**: https://faucet.polkadot.io/?parachain=1111
- **Blockscout Explorer**: https://blockscout-passet-hub.parity-testnet.parity.io
- **Remix IDE**: https://remix.polkadot.io

### Community
- **Polkadot Discord**: https://discord.gg/polkadot
- **Substrate StackExchange**: https://substrate.stackexchange.com

---

## ✅ Success Criteria

### MVP Launch Checklist
- [ ] Contract deployed to Paseo Asset Hub TestNet
- [ ] Contract verified on Blockscout
- [ ] 15+ passing tests
- [ ] Frontend deployed (Vercel/Netlify)
- [ ] 5+ test users successfully completed daily cycle
- [ ] Documentation published (README, user guide)
- [ ] Zero critical bugs in UAT

### Key Metrics (First Month)
- **Target**: 50+ active users
- **Target**: 200+ habits created
- **Target**: 70%+ daily check-in rate
- **Target**: 1000+ PAS staked
- **Target**: 50+ consecutive days of operation

---

## 🎉 Conclusion

This blueprint provides a complete roadmap to implement the Habit Tracker dApp on Polkadot Asset Hub using your existing tech stack. The core innovation—time-locked staking for habit accountability—translates seamlessly from Starknet to EVM-compatible chains.

**Key Advantages of Polkadot Implementation**:
1. **Lower Gas Fees**: Asset Hub has cheaper transactions than Ethereum L1
2. **Social Login**: Web3Auth reduces onboarding friction
3. **Fast Finality**: Polkadot's block time (~6s) enables responsive UX
4. **Cross-chain Ready**: Easy to expand to other parachains via XCM

**Next Steps**:
1. Review this blueprint with your team
2. Set up development environment (already done!)
3. Start with Phase 1 (Smart Contract) Week 1 tasks
4. Schedule daily standups to track progress
5. Launch MVP in 6 weeks! 🚀

---

**Questions or Need Help?**
- Check `AGENTS.md` for Polkadot-specific guidelines
- Visit Polkadot Discord for technical support
- Review existing `MyToken.sol` as reference for Solidity patterns

**Good luck building HabitChain!** ⛓️✨

