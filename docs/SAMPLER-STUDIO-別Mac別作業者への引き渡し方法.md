# SAMPLER STUDIO データ＋音源を「別 Mac／別作業者」に丸ごと渡す方法

作成日: 2026-05-18

---

## まず大前提：このアプリのデータは「3 つ」に分かれている

| データ種別 | 保存場所 | 引き渡しの難易度 |
|---|---|---|
| ① **音源ファイル本体**（WAV/MP3 等、数十 MB〜GB） | ブラウザの IndexedDB に**コピーが入ってる** | 重いので工夫いる |
| ② **設定情報**（スケジュール、チェーン構成、フェーダー位置、ライブラリの並び） | ブラウザの IndexedDB 内 JSON | 軽い（数 KB〜数十 KB） |
| ③ **アプリ本体**（index.html） | GitHub Pages 上に常駐 | 引き渡し不要、URL を共有するだけ |

引き渡し対象は **①＋②** だけ。③ は本人が URL を開けばどの Mac でも同じものが動く。

---

## 結論：状況別おすすめ

| 状況 | おすすめ |
|---|---|
| **本番直前、今すぐ別 Mac に渡したい** | **A. 元音源 + スクショ** |
| **同じ作業者が自宅 Mac → 本番 Mac に持っていく** | **A** か **B** |
| **別作業者に「これそのまま使って」と渡したい** | **D. Export/Import 機能を新規実装**（要開発） |
| **長期的にチームで使い回したい** | **D**（実装すべき） |

---

## A. 元音源フォルダ + スクショ運用（**今すぐできる、コーディング不要**）

### やること
1. 旧 Mac の `Documents/sampler-studio-本番202X/` みたいなフォルダに、LOAD した元音源を全部置く
   - 例：`door-bgm.wav` / `workout-bgm.wav` / `A1-開演5分前.wav` / `A2-開演ベル.wav` ...
2. アプリ画面のスクショを撮る（スケジュール画面、ライブラリの並び順、チェーン構成、フェーダー位置）
   - Cmd+Shift+4 で範囲指定スクショ
3. このフォルダごと AirDrop / iCloud Drive / 外付け SSD で別 Mac に渡す
4. 別 Mac で：
   - URL を開く → 各 BGM スロットに LOAD → ライブラリにドロップ → スケジュール手動入力

### メリット
- **コーディング不要、今すぐできる**
- 大容量音源も OK（数 GB でも）
- 元ファイルは別 Mac に残るのでバックアップも兼ねる

### デメリット
- **スケジュール・チェーンは手動で再構築**（10 分くらいかかる）
- スクショ見ながら入力なので、ミスのリスクあり

### 向いてる場面
- 1〜2 回しか使わない一発本番
- 旧 Mac と新 Mac の作業者が同じ人

---

## B. ブラウザプロファイル丸ごとコピー（**非推奨だが可能**）

### やること
1. 旧 Mac で Chrome を完全終了
2. Finder で `~/Library/Application Support/Google/Chrome/Default/IndexedDB/` を開く
3. `https_nrs2013.github.io_0.indexeddb.leveldb/` フォルダを丸ごとコピー
4. 別 Mac の同じ場所にペースト
5. 別 Mac の Chrome を起動して URL を開く

### メリット
- 設定・音源・全部完全に同じ状態で復元

### デメリット（**重大**）
- Chrome のバージョン違うとデータ破損のリスク
- Chrome 起動中にコピーすると壊れる
- 別作業者のプロファイル汚染するから「渡す」用途には**絶対不向き**
- Apple Silicon ⇄ Intel Mac で動くかも不明

### 向いてる場面
- 自分のサブ Mac にバックアップ的に移すだけ
- **他人には絶対渡さない**

---

## C. iCloud Drive + Chrome の同期機能（**部分的解決**）

### やること
1. 元音源を iCloud Drive のフォルダに置く
2. Chrome の Google アカウント同期を ON にする（ブックマーク・拡張機能のみ同期）
3. 別 Mac で同じ Google アカウントで Chrome ログイン
4. URL をブックマークから開く → 音源を iCloud のフォルダから LOAD し直す

### メリット
- Mac 間で音源フォルダが自動同期される
- ブックマーク・URL は自動で揃う

### デメリット
- **IndexedDB は同期されない** ので、結局スケジュール・ライブラリは手動再構築
- iCloud の同期完了を待つ必要がある（数 GB だと数十分）

### 向いてる場面
- 同じ作業者が複数 Mac で使う場合のスタンダード運用

---

