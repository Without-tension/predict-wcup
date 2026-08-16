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

  const [loading, setLoading] = useState(() => !localStorage.getItem('cache_matches'));
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedUserPreds, setSelectedUserPreds] = useState({});

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
  };

  if (isAuthChecking) {
    return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400 text-sm">Завантаження...</div>;
  }

  if (!session) return <Auth />;

  const currentUserStats = leaderboard.find(player => player.user_id === session.user.id);

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

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans antialiased flex flex-col justify-between">
      <div>
        {/* ХЕДЕР З ВКЛАДКАМИ */}
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
          <div className="lg:col-span-2 order-2 lg:order-1">
            <AnimatePresence mode="wait">

              {/* АПЛ */}
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
                </motion.div>
              )}

              {/* ЛІГА ЧЕМПІОНІВ */}
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
                </motion.div>
              )}

              {/* МОЇ ПРОГНОЗИ */}
              {currentTab === 'my_profile' && (
                <motion.div key="profile" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                  <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl flex justify-between items-center">
                    <div>
                      <span className="text-[10px] text-gray-500 uppercase font-bold">Профіль</span>
                      <h3 className="text-base font-bold text-white">{session.user.email.split('@')[0]}</h3>
                    </div>
                    <div className="flex gap-2 text-center">
                      <div className="bg-gray-950 px-2.5 py-1 rounded-lg border border-gray-850">
                        <span className="text-[9px] text-gray-500 block">Бали</span>
                        <span className="text-xs font-black text-emerald-400">{currentUserStats?.total_points || 0}</span>
                      </div>
                      <div className="bg-gray-950 px-2.5 py-1 rounded-lg border border-gray-850">
                        <span className="text-[9px] text-gray-500 block">Кф</span>
                        <span className="text-xs font-black text-yellow-500">{Number(currentUserStats?.total_odds || 0).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-xs font-bold text-gray-400">Активні ({predictedMatches.length})</h3>
                    {predictedMatches.map(match => (
                      <MatchCard key={match.id} match={match} userPrediction={predictions[match.id]} onMakePrediction={handlePredict} />
                    ))}
                  </div>

                  {finishedMatches.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <h3 className="text-xs font-bold text-gray-400">Завершені ({finishedMatches.length})</h3>
                      {finishedMatches.map(match => (
                        <MatchCard key={match.id} match={match} userPrediction={predictions[match.id]} isReadOnly={true} />
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ТАБЛИЦЯ ЛІДЕРІВ */}
          <div className="space-y-4 order-1 lg:order-2">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 shadow-xl">
              <h2 className="text-sm font-black mb-3 text-gray-100 flex items-center gap-1.5">
                <span>📊</span> Таблиця лідерів
              </h2>
              <div className="space-y-1.5">
                <div className="grid grid-cols-12 text-[10px] font-bold text-gray-500 uppercase px-2 pb-1 border-b border-gray-800 text-center">
                  <span className="col-span-6 text-left">Гравець</span>
                  <span className="col-span-3">Бали</span>
                  <span className="col-span-3">Кф.</span>
                </div>
                {leaderboard.map((player, index) => (
                  <div key={player.user_id} onClick={() => handleUserClick(player)} className="grid grid-cols-12 items-center text-xs p-1.5 rounded-lg text-center cursor-pointer hover:bg-gray-800/60">
                    <div className="col-span-6 flex items-center gap-1.5 truncate text-left">
                      <span className="text-[10px] text-gray-500 font-bold">{index + 1}.</span>
                      <span className="truncate text-gray-200 font-semibold">{player.user_email.split('@')[0]}</span>
                    </div>
                    <span className="col-span-3 text-green-400 font-bold">{player.total_points}</span>
                    <span className="col-span-3 text-yellow-500 font-bold">{Number(player.total_odds).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* МОДАЛКА ПЕРЕГЛЯДУ ГРАВЦЯ */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg p-4 relative max-h-[85vh] flex flex-col">
            <button onClick={() => setSelectedUser(null)} className="absolute top-3 right-3 text-gray-400 hover:text-white">✕</button>
            <h3 className="text-base font-bold text-white mb-3">👤 {selectedUser.user_email.split('@')[0]}</h3>
            <div className="flex-1 overflow-y-auto space-y-2">
              {matches.map(match => {
                if (!selectedUserPreds[match.id]) return null;
                return <MatchCard key={match.id} match={match} userPrediction={selectedUserPreds[match.id]} isReadOnly={true} />;
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}