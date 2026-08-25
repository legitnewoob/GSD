import { TopicTracker } from './TopicTracker';

export function LearningCategoryPage({ category, title, icon: Icon, description, onBack }) {
  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-game-gold tracking-wide text-glow flex items-center gap-2">
            <Icon className="w-7 h-7" /> {title.toUpperCase()}
          </h1>
          <p className="text-game-dim text-sm">{description}</p>
        </div>
        <button onClick={onBack} className="text-xs text-game-dim hover:text-game-text border border-slate-700 hover:border-slate-500 px-3 py-2 rounded-lg transition">
          ← Back to Learning
        </button>
      </div>

      <TopicTracker category={category} />
    </div>
  );
}
