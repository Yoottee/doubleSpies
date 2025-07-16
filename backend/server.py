from fastapi import FastAPI, APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Dict, Optional
import uuid
from datetime import datetime
import asyncio
import json
import requests
import random

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}
        self.player_sessions: Dict[str, str] = {}  # player_id -> session_id

    async def connect(self, websocket: WebSocket, session_id: str, player_id: str):
        await websocket.accept()
        if session_id not in self.active_connections:
            self.active_connections[session_id] = []
        self.active_connections[session_id].append(websocket)
        self.player_sessions[player_id] = session_id

    def disconnect(self, websocket: WebSocket, session_id: str, player_id: str):
        if session_id in self.active_connections:
            self.active_connections[session_id].remove(websocket)
        if player_id in self.player_sessions:
            del self.player_sessions[player_id]

    async def send_to_session(self, session_id: str, message: dict):
        if session_id in self.active_connections:
            for connection in self.active_connections[session_id]:
                try:
                    await connection.send_text(json.dumps(message))
                except:
                    # Remove broken connections
                    self.active_connections[session_id].remove(connection)

manager = ConnectionManager()

# Models
class Player(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    role: Optional[str] = None
    word: Optional[str] = None
    is_alive: bool = True
    is_host: bool = False

class GameSession(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    code: Optional[str] = None
    is_public: bool = True
    host_id: str
    players: List[Player] = []
    game_state: str = "waiting"  # waiting, playing, finished
    current_round: int = 1
    current_phase: str = "joining"  # joining, synonym_writing, voting, results
    current_word: Optional[str] = None
    used_words: List[str] = []
    synonyms: Dict[str, str] = {}  # player_id -> synonym
    votes: Dict[str, str] = {}  # voter_id -> voted_player_id
    eliminated_players: List[str] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)

class JoinGameRequest(BaseModel):
    player_name: str
    session_id: Optional[str] = None
    session_code: Optional[str] = None

class SubmitSynonymRequest(BaseModel):
    session_id: str
    player_id: str
    synonym: str

class VoteRequest(BaseModel):
    session_id: str
    voter_id: str
    voted_player_id: str

# Game logic functions
async def get_random_word():
    """Get a random French word from external API"""
    try:
        response = requests.get(
            "https://random-words-api.kushcreates.com/api",
            params={"language": "fr", "words": 1, "length": 6},
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            if data and len(data) > 0:
                return data[0]
    except:
        pass
    
    # Fallback words in case API fails
    fallback_words = [
        "maison", "jardin", "soleil", "livre", "musique", "voyage", "bonheur", "famille",
        "amour", "nature", "école", "liberté", "temps", "espoir", "rêve", "océan",
        "montagne", "étoile", "fleur", "sourire", "courage", "paix", "aventure", "créativité"
    ]
    return random.choice(fallback_words)

def assign_roles_and_words(players: List[Player], main_word: str):
    """Assign roles and words to players"""
    if len(players) != 20:
        raise HTTPException(status_code=400, detail="Game requires exactly 20 players")
    
    # Shuffle players
    shuffled_players = players.copy()
    random.shuffle(shuffled_players)
    
    # Assign roles
    # 1 MasterMind, 1 Visitor, 18 Testers
    shuffled_players[0].role = "MasterMind"
    shuffled_players[1].role = "Visitor"
    for i in range(2, 20):
        shuffled_players[i].role = "Tester"
    
    # Generate visitor word (different from main word)
    visitor_word = main_word
    while visitor_word == main_word:
        visitor_word = asyncio.create_task(get_random_word())
    
    # Assign words
    for player in shuffled_players:
        if player.role == "MasterMind":
            player.word = None  # MasterMind doesn't get a word
        elif player.role == "Visitor":
            player.word = visitor_word
        else:  # Tester
            player.word = main_word

def check_win_condition(players: List[Player]):
    """Check if game has ended and determine winner"""
    alive_players = [p for p in players if p.is_alive]
    testers = [p for p in alive_players if p.role == "Tester"]
    mastermind = [p for p in alive_players if p.role == "MasterMind"]
    visitor = [p for p in alive_players if p.role == "Visitor"]
    
    # If only Testers remain, Testers win
    if len(alive_players) == len(testers) and len(testers) > 0:
        return "Testers"
    
    # If only 1 Tester + MasterMind or 1 Tester + Visitor, the special role wins
    if len(alive_players) == 2 and len(testers) == 1:
        if len(mastermind) == 1:
            return "MasterMind"
        elif len(visitor) == 1:
            return "Visitor"
    
    # If no Testers remain, Visitor wins
    if len(testers) == 0 and len(visitor) > 0:
        return "Visitor"
    
    return None

# API Routes
@api_router.post("/create-session")
async def create_session(player_name: str, is_public: bool = True):
    """Create a new game session"""
    host_player = Player(name=player_name, is_host=True)
    
    session = GameSession(
        host_id=host_player.id,
        players=[host_player],
        is_public=is_public
    )
    
    if not is_public:
        # Generate 6-digit code for private rooms
        session.code = str(random.randint(100000, 999999))
    
    # Save to database
    await db.game_sessions.insert_one(session.dict())
    
    return {
        "session_id": session.id,
        "session_code": session.code,
        "player_id": host_player.id,
        "is_host": True
    }

@api_router.post("/join-session")
async def join_session(request: JoinGameRequest):
    """Join an existing game session"""
    # Find session by ID or code
    query = {}
    if request.session_id:
        query["id"] = request.session_id
    elif request.session_code:
        query["code"] = request.session_code
    else:
        raise HTTPException(status_code=400, detail="Session ID or code required")
    
    session_data = await db.game_sessions.find_one(query)
    if not session_data:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = GameSession(**session_data)
    
    if session.game_state != "waiting":
        raise HTTPException(status_code=400, detail="Game has already started")
    
    if len(session.players) >= 20:
        raise HTTPException(status_code=400, detail="Session is full")
    
    # Check if name already taken
    if any(p.name == request.player_name for p in session.players):
        raise HTTPException(status_code=400, detail="Name already taken")
    
    # Add player
    new_player = Player(name=request.player_name)
    session.players.append(new_player)
    
    # Update database
    await db.game_sessions.update_one(
        {"id": session.id},
        {"$set": {"players": [p.dict() for p in session.players]}}
    )
    
    # Notify all players
    await manager.send_to_session(session.id, {
        "type": "player_joined",
        "player": new_player.dict(),
        "total_players": len(session.players)
    })
    
    return {
        "session_id": session.id,
        "player_id": new_player.id,
        "is_host": False
    }

@api_router.get("/session/{session_id}")
async def get_session(session_id: str):
    """Get session details"""
    session_data = await db.game_sessions.find_one({"id": session_id})
    if not session_data:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = GameSession(**session_data)
    return {
        "session": session.dict(),
        "can_start": len(session.players) == 20 and session.game_state == "waiting"
    }

@api_router.post("/start-game/{session_id}")
async def start_game(session_id: str, host_id: str):
    """Start the game (only host can start)"""
    session_data = await db.game_sessions.find_one({"id": session_id})
    if not session_data:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = GameSession(**session_data)
    
    if session.host_id != host_id:
        raise HTTPException(status_code=403, detail="Only host can start game")
    
    if len(session.players) != 20:
        raise HTTPException(status_code=400, detail="Need exactly 20 players to start")
    
    if session.game_state != "waiting":
        raise HTTPException(status_code=400, detail="Game already started")
    
    # Get random word and assign roles
    main_word = await get_random_word()
    assign_roles_and_words(session.players, main_word)
    
    # Update session
    session.game_state = "playing"
    session.current_phase = "synonym_writing"
    session.current_word = main_word
    session.used_words = [main_word]
    
    # Update database
    await db.game_sessions.update_one(
        {"id": session_id},
        {"$set": session.dict()}
    )
    
    # Notify all players with their roles (privately)
    for player in session.players:
        await manager.send_to_session(session_id, {
            "type": "game_started",
            "player_id": player.id,
            "role": player.role,
            "word": player.word,
            "phase": "synonym_writing",
            "round": 1
        })
    
    return {"message": "Game started"}

@api_router.post("/submit-synonym")
async def submit_synonym(request: SubmitSynonymRequest):
    """Submit a synonym for current round"""
    session_data = await db.game_sessions.find_one({"id": request.session_id})
    if not session_data:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = GameSession(**session_data)
    
    if session.current_phase != "synonym_writing":
        raise HTTPException(status_code=400, detail="Not in synonym writing phase")
    
    # Find player
    player = next((p for p in session.players if p.id == request.player_id), None)
    if not player or not player.is_alive:
        raise HTTPException(status_code=400, detail="Player not found or eliminated")
    
    # Store synonym
    session.synonyms[request.player_id] = request.synonym
    
    # Update database
    await db.game_sessions.update_one(
        {"id": request.session_id},
        {"$set": {"synonyms": session.synonyms}}
    )
    
    # Check if all alive players submitted
    alive_players = [p for p in session.players if p.is_alive]
    if len(session.synonyms) == len(alive_players):
        # Move to voting phase
        session.current_phase = "voting"
        session.votes = {}
        
        await db.game_sessions.update_one(
            {"id": request.session_id},
            {"$set": {"current_phase": "voting", "votes": {}}}
        )
        
        # Notify all players
        await manager.send_to_session(request.session_id, {
            "type": "phase_change",
            "phase": "voting",
            "synonyms": session.synonyms
        })
    
    return {"message": "Synonym submitted"}

@api_router.post("/vote")
async def vote(request: VoteRequest):
    """Vote to eliminate a player"""
    session_data = await db.game_sessions.find_one({"id": request.session_id})
    if not session_data:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = GameSession(**session_data)
    
    if session.current_phase != "voting":
        raise HTTPException(status_code=400, detail="Not in voting phase")
    
    # Validate voter and voted player
    voter = next((p for p in session.players if p.id == request.voter_id), None)
    voted_player = next((p for p in session.players if p.id == request.voted_player_id), None)
    
    if not voter or not voter.is_alive:
        raise HTTPException(status_code=400, detail="Voter not found or eliminated")
    
    if not voted_player or not voted_player.is_alive:
        raise HTTPException(status_code=400, detail="Voted player not found or eliminated")
    
    if request.voter_id == request.voted_player_id:
        raise HTTPException(status_code=400, detail="Cannot vote for yourself")
    
    # Store vote
    session.votes[request.voter_id] = request.voted_player_id
    
    # Update database
    await db.game_sessions.update_one(
        {"id": request.session_id},
        {"$set": {"votes": session.votes}}
    )
    
    # Check if all alive players voted
    alive_players = [p for p in session.players if p.is_alive]
    if len(session.votes) == len(alive_players):
        # Process votes and eliminate player
        vote_counts = {}
        for voted_id in session.votes.values():
            vote_counts[voted_id] = vote_counts.get(voted_id, 0) + 1
        
        # Find player with most votes
        eliminated_id = max(vote_counts, key=vote_counts.get)
        eliminated_player = next(p for p in session.players if p.id == eliminated_id)
        eliminated_player.is_alive = False
        session.eliminated_players.append(eliminated_id)
        
        # Check win condition
        winner = check_win_condition(session.players)
        
        if winner:
            session.game_state = "finished"
            session.current_phase = "finished"
            
            await db.game_sessions.update_one(
                {"id": request.session_id},
                {"$set": session.dict()}
            )
            
            # Notify game ended
            await manager.send_to_session(request.session_id, {
                "type": "game_ended",
                "winner": winner,
                "eliminated_player": eliminated_player.dict(),
                "vote_counts": vote_counts
            })
        else:
            # Continue to next round
            session.current_round += 1
            session.current_phase = "synonym_writing"
            session.synonyms = {}
            session.votes = {}
            
            await db.game_sessions.update_one(
                {"id": request.session_id},
                {"$set": session.dict()}
            )
            
            # Notify next round
            await manager.send_to_session(request.session_id, {
                "type": "round_results",
                "eliminated_player": eliminated_player.dict(),
                "vote_counts": vote_counts,
                "next_round": session.current_round,
                "phase": "synonym_writing"
            })
    
    return {"message": "Vote submitted"}

@api_router.get("/public-sessions")
async def get_public_sessions():
    """Get list of public sessions waiting for players"""
    sessions = await db.game_sessions.find({
        "is_public": True,
        "game_state": "waiting"
    }).to_list(50)
    
    return [{
        "id": s["id"],
        "host_name": next(p["name"] for p in s["players"] if p["is_host"]),
        "player_count": len(s["players"]),
        "created_at": s["created_at"]
    } for s in sessions]

# WebSocket endpoint
@app.websocket("/ws/{session_id}/{player_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str, player_id: str):
    await manager.connect(websocket, session_id, player_id)
    try:
        while True:
            data = await websocket.receive_text()
            # Handle incoming messages if needed
            pass
    except WebSocketDisconnect:
        manager.disconnect(websocket, session_id, player_id)

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()