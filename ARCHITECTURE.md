# QUSIS 蔵書管理システム 詳細アーキテクチャ設計書 (System Architecture Document)

本ドキュメントは、コードベース全体のリバースエンジニアリング（ソースコード、データベース定義、ルーティング、設定ファイル、CI/CDワークフローの静的解析および振る舞い分析）に基づき、**QUSIS 蔵書管理システム（QUSIS Library）**の全体構造、技術スタック、データモデル、ビジネスロジック、状態遷移、シーケンス、API仕様、セキュリティモデル、運用構成を詳細に定義・文書化したものです。

---

## 1. システム全体概要 (System Overview)

本システムは、部室・研究室等の図書を効率的に管理・貸出・返却・予約・督促するためのWebアプリケーションです。
カメラを用いたISBNバーコード（EAN-13）の高速スキャン機能、書誌情報自動取得（OpenBD / Google Books）、Slackと連携したリアルタイム通知および自動延滞督促バッチを備えた**クライアント・サーバー型SPAアーキテクチャ**を採用しています。

### システムコンテキスト & レイヤー構成図

```mermaid
graph TB
    %% アクター
    User([一般ユーザー / 学生])
    Admin([図書管理者])
    CronRunner([GitHub Actions Cron])

    %% フロントエンド
    subgraph FrontendLayer [フロントエンド層 (Vercel / SPA)]
        direction TB
        ReactApp["React 19 + Vite SPA"]
        Router["React Router v7"]
        ScannerComp["Scanner (html5-qrcode EAN-13)"]
        Pages["UI Pages (Home / Lend / Return / Reserve / MyPage / Admin)"]
        ApiModule["API Client (api.js / fetch)"]

        ReactApp --> Router
        Router --> Pages
        Pages --> ScannerComp
        Pages --> ApiModule
    end

    %% バックエンド
    subgraph BackendLayer [バックエンド層 (Render / ASGI)]
        direction TB
        FastAPIApp["FastAPI App (ASGI)"]
        CorsMiddleware["CORS Middleware"]
        AuthModule["Auth Module (X-Admin-Password 検証)"]
        
        subgraph Routers [API Routers]
            BooksRouter["/books (書籍管理・検索)"]
            UsersRouter["/users (ユーザー・PIN管理)"]
            LendingRouter["/lending (貸出・返却・延長)"]
            ResRouter["/reservations (予約管理)"]
            CronEndpoint["/api/cron (延滞チェック)"]
        end

        subgraph Services [Service Layer]
            Reminders["Reminder Service (Slack通知・督促判定)"]
        end

        FastAPIApp --> CorsMiddleware
        FastAPIApp --> Routers
        Routers --> AuthModule
        CronEndpoint --> Reminders
    end

    %% データストア
    subgraph DataLayer [データ永続化層]
        SQLAlchemyORM["SQLAlchemy ORM (SessionLocal)"]
        SQLiteDB[("開発環境: SQLite (books.db)")]
        PostgresDB[("本番環境: PostgreSQL (Supabase / Render) + RLS")]
    end

    %% 外部API・サービス
    subgraph ExternalServices [外部連携サービス]
        OpenBD["OpenBD API (書籍メタデータ取得)"]
        GoogleBooks["Google Books API (フォールバック検索)"]
        SlackWebhook["Slack Incoming Webhook (通知・督促)"]
    end

    %% 接続関係
    User -->|HTTPS| ReactApp
    Admin -->|HTTPS| ReactApp
    CronRunner -->|UTC 01:00 日次トリガー (X-Cron-Secret)| CronEndpoint

    ApiModule -->|REST API (JSON)| FastAPIApp
    Routers --> SQLAlchemyORM
    SQLAlchemyORM --> SQLiteDB
    SQLAlchemyORM --> PostgresDB

    BooksRouter -->|ISBN検索| OpenBD
    BooksRouter -->|フォールバックISBN検索| GoogleBooks
    LendingRouter -->|返却時・延長申請・承認時通知| SlackWebhook
    Reminders -->|前日/当日/延滞リマインダー| SlackWebhook
```

---

## 2. 技術スタック一覧 (Technology Stack)

