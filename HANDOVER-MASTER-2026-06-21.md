# 【最初に読む】SAMPLER STUDIO マスター引き継ぎ — 2026-06-21

新セッションはまずこれを読む。のむさん＝コンサート演出家・コード未経験・GitHub `nrs2013`。必ず舞台用語で平易に、ターミナルはコピペ完成形で。
本番URL: https://nrs2013.github.io/sampler-studio/ ／ リポ: nrs2013/sampler-studio（単一HTML・GitHub Pages・SSH push）／ ローカル `~/Documents/sampler-studio/index.html`。

---

## 0. 一行サマリと「次にやること」
- 今日は **Grid LED連携を実機で点灯させ**、アプリのバグ修正を2件デプロイし、**多エージェントでアプリ全体を監査して確定バグ67件を洗い出した**。
- **次にやること＝67件を優先順で直す**。ただし**のむさんに先に3つ決めてもらう必要あり**（§4）。
- 全バグの詳細は同リポ **`BUGLIST-2026-06-21.md`**（67件・重要度順・各 症状/原因/直し方つき）。

---

## 1. 現状
### デプロイ済み（本番反映済み）
| ver | commit | 内容 |
|---|---|---|
| v12.9.29 | 10f2b3a | 音源移動でGrid LEDが新位置に追従（assignPadDataがmidiNote/keyを運ばないよう修正） |
| v12.9.30 | ae97d7b | 操作のMIDI割当に重複防止（同じCCを2操作に割り当て不可） |

### Grid LED連携（ハード）= 完成・本体保存済み
- BU16・EF44 とも **ファームv1.5.4**、System要素Setupに `midirx_cb` Lua を Commit＋Store済み。どのPCでも光る。詳細は `SAMPLER-STUDIO-GridLED-引き継ぎ-2026-06-21.md`。
- アプリのLED送信: `ledSend()`(~7137) が ch13/note=pad.midiNote/velocity=色index+1 を「gridを含む出力」へ送信。

### 未解決 = アプリのバグ67件（監査A24 + B43、エージェント計169体・多数決検証済み）

---

## 2. 根本原因（これを直すと大量に消える）
**機材も再生面も全部おなじ「音番号(32〜47)・チャンネル(13)・1本のGridポート」を共有**している。だから「この番号を青で光らせて」が**同じ番号の全部の場所に同時に届く**。
- 実機確認: Grid出力は **`[3] Grid` の1本だけ**（BU16/EF44は1本の中で全モジュールに配られる＝送り先で機材を分けられない）。
- のむさん報告の「EF44の2番目フェーダーが光る」＝DECK Aのパッド1〜4(note36〜39)の色が、同番号のEF44フェーダーに漏れている（確定）。

---

## 3. 推奨フィックス順（次セッションはこの順で）
**① 本番事故防止（最優先・HIGH）**
- handleMIDI に appMode ガート無し → DOOR/MULTIモード中もMIDIでサンプラーpadやSTOP/FADE OUTが発火（~7187）。
- 学習中に他方の入力が暴発（キー学習中のMIDI / MIDI学習中のキー）でSTOP等が誤発火（~7188,7262）。
- SCHEDULE自動発火が全モードで走る（影アナが本番中に鳴る）。
→ いずれも「appMode==='sampler' の時だけ」「学習中は全入力を飲み込む」ガードを足すだけ。

**② データ消失（HIGH）**
- プリセット保存/読込/EXPORT が **DECK B を丸ごと捨てる**（state.banksしか見ない）。DECK Bの音が消える。
- PAUSE状態のデシンク（pad叩くと再生するがisPaused=trueのまま）。

**③ LED根本（HIGH）= のむさんの「変なLED」**
- パッド色はBU16にしか出さない or DECK/機材を別チャンネル・別番号帯に分ける（§4の決定が要る）。
- DECK/バンク切替でLED再送信、消え残り掃除、モード切替で消灯（setActiveDeck/switchDeckBank/setAppMode に ledScheduleSend/ledClearAll を追加）。

**④ 操作割当・その他（MED/LOW）**
- 既存の重複割当を読込時に整理、master CC7デフォルトとデッキCCの二重発火、MIDI velocityの下限、LEDトグルのproject別保存、空パッド着色のLED不一致、等。詳細は BUGLIST。

---

## 4. のむさんに先に決めてもらうこと（これが無いと根本を直せない）
1. **EF44のLEDをどうする？** (A)光らせない（おすすめ） / (B)上のエンコーダー4個だけ / (C)別番号帯に逃がす。→ Gridが1ポートなので、ここはEF44のGrid Editor側を1回だけ編集して決める。
2. **パッドのノート並び**：DECK A=N32〜47 / DECK B=N36〜51 で合ってる？（リセット機能を作る時の基準）
3. **MIDIでpadを鳴らす音量**：固定フル（推奨）か、velocity感度ありか。

---

## 5. デプロイ手順（director-workflow）
```bash
cd ~/Documents/sampler-studio
# index.html 編集後に構文チェック
python3 -c "import re;s=open('index.html').read();b=re.findall(r'<script(?![^>]*src=)[^>]*>([\s\S]*?)</script>',s);open('/tmp/s.js','w').write(max(b,key=len))"
node --check /tmp/s.js
git add index.html && git commit -m "vXX: 内容" && git push origin HEAD
# 反映確認: curl -s URL | grep -c "マーカー"  → 1=live
# のむさんは ⌘+Shift+R で強制リロード（PWAではないので必須）
```

## 6. 検証ツール（/tmp・Grid Editorを触らず実測）
- `swift /tmp/midiwatch.swift` … Grid入力30秒監視（NEW>で新ch/種別/番号）。フェーダーCC・ボタンnote・echo確認。
- `swift /tmp/gridtest.swift` / `gridcolor.swift N` / `gridoff.swift` / `gridmon.swift` … LED送信・色N点灯・消灯・受信監視。
- `swift /tmp/dests.swift` … MIDI出力先一覧（Grid=1本を確認済み）。

## 7. リポ内ドキュメント
- `BUGLIST-2026-06-21.md` … 確定バグ67件・全文（最重要）
- `HANDOVER-2026-06-21-LED-MIDI.md` … LED/MIDI修正の経緯
- `SAMPLER-STUDIO-GridLED-引き継ぎ-2026-06-21.md` … Gridハード/ファーム/Lua/色の濃さ
- このファイル `HANDOVER-MASTER-2026-06-21.md` … 全体の入口

---

## 8. 既知の作業環境メモ（次セッションへ）
- **Grid Editorの遠隔GUI操作は不安定**（ウィンドウが動く・他アプリにフォーカスを奪われ編集が実機に届かない）。LED色の濃さ調整・EF44編集が今日詰まった理由。落ち着いた環境 or のむさん操作を1ステップずつ。
- LED色が「明るくて薄い」問題：**led_value(明るさ)は効かない**＝明るさは色の値(RGB)で決まる。濃くするにはパレットRGBを50〜65%に下げる（GridのSystem Lua側）。
- SAMPLERは**全MIDI入力を聴く**（表示は先頭1台だけ）。MPC StudioもGridも両方効く。

— 2026-06-21 / のむさん × Claude（Grid LED完了 + アプリ修正2件 + 67バグ監査 → 新セッションへ引き継ぎ）
