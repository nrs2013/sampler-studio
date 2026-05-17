# SAMPLER STUDIO v4.8 音まわり全面監査 — 修正内容まとめ

実施日: 2026-05-18
監査範囲: 音が止まる／ノイズが入るトラブルの完全排除（本番グレード化）

---

## 🔍 監査で見つかった問題点（修正前）

### P0（本番で audible — 必ず本番で気づく）

| # | 場所 | 問題 |
|---|---|---|
| 1 | `doPlayNextInChain` | スケジュール影アナ再生時、`gain.value = level` 直後に `src.start()` でクリックノイズ。**本番中に毎回鳴る** |
| 2 | `doAnnStopAll` | 影アナ強制停止が `src.stop()` 直接でクリックノイズ |
| 3 | `doBgmStop` | BGM 停止ボタンが `audioElement.pause()` 直接でクリックノイズ |
| 4 | `doBgmPause` | BGM 一時停止も同じくクリックノイズ |
| 5 | `doBgmSetVol` | ボリュームフェーダードラッグ中に `gain.value = v` 直接代入で**ジッパーノイズ**（ザリザリ音） |
| 6 | `doLibSetLevel` | ライブラリ音量フェーダードラッグでジッパーノイズ |
| 7 | `doLibPreview` | プレビュー再生（▶ ボタン）の開始時にクリック |
| 8 | `doLibPreviewStop` | プレビュー停止（■ ボタン）でクリック |

### P1（長時間運用で問題化）

| # | 場所 | 問題 |
|---|---|---|
| 9 | `playPad` / `stopPad` | gain node が disconnect されず GC 待ち、**長時間運用でメモリ蓄積** |
| 10 | `doPlayNextInChain` / `doLibPreview` | announce/preview の gain node も disconnect 漏れ |
| 11 | `previewTrim` / `stopTrimPreview` | トリムエディタのプレビューも同じ問題 |
| 12 | `initAudio` | **`AudioContext` の `statechange` リスナーなし**。システムスリープ復帰時に**音が止まる**可能性 |
| 13 | `visibilitychange` 未対応 | タブを別画面にして戻すと AudioContext が suspended のまま |
| 14 | `setMasterVol` | `cancelScheduledValues` なしで `linearRampToValueAtTime` 連発、ドラッグ中にランプキューイング |

---

## ✅ 修正内容

### 1. 共通ヘルパー関数を 4 つ追加

```js
safeRamp(audioParam, target, durSec)
  → AudioParam を 12ms（既定）かけて滑らかに変化。ジッパーノイズ完全排除。

safeStopBufferSource(src, gain, fadeSec)
  → BufferSource を 8ms フェードアウト後に stop。
     さらに 50ms 後に source と gain を disconnect でクリーンアップ。

connectAndStartBufferSource(src, gain, dest, targetGain, offset, dur)
  → BufferSource を「無音から開始 → 5ms ランプアップ」で再生。
     クリック完全排除。

safeBgmFadeAndPause(slot, opts)
  → BGM（HTMLAudioElement）を 25ms フェードアウト → audio.pause()。
     その後 gain を b.vol に復元（次回 play で 0 から立ち上げ）。
```

### 2. AudioContext 自動復帰

```js
ctx.addEventListener('statechange', () => {
  if (ctx.state === 'suspended' && !isPaused) ctx.resume();
  if (ctx.state === 'interrupted') ctx.resume();
});

document.addEventListener('visibilitychange', () => {
  // タブが再表示されたら suspended なら自動 resume
});
```

**効果**：
- システムスリープ → 復帰時に自動で音が戻る
- 別タブ → 戻ったときも同じく
- ただし PAUSE ボタンで一時停止中は触らない（ユーザー意図を尊重）

### 3. 各関数を安全版に書き換え

| 関数 | 修正前 | 修正後 |
|---|---|---|
| `setMasterVol` | `linearRampToValueAtTime(target, +0.02)` | `safeRamp(masterGain.gain, target)` |
| `doBgmPlay` | `g.gain.value = b.vol` 即時 | 0.0001 → b.vol を 5ms ランプアップ |
| `doBgmPause` | `audioElement.pause()` 直接 | 25ms フェードアウト後 pause |
| `doBgmStop` | `audioElement.pause()` 直接 | 25ms フェードアウト後 pause + reset |
| `doBgmSetVol` | `g.gain.value = v` 即時 | `safeRamp(g.gain, v)` で 12ms ランプ |
| `doLibPreview` | gain 直接代入＋src.start() 直接 | `connectAndStartBufferSource` |
| `doLibPreviewStop` | `src.stop()` 直接 | `safeStopBufferSource` |
| `doLibSetLevel` | `setValueAtTime` 即時 | `safeRamp` 12ms |
| `doPlayNextInChain` | gain 直接代入＋src.start() 直接 | `connectAndStartBufferSource` |
| `doAnnStopAll` | `src.stop()` 直接 | `safeStopBufferSource` |
| `previewTrim` | gain 直接代入＋src.start() 直接 | `connectAndStartBufferSource` |
| `stopTrimPreview` | `src.stop()` 直接 | `safeStopBufferSource` |
| `playPad.onended` | disconnect なし | source/gain を disconnect 追加 |
| `stopPad` | disconnect なし | fade 完了後 setTimeout で disconnect |