| レイヤー | カテゴリ | 採用技術・ライブラリ | バージョン / 備考 |
| :--- | :--- | :--- | :--- |
| **Frontend** | ライブラリ / フレームワーク | React, React DOM | `^19.2.5` |
| | ビルドツール / バンドラ | Vite | `^8.0.10` |
| | ルーティング | React Router (`react-router-dom`) | `^7.15.0` |
| | スタイリング | Tailwind CSS, `@tailwindcss/vite`, Vanilla CSS | `^4.3.0` (グラスモフィズムデザイン) |
| | バーコードスキャン | `html5-qrcode` | `^2.3.8` (EAN-13 / 978~限定スキャン) |
| | アイコン | `lucide-react` | `^1.14.0` |
| | デプロイ先 | Vercel | SPAリダイレクト設定 (`vercel.json`) |
| **Backend** | 言語 / ランタイム | Python | 3.11.0 |
| | Webフレームワーク | FastAPI | 高速ASGIフレームワーク |
| | ASGIサーバー | Uvicorn | 本番起動: `uvicorn backend.main:app` |
| | ORM / DBアクセス | SQLAlchemy | ORMモデル + セッション管理 |
| | バリデーション | Pydantic v2 | `model_dump()`, `from_attributes = True` |
| | HTTPクライアント | `requests` | 外部API呼び出し用 |
| | デプロイ先 | Render | Webサービス (無料枠) + `render.yaml` |
| **Database** | 開発環境 | SQLite | `books.db` |
| | 本番環境 | PostgreSQL (Supabase / Render) | RLS (Row-Level Security) 適用済み |
| | データ移行・同期 | 自作移行スクリプト | `migrate_data.py`, `enable_rls.py` |
| **External / CI**| 外部書籍API | OpenBD API / Google Books API | 書影・書名・著者自動補完 |
| | チャット通知 | Slack Incoming Webhook | 延長申請、取り置き通知、延滞督促 |
| | 定期自動実行 | GitHub Actions (`schedule`) | 毎日 01:00 UTC (日本時間 10:00) |

---

## 3. ディレクトリ構成 (Directory Structure)

```
蔵書管理アプリ/
├── .github/
│   └── workflows/
│       └── reminder-cron.yml     # 日次延滞・督促通知用GitHub Actions
├── backend/
│   ├── __init__.py
│   ├── auth.py                  # X-Admin-Password 検証依存関数
│   ├── database.py              # DB接続エンジン・セッション定義
│   ├── main.py                  # FastAPIエントリポイント, CORS, 例外ハンドラ
│   ├── models.py                # SQLAlchemy ORMモデル定義
│   ├── requirements.txt         # バックエンド依存パッケージ一覧
│   ├── schemas.py               # Pydanticスキーマ定義
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── books.py             # 書籍CRUD・ISBN外部取得
│   │   ├── lending.py           # 貸出・返却・延長申請/承認/却下
│   │   ├── reservations.py      # 書籍予約・予約キャンセル・予約一覧
│   │   └── users.py             # ユーザーCRUD・CSV一括登録・PIN検証/変更
│   └── services/
│       ├── __init__.py
│       └── reminders.py         # 延滞判定・Slack Webhook送信サービス
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vercel.json              # SPAルーティングリライト設定
│   ├── vite.config.js
│   └── src/
│       ├── App.css
│       ├── App.jsx              # ルーティング設定・共通ヘッダー/フッター
│       ├── api.js               # APIベースURL・パス解決ヘルパー
│       ├── index.css            # グローバルスタイル・グラスモーフィズム
│       ├── main.jsx
│       ├── components/
│       │   └── Scanner.jsx      # カメラバーコードスキャンコンポーネント
│       └── pages/
│           ├── Admin.jsx        # 管理者ダッシュボード (書籍/利用者/貸出/予約/履歴)
│           ├── Home.jsx         # トップページ・書籍一覧/インクリメンタル検索
│           ├── Lend.jsx         # 貸出フロー画面 (スキャン/手動/PIN入力)
│           ├── Return.jsx       # 返却フロー画面 (競合返却者選択対応)
│           ├── Reserve.jsx      # 予約登録フロー画面
│           └── MyPage.jsx       # 利用者マイページ (現在貸出/予約/延長申請/PIN変更)
├── books.db                     # 開発用SQLiteデータベース
├── enable_rls.py                # Supabaseテーブル向けRLS一括有効化スクリプト
├── migrate_data.py              # SQLite → PostgreSQL データ移行・シーケンス同期
├── render.yaml                  # Renderデプロイ定義ファイル
└── ARCHITECTURE.md              # 本アーキテクチャ設計書
```

