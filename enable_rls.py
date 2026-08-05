import os
from sqlalchemy import create_engine, text

def enable_rls():
    pg_url = os.environ.get("DATABASE_URL")
    if not pg_url:
        print("エラー: 環境変数 DATABASE_URL が設定されていません。SupabaseのURLを設定してください。")
        return

    if pg_url.startswith("postgres://"):
        pg_url = pg_url.replace("postgres://", "postgresql://", 1)

    engine = create_engine(pg_url)

    try:
        with engine.begin() as conn:
            print("--- RLS (Row-Level Security) の有効化を開始 ---")
            
            # 各テーブルでRLSを有効にする
            conn.execute(text("ALTER TABLE books ENABLE ROW LEVEL SECURITY;"))
            print("✅ 'books' テーブルの RLS を有効化しました。")
            
            conn.execute(text("ALTER TABLE users ENABLE ROW LEVEL SECURITY;"))
            print("✅ 'users' テーブルの RLS を有効化しました。")
            
            conn.execute(text("ALTER TABLE lending_logs ENABLE ROW LEVEL SECURITY;"))
            print("✅ 'lending_logs' テーブルの RLS を有効化しました。")

            print("🎉 すべてのテーブルで RLS が有効化されました！ (Supabaseのセキュリティ警告が解消されます)")
            print("※ FastAPIバックエンドは引き続きフルアクセス可能です。")

    except Exception as e:
        print(f"エラーが発生しました: {e}")

if __name__ == "__main__":
    enable_rls()
