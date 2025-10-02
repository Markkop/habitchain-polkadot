import { useAccount } from 'wagmi';
import { useHabitTracker } from '../hooks/useHabitTracker';
import {
  BalanceSummary,
  DailyCyclePanel,
  WalletActions,
  CreateHabitForm,
  HabitList
} from '../components/HabitTracker';
import '../components/HabitTracker/HabitTracker.css';

export const HabitTrackerPage = () => {
  const { isConnected } = useAccount();
  const { contractAddress, isContractDeployed, allHabits } = useHabitTracker();

  if (!isConnected) {
    return (
      <div className="connect-prompt" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <h1>🔗 Connect Wallet to Start</h1>
        <p style={{ fontSize: '1.1rem', color: '#666', marginTop: '1rem' }}>
          Use Web3Auth to login with your social accounts and start building better habits!
        </p>
        <div style={{ marginTop: '2rem', padding: '1.5rem', background: '#f9f9f9', borderRadius: '8px', maxWidth: '600px', margin: '2rem auto' }}>
          <h3>How HabitChain Works:</h3>
          <ol style={{ textAlign: 'left', lineHeight: '1.8' }}>
            <li>🔐 <strong>Connect</strong> your wallet using social login</li>
            <li>💰 <strong>Deposit</strong> PAS tokens as your commitment stake</li>
            <li>📝 <strong>Create</strong> habits you want to build (10 PAS per habit per day)</li>
            <li>🚀 <strong>Prepare</strong> your day to lock funds for accountability</li>
            <li>✅ <strong>Check in</strong> daily before UTC midnight to win back your stake</li>
            <li>🏆 <strong>Settle</strong> yesterday to claim your rewards or lose to treasury</li>
          </ol>
        </div>
      </div>
    );
  }

  if (!isContractDeployed) {
    return (
      <div className="error-message" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <h1>❌ Contract Not Deployed</h1>
        <p style={{ fontSize: '1.1rem', color: '#666', marginTop: '1rem' }}>
          The HabitTracker contract needs to be deployed to Paseo Asset Hub first.
        </p>
        <div style={{ marginTop: '2rem', padding: '1.5rem', background: '#fff3cd', borderRadius: '8px', maxWidth: '600px', margin: '2rem auto' }}>
          <h3>Deployment Steps:</h3>
          <ol style={{ textAlign: 'left', lineHeight: '1.8' }}>
            <li>Navigate to the <code>/contracts</code> directory</li>
            <li>Set your private key: <code>echo "PRIVATE_KEY=your_key" &gt; .env</code></li>
            <li>Deploy: <code>npx hardhat ignition deploy ./ignition/modules/HabitTracker.ts --network passetHubTestnet</code></li>
            <li>Update <code>HABIT_TRACKER_ADDRESS</code> in <code>useHabitTracker.ts</code></li>
          </ol>
        </div>
      </div>
    );
  }

  return (
    <div className="habit-tracker-page" style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
      <header style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '3rem', margin: '0', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          ⛓️ HabitChain
        </h1>
        <p style={{ fontSize: '1.2rem', color: '#666', margin: '0.5rem 0' }}>
          Build better habits with blockchain accountability
        </p>
        <p style={{ fontSize: '0.9rem', color: '#999' }}>
          Stake PAS tokens, check in daily, earn rewards
        </p>
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

      <footer style={{ textAlign: 'center', marginTop: '3rem', paddingTop: '2rem', borderTop: '1px solid #e0e0e0' }}>
        <a
          href={`https://blockscout-passet-hub.parity-testnet.parity.io/address/${contractAddress}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#667eea', textDecoration: 'none', fontSize: '0.95rem' }}
        >
          📜 View Contract on Blockscout →
        </a>
        <p style={{ marginTop: '1rem', color: '#999', fontSize: '0.85rem' }}>
          Built on Polkadot Asset Hub • Powered by Web3Auth
        </p>
      </footer>
    </div>
  );
};

