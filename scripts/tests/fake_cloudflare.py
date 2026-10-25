"""Minimal stand-in for the Cloudflare API endpoints used by cf-pages-domain.sh.

Env:
  FAKE_STATE  JSON {"domains": [names], "records": [{id,type,name,content}], "fail": "<method path-prefix>"}
  FAKE_TOKEN  expected bearer token
  FAKE_LOG    file each request is appended to as JSON {method, path, body}
"""
import json
import os
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlparse

state = json.loads(os.environ.get("FAKE_STATE", "{}"))
state.setdefault("domains", [])
state.setdefault("records", [])
token = os.environ.get("FAKE_TOKEN", "t")
log_path = os.environ["FAKE_LOG"]


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def _send(self, payload, code=200):
        data = json.dumps(payload).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _ok(self, result):
        self._send({"success": True, "errors": [], "result": result})

    def _err(self, msg, code=400):
        self._send({"success": False, "errors": [{"message": msg}], "result": None}, code)

    def _handle(self, method):
        url = urlparse(self.path)
        length = int(self.headers.get("Content-Length") or 0)
        body = json.loads(self.rfile.read(length)) if length else None
        with open(log_path, "a") as f:
            f.write(json.dumps({"method": method, "path": url.path, "query": url.query, "body": body}) + "\n")
        if self.headers.get("Authorization") != f"Bearer {token}":
            return self._err("Authentication error", 403)
        fail = state.get("fail", "")
        if fail and f"{method} {url.path}".startswith(fail):
            return self._err("forced failure")
        path = url.path.removeprefix("/client/v4")
        parts = path.strip("/").split("/")
        if (
            len(parts) == 5
            and parts[0] == "accounts"
            and parts[2] == "pages"
            and parts[3] == "projects"
            and method == "GET"
        ):
            name = parts[4]
            if state.get("missing_project"):
                return self._err("project not found", 404)
            subdomain = state.get("subdomain", f"{name}.pages.dev")
            return self._ok({"name": name, "subdomain": subdomain})
        if path.endswith("/domains"):
            if method == "GET":
                return self._ok([{"name": n} for n in state["domains"]])
            state["domains"].append(body["name"])
            return self._ok({"name": body["name"]})
        if path.endswith("/dns_records"):
            if method == "GET":
                name = parse_qs(url.query).get("name", [""])[0]
                return self._ok([r for r in state["records"] if r["name"] == name])
            rec = dict(body, id=f"rec-{len(state['records']) + 1}")
            state["records"].append(rec)
            return self._ok(rec)
        return self._err("not found", 404)

    def do_GET(self):
        self._handle("GET")

    def do_POST(self):
        self._handle("POST")


if __name__ == "__main__":
    server = HTTPServer(("127.0.0.1", 0), Handler)
    print(server.server_address[1], flush=True)
    sys.stdout.close()
    server.serve_forever()
