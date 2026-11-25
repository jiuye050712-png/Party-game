import React, { useEffect, useState } from 'react';
import { ref, onValue, set, update } from 'firebase/database';
import { db } from './firebase';
import { pickRandomAuctionItems } from './data/auctionItems';
import Lobby from './components/Lobby';
import NumberBomb from './components/NumberBomb';
import AuctionGame from './components/AuctionGame';
import LifeboatGame from './components/LifeboatGame';
import HiddenRound from './components/HiddenRound';

function generateRoomId() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export default function App() {
  const [roomId, setRoomId] = useState('');
  const [joinInput, setJoinInput] = useState('');
  const [roomData, setRoomData] = useState(null);
  const [myPlayerId, setMyPlayerId] = useState('');
  const [copied, setCopied] = useState(false);

  // 支持通过链接 ?room=1234 直接进入房间
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlRoom = params.get('room');
    if (urlRoom) {
      setRoomId(urlRoom);
      const savedPid = localStorage.getItem(`party_player_${urlRoom}`);
      if (savedPid) setMyPlayerId(savedPid);
    }
  }, []);

  // 订阅 Firebase 房间实时数据
  useEffect(() => {
    if (!roomId) return;
    const roomRef = ref(db, `rooms/${roomId}`);
    const unsub = onValue(roomRef, (snap) => {
      setRoomData(snap.val());
    });
    return () => unsub();
  }, [roomId]);

  const createNewRoom = async () => {
    const newId = generateRoomId();
    const initialRoom = {
      createdAt: Date.now(),
      stage: 'LOBBY', // LOBBY -> BOMB -> AUCTION -> LIFEBOAT -> HIDDEN
      players: {},
      bombState: {
        min: 0,
        max: 1000,
        target: Math.floor(Math.random() * 999) + 1,
        turnIndex: 0,
        explodedPlayer: '',
        history: []
      },
      auctionState: {
        items: [],
        currentIndex: 0,
        bids: {},
        logs: [],
        revealed: false
      },
      lifeboatState: {
        round: 1,
        choices: {},
        lastResult: ''
      },
      hiddenState: {
        winnerIds: [],
        winnerActions: {},
        loserRaids: {},
        settled: false,
        logs: []
      }
    };

    await set(ref(db, `rooms/${newId}`), initialRoom);
    const nextUrl = `${window.location.origin}${window.location.pathname}?room=${newId}`;
    window.history.replaceState({}, '', nextUrl);
    setRoomId(newId);
  };

  const handleJoinByCode = () => {
    const code = joinInput.trim();
    if (!code) return;
    const nextUrl = `${window.location.origin}${window.location.pathname}?room=${code}`;
    window.history.replaceState({}, '', nextUrl);
    setRoomId(code);
    const savedPid = localStorage.getItem(`party_player_${code}`);
    if (savedPid) setMyPlayerId(savedPid);
  };

  const handleCopyInviteLink = async () => {
    const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt('复制下方链接发给朋友：', inviteUrl);
    }
  };

  const playersList = roomData?.players ? Object.values(roomData.players) : [];

  const startRound1Bomb = async () => {
    await update(ref(db, `rooms/${roomId}`), {
      stage: 'BOMB',
      bombState: {
        min: 0,
        max: 1000,
        target: Math.floor(Math.random() * 999) + 1,
        turnIndex: 0,
        explodedPlayer: '',
        history: []
      }
    });
  };

  const startRound2Auction = async () => {
    const nineItems = pickRandomAuctionItems(9);
    await update(ref(db, `rooms/${roomId}`), {
      stage: 'AUCTION',
      auctionState: {
        items: nineItems,
        currentIndex: 0,
        bids: {},
        logs: [],
        revealed: false
      }
    });
  };

  const startRound3Lifeboat = async () => {
    const resetUpdates = {
      stage: 'LIFEBOAT',
      lifeboatState: {
        round: 1,
        choices: {},
        lastResult: ''
      }
    };
    playersList.forEach((p) => {
      resetUpdates[`players/${p.id}/alive`] = true;
    });
    await update(ref(db, `rooms/${roomId}`), resetUpdates);
  };

  const startHiddenRound = async (winnerIds) => {
    await update(ref(db, `rooms/${roomId}`), {
      stage: 'HIDDEN',
      hiddenState: {
        winnerIds,
        winnerActions: {},
        loserRaids: {},
        settled: false,
        logs: []
      }
    });
  };

  const restartEntireGame = async () => {
    const updates = {
      stage: 'LOBBY',
      bombState: {
        min: 0,
        max: 1000,
        target: Math.floor(Math.random() * 999) + 1,
        turnIndex: 0,
        explodedPlayer: '',
        history: []
      },
      auctionState: {
        items: [],
        currentIndex: 0,
        bids: {},
        logs: [],
        revealed: false
      },
      lifeboatState: {
        round: 1,
        choices: {},
        lastResult: ''
      },
      hiddenState: {
        winnerIds: [],
        winnerActions: {},
        loserRaids: {},
        settled: false,
        logs: []
      }
    };
    playersList.forEach((p) => {
      updates[`players/${p.id}/money`] = 100;
      updates[`players/${p.id}/alive`] = true;
      updates[`players/${p.id}/items`] = [];
    });
    await update(ref(db, `rooms/${roomId}`), updates);
  };

  if (!roomId) {
    return (
      <div style={{ maxWidth: '520px', margin: '60px auto', padding: '24px', background: '#fff', borderRadius: '14px', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', fontFamily: 'sans-serif' }}>
        <h1>🎲 12人联机聚会博弈场</h1>
        <p style={{ color: '#64748b' }}>创建房间后生成邀请链接，好友点开即可跨设备实时联机。</p>

        <button
          onClick={createNewRoom}
          style={{ width: '100%', padding: '14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '20px' }}
        >
          ➕ 创建新房间（自动生成邀请链接）
        </button>

        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            placeholder="或输入 4 位房间号加入..."
            value={joinInput}
            onChange={(e) => setJoinInput(e.target.value)}
            style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
          />
          <button
            onClick={handleJoinByCode}
            style={{ padding: '10px 18px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
          >
            加入房间
          </button>
        </div>
      </div>
    );
  }

  if (!roomData) {
    return <div style={{ textAlign: 'center', marginTop: '80px', fontFamily: 'sans-serif' }}>⏳ 正在连接房间 #{roomId} ...</div>;
  }

  return (
    <div style={{ maxWidth: '900px', margin: '24px auto', padding: '0 16px', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', background: '#0f172a', color: '#fff', padding: '14px 20px', borderRadius: '12px', marginBottom: '16px' }}>
        <div>
          <strong>房间号：#{roomId}</strong> · 当前阶段：<strong>{roomData.stage}</strong>
        </div>
        <button
          onClick={handleCopyInviteLink}
          style={{ padding: '8px 14px', background: '#22c55e', color: '#052e16', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
        >
          {copied ? '✅ 链接已复制！' : '🔗 复制邀请链接'}
        </button>
      </div>

      {/* 实时资金与存活状态栏 */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
        {playersList.map((p) => (
          <div
            key={p.id}
            style={{
              padding: '6px 12px',
              borderRadius: '999px',
              background: p.id === myPlayerId ? '#dbeafe' : '#f1f5f9',
              border: p.id === myPlayerId ? '1px solid #3b82f6' : '1px solid #e2e8f0',
              fontSize: '13px',
              opacity: p.alive === false ? 0.55 : 1
            }}
          >
            {p.alive === false ? '💀 ' : ''}
            <strong>{p.name}</strong>：{p.money} 万
          </div>
        ))}
      </div>

      {roomData.stage === 'LOBBY' && (
        <Lobby
          roomId={roomId}
          playersList={playersList}
          myPlayerId={myPlayerId}
          setMyPlayerId={setMyPlayerId}
          onStartGame={startRound1Bomb}
        />
      )}

      {roomData.stage === 'BOMB' && (
        <NumberBomb
          roomId={roomId}
          playersList={playersList}
          myPlayerId={myPlayerId}
          bombState={roomData.bombState}
          onNextStage={startRound2Auction}
        />
      )}

      {roomData.stage === 'AUCTION' && (
        <AuctionGame
          roomId={roomId}
          playersList={playersList}
          myPlayerId={myPlayerId}
          auctionState={roomData.auctionState}
          onNextStage={startRound3Lifeboat}
        />
      )}

      {roomData.stage === 'LIFEBOAT' && (
        <LifeboatGame
          roomId={roomId}
          playersList={playersList}
          myPlayerId={myPlayerId}
          lifeboatState={roomData.lifeboatState}
          onFinish={startHiddenRound}
        />
      )}

      {roomData.stage === 'HIDDEN' && (
        <HiddenRound
          roomId={roomId}
          playersList={playersList}
          myPlayerId={myPlayerId}
          winnerIds={roomData.hiddenState?.winnerIds || []}
          hiddenState={roomData.hiddenState || {}}
          onRestartAll={restartEntireGame}
        />
      )}
    </div>
  );
}