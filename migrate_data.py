import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from backend.models import Base, User, Book, LendingLog

def migrate_data():
    # 1. SQLiteの接続
    sqlite_url = "sqlite:///./books.db"
    if not os.path.exists("./books.db"):
        print("エラー: ローカルに books.db が見つかりません。")
        return

    sqlite_engine = create_engine(sqlite_url)
    SqliteSession = sessionmaker(bind=sqlite_engine)
    sqlite_db = SqliteSession()

    # 2. PostgreSQL (Supabase) の接続
    pg_url = os.environ.get("DATABASE_URL")
    if not pg_url:
        print("エラー: 環境変数 DATABASE_URL が設定されていません。SupabaseのURLを設定してください。")
        return

    if pg_url.startswith("postgres://"):
        pg_url = pg_url.replace("postgres://", "postgresql://", 1)

    pg_engine = create_engine(pg_url)
    # テーブルが存在しない場合は作成
    Base.metadata.create_all(bind=pg_engine)
    
    PgSession = sessionmaker(bind=pg_engine)
    pg_db = PgSession()

    try:
        print("--- 移行開始 ---")

        # Usersの移行
        users = sqlite_db.query(User).all()
        for u in users:
            # 既に存在する場合はスキップまたは上書き
            pg_db.merge(u)
        print(f"✅ {len(users)} 件の User データを移行しました。")

        # Booksの移行
        books = sqlite_db.query(Book).all()
        for b in books:
            pg_db.merge(b)
        print(f"✅ {len(books)} 件の Book データを移行しました。")

        # LendingLogsの移行
        logs = sqlite_db.query(LendingLog).all()
        for log in logs:
            pg_db.merge(log)
        print(f"✅ {len(logs)} 件の LendingLog データを移行しました。")

        # 保存
        pg_db.commit()

        # PostgreSQL の自動採番 (シーケンス) の同期
        # SQLiteからIDをそのまま引き継いだため、次のIDが衝突しないようにリセットします
        try:
            pg_db.execute(text("SELECT setval('books_id_seq', COALESCE((SELECT MAX(id)+1 FROM books), 1), false);"))
            pg_db.execute(text("SELECT setval('lending_logs_id_seq', COALESCE((SELECT MAX(id)+1 FROM lending_logs), 1), false);"))
            pg_db.commit()
            print("✅ データベースのシーケンス同期が完了しました。")
        except Exception as seq_err:
            print("⚠️ シーケンスの同期をスキップしました (手動での設定が必要な場合があります):", seq_err)

        print("🎉 移行がすべて完了しました！")

    except Exception as e:
        pg_db.rollback()
        print(f"エラーが発生しました: {e}")
    finally:
        sqlite_db.close()
        pg_db.close()

if __name__ == "__main__":
    migrate_data()
