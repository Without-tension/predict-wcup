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
from supabase import create_client, Client

# Налаштування Supabase
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip()
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# Ключ від The Odds API
THE_ODDS_API_KEY = "0e12fe136a3131cc54933f95157b3b69"

def fetch_real_odds_from_any_soccer():
    # Запитуємо загальний футбол (all soccer), щоб обійти помилку UNKNOWN_SPORT
    url = f"https://api.the-odds-api.com/v4/sports/soccer/odds/?apiKey={THE_ODDS_API_KEY}&regions=eu&markets=h2h"
    
    print("📡 Надсилаємо запит до глобальної бази футболу...")
    try:
        response = requests.get(url).json()
        
        if "error" in response or not isinstance(response, list):
            print(f"⚠️ Помилка The Odds API: {response}")
            return None
            
        print(f"📋 Отримано {len(response)} матчів з усього світу. Шукаємо фінал ЛЧ...")
        
        for match in response:
            home_team = match.get("home_team", "")
            away_team = match.get("away_team", "")
            
            # Шукаємо саме лондонський Арсенал або ПСЖ
            if "Arsenal" in home_team or "Arsenal" in away_team or "Paris" in home_team or "Paris" in away_team:
                bookmakers = match.get("bookmakers", [])
                if not bookmakers: continue
                
                market = bookmakers[0].get("markets", [{}])[0]
                outcomes = market.get("outcomes", [])
                
                home_odds = next((o["price"] for o in outcomes if o["name"] == home_team), None)
                away_odds = next((o["price"] for o in outcomes if o["name"] == away_team), None)
                draw_odds = next((o["price"] for o in outcomes if o["name"] in ["Draw", "draw"]), None)
                
                return {
                    "id": match.get("id"),
                    "home_team": home_team,
                    "away_team": away_team,
                    "start_time": match.get("commence_time"),
                    "home_odds": home_odds,
                    "draw_odds": draw_odds,
                    "away_odds": away_odds
                }
    except Exception as e:
        print(f"⚠️ Помилка парсингу: {e}")
        
    return None

def main():
    print("重新 Запуск синхронізації реальних коефіцієнтів (Універсальний Soccer фільтр)...")
    
    match_data = fetch_real_odds_from_any_soccer()
    
    if not match_data:
        print("❌ Не вдалося знайти матч Арсенал/ПСЖ у загальному списку. Можливо, на безкоштовному плані діє обмеження ліг.")
        return
        
    db_match = {
        "id": hash(match_data["id"]) % 1000000,
        "home_team": match_data["home_team"],
        "away_team": match_data["away_team"],
        "start_time": match_data["start_time"],
        "status": "scheduled",
        "home_odds": match_data["home_odds"],
        "draw_odds": match_data["draw_odds"],
        "away_odds": match_data["away_odds"]
    }
    
    try:
        supabase.table("matches").upsert(db_match).execute()
        print(f"🔥 РЕАЛЬНИЙ ФІНАЛ З КОЕФІЦІЄНТАМИ ЗАПИСАНО В БАЗУ!")
        print(f"🏆 {db_match['home_team']} vs {db_match['away_team']}")
        print(f"📊 Справжні коефіцієнти: {db_match['home_odds']} | {db_match['draw_odds']} | {db_match['away_odds']}")
    except Exception as e:
        print(f"⚠️ Помилка запису в Supabase: {e}")

if __name__ == "__main__":
    main()