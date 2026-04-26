#!/bin/sh
set -eu

node server/index.js &
node_pid="$!"

term_handler() {
  kill -TERM "$node_pid" 2>/dev/null || true
  wait "$node_pid" 2>/dev/null || true
}

trap term_handler INT TERM

nginx -g 'daemon off;' &
nginx_pid="$!"

exit_code=0

while kill -0 "$node_pid" 2>/dev/null && kill -0 "$nginx_pid" 2>/dev/null; do
  sleep 1
done

if ! kill -0 "$node_pid" 2>/dev/null; then
  wait "$node_pid" || exit_code="$?"
fi

if ! kill -0 "$nginx_pid" 2>/dev/null; then
  wait "$nginx_pid" || exit_code="$?"
fi

kill -TERM "$node_pid" "$nginx_pid" 2>/dev/null || true
wait "$node_pid" 2>/dev/null || true
wait "$nginx_pid" 2>/dev/null || true

exit "$exit_code"
