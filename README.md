# BLUE//LOG



## 構成

- GitHub Pages: フロントエンドを公開
- Supabase Database: 記事・コメントをオンライン保存
- Supabase Auth: 管理者ログイン
- Row Level Security (RLS): 管理者以外の投稿編集・削除を防止

## 1. Supabaseプロジェクトを作る

Supabaseで新しいProjectを作成してください。

## 2. データベースを作る

Supabase Dashboardの **SQL Editor** を開き、同梱の `supabase.sql` を丸ごと貼り付けて実行します。

作成されるテーブル:

- `posts` : ブログ記事
- `comments` : コメント
- `admin_users` : 管理者ユーザーID

## 3. 管理者アカウントを作る

Supabase Dashboard → Authentication → Users から、ブログ管理者用のユーザーを作成します。

ユーザーを作成したら、そのユーザーのUUIDを確認してSQL Editorで次を実行します。

```sql
insert into public.admin_users (user_id)
values ('ここに管理者ユーザーのUUID');
```

## 4. Supabaseの接続情報を設定

Dashboard → Project Settings → API から次の2つを確認します。

- Project URL
- Publishable/anon key

`config.js` の以下を置き換えます。

```js
const SUPABASE_URL = "YOUR_SUPABASE_PROJECT_URL";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";
```

**service_role keyは絶対にブラウザへ入れないでください。**

## 5. GitHub Pagesへアップロード

以下をGitHubリポジトリのルートへアップロードします。

- `index.html`
- `style.css`
- `script.js`
- `config.js`
- `.nojekyll`

`supabase.sql` は公開ページには必須ではありませんが、設定資料としてリポジトリに置いておけます。

GitHub → Settings → Pages → Deploy from a branch → `main` / `/ (root)` を選択します。

## 公開後の動作

- 誰でも記事を閲覧可能
- 誰でもコメント可能
- 管理者だけログインして投稿可能
- 管理者だけ記事編集可能
- 管理者だけ記事削除可能
- 記事とコメントは端末ではなくSupabaseに保存
- PC、スマホなど別端末からも同じ記事を閲覧可能

## 注意

このサイトはSupabaseのanon/publishable keyをブラウザで使用します。これは通常のSupabaseフロントエンド構成です。重要なのはRLSを有効にして、service_role keyを絶対に公開しないことです。
