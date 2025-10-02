import { useState, useEffect } from 'react';
import { useHabitTracker, type Habit, type DailyStatus } from '../../hooks/useHabitTracker';
import { epochToDate } from '../../utils/time';
import { useReadContract } from 'wagmi';
import './HabitTracker.css';

interface HabitCardProps {
  habit: Habit;
}

export const HabitCard = ({ habit }: HabitCardProps) => {
  const { currentEpoch, checkIn, archiveHabit, isPending, contractAddress } = useHabitTracker();
  const [message, setMessage] = useState('');

  // Read today's status
  const { data: todayStatus } = useReadContract({
    address: contractAddress,
    abi: [{
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
    }],
    functionName: 'getDailyStatus',
    args: currentEpoch ? [habit.owner as `0x${string}`, currentEpoch, habit.id] : undefined,
    query: {
      enabled: !!currentEpoch && !!contractAddress,
      refetchInterval: 10000,
    }
  }) as { data: DailyStatus | undefined };

  // Read yesterday's status
  const { data: yesterdayStatus } = useReadContract({
    address: contractAddress,
    abi: [{
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
    }],
    functionName: 'getDailyStatus',
    args: currentEpoch && currentEpoch > 0n ? [habit.owner as `0x${string}`, currentEpoch - 1n, habit.id] : undefined,
    query: {
      enabled: !!currentEpoch && currentEpoch > 0n && !!contractAddress,
      refetchInterval: 10000,
    }
  }) as { data: DailyStatus | undefined };

  const handleCheckIn = async () => {
    if (!currentEpoch) {
      setMessage('❌ Unable to get current epoch');
      return;
    }

    try {
      setMessage('⏳ Checking in...');
      await checkIn(habit.id, currentEpoch);
      setMessage('✅ Checked in successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error: any) {
      console.error(error);
      setMessage(`❌ Check-in failed: ${error.message || 'Unknown error'}`);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  const handleArchive = async () => {
    if (!confirm(`Archive habit "${habit.text}"? This cannot be undone.`)) {
      return;
    }

    try {
      setMessage('⏳ Archiving...');
      await archiveHabit(habit.id);
      setMessage('✅ Habit archived');
      setTimeout(() => setMessage(''), 3000);
    } catch (error: any) {
      console.error(error);
      setMessage(`❌ Archive failed: ${error.message || 'Unknown error'}`);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  if (habit.archived) {
    return (
      <div className="habit-card archived">
        <div className="habit-header">
          <h3 className="habit-title">{habit.text}</h3>
          <span className="archived-badge">📦 Archived</span>
        </div>
        <div className="habit-meta">
          <p>Created: {epochToDate(habit.createdAtEpoch)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="habit-card active-habit">
      <div className="habit-header">
        <h3 className="habit-title">{habit.text}</h3>
        <button 
          onClick={handleArchive} 
          className="btn-archive"
          disabled={isPending}
          title="Archive habit"
        >
          🗑️
        </button>
      </div>

      {message && (
        <div className={`message small ${message.includes('✅') ? 'success' : 'error'}`}>
          {message}
        </div>
      )}

      <div className="habit-status">
        <div className="status-section today">
          <h4>📅 Today</h4>
          {todayStatus ? (
            todayStatus.funded ? (
              <div className="status-content">
                {todayStatus.checked ? (
                  <span className="badge success">✅ Checked In</span>
                ) : (
                  <button
                    onClick={handleCheckIn}
                    disabled={isPending}
                    className="btn-checkin"
                  >
                    📝 Check In
                  </button>
                )}
              </div>
            ) : (
              <span className="badge warning">⚠️ Not Funded</span>
            )
          ) : (
            <span className="badge neutral">➖ Not Prepared</span>
          )}
        </div>

        <div className="status-section yesterday">
          <h4>📆 Yesterday</h4>
          {yesterdayStatus ? (
            yesterdayStatus.funded ? (
              yesterdayStatus.settled ? (
                yesterdayStatus.checked ? (
                  <span className="badge success">🏆 Won 10 PAS</span>
                ) : (
                  <span className="badge error">💸 Lost 10 PAS</span>
                )
              ) : (
                <span className="badge pending">⏳ Needs Settlement</span>
              )
            ) : (
              <span className="badge neutral">➖ Not Active</span>
            )
          ) : (
            <span className="badge neutral">➖ No Data</span>
          )}
        </div>
      </div>

      <div className="habit-meta">
        <p>
          <strong>ID:</strong> #{habit.id} • 
          <strong> Created:</strong> {epochToDate(habit.createdAtEpoch)}
        </p>
      </div>
    </div>
  );
};