## D. アプリ側に「Export / Import」機能を追加（**本来あるべき正解、要開発**）

### 概要
SAMPLER STUDIO 自体に「プロジェクト書き出し」「プロジェクト読み込み」ボタンを追加する。

### 書き出される ZIP ファイルの中身（案）

```
my-concert-2026.ssproj.zip
├─ project.json            ← スケジュール、チェーン構成、フェーダー位置、ライブラリ並び
├─ bgm/
│  ├─ door.wav             ← DOOR OPEN 用 BGM
│  └─ workout.wav          ← WORKOUT 用 BGM
├─ library/
│  ├─ A1-開演5分前.wav
│  ├─ A2-開演ベル.wav
│  ├─ A3-注意事項.wav
│  └─ A4-終演後ベル.wav
└─ pads/
   ├─ bank1/
   │  ├─ pad-01.wav
   │  ├─ pad-02.wav
   │  └─ ...
   └─ bank2/...
```

### 引き渡し手順（実装後）
1. 旧 Mac：右上に追加される「📦 PROJECT EXPORT」ボタンを押す
2. `.ssproj.zip` ファイルが Downloads に保存される（数 GB の zip）
3. AirDrop / Google Drive / WeTransfer で別 Mac／別作業者に送る
4. 別 Mac：URL を開く → 「📂 PROJECT IMPORT」ボタンに zip をドロップ
5. 自動で IndexedDB に全部復元、すぐ本番可能

### メリット
- **完全な状態でワンクリック引き渡し**
- 別作業者が中身を理解してなくても再現可能
- バックアップとしても優秀（PC 替えてもこの zip があれば復元できる）
- ファイル名で「2026春ツアー」「2025年末ライブ」みたいに版管理できる

### デメリット
- 開発が必要（半日〜1 日くらいの実装ボリューム）
- zip が大きい（音源が数 GB なら zip も数 GB）

### 実装の難易度
- **中**（既存 IndexedDB のキーを順に書き出すだけ）
- JSZip ライブラリを 1 個追加すれば実装可能
- アプリ本体は単一 HTML 維持できる

---

## 比較表（早見表）

| 方法 | 速さ | 完全性 | 別作業者向き | コーディング |
|---|:-:|:-:|:-:|:-:|
| A. 元音源+スクショ | ◎ 今すぐ | △ 手動再構築 | △ | 不要 |
| B. プロファイルコピー | ○ | ◎ | × 絶対NG | 不要 |
| C. iCloud + Chrome同期 | △ | △ | × | 不要 |
| **D. Export/Import 機能** | ◎ | ◎ | ◎ | **要開発** |

---

## 僕のおすすめロードマップ

### 今すぐ（直近の本番がある場合）
→ **A** で運用。元音源を Documents/ に整理して、スクショ撮っておく。

### 次のアップデート（時間あるとき）
→ **D を実装提案**。半日くらいで作れます。実装したら本番運用が劇的に楽になる。
- 「📦 EXPORT」「📂 IMPORT」ボタンをヘッダー右に追加
- JSZip で zip 化（CDN から 1 行で読み込める）
- 既存 IndexedDB を順に書き出し → zip → ダウンロード

D を実装する話、進めましょうか？それとも一旦 A 運用で様子見します？

---

## 注意点（全方式共通）

- **MIDI Learn の設定は Mac ごとに別物**：USB MIDI 機器の名称が違うので、別 Mac で MIDI Learn を再設定必要
- **音声出力デバイスは OS 依存**：別 Mac でシステム設定 ▸ サウンド ▸ 出力 を確認
- **Web MIDI は Chrome 専用**：Safari/Firefox では動かない
- **シークレットウィンドウ禁止**：IndexedDB がウィンドウ閉じると消える
- **キャッシュクリア禁止**：IndexedDB ごと消える

---

## 参考：今の SAMPLER STUDIO の IndexedDB データ構造

Export/Import 機能を実装する時の参考用：

```
sampler-studio (DB名)
├─ samples (Object Store) … 音源データ本体（Blob or ArrayBuffer）
│   ├─ key: sample-id（UUID）
│   └─ value: { name, blob, type, size, ... }
└─ state (Object Store) … アプリの設定情報
    ├─ key: 'app-state'
    └─ value: {
        appMode, door: { bgm, library, schedule, duck },
        sampler: { banks, pads, ... },
        masterVol, fadeTime, fadeCurve,
        midiBindings, ...
       }
```

この構造を JSON に書き出して、音源 Blob を別ファイルにして、まとめて zip にすれば D 方式が完成する。
