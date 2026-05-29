import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Auth from './Auth';

export default function App() {
  const [session, setSession] = useState(null);
  const [matches, setMatches] = useState([]);
  const [predictions, setPredictions] = useState({});
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      fetchData();
    }
  }, [session]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: matchesData, error: matchesError } = await supabase
        .from('matches')
        .select('*')
        .order('start_time', { ascending: true });
      if (matchesError) throw matchesError;
      setMatches(matchesData || []);

      const { data: predsData, error: predsError } = await supabase
        .from('predictions')
        .select('match_id, user_choice')
        .eq('user_id', session.user.id);
      if (predsError) throw predsError;

      const predsMap = {};
      predsData?.forEach(p => {
        predsMap[p.match_id] = p.user_choice;
      });
      setPredictions(predsMap);

      // Завантажуємо оновлений лідерборд (сортуємо спочатку за балами, потім за коефіцієнтами)
      const { data: leaderData, error: leaderError } = await supabase
        .from('leaderboard')
        .select('*')
        .order('total_points', { ascending: false })
        .order('total_odds', { ascending: false });
      if (leaderError) throw leaderError;
      setLeaderboard(leaderData || []);

    } catch (error) {
      console.error("Помилка даних:", error.message);
    }
    setLoading(false);
  };

  const handlePredict = async (matchId, choice) => {
    const match = matches.find(m => m.id === matchId);
    
    // ЗАЛІЗОБЕТОННЕ БЛОКУВАННЯ: за часом АБО якщо статус 'finished'
    if (match.status === 'finished' || new Date() >= new Date(match.start_time)) {
      alert("Матч уже розпочався або завершився! Змінити прогноз не можна.");
      return;
    }

    try {
      const { error } = await supabase
        .from('predictions')
        .upsert({
          user_id: session.user.id,
          match_id: matchId,
          user_choice: choice
        }, { onConflict: 'user_id,match_id' });

      if (error) throw error;
      setPredictions(prev => ({ ...prev, [matchId]: choice }));
      fetchData();
    } catch (error) {
      alert("Помилка: " + error.message);
    }
  };

  if (!session) return <Auth />;

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans antialiased">
      {/* Шапка */}
      <header className="flex justify-between items-center border-b border-gray-900 bg-gray-900/40 backdrop-blur px-6 py-4 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🏆</span>
          <h1 className="text-xl font-black text-green-400 tracking-wider uppercase">PredictWCup</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400 bg-gray-900 px-3 py-1.5 rounded-xl border border-gray-800">{session.user.email}</span>
          <button 
            onClick={() => supabase.auth.signOut()}
            className="rounded-xl bg-red-600/10 text-red-400 border border-red-500/20 px-4 py-2 text-sm font-semibold hover:bg-red-600 hover:text-white transition-all cursor-pointer"
          >
            Вийти
          </button>
        </div>
      </header>

      {/* Головна сітка */}
      <main className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* МАТЧІ */}
        <div className="lg:col-span-2">
          <h2 className="text-2xl font-black mb-6 tracking-tight text-gray-100">Матчі Чемпіонату Світу</h2>
          
          {loading ? (
            <div className="text-center text-gray-500 py-12 animate-pulse">Завантаження...</div>
          ) : matches.length === 0 ? (
            <div className="text-center text-gray-500 py-12 border border-dashed border-gray-800 rounded-2xl bg-gray-900/20">
              📌 Немає активних матчів.
            </div>
          ) : (
            <div className="space-y-4">
              {matches.map((match) => {
                // Перевіряємо чи заблоковано
                const isBlocked = match.status === 'finished' || new Date() >= new Date(match.start_time);
                const userChoice = predictions[match.id];

                return (
                  <div key={match.id} className="bg-gray-900 border border-gray-800/80 rounded-2xl p-5 shadow-xl">
                    <div className="flex justify-between items-center text-xs mb-4">
                      <span className="text-gray-400 font-medium bg-gray-800 px-2.5 py-1 rounded-lg">
                        {new Date(match.start_time).toLocaleString('uk-UA', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {isBlocked ? (
                        <span className="text-red-400 font-bold bg-red-500/10 px-2.5 py-1 rounded-lg border border-red-500/10">
                          🔒 {match.status === 'finished' ? `Завершено (${match.home_score}:${match.away_score})` : 'Заблоковано'}
                        </span>
                      ) : (
                        <span className="text-green-400 font-bold bg-green-500/10 px-2.5 py-1 rounded-lg border border-green-500/10 animate-pulse">⚽️ Прийом ставок</span>
                      )}
                    </div>

                    <div className="flex justify-between items-center text-lg font-black mb-5 px-1">
                      <span className="w-5/12 text-right truncate text-gray-200">{match.home_team}</span>
                      <span className="w-2/12 text-center text-gray-600 text-xs font-bold uppercase bg-gray-950 py-1 rounded-md border border-gray-800/40">vs</span>
                      <span className="w-5/12 text-left truncate text-gray-200">{match.away_team}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2.5">
                      {[
                        { key: '1', label: 'П1', odds: match.home_odds },
                        { key: 'X', label: 'Нічія', odds: match.draw_odds },
                        { key: '2', label: 'П2', odds: match.away_odds }
                      ].map((btn) => {
                        const isActive = userChoice === btn.key;
                        return (
                          <button
                            key={btn.key}
                            disabled={isBlocked} // Тепер заблоковано намертво, якщо матч завершено!
                            onClick={() => handlePredict(match.id, btn.key)}
                            className={`flex flex-col items-center justify-center py-3 rounded-xl border text-sm font-bold transition-all duration-200
                              ${isBlocked ? 'cursor-not-allowed' : 'cursor-pointer'}
                              ${isActive 
                                ? 'bg-green-600 border-green-500 text-white shadow-lg scale-[1.02]' 
                                : 'bg-gray-800/50 border-gray-800 hover:bg-gray-800 hover:border-gray-700 text-gray-300 disabled:opacity-40'
                              }`}
                          >
                            <span>{btn.label}</span>
                            <span className="text-xs mt-1 font-medium text-gray-400">{btn.odds || '—'}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ТАБЛИЦЯ ЛІДЕРІВ */}
        <div>
          <h2 className="text-2xl font-black mb-6 tracking-tight text-gray-100">Таблиця лідерів</h2>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 shadow-xl">
            <div className="space-y-2">
              <div className="grid grid-cols-12 text-xs font-bold text-gray-500 uppercase px-2 pb-2 border-b border-gray-800 text-center">
                <span className="col-span-5 text-left">Гравець</span>
                <span className="col-span-3">Вгадано</span>
                <span className="col-span-2">Бали</span>
                <span className="col-span-2">Коеф.</span>
              </div>

              {leaderboard.map((player, index) => (
                <div 
                  key={player.user_id} 
                  className={`grid grid-cols-12 items-center text-sm p-2 rounded-xl transition-colors text-center
                    ${player.user_id === session.user.id ? 'bg-green-500/10 border border-green-500/20' : 'hover:bg-gray-800/40'}`}
                >
                  <div className="col-span-5 flex items-center gap-1.5 truncate text-left">
                    <span className="text-xs font-bold text-gray-500 w-4">{index + 1}.</span>
                    <span className="truncate font-medium text-gray-300" title={player.user_email}>
                      {player.user_email.split('@')[0]}
                    </span>
                  </div>
                  <span className="col-span-3 text-gray-500 font-semibold">{player.total_predictions}</span>
                  <span className="col-span-2 text-green-400 font-bold">{player.total_points}</span>
                  <span className="col-span-2 text-yellow-500 font-bold">{Number(player.total_odds).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}