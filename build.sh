#!/bin/sh


compile() {
  dir=$1
  pushd . 
  cd $dir
  echo "Compiling $dir"
  rm -r baykit
  rm -f bin/bootstrap.js
  tsc
  popd
}


set_ver() {
  dir=$1
  pushd . 
  cd $dir
  echo "Set version $dir"
  sed -e "s/\"version\": .*/\"version\": \"$version\",/" \
      -e "s/\"bayserver-\(.*\)\": .*/\"bayserver-\1\": \"$version\",/" \
     package.json  > /tmp/package.json
  if [ "$?" != 0 ]; then
    exit
  fi
  mv /tmp/package.json .
  popd
}


version=`cat VERSION`
echo "version=" $version

cd packages
for d in *; do
  set_ver $d
done 
for d in *; do
  if [ "$d" != "bayserver" ]; then
    compile $d
  fi
done 

exit

