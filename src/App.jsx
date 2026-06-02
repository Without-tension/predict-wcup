import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Auth from './Auth';
import MatchCard from './MatchCard';
import SkeletonCard from './SkeletonCard';
import { motion, AnimatePresence } from 'framer-motion';

export default function App() {
  const [session, setSession] = useState(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  // Стейти для адмін-панелі скидання паролів
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

  // 🔥 Секретна функція зміни пароля адміном прямо через клієнтський API Supabase
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
    
    // Формуємо системний email фейкового акаунту
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
    return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400 text-sm font-semibold tracking-wider">Завантаження контенту...</div>;
  }

  if (!session) return <Auth />;

  // 🛡️ Перевірка: чи є поточний користувач адміном
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
    <div className="min-h-screen bg-gray-950 text-white font-sans antialiased flex flex-col justify-between">
      <div>
        <header className="flex justify-between items-center border-b border-gray-900 bg-gray-900/40 backdrop-blur px-6 py-4 sticky top-0 z-50">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏆</span>
            <h1 className="text-xl font-black text-green-400 tracking-wider uppercase">Predict World Cup</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400 bg-gray-900 px-3 py-1.5 rounded-xl border border-gray-800 font-semibold">
              👤 {session.user.email.split('@')[0]}
            </span>
            <button onClick={() => {
              localStorage.clear();
              supabase.auth.signOut();
            }} className="rounded-xl bg-red-600/10 text-red-400 border border-red-500/20 px-4 py-2 text-sm font-semibold hover:bg-red-600 hover:text-white transition-all cursor-pointer">
              Вийти
            </button>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* БЛОК МАТЧІВ */}
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
                <div className="flex flex-col">
                  <AnimatePresence mode="sync">
                    {unpredictedMatches.map((match) => (
                      <motion.div
                        key={match.id}
                        layout="position"
                        initial={{ opacity: 1 }}
                        exit={{ opacity: 0, transition: { type: "tween", ease: "easeInOut", duration: 0.6 } }}
                        transition={{ type: "tween", ease: "easeInOut", duration: 0.5 }}
                        className="w-full"
                      >
                        <MatchCard match={match} userPrediction={predictions[match.id]} onMakePrediction={handlePredict} />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {unpredictedMatches.length === 0 && (
                    <p className="text-sm text-gray-500 italic pl-4 py-4">🎉 Всі доступні прогнози заповнено!</p>
                  )}
                </div>

                {predictedMatches.length > 0 && (
                  <div className="pt-6 border-t border-gray-900/60">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-green-400 border-l-4 border-green-500 pl-3 mb-4">
                      ✅ Прогнози зроблено ({predictedMatches.length})
                    </h2>
                    <div className="flex flex-col">
                      <AnimatePresence mode="sync">
                        {predictedMatches.map((match) => (
                          <motion.div
                            key={match.id}
                            layout="position"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.8 }}
                            transition={{ type: "tween", ease: "easeInOut", duration: 0.4 }}
                            className="w-full"
                          >
                            <MatchCard match={match} userPrediction={predictions[match.id]} onMakePrediction={handlePredict} />
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </div>
                )}

                {finishedMatches.length > 0 && (
                  <div className="pt-6 border-t border-gray-900/60">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-red-400 border-l-4 border-red-500 pl-3 mb-4">
                      🏁 Завершені матчі ({finishedMatches.length})
                    </h2>
                    <div className="flex flex-col opacity-60">
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

          {/* ПРАВА КОЛОНКА */}
          <div className="space-y-6">
            {/* ТАБЛИЦЯ ЛІДЕРІВ */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 shadow-xl">
              <h2 className="text-lg font-black mb-4 tracking-tight text-gray-100">Таблиця лідерів</h2>
              <div className="space-y-2">
                <div className="grid grid-cols-12 text-xs font-bold text-gray-500 uppercase px-2 pb-2 border-b border-gray-800 text-center">
                  <span className="col-span-5 text-left">Гравець</span>
                  <span className="col-span-3">Враховано</span>
                  <span className="col-span-2">Бали</span>
                  <span className="col-span-2">Коеф.</span>
                </div>

                {loading && leaderboard.length === 0 ? (
                  <div className="space-y-2 pt-2 animate-pulse">
                    {[1, 2, 3].map((n) => (
                      <div key={n} className="grid grid-cols-12 items-center p-2">
                        <div className="col-span-5 flex items-center gap-2"><div className="h-4 bg-gray-800 rounded w-20"></div></div>
                        <div className="col-span-3 h-4 bg-gray-800 rounded w-8 mx-auto"></div>
                      </div>
                    ))}
                  </div>
                ) : (
                  leaderboard.map((player, index) => (
                    <div 
                      key={player.user_id} 
                      onClick={() => handleUserClick(player)}
                      className={`grid grid-cols-12 items-center text-sm p-2 rounded-xl transition-all text-center cursor-pointer hover:bg-gray-800/60 hover:scale-[1.02]
                        ${player.user_id === session.user.id ? 'bg-green-500/5 border border-green-500/20' : ''}`}
                    >
                      <div className="col-span-5 flex items-center gap-1.5 truncate text-left">
                        <span className="text-xs font-bold text-gray-500 w-4">{index + 1}.</span>
                        <span className="truncate font-semibold text-gray-300">{player.user_email.split('@')[0]}</span>
                      </div>
                      <span className="col-span-3 text-gray-400 font-semibold">{player.total_predictions}</span>
                      <span className="col-span-2 text-green-400 font-bold">{player.total_points}</span>
                      <span className="col-span-2 text-yellow-500 font-bold">{Number(player.total_odds).toFixed(2)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* 👑 СЕКРЕТНА АДМІН-ПАНЕЛЬ СКИДАННЯ ПАРОЛІВ (Опущена в самий низ) */}
      {isAdmin && (
        <footer className="w-full max-w-6xl mx-auto px-4 pb-8 mt-12">
          <div className="bg-gray-900 border border-red-900/30 rounded-2xl p-6 shadow-xl max-w-xl mx-auto">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">🛠️</span>
              <h3 className="text-sm font-black text-red-400 uppercase tracking-widest">
                Панель Адміністратора
              </h3>
            </div>
            <p className="text-xs text-gray-400 mb-4 leading-relaxed">
              Міняй паролі пацанам прямо звідси (зміна пароля через RPC на системний email).
            </p>
            <form onSubmit={handleAdminResetPassword} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
              <input
                type="text"
                placeholder="Логін (напр: ros)"
                value={adminTargetUser}
                onChange={(e) => setAdminTargetUser(e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-red-500"
              />
              <input
                type="text"
                placeholder="Новий пароль (мін. 6 знаків)"
                value={adminNewPassword}
                onChange={(e) => setAdminNewPassword(e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-red-500"
              />
              <button
                type="submit"
                disabled={adminLoading}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {adminLoading ? 'Оновлення...' : 'Змінити пароль'}
              </button>
            </form>
          </div>
        </footer>
      )}

      {/* WEB3 МОДАЛЬНЕ ВІКНО ПЕРЕГЛЯДУ */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl p-6 relative">
            <button onClick={() => setSelectedUser(null)} className="absolute top-4 right-4 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer">✕</button>
            <div className="mb-6">
              <p className="text-xs font-bold text-green-400 uppercase tracking-widest">Профіль гравця</p>
              <h3 className="text-2xl font-black text-white mt-1">{selectedUser.user_email.split('@')[0]}</h3>
              <div className="flex gap-4 mt-3 text-sm text-gray-400 bg-gray-950/60 p-3 rounded-xl border border-gray-850">
                <div>Враховано: <span className="text-white font-bold">{selectedUser.total_predictions}</span></div>
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