---

## 4. データモデル & ER図 (Database Design)

システムは4つの主要エンティティ（`books`, `users`, `lending_logs`, `reservations`）および2つのEnum型で構成されます。

### 4.1 ERダイアグラム

```mermaid
erDiagram
    books ||--o{ lending_logs : "1:N (貸出履歴)"
    books ||--o{ reservations : "1:N (予約情報)"
    users ||--o{ lending_logs : "1:N (ユーザー貸出)"
    users ||--o{ reservations : "1:N (ユーザー予約)"

    books {
        int id PK "自動採番 (SERIAL)"
        varchar isbn "ISBNコード (Index)"
        varchar title "書籍タイトル (Index)"
        varchar author "著者名"
        enum status "BookStatus (貸出可能, 貸出中, 予約取り置き中, 廃棄, 紛失)"
        varchar location "保管場所・本棚位置 (任意)"
    }

    users {
        varchar user_id PK "学籍番号/ユーザーID (Index)"
        varchar name "氏名"
        varchar pin_code "4桁暗証番号 (初期値: 0000)"
        varchar notification_id "Slack/Discord等の通知先ID (任意)"
        boolean is_active "有効フラグ (Default: True)"
        boolean is_admin "管理者フラグ (Default: False)"
    }

    lending_logs {
        int id PK "自動採番 (SERIAL)"
        int book_id FK "対象書籍ID -> books.id"
        varchar user_id FK "借用者ID -> users.user_id"
        timestamp borrowed_at "貸出日時"
        timestamp due_date "返却予定日 (通常14日後)"
        timestamp returned_at "返却完了日時 (未返却時 NULL)"
        int remind_count "リマインド送信回数 (Default: 0)"
        boolean is_extension_requested "延長申請中フラグ (Default: False)"
    }

    reservations {
        int id PK "自動採番 (SERIAL)"
        int book_id FK "対象書籍ID -> books.id"
        varchar user_id FK "予約者ID -> users.user_id"
        timestamp reserved_at "予約日時"
        enum status "ReservationStatus (予約中, 完了, キャンセル)"
    }
```

### 4.2 列挙型 (Enum Definitions)

#### `BookStatus`
*   `AVAILABLE` ("貸出可能"): 誰でも貸出可能な状態。
*   `LENT` ("貸出中"): 貸出中の状態。他のユーザーは予約可能。
*   `RESERVED` ("予約取り置き中"): 返却されたが予約者が存在するため、予約者専用に取り置かれている状態。
*   `DISCARDED` ("廃棄"): 除籍・廃棄済みの状態。
*   `LOST` ("紛失"): 行方不明・紛失状態。

#### `ReservationStatus`
*   `ACTIVE` ("予約中"): 貸出中または取り置き中で、貸出処理待ちの状態。
*   `FULFILLED` ("完了"): 予約者が対象本を貸出完了した状態。
*   `CANCELLED` ("キャンセル"): 予約者または管理者が予約を取り消した状態。

---

## 5. 書籍ライフサイクル & 状態遷移 (State Machine)

書籍の状態（`BookStatus`）は、貸出、返却、予約、延長申請の各イベントにより以下のように遷移します。

```mermaid
stateDiagram-v2
    [*] --> AVAILABLE : 管理者による新規書籍登録

    AVAILABLE --> LENT : 貸出処理 (POST /lending/lend)
    
    LENT --> RESERVED : 返却処理時、有効な予約が存在する場合 (POST /lending/return)
    note right of RESERVED
        Slackへ予約者宛ての
        取り置き通知を送信
    end note

    LENT --> AVAILABLE : 返却処理時、有効な予約が存在しない場合 (POST /lending/return)

    RESERVED --> LENT : 予約者本人が貸出処理を実行 (予約ステータス: FULFILLED)
    RESERVED --> AVAILABLE : 予約者が予約をキャンセルし、他予約がない場合

    AVAILABLE --> DISCARDED : 管理者による廃棄処理
    AVAILABLE --> LOST : 管理者による紛失登録
    LENT --> LOST : 紛失報告
    LOST --> AVAILABLE : 書籍発見・復帰
```

