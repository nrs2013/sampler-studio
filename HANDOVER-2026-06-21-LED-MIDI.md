# SAMPLER STUDIO 引き継ぎ — 2026-06-21（Grid LED連携 & MIDI修正セッション）

のむさん（コンサート演出家・コード未経験・GitHub `nrs2013`）と Claude の長丁場セッションの引き継ぎ。
本番URL: https://nrs2013.github.io/sampler-studio/ ／ リポ: https://github.com/nrs2013/sampler-studio （単一HTML・GitHub Pages・SSH push）
ローカル: `~/Documents/sampler-studio/index.html`。デプロイ＝`index.html`をcommit→`git push origin HEAD`→1〜2分後に **⌘+Shift+R 強制リロード**（PWAではないのでSW自動更新なし）。

---

## 0. 今日の到達点（一番大事）
- ✅ **Grid（Intech BU16 + EF44）のLEDが、実機の SAMPLER STUDIO で光る**ようになった。end-to-end確認済み。詳細は別紙 `SAMPLER-STUDIO-GridLED-引き継ぎ-2026-06-21.md`（ファーム・Lua・手順）。
- ✅ アプリ側のバグ修正を **2件デプロイ済み**（下記§1）。
- ⏸ **未解決が4つ**（§3）。特に「関係ないボタンが光る」は**保存データのノート番号がズレている**のが原因で、リセット機能を入れて直すのが次の一手。

---

## 1. 今日デプロイした修正（本番反映済み）
| ver | commit | 内容 |
|---|---|---|
| v12.9.29 | `10f2b3a` | **音源の移動/入替でGrid LEDが新しい位置に追従**。`assignPadData()`(index.html 〜9000行) が `midiNote`/`key` を src からコピーしていたのを除去。ノート/キーは「位置」に残す。 |
| v12.9.30 | `ae97d7b` | **同じMIDI/キーを2つの操作に割り当てられない重複防止**。`assignLearn()` の操作(master/deck等)分岐に、他操作から同じCC/note/keyを自動で外す処理を追加。 |

※どちらも構文チェック(node --check)通過済み。MIDIの受信(handleMIDI)には触っていない。

---

## 2. Grid LED連携（ハード側の現状）
- BU16・EF44 とも **ファーム v1.5.4**、System要素(Setup)に LED用 `midirx_cb` Lua を **Commit＋Store済み**（モジュール本体保存＝どのPCでも光る）。
- アプリ側のLED送信 `ledSend()`(index.html 7137付近): `state.appMode==='sampler'` かつ LEDトグルON かつ "grid"を含む出力先がある時、各パッドの色を **ch13 / note=pad.midiNote / velocity=色index+1(空は0)** で送る。`render()`(7774)が表示更新のたびに `ledScheduleSend()` を呼ぶ。
- 色パレット: `PAD_COLOR_PALETTE`(index.html 5330) = 1:default#3DB5A6 / 2:blue#5DA7E0 / 3:purple#A06EFF / 4:pink#FF5F8F / 5:red#E24B4A / 6:orange#FF8C42 / 7:yellow#F5D547 / 8:cyan#4DE4D4。velocity=index+1。
- **重要**: サンプラーは **全MIDI入力を聴く**(7095-7105 `inputs.forEach(... onmidimessage=handleMIDI)`)。画面の「MIDI: ◯◯」は先頭1台の名前を出してるだけで、Gridも実際は聴いている。

---

## 3. 未解決の課題と直し方

### A.（最優先）関係ないボタンが光る＝パッドのノート番号がズレ/重複
- 症状: 何も入っていないパッドのボタンが光る（例「左から2番目」）。
- 原因: **v12.9.29修正前の「音源移動でノートが付いて回る」バグで、過去に動かした際に各パッドの `midiNote` がズレ・重複した保存データ**。ledSendは pad.midiNote 宛に送るので、別パッドの番号が空ボタンを指して光る。修正は“今後”のズレは防ぐが、**既存の保存データは直らない**。
- 直し方（推奨）: **「パッドのMIDIノートを位置順にリセット」ボタンを追加**（1クリックで全パッドの note を 位置順に振り直し→重複解消）。
- ⚠️確認が必要: のむさんの意図する並び。以前の画面では **DECK A = N32〜47（base32+i）/ DECK B = N36〜51（base36+i）** と、デッキごとに開始番号が違った。リセット実装前に「この並びで合ってる？」を必ず確認すること（デッキ別baseを引数に）。
- 該当コード: `assignPadData`(〜9000)/`clearPadData`(9010)/`DEFAULT_NOTES`(5328 = [36..51])/`handleMoveDrop`(8948)。

