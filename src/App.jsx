import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Auth from './Auth';
import MatchCard from './MatchCard';
import SkeletonCard from './SkeletonCard';
import { motion, AnimatePresence } from 'framer-motion';

export default function App() {
  const [session, setSession] = useState(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  // Стейти для admin-панелі
  const [adminTargetUser, setAdminTargetUser] = useState('');
  const [adminNewPassword, setAdminNewPassword] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);

  const [matches, setMatches] = useState(() => {
    const saved = localStorage.getItem('cache_matches');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [predictions, setPredictions] = useState(() => {
    const saved = localStorage.getItem('cache_predictions');
    return saved ? JSON.parse(saved) : {};
  });

  const [leaderboard, setLeaderboard] = useState(() => {
    const saved = localStorage.getItem('cache_leaderboard');
    return saved ? JSON.parse(saved) : [];
  });

  const [loading, setLoading] = useState(() => {
    const savedMatches = localStorage.getItem('cache_matches');
    return savedMatches ? false : true;
  });

  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedUserPreds, setSelectedUserPreds] = useState({});
  const [loadingUserPreds, setLoadingUserPreds] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsAuthChecking(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setIsAuthChecking(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      fetchData();
    }
  }, [session]);

  const fetchData = async () => {
    if (matches.length === 0) setLoading(true);
    try {
      const { data: matchesData } = await supabase
        .from('matches')
        .select('*')
        .order('start_time', { ascending: true });
      if (matchesData) {
        setMatches(matchesData);
        localStorage.setItem('cache_matches', JSON.stringify(matchesData));
      }

      const { data: predsData } = await supabase
        .from('predictions')
        .select('match_id, user_choice')
        .eq('user_id', session.user.id);

      const predsMap = {};
      predsData?.forEach(p => { predsMap[p.match_id] = p.user_choice; });
      setPredictions(predsMap);
      localStorage.setItem('cache_predictions', JSON.stringify(predsMap));

      const { data: leaderData } = await supabase
        .from('leaderboard')
        .select('*')
        .order('total_points', { ascending: false })
        .order('total_odds', { ascending: false });
      if (leaderData) {
        setLeaderboard(leaderData);
        localStorage.setItem('cache_leaderboard', JSON.stringify(leaderData));
      }

    } catch (error) {
      console.error("Помилка фонового оновлення даних:", error.message);
    }
    setLoading(false);
  };

  const handleAdminResetPassword = async (e) => {
    e.preventDefault();
    if (!adminTargetUser.trim() || !adminNewPassword.trim()) {
      alert("Заповни логін і новий пароль!");
      return;
    }
    if (adminNewPassword.length < 6) {
      alert("Пароль має бути не менше 6 символів!");
      return;
    }

    setAdminLoading(true);
    const targetEmail = `${adminTargetUser.trim().toLowerCase()}@predict.wcup`;

    try {
      const { error } = await supabase.rpc('admin_reset_password_by_email', {
        target_email: targetEmail,
        new_password: adminNewPassword
      });

      alert(`Спроба змінити пароль для ${adminTargetUser}. Якщо RPC активовано, пароль оновлено!`);
      setAdminTargetUser('');
      setAdminNewPassword('');
    } catch (err) {
      alert("Помилка: " + err.message);
    }
    setAdminLoading(false);
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

  const handlePredict = async (matchId, choice) => {
    const match = matches.find(m => m.id === matchId);
    if (!match || match.status === 'finished' || new Date() >= new Date(match.start_time)) {
      alert("Матч уже розпочався або завершився!");
      return;
    }

    const updatedPredictions = { ...predictions, [matchId]: choice };
    setPredictions(updatedPredictions);
    localStorage.setItem('cache_predictions', JSON.stringify(updatedPredictions));

    try {
      const { error } = await supabase
        .from('predictions')
        .upsert(
          { user_id: session.user.id, match_id: matchId, user_choice: choice }, 
          { onConflict: 'user_id,match_id' }
        );
      if (error) throw error;

      const { data: leaderData } = await supabase
        .from('leaderboard')
        .select('*')
        .order('total_points', { ascending: false })
        .order('total_odds', { ascending: false });
      if (leaderData) {
        setLeaderboard(leaderData);
        localStorage.setItem('cache_leaderboard', JSON.stringify(leaderData));
      }
    } catch (error) {
      alert("Помилка збереження прогнозу: " + error.message);
      fetchData();
    }
  };

  if (isAuthChecking) {
    return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400 text-sm font-semibold tracking-wider px-4 text-center">Завантаження контенту...</div>;
  }

  if (!session) return <Auth />;

  const isAdmin = session.user.email === 'ros@predict.wcup' || session.user.email.startsWith('admin');

  const unpredictedMatches = matches
    .filter(m => !predictions[m.id] && m.status !== 'finished')
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

  const predictedMatches = matches
    .filter(m => predictions[m.id] && m.status !== 'finished')
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

  const finishedMatches = matches
    .filter(m => m.status === 'finished')
    .sort((a, b) => new Date(b.start_time) - new Date(a.start_time));

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans antialiased flex flex-col justify-between selection:bg-green-500/30">
      <div>
        <header className="flex flex-col sm:flex-row justify-between items-center border-b border-gray-900 bg-gray-900/40 backdrop-blur px-4 sm:px-6 py-3.5 sticky top-0 z-50 gap-2 sm:gap-0">
          <div className="flex items-center gap-2">
            <span className="text-xl sm:text-2xl">🏆</span>
            <h1 className="text-lg sm:text-xl font-black text-green-400 tracking-wider uppercase">Predict World Cup</h1>
          </div>
          <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-3 sm:gap-4">
            <span className="text-xs sm:text-sm text-gray-400 bg-gray-900 px-3 py-1.5 rounded-xl border border-gray-800 font-semibold truncate max-w-[180px] sm:max-w-none">
              👤 {session.user.email.split('@')[0]}
            </span>
            <button onClick={() => {
              localStorage.clear();
              supabase.auth.signOut();
            }} className="rounded-xl bg-red-600/10 text-red-400 border border-red-500/20 px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold hover:bg-red-600 hover:text-white transition-all cursor-pointer active:scale-95">
              Вийти
            </button>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6 grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          
          {/* БЛОК МАТЧІВ — відстані зменшено через space-y-6 */}
          <div className="lg:col-span-2 space-y-6 sm:space-y-8 order-2 lg:order-1">
            {loading ? (
              <div className="space-y-2">
                <SkeletonCard /><SkeletonCard /><SkeletonCard />
              </div>
            ) : matches.length === 0 ? (
              <div className="text-center text-gray-500 py-10 px-4 border border-dashed border-gray-800 rounded-2xl bg-gray-900/20 text-sm">
                📌 Немає активних матчів.
              </div>
            ) : (
              <div className="space-y-6 sm:space-y-8">
                {/* ВЕРХНІЙ СПИСОК */}
                <div className="flex flex-col gap-2">
                  <AnimatePresence mode="popLayout">
                    {unpredictedMatches.map((match) => (
                      <motion.div
                        key={match.id}
                        layout="position"
                        initial={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.25 } }}
                        transition={{ type: "spring", stiffness: 350, damping: 32 }}
                        whileHover={{ scale: 1.01, y: -1 }}
                        className="w-full origin-center will-change-transform"
                      >
                        <MatchCard match={match} userPrediction={predictions[match.id]} onMakePrediction={handlePredict} />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {unpredictedMatches.length === 0 && (
                    <p className="text-xs text-gray-500 italic pl-4 py-1">🎉 Всі доступні прогнози заповнено!</p>
                  )}
                </div>

                {/* СЕРЕДНІЙ СПИСОК */}
                {predictedMatches.length > 0 && (
                  <div className="pt-4 border-t border-gray-900/60">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-green-400 border-l-4 border-green-500 pl-3 mb-3">
                      ✅ Прогнози зроблено ({predictedMatches.length})
                    </h2>
                    <div className="flex flex-col gap-2">
                      <AnimatePresence mode="popLayout">
                        {predictedMatches.map((match) => (
                          <motion.div
                            key={match.id}
                            layout="position"
                            initial={{ opacity: 0.8 }}
                            animate={{ opacity: 0.9 }}
                            whileHover={{ scale: 1.005, opacity: 1 }}
                            transition={{ type: "spring", stiffness: 350, damping: 32 }}
                            className="w-full origin-center will-change-transform"
                          >
                            <MatchCard match={match} userPrediction={predictions[match.id]} onMakePrediction={handlePredict} />
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </div>
                )}

                {/* НИЖНІЙ СПИСОК */}
                {finishedMatches.length > 0 && (
                  <div className="pt-4 border-t border-gray-900/60">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-red-400 border-l-4 border-red-500 pl-3 mb-3">
                      🏁 Завершені матчі ({finishedMatches.length})
                    </h2>
                    <div className="flex flex-col gap-2 opacity-60">
                      {finishedMatches.map((match) => (
                        <div key={match.id} className="w-full">
                          <MatchCard match={match} userPrediction={predictions[match.id]} onMakePrediction={handlePredict} isReadOnly={true} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ПРАВА КОЛОНКА (ТАБЛИЦЯ ЛІДЕРІВ) */}
          <div className="space-y-4 order-1 lg:order-2">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 shadow-xl overflow-hidden">
              <h2 className="text-base font-black mb-3 tracking-tight text-gray-100 flex items-center gap-2">
                <span>📊</span> Таблиця лідерів
              </h2>
              
              <div className="overflow-x-auto -mx-4 px-4 scrollbar-none">
                <div className="min-w-[280px] space-y-1.5">
                  <div className="grid grid-cols-12 text-[10px] font-bold text-gray-500 uppercase px-2 pb-1.5 border-b border-gray-800 text-center tracking-wider">
                    <span className="col-span-5 text-left">Гравець</span>
                    <span className="col-span-3">Матчів</span>
                    <span className="col-span-2">Бали</span>
                    <span className="col-span-2">Кф.</span>
                  </div>

                  {leaderboard.map((player, index) => (
                    <div 
                      key={player.user_id} 
                      onClick={() => handleUserClick(player)}
                      className={`grid grid-cols-12 items-center text-xs p-1.5 rounded-xl transition-all text-center cursor-pointer hover:bg-gray-800/60 hover:scale-[1.01] active:scale-98
                        ${player.user_id === session.user.id ? 'bg-green-500/5 border border-green-500/20' : 'border border-transparent'}`}
                    >
                      <div className="col-span-5 flex items-center gap-1 truncate text-left">
                        <span className="text-[10px] font-bold text-gray-500 w-4">{index + 1}.</span>
                        <span className="truncate font-semibold text-gray-300">{player.user_email.split('@')[0]}</span>
                      </div>
                      <span className="col-span-3 text-gray-400 font-semibold">{player.total_predictions}</span>
                      <span className="col-span-2 text-green-400 font-bold">{player.total_points}</span>
                      <span className="col-span-2 text-yellow-500 font-bold">{Number(player.total_odds).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* АДМІН-ПАНЕЛЬ */}
      {isAdmin && (
        <footer className="w-full max-w-6xl mx-auto px-3 sm:px-4 pb-4 sm:pb-6 mt-6 order-3">
          <div className="bg-gray-900 border border-red-900/20 rounded-2xl p-4 shadow-xl max-w-xl mx-auto">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-base">🛠️</span>
              <h3 className="text-xs font-black text-red-400 uppercase tracking-widest">Панель Адміністратора</h3>
            </div>
            <form onSubmit={handleAdminResetPassword} className="flex flex-col gap-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Логін (напр: ros)"
                  value={adminTargetUser}
                  onChange={(e) => setAdminTargetUser(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500 transition-colors"
                />
                <input
                  type="text"
                  placeholder="Новий пароль (мін. 6 знаків)"
                  value={adminNewPassword}
                  onChange={(e) => setAdminNewPassword(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500 transition-colors"
                />
              </div>
              <button type="submit" disabled={adminLoading} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded-xl text-xs transition-colors cursor-pointer active:scale-95">{adminLoading ? 'Оновлення...' : 'Змінити пароль'}</button>
            </form>
          </div>
        </footer>
      )}

      {/* МОДАЛКА ПЕРЕГЛЯДУ */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl p-4 relative">
            <button onClick={() => setSelectedUser(null)} className="absolute top-3 right-3 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer text-sm">✕</button>
            <div className="mb-4 flex-shrink-0">
              <p className="text-[10px] font-bold text-green-400 uppercase tracking-widest">Профіль гравця</p>
              <h3 className="text-xl font-black text-white mt-0.5">{selectedUser.user_email.split('@')[0]}</h3>
              <div className="grid grid-cols-3 gap-2 mt-2.5 text-center text-xs text-gray-400 bg-gray-950/60 p-2 rounded-xl border border-gray-850">
                <div>Матчів: <span className="text-white font-bold block">{selectedUser.total_predictions}</span></div>
                <div>Бали: <span className="text-green-400 font-bold block">{selectedUser.total_points}</span></div>
                <div>Сума кф: <span className="text-yellow-500 font-bold block">{Number(selectedUser.total_odds).toFixed(2)}</span></div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto pr-0.5 min-h-0">
              <h4 className="text-xs font-bold text-gray-400 border-b border-gray-800 pb-1.5 mb-2.5 sticky top-0 bg-gray-900 z-10">Прогнози гравця:</h4>
              <div className="space-y-2">
                {matches.map((match) => {
                  const pred = selectedUserPreds[match.id];
                  if (!pred) return null;
                  return <div key={match.id} className="w-full"><MatchCard match={match} userPrediction={pred} isReadOnly={true} /></div>;
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}