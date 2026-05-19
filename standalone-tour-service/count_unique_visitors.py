#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


DEFAULT_ANALYTICS_PATH = Path("/home/xyz-cv/panoworld-tour/analytics.json")
DEFAULT_EXCLUDED_IPS = ("127.0.0.1",)


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


def main() -> int:
    args = parse_args()
    analytics_path = Path(args.analytics).expanduser()
    excluded_ips = set(DEFAULT_EXCLUDED_IPS)
    excluded_ips.update(ip.strip() for ip in args.exclude if ip and ip.strip())

    try:
        data = load_json(analytics_path)
        unique_ips = collect_unique_ips(data, excluded_ips)
    except (FileNotFoundError, ValueError) as exc:
        print(str(exc), file=sys.stderr)
        return 1

    excluded_list = ", ".join(sorted(excluded_ips))
    print(f"独立版页面去重访问 IP 数（已排除 {excluded_list}）：{len(unique_ips)}")

    if args.show_ips:
        for ip in unique_ips:
            print(ip)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
