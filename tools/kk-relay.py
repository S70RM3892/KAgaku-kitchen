#!/usr/bin/env python3
# ケミカル・キッチン「過去問 早押し」用の中継（自分の端末の中だけで動く）。
#
# ブラウザは、配布元のPDFをページから直接読むことを許していない（CORS）。そこで、この端末で
# 小さな中継を動かし、アプリはこの中継を通して配布元から直接PDFを受け取る。
#   - 待ち受けるのはこの端末の中（127.0.0.1）だけ。ほかの端末からはつながらない。
#   - 取りに行くのは、過去問を配っている2か所（school.js88.com・img.cf.47news.jp）の PDF だけ。
#   - 受け取ったPDFはアプリに渡すだけで、ここでは保存しない。
#   - 30分なにも頼まれなければ自動で終わる。止めるときは Ctrl+C。
# 使い方：python3 kk-relay.py [アプリのURL]  （URLを付けると、起動後にアプリを開いて自動で取り込みを始める）
import http.server, json, os, shutil, subprocess, sys, threading, time, urllib.error, urllib.parse, urllib.request, webbrowser

PORT = 8930
HOSTS = {'school.js88.com', 'img.cf.47news.jp'}
IDLE = 30 * 60
last = time.time()


class H(http.server.BaseHTTPRequestHandler):
    def cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.send_header('Access-Control-Allow-Private-Network', 'true')   # 公開サイトから端末の中への接続の許可（Chrome）
        self.send_header('Cache-Control', 'no-store')

    def do_OPTIONS(self):
        self.send_response(204)
        self.cors()
        self.end_headers()

    def fail(self, code, msg):
        b = json.dumps({'ok': False, 'error': msg}).encode()
        self.send_response(code)
        self.cors()
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_GET(self):
        global last
        last = time.time()
        p = urllib.parse.urlparse(self.path)
        if p.path == '/ping':
            b = json.dumps({'ok': True, 'v': 1}).encode()
            self.send_response(200)
            self.cors()
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(b)))
            self.end_headers()
            self.wfile.write(b)
            return
        if p.path != '/get':
            return self.fail(404, 'not found')
        u = urllib.parse.parse_qs(p.query).get('u', [''])[0]
        t = urllib.parse.urlparse(u)
        # 決まった配布元の PDF だけを取りに行く（なんでも取りに行く中継にはしない）
        if t.scheme != 'https' or t.hostname not in HOSTS or not t.path.lower().endswith('.pdf'):
            return self.fail(403, 'not allowed')
        try:
            # 正直に名乗る。配布元に断られた（403・429）ら、それ以上は頼まない（アプリ側も止まる）
            req = urllib.request.Request(u, headers={'User-Agent': 'Mozilla/5.0 (compatible; kk-relay/1; personal use)'})
            with urllib.request.urlopen(req, timeout=60) as r:
                self.send_response(200)
                self.cors()
                self.send_header('Content-Type', 'application/pdf')
                n = r.headers.get('Content-Length')
                if n:
                    self.send_header('Content-Length', n)
                self.end_headers()
                shutil.copyfileobj(r, self.wfile)
            print('取得:', os.path.basename(t.path), flush=True)
        except urllib.error.HTTPError as e:
            print('配布元に断られた:', u, e.code, flush=True)
            try:
                self.fail(429 if e.code in (403, 429) else 502, f'配布元の応答 {e.code}')
            except Exception:
                pass
        except Exception as e:
            print('失敗:', u, e, flush=True)
            try:
                self.fail(502, str(e)[:200])
            except Exception:
                pass

    def log_message(self, *a):
        pass


def idle_stop(srv):
    while True:
        time.sleep(30)
        if time.time() - last > IDLE:
            print('30分使われなかったので終わる', flush=True)
            srv.shutdown()
            return


def open_app(url):
    # Android（Termux）は termux-open-url、それ以外は既定のブラウザで開く
    try:
        if shutil.which('termux-open-url'):
            subprocess.Popen(['termux-open-url', url])
        else:
            webbrowser.open(url)
    except Exception:
        pass


if __name__ == '__main__':
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), H)
    threading.Thread(target=idle_stop, args=(srv,), daemon=True).start()
    print(f'中継を起動した（127.0.0.1:{PORT}）。アプリに戻ると自動で取り込みが始まる。止めるときは Ctrl+C', flush=True)
    if len(sys.argv) > 1 and sys.argv[1].startswith('https://'):
        app = sys.argv[1] + ('&' if '?' in sys.argv[1] else '?') + 'kkauto=1'
        threading.Timer(1.0, open_app, args=(app,)).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