---

## 6. 主要業務フロー & シーケンス (Sequence Diagrams)

### 6.1 貸出フロー (Lending Flow)

```mermaid
sequenceDiagram
    autonumber
    actor User as 一般ユーザー
    participant UI as フロントエンド (Lend.jsx)
    participant Scanner as Scanner.jsx
    participant API as FastAPI (lending.py)
    participant DB as データベース

    User->>UI: 画面アクセス (スキャン開始)
    User->>Scanner: カメラで裏面バーコード (978~) を提示
    Scanner-->>UI: ISBN検知 (EAN-13)
    UI->>User: 学籍番号・4桁PIN入力要求
    User->>UI: 学籍番号 + PIN入力し「借りる」実行
    UI->>API: POST /api/lending/lend { book_isbn/book_id, user_id, pin_code }
    API->>DB: 書籍取得 & status 確認 (AVAILABLE or RESERVED)
    alt 本が存在しない / 貸出中
        API-->>UI: 404/400 (本が見つからないか貸出中)
    end
    alt status == RESERVED の場合
        API->>DB: 最優先アクティブ予約のユーザー照合
        alt 予約者が別ユーザー
            API-->>UI: 400 (他のユーザーに取り置きされています)
        else 予約者本人
            API->>DB: 予約ステータスを FULFILLED に更新
        end
    end
    API->>DB: ユーザー検証 (存在・is_active・pin_code)
    alt PIN不一致
        API-->>UI: 401 (PINコードが間違っています)
    end
    API->>DB: lending_logs 作成 (返却期限 = 今日 + 14日)
    API->>DB: books.status = LENT に更新
    API-->>UI: 貸出ログ返却 (200 OK)
    UI-->>User: 貸出完了画面表示
```

### 6.2 返却フロー & 予約取り置き通知 (Return & Reservation Notification Flow)

```mermaid
sequenceDiagram
    autonumber
    actor User as 返却者
    participant UI as フロントエンド (Return.jsx)
    participant API as FastAPI (lending.py)
    participant DB as データベース
    participant Slack as Slack Webhook

    User->>UI: バーコードスキャン または 一覧から本を選択
    UI->>API: POST /api/lending/return?isbn=xxx or book_id=yyy
    API->>DB: 未返却の lending_logs 検索
    alt 同一書籍に複数人のアクティブ貸出が存在
        API-->>UI: 409 Conflict + 候補者一覧リスト
        UI-->>User: 「返却者を選択してください」モーダル表示
        User->>UI: 返却者を選択して再送 (user_id 付与)
        UI->>API: POST /api/lending/return?book_id=yyy&user_id=zzz
    end
    API->>DB: 該当本の有効な予約 (status == ACTIVE) を検索 (最古の予約順)
    alt 有効な予約が存在する場合
        API->>DB: books.status = RESERVED に更新
        API->>DB: 予約者情報 (notification_id / name) 取得
        API->>Slack: 【予約本返却・取り置き通知】を送信 (予約者をメンション)
    else 予約が存在しない場合
        API->>DB: books.status = AVAILABLE に更新
    end
    API->>DB: lending_logs.returned_at = 現在日時に更新
    API-->>UI: 200 OK (返却完了)
    UI-->>User: 返却完了メッセージ表示
```

### 6.3 延長申請 & 管理者承認フロー (Extension Request & Approval Flow)

