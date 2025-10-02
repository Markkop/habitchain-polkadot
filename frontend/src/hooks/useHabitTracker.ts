import { useAccount, useReadContract, useWriteContract, useWatchContractEvent } from 'wagmi';
import { parseEther } from 'viem';
import { useState, useEffect, useCallback } from 'react';

// You'll need to update this import after deploying the contract
// For now, we'll use a placeholder
const HABIT_TRACKER_ADDRESS = '0x0000000000000000000000000000000000000000'; // UPDATE AFTER DEPLOYMENT

// Minimal ABI - will be generated after deployment
const HABIT_TRACKER_ABI = [
  {
    "inputs": [{"internalType": "address", "name": "_treasury", "type": "address"}],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [],
    "name": "epochNow",
    "outputs": [{"internalType": "uint64", "name": "", "type": "uint64"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "address", "name": "user", "type": "address"}],
    "name": "getUserState",
    "outputs": [{
      "components": [
        {"internalType": "uint256", "name": "depositBalance", "type": "uint256"},
        {"internalType": "uint256", "name": "blockedBalance", "type": "uint256"},
        {"internalType": "uint256", "name": "claimableBalance", "type": "uint256"},
        {"internalType": "uint32", "name": "activeHabitCount", "type": "uint32"}
      ],
      "internalType": "struct HabitTracker.UserState",
      "name": "",
      "type": "tuple"
    }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "address", "name": "user", "type": "address"}],
    "name": "getAllHabits",
    "outputs": [{
      "components": [
        {"internalType": "uint32", "name": "id", "type": "uint32"},
        {"internalType": "address", "name": "owner", "type": "address"},
        {"internalType": "string", "name": "text", "type": "string"},
        {"internalType": "uint64", "name": "createdAtEpoch", "type": "uint64"},
        {"internalType": "bool", "name": "archived", "type": "bool"}
      ],
      "internalType": "struct HabitTracker.Habit[]",
      "name": "",
      "type": "tuple[]"
    }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "user", "type": "address"},
      {"internalType": "uint64", "name": "epoch", "type": "uint64"},
      {"internalType": "uint32", "name": "habitId", "type": "uint32"}
    ],
    "name": "getDailyStatus",
    "outputs": [{
      "components": [
        {"internalType": "bool", "name": "funded", "type": "bool"},
        {"internalType": "bool", "name": "checked", "type": "bool"},
        {"internalType": "bool", "name": "settled", "type": "bool"}
      ],
      "internalType": "struct HabitTracker.DailyStatus",
      "name": "",
      "type": "tuple"
    }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "deposit",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "amount", "type": "uint256"}],
    "name": "withdraw",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "amount", "type": "uint256"}],
    "name": "claim",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "string", "name": "text", "type": "string"}],
    "name": "createHabit",
    "outputs": [{"internalType": "uint32", "name": "", "type": "uint32"}],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint32", "name": "habitId", "type": "uint32"}],
    "name": "archiveHabit",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint64", "name": "epoch", "type": "uint64"}],
    "name": "prepareDay",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "uint32", "name": "habitId", "type": "uint32"},
      {"internalType": "uint64", "name": "epoch", "type": "uint64"}
    ],
    "name": "checkIn",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "user", "type": "address"},
      {"internalType": "uint64", "name": "epoch", "type": "uint64"},
      {"internalType": "uint32", "name": "maxCount", "type": "uint32"}
    ],
    "name": "settleAll",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;

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

  // Check if contract is deployed
  const contractAddress = HABIT_TRACKER_ADDRESS as `0x${string}`;
  const isContractDeployed = contractAddress !== '0x0000000000000000000000000000000000000000';

  // Read contract data
  const { data: userState, refetch: refetchUserState } = useReadContract({
    address: contractAddress,
    abi: HABIT_TRACKER_ABI,
    functionName: 'getUserState',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && isConnected && isContractDeployed,
      refetchInterval: 10000, // Poll every 10s
    },
  });

  const { data: currentEpoch, refetch: refetchEpoch } = useReadContract({
    address: contractAddress,
    abi: HABIT_TRACKER_ABI,
    functionName: 'epochNow',
    query: {
      enabled: isContractDeployed,
      refetchInterval: 60000, // Poll every minute
    },
  });

  const { data: allHabits, refetch: refetchHabits } = useReadContract({
    address: contractAddress,
    abi: HABIT_TRACKER_ABI,
    functionName: 'getAllHabits',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && isConnected && isContractDeployed,
    },
  });

  // Write contract functions
  const { writeContractAsync, isPending, error } = useWriteContract();

  // Helper to refetch all data
  const refetchAll = useCallback(async () => {
    await Promise.all([
      refetchUserState(),
      refetchHabits(),
      refetchEpoch(),
    ]);
    setRefetchTrigger((prev) => prev + 1);
  }, [refetchUserState, refetchHabits, refetchEpoch]);

  // Listen to events for automatic updates
  useWatchContractEvent({
    address: contractAddress,
    abi: HABIT_TRACKER_ABI,
    eventName: 'CheckedIn' as any,
    onLogs: () => {
      refetchAll();
    },
    enabled: isContractDeployed,
  });

  // Write functions with automatic refetch
  const deposit = async (amountInPAS: string) => {
    if (!isContractDeployed) throw new Error('Contract not deployed');

    const hash = await writeContractAsync({
      address: contractAddress,
      abi: HABIT_TRACKER_ABI,
      functionName: 'deposit',
      value: parseEther(amountInPAS),
    });

    await refetchAll();
    return hash;
  };

  const withdraw = async (amountInPAS: string) => {
    if (!isContractDeployed) throw new Error('Contract not deployed');

    const hash = await writeContractAsync({
      address: contractAddress,
      abi: HABIT_TRACKER_ABI,
      functionName: 'withdraw',
      args: [parseEther(amountInPAS)],
    });

    await refetchAll();
    return hash;
  };

  const claim = async (amountInPAS: string) => {
    if (!isContractDeployed) throw new Error('Contract not deployed');

    const hash = await writeContractAsync({
      address: contractAddress,
      abi: HABIT_TRACKER_ABI,
      functionName: 'claim',
      args: [parseEther(amountInPAS)],
    });

    await refetchAll();
    return hash;
  };

  const createHabit = async (text: string) => {
    if (!isContractDeployed) throw new Error('Contract not deployed');

    const hash = await writeContractAsync({
      address: contractAddress,
      abi: HABIT_TRACKER_ABI,
      functionName: 'createHabit',
      args: [text],
    });

    await refetchAll();
    return hash;
  };

  const archiveHabit = async (habitId: number) => {
    if (!isContractDeployed) throw new Error('Contract not deployed');

    const hash = await writeContractAsync({
      address: contractAddress,
      abi: HABIT_TRACKER_ABI,
      functionName: 'archiveHabit',
      args: [habitId],
    });

    await refetchAll();
    return hash;
  };

  const prepareDay = async (epoch: bigint) => {
    if (!isContractDeployed) throw new Error('Contract not deployed');

    const hash = await writeContractAsync({
      address: contractAddress,
      abi: HABIT_TRACKER_ABI,
      functionName: 'prepareDay',
      args: [epoch],
    });

    await refetchAll();
    return hash;
  };

  const checkIn = async (habitId: number, epoch: bigint) => {
    if (!isContractDeployed) throw new Error('Contract not deployed');

    const hash = await writeContractAsync({
      address: contractAddress,
      abi: HABIT_TRACKER_ABI,
      functionName: 'checkIn',
      args: [habitId, epoch],
    });

    await refetchAll();
    return hash;
  };

  const settleAll = async (epoch: bigint, maxCount: number = 50) => {
    if (!isContractDeployed || !address) throw new Error('Not connected');

    const hash = await writeContractAsync({
      address: contractAddress,
      abi: HABIT_TRACKER_ABI,
      functionName: 'settleAll',
      args: [address, epoch, maxCount],
    });

    await refetchAll();
    return hash;
  };

  const getDailyStatus = useCallback(async (epoch: bigint, habitId: number): Promise<DailyStatus | null> => {
    if (!isContractDeployed || !address) return null;

    try {
      const status = await readContract({
        address: contractAddress,
        abi: HABIT_TRACKER_ABI,
        functionName: 'getDailyStatus',
        args: [address, epoch, habitId],
      });

      return status as DailyStatus;
    } catch (error) {
      console.error('Error getting daily status:', error);
      return null;
    }
  }, [address, contractAddress, isContractDeployed]);

  return {
    // State
    userState: userState as UserState | undefined,
    allHabits: allHabits as Habit[] | undefined,
    currentEpoch,
    contractAddress,
    isContractDeployed,
    isPending,
    error,
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

// Helper function for reading contract (used by getDailyStatus)
async function readContract(config: any) {
  // This would use wagmi's readContract in production
  // For now, it's a placeholder
  throw new Error('readContract not implemented - use useReadContract hook instead');
}

