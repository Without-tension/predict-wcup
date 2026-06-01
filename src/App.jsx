import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Auth from './Auth';
import MatchCard from './MatchCard'; // Наш новий прокачаний компонент

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
      // 1. Завантажуємо матчі
      const { data: matchesData, error: matchesError } = await supabase
        .from('matches')
        .select('*')
        .order('start_time', { ascending: true });
      if (matchesError) throw matchesError;
      setMatches(matchesData || []);

      // 2. Завантажуємо прогнози поточного користувача
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

      // 3. Завантажуємо лідерборд
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
    
    // Блокування прогнозів, якщо матч розпочався або завершився
    if (!match || match.status === 'finished' || new Date() >= new Date(match.start_time)) {
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
      fetchData(); // Оновлюємо дані, щоб зафіксувати зміни
    } catch (error) {
      alert("Помилка: " + error.message);
    }
  };

  if (!session) return <Auth />;

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans antialiased">
      {/* Шапка сайту */}
      <header className="flex justify-between items-center border-b border-gray-900 bg-gray-900/40 backdrop-blur px-6 py-4 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🏆</span>
          <h1 className="text-xl font-black text-green-400 tracking-wider uppercase">PredictWCup</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400 bg-gray-900 px-3 py-1.5 rounded-xl border border-gray-800">
            {session.user.email}
          </span>
          <button 
            onClick={() => supabase.auth.signOut()}
            className="rounded-xl bg-red-600/10 text-red-400 border border-red-500/20 px-4 py-2 text-sm font-semibold hover:bg-red-600 hover:text-white transition-all cursor-pointer"
          >
            Вийти
          </button>
        </div>
      </header>

      {/* Головний контент */}
      <main className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Стрічка матчів */}
        <div className="lg:col-span-2">
          <h2 className="text-2xl font-black mb-6 tracking-tight text-gray-100">Матчі Чемпіонату Світу</h2>
          
          {loading ? (
            <div className="text-center text-gray-500 py-12 animate-pulse">Завантаження...</div>
          ) : matches.length === 0 ? (
            <div className="text-center text-gray-500 py-12 border border-dashed border-gray-800 rounded-2xl bg-gray-900/20">
              📌 Немає активних матчів.
            </div>
          ) : (
            <div className="space-y-1">
              {matches.map((match) => (
                <MatchCard 
                  key={match.id}
                  match={match}
                  userPrediction={predictions[match.id]} // Передаємо 'Home', 'Draw' або 'Away'
                  onMakePrediction={handlePredict}      // Функція обробки кліку
                />
              ))}
            </div>
          )}
        </div>

        {/* Таблиця лідерів */}
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