import { useState } from 'react';
import { useHabitTracker } from '../../hooks/useHabitTracker';
import './HabitTracker.css';

export const CreateHabitForm = () => {
  const [habitText, setHabitText] = useState('');
  const { createHabit, isPending } = useHabitTracker();
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (habitText.length < 3) {
      setMessage('❌ Habit must be at least 3 characters');
      return;
    }

    if (habitText.length > 100) {
      setMessage('❌ Habit must be less than 100 characters');
      return;
    }

    try {
      setMessage('⏳ Creating habit...');
      await createHabit(habitText);
      setHabitText('');
      setMessage('✅ Habit created successfully! 🎉');
      setTimeout(() => setMessage(''), 3000);
    } catch (error: any) {
      console.error(error);
      setMessage(`❌ Failed to create habit: ${error.message || 'Unknown error'}`);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  return (
    <div className="create-habit-form">
      <h3>➕ Create New Habit</h3>
      
      {message && (
        <div className={`message ${message.includes('✅') ? 'success' : 'error'}`}>
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <input
            type="text"
            value={habitText}
            onChange={(e) => setHabitText(e.target.value)}
            placeholder="e.g., Exercise 30 minutes"
            maxLength={100}
            disabled={isPending}
            className="habit-input"
          />
          <div className="char-counter">
            {habitText.length}/100 characters
          </div>
        </div>
        
        <button 
          type="submit" 
          disabled={isPending || !habitText.trim()} 
          className="btn-primary"
        >
          {isPending ? '⏳ Creating...' : '➕ Create Habit'}
        </button>
      </form>
      
      <p className="help-text">
        💡 Each habit costs <strong>10 PAS per day</strong> to track
      </p>
    </div>
  );
};

