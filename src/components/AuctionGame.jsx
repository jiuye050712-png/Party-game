import React, { useState } from 'react';
import { ref, update } from 'firebase/database';
import { db } from '../firebase';

export default function AuctionGame({ roomId, playersList, myPlayerId, auctionState, onNextStage }) {
  const [bidAmount, setBidAmount] = useState('');
  const items = auctionState.items || [];
  const idx = auctionState.currentIndex || 0;
  const currentItem = items[idx];
  const bids = auctionState.bids || {};

  const myPlayer = playersList.find((p) => p.id === myPlayerId);
  const completedCount = playersList.filter((p) => bids[p.id] !== undefined).length;
  const allCompleted = completedCount === playersList.length && playersList.length > 0;

  const handleSubmitBid = async () => {
    if (!myPlayer) return alert('未识别到你的玩家身份');
    const val = bidAmount === '' ? 0 : parseInt(bidAmount, 10);
    if (isNaN(val) || val < 0) return alert('请输入有效的出价金额（0代表放弃竞拍）');
    if (val > 0 && val < currentItem.startingBid) {
      return alert(`出价不能低于起拍价 ${currentItem.startingBid} 万（不拍请填 0）`);
    }
    if (val > myPlayer.money) {
      return alert(`你的资金不足！当前仅有 ${myPlayer.money} 万`);
    }

    await update(ref(db, `rooms/${roomId}/auctionState/bids`), {
      [myPlayer.id]: val
    });
    setBidAmount('');
  };

  const handleSettleCurrentItem = async () => {
    let highestBid = 0;
    let winner = null;
    playersList.forEach((p) => {
      const b = bids[p.id] || 0;
      if (b > highestBid) {
        highestBid = b;
        winner = p;
      }
    });

    const updates = {};
    let logText = '';
    if (winner && highestBid > 0) {
      updates[`rooms/${roomId}/players/${winner.id}/money`] = winner.money - highestBid;
      updates[`rooms/${roomId}/players/${winner.id}/items`] = [
        ...(winner.items || []),
        { ...currentItem, paid: highestBid }
      ];
      logText = `🔨 第${idx + 1}件【${currentItem.name}】被 ${winner.name} 以 ${highestBid} 万拍走！`;
    } else {
      logText = `💨 第${idx + 1}件【${currentItem.name}】无人出价，流拍！`;
    }

    updates[`rooms/${roomId}/auctionState/logs`] = [...(auctionState.logs || []), logText];
    updates[`rooms/${roomId}/auctionState/bids`] = {};
    updates[`rooms/${roomId}/auctionState/currentIndex`] = idx + 1;

    await update(ref(db), updates);
  };

  const handleRevealAll = async () => {
    const updates = {};
    playersList.forEach((p) => {
      const owned = p.items || [];
      const totalValue = owned.reduce((sum, item) => sum + item.actualValue, 0);
      updates[`rooms/${roomId}/players/${p.id}/money`] = p.money + totalValue;
    });
    updates[`rooms/${roomId}/auctionState/revealed`] = true;
    await update(ref(db), updates);
  };

  if (idx >= items.length) {
    return (
      <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
        <h2>🏺 9轮拍卖结束 · 最终鉴宝时刻！</h2>
        {!auctionState.revealed ? (
          <button
            onClick={handleRevealAll}
            style={{ width: '100%', padding: '16px', background: '#d97706', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            🔍 一键揭开所有拍品真伪并结算盈亏！
          </button>
        ) : (
          <div>
            {playersList.map((p) => (
              <div key={p.id} style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px', marginBottom: '10px' }}>
                <strong>{p.name}</strong>（当前总资金：<span style={{ color: '#d97706' }}>{p.money} 万</span>）
                {(p.items || []).length === 0 ? (
                  <div style={{ fontSize: '13px', color: '#94a3b8' }}>本轮未拍得任何物品</div>
                ) : (
                  (p.items || []).map((it, i) => (
                    <div key={i} style={{ fontSize: '14px', marginTop: '4px' }}>
                      • {it.name}（花 {it.paid}万 -&gt; 实际值 <strong>{it.actualValue}万</strong>，
                      {it.actualValue - it.paid >= 0 ? `赚${it.actualValue - it.paid}万` : `亏${it.paid - it.actualValue}万`}）— {it.revealText}
                    </div>
                  ))
                )}
              </div>
            ))}
            <button
              onClick={onNextStage}
              style={{ width: '100%', padding: '14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', marginTop: '12px' }}
            >
              进入第三轮：救生艇超载（决出3名胜者） ➡️
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
      <h2>🖼️ 第二轮：谜语鉴宝拍卖（第 {idx + 1} / {items.length} 件）</h2>

      <div style={{ padding: '20px', background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '10px', marginBottom: '16px' }}>
        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#92400e' }}>拍品：{currentItem.name}</div>
        <div style={{ margin: '10px 0', fontSize: '15px', color: '#78350f' }}>📜 鉴宝谜语：“{currentItem.riddle}”</div>
        <div style={{ fontSize: '14px', fontWeight: 'bold' }}>起拍底价：{currentItem.startingBid} 万</div>
      </div>

      {myPlayer && bids[myPlayer.id] === undefined ? (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <input
            type="number"
            placeholder="输入你的出价（万），不买填 0"
            value={bidAmount}
            onChange={(e) => setBidAmount(e.target.value)}
            style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
          />
          <button
            onClick={handleSubmitBid}
            style={{ padding: '10px 20px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            提交暗标
          </button>
        </div>
      ) : (
        <div style={{ padding: '10px', background: '#dcfce7', color: '#166534', borderRadius: '8px', marginBottom: '16px' }}>
          ✅ 你已完成出价（{bids[myPlayer?.id]} 万），等待其他玩家...
        </div>
      )}

      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>实时出价进度（{completedCount} / {playersList.length} 已完成）：</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '8px' }}>
          {playersList.map((p) => {
            const done = bids[p.id] !== undefined;
            return (
              <div
                key={p.id}
                style={{ padding: '8px 12px', borderRadius: '6px', background: done ? '#dcfce7' : '#f1f5f9', color: done ? '#166534' : '#64748b' }}
              >
                {done ? `✅ ${p.name} 已完成` : `⏳ ${p.name} 思考中...`}
              </div>
            );
          })}
        </div>
      </div>

      {allCompleted && (
        <button
          onClick={handleSettleCurrentItem}
          style={{ width: '100%', padding: '12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
        >
          🔨 全员已出价，揭晓本轮得主并进入下一件
        </button>
      )}

      <div style={{ marginTop: '14px', fontSize: '13px', color: '#475569' }}>
        {(auctionState.logs || []).slice().reverse().map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>
    </div>
  );
}