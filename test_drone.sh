#!/usr/bin/env bash
set -eu

npm cache clean
npm config set ca null
npm config set strict-ssl true
npm config set always-auth true
auth=`echo -n ${npmdeployusername}:${npmdeploypassword} | base64`
npm config set _auth $auth
sed -i.bak s/\${NODEJITSU_AUTH}/$auth/ .npmrc_docker
npm install

npm test
