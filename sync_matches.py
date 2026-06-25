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
                    
                    # Для плей-офф нам також важливо знати, хто став підсумковим переможцем матчу (пройшов далі)
                    # The-odds-api у полі "score" зазвичай віддає результат після 90 хвилин.
                    if scores:
                        h_score = next((int(s["score"]) for s in scores if s["name"] == home_team), None)
                        a_score = next((int(s["score"]) for s in scores if s["name"] != home_team), None)
                        
                        # API результатів також може містити інформацію про фінального winner
                        # Якщо у вашому API немає кубкового проходу, виставимо логіку безпечного оновлення
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
    try:
        match_data = supabase.table("matches").select("*").eq("id", match_id).execute().data
        if not match_data: return
        match = match_data[0]
        
        home_odds = match.get("home_odds") or 1.0
        draw_odds = match.get("draw_odds") or 1.0
        away_odds = match.get("away_odds") or 1.0

        # Визначаємо чистий результат після 90 хвилин
        real_res = "1" if real_home > real_away else ("2" if real_away > real_home else "X")
        
        # Перевіряємо чи це матч плей-офф
        is_playoff = is_playoff_match(start_time)

        predictions = supabase.table("predictions").select("*").eq("match_id", match_id).execute().data
        if not predictions: return

        for pred in predictions:
            user_id = pred.get("user_id")
            user_choice = pred.get("user_choice")
            
            points_to_add = 0
            is_correct_prediction = False
            winning_odds = 1.0

            if not is_playoff:
                # 🔵 ЗВИЧАЙНА ЛОГІКА ГРУПОВОГО ЕТАПУ (1 бал)
                if user_choice == real_res:
                    points_to_add = 1
                    is_correct_prediction = True
                    winning_odds = home_odds if real_res == "1" else (away_odds if real_res == "2" else draw_odds)
            else:
                # 🏆 КУБКОВА ЛОГІКА ПЛЕЙ-ОФФ (Починаючи з 28 числа)
                if real_res in ["1", "2"]:
                    # Якщо в основний час хтось переміг, нараховуємо 2 бали
                    if user_choice == real_res:
                        points_to_add = 2
                        is_correct_prediction = True
                        winning_odds = home_odds if real_res == "1" else away_odds
                elif real_res == "X":
                    # Якщо зафіксовано нічию (X), перевіряємо вибір проходу (X-1 або X-2)
                    if user_choice and user_choice.startswith("X"):
                        # За саму нічию гарантовано даємо 1 бал
                        points_to_add = 1
                        is_correct_prediction = True
                        winning_odds = draw_odds
                        
                        # ⚠️ Примітка щодо проходу в плей-офф:
                        # Оскільки офіційне API результатів odds-api віддає рахунок лише за 90 хвилин,
                        # якщо матч закінчився внічию, адмін у Supabase вручну вкаже рахунок екстра-таймів / пенальті,
                        # або ви можете перевірити переможця. Наразі, щоб нічого не зламати, якщо вибір починається з X, 
                        # користувач отримує базовий 1 бал. Якщо ви вносите в базу фінального переможця, можна додати додаткову перевірку тут.

            if is_correct_prediction and points_to_add > 0:
                leader_entry = supabase.table("leaderboard").select("*").eq("user_id", user_id).execute().data
                
                if leader_entry:
                    current = leader_entry[0]
                    supabase.table("leaderboard").update({
                        "total_predictions": (current.get("total_predictions") or 0) + 1,
                        "total_points": (current.get("total_points") or 0) + points_to_add, # Нараховуємо динамічні бали (1 або 2)
                        "total_odds": float(current.get("total_odds") or 0.0) + float(winning_odds)
                    }).eq("user_id", user_id).execute()

    except Exception as e:
        print(f"⚠️ Помилка лідерборду: {e}")

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