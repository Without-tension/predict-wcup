import { useState } from 'react';
import { supabase } from './supabaseClient';

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    if (isSignUp) {
      // Реєстрація нового користувача
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) alert(error.message);
      else alert('Реєстрація успішна! Тепер ви можете увійти.');
    } else {
      // Вхід в акаунт
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) alert(error.message);
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 px-4 text-white">
      <div className="w-full max-w-md space-y-6 rounded-2xl bg-gray-900 p-8 shadow-xl border border-gray-800">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-green-400">
            🏆 PredictWCup
          </h2>
          <p className="mt-2 text-sm text-gray-400">
            {isSignUp ? 'Створіть акаунт для прогнозів' : 'Увійдіть, щоб робити предікти'}
          </p>
        </div>
        
        <form className="space-y-4" onSubmit={handleAuth}>
          <div>
            <label className="block text-sm font-medium text-gray-400">Email</label>
            <input
              type="email"
              required
              className="mt-1 w-full rounded-xl bg-gray-800 p-3 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400">Пароль</label>
            <input
              type="password"
              required
              className="mt-1 w-full rounded-xl bg-gray-800 p-3 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-green-600 p-3 font-semibold text-white hover:bg-green-500 transition-colors disabled:opacity-50 shadow-lg"
          >
            {loading ? 'Завантаження...' : isSignUp ? 'Зареєструватись' : 'Увійти'}
          </button>
        </form>
        
        <div className="text-center text-sm">
          <button 
            type="button"
            onClick={() => setIsSignUp(!isSignUp)} 
            className="text-green-400 hover:text-green-300 font-medium transition-colors"
          >
            {isSignUp ? 'Вже є акаунт? Увійти' : 'Немає акаунту? Зареєструватись'}
          </button>
        </div>
      </div>
    </div>
  );
}