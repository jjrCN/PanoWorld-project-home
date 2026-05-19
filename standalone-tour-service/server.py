#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import threading
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit


ROOT_DIR = Path(__file__).resolve().parent
DEFAULT_SITE_DIR = ROOT_DIR / "site"
ANALYTICS_FILE = ROOT_DIR / "analytics.json"
ANALYTICS_LOCK = threading.Lock()


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def today_iso() -> str:
    return datetime.now().date().isoformat()


def default_analytics() -> dict[str, Any]:
    return {
        "schema_version": 1,
        "updated_at": now_iso(),
        "likes": {
            "by_ip": {},
        },
        "visits": {
            "total": 0,
            "by_day": {},
            "by_ip": {},
        },
    }


def load_analytics() -> dict[str, Any]:
    if not ANALYTICS_FILE.exists():
        return default_analytics()

    try:
        data = json.loads(ANALYTICS_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return default_analytics()

    base = default_analytics()
    base.update({key: value for key, value in data.items() if key not in {"likes", "visits"}})
    if isinstance(data.get("likes"), dict):
        base["likes"].update(data["likes"])
    if isinstance(data.get("visits"), dict):
        base["visits"].update(data["visits"])
    base["likes"]["by_ip"] = dict(base["likes"].get("by_ip") or {})
    base["visits"]["by_day"] = dict(base["visits"].get("by_day") or {})
    base["visits"]["by_ip"] = dict(base["visits"].get("by_ip") or {})
    return base


def save_analytics(data: dict[str, Any]) -> None:
    data["updated_at"] = now_iso()
    ANALYTICS_FILE.parent.mkdir(parents=True, exist_ok=True)
    temp_file = ANALYTICS_FILE.with_suffix(".json.tmp")
    temp_file.write_text(
        json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True),
        encoding="utf-8",
    )
    temp_file.replace(ANALYTICS_FILE)


def normalize_ip(raw_ip: str) -> str:
    ip = (raw_ip or "").strip()
    if ip.startswith("::ffff:"):
        return ip[7:]
    return ip or "unknown"


def build_stats_payload(data: dict[str, Any], client_ip: str) -> dict[str, Any]:
    today = today_iso()
    likes_by_ip = data["likes"]["by_ip"]
    visits = data["visits"]
    return {
        "likes": {
            "count": len(likes_by_ip),
            "liked": client_ip in likes_by_ip,
        },
        "visits": {
            "total": visits.get("total", 0),
            "today": visits.get("by_day", {}).get(today, 0),
            "date": today,
        },
    }


def record_visit(client_ip: str) -> dict[str, Any]:
    with ANALYTICS_LOCK:
        data = load_analytics()
        today = today_iso()
        visits = data["visits"]
        visits["total"] = int(visits.get("total", 0)) + 1
        visits_by_day = visits.setdefault("by_day", {})
        visits_by_day[today] = int(visits_by_day.get(today, 0)) + 1

        visits_by_ip = visits.setdefault("by_ip", {})
        ip_entry = visits_by_ip.setdefault(client_ip, {"total": 0, "by_day": {}})
        ip_entry["total"] = int(ip_entry.get("total", 0)) + 1
        ip_entry_by_day = ip_entry.setdefault("by_day", {})
        ip_entry_by_day[today] = int(ip_entry_by_day.get(today, 0)) + 1
        ip_entry["last_visited_at"] = now_iso()

        save_analytics(data)
        return build_stats_payload(data, client_ip)


def toggle_like(client_ip: str) -> dict[str, Any]:
    with ANALYTICS_LOCK:
        data = load_analytics()
        likes_by_ip = data["likes"].setdefault("by_ip", {})
        if client_ip in likes_by_ip:
            del likes_by_ip[client_ip]
        else:
            likes_by_ip[client_ip] = {
                "liked_at": now_iso(),
            }
        save_analytics(data)
        return build_stats_payload(data, client_ip)


def read_stats(client_ip: str) -> dict[str, Any]:
    with ANALYTICS_LOCK:
        return build_stats_payload(load_analytics(), client_ip)


class PanoramaTourHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args: Any, directory: str | None = None, **kwargs: Any) -> None:
        super().__init__(*args, directory=directory, **kwargs)

    def log_message(self, format: str, *args: Any) -> None:
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        message = "%s - - [%s] %s\n" % (self.address_string(), timestamp, format % args)
        print(message, end="")

    def do_GET(self) -> None:
        parsed = urlsplit(self.path)
        path = parsed.path

        if path == "/api/stats":
            self.respond_json(read_stats(self.get_client_ip()))
            return

        if path in {"/", "/index.html"}:
            record_visit(self.get_client_ip())

        super().do_GET()

    def do_POST(self) -> None:
        parsed = urlsplit(self.path)
        path = parsed.path

        if path == "/api/like":
            self.respond_json(toggle_like(self.get_client_ip()))
            return

        self.send_error(404, "Not Found")

    def end_headers(self) -> None:
        path = urlsplit(self.path).path
        if path in {"/", "/index.html", "/api/stats", "/api/like"}:
            self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        else:
            self.send_header("Cache-Control", "public, max-age=86400")
        super().end_headers()

    def respond_json(self, payload: dict[str, Any], status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def get_client_ip(self) -> str:
        forwarded_for = self.headers.get("X-Forwarded-For", "")
        if forwarded_for:
            return normalize_ip(forwarded_for.split(",")[0])
        return normalize_ip(self.client_address[0] if self.client_address else "")


def main() -> None:
    parser = argparse.ArgumentParser(description="PanoWorld standalone panorama tour server")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8001)
    parser.add_argument("--site-dir", default=str(DEFAULT_SITE_DIR))
    args = parser.parse_args()

    site_dir = str(Path(args.site_dir).resolve())
    server = ThreadingHTTPServer(
        (args.host, args.port),
        lambda *handler_args, **handler_kwargs: PanoramaTourHandler(
            *handler_args,
            directory=site_dir,
            **handler_kwargs,
        ),
    )

    print(f"PanoWorld panorama tour server listening on http://{args.host}:{args.port}/")
    print(f"Serving static site from: {site_dir}")
    print(f"Analytics file: {ANALYTICS_FILE}")
    server.serve_forever()


if __name__ == "__main__":
    main()
