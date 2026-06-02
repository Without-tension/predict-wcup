import os
import requests
import hashlib
from supabase import create_client, Client

# Налаштування Supabase
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip()
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

THE_ODDS_API_KEY = "0e12fe136a3131cc54933f95157b3b69"
SPORTS_KEYS = ["soccer_fifa_world_cup", "soccer_brazil_serie_b"]

def generate_stable_id(api_id_str):
    """Генерує стабільний числовий ID на основі MD5, який не змінюється між запусками"""
    return int(hashlib.md5(api_id_str.encode('utf-8')).hexdigest(), 16) % 1000000

def sync_upcoming_matches(sport_key):
    """Стягує майбутні матчі та актуальні коефіцієнти"""
    url = f"https://api.the-odds-api.com/v4/sports/{sport_key}/odds/"
    params = {
        "apiKey": THE_ODDS_API_KEY,
        "regions": "eu",
        "markets": "h2h",
        "bookmakers": "pinnacle",
        "oddsFormat": "decimal"
    }
    
    print(f"📡 Отримуємо розклад та коефіцієнти для ліги: {sport_key}...")
    try:
        response = requests.get(url, params=params).json()
        if "error" in response or not isinstance(response, list):
            print(f"⚠️ Помилка отримання ліній {sport_key}: {response}")
            return
            
        for match in response:
            home_team = match.get("home_team")
            away_team = match.get("away_team")
            start_time = match.get("commence_time")
            sport_title = match.get("sport_title")
            match_id = match.get("id")
            
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

            # Перевіряємо, чи цей матч уже є в базі, щоб випадково не затерти рахунок 'finished' матчу
            existing_match = supabase.table("matches").select("status").eq("id", db_id).execute().data
            if existing_match and existing_match[0].get("status") == "finished":
                continue # Пропускаємо оновлення кефів для вже зіграних матчів

            match_data = {
                "id": db_id,
                "home_team": home_team,
                "away_team": away_team,
                "start_time": start_time,
                "sport_title": sport_title,
                "status": "scheduled",
                "home_odds": home_odds,
                "draw_odds": draw_odds,
                "away_odds": away_odds
            }

            supabase.table("matches").upsert(match_data).execute()
        print(f"✅ Лінії для {sport_key} успішно оновлено.")
    except Exception as e:
        print(f"⚠️ Помилка запису ліній {sport_key}: {e}")

def sync_completed_results(sport_key):
    """Стягує РЕЗУЛЬТАТИ матчів через ендпоінт /scores та закриває прогнози"""
    url = f"https://api.the-odds-api.com/v4/sports/{sport_key}/scores/"
    params = {
        "apiKey": THE_ODDS_API_KEY,
        "daysFrom": 3 # Шукаємо завершені ігри за останні 3 дні
    }
    
    print(f"📡 Перевіряємо рахунки (Scores) для ліги: {sport_key}...")
    try:
        response = requests.get(url, params=params).json()
        if "error" in response or not isinstance(response, list):
            print(f"⚠️ Помилка отримання результатів {sport_key}: {response}")
            return
            
        for match in response:
            # Якщо провайдер зафіксував, що матч завершено
            if match.get("completed", False):
                home_team = match.get("home_team")
                away_team = match.get("away_team")
                match_id = match.get("id")
                db_id = generate_stable_id(match_id)
                
                scores = match.get("scores", [])
                home_score = None
                away_score = None
                
                if scores:
                    home_score = next((int(s["score"]) for s in scores if s["name"] == home_team), None)
                    away_score = next((int(s["score"]) for s in scores if s["name"] == away_team), None)
                
                if home_score is not None and away_score is not None:
                    # 1. Оновлюємо рахунок і статус матчу в таблиці 'matches'
                    supabase.table("matches").update({
                        "status": "finished",
                        "home_score": home_score,
                        "away_score": away_score
                    }).eq("id", db_id).execute()
                    
                    print(f"🏁 Зафіксовано фініш: {home_team} {home_score}:{away_score} {away_team}")
                    
                    # 2. Одразу запускаємо автоматичний підрахунок балів для цієї гри
                    calculate_user_points(db_id, home_score, away_score)
                    
    except Exception as e:
        print(f"⚠️ Помилка обробки результатів {sport_key}: {e}")

def calculate_user_points(match_id, real_home, real_away):
    """Сканує прогнози користувачів, рахує очки та оновлює лідерборд"""
    try:
        # Отримуємо сам матч, щоб знайти коефіцієнти
        match_data = supabase.table("matches").select("*").eq("id", match_id).execute().data
        if not match_data: return
        match = match_data[0]
        
        home_odds = match.get("home_odds") or 1.0
        draw_odds = match.get("draw_odds") or 1.0
        away_odds = match.get("away_odds") or 1.0

        # Визначаємо чистий підсумок гри за кодуванням вашої бази ('1', 'X', '2')
        if real_home > real_away: real_res = "1"
        elif real_away > real_home: real_res = "2"
        else: real_res = "X"
        
        # Тягнемо всі прогнози людей на цей конкретний матч
        predictions = supabase.table("predictions").select("*").eq("match_id", match_id).execute().data
        
        for pred in predictions:
            user_id = pred.get("user_id")
            user_choice = pred.get("user_choice")
            
            # Якщо користувач вгадав результат
            if user_choice == real_res:
                winning_odds = 0.0
                if real_res == "1": winning_odds = home_odds
                elif real_res == "2": winning_odds = away_odds
                elif real_res == "X": winning_odds = draw_odds

                # Оновлюємо лідерборд. Назви колонок взяті з твого App.jsx:
                # total_predictions (Вгадано), total_points (Бали), total_odds (Коеф.)
                leader_entry = supabase.table("leaderboard").select("*").eq("user_id", user_id).execute().data
                
                if leader_entry:
                    current = leader_entry[0]
                    supabase.table("leaderboard").update({
                        "total_predictions": (current.get("total_predictions") or 0) + 1,
                        "total_points": (current.get("total_points") or 0) + 1,
                        "total_odds": float(current.get("total_odds") or 0.0) + float(winning_odds)
                    }).eq("user_id", user_id).execute()
                    print(f"🥇 Нараховано бали користувачу {user_id} за коефіцієнт {winning_odds}")
                    
    except Exception as e:
        print(f"⚠️ Помилка підрахунку балів лідерборду: {e}")

def main():
    print("🏆 ЗАПУСК АВТОНОМНОЇ СИНХРОНІЗАЦІЇ КОЕФІЦІЄНТІВ ТА РЕЗУЛЬТАТІВ 🏆")
    for sport in SPORTS_KEYS:
        # Спочатку оновлюємо кефи для майбутніх ігор
        sync_upcoming_matches(sport)
        # Потім перевіряємо результати зіграних матчів
        sync_completed_results(sport)
    print("\n🎉 Усі автоматичні процеси успішно виконано!")

if __name__ == "__main__":
    main()