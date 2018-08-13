// Split text into array of sentences
// https://github.com/Tessmore/sbd

const sbd = require('sbd');

function tokenize(str) {

  // Remove headers
  str = str.replace(/^.*?[\\n]{2,}/, '');

  // Remove superfluous linebreak symbols
  str = str.replace(/[\\n]{2,}/gm, '. ');
  str = str.replace(/[\\n]{1,}/gm, ' ');

  // Remove superfluous spaces
  str = str.replace(/\s{2,}/gm, ' ');

  // Remove faux dot lines
  str = str.replace(/[.]{5,}/g, '. ');

  return sbd.sentences(str);
}

module.exports = tokenize;
