#!/bin/sh


compile() {
  dir=$1
  pushd . 
  cd $dir
  echo "Compiling $dir"
  npm run clean
  npm run build
  npm pack
  popd
}


set_ver() {
  dir=$1
  pushd . 
  cd $dir
  cp ../../LICENSE.* ../../README.* .
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
sed 's/=.*/="$version"/'  packages/bayserver-core/src/baykit/bayserver/version.ts 

package_list="
  bayserver-core
  bayserver-docker-ajp
  bayserver-docker-cgi
  bayserver-docker-fcgi
  bayserver-docker-http
  bayserver-docker-wordpress
  bayserver
"

pushd .
cd packages
for d in ${package_list}; do
  set_ver $d
done 
for d in ${package_list}; do
#  if [ "$d" != "bayserver" ]; then
    compile $d
#  fi
done 
popd

echo "*********** Creating download package **********"


target_name=BayServer_TS-${version}
target_dir=/tmp/$target_name
stage_log=$stage/log

rm -r ${target_dir}
mkdir -p ${target_dir}

cp -r stage/bin ${target_dir}
cp LICENSE.BAYKIT NEWS.md README.md ${target_dir}
mkdir -p ${target_dir}/log

root=`pwd`
cd ${target_dir}
for pkg in ${package_list}; do
  echo "Installing package: $pkg"
  npm install ${root}/packages/${pkg}/${pkg}-${version}.tgz
done

npx bayserver -init

cd /tmp
tar czf ${target_name}.tgz ${target_name}


