import React, { useState, useEffect } from 'react';

const worldCupFlags = {
  "Bosnia & Herzegovina": "ba", "Haiti": "ht", "Turkey": "tr", "Curaçao": "cw",
  "Ivory Coast": "ci", "Cape Verde": "cv", "Norway": "no", "Iraq": "iq",
  "Jordan": "jo", "DR Congo": "cd", "Uzbekistan": "uz", "Argentina": "ar", 
  "Algeria": "dz", "Australia": "au", "Austria": "at", "Belgium": "be", 
  "Brazil": "br", "Cameroon": "cm", "Canada": "ca", "Chile": "cl", 
  "Colombia": "co", "Costa Rica": "cr", "Croatia": "hr", "Czech Republic": "cz", 
  "Denmark": "dk", "Ecuador": "ec", "Egypt": "eg", "England": "gb-eng", 
  "France": "fr", "Germany": "de", "Ghana": "gh", "Greece": "gr", 
  "Iran": "ir", "Italy": "it", "Japan": "jp", "Mexico": "mx", 
  "Morocco": "ma", "Netherlands": "nl", "New Zealand": "nz", "Nigeria": "ng", 
  "Panama": "pa", "Paraguay": "py", "Peru": "pe", "Poland": "pl", 
  "Portugal": "pt", "Qatar": "qa", "Saudi Arabia": "sa", "Scotland": "gb-sct", 
  "Senegal": "sn", "Serbia": "rs", "South Africa": "za", "South Korea": "kr", 
  "Spain": "es", "Sweden": "se", "Switzerland": "ch", "Tunisia": "tn", 
  "Ukraine": "ua", "United States": "us", "Uruguay": "uy", "Wales": "gb-wls", "USA": "us"
};

