import React, { useState } from 'react';
import { ref, set, remove } from 'firebase/database';
import { db } from '../firebase';

export default function Lobby({ roomId, playersList, myPlayerId, setMyPlayerId, onStartGame }) {
  const [myName, setMyName] = useState('');
  const [manualName, setManualName] = useState('');

  const handleJoinSelf = async () => {
    if (!myName.trim()) return;
    if (playersList.length >= 12) {
      return alert('房间已满 12 人上限！');
    }
    const id = 'p_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    await set(ref(db, `rooms/${roomId}/players/${id}`), {
      id,
      name: myName.trim(),
      money: 100,
      alive: true,
      items: []
    });
    localStorage.setItem(`party_player_${roomId}`, id);
    setMyPlayerId(id);
    setMyName('');
  };

  const handleManualAdd = async () => {
    if (!manualName.trim()) return;
    if (playersList.length >= 12) {
      return alert('房间已满 12 人上限！');
    }
    const id = 'manual_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    await set(ref(db, `rooms/${roomId}/players/${id}`), {
      id,
      name: manualName.trim(),
      money: 100,
      alive: true,
      items: []
    });
    setManualName('');
  };

  const handleRemove = async (id) => {
    await remove(ref(db, `rooms/${roomId}/players/${id}`));
    if (id === myPlayerId) {
      localStorage.removeItem(`party_player_${roomId}`);
      setMyPlayerId('');
    }
  };

  const amIJoined = playersList.some((p) => p.id === myPlayerId);

  return (
    <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
      <h2>🏠 玩家集结大厅（已加入 {playersList.length} / 12 人）</h2>

      {!amIJoined ? (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          <input
            placeholder="输入你的名字加入游戏..."
            value={myName}
            onChange={(e) => setMyName(e.target.value)}
            style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
          />
          <button onClick={handleJoinSelf} style={{ padding: '10px 18px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
            ✅ 确认加入
          </button>
        </div>
      ) : (
        <div style={{ padding: '10px 14px', background: '#dcfce7', color: '#166534', borderRadius: '8px', marginBottom: '16px' }}>
          ✅ 你已成功加入房间！可复制上方链接发给其他朋友一起进来。
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px', marginBottom: '20px' }}>
        {playersList.map((p, i) => (
          <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#f1f5f9', borderRadius: '8px' }}>
            <span><strong>{i + 1}. {p.name}</strong> ✅ 已就绪</span>
            <button onClick={() => handleRemove(p.id)} style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer' }}>✕</button>
          </div>
        ))}
      </div>

      <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px', marginBottom: '20px' }}>
        <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '8px' }}>手动补录玩家（适合线下现场或未点开链接的同伴）：</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            placeholder="输入玩家昵称后手动添加"
            value={manualName}
            onChange={(e) => setManualName(e.target.value)}
            style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
          />
          <button onClick={handleManualAdd} style={{ padding: '8px 14px', background: '#475569', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
            + 手动添加
          </button>
        </div>
      </div>

      <button
        disabled={playersList.length < 2}
        onClick={onStartGame}
        style={{ width: '100%', padding: '14px', background: playersList.length >= 2 ? '#2563eb' : '#94a3b8', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}
      >
        🚀 开启第一轮：数字大爆炸（0 - 1000）
      </button>
    </div>
  );
}