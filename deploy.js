#!/usr/bin/env node
const fs = require('fs');
const node_ssh = require('node-ssh');
const ssh = new node_ssh();

const version = `${process.env.CIRCLE_BUILD_NUM}_${process.env.CIRCLE_BRANCH}_${process.env.CIRCLE_SHA1}`;
const basePath = './dist';
const destinationPath = process.env.DEPLOYMENT_PATH;
const fullDestinationPath = `${destinationPath}/${version}`;

function printHeading(text) {
  console.log(`\n\n\n=[ ${text} ]=\n`);
}

function printInfo(text, isError = false) {
  const fn = isError ? console.error : console.info;
  fn(`> ${text}`);
}

function writeFile(file, data) {
  return new Promise((resolve, reject) => {
    fs.writeFile(file, data, error => {
      if (error) reject(error);
      resolve("File created.");
    });
  });
}

function getPrivateKey() {
  const privateKeyBeg = '-----BEGIN RSA PRIVATE KEY-----';
  const privateKeyEnd = '-----END RSA PRIVATE KEY-----';
  const privateKeyContents = process.env.SSH_KEY
    .replace(privateKeyBeg, '')
    .replace(privateKeyEnd, '')
    .replace(/ /g, '\r\n');
  return `${privateKeyBeg}\r\n${privateKeyContents}${privateKeyEnd}`;
}

console.log(`  _  __                         __  __ _           _
 | |/ /                        |  \\/  (_)         | |
 | ' / _ __ __ _ _   _ ______ _| \\  / |_  ___   __| |_   _
 |  < | '__/ _\` | | | |_  / _\` | |\\/| | |/ _ \\ / _\` | | | |
 | . \\| | | (_| | |_| |/ / (_| | |  | | | (_) | (_| | |_| |
 |_|\\_\\_|  \\__,_|\\__,_/___\\__,_|_|  |_|_|\\___/ \\__,_|\\__,_|`);


printHeading('Creating private key file');

ssh.connect({
    host: process.env.SSH_HOST,
    username: process.env.SSH_USERNAME,
    port: process.env.SSH_PORT,
    privateKey: getPrivateKey()
}).catch((error) => {
  printInfo('Unable to connect via SSH.', true);
  console.log({ error });
  return Promise.reject();
}).then(() => {
  printInfo(`Connected via SSH.`)
}).then(() => {
  printHeading('Cleaning up after previous deployment');
}).then(() => {
  return ssh.execCommand(`unlink ./${destinationPath}/public_nodejs`)
}).then(() => {
  return ssh.execCommand(`rm -Rf ./${destinationPath}/public_nodejs`)
}).then(() => {
  return ssh.execCommand(`rm -Rf ./${fullDestinationPath}`)
}).then(() => {
  printInfo('Done.');
  printHeading('Creating version file');
  return writeFile(`${basePath}/browser/version.txt`, version);
}).then(() => {
  printInfo('Done.');
  printHeading('Uploading files');
  return ssh.putDirectory(basePath, `${fullDestinationPath}`, {
    recursive: true,
    concurrency: 2,
    tick(localPath, remotePath, error) {
      if (error) {
        printInfo(`Upload failed:     [ ${localPath} ]`, true);
      } else {
        printInfo(`Upload complete:         [ ${localPath} ]\n                   ----->  [ ${remotePath} ]`)
      }
    }
  })
}).then(uploadinigStatus => {
  if (!uploadinigStatus) {
    printInfo('Uploading task has failed.', true);
    return Promise.reject();
  }
}).then(() => {
  printHeading('Setting up symbolic links')
}).then(() => {
  return ssh.execCommand(`ln -s ./${version} ./${destinationPath}/public_nodejs`)
}).then(() => {
  return ssh.execCommand(`ln -s ./server.js ./${fullDestinationPath}/app.js`)
}).then(() => {
  return ssh.execCommand(`ln -s ./browser ./${fullDestinationPath}/public`)
}).then(() => {
  printInfo('Done.');
  printHeading('Restarting NodeJS server')
}).then(() => {
  return ssh.execCommand('devil www restart new.krauzamiodu.pl');
}).then(() => {
  printInfo('Done.');
  printHeading('Disposing SSH connection');
  ssh.dispose();
  printInfo('Done.');
}).then(() => {
  printHeading('Finishing');
  printInfo('Deployment completed successfully!');
  console.log('\n\n');
  process.exit();
}).catch(() => {
  printHeading('Finishing');
  printInfo('Deployment has failed.', true);
  console.log('\n\n');
  process.exit(1);
});
