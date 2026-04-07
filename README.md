# ⚡ CW-Agent | 月収100万円 CrowdWorks自動化ダッシュボード

![Version](https://img.shields.io/badge/version-1.0.0-00d4aa?style=for-the-badge)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)

CrowdWorksでAI案件を効率的に管理・分析し、**月収100万円**を目指すための自動化ダッシュボードです。
AIスキル（Claude, ChatGPT, Midjourney等）を持つフリーランサーに特化した案件フィルタリングと収益トラッキングを提供します。

---

## スクリーンショット

**ダークテーマ（デフォルト）**
- ヘッダー: CW-Agentロゴ + 日付 + テーマ切替
- 月収目標プログレスバー: グラジェント（ミントグリーン→ゴールド）+ シマーアニメーション
- KPIカード4枚: 今月収益 / 目標達成率 / 時給効率 / 稼働時間
- 月次収益折れ線グラフ + 案件ステータス円グラフ（横並び）
- AI案件フィルター付き案件管理テーブル
- 連続応募ストリーク + 日替わりモチベーションメッセージ

---

## 機能一覧

### 収益管理
- 月収100万円プログレスバー（リアルタイム更新）
- マイルストーン達成時のGSAPアニメーション + コンフェッティ演出
- 月次収益推移グラフ（過去6ヶ月）
- 月次・週次レポートのJSONエクスポート

### 案件管理
- 案件テーブル（案件名 / カテゴリ / 報酬 / 時給 / ステータス / AI評価スコア）
- フィルター機能: AI案件のみ / 時給2,500円以上 / 除外案件非表示
- 案件追加モーダル（ステータス管理付き）

### AI案件評価
- AIキーワードスコアリング（Claude, GPT, Midjourney, Gemini, LLM等）
- 時給自動計算・推奨判定（応募推奨 / ウォッチ / スキップ）
- 除外条件自動フィルタリング（フル出勤・雇用契約・常駐・週5）

### モチベーション
- 30種類以上の日本語モチベーションメッセージ（進捗連動）
- 連続応募ストリークトラッキング
- ブラウザ通知（Web Notifications API）

### 効率管理
- 週次稼働時間トラッキング（13時間制限バー）
- 時給効率分析（目標 ¥2,500/h）
- 月次収益予測（線形推定）

---

## セットアップ手順

```bash
# 1. リポジトリをクローン
git clone https://github.com/hinfinitya00-sys/cw-agent.git
cd cw-agent

# 2. index.html をブラウザで開く（サーバー不要）
open index.html
# または
# ブラウザのアドレスバーにファイルパスをドラッグ＆ドロップ
```

**必要なもの:** モダンブラウザのみ（Chrome, Firefox, Safari, Edge）。サーバーやNode.jsは不要です。

---

## 設定方法

`config/settings.json` を編集してカスタマイズできます。

```json
{
  "targets": {
    "monthly_income": 1000000,   // 月収目標（円）
    "weekly_hours": 13,           // 週最大稼働時間
    "min_hourly_rate": 2500,      // 最低時給（円）
    "min_ai_score": 60            // 最低AIスコア（0-100）
  }
}
```

> 注意: 現バージョンでは設定ファイルの値はJS側の初期値として参照されます。変更後はブラウザのlocalStorageをクリアして再読み込みしてください。

---

## 使い方

### 案件の追加
1. 「＋ 案件追加」ボタンをクリック
2. 案件名・カテゴリ・報酬・稼働時間・ステータスを入力
3. 「追加する」ボタンで保存（AIスコアは自動計算）

### 新着案件の取得
1. 「🔄 案件を取得」ボタンをクリック
2. AIがスコアリング・推奨度を自動判定
3. 「応募推奨」案件から優先的に応募

### ストリークの更新
1. 案件に応募したら「本日応募済み ✓」ボタンをクリック
2. 連続応募日数が自動カウント（データはlocalStorageに保存）

### レポートのエクスポート
1. 右上「📥 レポート出力」ボタンをクリック
2. JSONファイルで月次レポートをダウンロード

---

## 除外条件の説明

以下のキーワードを含む案件は自動的に除外されます（「除外案件非表示」フィルター有効時）：

| キーワード | 理由 |
|-----------|------|
| フル出勤 | フリーランス非推奨 |
| 雇用契約 | 正社員・アルバイト案件 |
| 常駐 | 常駐必須案件 |
| 週5 | 週5日拘束案件 |

これらの除外条件は `config/settings.json` の `filters.exclude_keywords` で変更できます。

---

## データ保存について

すべてのデータはブラウザの **localStorage** に保存されます。
- ストレージキー: `cw_agent_data`
- ストリークデータ: `cw_agent_streak`
- テーマ設定: `cw_agent_theme`

データはブラウザをまたいで共有されません。バックアップは「レポート出力」からJSONでエクスポートしてください。

---

## 技術スタック

| ライブラリ | バージョン | 用途 |
|-----------|-----------|------|
| [Chart.js](https://www.chartjs.org/) | 4.4.0 | 収益グラフ・円グラフ |
| [GSAP](https://greensock.com/gsap/) | 3.12.2 | マイルストーンアニメーション |

その他のファイルはすべてバニラHTML/CSS/JavaScriptで実装されています。

---

## ライセンス

MIT License

Copyright (c) 2026 hinfinity-innovation

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
