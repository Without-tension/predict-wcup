import os
import requests
from supabase import create_client, Client

# Налаштування Supabase
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip()
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# Твій робочий стандартний API ключ з image_a6a020.png
THE_ODDS_API_KEY = "0e12fe136a3131cc54933f95157b3b69"
SPORT_KEY = "soccer_fifa_world_cup"

def sync_upcoming_matches():
    """Стягує майбутні матчі ЧС-2026 та актуальні коефіцієнти Pinnacle"""
    url = f"https://api.the-odds-api.com/v4/sports/{SPORT_KEY}/odds/"
    params = {
        "apiKey": THE_ODDS_API_KEY,
        "regions": "eu",
        "markets": "h2h",
        "bookmakers": "pinnacle",
        "oddsFormat": "decimal"
    }
    
    print("📡 Отримуємо розклад та коефіцієнти ЧС-2026 з The Odds API...")
    try:
        response = requests.get(url, params=params).json()
        if "error" in response or not isinstance(response, list):
            print(f"⚠️ Помилка отримання коефіцієнтів: {response}")
            return
            
        print(f"📋 Знайдено {len(response)} матчів ЧС-2026 у лінії. Синхронізуємо...")
        
        for match in response:
            home_team = match.get("home_team")
            away_team = match.get("away_team")
            start_time = match.get("commence_time")
            match_id = match.get("id")
            
            # Генеруємо числовий ID на основі стрінги від API для нашої бази Supabase
            db_id = hash(match_id) % 1000000
            
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

            try:
                supabase.table("matches").upsert(match_data).execute()
                print(f"⚽ Записано: {home_team} vs {away_team} -> ({home_odds} | {draw_odds} | {away_odds})")
            except Exception as e:
                print(f"⚠️ Помилка Supabase при запису матчу: {e}")
                
    except Exception as e:
        print(f"⚠️ Помилка запиту ліній: {e}")

def sync_completed_results():
    """Стягує завершені результати матчів ЧС-2026 для закриття прогнозів"""
    url = f"https://api.the-odds-api.com/v4/sports/{SPORT_KEY}/scores/"
    params = {
        "apiKey": THE_ODDS_API_KEY,
        "daysFrom": 3 # Перевіряє матчі за останні 3 дні
    }
    
    print("\n📡 Перевіряємо наявність завершених матчів ЧС-2026 для оновлення рахунку...")
    try:
        response = requests.get(url, params=params).json()
        if "error" in response or not isinstance(response, list):
            print(f"⚠️ Помилка отримання результатів: {response}")
            return
            
        for match in response:
            if match.get("completed", False):
                home_team = match.get("home_team")
                away_team = match.get("away_team")
                match_id = match.get("id")
                db_id = hash(match_id) % 1000000
                
                scores = match.get("scores", [])
                home_score = None
                away_score = None
                
                if scores:
                    home_score = next((int(s["score"]) for s in scores if s["name"] == home_team), None)
                    away_score = next((int(s["score"]) for s in scores if s["name"] == away_team), None)
                
                if home_score is not None and away_score is not None:
                    result_data = {
                        "id": db_id,
                        "status": "finished",
                        "home_score": home_score,
                        "away_score": away_score
                    }
                    try:
                        supabase.table("matches").update(result_data).eq("id", db_id).execute()
                        print(f"🏁 МАТЧ ЗАВЕРШЕНО: {home_team} {home_score}:{away_score} {away_team} -> Результат внесено!")
                    except Exception as e:
                        print(f"⚠️ Помилка оновлення рахунку в Supabase: {e}")
    except Exception as e:
        print(f"⚠️ Помилка запису результатів: {e}")

def main():
    print("🏆 ЗАПУСК ПОВНОЇ СИНХРОНІЗАЦІЇ ЧЕМПІОНАТУ СВІТУ 2026 🏆")
    # 1. Завантажуємо нові матчі та оновлюємо коефіцієнти букмекерів
    sync_upcoming_matches()
    
    # 2. Перевіряємо і проставляємо рахунок для ігор, які вже завершилися
    sync_completed_results()
    
    print("\n🎉 Синхронізацію ЧС-2026 повністю виконано!")

if __name__ == "__main__":
    main()