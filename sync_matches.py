import os
import requests
from supabase import create_client, Client

# Налаштування Supabase
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip()
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# Твій публічний ключ для віджетів
WIDGET_ACCESS_KEY = "wk_23a08ac1919398912664ec5437ac4fe4"

def fetch_games_from_widget(sport_key):
    """Стягує матчі та коефіцієнти прямо через ендпоінт віджета"""
    url = f"https://widget.the-odds-api.com/v1/sports/{sport_key}/events/"
    params = {
        "accessKey": WIDGET_ACCESS_KEY,
        "bookmakerKeys": "pinnacle",
        "oddsFormat": "decimal",
        "markets": "h2h"
    }
    
    print(f"📡 Запит даних віджета для ліги: {sport_key}...")
    try:
        response = requests.get(url, params=params).json()
        # Ендпоінт віджетів зазвичай повертає список або об'єкт з полем 'data' чи 'events'
        # Перевіримо структуру відповіді
        if isinstance(response, dict) and "data" in response:
            return response["data"]
        elif isinstance(response, list):
            return response
        else:
            print(f"📋 Відповідь сервера: {response}")
            return response.get("events", []) if isinstance(response, dict) else []
    except Exception as e:
        print(f"⚠️ Помилка запиту до віджета {sport_key}: {e}")
        return []

def sync_league_data(sport_key):
    games = fetch_games_from_widget(sport_key)
    if not games:
        print(f"❌ Немає доступних ігор або лінії для {sport_key}")
        return

    print(f"📋 Знайдено матчів: {len(games)}. Синхронізуємо з Supabase...")
    
    for game in games:
        # Парсимо назви команд і час
        home_team = game.get("home_team") or game.get("homeTeam")
        away_team = game.get("away_team") or game.get("awayTeam")
        start_time = game.get("commence_time") or game.get("commenceTime")
        game_id = game.get("id")
        
        if not home_team or not away_team:
            continue

        # Формуємо числовий ID для бази
        db_id = hash(str(game_id or home_team)) % 1000000

        # Витягуємо коефіцієнти букмекера
        home_odds, draw_odds, away_odds = None, None, None
        bookmakers = game.get("bookmakers", [])
        
        if bookmakers:
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
            print(f"✅ Записано: {home_team} vs {away_team} -> ({home_odds} | {draw_odds} | {away_odds})")
        except Exception as e:
            print(f"⚠️ Помилка Supabase для матчу {db_id}: {e}")

def main():
    print("🚀 СТАРТ СИНХРОНІЗАЦІЇ ЧЕРЕЗ WIDGET ENDPOINT (ЛЧ + ЧС)...")
    
    # 1. Синхронізуємо Лігу Чемпіонів (Фінал)
    sync_league_data("soccer_uefa_champs_league")
    
    # 2. Синхронізуємо Чемпіонат Світу
    sync_league_data("soccer_fifa_world_cup")
    
    print("🎉 Глобальну синхронізацію успішно завершено!")

if __name__ == "__main__":
    main()