const MatchCard = ({ match, userPrediction, onMakePrediction, isReadOnly = false }) => {
  const { id, home_team, away_team, start_time, home_odds, draw_odds, away_odds, status, home_score, away_score } = match;

  const [timeLeft, setTimeLeft] = useState('');
  const [isLiveOrPast, setIsLiveOrPast] = useState(false);

  useEffect(() => {
    if (status === 'finished') {
      setIsLiveOrPast(true);
      return;
    }

    const calculateTime = () => {
      const now = new Date().getTime();
      const matchTime = new Date(start_time).getTime();
      const difference = matchTime - now;

      if (difference <= 0) {
        setIsLiveOrPast(true);
        setTimeLeft('🔒 Ставки закриті');
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      let formattedTime = '⏳ ';
      if (days > 0) formattedTime += `${days}д `;
      formattedTime += `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      
      setTimeLeft(formattedTime);
      setIsLiveOrPast(false);
    };

    calculateTime();
    const timer = setInterval(calculateTime, 1000);
    return () => clearInterval(timer);
  }, [start_time, status]);

  const renderFlag = (teamName) => {
    const code = worldCupFlags[teamName];
    if (!code) return null;
    return <img src={`https://flagcdn.com/w40/${code}.png`} alt="" className="country-flag" />;
  };

  const isButtonDisabled = status === 'finished' || isLiveOrPast || isReadOnly;

  // Якщо це режим перегляду ЧУЖОГО профілю і матч ще не почався — приховуємо ставку суперника, щоб не списували
  const shouldHidePrediction = isReadOnly && !isLiveOrPast && status !== 'finished';

  return (
    <div className={`match-card ${isReadOnly ? 'readonly-mode' : ''}`}>
      <style>{`
        .match-card {
          max-width: 600px;
          margin: 12px auto;
          padding: 14px 18px;
          background: linear-gradient(145deg, #1e2538, #161b29);
          border-radius: 14px;
          border: 1px solid #2d3748;
          box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
          transition: border-color 0.3s ease, transform 0.3s ease;
        }
        .match-card:hover {
          border-color: #4a5568;
        }
        .readonly-mode {
          opacity: 0.85;
          background: #151a24;
        }
        .match-header-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          font-size: 12px;
          font-weight: 600;
        }
        .match-date-static { color: #94a3b8; }
        .match-countdown { color: #f6ad55; background: rgba(246, 173, 85, 0.08); padding: 3px 8px; border-radius: 6px; }
        .match-countdown.blocked { color: #fc8181; background: rgba(252, 129, 129, 0.08); }
        .match-countdown.finished { color: #68d391; background: rgba(104, 211, 145, 0.08); }
        
        .match-main-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .team-block { display: flex; align-items: center; gap: 10px; width: 35%; font-size: 15px; font-weight: 600; color: #ffffff; }
        .team-block.home { justify-content: flex-start; }
        .team-block.away { justify-content: flex-end; }
        .country-flag { width: 26px; height: 18px; object-fit: cover; border-radius: 4px; }
        
        .odds-container { display: flex; gap: 8px; width: 30%; justify-content: center; }
        .odds-btn {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 8px 4px;
          background-color: #232d42;
          border: 1px solid #36445d;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .odds-label { font-size: 10px; color: #94a3b8; margin-bottom: 2px; }
        .odds-num { font-size: 14px; font-weight: 700; color: #10b981; }
        
        /* Ефекти Web3-анімації натискання кнопки */
        .odds-btn:not(:disabled):active {
          transform: scale(0.92);
        }
        .odds-btn:hover:not(:disabled):not(.selected) {
          background-color: #2d3a54;
          border-color: #4a5d80;
        }
        .odds-btn.selected {
          background: linear-gradient(135deg, #10b981, #059669) !important;
          border-color: #10b981 !important;
          box-shadow: 0 0 12px rgba(16, 185, 129, 0.4);
        }
        .odds-btn.selected .odds-label,
        .odds-btn.selected .odds-num { color: #ffffff !important; }
        .odds-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        
        .hidden-prediction-tag {
          font-size: 11px;
          color: #718096;
          font-style: italic;
          background: #1a202c;
          padding: 6px 12px;
          border-radius: 6px;
          border: 1px dashed #4a5568;
        }
      `}</style>

      <div className="match-header-row">
        <div className="match-date-static">
          {new Date(start_time).toLocaleString('uk-UA', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
        </div>
        
        {status === 'finished' ? (
          <div className="match-countdown finished">
            🏁 {home_score}:{away_score}
          </div>
        ) : (
          <div className={`match-countdown ${isLiveOrPast ? 'blocked' : ''}`}>
            {timeLeft}
          </div>
        )}
      </div>

      <div className="match-main-row">
        <div className="team-block home">
          {renderFlag(home_team)}
          <span className="truncate" title={home_team}>{home_team}</span>
        </div>

        {shouldHidePrediction ? (
          <div className="hidden-prediction-tag">🔒 Приховано до старту</div>
        ) : (
          <div className="odds-container">
            <button 
              disabled={isButtonDisabled}
              className={`odds-btn ${userPrediction === '1' ? 'selected' : ''}`}
              onClick={() => onMakePrediction(id, '1')}
            >
              <span className="odds-label">П1</span>
              <span className="odds-num">{home_odds?.toFixed(2) || '—'}</span>
            </button>

            <button 
              disabled={isButtonDisabled}
              className={`odds-btn ${userPrediction === 'X' ? 'selected' : ''}`}
              onClick={() => onMakePrediction(id, 'X')}
            >
              <span className="odds-label">X</span>
              <span className="odds-num">{draw_odds?.toFixed(2) || '—'}</span>
            </button>

            <button 
              disabled={isButtonDisabled}
              className={`odds-btn ${userPrediction === '2' ? 'selected' : ''}`}
              onClick={() => onMakePrediction(id, '2')}
            >
              <span className="odds-label">П2</span>
              <span className="odds-num">{away_odds?.toFixed(2) || '—'}</span>
            </button>
          </div>
        )}

        <div className="team-block away">
          <span className="truncate" title={away_team}>{away_team}</span>
          {renderFlag(away_team)}
        </div>
      </div>
    </div>
  );
};

export default MatchCard;