```mermaid
sequenceDiagram
    autonumber
    actor User as 借用者
    actor Admin as 管理者
    participant UI as マイページ / 管理画面
    participant API as FastAPI (lending.py)
    participant DB as データベース
    participant Slack as Slack Webhook

    User->>UI: マイページで「延長申請」ボタン押下 (PIN入力)
    UI->>API: POST /api/lending/{log_id}/extend { pin_code }
    API->>DB: 該当ログ・ユーザー検証
    API->>DB: 当該書籍に対するアクティブ予約の有無をチェック
    alt 既に他の人が予約している場合
        API->>Slack: 【延長申請 自動却下】通知送信 (ユーザーへ通知)
        API-->>UI: 400 (予約が入っているため延長できません)
    else 予約がない場合
        API->>DB: lending_logs.is_extension_requested = True
        API->>DB: 管理者一覧 (is_admin == True) 取得
        API->>Slack: 【延長申請】管理者をメンションしてSlack通知
        API-->>UI: 200 OK (申請送信完了)
    end

    Admin->>UI: 管理画面 (/admin) の「現在貸出中」を確認
    Admin->>UI: 「延長承認」または「延長却下」を実行
    alt 承認の場合
        UI->>API: POST /api/lending/{log_id}/approve-extension (Header: X-Admin-Password)
        API->>DB: due_date = due_date + 14日, is_extension_requested = False
        API->>Slack: 【延長申請 許可】ユーザー宛てに通知
        API-->>UI: 200 OK
    else 却下の場合
        UI->>API: POST /api/lending/{log_id}/reject-extension (Header: X-Admin-Password)
        API->>DB: is_extension_requested = False
        API->>Slack: 【延長申請 却下】ユーザー宛てに通知
        API-->>UI: 200 OK
    end
```

### 6.4 日次自動延滞督促バッチ (Daily Overdue Cron Flow)

```mermaid
sequenceDiagram
    autonumber
    participant GitHub as GitHub Actions (01:00 UTC)
    participant API as FastAPI (main.py)
    participant Service as Reminder Service (reminders.py)
    participant DB as データベース
    participant Slack as Slack Webhook

    GitHub->>API: GET /api/cron/check-overdue (Header: X-Cron-Secret)
    API->>API: X-Cron-Secret 検証
    alt シークレット不正
        API-->>GitHub: 401 Unauthorized
    end
    API->>Service: BackgroundTasks に check_overdue_books を登録
    API-->>GitHub: 200 OK {"message": "Overdue check started"}

    Note over Service,DB: バックグラウンド処理開始
    Service->>DB: 未返却ログ (returned_at == null) 一括取得
    loop 各未返却ログ
        Service->>Service: 期限超過日数 (today - due_date) を計算
        alt days_overdue == -1 (返却期日前日)
            Service->>Slack: 【事前通知】明日が返却期限です
        else days_overdue == 0 (返却期日当日)
            Service->>Slack: 【返却期限当日】本日中に部室へ返却してください
        else days_overdue > 0 (延滞中)
            Service->>Slack: 【督促通知】期限が過ぎています！（N日超過）
            Service->>DB: remind_count を +1 インクリメント
        end
    end
    Service->>DB: DBセッションを正常クローズ
```

---

## 7. REST API エンドポイント詳細仕様書 (API Specifications)

### 認証方式
1.  **管理者認証**: HTTPヘッダー `X-Admin-Password` にサーバー環境変数 `ADMIN_PASSWORD` を指定。
2.  **利用者認証**: 学籍番号（`user_id`）+ 4桁数字（`pin_code`）。
3.  **Cron認証**: HTTPヘッダー `X-Cron-Secret` にサーバー環境変数 `CRON_SECRET` を指定。

---

### 7.1 書籍管理 (`/books`)

