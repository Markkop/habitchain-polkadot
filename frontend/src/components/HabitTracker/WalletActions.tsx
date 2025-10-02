import { useState } from 'react';
import { useHabitTracker } from '../../hooks/useHabitTracker';
import { formatBalance } from '../../utils/formatters';
import './HabitTracker.css';

export const WalletActions = () => {
  const { userState, deposit, withdraw, claim, isPending } = useHabitTracker();
  
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [claimAmount, setClaimAmount] = useState('');
  const [message, setMessage] = useState('');

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      setMessage('❌ Please enter a valid amount');
      return;
    }

    try {
      setMessage('⏳ Depositing...');
      await deposit(depositAmount);
      setMessage('✅ Deposit successful!');
      setDepositAmount('');
      setTimeout(() => setMessage(''), 3000);
    } catch (error: any) {
      console.error(error);
      setMessage(`❌ Deposit failed: ${error.message || 'Unknown error'}`);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      setMessage('❌ Please enter a valid amount');
      return;
    }

    try {
      setMessage('⏳ Withdrawing...');
      await withdraw(withdrawAmount);
      setMessage('✅ Withdrawal successful!');
      setWithdrawAmount('');
      setTimeout(() => setMessage(''), 3000);
    } catch (error: any) {
      console.error(error);
      setMessage(`❌ Withdrawal failed: ${error.message || 'Unknown error'}`);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!claimAmount || parseFloat(claimAmount) <= 0) {
      setMessage('❌ Please enter a valid amount');
      return;
    }

    try {
      setMessage('⏳ Claiming...');
      await claim(claimAmount);
      setMessage('✅ Claim successful!');
      setClaimAmount('');
      setTimeout(() => setMessage(''), 3000);
    } catch (error: any) {
      console.error(error);
      setMessage(`❌ Claim failed: ${error.message || 'Unknown error'}`);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  return (
    <div className="wallet-actions">
      <h2>💳 Wallet Actions</h2>

      {message && (
        <div className={`message ${message.includes('✅') ? 'success' : 'error'}`}>
          {message}
        </div>
      )}

      <div className="actions-grid">
        <form onSubmit={handleDeposit} className="action-form">
          <h3>Deposit PAS</h3>
          <p className="form-help">Add funds to your staking balance</p>
          <div className="input-group">
            <input
              type="number"
              step="0.01"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              placeholder="Amount (PAS)"
              disabled={isPending}
              className="amount-input"
            />
            <button type="submit" disabled={isPending} className="btn-primary">
              {isPending ? 'Processing...' : 'Deposit'}
            </button>
          </div>
        </form>

        <form onSubmit={handleWithdraw} className="action-form">
          <h3>Withdraw PAS</h3>
          <p className="form-help">
            Available: {userState ? formatBalance(userState.depositBalance) : '0 PAS'}
          </p>
          <div className="input-group">
            <input
              type="number"
              step="0.01"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              placeholder="Amount (PAS)"
              disabled={isPending}
              className="amount-input"
            />
            <button type="submit" disabled={isPending} className="btn-secondary">
              {isPending ? 'Processing...' : 'Withdraw'}
            </button>
          </div>
        </form>

        <form onSubmit={handleClaim} className="action-form">
          <h3>Claim Rewards</h3>
          <p className="form-help">
            Claimable: {userState ? formatBalance(userState.claimableBalance) : '0 PAS'}
          </p>
          <div className="input-group">
            <input
              type="number"
              step="0.01"
              value={claimAmount}
              onChange={(e) => setClaimAmount(e.target.value)}
              placeholder="Amount (PAS)"
              disabled={isPending}
              className="amount-input"
            />
            <button type="submit" disabled={isPending} className="btn-success">
              {isPending ? 'Processing...' : 'Claim'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

