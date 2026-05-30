import os
import requests
from supabase import create_client, Client

# Налаштування Supabase
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip()
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

WIDGET_ACCESS_KEY = "wk_23a08ac1919398912664ec5437ac4fe4"

def fetch_games_from_widget(sport_key):
    url = f"https://widget.the-odds-api.com/v1/sports/{sport_key}/events/"
    params = {
        "accessKey": WIDGET_ACCESS_KEY,
        "bookmakerKeys": "pinnacle",
        "oddsFormat": "decimal",
        "markets": "h2h"
    }
    
    # Маскуємося під звичайний браузер, щоб сервер віджета не блокував скрипт
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Origin": "https://widget.the-odds-api.com",
        "Referer": "https://widget.the-odds-api.com/"
    }
    
    print(f"📡 Запит даних віджета для ліги: {sport_key}...")
    try:
        response = requests.get(url, params=params, headers=headers)
        
        # Якщо сервер повернув помилку доступу
        if response.status_code != 200:
            print(f"⚠️ Сервер повернув статус {response.status_code}. Доступ обмежено.")
            return []
            
        data = response.json()
        
        # Перевіряємо різні варіанти структури відповіді віджета
        if isinstance(data, dict):
            if "data" in data: return data["data"]
            if "events" in data: return data["events"]
            return [data] if "home_team" in data else []
        elif isinstance(data, list):
            return data
            
        return []
    except Exception as e:
        print(f"⚠️ Помилка отримання даних: {e}")
        return []

def sync_league_data(sport_key):
    games = fetch_games_from_widget(sport_key)
    if not games:
        print(f"❌ Не вдалося розпарсити ігри для {sport_key}")
        return

    print(f"📋 Знайдено матчів: {len(games)}. Записуємо в базу...")
    
    for game in games:
        home_team = game.get("home_team") or game.get("homeTeam")
        away_team = game.get("away_team") or game.get("awayTeam")
        start_time = game.get("commence_time") or game.get("commenceTime")
        game_id = game.get("id")
        
        if not home_team or not away_team:
            continue

        db_id = hash(str(game_id or home_team)) % 1000000

        home_odds, draw_odds, away_odds = None, None, None
        bookmakers = game.get("bookmakers", [])
        
        if bookmakers:
            # Віджет може повертати або список маркетів, або відразу результати
            markets = bookmakers[0].get("markets", [])
            if markets:
                outcomes = markets[0].get("outcomes", [])
                for outcome in outcomes:
                    name = outcome.get("name", "")
                    price = outcome.get("price") or outcome.get("odds")
                    if price:
                        if name == home_team: home_odds = float(price)
                        elif name == away_team: away_odds = float(price)
                        elif name in ["Draw", "draw", "X", "Нічия"]: draw_odds = float(price)

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
            print(f"✅ Успішно додано: {home_team} vs {away_team} -> ({home_odds or '—'} | {draw_odds or '—'} | {away_odds or '—'})")
        except Exception as e:
            print(f"⚠️ Помилка Supabase: {e}")

def main():
    print("🚀 СТАРТ ЗАХИЩЕНОЇ СИНХРОНІЗАЦІЇ (ЛЧ + ЧС)...")
    sync_league_data("soccer_uefa_champs_league")
    sync_league_data("soccer_fifa_world_cup")
    print("🎉 Синхронізацію завершено!")

if __name__ == "__main__":
    main()