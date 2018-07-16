const tokenizer = require('sbd');

function tokenize(str) {

  str = str.replace(/-\r\n|-\n?\n|-\r?\r/gm, '');
  str = str.replace(/\r\n|\n|\r/gm, ' ');
  str = str.replace(/\s\s/gm, ' ');

  return tokenizer.sentences(str);
}

module.exports = tokenize;