| メソッド | パス | 認証 | 概要 | リクエスト/クエリ | レスポンス |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/books/` | 不要 | 書籍一覧取得（ページネーション・検索・予約数集計） | `skip`, `limit`, `search` | `List[Book]` (各書籍に `reservation_count` 付与) |
| `POST` | `/books/` | 管理者 | 新規書籍登録（title空時はOpenBD/GoogleBooksからISBN自動解決） | `BookCreate` (JSON) | `Book` |
| `GET` | `/books/{isbn}` | 不要 | ISBNによる書籍詳細取得 | パスパラメータ `isbn` | `Book` |
| `PUT` | `/books/{book_id}` | 管理者 | 書籍情報更新（タイトル、著者、ステータス、保管場所） | `BookUpdate` (JSON) | `Book` |
| `DELETE` | `/books/{book_id}` | 管理者 | 書籍削除（貸出中の書籍は削除不可） | パスパラメータ `book_id` | `{"detail": "Book deleted successfully"}` |

---

### 7.2 ユーザー管理 (`/users`)

| メソッド | パス | 認証 | 概要 | リクエスト/クエリ | レスポンス |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/users/` | 管理者 | 全ユーザー一覧取得 | `skip`, `limit` | `List[User]` |
| `POST` | `/users/` | 管理者 | ユーザー個別登録 | `UserCreate` (JSON) | `User` |
| `POST` | `/users/bulk` | 管理者 | CSV等からの一括登録/更新（差分更新対応） | `List[UserCreate]` (JSON) | `{"detail": "...", "added": N, "updated": M}` |
| `DELETE` | `/users/bulk-delete` | 管理者 | ユーザー一括削除（未返却本があるユーザーはスキップ） | `List[str]` (user_id 配列) | `{"detail": "...", "deleted": N, "skipped": [...]}` |
| `GET` | `/users/{user_id}` | 管理者 | ユーザー詳細取得 | パスパラメータ `user_id` | `User` |
| `GET` | `/users/{user_id}/lending-logs` | PIN検証 | ユーザー個別貸出履歴取得（マイページ用） | クエリ `pin_code` | `List[LendingLog]` |
| `POST` | `/users/{user_id}/verify-pin` | 不要 | PINコードの正当性検証 | `PinVerify` (`{pin_code}`) | `{"status": "ok"}` |
| `POST` | `/users/{user_id}/change-pin` | 不要 | PINコードの変更（旧PIN検証 + 新PIN 4桁数字制約） | `PinChange` (`{old_pin, new_pin}`) | `{"status": "ok"}` |
| `PUT` | `/users/{user_id}` | 管理者 | ユーザー情報更新（名前、通知ID、権限等） | `UserUpdate` (JSON) | `User` |
| `DELETE` | `/users/{user_id}` | 管理者 | ユーザー個別削除（未返却本がある場合は400エラー） | パスパラメータ `user_id` | `{"detail": "User deleted successfully"}` |

---

### 7.3 貸出・返却・延長 (`/lending`)

| メソッド | パス | 認証 | 概要 | リクエスト/クエリ | レスポンス |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/lending/active` | 管理者 | 現在貸出中の全一覧取得（延滞フラグ、延長申請中フラグ付与） | なし | `List[ActiveLendingLog]` |
| `GET` | `/lending/history` | 管理者 | 全貸出履歴取得（返却日/貸出日降順） | `skip`, `limit` | `List[HistoryLendingLog]` |
| `POST` | `/lending/lend` | PIN検証 | 書籍貸出処理（予約取り置き照合、14日間期限自動算出） | `LendingLogCreate` | `LendingLog` |
| `POST` | `/lending/return` | 不要 | 書籍返却処理（競合返却者ハンドリング、予約者取り置き遷移 & Slack通知） | `isbn`, `book_id`, `user_id` (クエリ) | `LendingLog` (競合時 409 + 候補リスト) |
| `POST` | `/lending/{log_id}/extend` | PIN検証 | 貸出延長申請（予約有なら自動却下通知、無なら申請中化 & 管理者Slack通知） | `LendingExtend` (`{pin_code}`) | `LendingLog` |
| `POST` | `/lending/{log_id}/approve-extension` | 管理者 | 延長申請の承認（返却期限を+14日延長し、Slack通知） | パスパラメータ `log_id` | `LendingLog` |
| `POST` | `/lending/{log_id}/reject-extension` | 管理者 | 延長申請の却下（フラグ解除し、Slack通知） | パスパラメータ `log_id` | `LendingLog` |

---

### 7.4 予約管理 (`/reservations`)

| メソッド | パス | 認証 | 概要 | リクエスト/クエリ | レスポンス |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/reservations/` | PIN検証 | 書籍予約登録（貸出中のみ予約可、自己貸出本・重複予約は拒否） | `ReservationCreate` | `Reservation` |
| `POST` | `/reservations/{reservation_id}/cancel` | PIN検証 | 予約キャンセル | ヘッダー `user-id`, `PinVerify` | `Reservation` |
| `GET` | `/reservations/me` | PIN検証 | 自身の有効な予約一覧取得（マイページ用） | クエリ `user_id`, `pin_code` | `List[Reservation]` |
| `GET` | `/reservations/all` | 管理者 | 全予約情報一覧取得 | なし | `List[Reservation]` |

---

### 7.5 定期バッチ (`/api/cron`)

