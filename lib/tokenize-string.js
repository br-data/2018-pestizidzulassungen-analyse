// Split text into array of sentences
// https://github.com/Tessmore/sbd

const sbd = require('sbd');

function tokenize(str) {

  // Remove headers
  str = str.replace(/^.*?(\\n){2,}/, '');

  // Remove superfluous linebreak symbols
  str = str.replace(/(\\n){2,}/g, '. ');
  str = str.replace(/(\\n){1,}/g, ' ');

  // Remove superfluous spaces
  str = str.replace(/\s{2,}/g, ' ');

  // Remove faux dot lines
  str = str.replace(/[.]{5,}/g, '. ');

  return sbd.sentences(str);
}

module.exports = tokenize;
