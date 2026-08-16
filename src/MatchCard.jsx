import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const clubLogos = {
  // 🏴󠁧󠁢󠁥󠁮󠁧󠁿 АПЛ та Чемпіоншип (Стабільні прямі CDN)
  "Aston Villa": "https://images.fotmob.com/image_resources/logo/teamlogo/10252.png",
  "Brighton": "https://images.fotmob.com/image_resources/logo/teamlogo/10204.png",
  "Brighton and Hove Albion": "https://images.fotmob.com/image_resources/logo/teamlogo/10204.png",
  "Brighton & Hove Albion": "https://images.fotmob.com/image_resources/logo/teamlogo/10204.png",
  "Sunderland": "https://images.fotmob.com/image_resources/logo/teamlogo/8472.png",
  "Sunderland AFC": "https://images.fotmob.com/image_resources/logo/teamlogo/8472.png",
  "Coventry City": "https://images.fotmob.com/image_resources/logo/teamlogo/8669.png",
  "Coventry": "https://images.fotmob.com/image_resources/logo/teamlogo/8669.png",
  "Hull City": "https://upload.wikimedia.org/wikipedia/en/5/54/Hull_City_A.F.C._logo.svg",
  "Leeds United": "https://images.fotmob.com/image_resources/logo/teamlogo/8463.png",
  "Leeds": "https://images.fotmob.com/image_resources/logo/teamlogo/8463.png",
  "Arsenal": "https://images.fotmob.com/image_resources/logo/teamlogo/9825.png",
  "Bournemouth": "https://images.fotmob.com/image_resources/logo/teamlogo/8678.png",
  "Brentford": "https://images.fotmob.com/image_resources/logo/teamlogo/9937.png",
  "Chelsea": "https://images.fotmob.com/image_resources/logo/teamlogo/8455.png",
  "Crystal Palace": "https://images.fotmob.com/image_resources/logo/teamlogo/9826.png",
  "Everton": "https://images.fotmob.com/image_resources/logo/teamlogo/8668.png",
  "Fulham": "https://images.fotmob.com/image_resources/logo/teamlogo/9879.png",
  "Ipswich Town": "https://upload.wikimedia.org/wikipedia/ru/4/43/Ipswich_Town.svg?utm_source=ru.wikipedia.org&utm_campaign=imageinfo&utm_content=original",
  "Leicester City": "https://images.fotmob.com/image_resources/logo/teamlogo/8197.png",
  "Liverpool": "https://images.fotmob.com/image_resources/logo/teamlogo/8650.png",
  "Manchester City": "https://images.fotmob.com/image_resources/logo/teamlogo/8456.png",
  "Manchester United": "https://images.fotmob.com/image_resources/logo/teamlogo/10260.png",
  "Newcastle United": "https://images.fotmob.com/image_resources/logo/teamlogo/10261.png",
  "Nottingham Forest": "https://images.fotmob.com/image_resources/logo/teamlogo/10203.png",
  "Southampton": "https://images.fotmob.com/image_resources/logo/teamlogo/8466.png",
  "Tottenham Hotspur": "https://images.fotmob.com/image_resources/logo/teamlogo/8586.png",
  "Tottenham": "https://images.fotmob.com/image_resources/logo/teamlogo/8586.png",
  "West Ham United": "https://images.fotmob.com/image_resources/logo/teamlogo/8654.png",
  "West Ham": "https://images.fotmob.com/image_resources/logo/teamlogo/8654.png",
  "Wolverhampton Wanderers": "https://images.fotmob.com/image_resources/logo/teamlogo/8602.png",
  "Wolves": "https://images.fotmob.com/image_resources/logo/teamlogo/8602.png",

  // ⭐ Ліга Чемпіонів та Європа
  "Real Madrid": "https://upload.wikimedia.org/wikipedia/en/5/56/Real_Madrid_CF.svg",
  "Barcelona": "https://upload.wikimedia.org/wikipedia/en/4/47/FC_Barcelona_%28crest%29.svg",
  "Atletico Madrid": "https://upload.wikimedia.org/wikipedia/en/f/f4/Atletico_Madrid_2017_logo.svg",
  "Bayern Munich": "https://upload.wikimedia.org/wikipedia/commons/1/1b/FC_Bayern_M%C3%BCnchen_logo_%282017%29.svg",
  "Borussia Dortmund": "https://upload.wikimedia.org/wikipedia/commons/6/67/Borussia_Dortmund_logo.svg",
  "Bayer Leverkusen": "https://upload.wikimedia.org/wikipedia/en/5/59/Bayer_04_Leverkusen_logo.svg",
  "Paris Saint-Germain": "https://upload.wikimedia.org/wikipedia/en/a/a7/Paris_Saint-Germain_F.C..svg",
  "PSG": "https://upload.wikimedia.org/wikipedia/en/a/a7/Paris_Saint-Germain_F.C..svg",
  "Inter Milan": "https://upload.wikimedia.org/wikipedia/commons/0/05/FC_Internazionale_Milano_2021.svg",
  "AC Milan": "https://upload.wikimedia.org/wikipedia/commons/d/d0/Logo_of_AC_Milan.svg",
  "Juventus": "https://upload.wikimedia.org/wikipedia/commons/b/bc/Juventus_FC_2017_icon_%28black%29.svg",
  "Atalanta": "https://upload.wikimedia.org/wikipedia/en/6/66/AtalantaBC.svg",
  "Sporting CP": "https://upload.wikimedia.org/wikipedia/en/e/e1/Sporting_Clube_de_Portugal_%28Logo%29.svg",
  "Benfica": "https://upload.wikimedia.org/wikipedia/en/a/a2/SL_Benfica_logo.svg",
  "Porto": "https://upload.wikimedia.org/wikipedia/en/f/f1/FC_Porto.svg",
  "PSV Eindhoven": "https://upload.wikimedia.org/wikipedia/en/0/05/PSV_Eindhoven.svg",
  "Feyenoord": "https://upload.wikimedia.org/wikipedia/en/e/e3/Feyenoord_logo.svg",
  "Celtic": "https://upload.wikimedia.org/wikipedia/en/3/35/Celtic_FC.svg",
  "Shakhtar Donetsk": "https://upload.wikimedia.org/wikipedia/en/a/a1/FC_Shakhtar_Donetsk.svg",
  "Dynamo Kyiv": "https://upload.wikimedia.org/wikipedia/commons/d/d9/FC_Dynamo_Kyiv_logo.svg"
};

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
        setTimeLeft('🔒 Закрито');
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

  const renderClubLogo = (teamName) => {
    const logoUrl = clubLogos[teamName];
    if (!logoUrl) {
      return <div className="club-logo-placeholder">{teamName.slice(0, 2).toUpperCase()}</div>;
    }
    return (
      <img
        src={logoUrl}
        alt={teamName}
        className="club-logo"
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={(e) => { e.target.style.display = 'none'; }}
      />
    );
  };

  const isButtonDisabled = status === 'finished' || isLiveOrPast || isReadOnly;
  const shouldHidePrediction = isReadOnly && !isLiveOrPast && status !== 'finished';

  let currentChoice = null;
  if (userPrediction) {
    currentChoice = typeof userPrediction === 'object' ? userPrediction.user_choice : userPrediction.split('-')[0];
  }

  return (
    <motion.div
      layout="position"
      className={`match-card ${isReadOnly ? 'readonly-mode' : ''} ${isCorrect ? 'correct-glow' : ''}`}
    >
      <style>{`
        .match-card {
          max-width: 600px;
          margin: 6px auto;
          padding: 12px 16px;
          background: linear-gradient(145deg, #181f2f, #131722);
          border-radius: 14px;
          border: 1px solid #283347;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
          box-sizing: border-box;
          transition: border-color 0.2s ease;
        }
        .match-card:hover {
          border-color: #3f4e6b;
        }
        .correct-glow {
          border-color: rgba(34, 197, 94, 0.4) !important;
          background: linear-gradient(145deg, #13241d, #101815) !important;
        }
        .readonly-mode {
          opacity: 0.65;
        }
        .match-header-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
        }
        .match-date-static { color: #64748b; }
        .match-countdown { color: #f6ad55; background: rgba(246, 173, 85, 0.08); padding: 2px 7px; border-radius: 6px; }
        .match-countdown.blocked { color: #fc8181; background: rgba(252, 129, 129, 0.08); }
        .match-countdown.finished { color: #4ade80; background: rgba(74, 222, 128, 0.08); font-weight: 800; font-size: 11px; }

        .match-main-row { 
          display: flex; 
          flex-direction: column;
          align-items: center; 
          gap: 12px; 
          width: 100%;
        }
        .team-block { 
          display: flex; 
          align-items: center; 
          gap: 10px; 
          width: 100%; 
          font-size: 13px;
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
        
        /* 🏆 ЗБІЛЬШЕНІ ЛОГОТИПИ КЛУБІВ (+65%) */
        .club-logo { 
          width: 36px; 
          height: 36px; 
          object-fit: contain; 
          flex-shrink: 0;
          filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.4));
        }
        .club-logo-placeholder {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: #2a364f;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 800;
          color: #94a3b8;
          flex-shrink: 0;
        }
        
        .odds-container { 
          display: flex; 
          gap: 6px; 
          width: 100%; 
          justify-content: center; 
        }
        .odds-btn {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 6px 4px;
          background-color: #1a2233;
          border: 1px solid #2a374f;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .odds-label { font-size: 9px; font-weight: 800; color: #64748b; margin-bottom: 1px; }
        .odds-num { font-size: 13px; font-weight: 800; color: #22c55e; }
        
        .odds-btn:hover:not(:disabled) {
          background-color: #243048;
        }
        .odds-btn.selected {
          background: linear-gradient(135deg, #22c55e, #16a34a) !important;
          border-color: #22c55e !important;
        }
        .odds-btn.selected .odds-label { color: rgba(255,255,255,0.7) !important; }
        .odds-btn.selected .odds-num { color: #ffffff !important; }
        .odds-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        @media (min-width: 520px) {
          .match-main-row { flex-direction: row; justify-content: space-between; }
          .team-block { width: 35%; font-size: 14px; gap: 12px; }
          .odds-container { width: 30%; }
          .club-logo { width: 40px; height: 40px; }
          .club-logo-placeholder { width: 40px; height: 40px; font-size: 12px; }
        }
      `}</style>

      <div className="match-header-row">
        <div className="match-date-static">
          {new Date(start_time).toLocaleString('uk-UA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </div>
        {status === 'finished' ? (
          <div className="match-countdown finished">🏁 {home_score}:{away_score}</div>
        ) : (
          <div className={`match-countdown ${isLiveOrPast ? 'blocked' : ''}`}>{timeLeft}</div>
        )}
      </div>

      <div className="match-main-row">
        <div className="team-block home">
          {renderClubLogo(home_team)}
          <span className="truncate" title={home_team}>{home_team}</span>
        </div>

        {shouldHidePrediction ? (
          <div className="text-[10px] text-gray-500 py-1.5 px-3 bg-gray-950/40 rounded-lg border border-dashed border-gray-800">🔒 Приховано</div>
        ) : (
          <div className="odds-container">
            <button disabled={isButtonDisabled} className={`odds-btn ${currentChoice === '1' ? 'selected' : ''}`} onClick={() => onMakePrediction(id, '1')}>
              <span className="odds-label">П1</span>
              <span className="odds-num">{home_odds?.toFixed(2) || '—'}</span>
            </button>
            <button disabled={isButtonDisabled} className={`odds-btn ${currentChoice === 'X' ? 'selected' : ''}`} onClick={() => onMakePrediction(id, 'X')}>
              <span className="odds-label">X</span>
              <span className="odds-num">{draw_odds?.toFixed(2) || '—'}</span>
            </button>
            <button disabled={isButtonDisabled} className={`odds-btn ${currentChoice === '2' ? 'selected' : ''}`} onClick={() => onMakePrediction(id, '2')}>
              <span className="odds-label">П2</span>
              <span className="odds-num">{away_odds?.toFixed(2) || '—'}</span>
            </button>
          </div>
        )}

        <div className="team-block away">
          <span className="truncate" title={away_team}>{away_team}</span>
          {renderClubLogo(away_team)}
        </div>
      </div>
    </motion.div>
  );
};

export default MatchCard;