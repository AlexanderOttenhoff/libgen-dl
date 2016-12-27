const fs = require('fs');
const request = require('request');
const progress = require('request-progress');
const numeral = require('numeral');

const libgen = require('libgen');
const inquirer = require('inquirer');
// const WebTorrent = require('webtorrent');
const fileSize = require('filesize');
const sanitize = require('sanitize-filename');
const Spinner = require('cli-spinner').Spinner;

const query = process.argv.slice(2).join(' ');

const getBestMirror = () => new Promise((resolve, reject) => {
  const spinner = new Spinner('Finding Mirror');
  spinner.start();
  libgen.mirror((err, url) => {
    spinner.stop(true);
    if (err) return reject(err);
    return resolve(url);
  });
});

const search = options => new Promise((resolve, reject) => {
  const spinner = new Spinner('Searching');
  spinner.start();
  return libgen.search(options, (err, data) => {
    spinner.stop(true);
    if (err) return reject(err);
    return resolve(data);
  });
});

const canDownload = md5 => new Promise((resolve, reject) => {
  const spinner = new Spinner('Finding download link');
  spinner.start();
  return libgen.utils.check.canDownload(md5, (err, url) => {
    spinner.stop(true);
    if (err) return reject(err);
    return resolve(url);
  });
});

const getFileName = book => sanitize(`${book.title}.${book.extension}`);

const downloadHttp = (fileName, url) => new Promise((resolve, reject) => {
  const spinner = new Spinner('Downloading (0%)');
  spinner.start();
  const download = progress(request(url));

  download.on('progress', (state) => {
    const percent = numeral(state.percent).format('0%');
    console.error(state);
    spinner.text = `Downloading (${percent})`;
  });
  download.on('error', (err) => {
    spinner.stop(true);
    reject(err);
  });
  download.on('close', () => {
    spinner.stop(true);
    resolve();
  });
  download.pipe(fs.createWriteStream(fileName));
});

// const downloadTorrent = ({ book }) => {
//   const torrentClient = new WebTorrent();
//   const fileName = getFileName(book);
//   torrentClient.on('error', (err) => { throw err; });
//
//   return new Promise(resolve =>
//     torrentClient.add(Buffer(book.torrent, 'base64'), torrent => resolve(torrent)),
//   ).then(torrent => new Promise((resolve, reject) => {
//     torrent.on('infoHash', () => console.log('infoHash'));
//     torrent.on('metadata', () => console.log('metadata'));
//     torrent.on('ready', () => console.log('ready'));
//     torrent.on('download', bytes => console.log('download', bytes));
//     torrent.on('upload', bytes => console.log('upload', bytes));
//     torrent.on('wire', wire => console.log('wire', wire));
//     torrent.on('noPeers', announceType => console.log('noPeers', announceType));
//
//     torrent.on('error', err => reject(err));
//
//     torrent.on('done', () => torrent.files[0].getBuffer((err, buffer) => {
//       if (errreturn) reject(err);
//       else resolve({ fileName, buffer });
//     }));
//   }));
// };

getBestMirror()
  .then(mirror => search({
    mirror,
    query,
    count: 10,
  }))
  .then(results => inquirer.prompt({
    type: 'list',
    name: 'book',
    message: 'Select a result',
    choices: results.map(result => ({
      name: `${result.title} - ${result.author} - ${result.extension} - ${fileSize(result.filesize)}`,
      value: result,
    })),
  }))
  .then(({ book }) =>
    canDownload(book.md5)
      .then(data => downloadHttp(getFileName(book), data))
      .catch((err) => { throw err; }))
  .then(console.log)
  .catch(console.error);
