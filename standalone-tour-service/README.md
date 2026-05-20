# PanoWorld Standalone Panorama Tour

This package contains a standalone version of the `Interactive Whole-House Panorama Tour`
module from the PanoWorld project homepage.

## Layout

- `site/`: static files served at `http://<host>:8001/`
- `server.py`: lightweight HTTP server with persistent like/visit analytics
- `count_unique_visitors.py`: count unique visitor IPs from `analytics.json`
- `start.sh`: start the local HTTP server in the background
- `stop.sh`: stop the running server
- `status.sh`: inspect whether the service is running
- `launch.sh`: start the server and open the viewer in the default browser
- `analytics.json`: generated at runtime to store likes and visit statistics

## Default address

When started on the target desktop, the service listens on:

- `http://0.0.0.0:8001/`

In the current lab network, this should be reachable as:

- `http://10.35.28.39:8001/`

## Count unique visitor IPs

Run the following on the target desktop:

- `python3 ~/panoworld-tour/count_unique_visitors.py`

This reads `~/panoworld-tour/analytics.json` and reports:

- unique visitor IP count (excluding `127.0.0.1` by default)
- cumulative total visits
- daily total visits
- total likes

Daily totals are displayed from the stored `visits.by_day` entries and are labeled in UTC+8.
If you also want to print the IP list:

- `python3 ~/panoworld-tour/count_unique_visitors.py --show-ips`
