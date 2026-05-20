#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path


DEFAULT_ANALYTICS_PATH = Path("/home/xyz-cv/panoworld-tour/analytics.json")
DEFAULT_EXCLUDED_IPS = ("127.0.0.1",)
UTC_PLUS_8 = timezone(timedelta(hours=8))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Count unique visitor IPs from the PanoWorld standalone-tour analytics file."
    )
    parser.add_argument(
        "--analytics",
        default=str(DEFAULT_ANALYTICS_PATH),
        help=f"Path to analytics.json (default: {DEFAULT_ANALYTICS_PATH})",
    )
    parser.add_argument(
        "--exclude",
        action="append",
        default=[],
        help="IP address to exclude from the unique-visitor count. May be specified multiple times.",
    )
    parser.add_argument(
        "--show-ips",
        action="store_true",
        help="Print the filtered IP list after the count.",
    )
    return parser.parse_args()


def load_json(path: Path) -> dict:
    if not path.exists():
        raise FileNotFoundError(f"Analytics file not found: {path}")

    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ValueError(f"Failed to parse JSON from {path}: {exc}") from exc


def collect_unique_ips(data: dict, excluded_ips: set[str]) -> list[str]:
    visits = data.get("visits") or {}
    by_ip = visits.get("by_ip") or {}

    unique_ips = []
    for raw_ip in by_ip.keys():
        ip = str(raw_ip).strip()
        if not ip or ip in excluded_ips:
            continue
        unique_ips.append(ip)

    return sorted(set(unique_ips))


def collect_daily_visits(data: dict) -> list[tuple[str, int]]:
    visits = data.get("visits") or {}
    by_day = visits.get("by_day") or {}

    normalized = []
    for raw_day, raw_count in by_day.items():
        day = str(raw_day).strip()
        if not day:
            continue
        try:
            count = int(raw_count)
        except (TypeError, ValueError):
            continue
        normalized.append((day, count))

    return sorted(normalized, key=lambda item: item[0])


def collect_total_visits(data: dict) -> int:
    visits = data.get("visits") or {}
    try:
        return int(visits.get("total", 0))
    except (TypeError, ValueError):
        return 0


def collect_total_likes(data: dict) -> int:
    likes = data.get("likes") or {}
    by_ip = likes.get("by_ip") or {}
    return len([ip for ip in by_ip.keys() if str(ip).strip()])


def main() -> int:
    args = parse_args()
    analytics_path = Path(args.analytics).expanduser()
    excluded_ips = set(DEFAULT_EXCLUDED_IPS)
    excluded_ips.update(ip.strip() for ip in args.exclude if ip and ip.strip())

    try:
        data = load_json(analytics_path)
        unique_ips = collect_unique_ips(data, excluded_ips)
        total_visits = collect_total_visits(data)
        daily_visits = collect_daily_visits(data)
        total_likes = collect_total_likes(data)
    except (FileNotFoundError, ValueError) as exc:
        print(str(exc), file=sys.stderr)
        return 1

    excluded_list = ", ".join(sorted(excluded_ips))
    current_day_utc8 = datetime.now(UTC_PLUS_8).date().isoformat()

    print("独立版页面统计：")
    print(f"独立版页面去重访问 IP 数（已排除 {excluded_list}）：{len(unique_ips)}")
    print(f"累计总访问次数：{total_visits}")
    print(f"总点赞量：{total_likes}")
    print(f"每天的总访问次数（按 UTC+8 统计，当前日期 {current_day_utc8}）：")

    if daily_visits:
        for day, count in daily_visits:
            print(f"{day}: {count}")
    else:
        print("(暂无按天访问数据)")

    if args.show_ips:
        print("去重访问 IP 列表：")
        for ip in unique_ips:
            print(ip)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