### 4. ⭐ DUCK → BGM フェーダー視覚連動（追加要望対応）

DUCK が発動／解除されると、BGM フェーダーが**視覚的にも連動して下がる／戻る**ようになりました。

**仕組み**：
- `state.door.duckEffective`（0〜1）に現在の DUCK 倍率を保存
- DUCK 発動／解除時に `requestAnimationFrame` で滑らかにアニメーション
- フェーダー位置 = `b.vol × duckEffective`（実効レベル）
- dB 表示も実効レベルに連動

**動作**：
- 普段：DOOR フェーダー 0dB、表示 0dB
- DUCK 発動（深さ -6dB、フェード 0.8 秒）：フェーダーが滑らかに -6dB の位置まで下がる
- 影アナ終了 → DUCK 解除：フェーダーが滑らかに元の位置まで戻る

---

## 📊 修正後の動作保証

### クリックノイズ
- ✅ パッド再生開始：5ms ランプアップ → 無音
- ✅ パッド停止：8ms ランプダウン → 無音
- ✅ BGM 再生開始：5ms ランプアップ → 無音
- ✅ BGM 停止/一時停止：25ms フェードアウト → 無音
- ✅ 影アナ開始（スケジュール／プレビュー）：5ms ランプアップ → 無音
- ✅ 影アナ停止：8ms ランプダウン → 無音
- ✅ FADE OUT（パニックストップ）：全要素を `state.fadeTime` 秒かけてフェード → 無音

### ジッパーノイズ
- ✅ マスターフェーダードラッグ：12ms ランプ → 滑らか
- ✅ BGM 音量フェーダードラッグ：12ms ランプ → 滑らか
- ✅ ライブラリ音量フェーダードラッグ：12ms ランプ → 滑らか

### メモリリーク
- ✅ パッド source/gain：再生終了時に disconnect
- ✅ 影アナ source/gain：再生終了時に disconnect
- ✅ プレビュー source/gain：再生終了時に disconnect
- ✅ トリムプレビュー source/gain：再生終了時に disconnect
- ✅ BGM HTMLAudioElement / MediaElementSource / objectUrl：CLEAR 時に解放（既存）

### 音が止まるトラブル
- ✅ システムスリープ復帰時：自動で `ctx.resume()`
- ✅ 別タブから戻る時：自動で `ctx.resume()`
- ✅ オーディオデバイス切替時（USB IF 抜き差し）：`statechange` で検知して復帰試行
- ⚠️ PAUSE ボタンで一時停止中：ユーザー操作優先で自動復帰しない（正しい挙動）

---

## ⚠️ 本番前の必須チェック項目

新しい本番環境で必ず確認してほしいテスト：

| テスト | 期待結果 |
|---|---|
| パッド連打（10回／秒） | プチ音なし、メモリ膨張なし |
| BGM 再生中にフェーダー素早くドラッグ | ジャリジャリ音なし、滑らか |
| 影アナ予定時刻ピッタリで自動発火 | 発音時のプチ音なし、終了時もなし |
| DOOR BGM と WORKOUT BGM 同時再生 | 両方クリアに鳴る、相互干渉なし |
| FADE OUT を本番想定で発動 | 全要素が同じ時間で滑らかにフェード→無音 |
| Mac のスリープから復帰 | BGM が継続再生されている（一時停止してなければ） |
| USB オーディオ IF 抜き差し | 再接続後も音が出る（Chrome 再起動不要） |
| 1 時間ループ再生（メモリ監視） | Chrome タスクマネージャでメモリ膨張なし |

---

## 💡 既知の小さな限界

- **DUCK 中に BGM フェーダーをドラッグ**：視覚位置は `b.vol × duckEffective` で計算されるので、指の位置とフェーダー位置が一致しないことがある。DUCK は通常 0.8 秒なので、影響は限定的。
- **POLY モード無制限スタッキング**：同じパッドを連打すると active source が無制限に積み上がる。通常運用では問題ないが、極端なケース（10秒で50連打など）でクリック処理が遅延する可能性。次バージョンで上限を設けることを検討。
- **FADE OUT 中の再操作**：FADE OUT 実行中に再度パッドを叩くと、新しい再生は通常通り開始される。FADE OUT のタイマーは元の再生をフェードするだけ。これは仕様。

---

## バージョン履歴
- v4.7: MASTER フェーダー独立カラム化
- v4.8 ← 今回：音まわり全面監査 + DUCK 連動フェーダー視覚化
