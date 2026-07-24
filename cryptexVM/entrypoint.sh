#!/bin/sh
cp -r /app/zig-out/* /app/shared/
exec "$@"