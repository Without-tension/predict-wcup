import os
import requests
import hashlib
from datetime import datetime, timezone, timedelta
from supabase import create_client, Client

# Налаштування Supabase
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip()
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

THE_ODDS_API_KEY = "0e12fe136a3131cc54933f95157b3b69"
SPORTS_KEYS = ["soccer_fifa_world_cup"]

def generate_stable_id(api_id_str):
    return int(hashlib.md5(api_id_str.encode('utf-8')).hexdigest(), 16) % 1000000

# 🌟 Функція для перевірки, чи є матч частиною плей-офф (Починаючи з 28.06.2026 22:00 Київ / 19:00 UTC)
def is_playoff_match(start_time_str):
    try:
        # API повертає час у форматі ISO (UTC), наприклад: 2026-06-28T19:00:00Z
        match_time = datetime.fromisoformat(start_time_str.replace('Z', '+00:00'))
        # 22:00 за Києвом влітку (UTC+3) — це рівно 19:00 UTC
        playoff_start_utc = datetime(2026, 6, 28, 19, 0, 0, tzinfo=timezone.utc)
        return match_time >= playoff_start_utc
    except Exception:
        return False

def sync_upcoming_matches(sport_key):
    url = f"https://api.the-odds-api.com/v4/sports/{sport_key}/odds/"
    params = {
        "apiKey": THE_ODDS_API_KEY, "regions": "eu", "markets": "h2h", "bookmakers": "pinnacle", "oddsFormat": "decimal"
    }
    
    print(f"📡 Отримуємо розклад та коефіцієнти для ліги: {sport_key}...")
    try:
        response = requests.get(url, params=params).json()
        if "error" in response or not isinstance(response, list):
            return
            
        for match in response:
            home_team = match.get("home_team")
            away_team = match.get("away_team")
            start_time = match.get("commence_time")
            db_id = generate_stable_id(match.get("id"))
            
            bookmakers = match.get("bookmakers", [])
            home_odds, draw_odds, away_odds = None, None, None
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

            existing = supabase.table("matches") \
                .select("*") \
                .eq("home_team", home_team) \
                .eq("away_team", away_team) \
                .eq("start_time", start_time) \
                .execute().data
                
            if existing and any(m.get("status") == "finished" for m in existing):
                continue

            match_data = {
                "id": existing[0].get("id") if existing else db_id, 
                "home_team": home_team, 
                "away_team": away_team, 
                "start_time": start_time,
                "status": "scheduled", 
                "home_odds": home_odds, 
                "draw_odds": draw_odds, 
                "away_odds": away_odds
            }
            
            supabase.table("matches").upsert(
                match_data, 
                on_conflict="home_team,away_team,start_time"
            ).execute()
            
        print(f"✅ Лінії для {sport_key} успішно оновлено.")
    except Exception as e:
        print(f"⚠️ Помилка ліній {sport_key}: {e}")

def sync_completed_results(sport_key):
    url = f"https://api.the-odds-api.com/v4/sports/{sport_key}/scores/"
    try:
        response = requests.get(url, params={"apiKey": THE_ODDS_API_KEY, "daysFrom": 3}).json()
        if isinstance(response, list):
            for match in response:
                if match.get("completed", False):
                    home_team = match.get("home_team")
                    away_team = match.get("away_team")
                    scores = match.get("scores", [])
                    
                    if scores:
                        h_score = next((int(s["score"]) for s in scores if s["name"] == home_team), None)
                        a_score = next((int(s["score"]) for s in scores if s["name"] != home_team), None)
                        
                        if h_score is not None and a_score is not None:
                            find_and_update_match(home_team, away_team, h_score, a_score, f"API ({sport_key})")
    except Exception as e:
        print(f"⚠️ Помилка авто-результатів: {e}")

def find_and_update_match(home_team, away_team, home_score, away_score, source):
    try:
        db_matches = supabase.table("matches").select("*").eq("home_team", home_team).eq("away_team", away_team).eq("status", "scheduled").execute().data
        if not db_matches:
            return

        target_match = db_matches[0]
        db_id = target_match["id"]

        try:
            supabase.table("matches").update({
                "status": "finished", 
                "home_score": home_score, 
                "away_score": away_score
            }).eq("id", db_id).execute()
            print(f"🔥 АВТО-ОБНОВЛЕННЯ: {home_team} vs {away_team} -> Рахунок {home_score}:{away_score} ({source})")
            calculate_user_points(db_id, home_score, away_score, target_match.get("start_time"))
        except Exception as db_err:
            print(f"⚠️ База даних заблокувала запис результату для {home_team}: {db_err}")
            
    except Exception as e:
        print(f"⚠️ Помилка закриття матчу {home_team}: {e}")

def calculate_user_points(match_id, real_home, real_away, start_time):
    # Оскільки таблиця leaderboard є віртуальним представленням (View),
    # всі бали розраховуються базою даних автоматично на льоту.
    # Ця функція залишається порожньою для збереження структури викликів.
    pass

def main():
    print("🏆 ЗАПУСК АВТОНОМНОЇ СИНХРОНІЗАЦІЇ РЕЗУЛЬТАТІВ 🏆")
    for sport in SPORTS_KEYS:
        sync_upcoming_matches(sport)
        sync_completed_results(sport)
    print("\n🎉 Все синхронізовано!")

if __name__ == "__main__":
    main()

try:
    supabase.table("system_status").upsert({"id": 1, "last_sync": "now()"}).execute()
    print("⏰ Час останньої синхронізації успішно оновлено в базі!")
except Exception as e:
    print(f"Не вдалося оновити таймер у базі: {e}")