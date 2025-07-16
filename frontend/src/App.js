import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const WS_URL = BACKEND_URL.replace('https:', 'wss:').replace('http:', 'ws:');

function App() {
  const [currentScreen, setCurrentScreen] = useState('home');
  const [playerName, setPlayerName] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [sessionCode, setSessionCode] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [gameSession, setGameSession] = useState(null);
  const [playerRole, setPlayerRole] = useState('');
  const [playerWord, setPlayerWord] = useState('');
  const [currentPhase, setCurrentPhase] = useState('joining');
  const [synonyms, setSynonyms] = useState({});
  const [votes, setVotes] = useState({});
  const [currentSynonym, setCurrentSynonym] = useState('');
  const [selectedVote, setSelectedVote] = useState('');
  const [gameMessage, setGameMessage] = useState('');
  const [publicSessions, setPublicSessions] = useState([]);
  const [ws, setWs] = useState(null);

  const wsRef = useRef(null);

  useEffect(() => {
    if (sessionId && playerId) {
      connectWebSocket();
    }
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [sessionId, playerId]);

  const connectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    
    const websocket = new WebSocket(`${WS_URL}/ws/${sessionId}/${playerId}`);
    
    websocket.onopen = () => {
      console.log('WebSocket connected');
    };
    
    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleWebSocketMessage(data);
    };
    
    websocket.onclose = () => {
      console.log('WebSocket disconnected');
    };
    
    wsRef.current = websocket;
    setWs(websocket);
  };

  const handleWebSocketMessage = (data) => {
    switch (data.type) {
      case 'player_joined':
        setGameMessage(`${data.player.name} a rejoint la partie (${data.total_players}/20)`);
        fetchSession();
        break;
      case 'game_started':
        if (data.player_id === playerId) {
          setPlayerRole(data.role);
          setPlayerWord(data.word);
          setCurrentPhase('synonym_writing');
          setCurrentScreen('game');
        }
        break;
      case 'phase_change':
        setCurrentPhase(data.phase);
        if (data.phase === 'voting') {
          setSynonyms(data.synonyms);
        }
        break;
      case 'round_results':
        setGameMessage(`${data.eliminated_player.name} (${data.eliminated_player.role}) a été éliminé!`);
        setCurrentPhase('synonym_writing');
        setSynonyms({});
        setVotes({});
        setCurrentSynonym('');
        setSelectedVote('');
        setTimeout(() => {
          setGameMessage('');
        }, 5000);
        break;
      case 'game_ended':
        setGameMessage(`Partie terminée! Les ${data.winner} ont gagné!`);
        setCurrentPhase('finished');
        break;
      default:
        break;
    }
  };

  const fetchPublicSessions = async () => {
    try {
      const response = await axios.get(`${API}/public-sessions`);
      setPublicSessions(response.data);
    } catch (error) {
      console.error('Error fetching public sessions:', error);
    }
  };

  const fetchSession = async () => {
    try {
      const response = await axios.get(`${API}/session/${sessionId}`);
      setGameSession(response.data.session);
    } catch (error) {
      console.error('Error fetching session:', error);
    }
  };

  const createSession = async (isPublic = true) => {
    try {
      const response = await axios.post(`${API}/create-session`, null, {
        params: { player_name: playerName, is_public: isPublic }
      });
      setSessionId(response.data.session_id);
      setSessionCode(response.data.session_code);
      setPlayerId(response.data.player_id);
      setIsHost(true);
      setCurrentScreen('lobby');
      fetchSession();
    } catch (error) {
      console.error('Error creating session:', error);
      alert('Erreur lors de la création de la session');
    }
  };

  const joinSession = async (sessionIdOrCode = null) => {
    try {
      const request = {
        player_name: playerName,
        session_id: sessionIdOrCode || sessionId,
        session_code: sessionIdOrCode ? null : sessionCode
      };
      
      const response = await axios.post(`${API}/join-session`, request);
      setSessionId(response.data.session_id);
      setPlayerId(response.data.player_id);
      setIsHost(false);
      setCurrentScreen('lobby');
      fetchSession();
    } catch (error) {
      console.error('Error joining session:', error);
      alert('Erreur lors de la connexion à la session');
    }
  };

  const startGame = async () => {
    try {
      await axios.post(`${API}/start-game/${sessionId}`, null, {
        params: { host_id: playerId }
      });
    } catch (error) {
      console.error('Error starting game:', error);
      alert('Erreur lors du démarrage de la partie');
    }
  };

  const submitSynonym = async () => {
    try {
      await axios.post(`${API}/submit-synonym`, {
        session_id: sessionId,
        player_id: playerId,
        synonym: currentSynonym
      });
      setCurrentSynonym('');
      setGameMessage('Synonyme soumis! En attente des autres joueurs...');
    } catch (error) {
      console.error('Error submitting synonym:', error);
      alert('Erreur lors de la soumission du synonyme');
    }
  };

  const submitVote = async () => {
    try {
      await axios.post(`${API}/vote`, {
        session_id: sessionId,
        voter_id: playerId,
        voted_player_id: selectedVote
      });
      setSelectedVote('');
      setGameMessage('Vote soumis! En attente des autres joueurs...');
    } catch (error) {
      console.error('Error submitting vote:', error);
      alert('Erreur lors du vote');
    }
  };

  const renderHome = () => (
    <div className="screen home-screen">
      <div className="spy-background">
        <div className="content-overlay">
          <h1 className="game-title">DOUBLE SPIES</h1>
          <p className="game-subtitle">Jeu de déduction sociale</p>
          
          <div className="player-input">
            <input
              type="text"
              placeholder="Votre nom de joueur"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="spy-input"
            />
          </div>
          
          {playerName && (
            <div className="game-options">
              <button className="spy-button primary" onClick={() => createSession(true)}>
                Créer une partie publique
              </button>
              <button className="spy-button secondary" onClick={() => createSession(false)}>
                Créer une partie privée
              </button>
              <button className="spy-button tertiary" onClick={() => setCurrentScreen('join')}>
                Rejoindre une partie
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderJoin = () => (
    <div className="screen join-screen">
      <div className="spy-background">
        <div className="content-overlay">
          <h2 className="screen-title">Rejoindre une partie</h2>
          
          <div className="join-options">
            <div className="join-section">
              <h3>Avec un code</h3>
              <input
                type="text"
                placeholder="Code de la partie"
                value={sessionCode}
                onChange={(e) => setSessionCode(e.target.value)}
                className="spy-input"
              />
              <button className="spy-button primary" onClick={() => joinSession()}>
                Rejoindre
              </button>
            </div>
            
            <div className="join-section">
              <h3>Parties publiques</h3>
              <button className="spy-button secondary" onClick={fetchPublicSessions}>
                Actualiser
              </button>
              <div className="public-sessions">
                {publicSessions.map(session => (
                  <div key={session.id} className="session-card">
                    <div className="session-info">
                      <h4>Hôte: {session.host_name}</h4>
                      <p>Joueurs: {session.player_count}/20</p>
                    </div>
                    <button className="spy-button small" onClick={() => joinSession(session.id)}>
                      Rejoindre
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <button className="spy-button tertiary" onClick={() => setCurrentScreen('home')}>
            Retour
          </button>
        </div>
      </div>
    </div>
  );

  const renderLobby = () => (
    <div className="screen lobby-screen">
      <div className="spy-background">
        <div className="content-overlay">
          <h2 className="screen-title">Salon d'attente</h2>
          
          {sessionCode && (
            <div className="session-code">
              <p>Code de la partie: <strong>{sessionCode}</strong></p>
            </div>
          )}
          
          <div className="player-list">
            <h3>Joueurs ({gameSession?.players?.length || 0}/20)</h3>
            <div className="players-grid">
              {gameSession?.players?.map(player => (
                <div key={player.id} className={`player-card ${player.is_host ? 'host' : ''}`}>
                  <span className="player-name">{player.name}</span>
                  {player.is_host && <span className="host-badge">Hôte</span>}
                </div>
              ))}
            </div>
          </div>
          
          {gameMessage && (
            <div className="game-message">
              {gameMessage}
            </div>
          )}
          
          {isHost && gameSession?.players?.length === 20 && (
            <button className="spy-button primary large" onClick={startGame}>
              Commencer la partie
            </button>
          )}
          
          {!isHost && (
            <p className="waiting-message">En attente que l'hôte démarre la partie...</p>
          )}
          
          {gameSession?.players?.length < 20 && (
            <p className="waiting-message">
              En attente de {20 - (gameSession?.players?.length || 0)} joueurs...
            </p>
          )}
        </div>
      </div>
    </div>
  );

  const renderGame = () => (
    <div className="screen game-screen">
      <div className="spy-background">
        <div className="content-overlay">
          <div className="game-header">
            <h2>Double Spies</h2>
            <div className="game-info">
              <div className="role-info">
                <span className="role-badge">{playerRole}</span>
                {playerWord && <span className="word-badge">Mot: {playerWord}</span>}
              </div>
              <div className="phase-info">
                <span className="phase-badge">{currentPhase}</span>
              </div>
            </div>
          </div>
          
          {gameMessage && (
            <div className="game-message">
              {gameMessage}
            </div>
          )}
          
          {currentPhase === 'synonym_writing' && (
            <div className="synonym-phase">
              <h3>Écrivez un synonyme</h3>
              {playerRole === 'MasterMind' && (
                <p className="role-instruction">
                  En tant que MasterMind, vous devez deviner le mot et écrire un synonyme plausible.
                </p>
              )}
              {playerRole === 'Visitor' && (
                <p className="role-instruction">
                  En tant que Visitor, vous avez un mot différent. Essayez de vous fondre dans la masse.
                </p>
              )}
              {playerRole === 'Tester' && (
                <p className="role-instruction">
                  En tant que Tester, écrivez un synonyme de votre mot.
                </p>
              )}
              
              <div className="synonym-input">
                <input
                  type="text"
                  placeholder="Votre synonyme"
                  value={currentSynonym}
                  onChange={(e) => setCurrentSynonym(e.target.value)}
                  className="spy-input"
                />
                <button 
                  className="spy-button primary" 
                  onClick={submitSynonym}
                  disabled={!currentSynonym}
                >
                  Soumettre
                </button>
              </div>
            </div>
          )}
          
          {currentPhase === 'voting' && (
            <div className="voting-phase">
              <h3>Vote d'élimination</h3>
              <p>Choisissez un joueur à éliminer en regardant les synonymes:</p>
              
              <div className="synonyms-list">
                {Object.entries(synonyms).map(([playerId, synonym]) => {
                  const player = gameSession?.players?.find(p => p.id === playerId);
                  return (
                    <div key={playerId} className="synonym-item">
                      <span className="player-name">{player?.name}: </span>
                      <span className="synonym">{synonym}</span>
                    </div>
                  );
                })}
              </div>
              
              <div className="vote-section">
                <select 
                  value={selectedVote} 
                  onChange={(e) => setSelectedVote(e.target.value)}
                  className="spy-select"
                >
                  <option value="">Choisir un joueur à éliminer</option>
                  {gameSession?.players?.filter(p => p.is_alive && p.id !== playerId).map(player => (
                    <option key={player.id} value={player.id}>{player.name}</option>
                  ))}
                </select>
                <button 
                  className="spy-button primary" 
                  onClick={submitVote}
                  disabled={!selectedVote}
                >
                  Voter
                </button>
              </div>
            </div>
          )}
          
          {currentPhase === 'finished' && (
            <div className="game-finished">
              <h3>Partie terminée!</h3>
              <div className="final-message">
                {gameMessage}
              </div>
              <button className="spy-button primary" onClick={() => setCurrentScreen('home')}>
                Retour à l'accueil
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderScreen = () => {
    switch (currentScreen) {
      case 'home':
        return renderHome();
      case 'join':
        return renderJoin();
      case 'lobby':
        return renderLobby();
      case 'game':
        return renderGame();
      default:
        return renderHome();
    }
  };

  return (
    <div className="App">
      {renderScreen()}
    </div>
  );
}

export default App;