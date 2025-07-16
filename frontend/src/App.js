import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const WS_URL = BACKEND_URL.replace('https:', 'wss:').replace('http:', 'ws:');

// Matrix Rain Effect Component
const MatrixRain = () => {
  const canvasRef = useRef(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*()_+-=[]{}|;:,.<>?';
    const charArray = chars.split('');
    
    const fontSize = 14;
    const columns = canvas.width / fontSize;
    const drops = [];
    
    for (let i = 0; i < columns; i++) {
      drops[i] = 1;
    }
    
    const draw = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.fillStyle = '#00ff00';
      ctx.font = `${fontSize}px monospace`;
      
      for (let i = 0; i < drops.length; i++) {
        const text = charArray[Math.floor(Math.random() * charArray.length)];
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);
        
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }
    };
    
    const interval = setInterval(draw, 50);
    
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  
  return <canvas ref={canvasRef} className="matrix-rain" />;
};

// Particles Effect Component
const Particles = () => {
  const canvasRef = useRef(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    const particles = [];
    const particleCount = 100;
    
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        life: Math.random() * 100 + 100,
        maxLife: Math.random() * 100 + 100,
      });
    }
    
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      particles.forEach((particle, index) => {
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.life--;
        
        if (particle.life <= 0) {
          particles[index] = {
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 0.5,
            vy: (Math.random() - 0.5) * 0.5,
            life: Math.random() * 100 + 100,
            maxLife: Math.random() * 100 + 100,
          };
        }
        
        const alpha = particle.life / particle.maxLife;
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.6})`;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, 1, 0, Math.PI * 2);
        ctx.fill();
      });
    };
    
    const interval = setInterval(draw, 16);
    
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  
  return <canvas ref={canvasRef} className="particles" />;
};

// Glitch Text Component
const GlitchText = ({ text, className = '' }) => {
  return (
    <span className={`glitch ${className}`} data-text={text}>
      {text}
    </span>
  );
};

// Typing Text Component
const TypingText = ({ text, speed = 100, className = '' }) => {
  const [displayText, setDisplayText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  
  useEffect(() => {
    if (currentIndex < text.length) {
      const timer = setTimeout(() => {
        setDisplayText(prev => prev + text[currentIndex]);
        setCurrentIndex(prev => prev + 1);
      }, speed);
      
      return () => clearTimeout(timer);
    }
  }, [currentIndex, text, speed]);
  
  return (
    <span className={`typing-text ${className}`}>
      {displayText}
    </span>
  );
};

// Connection Status Component
const ConnectionStatus = ({ ws }) => {
  const [status, setStatus] = useState('connecting');
  
  useEffect(() => {
    if (!ws) {
      setStatus('disconnected');
      return;
    }
    
    const handleOpen = () => setStatus('connected');
    const handleClose = () => setStatus('disconnected');
    const handleError = () => setStatus('disconnected');
    
    ws.addEventListener('open', handleOpen);
    ws.addEventListener('close', handleClose);
    ws.addEventListener('error', handleError);
    
    return () => {
      ws.removeEventListener('open', handleOpen);
      ws.removeEventListener('close', handleClose);
      ws.removeEventListener('error', handleError);
    };
  }, [ws]);
  
  const statusText = {
    connecting: 'Connexion...',
    connected: 'Connecté',
    disconnected: 'Déconnecté'
  };
  
  return (
    <div className={`status-indicator ${status}`}>
      {statusText[status]}
    </div>
  );
};

// Loading Component
const Loading = ({ text = 'Chargement...', type = 'spinner' }) => {
  if (type === 'dots') {
    return (
      <div className="loading-dots">
        <div className="loading-dot"></div>
        <div className="loading-dot"></div>
        <div className="loading-dot"></div>
      </div>
    );
  }
  
  return (
    <div className="loading-spinner">
      <div className="spinner"></div>
      {text && <span style={{ marginLeft: '10px' }}>{text}</span>}
    </div>
  );
};

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
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');

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
    
    setConnectionStatus('connecting');
    const websocket = new WebSocket(`${WS_URL}/ws/${sessionId}/${playerId}`);
    
    websocket.onopen = () => {
      console.log('WebSocket connected');
      setConnectionStatus('connected');
    };
    
    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleWebSocketMessage(data);
    };
    
    websocket.onclose = () => {
      console.log('WebSocket disconnected');
      setConnectionStatus('disconnected');
      // Auto-reconnect after 3 seconds
      setTimeout(() => {
        if (sessionId && playerId) {
          connectWebSocket();
        }
      }, 3000);
    };
    
    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
      setConnectionStatus('disconnected');
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

  const createSession = async (isPublic = true) => {
    if (!playerName.trim()) {
      alert('Veuillez entrer un nom de joueur');
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await axios.post(`${API}/create-session`, null, {
        params: { player_name: playerName.trim(), is_public: isPublic }
      });
      setSessionId(response.data.session_id);
      setSessionCode(response.data.session_code);
      setPlayerId(response.data.player_id);
      setIsHost(true);
      setCurrentScreen('lobby');
      await fetchSession();
    } catch (error) {
      console.error('Error creating session:', error);
      alert('Erreur lors de la création de la session');
    } finally {
      setIsLoading(false);
    }
  };

  const joinSession = async (sessionIdOrCode = null) => {
    if (!playerName.trim()) {
      alert('Veuillez entrer un nom de joueur');
      return;
    }
    
    setIsLoading(true);
    try {
      const request = {
        player_name: playerName.trim(),
        session_id: sessionIdOrCode || sessionId,
        session_code: sessionIdOrCode ? null : sessionCode
      };
      
      const response = await axios.post(`${API}/join-session`, request);
      setSessionId(response.data.session_id);
      setPlayerId(response.data.player_id);
      setIsHost(false);
      setCurrentScreen('lobby');
      await fetchSession();
    } catch (error) {
      console.error('Error joining session:', error);
      alert('Erreur lors de la connexion à la session');
    } finally {
      setIsLoading(false);
    }
  };

  const startGame = async () => {
    setIsLoading(true);
    try {
      await axios.post(`${API}/start-game/${sessionId}`, null, {
        params: { host_id: playerId }
      });
    } catch (error) {
      console.error('Error starting game:', error);
      alert('Erreur lors du démarrage de la partie');
    } finally {
      setIsLoading(false);
    }
  };

  const submitSynonym = async () => {
    if (!currentSynonym.trim()) {
      alert('Veuillez entrer un synonyme');
      return;
    }
    
    setIsLoading(true);
    try {
      await axios.post(`${API}/submit-synonym`, {
        session_id: sessionId,
        player_id: playerId,
        synonym: currentSynonym.trim()
      });
      setCurrentSynonym('');
      setGameMessage('Synonyme soumis! En attente des autres joueurs...');
    } catch (error) {
      console.error('Error submitting synonym:', error);
      alert('Erreur lors de la soumission du synonyme');
    } finally {
      setIsLoading(false);
    }
  };

  const submitVote = async () => {
    if (!selectedVote) {
      alert('Veuillez sélectionner un joueur à éliminer');
      return;
    }
    
    setIsLoading(true);
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
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPublicSessions = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API}/public-sessions`);
      setPublicSessions(response.data.map(session => ({
        ...session,
        status: session.player_count >= 20 ? 'full' : 
                session.game_started ? 'playing' : 'waiting'
      })));
    } catch (error) {
      console.error('Error fetching public sessions:', error);
      alert('Erreur lors du chargement des sessions publiques');
    } finally {
      setIsLoading(false);
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

  // Enhanced WebSocket connection management
  const connectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    
    setConnectionStatus('connecting');
    const websocket = new WebSocket(`${WS_URL}/ws/${sessionId}/${playerId}`);
    
    websocket.onopen = () => {
      console.log('WebSocket connected');
      setConnectionStatus('connected');
    };
    
    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleWebSocketMessage(data);
    };
    
    websocket.onclose = () => {
      console.log('WebSocket disconnected');
      setConnectionStatus('disconnected');
      // Auto-reconnect after 3 seconds
      setTimeout(() => {
        if (sessionId && playerId) {
          connectWebSocket();
        }
      }, 3000);
    };
    
    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
      setConnectionStatus('disconnected');
    };
    
    wsRef.current = websocket;
    setWs(websocket);
  };

  const renderHome = () => (
    <div className="screen home-screen">
      <div className="spy-background">
        <MatrixRain />
        <Particles />
        <div className="content-overlay">
          <GlitchText text="DOUBLE SPIES" className="game-title" />
          <TypingText text="Jeu de déduction sociale" className="game-subtitle" speed={80} />
          
          <div className="player-input">
            <div className="input-group">
              <label className="input-label">Nom de joueur</label>
              <input
                type="text"
                placeholder="Entrez votre nom..."
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="spy-input"
                maxLength={20}
              />
            </div>
          </div>
          
          {playerName && (
            <div className="game-options">
              <button 
                className="spy-button primary large glow" 
                onClick={() => createSession(true)}
                disabled={isLoading}
              >
                {isLoading ? <Loading type="dots" /> : 'Créer une partie publique'}
              </button>
              <button 
                className="spy-button secondary large" 
                onClick={() => createSession(false)}
                disabled={isLoading}
              >
                {isLoading ? <Loading type="dots" /> : 'Créer une partie privée'}
              </button>
              <button 
                className="spy-button tertiary large" 
                onClick={() => setCurrentScreen('join')}
                disabled={isLoading}
              >
                Rejoindre une partie
              </button>
            </div>
          )}
        </div>
      </div>
      <ConnectionStatus ws={ws} />
    </div>
  );

  const renderJoin = () => (
    <div className="screen join-screen">
      <div className="spy-background">
        <MatrixRain />
        <Particles />
        <div className="content-overlay">
          <TypingText text="Rejoindre une partie" className="screen-title" speed={60} />
          
          <div className="join-options">
            <div className="join-section slide-in-left">
              <h3>🔒 Avec un code</h3>
              <div className="input-group">
                <label className="input-label">Code de la partie</label>
                <input
                  type="text"
                  placeholder="Ex: ABC123"
                  value={sessionCode}
                  onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                  className="spy-input"
                  maxLength={6}
                />
              </div>
              <button 
                className="spy-button primary glow" 
                onClick={() => joinSession()}
                disabled={!sessionCode || isLoading}
              >
                {isLoading ? <Loading type="dots" /> : 'Rejoindre'}
              </button>
            </div>
            
            <div className="join-section slide-in-right">
              <h3>🌐 Parties publiques</h3>
              <button 
                className="spy-button secondary pulse" 
                onClick={fetchPublicSessions}
                disabled={isLoading}
              >
                {isLoading ? <Loading type="dots" /> : '🔄 Actualiser'}
              </button>
              <div className="public-sessions">
                {publicSessions.length === 0 ? (
                  <div className="waiting-message">
                    <TypingText text="Aucune partie publique disponible..." speed={50} />
                  </div>
                ) : (
                  publicSessions.map((session, index) => (
                    <div key={session.id} className="session-card" style={{ animationDelay: `${index * 0.1}s` }}>
                      <div className="session-info">
                        <h4>👑 Hôte: {session.host_name}</h4>
                        <p>👥 Joueurs: {session.player_count}/20</p>
                        <div className={`session-status ${session.status}`}>
                          {session.status === 'waiting' && '⏳ En attente'}
                          {session.status === 'playing' && '🎮 En cours'}
                          {session.status === 'full' && '🚫 Complète'}
                        </div>
                      </div>
                      <button 
                        className="spy-button small" 
                        onClick={() => joinSession(session.id)}
                        disabled={session.status !== 'waiting' || isLoading}
                      >
                        {isLoading ? <Loading type="dots" /> : 'Rejoindre'}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          
          <button 
            className="spy-button tertiary" 
            onClick={() => setCurrentScreen('home')}
            disabled={isLoading}
          >
            ← Retour
          </button>
        </div>
      </div>
      <ConnectionStatus ws={ws} />
    </div>
  );

  const renderLobby = () => (
    <div className="screen lobby-screen">
      <div className="spy-background">
        <MatrixRain />
        <Particles />
        <div className="content-overlay">
          <TypingText text="Salon d'attente" className="screen-title" speed={60} />
          
          {sessionCode && (
            <div className="session-code">
              <p>Code de la partie: <strong>{sessionCode}</strong></p>
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ 
                    width: `${(gameSession?.players?.length || 0) * 5}%` 
                  }}
                ></div>
              </div>
            </div>
          )}
          
          <div className="player-list">
            <div className="player-count">
              <div className={`player-count-badge ${
                gameSession?.players?.length === 20 ? 'player-count-full' : 
                gameSession?.players?.length >= 10 ? 'player-count-ready' : ''
              }`}>
                👥 {gameSession?.players?.length || 0}/20 joueurs
              </div>
            </div>
            <div className="players-grid">
              {gameSession?.players?.map((player, index) => (
                <div 
                  key={player.id} 
                  className={`player-card ${player.is_host ? 'host' : ''}`}
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <span className="player-name">{player.name}</span>
                  {player.is_host && <span className="host-badge">👑 Hôte</span>}
                  <div className="player-status online">● En ligne</div>
                </div>
              ))}
              
              {/* Placeholder cards for missing players */}
              {Array.from({ length: 20 - (gameSession?.players?.length || 0) }, (_, i) => (
                <div key={`empty-${i}`} className="player-card" style={{ opacity: 0.3 }}>
                  <span className="player-name">En attente...</span>
                  <div className="player-status offline">● Libre</div>
                </div>
              ))}
            </div>
          </div>
          
          {gameMessage && (
            <div className="game-message">
              <TypingText text={gameMessage} speed={50} />
            </div>
          )}
          
          {isHost && gameSession?.players?.length === 20 && (
            <button className="spy-button primary large pulse" onClick={startGame}>
              🚀 Commencer la partie
            </button>
          )}
          
          {isHost && gameSession?.players?.length < 20 && (
            <div className="waiting-message">
              <TypingText 
                text={`En attente de ${20 - (gameSession?.players?.length || 0)} joueurs pour commencer...`} 
                speed={50} 
              />
            </div>
          )}
          
          {!isHost && (
            <div className="waiting-message">
              <TypingText text="En attente que l'hôte démarre la partie..." speed={50} />
            </div>
          )}
          
          <button 
            className="spy-button tertiary" 
            onClick={() => setCurrentScreen('home')}
          >
            ← Quitter le salon
          </button>
        </div>
      </div>
      <ConnectionStatus ws={ws} />
    </div>
  );

  const renderGame = () => (
    <div className="screen game-screen">
      <div className="spy-background">
        <MatrixRain />
        <Particles />
        <div className="content-overlay">
          <div className="game-header">
            <GlitchText text="Double Spies" className="h2" />
            <div className="game-info">
              <div className="role-info">
                <span className={`role-badge ${playerRole?.toLowerCase()}`}>
                  {playerRole === 'MasterMind' && '🕵️ MasterMind'}
                  {playerRole === 'Visitor' && '👤 Visitor'}
                  {playerRole === 'Tester' && '🔍 Tester'}
                </span>
                {playerWord && (
                  <span className="word-badge">
                    💭 Mot: {playerWord}
                  </span>
                )}
              </div>
              <div className="phase-info">
                <span className={`phase-badge ${currentPhase === 'synonym_writing' ? 'active' : ''}`}>
                  {currentPhase === 'synonym_writing' && '✍️ Écriture'}
                  {currentPhase === 'voting' && '🗳️ Vote'}
                  {currentPhase === 'finished' && '🏁 Terminé'}
                </span>
              </div>
            </div>
          </div>
          
          {gameMessage && (
            <div className={`game-message ${
              gameMessage.includes('gagné') ? 'success' : 
              gameMessage.includes('éliminé') ? 'error' : 'warning'
            }`}>
              <TypingText text={gameMessage} speed={50} />
            </div>
          )}
          
          {currentPhase === 'synonym_writing' && (
            <div className="synonym-phase">
              <h3>✍️ Écrivez un synonyme</h3>
              {playerRole === 'MasterMind' && (
                <div className="role-instruction">
                  🕵️ <strong>MasterMind:</strong> Vous devez deviner le mot et écrire un synonyme plausible pour vous fondre dans la masse.
                </div>
              )}
              {playerRole === 'Visitor' && (
                <div className="role-instruction">
                  👤 <strong>Visitor:</strong> Vous avez un mot différent. Essayez de vous fondre dans la masse en écrivant un synonyme créatif.
                </div>
              )}
              {playerRole === 'Tester' && (
                <div className="role-instruction">
                  🔍 <strong>Tester:</strong> Écrivez un synonyme de votre mot pour aider les autres Testers à vous identifier.
                </div>
              )}
              
              <div className="synonym-input">
                <div className="input-group">
                  <label className="input-label">Votre synonyme</label>
                  <input
                    type="text"
                    placeholder="Entrez votre synonyme..."
                    value={currentSynonym}
                    onChange={(e) => setCurrentSynonym(e.target.value)}
                    className="spy-input"
                    maxLength={50}
                  />
                </div>
                <button 
                  className="spy-button primary glow" 
                  onClick={submitSynonym}
                  disabled={!currentSynonym || isLoading}
                >
                  {isLoading ? <Loading type="dots" /> : '📝 Soumettre'}
                </button>
              </div>
            </div>
          )}
          
          {currentPhase === 'voting' && (
            <div className="voting-phase">
              <h3>🗳️ Vote d'élimination</h3>
              <p>Analysez les synonymes et choisissez un joueur à éliminer:</p>
              
              <div className="synonyms-list">
                {Object.entries(synonyms).map(([playerId, synonym], index) => {
                  const player = gameSession?.players?.find(p => p.id === playerId);
                  return (
                    <div 
                      key={playerId} 
                      className="synonym-item"
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
                      <span className="player-name">👤 {player?.name}: </span>
                      <span className="synonym">"{synonym}"</span>
                    </div>
                  );
                })}
              </div>
              
              <div className="vote-section">
                <div className="input-group">
                  <label className="input-label">Choisir un joueur à éliminer</label>
                  <select 
                    value={selectedVote} 
                    onChange={(e) => setSelectedVote(e.target.value)}
                    className="spy-select"
                  >
                    <option value="">-- Sélectionnez un joueur --</option>
                    {gameSession?.players?.filter(p => p.is_alive && p.id !== playerId).map(player => (
                      <option key={player.id} value={player.id}>
                        👤 {player.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button 
                  className="spy-button primary glow" 
                  onClick={submitVote}
                  disabled={!selectedVote || isLoading}
                >
                  {isLoading ? <Loading type="dots" /> : '🗳️ Voter'}
                </button>
              </div>
            </div>
          )}
          
          {currentPhase === 'finished' && (
            <div className="game-finished">
              <h3>🏁 Partie terminée!</h3>
              <div className={`final-message ${
                gameMessage.includes('Testers') ? 'victory' : 
                gameMessage.includes('MasterMind') || gameMessage.includes('Visitor') ? 'defeat' : ''
              }`}>
                <TypingText text={gameMessage} speed={80} />
              </div>
              <button 
                className="spy-button primary large pulse" 
                onClick={() => setCurrentScreen('home')}
              >
                🏠 Retour à l'accueil
              </button>
            </div>
          )}
        </div>
      </div>
      <ConnectionStatus ws={ws} />
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

export default App;
