#!/bin/sh

publish() {
  dir=$1
  pushd . 
  cd $dir
  echo "Publishing $dir"
  rm *.tgz
  npm publish --tag=$tag
  popd
}


version=`cat VERSION`
echo "version=$version"

is_test=`echo $version | grep '^0.' `

if [ "$is_test" != "" ]; then
  tag=test
else
  tag=latest
fi
echo tag=$tag

if [ "$1" != "1" ]; then
  exit
fi

cd packages
for d in *; do
  publish $d
done 



exit

