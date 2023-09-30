#!/bin/bash
base=`dirname $0`

args=$*
daemon=
for arg in $args; do
  if [ "$arg" = "-daemon" ]; then
    daemon=1
  fi
done

if [ "$BSERV_HOME" == "" ]; then
  export BSERV_HOME=${base}/..
fi

cmd="npx bayserver"
if [ "$daemon" = 1 ]; then
   ${cmd} $* < /dev/null  > /dev/null 2>&1 &
else
   ${cmd} $*
fi
