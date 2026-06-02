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

  // 🔥 ЗАЛІЗОБЕТОННЕ РІШЕННЯ БЕЗ ПЕРЕЗАВАНТАЖЕНЬ ТА МИГОТІННЯ
  const handlePredict = async (matchId, choice) => {
    const match = matches.find(m => m.id === matchId);
    if (!match || match.status === 'finished' || new Date() >= new Date(match.start_time)) {
      alert("Матч уже розпочався або завершився!");
      return;
    }

    // КРОК 1: Миттєво міняємо стейт у самому React.
    // Картка відразу почне плавно переміщатися вниз без жодних затримок
    setPredictions(prev => ({ ...prev, [matchId]: choice }));

    // КРОК 2: Тихо відправляємо дані в Supabase на фоні.
    // МИ БІЛЬШЕ НЕ ВИКЛИКАЄМО fetchData() І НЕВМИКАЄМО setLoading(true)!
    try {
      const { error } = await supabase
        .from('predictions')
        .upsert(
          { user_id: session.user.id, match_id: matchId, user_choice: choice }, 
          { onConflict: 'user_id,match_id' }
        );
      
      if (error) throw error;

      // КРОК 3: Оновлюємо лідерборд на фоні, якщо хтось паралельно набрав бали,
      // але робимо це абсолютно непомітно для інтерфейсу
      const { data: leaderData } = await supabase
        .from('leaderboard')
        .select('*')
        .order('total_points', { ascending: false })
        .order('total_odds', { ascending: false });
      if (leaderData) setLeaderboard(leaderData);

    } catch (error) {
      // Якщо на сервері щось впало — тільки тоді повертаємо старий стан картки назад
      alert("Помилка збереження прогнозу: " + error.message);
      setPredictions(prev => {
        const copy = { ...prev };
        delete copy[matchId];
        return copy;
      });
    }
  };

  if (!session) return <Auth />;

  const isBrazilLeague = (m) => {
    const text = (m.home_team + m.away_team).toLowerCase();
    return text.includes('ponte preta') || text.includes('operario') || text.includes('coritiba') || 
           text.includes('santos') || text.includes('botafogo') || text.includes('chapecoense') || 
           text.includes('ceara') || text.includes('sport recife') || text.includes('mirassol') || 
           text.includes('vila nova') || text.includes('novorizontino') || text.includes('crb') || 
           text.includes('paysandu') || text.includes('guarani') || text.includes('brusque') || 
           text.includes('ituano') || text.includes('goias') || text.includes('amazonas') || 
           text.includes('america mg') || text.includes('avai');
  };

  // Розподіл масивів (завжди відсортовані за часом start_time)
  const unpredictedMatches = matches
    .filter(m => !predictions[m.id])
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

  const predictedMatches = matches
    .filter(m => predictions[m.id])
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

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
        
        {/* БЛОК МАТЧІВ З АВТОМАТИЧНИМ ПЕРЕМІЩЕННЯМ */}
        <div className="lg:col-span-2 space-y-10">
          {loading ? (
            <div className="space-y-1">
              <SkeletonCard /><SkeletonCard /><SkeletonCard />
            </div>
          ) : matches.length === 0 ? (
            <div className="text-center text-gray-500 py-12 border border-dashed border-gray-800 rounded-2xl bg-gray-900/20">
              📌 Немає активних матчів.
            </div>
          ) : (
            <div className="space-y-10">
              
              {/* СЕКЦІЯ 1: ПОТРІБНО ЗРОБИТИ ПРОГНОЗ */}
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider mb-4 text-orange-400 border-l-4 border-orange-500 pl-3">
                  🔥 Потрібно зробити прогноз ({unpredictedMatches.length})
                </h2>
                <div className="space-y-1 transition-all duration-500 ease-in-out">
                  {unpredictedMatches.map((match) => (
                    <div 
                      key={match.id} 
                      className="transition-all duration-500 ease-in-out transform hover:translate-x-1 relative"
                    >
                      <div className="absolute left-6 mt-[18px] z-10 pointer-events-none">
                        <span className={`text-[9px] uppercase font-black px-1.5 py-0.5 rounded ${isBrazilLeague(match) ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/20'}`}>
                          {isBrazilLeague(match) ? 'Бразилія Б' : 'ЧС Світ'}
                        </span>
                      </div>
                      <MatchCard match={match} userPrediction={predictions[match.id]} onMakePrediction={handlePredict} />
                    </div>
                  ))}
                  {unpredictedMatches.length === 0 && (
                    <p className="text-sm text-gray-500 italic pl-4 py-4">🎉 Всі прогнози заповнено! Ти красень.</p>
                  )}
                </div>
              </div>

              {/* СЕКЦІЯ 2: ВЖЕ ПРОГНОЗОВАНІ МАТЧІ (ПЛАВНО СПУСКАЮТЬСЯ СЮДИ ЗА ЧАСОМ) */}
              {predictedMatches.length > 0 && (
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider mb-4 text-green-400 border-l-4 border-green-500 pl-3">
                    ✅ Прогнози зроблено ({predictedMatches.length})
                  </h2>
                  <div className="space-y-1 transition-all duration-500 ease-in-out">
                    {predictedMatches.map((match) => (
                      <div 
                        key={match.id} 
                        className="transition-all duration-500 ease-in-out opacity-85 transform relative"
                      >
                        <div className="absolute left-6 mt-[18px] z-10 pointer-events-none">
                          <span className={`text-[9px] uppercase font-black px-1.5 py-0.5 rounded ${isBrazilLeague(match) ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/20'}`}>
                            {isBrazilLeague(match) ? 'Бразилія Б' : 'ЧС Світ'}
                          </span>
                        </div>
                        <MatchCard match={match} userPrediction={predictions[match.id]} onMakePrediction={handlePredict} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
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

      {/* WEB3 МОДАЛЬНЕ ВІКНО ПЕРЕГЛЯДУ */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl p-6 relative">
            <button onClick={() => setSelectedUser(null)} className="absolute top-4 right-4 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer">✕</button>
            <div className="mb-6">
              <p className="text-xs font-bold text-green-400 uppercase tracking-widest">Профіль гравця</p>
              <h3 className="text-2xl font-black text-white mt-1">{selectedUser.user_email.split('@')[0]}</h3>
              <div className="flex gap-4 mt-3 text-sm text-gray-400 bg-gray-950/60 p-3 rounded-xl border border-gray-850">
                <div>Вгадано: <span className="text-white font-bold">{selectedUser.total_predictions}</span></div>
                <div>Бали: <span className="text-green-400 font-bold">{selectedUser.total_points}</span></div>
                <div>Сума кефів: <span className="text-yellow-500 font-bold">{Number(selectedUser.total_odds).toFixed(2)}</span></div>
              </div>
            </div>
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-gray-400 border-b border-gray-800 pb-2">Прогнози гравця:</h4>
              {loadingUserPreds ? (
                <div className="space-y-2"><SkeletonCard /><SkeletonCard /></div>
              ) : (
                <div className="max-h-[50vh] overflow-y-auto pr-1 space-y-1">
                  {matches.map((match) => {
                    const pred = selectedUserPreds[match.id];
                    if (!pred) return null;
                    return <MatchCard key={match.id} match={match} userPrediction={pred} isReadOnly={true} />;
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