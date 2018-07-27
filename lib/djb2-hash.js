// Return DJB2 hash for a string
// http://www.cse.yorku.ca/~oz/hash.html

function djb2Hash(str) {

  let hash = 5381;
  let len = str.length;

  while (len) {

    hash = (hash * 33) ^ str.charCodeAt(--len);
  }

  return hash >>> 0;
}

module.exports = djb2Hash;
