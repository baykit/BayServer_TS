#!/bin/sh

clean() {
  dir=$1
  pushd . 
  cd $dir
  echo "Cleaning $dir"
  rm -f *.tgz
  npm run clean
  popd
}


cd packages
for d in *; do
  clean $d
done 


