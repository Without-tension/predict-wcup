import React from 'react';

// Повна база даних прапорів, включаючи всі проблемні країни з The Odds API
const worldCupFlags = {
  // Твої 11 країн з точними назвами з API
  "Bosnia & Herzegovina": "ba",
  "Haiti": "ht",
  "Turkey": "tr",
  "Curaçao": "cw",
  "Ivory Coast": "ci",
  "Cape Verde": "cv",
  "Norway": "no",
  "Iraq": "iq",
  "Jordan": "jo",
  "DR Congo": "cd",
  "Uzbekistan": "uz",

  // Решта країн ЧС-2026 та кваліфікації
  "Argentina": "ar", "Algeria": "dz", "Australia": "au", "Austria": "at",
  "Belgium": "be", "Brazil": "br", "Cameroon": "cm", "Canada": "ca",
  "Chile": "cl", "Colombia": "co", "Costa Rica": "cr", "Croatia": "hr",
  "Czech Republic": "cz", "Denmark": "dk", "Ecuador": "ec", "Egypt": "eg",
  "England": "gb-eng", "France": "fr", "Germany": "de", "Ghana": "gh",
  "Greece": "gr", "Iran": "ir", "Italy": "it", "Japan": "jp",
  "Mexico": "mx", "Morocco": "ma", "Netherlands": "nl", "New Zealand": "nz",
  "Nigeria": "ng", "Panama": "pa", "Paraguay": "py", "Peru": "pe",
  "Poland": "pl", "Portugal": "pt", "Qatar": "qa", "Saudi Arabia": "sa",
  "Scotland": "gb-sct", "Senegal": "sn", "Serbia": "rs", "South Africa": "za",
  "South Korea": "kr", "Spain": "es", "Sweden": "se", "Switzerland": "ch",
  "Tunisia": "tn", "Ukraine": "ua", "United States": "us", "Uruguay": "uy",
  "Wales": "gb-wls", "USA": "us"
};

const MatchCard = ({ match, userPrediction, onMakePrediction }) => {
  const { id, home_team, away_team, start_time, home_odds, draw_odds, away_odds } = match;

  // Форматування дати та часу (наприклад: "11 червня о 22:00")
  const formatMatchDate = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleString('uk-UA', {
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).replace(',', ' о');
  };

  // Функція рендеру прапора (Тільки для країн, клуби Серії Б ігноруються)
  const renderFlag = (teamName) => {
    const code = worldCupFlags[teamName];
    if (!code) return null; // Якщо це клуб, прапор не виводиться
    return (
      <img 
        src={`https://flagcdn.com/w40/${code}.png`} 
        alt={`${teamName} flag`} 
        className="country-flag"
      />
    );
  };

  return (
    <div className="match-card">
      <style>{`
        .match-card {
          max-width: 600px;
          margin: 12px auto;
          padding: 12px 16px;
          background-color: #1a1f2c;
          border-radius: 12px;
          border: 1px solid #2d3748;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
          font-family: system-ui, -apple-system, sans-serif;
        }
        .match-date-time {
          font-size: 13.5px;
          font-weight: 600;
          color: #94a3b8;
          text-align: center;
          margin-bottom: 10px;
        }
        .match-main-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .team-block {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 35%;
          font-size: 15px;
          font-weight: 500;
          color: #ffffff;
        }
        .team-block.home { justify-content: flex-start; }
        .team-block.away { justify-content: flex-end; }
        .country-flag {
          width: 26px;
          height: 18px;
          object-fit: cover;
          border-radius: 3px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
        }
        .odds-container {
          display: flex;
          gap: 6px;
          width: 30%;
          justify-content: center;
        }
        .odds-btn {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 6px 4px;
          background-color: #2d3748;
          border: 1px solid #4a5568;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .odds-label {
          font-size: 10px;
          color: #a0aec0;
          text-transform: uppercase;
        }
        .odds-num {
          font-size: 15px; 
          font-weight: 700;
          color: #48bb78;
        }
        .odds-btn.selected {
          background-color: #2f855a !important;
          border-color: #38a169 !important;
        }
        .odds-btn.selected .odds-label,
        .odds-btn.selected .odds-num {
          color: #000000 !important;
          font-weight: 800;
        }
        .odds-btn:hover:not(.selected) {
          background-color: #3a4a63;
        }
      `}</style>

      <div className="match-date-time">
        {formatMatchDate(start_time)}
      </div>

      <div className="match-main-row">
        <div className="team-block home">
          {renderFlag(home_team)}
          <span className="truncate" title={home_team}>{home_team}</span>
        </div>

        <div className="odds-container">
          <button 
            className={`odds-btn ${userPrediction === '1' ? 'selected' : ''}`}
            onClick={() => onMakePrediction(id, '1')}
          >
            <span className="odds-label">П1</span>
            <span className="odds-num">{home_odds?.toFixed(2) || '—'}</span>
          </button>

          <button 
            className={`odds-btn ${userPrediction === 'X' ? 'selected' : ''}`}
            onClick={() => onMakePrediction(id, 'X')}
          >
            <span className="odds-label">X</span>
            <span className="odds-num">{draw_odds?.toFixed(2) || '—'}</span>
          </button>

          <button 
            className={`odds-btn ${userPrediction === '2' ? 'selected' : ''}`}
            onClick={() => onMakePrediction(id, '2')}
          >
            <span className="odds-label">П2</span>
            <span className="odds-num">{away_odds?.toFixed(2) || '—'}</span>
          </button>
        </div>

        <div className="team-block away">
          <span className="truncate" title={away_team}>{away_team}</span>
          {renderFlag(away_team)}
        </div>
      </div>
    </div>
  );
};

export default MatchCard;