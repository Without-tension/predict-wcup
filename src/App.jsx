import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Auth from './Auth';
import MatchCard from './MatchCard';
import SkeletonCard from './SkeletonCard';

export default function App() {
  const [session, setSession] = useState(null);
  const [matches, setMatches] = useState([]);
  const [predictions, setPredictions] = useState({});
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  // Стейт для перегляду чужого профілю
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedUserPreds, setSelectedUserPreds] = useState({});
  const [loadingUserPreds, setLoadingUserPreds] = useState(false);

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
      const { data: matchesData } = await supabase
        .from('matches')
        .select('*')
        .order('start_time', { ascending: true });
      setMatches(matchesData || []);

      const { data: predsData } = await supabase
        .from('predictions')
        .select('match_id, user_choice')
        .eq('user_id', session.user.id);

      const predsMap = {};
      predsData?.forEach(p => { predsMap[p.match_id] = p.user_choice; });
      setPredictions(predsMap);

      const { data: leaderData } = await supabase
        .from('leaderboard')
        .select('*')
        .order('total_points', { ascending: false })
        .order('total_odds', { ascending: false });
      setLeaderboard(leaderData || []);

    } catch (error) {
      console.error("Помилка даних:", error.message);
    }
    setLoading(false);
  };

  // Функція для завантаження прогнозів вибраного гравця з таблиці лідерів
  const handleUserClick = async (player) => {
    setSelectedUser(player);
    setLoadingUserPreds(true);
    try {
      const { data: userPreds } = await supabase
        .from('predictions')
        .select('match_id, user_choice')
        .eq('user_id', player.user_id);
      
      const map = {};
      userPreds?.forEach(p => { map[p.match_id] = p.user_choice; });
      setSelectedUserPreds(map);
    } catch (e) {
      console.error(e);
    }
    setLoadingUserPreds(false);
  };

  const handlePredict = async (matchId, choice) => {
    const match = matches.find(m => m.id === matchId);
    if (!match || match.status === 'finished' || new Date() >= new Date(match.start_time)) {
      alert("Матч уже розпочався або завершився!");
      return;
    }
    try {
      const { error } = await supabase
        .from('predictions')
        .upsert({ user_id: session.user.id, match_id: matchId, user_choice: choice }, { onConflict: 'user_id,match_id' });
      if (error) throw error;
      setPredictions(prev => ({ ...prev, [matchId]: choice }));
      fetchData();
    } catch (error) {
      alert(error.message);
    }
  };

  if (!session) return <Auth />;

  // Фільтрація матчів на дві категорії
  const brazilMatches = matches.filter(m => 
    m.home_team?.includes('Ponte Preta') || m.away_team?.includes('Ponte Preta') ||
    m.home_team?.includes('Operario') || m.away_team?.includes('Operario') ||
    m.home_team?.includes('Coritiba') || m.away_team?.includes('Coritiba') ||
    m.home_team?.includes('Santos') || m.away_team?.includes('Santos') ||
    m.home_team?.includes('Botafogo') || m.away_team?.includes('Botafogo') ||
    m.home_team?.includes('Chapecoense') || m.away_team?.includes('Chapecoense') ||
    m.home_team?.includes('Ceara') || m.away_team?.includes('Ceara') ||
    m.home_team?.includes('Sport Recife') || m.away_team?.includes('Sport Recife') ||
    m.home_team?.includes('Mirassol') || m.away_team?.includes('Mirassol') ||
    m.home_team?.includes('Vila Nova') || m.away_team?.includes('Vila Nova') ||
    m.home_team?.includes('Novorizontino') || m.away_team?.includes('Novorizontino') ||
    m.home_team?.includes('CRB') || m.away_team?.includes('CRB') ||
    m.home_team?.includes('Paysandu') || m.away_team?.includes('Paysandu') ||
    m.home_team?.includes('Guarani') || m.away_team?.includes('Guarani') ||
    m.home_team?.includes('Brusque') || m.away_team?.includes('Brusque') ||
    m.home_team?.includes('Ituano') || m.away_team?.includes('Ituano') ||
    m.home_team?.includes('Goias') || m.away_team?.includes('Goias') ||
    m.home_team?.includes('Amazonas') || m.away_team?.includes('Amazonas') ||
    m.home_team?.includes('America MG') || m.away_team?.includes('America MG') ||
    m.home_team?.includes('Avai') || m.away_team?.includes('Avai')
  );
  const worldCupMatches = matches.filter(m => !brazilMatches.includes(m));

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans antialiased">
      <header className="flex justify-between items-center border-b border-gray-900 bg-gray-900/40 backdrop-blur px-6 py-4 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🏆</span>
          <h1 className="text-xl font-black text-green-400 tracking-wider uppercase">PredictWCup</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400 bg-gray-900 px-3 py-1.5 rounded-xl border border-gray-800">
            {session.user.email}
          </span>
          <button onClick={() => supabase.auth.signOut()} className="rounded-xl bg-red-600/10 text-red-400 border border-red-500/20 px-4 py-2 text-sm font-semibold hover:bg-red-600 hover:text-white transition-all cursor-pointer">
            Вийти
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* БЛОК МАТЧІВ */}
        <div className="lg:col-span-2 space-y-10">
          {loading ? (
            <div className="space-y-1">
              {/* Рендеримо скелетони завантаження */}
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : matches.length === 0 ? (
            <div className="text-center text-gray-500 py-12 border border-dashed border-gray-800 rounded-2xl bg-gray-900/20">
              📌 Немає активних матчів в базі даних.
            </div>
          ) : (
            <>
              {worldCupMatches.length > 0 && (
                <div>
                  <h2 className="text-xl font-black mb-4 tracking-tight text-gray-100 border-l-4 border-green-500 pl-3">
                    Матчі Чемпіонату Світу
                  </h2>
                  <div className="space-y-1">
                    {worldCupMatches.map((match) => (
                      <MatchCard key={match.id} match={match} userPrediction={predictions[match.id]} onMakePrediction={handlePredict} />
                    ))}
                  </div>
                </div>
              )}

              {brazilMatches.length > 0 && (
                <div>
                  <h2 className="text-xl font-black mb-4 tracking-tight text-gray-100 border-l-4 border-yellow-500 pl-3 mt-4">
                    Бразилія • Серія Б (Тестова ліга)
                  </h2>
                  <div className="space-y-1">
                    {brazilMatches.map((match) => (
                      <MatchCard key={match.id} match={match} userPrediction={predictions[match.id]} onMakePrediction={handlePredict} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ТАБЛИЦЯ ЛІДЕРІВ */}
        <div>
          <h2 className="text-xl font-black mb-6 tracking-tight text-gray-100">Таблиця лідерів</h2>
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
                  onClick={() => handleUserClick(player)}
                  className={`grid grid-cols-12 items-center text-sm p-2 rounded-xl transition-all text-center cursor-pointer hover:bg-gray-800/60 hover:scale-[1.02]
                    ${player.user_id === session.user.id ? 'bg-green-500/5 border border-green-500/20' : ''}`}
                >
                  <div className="col-span-5 flex items-center gap-1.5 truncate text-left">
                    <span className="text-xs font-bold text-gray-500 w-4">{index + 1}.</span>
                    <span className="truncate font-semibold text-gray-300">
                      {player.user_email.split('@')[0]}
                    </span>
                  </div>
                  <span className="col-span-3 text-gray-400 font-semibold">{player.total_predictions}</span>
                  <span className="col-span-2 text-green-400 font-bold">{player.total_points}</span>
                  <span className="col-span-2 text-yellow-500 font-bold">{Number(player.total_odds).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* 🔮 WEB3 МОДАЛЬНЕ ВІКНО ПЕРЕГЛЯДУ ЧУЖИХ ПРОГНОЗІВ */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl p-6 relative">
            
            <button 
              onClick={() => setSelectedUser(null)}
              className="absolute top-4 right-4 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer"
            >
              ✕
            </button>

            <div className="mb-6">
              <p className="text-xs font-bold text-green-400 uppercase tracking-widest">Профіль гравця</p>
              <h3 className="text-2xl font-black text-white mt-1">
                {selectedUser.user_email.split('@')[0]}
              </h3>
              <div className="flex gap-4 mt-3 text-sm text-gray-400 bg-gray-950/60 p-3 rounded-xl border border-gray-850">
                <div>Вгадано: <span className="text-white font-bold">{selectedUser.total_predictions}</span></div>
                <div>Бали: <span className="text-green-400 font-bold">{selectedUser.total_points}</span></div>
                <div>Сума кефів: <span className="text-yellow-500 font-bold">{Number(selectedUser.total_odds).toFixed(2)}</span></div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-bold text-gray-400 border-b border-gray-800 pb-2">Поточні та минулі прогнози:</h4>
              
              {loadingUserPreds ? (
                <div className="space-y-2">
                  <SkeletonCard />
                  <SkeletonCard />
                </div>
              ) : matches.length === 0 ? (
                <p className="text-gray-500 text-sm">Немає матчів для перегляду.</p>
              ) : (
                <div className="max-h-[50vh] overflow-y-auto pr-1 space-y-1">
                  {matches.map((match) => {
                    const pred = selectedUserPreds[match.id];
                    // Рендеримо тільки ті матчі, де цей юзер зробив ставку
                    if (!pred) return null;

                    return (
                      <MatchCard 
                        key={match.id}
                        match={match}
                        userPrediction={pred}
                        isReadOnly={true} // Передаємо маркер readOnly
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}