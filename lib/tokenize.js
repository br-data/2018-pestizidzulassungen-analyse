// Split text into array of sentences
// https://github.com/Tessmore/sbd

const sbd = require('sbd');

function tokenize(str) {

  // Join hyphenated words at line break
  str = str.replace(/-\r\n|-\n?\n|-\r?\r/gm, '');
  // Remove all other line breaks
  str = str.replace(/\r\n|\n|\r/gm, ' ');
  // Remove superfluous spaces
  str = str.replace(/\s{2,}/gm, ' ');

  return sbd.sentences(str);
}

module.exports = tokenize;
