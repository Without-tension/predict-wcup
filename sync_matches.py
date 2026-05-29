# import os
# import requests
# from supabase import create_client, Client

# # Налаштування Supabase (хмаринка GitHub Actions автоматично підставить їх із секретів)
# SUPABASE_URL = os.environ.get("SUPABASE_URL")
# SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") # Важливо: сервісний ключ, щоб оминати захист RLS
# supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# # Налаштування API-Football
# API_SPORTS_KEY = os.environ.get("API_SPORTS_KEY")
# HEADERS = {
#     "x-rapidapi-host": "v3.football.api-sports.io",
#     "x-rapidapi-key": API_SPORTS_KEY
# }

# def fetch_world_cup_matches():
#     # league=1 (World Cup), season=2026
#     url = "https://v3.football.api-sports.io/fixtures?league=1&season=2026"
#     response = requests.get(url, headers=HEADERS).json()
#     return response.get("response", [])

# def fetch_odds_for_fixture(fixture_id):
#     url = f"https://v3.football.api-sports.io/odds?fixture={fixture_id}"
#     response = requests.get(url, headers=HEADERS).json()
#     res_data = response.get("response", [])
    
#     if not res_data:
#         return None, None, None
    
#     # Беремо першого доступного букмекера (букмекер у списку містить коефіцієнти)
#     bookmakers = res_data[0].get("bookmakers", [])
#     if not bookmakers:
#         return None, None, None
        
#     # Шукаємо маркет "Match Winner" (1X2)
#     bets = bookmakers[0].get("bets", [])
#     for bet in bets:
#         if bet.get("id") == 1: # ID 1 — це зазвичай стандартний маркет 1X2
#             values = bet.get("values", [])
#             home_odds = next((float(v["odds"]) for v in values if v["value"] == "Home"), None)
#             draw_odds = next((float(v["odds"]) for v in values if v["value"] == "Draw"), None)
#             away_odds = next((float(v["odds"]) for v in values if v["value"] == "Away"), None)
#             return home_odds, draw_odds, away_odds
            
#     return None, None, None

# def main():
#     print("🔄 Запуск синхронізації матчів з API-Sports...")
#     fixtures = fetch_world_cup_matches()
#     print(f"Знайдено {len(fixtures)} матчів у календарі.")

#     for item in fixtures:
#         fixture = item.get("fixture", {})
#         teams = item.get("teams", {})
#         goals = item.get("goals", {})
        
#         fixture_id = fixture.get("id")
#         home_team = teams.get("home", {}).get("name")
#         away_team = teams.get("away", {}).get("name")
#         start_time = fixture.get("date") # Повертає в форматі ISO з таймзоною UTC
        
#         # Переводимо статус матчу з системи API-Sports у нашу спрощену
#         # FT, AET, PEN — означає матч завершено
#         api_status = fixture.get("status", {}).get("short")
#         db_status = "scheduled"
#         if api_status in ["FT", "AET", "PEN"]:
#             db_status = "finished"
#         elif api_status in ["1H", "HT", "2H", "ET", "P"]:
#             db_status = "live" # Про всяк випадок, якщо знадобиться

#         home_score = goals.get("home")
#         away_score = goals.get("away")

#         # Отримуємо коефіцієнти (пам'ятаємо, що вони з'являться за 7 днів до матчу)
#         home_odds, draw_odds, away_odds = fetch_odds_for_fixture(fixture_id)

#         # Формуємо дані для бази
#         match_data = {
#             "id": fixture_id, # Використовуємо ID з API як первинний ключ, щоб уникнути дублів
#             "home_team": home_team,
#             "away_team": away_team,
#             "start_time": start_time,
#             "status": db_status
#         }

#         # Оновлюємо рахунок лише якщо він є
#         if home_score is not None: match_data["home_score"] = home_score
#         if away_score is not None: match_data["away_score"] = away_score
        
#         # Оновлюємо коефіцієнти лише якщо API їх повернуло
#         if home_odds: match_data["home_odds"] = home_odds
#         if draw_odds: match_data["draw_odds"] = draw_odds
#         if away_odds: match_data["away_odds"] = away_odds

#         # Робимо UPSERT (якщо запису немає — створить, якщо є — оновить рахунок/коефіцієнти)
#         try:
#             supabase.table("matches").upsert(match_data).execute()
#         except Exception as e:
#             print(f"⚠️ Помилка запису матчу {fixture_id}: {e}")

#     print("✅ Синхронізацію успішно завершено!")

# if __name__ == "__main__":
#     main()


import os
import requests

API_SPORTS_KEY = os.environ.get("API_SPORTS_KEY", "").strip()
HEADERS = {
    "x-rapidapi-host": "v3.football.api-sports.io",
    "x-rapidapi-key": API_SPORTS_KEY
}

def scout_league(search_query):
    print(f"\n🔎 Пошук за запитом '{search_query}'...")
    url = f"https://v3.football.api-sports.io/leagues?search={search_query}"
    try:
        response = requests.get(url, headers=HEADERS).json()
        leagues = response.get("response", [])
        print(f"Знайдено турнірів: {len(leagues)}")
        
        for item in leagues:
            league = item.get("league", {})
            country = item.get("country", {}).get("name", "")
            print(f"🏆 ID: {league.get('id')} | Назва: {league.get('name')} | Тип: {league.get('type')} | Країна: {country}")
    except Exception as e:
        print(f"⚠️ Помилка під час пошуку '{search_query}': {e}")

def main():
    print("🚀 Запуск глобальної розвідки ідентифікаторів в API-Sports...")
    
    # 1. Шукаємо актуальний ID для Ліги Чемпіонів
    scout_league("Champions League")
    
    # 2. Шукаємо всі можливі варіації Чемпіонату Світу
    scout_league("World Cup")

if __name__ == "__main__":
    main()