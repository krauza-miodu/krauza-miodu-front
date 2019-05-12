#!/usr/bin/env node
const fs = require('fs');
const FtpClient = require('ftp');
const glob = require('glob');

const basePath = './dist';
const destinationPath = '/public_nodejs';
const config = {
  host: process.env.FTP_HOST,
  password: process.env.FTP_PASSWORD,
  user: process.env.FTP_USER
};

const ftpClient = new FtpClient();

function createDirectory(destination) {
  return ftpClient.mkdir(destination, true, (error) => {
    if (error) throw error;

    ftpClient.end();
  });
}

function uploadFile(file, destination) {
  ftpClient.put(file, destination, (error) => {
    if (error) throw error;

    console.log(`${file} => ${destination}`);
    ftpClient.end();
  });
}

function handlePath(path) {
  const relativeFile = path.replace(`${basePath}/`, '').replace('server.js', 'app.js');
  const destination = `${destinationPath}/${relativeFile}`;

  if (fs.lstatSync(path).isDirectory()) {
    return createDirectory(destination);
  }

  return uploadFile(path, destination);
}

ftpClient.on('ready', () => {
  // Get an array of all files and directories
  // in the given base path and send them to the
  // `handlePath()` function to decide if a
  // directory is created on the server or the
  // file is uploaded.
  glob.sync(`${basePath}/**/*`).forEach(handlePath);
});

ftpClient.connect(config);