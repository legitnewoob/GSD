import { useState } from 'react';
import { GraduationCap, Swords, Code2, Network, Brain, ChevronRight } from 'lucide-react';
import { TopicTracker } from './learning/TopicTracker';
import { CodingProfiles } from './learning/CodingProfiles';
import { UpsolveBucket } from './learning/UpsolveBucket';
import { LearningCategoryPage } from './learning/LearningCategoryPage';

const panelBase = 'bg-game-panel rounded-2xl border border-game-border p-5 shadow-lg';

const CATEGORIES = [
  { key: 'cp', title: 'Competitive Programming', icon: Swords, description: 'Codeforces, LeetCode, AtCoder stats + topic tracker.' },
  { key: 'dev', title: 'Development', icon: Code2, description: 'Frontend, backend, infra topics.' },
  { key: 'system_design', title: 'System Design', icon: Network, description: 'Scalability, architecture, case studies.' },
  { key: 'ai_engineering', title: 'AI Engineering', icon: Brain, description: 'LLMs, RAG, agents, MLOps.' },
];

function CompetitiveProgrammingPage({ onBack }) {
  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-game-gold tracking-wide text-glow flex items-center gap-2">
            <Swords className="w-7 h-7" /> COMPETITIVE PROGRAMMING
          </h1>
          <p className="text-game-dim text-sm">Live platform stats + topic tracker.</p>
        </div>
        <button onClick={onBack} className="text-xs text-game-dim hover:text-game-text border border-slate-700 hover:border-slate-500 px-3 py-2 rounded-lg transition">
          ← Back to Learning
        </button>
      </div>

      <CodingProfiles />
      <UpsolveBucket />
      <TopicTracker category="cp" />
    </div>
  );
}

export function Learning() {
  const [activeCategory, setActiveCategory] = useState(null);

  if (activeCategory === 'cp') {
    return <CompetitiveProgrammingPage onBack={() => setActiveCategory(null)} />;
  }
  if (activeCategory) {
    const cat = CATEGORIES.find((c) => c.key === activeCategory);
    return (
      <LearningCategoryPage
        category={cat.key}
        title={cat.title}
        icon={cat.icon}
        description={cat.description}
        onBack={() => setActiveCategory(null)}
      />
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-game-gold tracking-wide text-glow flex items-center gap-2">
          <GraduationCap className="w-7 h-7" /> LEARNING
        </h1>
        <p className="text-game-dim text-sm">Pick a track to view its topic tracker.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          return (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={panelBase + ' flex items-center justify-between text-left hover:border-amber-500/50 hover:bg-slate-900/40 transition'}
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <Icon className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <div className="font-black text-game-text uppercase tracking-wide">{cat.title}</div>
                  <div className="text-xs text-game-dim">{cat.description}</div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-game-dim shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
