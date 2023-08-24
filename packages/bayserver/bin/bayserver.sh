#!/bin/sh
base=`dirname $0`

args=$*
daemon=
for arg in $args; do
  if [ "$arg" = "-daemon" ]; then
    daemon=1
  fi
done

bootstrap=$base/../node_modules/.bin/bayserver

if [ "$daemon" = 1 ]; then
   $bootstrap $* < /dev/null  > /dev/null 2>&1 &
else
   $bootstrap $* 
fi
