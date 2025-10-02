import { useHabitTracker } from '../../hooks/useHabitTracker';
import { formatBalance } from '../../utils/formatters';
import './HabitTracker.css';

export const BalanceSummary = () => {
  const { userState } = useHabitTracker();

  if (!userState) {
    return (
      <div className="balance-summary">
        <div className="loading-state">Loading balances...</div>
      </div>
    );
  }

  return (
    <div className="balance-summary">
      <div className="balance-card deposit">
        <div className="balance-icon">💰</div>
        <div className="balance-content">
          <h3>Deposit Balance</h3>
          <p className="balance-amount">{formatBalance(userState.depositBalance)}</p>
          <span className="balance-description">Available for staking</span>
        </div>
      </div>

      <div className="balance-card blocked">
        <div className="balance-icon">🔒</div>
        <div className="balance-content">
          <h3>Blocked Balance</h3>
          <p className="balance-amount">{formatBalance(userState.blockedBalance)}</p>
          <span className="balance-description">Locked for today</span>
        </div>
      </div>

      <div className="balance-card claimable">
        <div className="balance-icon">🏆</div>
        <div className="balance-content">
          <h3>Claimable Balance</h3>
          <p className="balance-amount">{formatBalance(userState.claimableBalance)}</p>
          <span className="balance-description">Ready to withdraw</span>
        </div>
      </div>

      <div className="balance-card active">
        <div className="balance-icon">📊</div>
        <div className="balance-content">
          <h3>Active Habits</h3>
          <p className="balance-amount">{userState.activeHabitCount}</p>
          <span className="balance-description">Currently tracking</span>
        </div>
      </div>
    </div>
  );
};

