# PanoWorld Standalone Panorama Tour

This package contains a standalone version of the `Interactive Whole-House Panorama Tour`
module from the PanoWorld project homepage.

## Layout

- `site/`: static files served at `http://<host>:8001/`
- `start.sh`: start the local HTTP server in the background
- `stop.sh`: stop the running server
- `status.sh`: inspect whether the service is running
- `launch.sh`: start the server and open the viewer in the default browser

## Default address

When started on the target desktop, the service listens on:

- `http://0.0.0.0:8001/`

In the current lab network, this should be reachable as:

- `http://10.35.28.39:8001/`
