import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Auth from './Auth';
import MatchCard from './MatchCard';
import SkeletonCard from './SkeletonCard';
import { motion, AnimatePresence } from 'framer-motion';

export default function App() {
  const [session, setSession] = useState(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  // 🏆 Вкладки: 'epl' (АПЛ), 'ucl' (Ліга Чемпіонів), 'my_profile' (Прогнози)
  const [currentTab, setCurrentTab] = useState('epl');

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

  useEffect(() => {
    const updateTimer = () => {
      if (!lastSyncTime) {
        setTimeSinceSync('немає даних');
        return;
      }

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

      const formattedTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      setTimeSinceSync(`${formattedTime} тому`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
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
        .select('match_id, user_choice, playoff_winner')
        .eq('user_id', session.user.id);

      const predsMap = {};
      predsData?.forEach(p => {
        predsMap[p.match_id] = {
          user_choice: p.user_choice,
          playoff_winner: p.playoff_winner
        };
      });
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
      console.error("Помилка оновлення даних:", error.message);
    }
    setLoading(false);
  };

  const handlePredict = async (matchId, choice, playoffWinner = null) => {
    const match = matches.find(m => m.id === matchId);
    if (!match || match.status === 'finished' || new Date() >= new Date(match.start_time)) {
      alert("Матч уже розпочався або завершився!");
      return;
    }

    const updatedPredictions = {
      ...predictions,
      [matchId]: { user_choice: choice, playoff_winner: playoffWinner }
    };
    setPredictions(updatedPredictions);
    localStorage.setItem('cache_predictions', JSON.stringify(updatedPredictions));

    try {
      const { error } = await supabase
        .from('predictions')
        .upsert(
          {
            user_id: session.user.id,
            match_id: matchId,
            user_choice: choice,
            playoff_winner: playoffWinner
          },
          { onConflict: 'user_id,match_id' }
        );
      if (error) throw error;
      fetchData();
    } catch (error) {
      alert("Помилка збереження прогнозу: " + error.message);
      fetchData();
    }
  };

  const handleAdminResetPassword = async (e) => {
    e.preventDefault();
    if (!adminTargetUser.trim() || !adminNewPassword.trim()) return;
    setAdminLoading(true);
    const targetEmail = `${adminTargetUser.trim().toLowerCase()}@predict.wcup`;

    try {
      await supabase.rpc('admin_reset_password_by_email', {
        target_email: targetEmail,
        new_password: adminNewPassword
      });
      alert(`Пароль для ${adminTargetUser} оновлено!`);
      setAdminTargetUser('');
      setAdminNewPassword('');
    } catch (err) {
      alert("Помилка: " + err.message);
    }
    setAdminLoading(false);
  };

  const handleUserClick = async (player) => {
    setSelectedUser(player);
    try {
      const { data: userPreds } = await supabase
        .from('predictions')
        .select('match_id, user_choice, playoff_winner')
        .eq('user_id', player.user_id);

      const map = {};
      userPreds?.forEach(p => {
        map[p.match_id] = { user_choice: p.user_choice, playoff_winner: p.playoff_winner };
      });
      setSelectedUserPreds(map);
    } catch (e) {
      console.error(e);
    }
  };

  if (isAuthChecking) {
    return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400 text-sm font-semibold tracking-wider px-4 text-center">Завантаження контенту...</div>;
  }

  if (!session) return <Auth />;

  const isAdmin = session.user.email === 'ros@predict.wcup' || session.user.email.startsWith('admin');
  const currentUserStats = leaderboard.find(player => player.user_id === session.user.id);

  // 🏆 Фільтрація по лігах для доступних матчів
  const getLeagueMatches = (leagueName) => {
    return matches
      .filter(m => (m.league === leagueName || (!m.league && leagueName === 'epl')) && m.status !== 'finished')
      .filter(m => {
        const pred = predictions[m.id];
        return !pred || !pred.user_choice;
      })
      .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
  };

  const eplMatches = getLeagueMatches('epl');
  const uclMatches = getLeagueMatches('ucl');

  const predictedMatches = matches
    .filter(m => {
      if (m.status === 'finished') return false;
      const pred = predictions[m.id];
      return pred && pred.user_choice;
    })
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

  const finishedMatches = matches
    .filter(m => m.status === 'finished')
    .sort((a, b) => new Date(b.start_time) - new Date(a.start_time));

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans antialiased flex flex-col justify-between selection:bg-green-500/30">
      <div>
        {/* ХЕДЕР */}
        <header className="flex flex-row justify-between items-center border-b border-gray-900 bg-gray-900/40 backdrop-blur px-2.5 sm:px-6 py-2 sticky top-0 z-50 gap-1.5">
          <div className="flex items-center gap-1 cursor-pointer select-none" onClick={() => setCurrentTab('epl')}>
            <span className="text-xl">⚽</span>
            <h1 className="hidden sm:block text-sm md:text-base font-black text-green-400 tracking-wider uppercase">Football Predictor</h1>
          </div>

          {/* 🎛️ ПЕРЕМИКАЧ ВКЛАДОК ЛІГ */}
          <div className="flex bg-gray-950 border border-gray-850 p-0.5 rounded-xl flex-1 justify-center gap-0.5 max-w-[320px] sm:max-w-none">
            <button
              onClick={() => setCurrentTab('epl')}
              className={`flex-1 sm:flex-none text-[10px] sm:text-xs font-bold px-2 sm:px-3 py-1.5 rounded-lg transition-all ${currentTab === 'epl' ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30 shadow-sm' : 'text-gray-400 hover:text-white border border-transparent'}`}
            >
              🏴󠁧󠁢󠁥󠁮󠁧󠁿 АПЛ {eplMatches.length > 0 && `(${eplMatches.length})`}
            </button>
            <button
              onClick={() => setCurrentTab('ucl')}
              className={`flex-1 sm:flex-none text-[10px] sm:text-xs font-bold px-2 sm:px-3 py-1.5 rounded-lg transition-all ${currentTab === 'ucl' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-sm' : 'text-gray-400 hover:text-white border border-transparent'}`}
            >
              ⭐ ЛЧ {uclMatches.length > 0 && `(${uclMatches.length})`}
            </button>
            <button
              onClick={() => setCurrentTab('my_profile')}
              className={`flex-1 sm:flex-none text-[10px] sm:text-xs font-bold px-2 sm:px-3 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 ${currentTab === 'my_profile' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-gray-400 hover:text-white border border-transparent'}`}
            >
              🎯 Мої {predictedMatches.length > 0 && `(${predictedMatches.length})`}
            </button>
          </div>

          <div className="flex items-center justify-end gap-1 sm:gap-3 flex-shrink-0">
            <span onClick={() => setCurrentTab('my_profile')} className="text-[11px] sm:text-sm text-gray-400 bg-gray-900 px-2 sm:px-3 py-1 rounded-xl border border-gray-800 font-semibold cursor-pointer max-w-[70px] sm:max-w-none truncate">
              {session.user.email.split('@')[0]}
            </span>
            <button onClick={() => { localStorage.clear(); supabase.auth.signOut(); }} className="rounded-xl bg-red-600/10 text-red-400 border border-red-500/20 px-2 sm:px-3 py-1 text-[11px] sm:text-sm font-semibold hover:bg-red-600 hover:text-white transition-all">Вийти</button>
          </div>
        </header>

        {/* ГОЛОВНИЙ КОНТЕНТ */}
        <main className="max-w-6xl mx-auto px-3 sm:px-4 py-3 sm:py-6 grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="lg:col-span-2 order-2 lg:order-1">
            <AnimatePresence mode="wait">

              {/* 🏴󠁧󠁢󠁥󠁮󠁧󠁿 ВКЛАДКА: АПЛ */}
              {currentTab === 'epl' && (
                <motion.div key="epl_tab" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.15 }} className="space-y-3">
                  <div className="flex items-center justify-between border-b border-gray-900 pb-1.5 mb-1">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-purple-400 border-l-4 border-purple-500 pl-2.5">
                      🏴󠁧󠁢󠁥󠁮󠁧󠁿 Англійська Прем'єр-Ліга ({eplMatches.length})
                    </h2>
                  </div>
                  {loading ? ( <div className="space-y-2"><SkeletonCard /><SkeletonCard /></div> ) : eplMatches.length === 0 ? (
                    <div className="text-center text-gray-500 py-14 border border-dashed border-gray-800 rounded-2xl bg-gray-900/10">
                      <p className="text-xs sm:text-sm font-medium text-gray-400">Немає доступних матчів АПЛ або ви вже зробили всі прогнози!</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {eplMatches.map((match) => (
                        <MatchCard key={match.id} match={match} userPrediction={predictions[match.id]} onMakePrediction={handlePredict} />
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {/* ⭐ ВКЛАДКА: ЛІГА ЧЕМПІОНІВ */}
              {currentTab === 'ucl' && (
                <motion.div key="ucl_tab" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.15 }} className="space-y-3">
                  <div className="flex items-center justify-between border-b border-gray-900 pb-1.5 mb-1">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-blue-400 border-l-4 border-blue-500 pl-2.5">
                      ⭐ Ліга Чемпіонів УЄФА ({uclMatches.length})
                    </h2>
                  </div>
                  {loading ? ( <div className="space-y-2"><SkeletonCard /><SkeletonCard /></div> ) : uclMatches.length === 0 ? (
                    <div className="text-center text-gray-500 py-14 border border-dashed border-gray-800 rounded-2xl bg-gray-900/10">
                      <p className="text-xs sm:text-sm font-medium text-gray-400">Немає доступних матчів ЛЧ або ви вже зробили всі прогнози!</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {uclMatches.map((match) => (
                        <MatchCard key={match.id} match={match} userPrediction={predictions[match.id]} onMakePrediction={handlePredict} />
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {/* 🎯 ВКЛАДКА: МОЇ ПРОГНОЗИ */}
              {currentTab === 'my_profile' && (
                <motion.div key="profile_tab" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.15 }} className="space-y-5 bg-gradient-to-b from-emerald-950/20 to-transparent p-3 sm:p-5 border border-emerald-900/10 rounded-2xl">
                  <div className="bg-gradient-to-r from-emerald-900/30 to-teal-950/40 border border-emerald-500/10 p-3.5 rounded-xl flex justify-between items-center gap-3">
                    <div>
                      <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-900/40">Особистий кабінет</span>
                      <h3 className="text-lg font-black text-white mt-1">👤 {session.user.email.split('@')[0]}</h3>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-gray-950/60 border border-emerald-950 px-2 py-1 rounded-xl">
                        <span className="text-[9px] font-bold text-gray-500 block uppercase">Матчів</span>
                        <span className="text-xs font-black text-white">{currentUserStats?.total_predictions || 0}</span>
                      </div>
                      <div className="bg-gray-950/60 border border-emerald-950 px-2 py-1 rounded-xl">
                        <span className="text-[9px] font-bold text-gray-500 block uppercase">Бали</span>
                        <span className="text-xs font-black text-emerald-400">{currentUserStats?.total_points || 0}</span>
                      </div>
                      <div className="bg-gray-950/60 border border-emerald-950 px-2 py-1 rounded-xl">
                        <span className="text-[9px] font-bold text-gray-500 block uppercase">Сума кф</span>
                        <span className="text-xs font-black text-yellow-500">{Number(currentUserStats?.total_odds || 0).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-400 border-l-4 border-emerald-500 pl-2.5 mb-1">
                      📋 Активні прогнози ({predictedMatches.length})
                    </h2>
                    <div className="flex flex-col gap-2">
                      {predictedMatches.map((match) => (
                        <MatchCard key={match.id} match={match} userPrediction={predictions[match.id]} onMakePrediction={handlePredict} />
                      ))}
                    </div>
                  </div>

                  {finishedMatches.length > 0 && (
                    <div className="pt-4 border-t border-emerald-900/20">
                      <h2 className="text-xs font-bold uppercase tracking-wider text-red-400 border-l-4 border-red-500 pl-2.5 mb-3">
                        🏁 Завершені матчі ({finishedMatches.length})
                      </h2>
                      <div className="flex flex-col gap-2">
                        {finishedMatches.map((match) => (
                          <MatchCard key={match.id} match={match} userPrediction={predictions[match.id]} isReadOnly={true} />
                        ))}
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
                    <div key={player.user_id} onClick={() => handleUserClick(player)} className={`grid grid-cols-12 items-center text-xs p-1.5 rounded-xl transition-all text-center cursor-pointer hover:bg-gray-800/60 ${player.user_id === session.user.id ? 'bg-green-500/5 border border-green-500/20 shadow-sm' : 'border border-transparent'}`}>
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

      {/* СЕКУНДОМІР ОНОВЛЕНЬ */}
      <div className="w-full text-center pb-4 pt-2 order-4 flex items-center justify-center gap-1.5 select-none">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
        <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-500">
          коефіцієнти оновлено: <span className="text-gray-400 font-black tracking-widest bg-gray-900/60 px-2 py-1 rounded-md border border-gray-850 ml-1">{timeSinceSync}</span>
        </p>
      </div>
    </div>
  );
}