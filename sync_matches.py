import os
import requests
import hashlib
from datetime import datetime, timezone
from supabase import create_client, Client

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip()
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

THE_ODDS_API_KEY = "0e12fe136a3131cc54933f95157b3b69"

# 🏆 Додаємо ключі ліг та їх внутрішні мітки
SPORTS_CONFIG = [
    {"key": "soccer_epl", "league": "epl"},
    {"key": "soccer_uefa_champs_league", "league": "ucl"}
]


def generate_stable_id(api_id_str):
    return int(hashlib.md5(api_id_str.encode('utf-8')).hexdigest(), 16) % 1000000


def sync_upcoming_matches(sport_config):
    sport_key = sport_config["key"]
    league_name = sport_config["league"]

    url = f"https://api.the-odds-api.com/v4/sports/{sport_key}/odds/"
    params = {
        "apiKey": THE_ODDS_API_KEY, "regions": "eu", "markets": "h2h", "bookmakers": "pinnacle", "oddsFormat": "decimal"
    }

    print(f"📡 Отримуємо розклад для: {league_name.upper()} ({sport_key})...")
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
                        if name == home_team:
                            home_odds = float(price)
                        elif name == away_team:
                            away_odds = float(price)
                        elif name in ["Draw", "draw", "X"]:
                            draw_odds = float(price)

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
                "away_odds": away_odds,
                "league": league_name
            }

            supabase.table("matches").upsert(
                match_data,
                on_conflict="home_team,away_team,start_time"
            ).execute()

        print(f"✅ Матчі для {league_name.upper()} успішно оновлено.")
    except Exception as e:
        print(f"⚠️ Помилка ліній {sport_key}: {e}")


def sync_completed_results(sport_config):
    sport_key = sport_config["key"]
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
        print(f"⚠️ Помилка авто-результатів {sport_key}: {e}")


def find_and_update_match(home_team, away_team, home_score, away_score, source):
    try:
        db_matches = supabase.table("matches").select("*").eq("home_team", home_team).eq("away_team", away_team).eq(
            "status", "scheduled").execute().data
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
            print(f"🔥 АВТО-ОБНОВЛЕННЯ: {home_team} vs {away_team} -> {home_score}:{away_score} ({source})")
        except Exception as db_err:
            print(f"⚠️ Помилка запису результату: {db_err}")

    except Exception as e:
        print(f"⚠️ Помилка закриття матчу {home_team}: {e}")


def main():
    print("🏆 ЗАПУСК СИНХРОНІЗАЦІЇ (EPL & UCL) 🏆")
    for sport_config in SPORTS_CONFIG:
        sync_upcoming_matches(sport_config)
        sync_completed_results(sport_config)
    print("\n🎉 Все синхронізовано!")


if __name__ == "__main__":
    main()

try:
    supabase.table("system_status").upsert({"id": 1, "last_sync": "now()"}).execute()
except Exception as e:
    print(f"Не вдалося оновити таймер: {e}")