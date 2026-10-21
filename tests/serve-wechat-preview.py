"""Local QA only: serve the current assets with the WeChat UI branch forced on.
This does not emulate WeChat's download engine. Never deploy this server.
"""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlsplit
ROOT=Path(__file__).resolve().parents[1]/'dist'
class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs):
        super().__init__(*args,directory=str(ROOT),**kwargs)
    def do_GET(self):
        if urlsplit(self.path).path=='/app.mjs':
            text=(ROOT/'app.mjs').read_text(encoding='utf-8')
            source="const isWeChat=/MicroMessenger/i.test(navigator.userAgent);"
            assert source in text
            body=text.replace(source,'const isWeChat=true; // Local QA fixture only').encode()
            self.send_response(200)
            self.send_header('Content-Type','text/javascript; charset=utf-8')
            self.send_header('Cache-Control','no-store')
            self.send_header('Content-Length',str(len(body)))
            self.end_headers();self.wfile.write(body)
        else: super().do_GET()
print('WeChat UI fixture: http://127.0.0.1:4192/',flush=True)
ThreadingHTTPServer(('127.0.0.1',4192),Handler).serve_forever()
