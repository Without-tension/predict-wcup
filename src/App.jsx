import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Auth from './Auth';
import MatchCard from './MatchCard';
import SkeletonCard from './SkeletonCard';
import { motion, AnimatePresence } from 'framer-motion';

export default function App() {
  const [session, setSession] = useState(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [currentTab, setCurrentTab] = useState('matches');

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

  // ⏱️ СЕКУНДОМІР: Стейт для зберігання часу синхронізації бота
  const [lastSyncTime, setLastSyncTime] = useState(() => {
    const savedTime = localStorage.getItem('cache_last_sync');
    return savedTime ? new Date(savedTime) : null;
  });
  const [timeSinceSync, setTimeSinceSync] = useState('завантаження...');

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

  // ⏱️ СЕКУНДОМІР: Живий відлік кожну секунду (Години : Хвилини : Секунди)
  useEffect(() => {
    if (!lastSyncTime) return;

    const updateTimer = () => {
      const now = new Date();
      const diffMs = now - lastSyncTime;
      
      if (diffMs < 0) {
        setTimeSinceSync('00:00:00');
        return;
      }

      const diffSecs = Math.floor(diffMs / 1000);
      const hours = Math.floor(diffSecs / 3600);
      const minutes = Math.floor((diffSecs % 3600) / 60);
      const seconds = diffSecs % 60;

      // Форматуємо у красивий вигляд 02:05:14 тому
      const formattedTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      setTimeSinceSync(`${formattedTime} тому`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000); // Оновлюємо кожну секунду!
    return () => clearInterval(interval);
  }, [lastSyncTime]);

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

      // ⏱️ СЕКУНДОМІР: Запитуємо точний час останнього запуску бота з нашої нової таблички
      const { data: syncData } = await supabase
        .from('system_status')
        .select('last_sync')
        .eq('id', 1)
        .single();
      
      if (syncData?.last_sync) {
        const dbTime = new Date(syncData.last_sync);
        setLastSyncTime(dbTime);
        localStorage.setItem('cache_last_sync', dbTime.toISOString());
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
      alert("Пароль має бути не менше 6 знаків!");
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
  const currentUserStats = leaderboard.find(player => player.user_id === session.user.id);

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
        {/* ХЕДЕР */}
        <header className="flex flex-row justify-between items-center border-b border-gray-900 bg-gray-900/40 backdrop-blur px-2.5 sm:px-6 py-1.5 sm:py-2.5 sticky top-0 z-50 gap-1.5 sm:gap-2">
          <div className="flex items-center gap-1 flex-shrink-0 cursor-pointer select-none" onClick={() => setCurrentTab('matches')}>
            <span className="text-xl sm:text-2xl">🏆</span>
            <h1 className="hidden sm:block text-sm md:text-base font-black text-green-400 tracking-wider uppercase">Predict World Cup</h1>
          </div>

          <div className="flex bg-gray-950 border border-gray-850 p-0.5 rounded-xl flex-1 justify-center gap-0.5 max-w-[240px] sm:max-w-none">
            <button 
              onClick={() => setCurrentTab('matches')} 
              className={`flex-1 sm:flex-none text-[10px] sm:text-xs font-bold px-2 sm:px-4 py-1 sm:py-1.5 rounded-lg transition-all cursor-pointer ${currentTab === 'matches' ? 'bg-green-500/10 text-green-400 border border-green-500/10 shadow-sm' : 'text-gray-400 hover:text-white border border-transparent'}`}
            >
              ⚽ Лінія
            </button>
            <button 
              onClick={() => setCurrentTab('my_profile')} 
              className={`flex-1 sm:flex-none text-[10px] sm:text-xs font-bold px-2 sm:px-4 py-1 sm:py-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${currentTab === 'my_profile' ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/10' : 'text-gray-400 hover:text-white border border-transparent'}`}
            >
              🎯 Мої прогнози
              {predictedMatches.length > 0 && (
                <span className="bg-emerald-500 text-gray-950 font-black text-[9px] px-1 rounded-md min-w-[14px] h-[14px] flex items-center justify-center">
                  {predictedMatches.length}
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center justify-end gap-1 sm:gap-3 flex-shrink-0">
            <span onClick={() => setCurrentTab('my_profile')} className="text-[11px] sm:text-sm text-gray-400 bg-gray-900 px-2 sm:px-3 py-1.5 rounded-xl border border-gray-800 font-semibold cursor-pointer hover:border-gray-700 hover:text-white transition-colors max-w-[70px] sm:max-w-none truncate">
              {session.user.email.split('@')[0]}
            </span>
            <button onClick={() => {
              localStorage.clear();
              supabase.auth.signOut();
            }} className="rounded-xl bg-red-600/10 text-red-400 border border-red-500/20 px-2 sm:px-4 py-1.5 sm:py-2 text-[11px] sm:text-sm font-semibold hover:bg-red-600 hover:text-white transition-all cursor-pointer active:scale-95">
              Вийти
            </button>
          </div>
        </header>

        {/* ГОЛОВНИЙ КОНТЕНТ */}
        <main className="max-w-6xl mx-auto px-3 sm:px-4 py-3 sm:py-6 grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="lg:col-span-2 order-2 lg:order-1">
            <AnimatePresence mode="wait">
              
              {/* Вкладка 1: ЛІНІЯ МАТЧІВ */}
              {currentTab === 'matches' && (
                <motion.div key="matches_tab" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.15 }} className="space-y-3">
                  <div className="flex items-center justify-between border-b border-gray-900 pb-1.5 mb-1">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-green-400 border-l-4 border-green-500 pl-2.5">
                      🔥 Доступні матчі ({unpredictedMatches.length})
                    </h2>
                  </div>

                  {loading ? (
                    <div className="space-y-2"><SkeletonCard /><SkeletonCard /></div>
                  ) : unpredictedMatches.length === 0 ? (
                    <div className="text-center text-gray-500 py-14 px-4 border border-dashed border-gray-800 rounded-2xl bg-gray-900/10 flex flex-col items-center justify-center gap-2">
                      <span className="text-2xl">🎉</span>
                      <p className="text-xs sm:text-sm font-medium text-gray-400">Ти заповнив абсолютно всі прогнози!</p>
                      <button onClick={() => setCurrentTab('my_profile')} className="text-[11px] bg-green-500/10 border border-green-500/20 text-green-400 px-2.5 py-1.5 rounded-xl font-bold hover:bg-green-500 hover:text-white transition-all cursor-pointer">Перейти до моїх прогнозів →</button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <AnimatePresence mode="popLayout">
                        {unpredictedMatches.map((match) => (
                          <motion.div key={match.id} layout="position" initial={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }} transition={{ type: "spring", stiffness: 350, damping: 32 }} whileHover={{ scale: 1.01, y: -1 }} className="w-full origin-center will-change-transform">
                            <MatchCard match={match} userPrediction={predictions[match.id]} onMakePrediction={handlePredict} />
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Вкладка 2: МОЇ ПРОГНОЗИ */}
              {currentTab === 'my_profile' && (
                <motion.div key="profile_tab" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.15 }} className="space-y-5 bg-gradient-to-b from-emerald-950/20 to-transparent p-3 sm:p-5 border border-emerald-900/10 rounded-2xl">
                  <div className="bg-gradient-to-r from-emerald-900/30 to-teal-950/40 border border-emerald-500/10 p-3.5 rounded-xl shadow-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                      <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-900/40">Особистий кабінет</span>
                      <h3 className="text-lg font-black text-white mt-1">👤 {session.user.email.split('@')[0]}</h3>
                    </div>
                    <div className="grid grid-cols-3 gap-2 w-full sm:w-auto text-center">
                      <div className="bg-gray-950/60 border border-emerald-950 px-2 py-1 rounded-xl min-w-[65px]">
                        <span className="text-[9px] font-bold text-gray-500 block uppercase">Матчів</span>
                        <span className="text-xs font-black text-white">{currentUserStats?.total_predictions || 0}</span>
                      </div>
                      <div className="bg-gray-950/60 border border-emerald-950 px-2 py-1 rounded-xl min-w-[65px]">
                        <span className="text-[9px] font-bold text-gray-500 block uppercase">Бали</span>
                        <span className="text-xs font-black text-emerald-400">{currentUserStats?.total_points || 0}</span>
                      </div>
                      <div className="bg-gray-950/60 border border-emerald-950 px-2 py-1 rounded-xl min-w-[65px]">
                        <span className="text-[9px] font-bold text-gray-500 block uppercase">Сума кф</span>
                        <span className="text-xs font-black text-yellow-500">{Number(currentUserStats?.total_odds || 0).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-400 border-l-4 border-emerald-500 pl-2.5 mb-1">
                      📋 Твої активні прогнози ({predictedMatches.length})
                    </h2>
                    {predictedMatches.length === 0 ? (
                      <p className="text-xs text-gray-500 italic pl-3 py-2 border border-dashed border-gray-900 rounded-xl bg-gray-900/10 text-center">У тебе немає активних прогнозів.</p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <AnimatePresence mode="popLayout">
                          {predictedMatches.map((match) => (
                            <motion.div key={match.id} layout="position" whileHover={{ scale: 1.005 }} className="w-full origin-center">
                              <MatchCard match={match} userPrediction={predictions[match.id]} onMakePrediction={handlePredict} />
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>

                  {finishedMatches.length > 0 && (
                    <div className="pt-4 border-t border-emerald-900/20">
                      <h2 className="text-xs font-bold uppercase tracking-wider text-red-400 border-l-4 border-red-500 pl-2.5 mb-3">
                        🏁 Твої завершені матчі ({finishedMatches.length})
                      </h2>
                      <div className="flex flex-col gap-2">
                        {finishedMatches.map((match) => {
                          const userChoice = predictions[match.id];
                          let realResult = '';
                          if (match.home_score > match.away_score) realResult = '1';
                          else if (match.home_score < match.away_score) realResult = '2';
                          else if (match.home_score !== null && match.away_score !== null) realResult = 'X';

                          const isCorrect = userChoice && realResult === userChoice;

                          return (
                            <div key={match.id} className="w-full">
                              <MatchCard match={match} userPrediction={userChoice} onMakePrediction={handlePredict} isReadOnly={true} isCorrect={isCorrect} />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ТАБЛИЦЯ ЛІДЕРІВ */}
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
                    <div key={player.user_id} onClick={() => handleUserClick(player)} className={`grid grid-cols-12 items-center text-xs p-1.5 rounded-xl transition-all text-center cursor-pointer hover:bg-gray-800/60 hover:scale-[1.01] active:scale-98 ${player.user_id === session.user.id ? 'bg-green-500/5 border border-green-500/20 shadow-sm' : 'border border-transparent'}`}>
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
        <footer className="w-full max-w-6xl mx-auto px-3 sm:px-4 pb-4 sm:pb-6 mt-4 order-3">
          <div className="bg-gray-900 border border-red-900/20 rounded-2xl p-4 shadow-xl max-w-xl mx-auto">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-base">🛠️</span>
              <h3 className="text-xs font-black text-red-400 uppercase tracking-widest">Панель Адміністратора</h3>
            </div>
            <form onSubmit={handleAdminResetPassword} className="flex flex-col gap-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input type="text" placeholder="Логін (напр: ros)" value={adminTargetUser} onChange={(e) => setAdminTargetUser(e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500 transition-colors" />
                <input type="text" placeholder="Новий пароль (мін. 6 знаків)" value={adminNewPassword} onChange={(e) => setAdminNewPassword(e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500 transition-colors" />
              </div>
              <button type="submit" disabled={adminLoading} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded-xl text-xs transition-colors cursor-pointer active:scale-95">{adminLoading ? 'Оновлення...' : 'Змінити пароль'}</button>
            </form>
          </div>
        </footer>
      )}

      {/* ⏱️ СПРАВЖНІЙ СЕКУНДОМІР */}
      <div className="w-full text-center pb-4 pt-2 order-4 flex items-center justify-center gap-1.5 select-none">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
        <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-500">
          коефіцієнти було оновлено: <span className="text-gray-400 font-black tracking-widest bg-gray-900/60 px-2 py-1 rounded-md border border-gray-850 ml-1">{timeSinceSync}</span>
        </p>
      </div>

      {/* 👑 КРИТИЧНО НЕОБХІДНА МОДАЛКА ПЕРЕГЛЯДУ ГРАВЦІВ */}
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
                  const playerChoice = selectedUserPreds[match.id];
                  if (!playerChoice) return null; // Якщо гравець не ставив на цей матч — пропускаємо

                  // Розраховуємо перемогу саме для обраного гравця
                  let realResult = '';
                  if (match.home_score > match.away_score) realResult = '1';
                  else if (match.home_score < match.away_score) realResult = '2';
                  else if (match.home_score !== null && match.away_score !== null) realResult = 'X';

                  const isPlayerCorrect = realResult === playerChoice;

                  return (
                    <div key={match.id} className="w-full">
                      <MatchCard 
                        match={match} 
                        userPrediction={playerChoice} 
                        onMakePrediction={handlePredict} 
                        isReadOnly={true} 
                        isCorrect={match.status === 'finished' ? isPlayerCorrect : false} 
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}