### B. LEDの色が「明るくて薄い」→濃くしたい（未完）
- のむさん要望: 実際のパッド色よりLEDが明るく薄い、もっと濃く。
- 判明: **`led_value`(明るさ数字)はこのGrid LEDでは効かない**（255→80でも見た目変わらず）。**明るさは色の値(RGB)で決まる**。なので濃くするには **Lua側パレットのRGBを下げる**（例 orange{255,140,66}→{128,70,33}、全体50〜65%）。
- 詰まり: Grid Editor を遠隔操作したが画面が不安定で**編集が実機に反映できず**中断。次回は (1)まず `midi_send` のnoteを変えてgridmonでecho確認＝編集が効くか検証→ (2)効けばパレットRGBを下げてCommit&Store。詳細は GridLED引き継ぎの「追記その3」。

### C. MPC Studio のパッドにも色を送りたい（未着手）
- のむさん要望: Grid だけでなく **Akai MPC Studio** のパッドLEDにも色を出したい。
- 課題: MPCはGridと色の送り方(プロトコル)が違い、**そもそも外部MIDIでパッド色を点けられる機種/モードか要確認**（Akaiはソフト管理が基本）。実装するなら `ledRefreshOutputs`/`ledSend`(7122-7150)にMPC用送信を追加する形。まず機種仕様の調査から。

### D. フェーダー/操作のMIDI割当（衝突）
- EF44フェーダーは **ch1 CC 36/37/38/39**（1本ずつ固定・実測済み）。BU16ボタンは ch13 note33-47。
- 学習可能な操作: `state.controlAssign`(5374) = master(初期CC7)/fadeout(N60)/stop(N62)/pause(N63)/bankPrev/bankNext/**deckVol0(DECK A子フェーダー)/deckVol1(DECK B子フェーダー)**。
- 既存の衝突: master=CC39 と DECK B(deckVol1)=CC39 が**同じ番号→1本動かすと両方動く**。v12.9.30の重複防止を入れたので、**衝突しているDECK Bを別フェーダーに1回再LEARNすれば解消**（以後は重複防止で自動回避）。既存の保存割当は自動では消していない。
- のむさん方針(2026-06-21): 「この機能を使うまでMIDI割当は触らなくていい」。

---

## 4. デプロイ手順（director-workflow準拠）
```bash
cd ~/Documents/sampler-studio
# index.html を編集後、JS構文チェック
python3 - <<'PY'
import re
s=open('index.html').read()
b=re.findall(r'<script(?![^>]*src=)[^>]*>([\s\S]*?)</script>', s)
open('/tmp/sampler.js','w').write(max(b,key=len) if b else '')
PY
node --check /tmp/sampler.js   # SYNTAX_OK を確認
git add index.html
git commit -m "vXX: 内容"
git push origin HEAD           # SSH鍵で push
# 反映確認: curl -s URL | grep -c "マーカー" → 1=live
# のむさんは ⌘+Shift+R で強制リロード
```

## 5. 切り分け道具（/tmp・Swift+CoreMIDI・Grid Editorを触らず実測）
- `swift /tmp/midiwatch.swift` … Grid入力を30秒監視（NEW>で新しいch/種別/番号を表示）。フェーダーCC・ボタンnote・echo(ch16)を確認できる。
- `swift /tmp/gridtest.swift` … ch13/note32-47/色5を送信（LED点灯テスト）。
- `swift /tmp/gridcolor.swift N` … 全LEDに色番号N（1〜8）。`gridoff.swift`=消灯。
- `swift /tmp/gridmon.swift [秒]` … Grid受信監視。

---

— 2026-06-21 / のむさん × Claude（Grid LED連携完了 + アプリMIDI修正2件デプロイ + 未解決4件の整理）
