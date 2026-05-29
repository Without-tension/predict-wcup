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

def check_league_by_year(year):
    print(f"\n--- 📅 Сканування сезону {year} ---")
    url = f"https://v3.football.api-sports.io/leagues?season={year}"
    try:
        response = requests.get(url, headers=HEADERS).json()
        leagues = response.get("response", [])
        print(f"Отримано всього ліг: {len(leagues)}")
        
        found = False
        for item in leagues:
            league = item.get("league", {})
            league_name = league.get("name", "")
            country = item.get("country", {}).get("name", "")
            
            # Шукаємо ЧС або Кваліфікації ЧС
            if "world cup" in league_name.lower():
                print(f"🎯 Знайдено! ID: {league.get('id')} | Назва: {league_name} | Країна: {country}")
                found = True
        if not found:
            print("❌ У цьому році турнірів із назвою 'World Cup' не знайдено.")
    except Exception as e:
        print(f"Помилка запиту: {e}")

def main():
    print("🚀 Початок глобальної розвідки ідентифікаторів ЧС...")
    
    # Перевіряємо три роки, щоб точно знайти де заховані матчі
    check_league_by_year(2024)
    check_league_by_year(2025)
    check_league_by_year(2026)
    
    print("\n🔎 Додатково перевіримо, що взагалі лежить в league=1 за останні роки...")
    for y in [2024, 2025, 2026]:
        url = f"https://v3.football.api-sports.io/fixtures?league=1&season={y}"
        res = requests.get(url, headers=HEADERS).json()
        print(f"• league=1 & season={y} містить: {len(res.get('response', []))} матчів.")

if __name__ == "__main__":
    main()