import { useState, useEffect } from 'react';
import { useHabitTracker } from '../../hooks/useHabitTracker';
import { getTimeUntilMidnightUTC } from '../../utils/time';
import './HabitTracker.css';

export const DailyCyclePanel = () => {
  const { currentEpoch, prepareDay, settleAll, isPending } = useHabitTracker();
  const [timeLeft, setTimeLeft] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(getTimeUntilMidnightUTC());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handlePrepareDay = async () => {
    if (!currentEpoch) {
      setMessage('❌ Unable to get current epoch');
      return;
    }
    
    try {
      setMessage('⏳ Preparing day...');
      await prepareDay(currentEpoch);
      setMessage('✅ Day prepared successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error: any) {
      console.error(error);
      setMessage(`❌ Failed to prepare day: ${error.message || 'Unknown error'}`);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  const handleSettleYesterday = async () => {
    if (!currentEpoch) {
      setMessage('❌ Unable to get current epoch');
      return;
    }
    
    const yesterday = currentEpoch - 1n;
    
    try {
      setMessage('⏳ Settling yesterday...');
      await settleAll(yesterday, 50);
      setMessage('✅ Yesterday settled successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error: any) {
      console.error(error);
      setMessage(`❌ Failed to settle: ${error.message || 'Unknown error'}`);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  return (
    <div className="daily-cycle-panel">
      <h2>⏰ Daily Cycle</h2>

      <div className="timer-section">
        <p className="timer-label">Time until UTC midnight:</p>
        <h3 className="timer-display">{timeLeft}</h3>
      </div>

      <div className="cycle-actions">
        <button
          onClick={handlePrepareDay}
          disabled={isPending || !currentEpoch}
          className="btn-primary"
        >
          {isPending ? '⏳ Processing...' : '🚀 Prepare Today'}
        </button>

        <button
          onClick={handleSettleYesterday}
          disabled={isPending || !currentEpoch}
          className="btn-secondary"
        >
          {isPending ? '⏳ Processing...' : '✅ Settle Yesterday'}
        </button>
      </div>

      {message && (
        <div className={`message ${message.includes('✅') ? 'success' : 'error'}`}>
          {message}
        </div>
      )}

      <div className="cycle-info">
        <p className="epoch-info">
          <strong>Current Epoch:</strong> {currentEpoch?.toString() || 'Loading...'}
        </p>
        <div className="help-text">
          <p><strong>Prepare:</strong> Lock funds for today's habits (10 PAS each)</p>
          <p><strong>Settle:</strong> Process yesterday's results and distribute rewards</p>
        </div>
      </div>
    </div>
  );
};

