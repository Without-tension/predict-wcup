import { useState } from 'react';
import { supabase } from './supabaseClient';

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState(''); // Замість email тепер username
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  // 🕵️ Стейти для нашої пасхалки
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [showLohStep, setShowLohStep] = useState(false);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (!username.trim() || !password.trim()) {
      alert('Будь ласка, заповніть усі поля!');
      setLoading(false);
      return;
    }

    // 🔒 ПЕРЕТВОРЕННЯ: перетворюємо нікнейм на унікальний системний емейл для Supabase Auth
    const systemEmail = `${username.trim().toLowerCase()}@predict.wcup`;

    if (isSignUp) {
      // Реєстрація нового гравця
      const { error } = await supabase.auth.signUp({
        email: systemEmail,
        password: password,
      });
      if (error) alert(`Помилка реєстрації: ${error.message}`);
      else alert('Успішна реєстрація! Тепер ви можете увійти.');
    } else {
      // Вхід в систему
      const { error } = await supabase.auth.signInWithPassword({
        email: systemEmail,
        password: password,
      });
      if (error) alert(`Помилка входу: ${error.message}`);
    }
    setLoading(false);
  };

  // Функція закриття модалки та скидання її кроків
  const closeForgotModal = () => {
    setShowForgotModal(false);
    setShowLohStep(false);
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4 font-sans antialiased text-white relative">
      <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <span className="text-4xl">🏆</span>
          <h2 className="text-2xl font-black text-green-400 mt-2 uppercase tracking-wider">Predict World Cup</h2>
          <p className="text-sm text-gray-400 mt-1">
            {isSignUp ? 'Створення акаунту гравця' : 'Вхід на платформу прогнозів'}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
              Login
            </label>
            <input
              type="text"
              placeholder="не пошта, не номер телефону. Логін!"
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/\s+/g, ''))} // Забороняємо пробіли в ніку
              className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-500 transition-colors placeholder-gray-600"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400">
                Password
              </label>
              {/* 🔍 Маленька кнопка "забули пароль" */}
              {!isSignUp && (
                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  className="text-xs text-gray-500 hover:text-green-400 transition-colors cursor-pointer font-medium"
                >
                  Забули пароль?
                </button>
              )}
            </div>
            <input
              type="password"
              placeholder="тут 6 символів треба але не забудьте потім"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-500 transition-colors placeholder-gray-600"
            />
          </div>

          <button
            disabled={loading}
            type="submit"
            className="w-full bg-green-500 hover:bg-green-600 text-gray-950 font-bold py-3 rounded-xl transition-all shadow-lg shadow-green-500/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-sm"
          >
            {loading ? 'Завантаження...' : isSignUp ? 'Зареєструватися' : 'Увійти'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-xs text-gray-400 hover:text-green-400 font-semibold transition-colors cursor-pointer"
          >
            {isSignUp ? 'Вже є акаунт? Увійти' : 'Немає акаунту? Створити новий нікнейм'}
          </button>
        </div>
      </div>

      {/* 🛑 ПОВЕРХУ ВСЬОГО: Модальне вікно тролінгу */}
      {showForgotModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-gray-900 border border-red-500/30 rounded-2xl max-w-sm w-full p-6 text-center shadow-2xl relative">
            
            {!showLohStep ? (
              // КРОК 1: Питання про рагуля
              <>
                <div className="text-3xl mb-3">🤦‍♂️</div>
                <h3 className="text-base font-bold text-gray-200 leading-relaxed mb-6 px-2">
                  Ну ти шо рагуль... <span className="text-red-400">6 символів</span> забув?
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setShowLohStep(true)}
                    className="bg-red-600/10 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/20 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer"
                  >
                    Так
                  </button>
                  <button
                    onClick={closeForgotModal}
                    className="bg-gray-800 hover:bg-gray-700 text-gray-300 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer"
                  >
                    О всьо, згадав
                  </button>
                </div>
              </>
            ) : (
              // КРОК 2: Вердикт і редирект
              <>
                <div className="text-3xl mb-3">🤡</div>
                <h3 className="text-base font-bold text-gray-200 leading-relaxed mb-6 px-4">
                  Тоді йди створюй новий акаунт
                </h3>
                <button
                  onClick={() => {
                    setIsSignUp(true); // Перемикаємо головну форму на реєстрацію
                    closeForgotModal(); // Закриваємо модалку
                  }}
                  className="w-full bg-yellow-500 hover:bg-yellow-600 text-gray-950 font-black py-3 rounded-xl text-sm transition-all tracking-wide cursor-pointer uppercase"
                >
                  Лох
                </button>
              </>
            )}

          </div>
        </div>
      )}
    </div>
  );
}