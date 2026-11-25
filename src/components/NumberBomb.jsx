import React, { useState } from 'react';
import { ref, update } from 'firebase/database';
import { db } from '../firebase';

export default function NumberBomb({ roomId, playersList, myPlayerId, bombState, onNextStage }) {
  const [guess, setGuess] = useState('');
  const currentPlayer = playersList[bombState.turnIndex % playersList.length];
  const isMyTurn = currentPlayer?.id === myPlayerId;

  const handleGuess = async () => {
    const num = parseInt(guess, 10);
    if (isNaN(num) || num <= bombState.min || num >= bombState.max) {
      alert(`请输入 ${bombState.min} 到 ${bombState.max} 之间的整数（不含边界）！`);
      return;
    }

    const updates = {};
    if (num === bombState.target) {
      updates[`rooms/${roomId}/players/${currentPlayer.id}/money`] = Math.max(0, currentPlayer.money - 30);
      updates[`rooms/${roomId}/bombState/explodedPlayer`] = currentPlayer.name;
      updates[`rooms/${roomId}/bombState/history`] = [
        ...(bombState.history || []),
        `💥 ${currentPlayer.name} 报出 ${num}，引爆炸弹！扣除 30 万！`
      ];
    } else {
      const newMin = num < bombState.target ? num : bombState.min;
      const newMax = num > bombState.target ? num : bombState.max;
      updates[`rooms/${roomId}/players/${currentPlayer.id}/money`] = currentPlayer.money + 5;
      updates[`rooms/${roomId}/bombState/min`] = newMin;
      updates[`rooms/${roomId}/bombState/max`] = newMax;
      updates[`rooms/${roomId}/bombState/turnIndex`] = bombState.turnIndex + 1;
      updates[`rooms/${roomId}/bombState/history`] = [
        ...(bombState.history || []),
        `✅ ${currentPlayer.name} 报出 ${num}（安全 +5万）-> 区间 [${newMin} ~ ${newMax}]`
      ];
    }

    setGuess('');
    await update(ref(db), updates);
  };

  return (
    <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
      <h2>💣 第一轮：数字大爆炸（0 - 1000）</h2>
      <p style={{ color: '#64748b' }}>规则：安全报数奖励 <strong>+5万</strong>，引爆炸弹扣除 <strong>30万</strong>！</p>

      <div style={{ textAlign: 'center', padding: '24px', background: '#0f172a', color: '#38bdf8', borderRadius: '12px', margin: '16px 0' }}>
        <div style={{ fontSize: '14px', color: '#94a3b8' }}>当前安全区间</div>
        <div style={{ fontSize: '36px', fontWeight: 'bold' }}>{bombState.min}  ~  {bombState.max}</div>
      </div>

      {bombState.explodedPlayer ? (
        <div style={{ padding: '16px', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', textAlign: 'center' }}>
          <h3>💥 轰隆！{bombState.explodedPlayer} 踩中了炸弹（数字 {bombState.target}）！</h3>
          <button onClick={onNextStage} style={{ marginTop: '10px', padding: '12px 24px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
            进入第二轮：谜语鉴宝拍卖 ➡️
          </button>
        </div>
      ) : (
        <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px' }}>
          <div style={{ marginBottom: '12px', fontSize: '16px' }}>
            当前轮到：<strong>{currentPlayer?.name}</strong> 报数
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="number"
              placeholder={isMyTurn ? `输入 ${bombState.min + 1} ~ ${bombState.max - 1}` : `当前由 ${currentPlayer?.name} 报数中...`}
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
            />
            <button onClick={handleGuess} style={{ padding: '10px 20px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
              确认报数
            </button>
          </div>
        </div>
      )}

      <div style={{ marginTop: '16px', maxHeight: '160px', overflowY: 'auto', fontSize: '14px', color: '#334155' }}>
        {(bombState.history || []).slice().reverse().map((line, i) => (
          <div key={i} style={{ padding: '4px 0', borderBottom: '1px dashed #e2e8f0' }}>{line}</div>
        ))}
      </div>
    </div>
  );
}