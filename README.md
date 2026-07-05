# わいわいバース (waiwai-verse)

YouTube ライブに紐づく、一時的にわいわいできるリアルタイム2D空間。
アメーバピグのような見た目で、アバターが動き回り、チャットと YouTube コメントが流れます。
リアルタイム性が命なので、座標同期は **WebTransport (HTTP/3)** で作っています。

## 構成

```
shared/protocol.js   サーバ/クライアント共通のワイヤープロトコル
server/              WebTransport サーバ (Node + @fails-components/webtransport)
client/              Canvas クライアント (Vite, バニラJS)
desktop/             Electron ラッパー (デスクトップアプリ)
scripts/             証明書ハッシュをクライアント設定に同期
```

### チャネル設計

2つのチャネルを使い分けます。

- データグラム (非信頼・20Hz): アバター座標の入力とワールドスナップショット。落ちても次のフレームで上書きされるので速さ優先。
- 制御ストリーム (信頼): 入室ハンドシェイク、チャット、YouTube コメント、入退室。順序と到達が必要なものだけ。

座標はこのMVPでは client-authoritative です（カジュアルな雑談空間向け）。
不正対策が要るならサーバ側で移動量を検証する形に差し替えてください。

### 証明書について

WebTransport の `serverCertificateHashes` を使うので、自己署名証明書でも
トラストストア登録なしで Chrome / Electron から繋がります。
仕様上、証明書は ECDSA(P-256) かつ有効期限14日以内が必要です。
このリポジトリの生成スクリプトは10日有効の証明書を作ります。期限が切れたら再生成してください。

## セットアップ

前提: Node 20〜22（`@fails-components/webtransport` は Node 24 で不具合報告あり。22 推奨）。

```bash
# 1. 依存をインストール
npm install

# 2. 証明書を生成し、クライアント設定に同期
npm run setup
#   = npm run gen-cert && npm run sync-config

# 3. サーバ起動（別ターミナル）
npm run server

# 4. クライアント起動（別ターミナル）
npm run client
```

ブラウザ（Chrome/Edge）で `http://localhost:5173` を開けば、もう繋がります。
`serverCertificateHashes` のおかげで、自己署名でも証明書エラーになりません。

### デスクトップアプリとして動かす

```bash
# サーバとクライアント(vite)を起動した状態で
npm run dev -w desktop      # 開発: vite を読み込む Electron ウィンドウ

# 本番ビルド
npm run build -w client
npm run desktop             # client/dist を読み込む
```

## YouTube ライブ連携

YouTube Data API v3 のキーと、配信中の動画IDを環境変数で渡します。

```bash
export YT_API_KEY=xxxxxxxx
export YT_VIDEO_ID=配信中の動画ID
npm run server
```

サーバが `videos.list` で `activeLiveChatId` を解決し、`liveChat/messages` を
`pollingIntervalMillis` に従ってポーリングします。取得したコメントは
制御ストリームで全員に配信され、空間内をふわっと流れます。
さらに低遅延にしたい場合は `liveChatMessages.streamList` に差し替え可能です。

## 操作

- WASD / 矢印キー / クリック で移動
- 下のチャット欄でメッセージ送信（吹き出し＋ログ）
- `/name あなたの名前` で名前変更

## 動作確認（トランスポート層）

ブラウザなしで Node 同士の疎通だけ確認できます。

```bash
npm run server          # 別ターミナルで起動しておく
npm run smoke -w server # hello → welcome、input → snapshot を表示
```

## 既知の制約 / 次の一手

- 座標が client-authoritative。対戦性のある用途ならサーバ権威に。
- 部屋は1つ固定。`CONFIG.path` を動的にして複数ルーム対応に拡張可能。
- UDP がブロックされる環境向けに WebSocket フォールバックを足すなら、
  `@fails-components/webtransport` の `HttpServer`（http/3 + ws）+ クライアント側 ponyfill に切替。
- 証明書は10日で失効。`npm run setup` を再実行。

## License

0BSD. You can use, copy, modify, and distribute this project for almost any purpose.
