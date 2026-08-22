import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Auth from './Auth';
import MatchCard from './MatchCard';
import SkeletonCard from './SkeletonCard';
import { motion, AnimatePresence } from 'framer-motion';

export default function App() {
  const [session, setSession] = useState(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [currentTab, setCurrentTab] = useState('epl'); // 'epl' | 'ucl' | 'my_profile'
  const [profileLeaderboardTab, setProfileLeaderboardTab] = useState('epl'); // Для перемикача в профілі

  const [matches, setMatches] = useState(() => {
    const saved = localStorage.getItem('cache_matches');
    return saved ? JSON.parse(saved) : [];
  });

  const [predictions, setPredictions] = useState(() => {
    const saved = localStorage.getItem('cache_predictions');
    return saved ? JSON.parse(saved) : {};
  });

  // Окремі лідерборди
  const [leaderboardEpl, setLeaderboardEpl] = useState(() => {
    const saved = localStorage.getItem('cache_leaderboard_epl');
    return saved ? JSON.parse(saved) : [];
  });

  const [leaderboardUcl, setLeaderboardUcl] = useState(() => {
    const saved = localStorage.getItem('cache_leaderboard_ucl');
    return saved ? JSON.parse(saved) : [];
  });

  const [loading, setLoading] = useState(() => !localStorage.getItem('cache_matches'));
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
    if (session) fetchData();
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

      // 1. Завантажуємо таблицю АПЛ
      const { data: eplData } = await supabase
          .from('leaderboard_epl')
          .select('*')
          .order('total_points', { ascending: false })
          .order('total_odds', { ascending: false });
      if (eplData) {
        setLeaderboardEpl(eplData);
        localStorage.setItem('cache_leaderboard_epl', JSON.stringify(eplData));
      }

      // 2. Завантажуємо таблицю ЛЧ
      const { data: uclData } = await supabase
          .from('leaderboard_ucl')
          .select('*')
          .order('total_points', { ascending: false })
          .order('total_odds', { ascending: false });
      if (uclData) {
        setLeaderboardUcl(uclData);
        localStorage.setItem('cache_leaderboard_ucl', JSON.stringify(uclData));
      }

    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };

  const handlePredict = async (matchId, choice) => {
    const match = matches.find(m => m.id === matchId);
    if (!match || match.status === 'finished' || new Date() >= new Date(match.start_time)) return;

    const updated = { ...predictions, [matchId]: choice };
    setPredictions(updated);
    localStorage.setItem('cache_predictions', JSON.stringify(updated));

    try {
      await supabase.from('predictions').upsert(
          { user_id: session.user.id, match_id: matchId, user_choice: choice },
          { onConflict: 'user_id,match_id' }
      );
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleUserClick = async (player) => {
    setSelectedUser(player);
    setLoadingUserPreds(true);
    setSelectedUserPreds({});
    try {
      const { data: userPreds, error } = await supabase
          .from('predictions')
          .select('match_id, user_choice')
          .eq('user_id', player.user_id);

      if (!error && userPreds) {
        const map = {};
        userPreds.forEach(p => {
          map[p.match_id] = p.user_choice;
        });
        setSelectedUserPreds(map);
      }
    } catch (e) {
      console.error(e);
    }
    setLoadingUserPreds(false);
  };

  if (isAuthChecking) {
    return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400 text-sm">Завантаження...</div>;
  }

  if (!session) return <Auth />;

  const currentEplStats = leaderboardEpl.find(player => player.user_id === session.user.id);
  const currentUclStats = leaderboardUcl.find(player => player.user_id === session.user.id);

  const eplMatches = matches
      .filter(m => (m.league === 'epl' || (!m.league && m.home_team !== '')) && m.status !== 'finished' && !predictions[m.id])
      .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

  const uclMatches = matches
      .filter(m => m.league === 'ucl' && m.status !== 'finished' && !predictions[m.id])
      .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

  const predictedMatches = matches
      .filter(m => predictions[m.id] && m.status !== 'finished')
      .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

  const finishedMatches = matches
      .filter(m => m.status === 'finished')
      .sort((a, b) => new Date(b.start_time) - new Date(a.start_time));

  // Рендер конкретної таблиці лідерів
  const renderLeaderboardTable = (data, leagueTitle, accentColor = 'purple') => (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 shadow-xl">
        <h2 className={`text-sm font-black mb-3 tracking-wide flex items-center gap-1.5 ${accentColor === 'purple' ? 'text-purple-400' : 'text-blue-400'}`}>
          <span>📊</span> Таблиця лідерів ({leagueTitle})
        </h2>
        <div className="space-y-1.5">
          <div className="grid grid-cols-12 text-[10px] font-bold text-gray-500 uppercase px-2 pb-1 border-b border-gray-800 text-center">
            <span className="col-span-6 text-left">Гравець</span>
            <span className="col-span-3">Бали</span>
            <span className="col-span-3">Кф.</span>
          </div>
          {data.length === 0 ? (
              <div className="text-center text-gray-500 py-4 text-xs">Немає даних</div>
          ) : (
              data.map((player, index) => (
                  <div
                      key={player.user_id}
                      onClick={() => handleUserClick(player)}
                      className={`grid grid-cols-12 items-center text-xs p-2 rounded-xl text-center cursor-pointer hover:bg-gray-800/80 transition-all border ${player.user_id === session.user.id ? 'bg-gray-800/50 border-gray-700' : 'border-transparent hover:border-gray-700'} active:scale-[0.99]`}
                  >
                    <div className="col-span-6 flex items-center gap-1.5 truncate text-left">
                      <span className="text-[10px] text-gray-500 font-bold">{index + 1}.</span>
                      <span className="truncate text-gray-200 font-semibold">{player.user_email.split('@')[0]}</span>
                    </div>
                    <span className="col-span-3 text-green-400 font-bold">{player.total_points}</span>
                    <span className="col-span-3 text-yellow-500 font-bold">{Number(player.total_odds).toFixed(2)}</span>
                  </div>
              ))
          )}
        </div>
      </div>
  );

  return (
      <div className="min-h-screen bg-gray-950 text-white font-sans antialiased flex flex-col justify-between">
        <div>
          {/* ХЕДЕР */}
          <header className="flex flex-row justify-between items-center border-b border-gray-900 bg-gray-900/50 backdrop-blur px-3 sm:px-6 py-2.5 sticky top-0 z-50 gap-2">
            <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => setCurrentTab('epl')}>
              <span className="text-xl">🏆</span>
              <h1 className="hidden sm:block text-sm font-black text-green-400 uppercase tracking-wider">Predictor</h1>
            </div>

            <div className="flex bg-gray-950 border border-gray-850 p-1 rounded-xl flex-1 justify-center gap-1 max-w-[340px] sm:max-w-none">
              <button
                  onClick={() => setCurrentTab('epl')}
                  className={`flex-1 sm:flex-none text-[11px] sm:text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${currentTab === 'epl' ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30' : 'text-gray-400 hover:text-white border border-transparent'}`}
              >
                🏴󠁧󠁢󠁥󠁮󠁧󠁿 АПЛ {eplMatches.length > 0 && `(${eplMatches.length})`}
              </button>
              <button
                  onClick={() => setCurrentTab('ucl')}
                  className={`flex-1 sm:flex-none text-[11px] sm:text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${currentTab === 'ucl' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-gray-400 hover:text-white border border-transparent'}`}
              >
                ⭐ Ліга Чемпіонів {uclMatches.length > 0 && `(${uclMatches.length})`}
              </button>
              <button
                  onClick={() => setCurrentTab('my_profile')}
                  className={`flex-1 sm:flex-none text-[11px] sm:text-xs font-bold px-3 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 ${currentTab === 'my_profile' ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30' : 'text-gray-400 hover:text-white border border-transparent'}`}
              >
                🎯 Мої {predictedMatches.length > 0 && `(${predictedMatches.length})`}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={() => { localStorage.clear(); supabase.auth.signOut(); }} className="rounded-xl bg-red-600/10 text-red-400 border border-red-500/20 px-2.5 py-1 text-xs font-semibold hover:bg-red-600 hover:text-white transition-all">Вийти</button>
            </div>
          </header>

          {/* ГОЛОВНИЙ КОНТЕНТ */}
          <main className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6 grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            <div className="lg:col-span-2">
              <AnimatePresence mode="wait">

                {/* 🏴󠁧󠁢󠁥󠁮󠁧󠁿 АПЛ */}
                {currentTab === 'epl' && (
                    <motion.div key="epl" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                      <h2 className="text-xs font-bold uppercase tracking-wider text-purple-400 border-l-4 border-purple-500 pl-2.5">
                        🏴󠁧󠁢󠁥󠁮󠁧󠁿 Прем'єр-Ліга Англії ({eplMatches.length})
                      </h2>
                      {loading ? <SkeletonCard /> : eplMatches.length === 0 ? (
                          <div className="text-center text-gray-500 py-12 border border-dashed border-gray-800 rounded-xl">Матчів АПЛ немає або всі прогнози заповнено.</div>
                      ) : (
                          eplMatches.map(match => (
                              <MatchCard key={match.id} match={match} userPrediction={predictions[match.id]} onMakePrediction={handlePredict} />
                          ))
                      )}
                      {/* Мобільна таблиця АПЛ */}
                      <div className="block lg:hidden pt-4">
                        {renderLeaderboardTable(leaderboardEpl, "АПЛ", "purple")}
                      </div>
                    </motion.div>
                )}

                {/* ⭐ ЛІГА ЧЕМПІОНІВ */}
                {currentTab === 'ucl' && (
                    <motion.div key="ucl" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                      <h2 className="text-xs font-bold uppercase tracking-wider text-blue-400 border-l-4 border-blue-500 pl-2.5">
                        ⭐ Ліга Чемпіонів УЄФА ({uclMatches.length})
                      </h2>
                      {loading ? <SkeletonCard /> : uclMatches.length === 0 ? (
                          <div className="text-center text-gray-500 py-12 border border-dashed border-gray-800 rounded-xl">Матчів ЛЧ немає або всі прогнози заповнено.</div>
                      ) : (
                          uclMatches.map(match => (
                              <MatchCard key={match.id} match={match} userPrediction={predictions[match.id]} onMakePrediction={handlePredict} />
                          ))
                      )}
                      {/* Мобільна таблиця ЛЧ */}
                      <div className="block lg:hidden pt-4">
                        {renderLeaderboardTable(leaderboardUcl, "Ліга Чемпіонів", "blue")}
                      </div>
                    </motion.div>
                )}

                {/* 🎯 МОЇ ПРОГНОЗИ */}
                {currentTab === 'my_profile' && (
                    <motion.div key="profile" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                      {/* Блок статистики гравця (АПЛ + ЛЧ окремо) */}
                      <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div>
                          <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Особистий профіль</span>
                          <h3 className="text-base font-bold text-white">👤 {session.user.email.split('@')[0]}</h3>
                        </div>

                        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                          {/* АПЛ блок */}
                          <div className="flex-1 sm:flex-none bg-gray-950 px-3 py-1.5 rounded-xl border border-purple-900/40 text-center">
                            <span className="text-[9px] font-bold text-purple-400 block uppercase">🏴󠁧󠁢󠁥󠁮󠁧󠁿 АПЛ</span>
                            <div className="flex items-center justify-center gap-2 mt-0.5">
                              <span className="text-xs font-black text-green-400">{currentEplStats?.total_points || 0} б</span>
                              <span className="text-[11px] font-bold text-yellow-500">k={Number(currentEplStats?.total_odds || 0).toFixed(2)}</span>
                            </div>
                          </div>

                          {/* ЛЧ блок */}
                          <div className="flex-1 sm:flex-none bg-gray-950 px-3 py-1.5 rounded-xl border border-blue-900/40 text-center">
                            <span className="text-[9px] font-bold text-blue-400 block uppercase">⭐ ЛЧ</span>
                            <div className="flex items-center justify-center gap-2 mt-0.5">
                              <span className="text-xs font-black text-green-400">{currentUclStats?.total_points || 0} б</span>
                              <span className="text-[11px] font-bold text-yellow-500">k={Number(currentUclStats?.total_odds || 0).toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 1. Активні прогнози */}
                      <div className="space-y-2">
                        <h3 className="text-xs font-bold text-gray-400">Активні прогнози ({predictedMatches.length})</h3>
                        {predictedMatches.map(match => (
                            <MatchCard key={match.id} match={match} userPrediction={predictions[match.id]} onMakePrediction={handlePredict} />
                        ))}
                      </div>

                      {/* 2. Перемикач таблиць лідерів на мобільному */}
                      <div className="block lg:hidden pt-2 space-y-2">
                        <div className="flex bg-gray-950 p-1 rounded-xl border border-gray-800 gap-1">
                          <button
                              onClick={() => setProfileLeaderboardTab('epl')}
                              className={`flex-1 text-xs font-bold py-1.5 rounded-lg transition-all ${profileLeaderboardTab === 'epl' ? 'bg-purple-600/30 text-purple-300 border border-purple-500/40' : 'text-gray-400'}`}
                          >
                            Таблиця АПЛ
                          </button>
                          <button
                              onClick={() => setProfileLeaderboardTab('ucl')}
                              className={`flex-1 text-xs font-bold py-1.5 rounded-lg transition-all ${profileLeaderboardTab === 'ucl' ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40' : 'text-gray-400'}`}
                          >
                            Таблиця ЛЧ
                          </button>
                        </div>
                        {profileLeaderboardTab === 'epl'
                            ? renderLeaderboardTable(leaderboardEpl, "АПЛ", "purple")
                            : renderLeaderboardTable(leaderboardUcl, "Ліга Чемпіонів", "blue")
                        }
                      </div>

                      {/* 3. Завершені матчі */}
                      {finishedMatches.length > 0 && (
                          <div className="space-y-2 pt-2">
                            <h3 className="text-xs font-bold text-gray-400">Завершені ({finishedMatches.length})</h3>
                            {finishedMatches.map(match => (
                                <MatchCard
                                    key={match.id}
                                    match={match}
                                    userPrediction={predictions[match.id]}
                                    isReadOnly={true}
                                    showOddsAlways={true}
                                />
                            ))}
                          </div>
                      )}
                    </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ТАБЛИЦЯ ЛІДЕРІВ ДЛЯ ПК (ПРАВА КОЛОНКА) */}
            <div className="hidden lg:block space-y-4">
              {currentTab === 'epl' && renderLeaderboardTable(leaderboardEpl, "АПЛ", "purple")}
              {currentTab === 'ucl' && renderLeaderboardTable(leaderboardUcl, "Ліга Чемпіонів", "blue")}
              {currentTab === 'my_profile' && (
                  <div className="space-y-4">
                    {renderLeaderboardTable(leaderboardEpl, "АПЛ", "purple")}
                    {renderLeaderboardTable(leaderboardUcl, "Ліга Чемпіонів", "blue")}
                  </div>
              )}
            </div>
          </main>
        </div>

        {/* МОДАЛЬНЕ ВІКНО ПЕРЕГЛЯДУ ПРОГНОЗІВ СУПЕРНИКА */}
        {selectedUser && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 z-50">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-xl p-4 sm:p-5 relative max-h-[85vh] flex flex-col shadow-2xl">
                <button
                    onClick={() => setSelectedUser(null)}
                    className="absolute top-3.5 right-3.5 text-gray-400 hover:text-white bg-gray-800/60 rounded-full w-7 h-7 flex items-center justify-center transition-all"
                >
                  ✕
                </button>
                <div className="mb-3">
                  <span className="text-[10px] font-bold text-green-400 uppercase tracking-widest">Прогнози учасника</span>
                  <h3 className="text-base sm:text-lg font-black text-white">👤 {selectedUser.user_email.split('@')[0]}</h3>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                  {loadingUserPreds ? (
                      <div className="text-center text-gray-400 py-10 text-xs font-semibold">Завантаження прогнозів...</div>
                  ) : Object.keys(selectedUserPreds).length === 0 ? (
                      <div className="text-center text-gray-500 py-12 border border-dashed border-gray-800 rounded-xl text-xs">
                        Цей гравець ще не зробив жодного прогнозу.
                      </div>
                  ) : (
                      matches
                          .filter(match => selectedUserPreds[match.id])
                          .sort((a, b) => {
                            const isAFinished = a.status === 'finished';
                            const isBFinished = b.status === 'finished';
                            if (isAFinished !== isBFinished) {
                              return isAFinished ? 1 : -1;
                            }
                            return new Date(a.start_time) - new Date(b.start_time);
                          })
                          .map(match => (
                              <MatchCard
                                  key={match.id}
                                  match={match}
                                  userPrediction={selectedUserPreds[match.id]}
                                  isReadOnly={true}
                              />
                          ))
                  )}
                </div>
              </div>
            </div>
        )}
      </div>
  );
}