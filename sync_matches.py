import os
import requests
import hashlib
from supabase import create_client, Client

# Налаштування Supabase
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip()
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

THE_ODDS_API_KEY = "0e12fe136a3131cc54933f95157b3b69"

# Списоку ліг для синхронізації: ЧС-2026 + Бразилія Серія Б
SPORTS_KEYS = ["soccer_fifa_world_cup", "soccer_brazil_campeonato_seria_b"]

def generate_stable_id(api_id_str):
    """Генерує стабільний числовий ID на основі MD5, який не змінюється між запусками"""
    return int(hashlib.md5(api_id_str.encode('utf-8')).hexdigest(), 16) % 1000000

def sync_upcoming_matches(sport_key):
    url = f"https://api.the-odds-api.com/v4/sports/{sport_key}/odds/"
    params = {
        "apiKey": THE_ODDS_API_KEY,
        "regions": "eu",
        "markets": "h2h",
        "bookmakers": "pinnacle",
        "oddsFormat": "decimal"
    }
    
    print(f"📡 Отримуємо розклад та коефіцієнти для {sport_key}...")
    try:
        response = requests.get(url, params=params).json()
        if "error" in response or not isinstance(response, list):
            print(f"⚠️ Помилка ліги {sport_key}: {response}")
            return
            
        print(f"📋 Знайдено {len(response)} матчів. Синхронізуємо...")
        
        for match in response:
            home_team = match.get("home_team")
            away_team = match.get("away_team")
            start_time = match.get("commence_time")
            match_id = match.get("id")
            
            # Залізобетонний стабільний ID
            db_id = generate_stable_id(match_id)
            
            home_odds, draw_odds, away_odds = None, None, None
            bookmakers = match.get("bookmakers", [])
            
            if bookmakers:
                markets = bookmakers[0].get("markets", [])
                if markets:
                    outcomes = markets[0].get("outcomes", [])
                    for outcome in outcomes:
                        name = outcome.get("name", "")
                        price = outcome.get("price")
                        if name == home_team: home_odds = float(price)
                        elif name == away_team: away_odds = float(price)
                        elif name in ["Draw", "draw", "X"]: draw_odds = float(price)

            match_data = {
                "id": db_id,
                "home_team": home_team,
                "away_team": away_team,
                "start_time": start_time,
                "status": "scheduled",
                "home_odds": home_odds,
                "draw_odds": draw_odds,
                "away_odds": away_odds
            }

            # Надійний upsert: якщо ID вже є — перезапише коефіцієнти, а не створить дубль
            supabase.table("matches").upsert(match_data).execute()
            print(f"✅ Синхронізовано: {home_team} vs {away_team} -> ({home_odds} | {draw_odds} | {away_odds})")
                
    except Exception as e:
        print(f"⚠️ Помилка запису ліній {sport_key}: {e}")

def sync_completed_results(sport_key):
    url = f"https://api.the-odds-api.com/v4/sports/{sport_key}/scores/"
    params = {
        "apiKey": THE_ODDS_API_KEY,
        "daysFrom": 3
    }
    
    print(f"\n📡 Перевірка результатів для {sport_key}...")
    try:
        response = requests.get(url, params=params).json()
        if "error" in response or not isinstance(response, list):
            return
            
        for match in response:
            if match.get("completed", False):
                home_team = match.get("home_team")
                away_team = match.get("away_team")
                match_id = match.get("id")
                db_id = generate_stable_id(match_id)
                
                scores = match.get("scores", [])
                home_score, away_score = None, None
                
                if scores:
                    home_score = next((int(s["score"]) for s in scores if s["name"] == home_team), None)
                    away_score = next((int(s["score"]) for s in scores if s["name"] == away_team), None)
                
                if home_score is not None and away_score is not None:
                    # Оновлюємо статус матчу в базі
                    supabase.table("matches").update({
                        "status": "finished",
                        "home_score": home_score,
                        "away_score": away_score
                    }).eq("id", db_id).execute()
                    print(f"🏁 Фініш: {home_team} {home_score}:{away_score} {away_team}")
                    
                    # АВТОМАТИЧНИЙ ПІДРАХУНОК БАЛІВ ДЛЯ ЛІДЕРБОРДУ
                    calculate_user_points(db_id, home_score, away_score, home_odds, draw_odds, away_odds)
                    
    except Exception as e:
        print(f"⚠️ Помилка результатів {sport_key}: {e}")

def calculate_user_points(match_id, real_home, real_away, home_odds, draw_odds, away_odds):
    """
    Сканує всі прогнози користувачів на цей матч, рахує бали та заносить у лідерборд.
    Логіка: Вгаданий результат (1Х2) = 1 бал + додається коефіцієнт у статистику контори.
    """
    try:
        # Тягнемо всі прогнози на цей матч із таблиці 'predictions'
        predictions = supabase.table("predictions").select("*").eq("match_id", match_id).execute().data
        
        # Визначаємо реальний результат матчу (Home, Away, Draw)
        if real_home > real_away: real_res = "Home"
        elif real_away > real_home: real_res = "Away"
        else: real_res = "Draw"
        
        for pred in predictions:
            user_id = pred.get("user_id")
            user_pick = pred.get("prediction") # Наприклад: 'Home', 'Away', 'Draw'
            
            if user_pick == real_res:
                # Визначаємо, який саме коефіцієнт вгадав гравець
                winning_odds = 0.0
                if real_res == "Home": winning_odds = home_odds or 0.0
                elif real_res == "Away": winning_odds = away_odds or 0.0
                else: winning_odds = draw_odds or 0.0
                
                # Оновлюємо таблицю лідерів користувача (додаємо 1 вгаданий, +1 до балів, +кеф)
                # Припускаємо, що у тебе таблиця лідерборду називається 'leaderboard' або 'profiles'
                # Скрипт робить інкремент значень у базі
                user_stats = supabase.table("profiles").select("*").eq("id", user_id).execute().data
                if user_stats:
                    current = user_stats[0]
                    supabase.table("profiles").update({
                        "won_predictions": (current.get("won_predictions") or 0) + 1,
                        "points": (current.get("points") or 0) + 1,
                        "total_odds": float(current.get("total_odds") or 0.0) + float(winning_odds)
                    }).eq("id", user_id).execute()
    except Exception as e:
        print(f"⚠️ Помилка підрахунку балів лідерборду: {e}")

def main():
    print("🚀 СТАРТ АВТОНОМНОЇ СИНХРОНІЗАЦІЇ ЧС-2026 + БРАЗИЛІЯ Б 🚀")
    for sport in SPORTS_KEYS:
        sync_upcoming_matches(sport)
        sync_completed_results(sport)
    print("\n🎉 Усі процеси оновлено автоматично!")

if __name__ == "__main__":
    main()