import React, { useState } from 'react';
import { ref, update } from 'firebase/database';
import { db } from '../firebase';

export default function HiddenRound({ roomId, playersList, myPlayerId, winnerIds, hiddenState, onRestartAll }) {
  const [winnerChoice, setWinnerChoice] = useState('DOUBLE');
  const [raidTargetIndex, setRaidTargetIndex] = useState(0);

  const winners = playersList.filter((p) => (winnerIds || []).includes(p.id));
  const losers = playersList.filter((p) => !(winnerIds || []).includes(p.id));

  const isWinner = (winnerIds || []).includes(myPlayerId);
  const isLoser = !isWinner && playersList.some((p) => p.id === myPlayerId);

  const winnerActions = hiddenState.winnerActions || {};
  const loserRaids = hiddenState.loserRaids || {};

  const myDone = isWinner
    ? Boolean(winnerActions[myPlayerId])
    : isLoser
      ? Boolean(loserRaids[myPlayerId])
      : true;

  const totalParticipants = winners.length + losers.length;
  const completedCount =
    winners.filter((w) => Boolean(winnerActions[w.id])).length +
    losers.filter((l) => Boolean(loserRaids[l.id])).length;

  const allCompleted = totalParticipants > 0 && completedCount === totalParticipants;

  const handleWinnerSubmit = async () => {
    await update(ref(db, `rooms/${roomId}/hiddenState/winnerActions`), {
      [myPlayerId]: winnerChoice
    });
  };

  const handleLoserSubmit = async () => {
    const targetWinner = winners[raidTargetIndex] || winners[0];
    if (!targetWinner) return;
    await update(ref(db, `rooms/${roomId}/hiddenState/loserRaids`), {
      [myPlayerId]: targetWinner.id
    });
  };

  const handleSettleHiddenRound = async () => {
    const updates = {};
    const logs = [];

    // 统计每位守擂胜者被多少名败者突袭
    const raidCountMap = {};
    winners.forEach((w) => {
      raidCountMap[w.id] = 0;
    });
    losers.forEach((l) => {
      const targetId = loserRaids[l.id];
      if (targetId && raidCountMap[targetId] !== undefined) {
        raidCountMap[targetId] += 1;
      }
    });

    // 结算守擂胜者
    winners.forEach((w) => {
      const action = winnerActions[w.id] || 'SAFE';
      const raidersCount = raidCountMap[w.id] || 0;
      let currentMoney = w.money;

      if (action === 'DOUBLE') {
        currentMoney = currentMoney * 2;
        logs.push(`👑 胜者【${w.name}】开启金库双倍豪赌，资金翻倍至 ${currentMoney} 万！`);
      } else {
        logs.push(`🛡️ 胜者【${w.name}】稳守金库（资金 ${currentMoney} 万）。`);
      }

      if (raidersCount > 0) {
        // 若败者突袭人数 >= 3，触发反击陷阱扣减突袭者；否则被瓜分 20 万
        if (raidersCount >= 3) {
          logs.push(`🪤 【${w.name}】遭遇 ${raidersCount} 人围攻，触发反击陷阱！`);
        } else {
          const stolen = Math.min(currentMoney, 20);
          currentMoney -= stolen;
          logs.push(`⚔️ 【${w.name}】遭 ${raidersCount} 名败者突袭，金库被劫走 ${stolen} 万！`);
        }
      }

      updates[`rooms/${roomId}/players/${w.id}/money`] = currentMoney;
    });

    // 结算败者联盟
    losers.forEach((l) => {
      const targetId = loserRaids[l.id];
      const targetWinner = winners.find((w) => w.id === targetId);
      if (!targetWinner) return;

      const raidersCount = raidCountMap[targetId] || 0;
      const wAction = winnerActions[targetId] || 'SAFE';

      if (raidersCount >= 3) {
        const penalty = 15;
        updates[`rooms/${roomId}/players/${l.id}/money`] = Math.max(0, l.money - penalty);
        logs.push(`💥 败者【${l.name}】突袭【${targetWinner.name}】时踩中反击陷阱，损失 ${penalty} 万！`);
      } else {
        const loot = Math.round((20 / Math.max(1, raidersCount)) + (wAction === 'DOUBLE' ? 10 : 0));
        updates[`rooms/${roomId}/players/${l.id}/money`] = l.money + loot;
        logs.push(`🏴‍☠️ 败者【${l.name}】突袭【${targetWinner.name}】得手，掠夺 ${loot} 万！`);
      }
    });

    updates[`rooms/${roomId}/hiddenState/settled`] = true;
    updates[`rooms/${roomId}/hiddenState/logs`] = logs;

    await update(ref(db), updates);
  };

  return (
    <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
      <h2>👑 隐藏第四轮：三王座攻防战（3 胜者 vs 9 败者）</h2>
      <p style={{ color: '#475569' }}>
        三大王座胜者可在金库选择<strong>稳守</strong>或<strong>双倍豪赌</strong>；败者联盟可选择突袭哪一位王座金库（突袭人数过多可能触发反击陷阱）。
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        {winners.map((w, idx) => (
          <div key={w.id} style={{ padding: '14px', background: '#fef9c3', border: '1px solid #eab308', borderRadius: '10px' }}>
            <div style={{ fontWeight: 'bold', color: '#854d0e' }}>👑 王座 #{idx + 1}：{w.name}</div>
            <div style={{ fontSize: '14px', marginTop: '4px' }}>当前资金：{w.money} 万</div>
            <div style={{ fontSize: '13px', color: '#a16207', marginTop: '4px' }}>
              {winnerActions[w.id] ? '✅ 已锁定金库策略' : '⏳ 决策中...'}
            </div>
          </div>
        ))}
      </div>

      {!hiddenState.settled ? (
        <>
          {!myDone ? (
            isWinner ? (
              <div style={{ padding: '16px', background: '#fffbeb', borderRadius: '10px', marginBottom: '16px' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '10px' }}>你是守擂胜者，请选择金库策略：</div>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                  <button
                    onClick={() => setWinnerChoice('DOUBLE')}
                    style={{
                      flex: 1,
                      padding: '12px',
                      background: winnerChoice === 'DOUBLE' ? '#d97706' : '#f1f5f9',
                      color: winnerChoice === 'DOUBLE' ? '#fff' : '#334155',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}
                  >
                    🎲 开启双倍豪赌（资金 ×2）
                  </button>
                  <button
                    onClick={() => setWinnerChoice('SAFE')}
                    style={{
                      flex: 1,
                      padding: '12px',
                      background: winnerChoice === 'SAFE' ? '#2563eb' : '#f1f5f9',
                      color: winnerChoice === 'SAFE' ? '#fff' : '#334155',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}
                  >
                    🛡️ 稳守金库（保持当前资金）
                  </button>
                </div>
                <button
                  onClick={handleWinnerSubmit}
                  style={{ width: '100%', padding: '12px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  确认金库决策
                </button>
              </div>
            ) : (
              <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '10px', marginBottom: '16px' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '10px' }}>你是败者联盟成员，选择突袭哪一位守擂者：</div>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                  {winners.map((w, idx) => (
                    <button
                      key={w.id}
                      onClick={() => setRaidTargetIndex(idx)}
                      style={{
                        padding: '10px 14px',
                        background: raidTargetIndex === idx ? '#dc2626' : '#e2e8f0',
                        color: raidTargetIndex === idx ? '#fff' : '#1e293b',
                        border: 'none',
                        borderRadius: '8px',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                      }}
                    >
                      ⚔️ 突袭 {w.name}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleLoserSubmit}
                  style={{ width: '100%', padding: '12px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  锁定突袭目标
                </button>
              </div>
            )
          ) : (
            <div style={{ padding: '12px', background: '#dcfce7', color: '#166534', borderRadius: '8px', marginBottom: '16px' }}>
              ✅ 你已完成本轮行动，等待其他人完成...
            </div>
          )}

          <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
            实时行动进度（{completedCount} / {totalParticipants} 已完成）：
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '8px', marginBottom: '16px' }}>
            {playersList.map((p) => {
              const done = (winnerIds || []).includes(p.id)
                ? Boolean(winnerActions[p.id])
                : Boolean(loserRaids[p.id]);
              return (
                <div
                  key={p.id}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    background: done ? '#dcfce7' : '#f1f5f9',
                    color: done ? '#166534' : '#64748b'
                  }}
                >
                  {done ? `✅ ${p.name} 已完成` : `⏳ ${p.name} 行动中...`}
                </div>
              );
            })}
          </div>

          {allCompleted && (
            <button
              onClick={handleSettleHiddenRound}
              style={{ width: '100%', padding: '14px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              ⚡ 全员已完成，结算三王座攻防战终局！
            </button>
          )}
        </>
      ) : (
        <div>
          <h3>🏆 终局战报与最终资金排行</h3>
          <div style={{ padding: '14px', background: '#f8fafc', borderRadius: '10px', marginBottom: '16px' }}>
            {(hiddenState.logs || []).map((line, i) => (
              <div key={i} style={{ padding: '4px 0', fontSize: '14px' }}>{line}</div>
            ))}
          </div>

          {[...playersList]
            .sort((a, b) => b.money - a.money)
            .map((p, idx) => (
              <div
                key={p.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: idx === 0 ? '#fef3c7' : '#f1f5f9',
                  borderRadius: '8px',
                  marginBottom: '8px'
                }}
              >
                <span><strong>#{idx + 1} {p.name}</strong></span>
                <span style={{ fontWeight: 'bold', color: '#d97706' }}>{p.money} 万</span>
              </div>
            ))}

          <button
            onClick={onRestartAll}
            style={{ width: '100%', padding: '14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', marginTop: '12px' }}
          >
            🔄 开启新一局游戏
          </button>
        </div>
      )}
    </div>
  );
}