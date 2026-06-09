import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

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

// 🚀 Додали пропс isCorrect = false
const MatchCard = ({ match, userPrediction, onMakePrediction, isReadOnly = false, isCorrect = false }) => {
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
  const shouldHidePrediction = isReadOnly && !isLiveOrPast && status !== 'finished';

  return (
    <motion.div 
      layout="position"
      /* 🚀 Додаємо динамічний клас correct-glow, якщо матч вгадано */
      className={`match-card ${isReadOnly ? 'readonly-mode' : ''} ${isCorrect ? 'correct-glow' : ''}`}
    >
      <style>{`
        .match-card {
          max-width: 600px;
          margin: 6px auto;
          padding: 14px 18px;
          background: linear-gradient(145deg, #1e2538, #161b29);
          border-radius: 14px;
          border: 1px solid #2d3748;
          box-shadow: 0 6px 18px rgba(0, 0, 0, 0.22);
          transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
        }
        .match-card:hover {
          border-color: #4a5568;
          box-shadow: 0 10px 26px rgba(0, 0, 0, 0.38);
        }
        
        /* 🚀 ФІРМОВЕ ОДНОКОНТУРНЕ ПІДСВІЧУВАННЯ ДЛЯ УСПІШНО ВГАДАНОГО МАТЧУ */
        .correct-glow {
          border-color: rgba(34, 197, 94, 0.35) !important;
          background: linear-gradient(145deg, #13241d, #111a18) !important;
          box-shadow: 0 4px 15px rgba(34, 197, 94, 0.05) !important;
          opacity: 1 !important; /* Робимо вгадані картки повністю соковитими */
        }

        .readonly-mode {
          opacity: 0.55; /* Трохи приглушуємо не вгадані завершені матчі */
          background: #151a24;
        }
        .match-header-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          tracking-wider;
        }
        .match-date-static { color: #64748b; }
        .match-countdown { color: #f6ad55; background: rgba(246, 173, 85, 0.05); padding: 3px 8px; border-radius: 7px; font-variant-numeric: tabular-nums; }
        .match-countdown.blocked { color: #fc8181; background: rgba(252, 129, 129, 0.05); }
        .match-countdown.finished { color: #4ade80; background: rgba(74, 222, 128, 0.06); font-size: 12px; font-weight: 800; }
        
        .match-main-row { 
          display: flex; 
          flex-direction: column;
          align-items: center; 
          justify-content: center; 
          gap: 12px; 
        }
        
        .team-block { 
          display: flex; 
          align-items: center; 
          gap: 11px; 
          width: 100%; 
          font-size: 15px;
          font-weight: 700; 
          color: #ffffff;
        }
        .team-block .truncate {
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .team-block.home { justify-content: flex-start; }
        .team-block.away { justify-content: flex-end; }
        
        .country-flag { 
          width: 27px; 
          height: 19px; 
          object-fit: cover; 
          border-radius: 4px; 
          box-shadow: 0 1px 3px rgba(0,0,0,0.3);
          transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
          will-change: transform;
        }
        .match-card:hover .country-flag {
          transform: scale(1.14);
        }
        
        .odds-container { 
          display: flex; 
          gap: 8px; 
          width: 100%; 
          justify-content: center; 
        }
        
        .odds-btn {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 9px 5px;
          background-color: #1e2638;
          border: 1px solid #2d3748;
          border-radius: 9px;
          cursor: pointer;
          transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.2s, border-color 0.2s;
          will-change: transform;
        }
        .odds-label { font-size: 9px; font-weight: 800; color: #64748b; margin-bottom: 2px; text-transform: uppercase; }
        .odds-num { font-size: 14px; font-weight: 800; color: #22c55e; }
        
        .odds-btn:hover:not(:disabled) {
          transform: scale(1.07);
          background-color: #27324a;
          border-color: #4a5d80;
        }
        .odds-btn:not(:disabled):active {
          transform: scale(0.94);
        }
        .odds-btn.selected {
          background: linear-gradient(135deg, #22c55e, #16a34a) !important;
          border-color: #22c55e !important;
          box-shadow: 0 0 12px rgba(34, 197, 94, 0.32);
          transform: scale(1.02);
        }
        .odds-btn.selected .odds-label { color: rgba(255,255,255,0.7) !important; }
        .odds-btn.selected .odds-num { color: #ffffff !important; }
        .odds-btn:disabled { opacity: 0.35; cursor: not-allowed; transform: none !important; }
        
        .hidden-prediction-tag {
          font-size: 10px;
          color: #64748b;
          font-style: italic;
          background: #111622;
          padding: 7px 14px;
          border-radius: 7px;
          border: 1px dashed #2d3748;
          width: 100%;
          text-align: center;
        }

        @media (min-width: 500px) {
          .match-main-row { 
            flex-direction: row; 
            gap: 12px; 
          }
          .team-block { width: 35%; }
          .odds-container { width: 30%; }
          .hidden-prediction-tag { width: auto; }
          .odds-btn { padding: 8px 4px; }
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
    </motion.div>
  );
};

export default MatchCard;