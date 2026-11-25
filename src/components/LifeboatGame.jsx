import React from 'react';
import { ref, update } from 'firebase/database';
import { db } from '../firebase';

export default function LifeboatGame({ roomId, playersList, myPlayerId, lifeboatState, onFinish }) {
  const alivePlayers = playersList.filter((p) => p.alive);
  const capacity = Math.max(1, Math.floor(alivePlayers.length / 2));
  const choices = lifeboatState.choices || {};

  const myPlayer = alivePlayers.find((p) => p.id === myPlayerId);
  const completedCount = alivePlayers.filter((p) => choices[p.id]).length;
  const allCompleted = completedCount === alivePlayers.length && alivePlayers.length > 0;

  const handleChoose = async (decision) => {
    if (!myPlayer) return;
    await update(ref(db, `rooms/${roomId}/lifeboatState/choices`), {
      [myPlayer.id]: decision
    });
  };

  const handleResolveRound = async () => {
    const boarders = alivePlayers.filter((p) => choices[p.id] === 'BOARD');
    const stayers = alivePlayers.filter((p) => choices[p.id] === 'STAY');
    const isOverloaded = boarders.length > capacity;

    const updates = {};
    let resultSummary = '';

    if (isOverloaded) {
      boarders.forEach((p) => {
        updates[`rooms/${roomId}/players/${p.id}/alive`] = false;
      });
      resultSummary = `💥 救生艇超载（限载 ${capacity} 人，实际挤上 ${boarders.length} 人）！所有上船者淘汰，留守者（${stayers.map((s) => s.name).join('、') || '无'}）晋级！`;
    } else {
      stayers.forEach((p) => {
        updates[`rooms/${roomId}/players/${p.id}/alive`] = false;
      });
      resultSummary = `⛵ 成功起航（限载 ${capacity} 人，上船 ${boarders.length} 人）！上船者（${boarders.map((b) => b.name).join('、') || '无'}）晋级，留守者淘汰！`;
    }

    const remaining = isOverloaded ? stayers : boarders;
    updates[`rooms/${roomId}/lifeboatState/choices`] = {};
    updates[`rooms/${roomId}/lifeboatState/round`] = (lifeboatState.round || 1) + 1;
    updates[`rooms/${roomId}/lifeboatState/lastResult`] = resultSummary;

    await update(ref(db), updates);

    if (remaining.length <= 3) {
      let winnerIds = remaining.map((p) => p.id);
      if (winnerIds.length < 3) {
        const candidates = alivePlayers
          .filter((p) => !winnerIds.includes(p.id))
          .sort((a, b) => b.money - a.money);
        while (winnerIds.length < 3 && candidates.length > 0) {
          winnerIds.push(candidates.shift().id);
        }
      }
      onFinish(winnerIds);
    }
  };

  return (
    <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
      <h2>🚢 第三轮：救生艇超载 — 第 {lifeboatState.round} 轮（决出 3 名胜者）</h2>
      <p style={{ color: '#475569' }}>
        当前存活 <strong>{alivePlayers.length}</strong> 人（剩余 ≤ 3 人即晋级为三大守擂王），本轮救生艇限载：<strong style={{ color: '#dc2626', fontSize: '18px' }}>{capacity} 人</strong>。
        <br />• 上船人数 ≤ {capacity}：上船者晋级，留守者淘汰；
        <br />• 上船人数 ＞ {capacity}（超载翻船）：上船者全员淘汰，留守者晋级！
      </p>

      {lifeboatState.lastResult && (
        <div style={{ padding: '12px 16px', background: '#fef3c7', color: '#92400e', borderRadius: '8px', marginBottom: '16px', fontWeight: 'bold' }}>
          📢 上轮战报：{lifeboatState.lastResult}
        </div>
      )}

      {myPlayer ? (
        !choices[myPlayer.id] ? (
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
            <button onClick={() => handleChoose('BOARD')} style={{ flex: 1, padding: '16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>
              🏃‍♂️ 冒险上船（抢占席位）
            </button>
            <button onClick={() => handleChoose('STAY')} style={{ flex: 1, padding: '16px', background: '#475569', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>
              🧍‍♂️ 原地留守（赌他们超载）
            </button>
          </div>
        ) : (
          <div style={{ padding: '12px', background: '#dcfce7', color: '#166534', borderRadius: '8px', marginBottom: '16px' }}>
            ✅ 你已锁定选择（{choices[myPlayer.id] === 'BOARD' ? '上船' : '留守'}），等待其他存活玩家...
          </div>
        )
      ) : (
        <div style={{ padding: '12px', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '16px' }}>
          💀 你已淘汰，正在观战最终 3 名胜者诞生...
        </div>
      )}

      <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>实时决策进度（{completedCount} / {alivePlayers.length} 已完成）：</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '8px', marginBottom: '16px' }}>
        {alivePlayers.map((p) => {
          const done = Boolean(choices[p.id]);
          return (
            <div key={p.id} style={{ padding: '8px 12px', borderRadius: '6px', background: done ? '#dcfce7' : '#f1f5f9', color: done ? '#166534' : '#64748b' }}>
              {done ? `✅ ${p.name} 已完成` : `⏳ ${p.name} 抉择中...`}
            </div>
          );
        })}
      </div>

      {allCompleted && (
        <button onClick={handleResolveRound} style={{ width: '100%', padding: '14px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>
          🚨 全员已完成，揭晓救生艇是否超载！
        </button>
      )}
    </div>
  );
}