import { HabitCard } from './HabitCard';
import { type Habit } from '../../hooks/useHabitTracker';
import './HabitTracker.css';

interface HabitListProps {
  habits: Habit[];
}

export const HabitList = ({ habits }: HabitListProps) => {
  if (!habits || habits.length === 0) {
    return (
      <div className="habit-list empty">
        <div className="empty-state">
          <h3>📝 No Habits Yet</h3>
          <p>Create your first habit above to get started!</p>
        </div>
      </div>
    );
  }

  const activeHabits = habits.filter(h => !h.archived);
  const archivedHabits = habits.filter(h => h.archived);

  return (
    <div className="habit-list">
      {activeHabits.length > 0 && (
        <div className="habits-section">
          <h3 className="section-title">Active Habits ({activeHabits.length})</h3>
          <div className="habits-grid">
            {activeHabits.map((habit) => (
              <HabitCard key={`${habit.owner}-${habit.id}`} habit={habit} />
            ))}
          </div>
        </div>
      )}

      {archivedHabits.length > 0 && (
        <details className="archived-section">
          <summary className="section-title">
            Archived Habits ({archivedHabits.length})
          </summary>
          <div className="habits-grid">
            {archivedHabits.map((habit) => (
              <HabitCard key={`${habit.owner}-${habit.id}`} habit={habit} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
};