| メソッド | パス | 認証 | 概要 | リクエスト/クエリ | レスポンス |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/cron/check-overdue` | Cron認証 | GitHub Actionsから日次起動。前日/当日/延滞本の抽出とSlack督促 | ヘッダー `X-Cron-Secret` | `{"message": "Overdue check started"}` |

---

## 8. セキュリティ & インフラ環境変数仕様

### 8.1 セキュリティモデル
1.  **管理者セキュリティ**:
    *   `X-Admin-Password` ヘッダーによるステートレス照合。
    *   ブラウザ側では `localStorage.getItem('adminAuthPassword')` に保持。
2.  **キオスク端末/共用デバイス対策 (利用者PIN)**:
    *   部室に設置された共用タブレットやPCでの「なりすまし貸出・返却・情報閲覧」を防ぐため、全主要アクションに4桁PIN認証を要求。
3.  **データベース保護 (Row-Level Security: RLS)**:
    *   Supabase (PostgreSQL) 側で `books`, `users`, `lending_logs` に対して `ENABLE ROW LEVEL SECURITY` を適用済み。
    *   クライアント（Anon Key）からの直接アクセスを遮断し、FastAPIバックエンド（Service Role / Connection String）経由のフルコントロールに限定。
4.  **CORSポリシー**:
    *   FastAPIミドルウェアにて `FRONTEND_URL`、`localhost:5173`、`127.0.0.1:5173` を許可。グローバル例外発生時も CORS ヘッダーを適切に補完返却して通信遮断を防止。

### 8.2 環境変数一覧 (Environment Variables)

| 環境変数名 | 適用場所 | 必須 | 説明 / デフォルト値 |
| :--- | :--- | :---: | :--- |
| `DATABASE_URL` | バックエンド (Render) | ○ | PostgreSQL接続文字列 (未設定時は `sqlite:///./books.db`) |
| `ADMIN_PASSWORD` | バックエンド (Render) | ○ | 管理者API操作用パスワード (未設定時は `"admin"`) |
| `FRONTEND_URL` | バックエンド (Render) | ○ | CORS許可するフロントエンドURL (例: `https://qusis-library.vercel.app`) |
| `SLACK_WEBHOOK_URL` | バックエンド (Render) | ○ | 予約返却・延長通知・延滞督促を投稿するIncoming Webhook URL |
| `CRON_SECRET` | バックエンド (Render) | ○ | `/api/cron/check-overdue` 実行保護用シークレットキー |
| `VITE_API_URL` | フロントエンド (Vercel) | ○ | バックエンドのホストURL (例: `https://qusis-library-backend.onrender.com`) |
| `RENDER_API_URL` | GitHub Actions Secret | ○ | Cronジョブから叩くバックエンドの基底URL |

---

## 9. リバースエンジニアリングによるアーキテクチャ分析 & 改善推奨事項

本調査・静的解析により識別されたアーキテクチャ上の特徴および今後の機能拡張・品質向上のための技術的課題（Technical Debt）は以下の通りです。

1.  **PINコードおよび管理者パスワードの平文保存**:
    *   *現状*: `users.pin_code` は平文文字列（`"0000"` 等）、管理者認証も静的文字列比較。
    *   *改善案*: `bcrypt` または `argon2-cffi` によるソルト付きハッシュ化の導入。
2.  **GETリクエストでの機密情報伝送**:
    *   *現状*: `/users/{user_id}/lending-logs?pin_code=xxxx` や `/reservations/me?pin_code=xxxx` でクエリパラメータにPINを付与している。
    *   *改善案*: ログ流出を防止するため、HTTPヘッダー（`Authorization` またはカスタムヘッダー）あるいはセッショントークン方式（JWT）への移行を推奨。
3.  **同時実行性 (Concurrency Control) と排他制御**:
    *   *現状*: 同一書籍に対する同時貸出・返却時、ORMの読み込みと書き込みの間にレースコンディションが発生する可能性。
    *   *改善案*: SQLAlchemyの `with_for_update()` を用いた行レベルロック、または楽観的ロック（バージョン列）の導入。
4.  **スキーママイグレーション管理の自動化**:
    *   *現状*: `main.py` 起動時に `ALTER TABLE ... ADD COLUMN` の try-except 構文で自動マイグレーションを行っている。
    *   *改善案*: `alembic` を導入し、リビジョンファイルによる宣言的なマイグレーション管理への統一。
